import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Toaster, toast } from 'sonner'
import { Activity, Wallet, Loader2, Plus, Coins, RadioTower, ShieldX, ArrowDownRight } from 'lucide-react'
import { read, write, connectWallet, isWalletConnected, CONTRACT } from './genlayer'
import { Button } from './components/ui'
import { NumberTicker } from './components/magic'

const EXPLORER = `https://explorer-bradbury.genlayer.com/contract/${CONTRACT}`
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
const toGen = (w: string | number) => Number(BigInt(w || '0')) / 1e18
type SLA = { id: string; provider: string; beneficiary: string; url: string; promise: string; bond_wei: string; state: string; checks: number; history: { holds: boolean; detail: string }[]; last_detail: string }

const FONT = 'Space Grotesk, system-ui, sans-serif'

export default function App() {
  const [wallet, setWallet] = useState<string | null>(null)
  const [stats, setStats] = useState({ total_slas: 0, breached: 0, bonded_wei: '0' })
  const [slas, setSlas] = useState<SLA[]>([])
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState(''); const [promise, setPromise] = useState(''); const [bene, setBene] = useState(''); const [bond, setBond] = useState('0.02')
  const [creating, setCreating] = useState(false); const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    try {
      const s = (await read('stats')) as any
      setStats({ total_slas: Number(s?.total_slas ?? 0), breached: Number(s?.breached ?? 0), bonded_wei: String(s?.bonded_wei ?? '0') })
      const total = Number(s?.total_slas ?? 0); const out: SLA[] = []
      for (let i = total - 1; i >= 0 && i >= total - 24; i--) { try { const x = (await read('get_sla', [String(i)])) as any; if (x?.exists) out.push({ ...x, id: String(i), history: x.history ?? [] }) } catch {} }
      setSlas(out)
    } catch (e) { console.warn(e) }
  }
  useEffect(() => { load(); setWallet(isWalletConnected() ? 'connected' : null) /* eslint-disable-next-line */ }, [])

  async function connect() { try { const a = await connectWallet(); setWallet(a); toast.success(`Connected · ${short(a)}`) } catch (e: any) { toast.error(e?.message ?? 'Failed') } }
  function wei(g: string) { return BigInt(Math.round((Number(g) || 0) * 1e18)) }
  async function post() { if (!url.trim() || !promise.trim() || !bene.trim()) return toast.error('URL, promise, beneficiary.'); if (!(Number(bond) >= 0.001)) return toast.error('≥ 0.001'); setCreating(true); const t = toast.loading('Posting bond…'); try { await write('post_sla', [url.trim(), promise.trim(), bene.trim()], wei(bond)); toast.success('Bonded.', { id: t }); setUrl(''); setPromise(''); setBene(''); setOpen(false); await load() } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: t }) } finally { setCreating(false) } }
  async function check(s: SLA) { setBusy(s.id); const t = toast.loading('Probing… (30–60s)'); try { await write('check', [s.id]); toast.success('Checked.', { id: t }); await load() } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: t }) } finally { setBusy(null) } }

  const breaches = slas.filter((s) => s.state === 'breached')

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: FONT }}>
      <Toaster theme="dark" position="top-right" richColors />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(720px_circle_at_18%_-5%,#38bdf814,transparent_55%)]" />

      {/* ===================== fixed LEFT sidebar ===================== */}
      <aside className="fixed left-0 top-0 z-20 flex h-screen w-64 flex-col border-r border-border bg-surface/80 backdrop-blur-sm">
        {/* brand */}
        <div className="flex items-center gap-2.5 border-b border-border px-5 py-[18px]">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 ring-1 ring-primary/30">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="text-[15px] font-bold leading-none tracking-tight">SLABond</div>
            <div className="mt-1 text-[9px] uppercase tracking-[0.24em] text-muted">treasury desk</div>
          </div>
        </div>

        {/* small nav */}
        <nav className="flex flex-col gap-1 px-3 py-4 text-sm">
          <a href="#treasury" className="flex items-center gap-2.5 rounded-lg bg-white/[0.04] px-3 py-2 font-medium text-foreground hover:bg-white/[0.07]">
            <Coins className="h-4 w-4 text-primary" /> Treasury
          </a>
          <a href="#ledger" className="flex items-center gap-2.5 rounded-lg px-3 py-2 font-medium text-foreground/65 hover:bg-white/[0.05] hover:text-foreground">
            <Activity className="h-4 w-4 text-accent" /> SLA ledger
          </a>
          <a href="#breaches" className="flex items-center gap-2.5 rounded-lg px-3 py-2 font-medium text-foreground/65 hover:bg-white/[0.05] hover:text-foreground">
            <ShieldX className="h-4 w-4 text-false" /> Breach payouts
          </a>
          <button onClick={() => setOpen(!open)} className="mt-1.5 flex items-center gap-2.5 rounded-lg border border-border bg-white/[0.02] px-3 py-2 font-medium text-foreground transition-colors hover:bg-white/[0.06]">
            <Plus className="h-4 w-4 text-primary" /> Bond new SLA
          </button>
        </nav>

        {/* bottom: connect + stats */}
        <div className="mt-auto space-y-2.5 border-t border-border px-4 py-4">
          <Button size="sm" className="w-full" variant={wallet ? 'outline' : 'primary'} onClick={connect}>
            <Wallet className="h-4 w-4" />{wallet && wallet !== 'connected' ? short(wallet) : wallet ? 'Connected' : 'Connect'}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-border bg-card/50 px-2.5 py-2">
              <div className="text-[9px] uppercase tracking-wider text-muted">bonds</div>
              <div className="text-lg font-bold leading-tight tabular-nums">{stats.total_slas}</div>
            </div>
            <div className="rounded-lg border border-border bg-card/50 px-2.5 py-2">
              <div className="text-[9px] uppercase tracking-wider text-muted">breached</div>
              <div className="text-lg font-bold leading-tight tabular-nums text-false">{stats.breached}</div>
            </div>
          </div>
          <div className="rounded-lg border border-primary/20 bg-card/50 px-2.5 py-2">
            <div className="text-[9px] uppercase tracking-wider text-muted">bonded · at risk</div>
            <div className="font-mono text-sm font-semibold tabular-nums text-accent">{toGen(stats.bonded_wei)} GEN</div>
          </div>
          <a href={EXPLORER} target="_blank" rel="noreferrer" className="block truncate text-center font-mono text-[10px] text-muted hover:text-primary">{short(CONTRACT)} ↗</a>
        </div>
      </aside>

      {/* ===================== main dashboard area ===================== */}
      <main className="ml-64 min-h-screen px-6 py-7 lg:px-10">
        {/* treasury hero */}
        <section id="treasury" className="relative overflow-hidden rounded-3xl border-2 border-primary/25 bg-gradient-to-br from-card via-surface to-background p-7 md:p-9">
          <div className="text-[11px] uppercase tracking-[0.3em] text-muted">total bonded · at risk</div>
          <div className="mt-2 flex items-end gap-3">
            <div className="text-5xl font-black leading-none tabular-nums md:text-7xl">
              <NumberTicker value={Number(toGen(stats.bonded_wei).toFixed(3))} decimalPlaces={3} />
            </div>
            <span className="mb-1 text-2xl font-bold text-accent md:text-3xl">GEN</span>
          </div>
          <div className="mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 font-mono text-xs text-muted">
            <span className="inline-flex items-center gap-1.5"><Coins className="h-3.5 w-3.5 text-primary" /> {stats.total_slas} active bonds</span>
            <span className="inline-flex items-center gap-1.5"><ShieldX className="h-3.5 w-3.5 text-false" /> {stats.breached} slashed</span>
            <span>auto-pays beneficiary on consensus breach</span>
          </div>
        </section>

        {/* bond intake form */}
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
            <div className="mt-4 grid gap-2 rounded-2xl border border-border bg-card/60 p-4 sm:grid-cols-2">
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Live URL (https://…/health)" className="rounded-md border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary/50" />
              <input value={promise} onChange={(e) => setPromise(e.target.value)} placeholder="Promise (returns 200…)" className="rounded-md border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary/50" />
              <input value={bene} onChange={(e) => setBene(e.target.value)} placeholder="Beneficiary 0x…" className="rounded-md border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary/50" />
              <div className="flex gap-2"><div className="relative flex-1"><input value={bond} onChange={(e) => setBond(e.target.value)} className="w-full rounded-md border border-border bg-background/70 px-3 py-2 pr-12 text-sm outline-none focus:border-primary/50" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-accent">GEN</span></div><Button size="sm" onClick={post} disabled={creating}>{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />} Bond</Button></div>
            </div>
          </motion.div>
        )}

        {/* SLA ledger */}
        <section id="ledger" className="mt-7">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">SLA ledger</h2>
            <span className="ml-auto font-mono text-xs text-muted">{slas.length} shown</span>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-card/80 text-[11px] uppercase tracking-wider text-muted"><tr><th className="px-4 py-2.5 font-medium">SLA</th><th className="hidden px-4 py-2.5 font-medium md:table-cell">Beneficiary</th><th className="px-4 py-2.5 font-medium">Bond</th><th className="px-4 py-2.5 font-medium">History</th><th className="px-4 py-2.5 text-right font-medium">Status</th></tr></thead>
              <tbody className="divide-y divide-border/60">
                {slas.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted">No bonded SLAs yet.</td></tr>}
                {slas.map((s) => (
                  <tr key={s.id} className={`${s.state === 'breached' ? 'bg-false/[0.04]' : 'bg-background/30'} hover:bg-card/40`}>
                    <td className="px-4 py-3"><div className="max-w-[260px] truncate font-mono text-xs">{s.url}</div><div className="max-w-[260px] truncate text-[11px] text-muted">{s.promise}</div></td>
                    <td className="hidden px-4 py-3 font-mono text-xs text-muted md:table-cell">{short(s.beneficiary)}</td>
                    <td className="px-4 py-3 font-mono tabular-nums text-accent">{toGen(s.bond_wei)}</td>
                    <td className="px-4 py-3"><div className="flex gap-0.5">{s.history.length === 0 ? <span className="text-[11px] text-muted/60">—</span> : s.history.map((h, i) => <span key={i} title={h.detail} className={`h-4 w-1.5 rounded-sm ${h.holds ? 'bg-true' : 'bg-false'}`} />)}</div></td>
                    <td className="px-4 py-3 text-right">{s.state === 'breached' ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-false"><ShieldX className="h-3.5 w-3.5" /> breached</span> : <Button size="sm" disabled={busy === s.id} onClick={() => check(s)}>{busy === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RadioTower className="h-4 w-4" />} check</Button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* breach payout log */}
        {breaches.length > 0 && (
          <section id="breaches" className="mt-7">
            <div className="mb-3 flex items-center gap-2">
              <ShieldX className="h-4 w-4 text-false" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Breach payout log</h2>
            </div>
            <div className="space-y-1.5">
              {breaches.map((s) => (
                <div key={s.id} className="flex items-center gap-2 rounded-lg border border-false/30 bg-false/[0.04] px-3 py-2 text-xs">
                  <ArrowDownRight className="h-3.5 w-3.5 text-false" /><span className="font-mono">{toGen(s.bond_wei)} GEN</span><span className="text-muted">→ {short(s.beneficiary)}</span><span className="ml-auto truncate text-muted">{s.last_detail}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <footer className="mt-10 flex items-center justify-between border-t border-border pt-5 text-xs text-muted">
          <span>SLABond · bonded SLAs with consensus breach payout</span>
          <a href={EXPLORER} target="_blank" rel="noreferrer" className="hover:text-primary">{short(CONTRACT)} ↗</a>
        </footer>
      </main>
    </div>
  )
}
