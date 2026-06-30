# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
SLABond — a bonded SLA that auto-pays its beneficiary on a consensus-detected breach.

A provider posts an SLA: a live URL, a plain-language promise about it (uptime,
status, freshness…), a beneficiary, and a BOND. Anyone can `check`: every
validator independently fetches the URL now and judges whether the promise still
holds; the outcome is accepted only when validators agree on the boolean
(comparative equivalence). Checks recur and build a history. On the FIRST breach,
the bond is paid to the beneficiary via emit_transfer and the SLA is closed.

The verb is "bond a promise → consensus monitoring → automatic penalty on breach"
— recurring verification with money on the line, not a one-shot judgment.
"""
import json
from genlayer import *

MIN_BOND_WEI = 10**15


def normalize_check(raw) -> dict:
    if not isinstance(raw, dict):
        raw = {}
    holds = raw.get("holds")
    holds = bool(holds) if isinstance(holds, bool) else str(holds).strip().lower() in ("true", "yes", "1")
    detail = raw.get("detail")
    detail = detail[:300] if isinstance(detail, str) and detail.strip() else "no detail"
    return {"holds": holds, "detail": detail}


def validate_check(data) -> bool:
    if not isinstance(data, dict):
        return False
    if not isinstance(data.get("holds"), bool):
        return False
    d = data.get("detail")
    return isinstance(d, str) and bool(d.strip())


@gl.evm.contract_interface
class _Payee:
    class View:
        pass

    class Write:
        pass


class SLABond(gl.Contract):
    slas: TreeMap[str, str]
    sla_count: u256
    breached_count: u256
    bonded_wei: u256

    def __init__(self):
        self.sla_count = u256(0)
        self.breached_count = u256(0)
        self.bonded_wei = u256(0)

    @gl.public.write.payable
    def post_sla(self, url: str, promise: str, beneficiary: str) -> str:
        bond = int(gl.message.value)
        if bond < MIN_BOND_WEI:
            raise Exception("bond below minimum")
        url = str(url).strip()
        promise = str(promise).strip()
        beneficiary = str(beneficiary).strip()
        if not url.startswith("http") or not promise or not beneficiary:
            raise Exception("http url, promise and beneficiary required")
        key = str(int(self.sla_count))
        rec = {
            "provider": str(gl.message.sender_address),
            "beneficiary": beneficiary[:60],
            "url": url[:400],
            "promise": promise[:500],
            "bond_wei": str(bond),
            "state": "active",          # active -> breached
            "checks": 0,
            "history": [],              # [{holds, detail}]
            "last_detail": "",
        }
        self.slas[key] = json.dumps(rec)
        self.sla_count += u256(1)
        self.bonded_wei += u256(bond)
        return key

    @gl.public.write
    def check(self, sla_id: str) -> dict:
        """Run a consensus probe now; on the first breach, pay the bond to the beneficiary."""
        sla_id = str(sla_id)
        if sla_id not in self.slas:
            raise Exception("unknown SLA")
        s = json.loads(self.slas[sla_id])
        if s["state"] != "active":
            raise Exception("SLA already closed")

        result = self._probe(s["url"], s["promise"])
        holds = result["holds"]
        s["checks"] = int(s["checks"]) + 1
        s["last_detail"] = result["detail"]
        s["history"].append({"holds": holds, "detail": result["detail"][:120]})
        s["history"] = s["history"][-8:]

        paid = "0"
        if not holds:
            s["state"] = "breached"
            self.breached_count += u256(1)
            bond = int(s["bond_wei"])
            self.bonded_wei -= u256(bond)
            paid = str(bond)
            _Payee(Address(s["beneficiary"])).emit_transfer(value=u256(bond))

        self.slas[sla_id] = json.dumps(s)
        return {"sla": sla_id, "holds": holds, "state": s["state"], "paid_wei": paid}

    def _probe(self, url: str, promise: str) -> dict:
        def fetch_and_judge() -> str:
            live = "(fetch failed)"
            try:
                live = gl.nondet.web.get(url).body.decode("utf-8")[:5000]
            except Exception:
                try:
                    live = gl.nondet.web.render(url, mode="text")[:5000]
                except Exception:
                    live = "(fetch failed)"
            prompt = f"""You verify whether a service-level promise currently holds for a live URL.

PROMISE (should be TRUE if the SLA is met):
{promise}

LIVE CONTENT (fetched now from {url}):
{live}

Does the promise currently hold?
Reply ONLY JSON: {{"holds": true/false, "detail": "<short evidence-based reason>"}}"""
            raw = gl.nondet.exec_prompt(prompt, response_format="json")
            if not isinstance(raw, dict):
                try:
                    raw = json.loads(str(raw))
                except Exception:
                    raw = {}
            return json.dumps(normalize_check(raw))

        result = gl.eq_principle.prompt_comparative(
            fetch_and_judge,
            principle="The 'holds' boolean must match across validators. The detail wording may differ.",
        )
        data = json.loads(result) if isinstance(result, str) else result
        if not validate_check(data):
            data = normalize_check(data if isinstance(data, dict) else {})
        return data

    @gl.public.view
    def read_status(self, sla_id: str) -> dict:
        sla_id = str(sla_id)
        if sla_id not in self.slas:
            return {"exists": False}
        s = json.loads(self.slas[sla_id])
        return {"exists": True, "state": s["state"], "checks": s["checks"]}

    @gl.public.view
    def get_sla(self, sla_id: str) -> dict:
        sla_id = str(sla_id)
        if sla_id not in self.slas:
            return {"exists": False}
        s = json.loads(self.slas[sla_id])
        s["exists"] = True
        return s

    @gl.public.view
    def stats(self) -> dict:
        return {"total_slas": int(self.sla_count), "breached": int(self.breached_count), "bonded_wei": str(int(self.bonded_wei))}
