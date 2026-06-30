"""SLABond tests: check guards + post→check breach payout + a 'holds' (no breach) path."""

BENE = "0xBe2e000000000000000000000000000000000001"
P = 10**18


def test_normalize_check(contract):
    n = contract.normalize_check
    assert n({"holds": True, "detail": "200 OK"})["holds"] is True
    assert n({"holds": "no", "detail": "x"})["holds"] is False
    assert n({})["holds"] is False
    assert n("garbage")["detail"] == "no detail"

def test_validate_check(contract):
    v = contract.validate_check
    assert v({"holds": True, "detail": "uptime nominal"})
    assert not v({"holds": "true", "detail": "x"})
    assert not v({"holds": True, "detail": "  "})


def _new(contract):
    return contract, contract.SLABond()

def test_post_requires_min_bond(contract):
    mod, c = _new(contract)
    mod.gl.message.value = 10**14
    try:
        c.post_sla("https://x.com/health", "200 OK", BENE); assert False, "low bond should fail"
    except Exception:
        pass
    mod.gl.message.value = 0

def test_breach_pays_beneficiary(contract):
    mod, c = _new(contract)
    mod.gl.message.value = P
    sid = c.post_sla("https://api.example/health", "Health endpoint returns 200", BENE)
    mod.gl.message.value = 0
    # offline default holds=False -> first check is a breach -> pay bond to beneficiary
    out = c.check(sid)
    assert out["holds"] is False and out["state"] == "breached" and out["paid_wei"] == str(P)
    assert c.get_sla(sid)["state"] == "breached"
    st = c.stats()
    assert st["breached"] == 1 and st["bonded_wei"] == "0"

def test_holds_keeps_active(contract):
    mod, c = _new(contract)
    mod.gl.message.value = P
    sid = c.post_sla("https://api.example/health", "Returns 200", BENE)
    mod.gl.message.value = 0
    mod.gl.nondet.exec_prompt = staticmethod(lambda *a, **k: {"holds": True, "detail": "200 OK"})
    out = c.check(sid)
    assert out["holds"] is True and out["state"] == "active" and out["paid_wei"] == "0"
    assert c.read_status(sid)["checks"] == 1
    mod.gl.nondet.exec_prompt = staticmethod(lambda *a, **k: {})
