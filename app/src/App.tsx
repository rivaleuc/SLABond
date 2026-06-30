import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Toaster, toast } from 'sonner'
import {
  Activity, Wallet, Loader2, Plus, Coins, RadioTower, ShieldX, CheckCircle2,
} from 'lucide-react'
import { read, write, connectWallet, isWalletConnected, CONTRACT } from './genlayer'
import { Button } from './components/ui'
import { NumberTicker } from './components/magic'

const EXPLORER = `https://explorer-bradbury.genlayer.com/contract/${CONTRACT}`
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
const toGen = (wei: string | number) => Number(BigInt(wei || '0')) / 1e18

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
      for (let i = total - 1; i >= 0 && i >= total - 12; i--) { try { const x = (await read('get_sla', [String(i)])) as any; if (x?.exists) out.push({ ...x, id: String(i), history: x.history ?? [] }) } catch {} }
      setSlas(out)
    } catch (e) { console.warn(e) }
  }
  useEffect(() => { load(); setWallet(isWalletConnected() ? 'connected' : null) /* eslint-disable-next-line */ }, [])

  async function connect() { try { const a = await connectWallet(); setWallet(a); toast.success(`Connected · ${short(a)}`) } catch (e: any) { toast.error(e?.message ?? 'Failed') } }
  function wei(g: string) { return BigInt(Math.round((Number(g) || 0) * 1e18)) }
  async function post() { if (!url.trim() || !promise.trim() || !bene.trim()) return toast.error('URL, promise, beneficiary.'); const g = Number(bond); if (!(g >= 0.001)) return toast.error('Bond ≥ 0.001 GEN'); setCreating(true); const t = toast.loading('Posting bonded SLA…'); try { await write('post_sla', [url.trim(), promise.trim(), bene.trim()], wei(bond)); toast.success('SLA bonded.', { id: t }); setUrl(''); setPromise(''); setBene(''); setOpen(false); await load() } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: t }) } finally { setCreating(false) } }
  async function check(s: SLA) { setBusy(s.id); const t = toast.loading('Validators probing the endpoint… (30–60s)'); try { const out = (await write('check', [s.id])) as any; toast.success('Checked.', { id: t }); await load() } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: t }) } finally { setBusy(null) } }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster theme="dark" position="top-right" richColors />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(720px_circle_at_50%_-5%,#38bdf81c,transparent_60%)]" />

      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-2.5 px-5">
          <Activity className="h-5 w-5 text-primary" /><span className="text-[15px] font-bold tracking-tight">SLABond</span>
          <div className="ml-4 hidden font-mono text-xs text-muted md:block"><b className="text-foreground"><NumberTicker value={stats.total_slas} /></b> SLAs · <b className="text-false"><NumberTicker value={stats.breached} /></b> breached · <b className="text-accent"><NumberTicker value={Number(toGen(stats.bonded_wei).toFixed(3))} decimalPlaces={3} /></b> GEN bonded</div>
          <Button size="sm" className="ml-auto" variant={wallet ? 'outline' : 'primary'} onClick={connect}><Wallet className="h-4 w-4" />{wallet && wallet !== 'connected' ? short(wallet) : wallet ? 'Connected' : 'Connect'}</Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-8">
        <h1 className="text-2xl font-black tracking-tight md:text-3xl">SLAs with a bond on the line</h1>
        <p className="mt-1 text-sm text-muted">Post a promise about a live endpoint and bond it. Validators probe on demand — the first consensus breach auto-pays your beneficiary.</p>

        <div className="mt-5"><Button onClick={() => setOpen(!open)} variant={open ? 'ghost' : 'primary'}><Plus className="h-4 w-4" />{open ? 'Cancel' : 'Bond an SLA'}</Button></div>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
            <div className="mt-3 grid gap-2 rounded-xl border border-border bg-card/60 p-3">
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Live URL to monitor (https://…/health)" className="rounded-md border border-border bg-background/70 px-3 py-2.5 text-sm outline-none focus:border-primary/50" />
              <input value={promise} onChange={(e) => setPromise(e.target.value)} placeholder="Promise — e.g. “endpoint returns status: ok”" className="rounded-md border border-border bg-background/70 px-3 py-2.5 text-sm outline-none focus:border-primary/50" />
              <div className="flex gap-2"><input value={bene} onChange={(e) => setBene(e.target.value)} placeholder="Beneficiary 0x…" className="flex-1 rounded-md border border-border bg-background/70 px-3 py-2.5 text-sm outline-none focus:border-primary/50" /><div className="relative w-28"><input value={bond} onChange={(e) => setBond(e.target.value)} className="w-full rounded-md border border-border bg-background/70 px-3 py-2.5 pr-10 text-sm outline-none focus:border-primary/50" /><span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-accent">GEN</span></div><Button size="sm" onClick={post} disabled={creating}>{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />} Bond</Button></div>
            </div>
          </motion.div>
        )}

        <div className="mt-6 space-y-3">
          {slas.length === 0 && <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">No SLAs yet.</div>}
          {slas.map((s) => {
            const breached = s.state === 'breached'
            return (
              <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`rounded-2xl border p-4 ${breached ? 'border-false/40 bg-false/[0.04]' : 'border-border bg-card/55'}`}>
                <div className="flex items-center gap-2">
                  <span className={`relative flex h-2.5 w-2.5`}>{!breached && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-true opacity-60" />}<span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${breached ? 'bg-false' : 'bg-true'}`} /></span>
                  <span className="truncate font-mono text-sm">{s.url}</span>
                  <span className="ml-auto font-mono text-xs text-accent">{toGen(s.bond_wei)} GEN</span>
                </div>
                <p className="mt-1.5 text-sm text-muted">{s.promise}</p>
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex gap-1">{s.history.length === 0 ? <span className="text-[11px] text-muted/60">no checks yet</span> : s.history.map((h, i) => <span key={i} title={h.detail} className={`h-4 w-2 rounded-sm ${h.holds ? 'bg-true' : 'bg-false'}`} />)}</div>
                  <span className="font-mono text-[11px] text-muted">{s.checks} checks → {short(s.beneficiary)}</span>
                  <div className="ml-auto">
                    {breached ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-false"><ShieldX className="h-3.5 w-3.5" /> breached · bond paid</span>
                      : <Button size="sm" disabled={busy === s.id} onClick={() => check(s)}>{busy === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RadioTower className="h-4 w-4" />} Check now</Button>}
                  </div>
                </div>
                {breached && s.last_detail && <p className="mt-2 text-[11px] text-muted">{s.last_detail}</p>}
              </motion.div>
            )
          })}
        </div>
      </main>

      <footer className="border-t border-border"><div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-6 text-xs text-muted"><span>SLABond · bonded SLAs with consensus breach payout on GenLayer</span><a href={EXPLORER} target="_blank" rel="noreferrer" className="hover:text-primary">{short(CONTRACT)} ↗</a></div></footer>
    </div>
  )
}
