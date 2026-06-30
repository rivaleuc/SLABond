# SLABond

**A bonded SLA that auto-pays its beneficiary on a consensus-detected breach.**

[![GenLayer](https://img.shields.io/badge/GenLayer-Bradbury-ff4d6d)](https://genlayer.com) [![chainId](https://img.shields.io/badge/chainId-4221-4dd0e1)](https://docs.genlayer.com) [![contract](https://img.shields.io/badge/contract-Python%20GenVM-8a63d2)](https://docs.genlayer.com) [![tests](https://img.shields.io/badge/tests-5%2F5%20passing-3fb950)](tests) [![frontend](https://img.shields.io/badge/frontend-React%20%2B%20Vite%20%2B%20genlayer--js-22a6f2)](app) [![live](https://img.shields.io/badge/live-slabond.pages.dev-f59e0b)](https://slabond.pages.dev) [![License](https://img.shields.io/badge/license-MIT-2dd4bf)](LICENSE)

A provider posts an SLA: a live URL, a plain-language promise about it (uptime, status, freshness…), a
beneficiary, and a **bond**. Anyone can `check`: every validator independently fetches the URL now and
judges whether the promise still holds; the outcome is accepted only when validators agree on the
boolean (comparative equivalence). Checks recur and build a history. On the **first breach**, the bond
is paid to the beneficiary via `emit_transfer` and the SLA closes.

The verb is **"bond a promise → consensus monitoring → automatic penalty on breach"** — recurring
verification with money on the line, not a one-shot judgment.

- **Live demo:** https://slabond.pages.dev
- **Contract (Bradbury, chain 4221):** `0x8AF9Ee3958C858472F7690a1454a5775bA4391d7`
- **Deployed from:** `rivale` (`0xc388…51A44`)
- **Explorer:** https://explorer-bradbury.genlayer.com/contract/0x8AF9Ee3958C858472F7690a1454a5775bA4391d7

---

## Why GenLayer is essential

Enforcing an SLA means repeatedly checking a live endpoint and judging a fuzzy promise — a bare EVM has
no web access. GenLayer validators fetch and agree on whether the promise holds, and the contract moves
the bond automatically on breach: trustless, recurring, penalty-backed monitoring.

## Workflow

| Step | Method | What happens |
| --- | --- | --- |
| Bond | `post_sla(url, promise, beneficiary)` *(payable)* | Stakes a bond behind a promise. |
| Check | `check(id)` | Consensus probe; on first breach, bond → beneficiary. |
| Read | `get_sla(id)` / `read_status(id)` / `stats()` | State, check history, bond. |

### Correctness check

`_probe` wraps the judgment in **`gl.eq_principle.prompt_comparative`** — principle: *"the `holds`
boolean must match across validators."* `validate_check` requires a real boolean + non-empty detail;
`normalize_check` defaults `holds=false` (so an unverifiable check is treated as a potential breach —
conservative for the beneficiary). The bond pays out exactly once, on the first `holds=false`.
Unit-tested incl. a breach→payout run and a holds→stay-active run.

## Architecture

```
SLABond/
├── contracts/sla_bond.py  ← GenLayer Intelligent Contract (recurring consensus probe + bond payout via emit_transfer)
├── tests/                 ← pytest: check guards, breach payout, holds path, min-bond guard
└── app/                   ← React + Vite + Tailwind v4 + Framer Motion (21st.dev style)
                             sky uptime theme, bonded monitors + heartbeat history + breach payout
```

## Tests

```bash
cd SLABond
python3 -m venv .venv && .venv/bin/pip install pytest -q
.venv/bin/python -m pytest tests/ -q
```
Covers `normalize_check` / `validate_check`, a full **post → check → breach → pay beneficiary** run, a
**holds → stays active** run, and the min-bond guard (shim auto-inits `TreeMap`, stubs `emit_transfer`).
On-chain: deployment verified live (`stats`); payable path exercised in-app.

## Deploy

```bash
genlayer deploy --contract contracts/sla_bond.py
```
