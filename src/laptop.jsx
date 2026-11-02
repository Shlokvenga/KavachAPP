// Laptop edition: the Admin console. Served by the Kavach hub to this laptop only
// (http://localhost:8787); phones get the phone edition. Desktop layout with a
// sidebar, the 3D twin, laptop webcams with on-device AI, and the Setup wizard.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ALERT_TYPES, CP, GENDER, PRI, ago, cls, fmtTime, pad } from './data.js';
import { AppCtx, useApp } from './ctx.js';
import { CAMERAS, CAMPUS_SHORT } from './campus.js';
import { useKavach } from './useKavach.js';
import { hubAdmin } from './sync.js';
import { SyncChip } from './pair.jsx';
import { CameraViewer, CamTile, camStatus, remoteHost } from './cctv.jsx';
import CampusMap from './map.jsx';
import { CommandCentre } from './twinview.jsx';
import { Audit, CctvHealth, CrossModule, GettingStarted, Heatmap, Inventory, LiveAlerts, StatGrid, TwinPanel, Visitors } from './admin.jsx';
import { AiAdminCard, AiExplain, CamConnect, useVision } from './vision/ui.jsx';
import { isLive, liveCount } from './vision/live.js';
import { Badge, Btn, Card, CheckpointPhoto, Icon, LiveDot, Logo, QR, SectionTitle, Toasts } from './ui.jsx';

const PAGES = [
  { id: 'overview', label: 'Overview', icon: 'chart', sub: 'Live picture of the campus' },
  { id: 'twin', label: 'Digital twin', icon: 'map', sub: '3D campus, cameras, alerts and heatmap' },
  { id: 'cams', label: 'Cameras', icon: 'video', sub: 'Connect laptop webcams, camera wall' },
  { id: 'alerts', label: 'Alerts', icon: 'bell', sub: 'Every alert, open and closed' },
  { id: 'visitors', label: 'Visitors', icon: 'badge', sub: 'Visitor passes, zones and times' },
  { id: 'stock', label: 'Lab stock', icon: 'box', sub: 'LabLedger inventory and yearly report' },
  { id: 'audit', label: 'Audit', icon: 'eye', sub: 'Transparency report and audit log' },
  { id: 'setup', label: 'Setup', icon: 'settings', sub: 'Hub, phones, cameras and data' },
];

function App() {
  const [page, setPage] = useState(null);
  const [cam, setCam] = useState(null);
  const [cc, setCc] = useState(false);
  const [setup, setSetup] = useState(null);
  const k = useKavach({ edition: 'laptop', role: 'admin', deviceName: 'Security laptop' });

  // hub details (pairing code, addresses); only this laptop can read them
  const loadSetup = useCallback(() => {
    if (k.mode !== 'hub') return;
    hubAdmin.setup().then(setSetup).catch(() => setSetup(null));
  }, [k.mode]);
  useEffect(() => { loadSetup(); }, [loadSetup]);
  // first run opens Setup
  useEffect(() => {
    if (page) return;
    if (k.mode !== 'hub') { setPage('overview'); return; }
    if (setup) setPage(setup.setupDone ? 'overview' : 'setup');
  }, [setup, page, k.mode]);

  const go = useCallback((p) => { if (p === 'cc') setCc(true); else setPage(p); }, []);
  const ctx = useMemo(() => ({ ...k, role: 'admin', roles: ['admin'], desk: true, go, setup, loadSetup }), [k, go, setup, loadSetup]);
  const cur = PAGES.find((p) => p.id === page) || PAGES[0];

  return (
    <AppCtx.Provider value={ctx}>
      <div className="flex h-[100dvh] w-full overflow-hidden bg-slate-50 text-slate-900">
        <Sidebar page={page} go={go} />
        <main className="flex min-w-0 flex-1 flex-col">
          <Header page={cur} />
          <div className="relative min-h-0 flex-1">
            <div className="absolute inset-0 overflow-y-auto" key={page}>
              {k.mode === 'local' && <LocalBanner />}
              {page === 'overview' && <Overview openCam={setCam} openCc={() => setCc(true)} />}
              {page === 'twin' && <TwinPage openCam={setCam} openCc={() => setCc(true)} />}
              {page === 'cams' && <CamerasPage openCam={setCam} />}
              {page === 'alerts' && <AlertsPage openCam={setCam} />}
              {page === 'visitors' && <Narrow><Visitors /></Narrow>}
              {page === 'stock' && <Narrow><Inventory /></Narrow>}
              {page === 'audit' && <Narrow><Audit /></Narrow>}
              {page === 'setup' && <SetupPage />}
            </div>
            {cam && <CameraViewer key={cam} camId={cam} onClose={() => setCam(null)} who="Admin (Security office)" />}
            <div className="pointer-events-none absolute right-4 top-2 z-[60] w-[380px] max-w-[calc(100%-2rem)]"><Toasts role="admin" /></div>
          </div>
        </main>
      </div>
      {cc && <CommandCentre onClose={() => setCc(false)} />}
    </AppCtx.Provider>
  );
}

const Narrow = ({ children }) => <div className="mx-auto w-full max-w-3xl">{children}</div>;

function Sidebar({ page, go }) {
  const { s, sync } = useApp();
  const open = s.alerts.filter((a) => a.status !== 'resolved').length;
  const low = s.inventory.filter((i) => i.kind === 'consumable' && i.stock < i.min).length;
  const camIssues = CAMERAS.filter((c) => ['tampered', 'offline'].includes(camStatus(s, c.id))).length;
  const badge = { alerts: open, stock: low, cams: camIssues };
  const devices = ((s.net && s.net.devices) || []).filter((d) => d.kind !== 'laptop');
  const online = devices.filter((d) => d.online).length;
  return (
    <nav className="flex w-[232px] shrink-0 flex-col border-r border-line bg-[#060c11] text-white" aria-label="Console">
      <div className="flex items-center gap-2.5 px-5 pb-5 pt-5">
        <Logo className="h-9 w-9" />
        <div>
          <div className="font-display text-xl font-bold uppercase leading-none tracking-[.08em] text-brand">Kavach</div>
          <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[.14em] text-slate-500">Admin console</div>
        </div>
      </div>
      <div className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {PAGES.map((p) => (
          <button key={p.id} type="button" onClick={() => go(p.id)} aria-current={page === p.id ? 'page' : undefined}
            className={cls('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition',
              p.id === 'setup' && 'mt-3', page === p.id ? 'bg-brand/15 text-brand ring-1 ring-brand/30' : 'text-slate-400 hover:bg-white/5 hover:text-white')}>
            <Icon name={p.icon} className="h-[18px] w-[18px]" />
            <span className="flex-1">{p.label}</span>
            {badge[p.id] > 0 && <span className={cls('grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[10px] font-bold', p.id === 'alerts' ? 'bg-red-600 text-white' : 'bg-amber-500 text-ink')}>{badge[p.id]}</span>}
          </button>
        ))}
        <button type="button" onClick={() => go('cc')} className="mt-3 flex w-full items-center gap-3 rounded-xl bg-gradient-to-br from-brand/20 to-transparent px-3 py-2.5 text-left text-sm font-semibold text-white ring-1 ring-brand/30 hover:ring-brand/60">
          <Icon name="columns" className="h-[18px] w-[18px] text-accent" /><span className="flex-1">Command centre</span><Icon name="chevR" className="h-4 w-4 text-slate-500" />
        </button>
      </div>
      <div className="m-3 rounded-2xl bg-white/[.04] p-3 ring-1 ring-white/10">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">Campus hub</span>
          <span className={cls('h-2 w-2 rounded-full', sync.status === 'online' ? 'bg-emerald-400' : sync.status === 'local' ? 'bg-slate-500' : 'bg-red-400')} />
        </div>
        <div className="mt-1 text-sm font-semibold">{sync.status === 'local' ? 'Not running' : sync.status === 'online' ? 'Running on this laptop' : 'Reconnecting…'}</div>
        <div className="mt-0.5 text-xs text-slate-500">{online} of {devices.length} phone{devices.length === 1 ? '' : 's'} online · {(() => { const n = CAMERAS.filter((c) => camStatus(s, c.id) === 'online').length; return `${n} camera${n === 1 ? '' : 's'} live`; })()}</div>
      </div>
    </nav>
  );
}

function Header({ page }) {
  const { now } = useApp();
  const d = new Date(now);
  return (
    <header className="flex shrink-0 items-center gap-4 border-b border-line bg-[#060c11]/80 px-6 py-3.5 backdrop-blur">
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-xl font-bold uppercase tracking-[.06em] text-slate-900">{page.label}</h1>
        <p className="text-xs text-slate-500">{page.sub} · {CAMPUS_SHORT}</p>
      </div>
      <SyncChip />
      <div className="text-right font-mono">
        <div className="text-lg font-bold tabular-nums text-slate-900">{pad(d.getHours())}:{pad(d.getMinutes())}<span className="text-slate-500">:{pad(d.getSeconds())}</span></div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500">{d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
      </div>
    </header>
  );
}

function LocalBanner() {
  return (
    <div className="mx-6 mt-4 flex items-start gap-3 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
      <Icon name="info" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
      <p>This console was opened as a file, so it runs stand-alone: phones cannot connect and cameras are off. Start Kavach with <b>start-windows.bat</b>, <b>start-mac.command</b> or <b>start-linux.sh</b>, then open <span className="font-mono">http://localhost:8787</span>.</p>
    </div>
  );
}

// ---------------- Overview ----------------
function Overview({ openCam, openCc }) {
  const { go } = useApp();
  return (
    <div className="space-y-5 p-6">
      <GettingStarted go={go} />
      <StatGrid go={go} className="lg:grid-cols-3 2xl:grid-cols-6" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(340px,1fr)]">
        <TwinPanel openCam={openCam} openCc={openCc} className="h-[440px]" />
        <div className="space-y-5">
          <LiveAlerts go={go} limit={5} />
          <CctvHealth openCam={openCam} go={go} />
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <AiAdminCard />
        <CrossModule />
      </div>
    </div>
  );
}

function TwinPage({ openCam, openCc }) {
  return (
    <div className="grid gap-5 p-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <TwinPanel openCam={openCam} openCc={openCc} className="h-[calc(100dvh-220px)] min-h-[420px]" />
      <Heatmap />
    </div>
  );
}

// ---------------- Cameras ----------------
const GROUPS = [
  ['Gates and admin', (c) => ['GATE', 'ADMIN'].includes(c.cp)],
  ['Paths and junctions', (c) => ['A', 'B', 'C', 'F', 'K'].includes(c.cp)],
  ['Hostels', (c) => ['D', 'E'].includes(c.cp)],
  ['Lab and perimeter', (c) => ['LAB', 'WALL'].includes(c.cp)],
];

function CamerasPage({ openCam }) {
  const { s } = useApp();
  useVision();
  const here = liveCount();
  const remote = CAMERAS.filter((c) => !isLive(c.id) && remoteHost(s, c.id) && remoteHost(s, c.id).kind !== 'laptop').length;
  return (
    <div className="grid gap-5 p-6 xl:grid-cols-[400px_minmax(0,1fr)]">
      <div className="space-y-4">
        <Card>
          <div className="flex items-center gap-2"><Icon name="laptop" className="h-5 w-5 text-brand" /><h3 className="font-bold text-slate-900">Cameras on this laptop</h3></div>
          <p className="mt-1 text-sm text-slate-600">Plug in USB webcams (or use the built-in one) and assign each to a campus camera. The AI runs here, and guard phones paired with this hub can watch the live view.</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-raise py-2"><div className="text-xl font-extrabold text-brand">{here}</div><div className="text-[11px] text-slate-500">on this laptop</div></div>
            <div className="rounded-xl bg-raise py-2"><div className="text-xl font-extrabold text-slate-900">{remote}</div><div className="text-[11px] text-slate-500">on paired phones</div></div>
          </div>
        </Card>
        <CamConnect />
      </div>
      <div className="space-y-5">
        {GROUPS.map(([title, f]) => (
          <div key={title}>
            <SectionTitle>{title}</SectionTitle>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-4">
              {CAMERAS.filter(f).map((c) => <CamTile key={c.id} camId={c.id} onOpen={openCam} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------- Alerts ----------------
function AlertsPage({ openCam }) {
  const { s, now } = useApp();
  const [filter, setFilter] = useState('open');
  const [sel, setSel] = useState(null);
  const list = s.alerts.filter((a) => filter === 'all' || (filter === 'open' ? a.status !== 'resolved' : a.status === 'resolved'));
  return (
    <div className="grid gap-5 p-6 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.9fr)]">
      <div className="space-y-3">
        <Card className="p-2"><CampusMap alerts={s.alerts} guards={s.guards} walk={s.walk} selected={sel} onSelect={setSel} showCams cams={Object.fromEntries(CAMERAS.map((c) => [c.id, { status: camStatus(s, c.id) }]))} onCam={openCam} /></Card>
        <p className="px-1 text-xs text-slate-500">Guards act on alerts from their phones. Click a red dot to find the alert, or a camera to open it.</p>
      </div>
      <div>
        <div className="mb-3 flex gap-2">
          {[['open', 'Open'], ['resolved', 'Closed'], ['all', 'All']].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setFilter(k)} className={cls('rounded-full px-3.5 py-1.5 text-sm font-semibold', filter === k ? 'bg-brand text-ink' : 'bg-card text-slate-600 ring-1 ring-slate-200')}>{l}</button>
          ))}
        </div>
        <div className="space-y-3">
          {list.length === 0 && <Card className="py-8 text-center text-sm text-slate-500">{filter === 'open' ? 'No open alerts. All quiet.' : 'No alerts yet.'}</Card>}
          {list.map((a) => <AlertRow key={a.id} a={a} now={now} open={sel === a.id} onToggle={() => setSel(sel === a.id ? null : a.id)} openCam={openCam} />)}
        </div>
      </div>
    </div>
  );
}

function AlertRow({ a, now, open, onToggle, openCam }) {
  const { s } = useApp();
  const T = ALERT_TYPES[a.type];
  const P = PRI[T.pri];
  const g = a.acceptedName ? { name: a.acceptedName } : s.guards.find((x) => x.id === (a.acceptedBy || a.assigned));
  const status = a.status === 'resolved' ? ['Closed', 'bg-emerald-100 text-emerald-700'] : a.escalated ? ['Escalated', 'bg-amber-100 text-amber-800'] : a.status === 'accepted' ? ['Accepted', 'bg-brand-100 text-brand'] : ['New', 'bg-red-600 text-white'];
  return (
    <Card className={cls('p-0', open && 'ring-2 ring-brand/50')}>
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 p-3.5 text-left">
        <span className={cls('grid h-10 w-10 shrink-0 place-items-center rounded-xl', P.tile)}><Icon name={T.icon} className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">{T.label}{a.ai && <span className="rounded bg-brand px-1 font-mono text-[9px] font-bold text-ink">AI</span>}{a.student && <span className={cls('rounded-full px-1.5 text-[10px] font-semibold', GENDER[a.student.gender] ? GENDER[a.student.gender].chip : '')}>{a.student.name}</span>}</span>
          <span className="block text-xs text-slate-500">{a.id} · {CP[a.cp].name} · {ago(a.time, now)}{g ? ` · ${g.name}` : ''}</span>
        </span>
        <Badge className={status[1]}>{status[0]}</Badge>
      </button>
      {open && (
        <div className="space-y-3 border-t border-slate-100 p-3.5">
          <p className="text-sm text-slate-700">{a.detail}</p>
          {a.ai && <AiExplain a={a} />}
          {(a.snap || (a.photo && (a.photo.snap || a.photo.cam))) && (
            <div className="grid grid-cols-2 gap-2">
              {a.snap && <img src={a.snap} alt="Alert frame" className="w-full rounded-xl ring-1 ring-line" />}
              {a.photo && <CheckpointPhoto snap={a.photo.snap} cam={a.photo.cam} time={a.photo.time} />}
            </div>
          )}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
            <span>Raised {fmtTime(a.time)}</span>
            {a.acceptedAt && <span>Accepted {fmtTime(a.acceptedAt)}{a.dist ? ` · ${a.dist} m away` : ''}</span>}
            {a.escalatedAt && <span>Escalated {fmtTime(a.escalatedAt)}</span>}
            {a.resolvedAt && <span>Closed {fmtTime(a.resolvedAt)} by {a.resolvedName || a.resolvedBy}</span>}
          </div>
          {a.note && <p className="rounded-xl bg-slate-50 p-2.5 text-xs text-slate-600">{a.note}</p>}
          {a.cam && <Btn size="sm" v="outline" icon="video" onClick={() => openCam(a.cam)}>Open {a.cam}</Btn>}
        </div>
      )}
    </Card>
  );
}

// ---------------- Setup ----------------
function SetupPage() {
  const { s, setup, loadSetup, mode, go } = useApp();
  useVision();
  const [url, setUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { const id = setInterval(loadSetup, 15000); return () => clearInterval(id); }, [loadSetup]);
  const devices = ((s.net && s.net.devices) || []).filter((d) => d.kind !== 'laptop');
  if (mode !== 'hub' || !setup) {
    return (
      <div className="p-6"><Narrow><LocalBanner /></Narrow></div>
    );
  }
  const urls = setup.urls || [];
  const base = url || (urls[0] && urls[0].url) || null;
  const link = base ? `${base}/?pair=${setup.code}` : null;
  const camsHere = liveCount();
  const steps = [
    { done: true, t: 'Hub running on this laptop', d: `${setup.name} · Node ${setup.node}` },
    { done: camsHere > 0, t: 'Cameras connected', d: camsHere ? `${camsHere} webcam${camsHere === 1 ? '' : 's'} on this laptop` : 'Optional. Plug in webcams on the Cameras page' },
    { done: devices.length > 0, t: 'Phones paired', d: devices.length ? `${devices.length} paired, ${devices.filter((x) => x.online).length} online` : 'Scan the QR below from each phone' },
  ];
  const doneAll = async () => { setBusy(true); try { await hubAdmin.finish(true); await loadSetup(); go('overview'); } finally { setBusy(false); } };
  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 p-6">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-display text-lg font-bold text-slate-900">Set up Kavach on campus</div>
            <p className="text-sm text-slate-500">This laptop is the hub: it keeps the campus data and links the guard and student phones.</p>
          </div>
          {!setup.setupDone ? <Btn icon="check" disabled={busy} onClick={doneAll}>Finish setup</Btn> : <Badge className="bg-emerald-100 text-emerald-700"><Icon name="checkCircle" className="h-3.5 w-3.5" />Set up</Badge>}
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          {steps.map((x, i) => (
            <div key={x.t} className="flex items-start gap-3 rounded-2xl bg-raise p-3 ring-1 ring-line">
              <span className={cls('grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold', x.done ? 'bg-emerald-500 text-ink' : 'bg-slate-200 text-slate-600')}>{x.done ? <Icon name="check" className="h-4 w-4" /> : i + 1}</span>
              <span><span className="block text-sm font-semibold text-slate-900">{x.t}</span><span className="block text-xs text-slate-500">{x.d}</span></span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <div className="flex items-center gap-2"><Icon name="qr" className="h-5 w-5 text-brand" /><h3 className="font-bold text-slate-900">Pair a phone</h3></div>
          {urls.length === 0 ? (
            <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">This laptop has no Wi-Fi or network address. Connect it to the campus Wi-Fi (or turn on a hotspot), then this page shows the pairing QR.</p>
          ) : (
            <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <div className="rounded-2xl bg-white p-3"><QR text={link} size={196} /></div>
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pairing code</div>
                  <div className="font-mono text-3xl font-bold tracking-[.25em] text-brand">{setup.code}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Hub address</div>
                  {urls.length > 1 ? (
                    <select value={base} onChange={(e) => setUrl(e.target.value)} className="mt-1 w-full rounded-xl border-0 bg-slate-50 px-3 py-2 font-mono text-sm ring-1 ring-slate-200">
                      {urls.map((u) => <option key={u.url} value={u.url}>{u.url.replace('http://', '')} ({u.iface})</option>)}
                    </select>
                  ) : <div className="font-mono text-sm text-slate-900">{base.replace('http://', '')}</div>}
                </div>
                <Btn size="sm" v="outline" icon="refresh" onClick={async () => { await hubAdmin.newCode(); loadSetup(); }}>New code</Btn>
                <p className="text-[11px] text-slate-500">A new code only affects phones that pair from now on. Already paired phones stay paired.</p>
              </div>
            </div>
          )}
          <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-sm text-slate-600">
            <li>Connect the phone to the <b className="text-slate-800">same Wi-Fi</b> as this laptop.</li>
            <li>Open the <b className="text-slate-800">Kavach app</b> → <b className="text-slate-800">Connect to the campus hub</b> → <b className="text-slate-800">Scan pairing QR</b>.</li>
            <li>No app yet? Scan the QR with the phone's camera to open Kavach in the browser (cameras and face check need the app).</li>
          </ol>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Icon name="phone" className="h-5 w-5 text-brand" /><h3 className="font-bold text-slate-900">Paired phones</h3></div>
            <Badge className="bg-slate-100 text-slate-600">{devices.filter((x) => x.online).length} online</Badge>
          </div>
          <div className="mt-3 divide-y divide-slate-100">
            {devices.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No phones paired yet.</p>}
            {devices.map((x) => (
              <div key={x.id} className="flex items-center gap-3 py-2.5">
                <span className={cls('h-2.5 w-2.5 shrink-0 rounded-full', x.online ? 'bg-emerald-400' : 'bg-slate-400')} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900">{x.name}</span>
                  <span className="block text-xs text-slate-500">{x.online ? `Online${x.role ? ` · ${x.role === 'guard' ? 'Guard app' : 'Student app'}` : ''}` : x.seen ? `Last seen ${fmtTime(x.seen)}` : 'Not seen since pairing'}{x.live.length ? ` · cameras ${x.live.join(', ')}` : ''}</span>
                </span>
                <Btn size="sm" v="ghost" onClick={async () => { if (window.confirm(`Unpair ${x.name}? It will need the pairing code again.`)) { await hubAdmin.forget(x.id); loadSetup(); } }}>Unpair</Btn>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl bg-raise p-3 text-xs text-slate-500 ring-1 ring-line">
            <b className="text-slate-700">Phone can't connect?</b> Check both are on the same Wi-Fi (guest networks often block devices from seeing each other). On Windows, allow <b className="text-slate-700">Node.js</b> through the firewall on <b className="text-slate-700">private networks</b> when asked. On macOS, click <b className="text-slate-700">Allow</b> on the incoming connections prompt.
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <div className="flex items-center gap-2"><Icon name="video" className="h-5 w-5 text-brand" /><h3 className="font-bold text-slate-900">Cameras</h3></div>
          <p className="mt-1 text-sm text-slate-600">{camsHere ? `${camsHere} webcam${camsHere === 1 ? ' is' : 's are'} connected on this laptop.` : 'No webcams connected on this laptop yet.'} Guard phones can also lend their camera (Guard → Cameras).</p>
          <Btn size="sm" className="mt-3" icon="video" onClick={() => go('cams')}>Open Cameras</Btn>
        </Card>
        <Card>
          <div className="flex items-center gap-2"><Icon name="file" className="h-5 w-5 text-brand" /><h3 className="font-bold text-slate-900">Campus data</h3></div>
          <p className="mt-1 text-sm text-slate-600">Saved on this laptop in <span className="break-all font-mono text-xs text-slate-800">{setup.data}</span>. Phones keep only their own face template and a cached copy.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href="/api/export" className="inline-flex h-9 items-center gap-2 rounded-xl bg-card px-3 text-sm font-semibold text-slate-800 ring-1 ring-slate-200 hover:ring-brand"><Icon name="download" className="h-4 w-4" />Export (JSON)</a>
            <Btn size="sm" v="danger" icon="trash" onClick={async () => { if (window.confirm('Erase ALL campus data on the hub (alerts, scans, walks, visitors, lab records, audit log)? Paired phones stay paired.')) await hubAdmin.reset(); }}>Erase all campus data</Btn>
          </div>
        </Card>
      </div>
      <p className="text-center text-[11px] text-slate-500">Kavach hub {setup.version} · {setup.platform} · port {setup.port}</p>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
