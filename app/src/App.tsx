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
    <div className="min-h-screen bg-background text-foreground">
      <Toaster theme="dark" position="top-right" richColors />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_circle_at_50%_-10%,#38bdf818,transparent_60%)]" />
      <header className="border-b border-border"><div className="mx-auto flex h-16 max-w-5xl items-center gap-2.5 px-5">
        <Activity className="h-5 w-5 text-primary" /><span className="text-[15px] font-bold tracking-tight">SLABond</span>
        <Button size="sm" className="ml-auto" variant="outline" onClick={() => setOpen(!open)}><Plus className="h-4 w-4" /> Bond SLA</Button>
        <Button size="sm" className="ml-2" variant={wallet ? 'outline' : 'primary'} onClick={connect}><Wallet className="h-4 w-4" />{wallet && wallet !== 'connected' ? short(wallet) : wallet ? 'Connected' : 'Connect'}</Button>
      </div></header>

      <main className="mx-auto max-w-5xl px-5 py-7">
        {/* treasury hero */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-card to-background p-5 sm:col-span-2">
            <div className="text-[11px] uppercase tracking-[0.25em] text-muted">total bonded · at risk</div>
            <div className="mt-1 text-4xl font-black tabular-nums md:text-5xl"><NumberTicker value={Number(toGen(stats.bonded_wei).toFixed(3))} decimalPlaces={3} /> <span className="text-xl text-accent">GEN</span></div>
            <div className="mt-2 font-mono text-xs text-muted">{stats.total_slas} active bonds · auto-pays beneficiary on consensus breach</div>
          </div>
          <div className="rounded-2xl border border-border bg-card/50 p-5 text-center">
            <div className="text-[11px] uppercase tracking-wider text-muted">breaches</div>
            <div className="mt-1 text-4xl font-black tabular-nums text-false"><NumberTicker value={stats.breached} /></div>
            <div className="mt-1 text-[11px] text-muted">bonds slashed</div>
          </div>
        </div>

        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
            <div className="mt-4 grid gap-2 rounded-xl border border-border bg-card/60 p-3 sm:grid-cols-2">
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Live URL (https://…/health)" className="rounded-md border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary/50" />
              <input value={promise} onChange={(e) => setPromise(e.target.value)} placeholder="Promise (returns 200…)" className="rounded-md border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary/50" />
              <input value={bene} onChange={(e) => setBene(e.target.value)} placeholder="Beneficiary 0x…" className="rounded-md border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary/50" />
              <div className="flex gap-2"><div className="relative flex-1"><input value={bond} onChange={(e) => setBond(e.target.value)} className="w-full rounded-md border border-border bg-background/70 px-3 py-2 pr-12 text-sm outline-none focus:border-primary/50" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-accent">GEN</span></div><Button size="sm" onClick={post} disabled={creating}>{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />} Bond</Button></div>
            </div>
          </motion.div>
        )}

        {/* ledger */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-card/80 text-[11px] uppercase tracking-wider text-muted"><tr><th className="px-4 py-2.5 font-medium">SLA</th><th className="hidden px-4 py-2.5 font-medium md:table-cell">Beneficiary</th><th className="px-4 py-2.5 font-medium">Bond</th><th className="px-4 py-2.5 font-medium">History</th><th className="px-4 py-2.5 text-right font-medium">Status</th></tr></thead>
            <tbody className="divide-y divide-border/60">
              {slas.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">No bonded SLAs yet.</td></tr>}
              {slas.map((s) => (
                <tr key={s.id} className={`${s.state === 'breached' ? 'bg-false/[0.04]' : 'bg-background/30'} hover:bg-card/40`}>
                  <td className="px-4 py-3"><div className="max-w-[220px] truncate font-mono text-xs">{s.url}</div><div className="max-w-[220px] truncate text-[11px] text-muted">{s.promise}</div></td>
                  <td className="hidden px-4 py-3 font-mono text-xs text-muted md:table-cell">{short(s.beneficiary)}</td>
                  <td className="px-4 py-3 font-mono tabular-nums text-accent">{toGen(s.bond_wei)}</td>
                  <td className="px-4 py-3"><div className="flex gap-0.5">{s.history.length === 0 ? <span className="text-[11px] text-muted/60">—</span> : s.history.map((h, i) => <span key={i} title={h.detail} className={`h-4 w-1.5 rounded-sm ${h.holds ? 'bg-true' : 'bg-false'}`} />)}</div></td>
                  <td className="px-4 py-3 text-right">{s.state === 'breached' ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-false"><ShieldX className="h-3.5 w-3.5" /> breached</span> : <Button size="sm" disabled={busy === s.id} onClick={() => check(s)}>{busy === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RadioTower className="h-4 w-4" />} check</Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* payout log */}
        {breaches.length > 0 && (
          <div className="mt-5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Breach payout log</div>
            <div className="space-y-1.5">
              {breaches.map((s) => (
                <div key={s.id} className="flex items-center gap-2 rounded-lg border border-false/30 bg-false/[0.04] px-3 py-2 text-xs">
                  <ArrowDownRight className="h-3.5 w-3.5 text-false" /><span className="font-mono">{toGen(s.bond_wei)} GEN</span><span className="text-muted">→ {short(s.beneficiary)}</span><span className="ml-auto truncate text-muted">{s.last_detail}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
      <footer className="border-t border-border"><div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6 text-xs text-muted"><span>SLABond · bonded SLAs with consensus breach payout</span><a href={EXPLORER} target="_blank" rel="noreferrer" className="hover:text-primary">{short(CONTRACT)} ↗</a></div></footer>
    </div>
  )
}
