// Admin pages for the laptop console (src/laptop.jsx): overview panels, visitor
// passes, lab inventory, alert heatmap, audit log. Phones never load these.
import { useRef, useState } from 'react';
import { ALERT_TYPES, CP, PRI, QR_PERIOD, VISITOR_PURPOSES, VISITOR_ZONES, campusStats, cls, fmtDay, fmtTime, heatFrom, pad, qrCode, studentById, transparency, ago } from './data.js';
import { useApp } from './ctx.js';
import { CAMERAS } from './campus.js';
import { CAM_STATUS, CameraFeed, camStatus } from './cctv.jsx';
import { LayerChips, Twin, twinData } from './twinview.jsx';
import { Badge, Btn, Card, DemoPanel, Icon, LiveDot, QR, Ring, SectionTitle, Sheet, useFastNow } from './ui.jsx';

export function Stat({ icon, label, value, tone = 'brand', sub, onClick }) {
  const tones = { brand: 'bg-brand-100 text-brand', red: 'bg-red-100 text-red-600', amber: 'bg-amber-100 text-amber-700', green: 'bg-emerald-100 text-emerald-700', violet: 'bg-violet-100 text-violet-700' };
  return (
    <button type="button" onClick={onClick} className="rounded-2xl bg-card p-3.5 text-left shadow-sm ring-1 ring-slate-200/70 transition hover:shadow-md">
      <span className={cls('grid h-9 w-9 place-items-center rounded-xl', tones[tone])}><Icon name={icon} className="h-5 w-5" /></span>
      <span className="mt-2 block text-2xl font-extrabold tabular-nums text-slate-900">{value}</span>
      <span className="block text-xs font-medium text-slate-500">{label}</span>
      {sub && <span className="mt-0.5 block text-[11px] text-slate-400">{sub}</span>}
    </button>
  );
}

export function GettingStarted({ go }) {
  const { s } = useApp();
  const online = CAMERAS.filter((c) => camStatus(s, c.id) === 'online').length;
  const phones = ((s.net && s.net.devices) || []).filter((d) => d.kind !== 'laptop').length;
  if (s.alerts.length || s.gate.log.length || s.visitors.length || (online && phones)) return null;
  const steps = [
    [online > 0, 'Connect cameras', 'Plug in USB webcams and assign each to a campus camera. AI runs on this laptop.', 'cams'],
    [phones > 0, 'Pair guard and student phones', 'Scan the pairing QR from the Kavach app on each phone.', 'setup'],
    [s.visitors.length > 0, 'Register expected visitors', 'Visitor passes with allowed zones and times.', 'visitors'],
  ];
  return (
    <Card className="ring-brand/30">
      <div className="flex items-center justify-between">
        <div className="font-display text-sm font-bold uppercase tracking-wider text-slate-900">Getting started</div>
        <span className="text-xs text-slate-500">Everything here is counted from real activity</span>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {steps.map(([done, t, d, page], i) => (
          <button key={t} type="button" onClick={() => go(page)} className="flex items-start gap-3 rounded-2xl bg-raise p-3 text-left ring-1 ring-line hover:ring-brand/50">
            <span className={cls('grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold', done ? 'bg-emerald-500 text-ink' : 'bg-brand text-ink')}>{done ? <Icon name="check" className="h-4 w-4" /> : i + 1}</span>
            <span><span className="block text-sm font-semibold text-slate-900">{t}</span><span className="block text-xs text-slate-500">{d}</span></span>
          </button>
        ))}
      </div>
    </Card>
  );
}

export function StatGrid({ go, className }) {
  const { s, now } = useApp();
  const st = campusStats(s, now);
  return (
    <div className={cls('grid grid-cols-2 gap-3', className)}>
      <Stat icon="users" label="Inside campus now" value={st.inside} sub={`${st.studentsIn} student${st.studentsIn === 1 ? '' : 's'}, ${st.visitorsIn} visitor${st.visitorsIn === 1 ? '' : 's'}`} />
      <Stat icon="login" label="Entries today" value={st.entriesToday} tone="green" sub="Gate scans and visitor check-ins" />
      <Stat icon="walk" label="Active Saathi Walks" value={st.walksActive} tone="amber" sub={`${s.walksCompleted} completed`} />
      <Stat icon="bell" label="Open alerts" value={st.openAlerts} tone={st.openAlerts ? 'red' : 'green'} sub={`${st.escalated} escalated`} onClick={() => go('alerts')} />
      <Stat icon="box" label="Lab items issued" value={st.labIssued} tone="violet" onClick={() => go('stock')} />
      <Stat icon="badge" label="Visitors on campus" value={st.visitors} onClick={() => go('visitors')} />
    </div>
  );
}

export function CctvHealth({ openCam, go }) {
  const { s } = useApp();
  const counts = { online: 0, none: 0, offline: 0, tampered: 0 };
  for (const c of CAMERAS) counts[camStatus(s, c.id)] += 1;
  const issues = CAMERAS.filter((c) => ['tampered', 'offline'].includes(camStatus(s, c.id)));
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Icon name="video" className="h-5 w-5 text-brand" /><h3 className="font-bold text-slate-900">CCTV health</h3></div>
        <Badge className={counts.online ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}>{counts.online > 0 && <LiveDot />}{counts.online}/{CAMERAS.length} connected</Badge>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
        {[[counts.none, 'Not connected', 'text-slate-600'], [counts.tampered + counts.offline, 'Faults', 'text-amber-600'], [s.ai.events, 'AI events', 'text-slate-900'], [s.darkSpots.length, 'Student reports', 'text-brand']].map(([v, k, c]) => (
          <div key={k} className="rounded-xl bg-raise px-1 py-2"><div className={cls('text-lg font-extrabold', c)}>{v}</div><div className="text-[10px] leading-tight text-slate-500">{k}</div></div>
        ))}
      </div>
      {issues.length > 0 && (
        <div className="mt-3 space-y-2">
          {issues.map((c) => (
            <button key={c.id} type="button" onClick={() => openCam(c.id)} className="flex w-full items-center gap-3 rounded-xl bg-amber-50 p-2 text-left ring-1 ring-amber-200">
              <div className="w-20 shrink-0"><CameraFeed camId={c.id} showMeta={false} className="rounded-lg" /></div>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-900">{c.id} · {c.name}</span><span className="block text-xs text-slate-500">{CAM_STATUS[camStatus(s, c.id)].label}{s.cams[c.id].since ? ` since ${fmtTime(s.cams[c.id].since)}` : ''}</span></span>
              <Icon name="chevR" className="h-4 w-4 text-slate-400" />
            </button>
          ))}
        </div>
      )}
      {s.darkSpots.length > 0 && <p className="mt-2 text-xs text-slate-500">Latest student report: dark spot near {CP[s.darkSpots[0].cp].name}, {fmtTime(s.darkSpots[0].time)}.</p>}
      {counts.online === 0 && <p className="mt-2 text-xs text-slate-500">No cameras connected yet. <button type="button" className="font-semibold text-brand underline" onClick={() => go('cams')}>Connect webcams</button> on this laptop, or a phone camera in Guard → Cameras.</p>}
      <p className="mt-2 text-[11px] text-slate-400">Faces pixelated on device, no face search. Every view is in the audit log.</p>
    </Card>
  );
}

export function LiveAlerts({ go, limit = 6 }) {
  const { s, now } = useApp();
  const open = s.alerts.filter((a) => a.status !== 'resolved');
  return (
    <div>
      <SectionTitle right={<button type="button" onClick={() => go('alerts')} className="text-xs font-semibold text-brand">All alerts</button>}>Live alerts</SectionTitle>
      <Card className="divide-y divide-slate-100 p-0">
        {open.length === 0 && <div className="p-4 text-center text-sm text-slate-500">No open alerts.</div>}
        {open.slice(0, limit).map((a) => (
          <div key={a.id} className="flex items-center gap-3 px-4 py-3">
            <span className={cls('grid h-9 w-9 place-items-center rounded-xl', PRI[ALERT_TYPES[a.type].pri].tile)}><Icon name={ALERT_TYPES[a.type].icon} className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-slate-900">{ALERT_TYPES[a.type].label}</div>
              <div className="text-xs text-slate-500">{CP[a.cp].name} · {ago(a.time, now)}</div>
            </div>
            {a.escalated ? <Badge className="bg-amber-100 text-amber-800">Escalated</Badge> : a.status === 'accepted' ? <Badge className="bg-brand-100 text-brand">Accepted</Badge> : <Badge className="bg-red-600 text-white">New</Badge>}
          </div>
        ))}
      </Card>
    </div>
  );
}

export function CrossModule() {
  const { s, act } = useApp();
  const osc = s.inventory.find((i) => i.id === 'osc4');
  return (
    <Card>
      <div className="flex items-center gap-2"><Icon name="cpu" className="h-5 w-5 text-violet-600" /><h3 className="font-bold text-slate-900">Cross-module rule</h3></div>
      <p className="mt-1 text-sm text-slate-600">If an RFID instrument leaves the lab without being issued, alert <b>both</b> the lab door and the Main Gate.</p>
      <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
        {['Lab door RFID', 'Issue ledger', 'Lab + Gate alert'].map((t, i) => (
          <span key={t} className="flex items-center gap-1.5">
            <span className="rounded-lg bg-slate-100 px-2 py-1">{t}</span>{i < 2 && <Icon name="chevR" className="h-3 w-3 text-slate-400" />}
          </span>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 p-2.5 text-sm">
        <span>Oscilloscope #4</span>
        {osc.holder ? <Badge className="bg-emerald-100 text-emerald-700">Issued to {(studentById(s, osc.holder) || {}).name || osc.holder}</Badge> : <Badge className="bg-slate-200 text-slate-700">In lab · not issued</Badge>}
      </div>
      <Btn v="outline" size="sm" className="mt-3 w-full" icon="zap" onClick={() => act('equipmentLeaving', 'osc4')}>Simulate: Oscilloscope #4 passes lab door</Btn>
    </Card>
  );
}

// ---------------- Visitors ----------------
export function Visitors() {
  const { s, act, now } = useApp();
  const t = new Date(now);
  const hhmm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const blank = { name: '', phone: '', purpose: 'Meeting', dest: 'Main Building', from: hhmm(t), to: hhmm(new Date(now + 2 * 3600 * 1000)) };
  const [f, setF] = useState(blank);
  const [show, setShow] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const valid = f.name.trim().length > 1 && f.phone.replace(/\D/g, '').length >= 10 && f.from < f.to;
  const create = () => {
    const id = act('createVisitor', f);
    setShow(id);
    setF(blank);
  };
  const input = 'mt-1 w-full rounded-xl border-0 bg-slate-50 px-3 py-2.5 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-brand';
  const visitor = show && s.visitors.find((v) => v.id === show);
  const active = s.visitors.filter((v) => v.status !== 'left');
  return (
    <div className="space-y-4 p-4 pb-8">
      <Card>
        <h3 className="font-bold text-slate-900">New visitor pass</h3>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="col-span-2 text-xs font-semibold text-slate-600">Name<input className={input} value={f.name} onChange={set('name')} placeholder="Full name" /></label>
          <label className="col-span-2 text-xs font-semibold text-slate-600">Phone<input className={input} value={f.phone} onChange={set('phone')} placeholder="10-digit mobile" inputMode="tel" /></label>
          <label className="text-xs font-semibold text-slate-600">Purpose
            <select className={input} value={f.purpose} onChange={set('purpose')}>{VISITOR_PURPOSES.map((p) => <option key={p}>{p}</option>)}</select>
          </label>
          <label className="text-xs font-semibold text-slate-600">Destination
            <select className={input} value={f.dest} onChange={set('dest')}>{VISITOR_ZONES.map((p) => <option key={p}>{p}</option>)}</select>
          </label>
          <label className="text-xs font-semibold text-slate-600">From<input type="time" className={input} value={f.from} onChange={set('from')} /></label>
          <label className="text-xs font-semibold text-slate-600">Until<input type="time" className={input} value={f.to} onChange={set('to')} /></label>
        </div>
        <Btn className="mt-4 w-full" icon="qr" disabled={!valid} onClick={create}>Create pass</Btn>
        {!valid && (f.name || f.phone) && <p className="mt-2 text-center text-xs text-slate-500">Add a name and a 10-digit phone number.</p>}
      </Card>

      <DemoPanel title="Demo">
        <Btn v="outline" className="w-full" icon="badge" onClick={() => act('visitorWrongZone')}>Visitor seen near Hostel D</Btn>
      </DemoPanel>

      <div>
        <SectionTitle>Active visitors ({active.length})</SectionTitle>
        {active.length === 0 && <Card className="text-center text-sm text-slate-500">No visitors registered. Create a pass above when someone is expected.</Card>}
        <div className="space-y-2">
          {active.map((v) => (
            <Card key={v.id} className="fade-up p-3">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-100 font-bold text-brand">{v.name[0]}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-900">{v.name} <span className="font-normal text-slate-400">· {v.id}</span></div>
                  <div className="text-xs text-slate-500">{v.purpose} · {v.dest} · {v.from}–{v.to}</div>
                </div>
                <Badge className={v.status === 'inside' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>{v.status === 'inside' ? 'Inside' : 'Expected'}</Badge>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Btn size="sm" v="soft" icon="qr" onClick={() => setShow(v.id)}>Show pass</Btn>
                {v.status === 'expected'
                  ? <Btn size="sm" v="outline" icon="login" onClick={() => act('visitorIn', v.id)}>Check in</Btn>
                  : <Btn size="sm" v="outline" icon="logout" onClick={() => act('visitorOut', v.id)}>Check out</Btn>}
              </div>
            </Card>
          ))}
        </div>
      </div>
      {visitor && <VisitorPass v={visitor} onClose={() => setShow(null)} />}
    </div>
  );
}

function VisitorPass({ v, onClose }) {
  const fast = useFastNow(250);
  const slot = Math.floor(fast / (QR_PERIOD * 1000));
  const left = QR_PERIOD - ((fast / 1000) % QR_PERIOD);
  return (
    <Sheet title="Visitor pass" onClose={onClose}>
      <div className="flex flex-col items-center">
        <div className="w-full rounded-2xl bg-gradient-to-r from-brand/15 to-[#060c11] p-4 text-white ring-1 ring-brand/25">
          <div className="text-xs text-white/65">Temporary pass · {v.id}</div>
          <div className="text-lg font-bold">{v.name}</div>
          <div className="text-sm text-white/80">{v.purpose} · {v.dest}</div>
          <div className="mt-1 text-xs text-white/65">Valid today {v.from} to {v.to} · Allowed zone: {v.dest}</div>
        </div>
        <div className="mt-4 rounded-2xl p-2 ring-1 ring-slate-200"><QR key={slot} text={qrCode(v.id, slot)} size={180} fade /></div>
        <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
          <Ring value={left} max={QR_PERIOD} size={32} stroke={3}><span className="text-[10px] font-bold">{Math.ceil(left)}</span></Ring>
          Rotates every {QR_PERIOD} s · sent by SMS to {v.phone}
        </div>
        <Btn className="mt-4 w-full" onClick={onClose}>Done</Btn>
      </div>
    </Sheet>
  );
}

// ---------------- Inventory ----------------
export function Inventory() {
  const { s, act } = useApp();
  const [report, setReport] = useState(false);
  const low = s.inventory.filter((i) => i.kind === 'consumable' && i.stock < i.min);
  return (
    <div className="space-y-4 p-4 pb-8">
      {low.length > 0 && (
        <Card className="flex items-start gap-3 bg-amber-50 ring-amber-200">
          <Icon name="alert" className="mt-0.5 h-5 w-5 text-amber-600" />
          <div className="text-sm text-amber-900"><b>Low stock:</b> {low.map((i) => `${i.name} (${i.stock}, reorder at ${i.min})`).join(', ')}</div>
        </Card>
      )}
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between px-4 pt-4">
          <h3 className="font-bold text-slate-900">Electronics Lab stock</h3>
          <Badge className="bg-emerald-100 text-emerald-700"><LiveDot />Live</Badge>
        </div>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-y border-slate-100 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2 font-semibold">Item</th><th className="px-2 py-2 text-right font-semibold">Stock</th><th className="px-4 py-2 text-right font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {s.inventory.map((i) => {
              const isLow = i.kind === 'consumable' && i.stock < i.min;
              return (
                <tr key={i.id} className={cls('transition-colors', isLow && 'bg-amber-50/70')}>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{i.name}</div>
                    <div className="text-[11px] text-slate-500">{i.rfid ? `RFID ${i.rfid} · ${i.bench}` : `Shelf ${i.shelf} · reorder at ${i.min}`}</div>
                  </td>
                  <td className="px-2 py-3 text-right font-bold tabular-nums text-slate-900">{i.rfid ? (i.holder ? 0 : 1) : i.stock}</td>
                  <td className="px-4 py-3 text-right">
                    {i.rfid ? (i.holder ? <Badge className="bg-brand-100 text-brand">Issued · {i.holder}</Badge> : <Badge className="bg-emerald-100 text-emerald-700">In lab</Badge>)
                      : isLow ? <Badge className="bg-amber-200 text-amber-900">Low</Badge> : <Badge className="bg-emerald-100 text-emerald-700">OK</Badge>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <Btn className="w-full" icon="file" onClick={() => { setReport(true); act('stockReport'); }}>Generate yearly stock verification report</Btn>
      {report && <StockReport onClose={() => setReport(false)} />}
    </div>
  );
}

function StockReport({ onClose }) {
  const { s, now } = useApp();
  const short = s.issued.filter((i) => i.status === 'short');
  const out = s.issued.filter((i) => i.status === 'issued');
  const yr = new Date(now).getFullYear();
  const ay = new Date(now).getMonth() >= 6 ? `${yr}–${String(yr + 1).slice(2)}` : `${yr - 1}–${String(yr).slice(2)}`;
  // Opening = the lab's stock register when Kavach started; issued/returned are counted from LabLedger.
  const qty = (id, f) => s.issued.filter((x) => x.itemId === id && f(x)).reduce((a, b) => a + b.qty - (f === back ? b.missing || 0 : 0), 0);
  const back = (x) => x.status !== 'issued';
  const rows = s.inventory.map((i) => {
    if (i.rfid) return { name: i.name, open: 1, issued: s.issued.filter((x) => x.itemId === i.id).length, now: i.holder ? 0 : 1, status: i.holder ? `With ${i.holder}` : 'In lab ✓' };
    return { name: i.name, open: i.open ?? i.stock, issued: qty(i.id, () => true), now: i.stock, status: i.stock < i.min ? 'Reorder' : 'OK' };
  });
  const issuesN = s.issued.length;
  const returnsN = s.issued.filter(back).length;
  return (
    <Sheet title="Stock verification report" onClose={onClose} tall>
      <div className="print-area">
        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <div className="flex items-center gap-2"><Icon name="file" className="h-5 w-5 text-brand" /><span className="font-bold text-slate-900">LabLedger · Yearly stock verification</span></div>
          <div className="mt-1 text-xs text-slate-500">Electronics Lab · {COLLEGE} · AY {ay}</div>
          <div className="text-xs text-slate-500">Generated {fmtDay(now, now)} {new Date(now).toLocaleDateString('en-IN')}, {fmtTime(now)} by Kavach</div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[[s.inventory.length, 'Items in register'], [issuesN, 'Issues logged'], [short.length, 'Short returns']].map(([v, k]) => (
              <div key={k} className="rounded-xl bg-card p-2 ring-1 ring-slate-200"><div className="text-lg font-extrabold text-slate-900">{v}</div><div className="text-[10px] text-slate-500">{k}</div></div>
            ))}
          </div>
          <table className="mt-3 w-full text-xs">
            <thead><tr className="text-left text-slate-500"><th className="py-1 font-semibold">Item</th><th className="py-1 text-right font-semibold">Opening</th><th className="py-1 text-right font-semibold">Issued</th><th className="py-1 text-right font-semibold">Now</th><th className="py-1 text-right font-semibold">Status</th></tr></thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((r) => (
                <tr key={r.name}><td className="py-1.5 pr-1 font-medium text-slate-800">{r.name}</td><td className="py-1.5 text-right tabular-nums">{r.open}</td><td className="py-1.5 text-right tabular-nums">{r.issued}</td><td className="py-1.5 text-right font-bold tabular-nums">{r.now}</td><td className={cls('py-1.5 text-right font-semibold', r.status === 'Reorder' ? 'text-amber-700' : 'text-emerald-700')}>{r.status}</td></tr>
              ))}
            </tbody>
          </table>
          <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-slate-600">
            <li>{issuesN} issue{issuesN === 1 ? '' : 's'} and {returnsN} return{returnsN === 1 ? '' : 's'} recorded in LabLedger.</li>
            <li>{out.length} item record{out.length === 1 ? '' : 's'} currently with students.</li>
            <li>{short.length ? `${short.length} short return(s) declared by students: ${short.map((x) => `${x.missing} × ${x.name}`).join(', ')}.` : 'No short returns recorded.'}</li>
          </ul>
          <div className="mt-4 grid grid-cols-2 gap-4 text-[11px] text-slate-500">
            <div className="border-t border-slate-300 pt-1">Lab In-charge</div>
            <div className="border-t border-slate-300 pt-1">Head of Department</div>
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Btn v="outline" icon="printer" onClick={() => window.print()}>Print</Btn>
        <Btn onClick={onClose}>Done</Btn>
      </div>
    </Sheet>
  );
}

// ---------------- Digital twin + heatmap ----------------
// The 3D twin with layer chips, as a panel on the console.
export function TwinPanel({ openCam, openCc, className = 'h-[460px]' }) {
  const { s } = useApp();
  const [layers, setLayers] = useState({ cams: true, alerts: true, heat: true, guards: true, walk: true, labels: false });
  const [sel, setSel] = useState(null);
  const api = useRef(null);
  const selCam = sel && sel.startsWith('cam:') ? sel.slice(4) : null;
  const onPick = (id) => {
    setSel(id);
    if (id && api.current) api.current.flyTo(id.startsWith('alert:') ? 'cp:' + (s.alerts.find((a) => 'alert:' + a.id === id) || {}).cp : id);
  };
  return (
    <Card className="overflow-hidden p-0">
      <div className={cls('relative', className)}>
        <Twin data={twinData(s, layers, sel)} onPick={onPick} apiRef={api} className="absolute inset-0" />
        <div className="absolute left-2 right-2 top-2"><LayerChips layers={layers} setLayers={setLayers} dark /></div>
        <div className="absolute bottom-2 right-2 flex gap-1.5">
          {[['overview', 'Reset'], ['top', 'Top'], ['walk', 'Route']].map(([k, l]) => (
            <button key={k} type="button" onClick={() => api.current && api.current.view(k)} className="rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/15 hover:bg-black/75">{l}</button>
          ))}
          <button type="button" onClick={openCc} className="flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-bold text-ink"><Icon name="columns" className="h-3.5 w-3.5" />Command centre</button>
        </div>
      </div>
      {selCam ? (
        <div className="flex items-center gap-3 p-3">
          <div className="w-28 shrink-0"><CameraFeed camId={selCam} showMeta={false} /></div>
          <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-slate-900">{selCam}</div><div className="text-xs text-slate-500">{CAM_STATUS[camStatus(s, selCam)].label}</div></div>
          <Btn size="sm" icon="video" onClick={() => openCam(selCam)}>Open</Btn>
        </div>
      ) : (
        <div className="px-3 py-2.5 text-xs text-slate-500">Drag to rotate, scroll to zoom, right-drag to tilt. Click a camera to see its feed. Buildings and boundary from OpenStreetMap.</div>
      )}
    </Card>
  );
}

export function Heatmap() {
  const { s } = useApp();
  const heat = heatFrom(s);
  const ranked = Object.entries(heat).sort((a, b) => b[1] - a[1]);
  const max = ranked.length ? ranked[0][1] : 1;
  // most common alert type per zone, from the recorded alerts
  const top = {};
  for (const [cp] of ranked) {
    const c = {};
    for (const a of s.alerts) if (a.cp === cp) c[a.type] = (c[a.type] || 0) + 1;
    top[cp] = ALERT_TYPES[Object.entries(c).sort((x, y) => y[1] - x[1])[0][0]].label;
  }
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return (
    <div>
      <SectionTitle>Alert heatmap by zone</SectionTitle>
      <Card className="space-y-3">
        {ranked.length === 0 && <p className="py-4 text-center text-sm text-slate-500">No alerts recorded yet. Zones fill in as alerts come in.</p>}
        {ranked.map(([id, n]) => (
          <div key={id}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-slate-900">{CP[id].name}</span>
              <span className="tabular-nums text-slate-600"><b className="text-slate-900">{n}</b>{(() => { const t = s.alerts.filter((a) => a.cp === id && a.time >= today.getTime()).length; return t ? <span className="ml-1 text-xs font-semibold text-red-600">{t} today</span> : null; })()}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"><div className="grow h-full rounded-full bg-gradient-to-r from-accent to-coral" style={{ width: `${(n / max) * 100}%` }} /></div>
            <div className="mt-0.5 text-[11px] text-slate-500">Mostly: {top[id]}</div>
          </div>
        ))}
        {ranked.length > 0 && (
          <div className="flex items-start gap-3 rounded-xl bg-brand-50 p-3 ring-1 ring-brand-100">
            <Icon name="bulb" className="mt-0.5 h-5 w-5 text-brand" />
            <p className="text-sm text-slate-700"><b>Busiest zone:</b> {CP[ranked[0][0]].name} with {ranked[0][1]} alert{ranked[0][1] === 1 ? '' : 's'}, mostly {top[ranked[0][0]].toLowerCase()}. Consider a guard post or another camera there.</p>
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------------- Audit ----------------
export function Audit() {
  const { s, now } = useApp();
  const [cat, setCat] = useState('all');
  const list = s.audit.filter((a) => cat === 'all' || a.cat === cat);
  const m = transparency(s);
  return (
    <div className="space-y-4 p-4 pb-8">
      <div className="rounded-3xl bg-gradient-to-br from-brand/15 to-[#060c11] ring-1 ring-brand/25 p-5 text-white shadow-md">
        <div className="text-xs font-bold uppercase tracking-wider text-accent">Transparency report</div>
        <p className="mt-2 text-lg font-bold leading-snug">{m.walks} walk{m.walks === 1 ? '' : 's'}, {m.followers} follower alert{m.followers === 1 ? '' : 's'}, {m.faceSearches} face searches, {m.unblurs} unblur request{m.unblurs === 1 ? '' : 's'} sent to the student committee.</p>
        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          {[[m.walks, 'Walks'], [m.followers, 'Follower alerts'], [m.faceSearches, 'Face searches'], [m.unblurs, 'Unblurs']].map(([v, k]) => (
            <div key={k} className="rounded-xl bg-white/10 px-1 py-2"><div className="text-xl font-extrabold">{v}</div><div className="text-[10px] leading-tight text-white/80">{k}</div></div>
          ))}
        </div>
        <p className="mt-3 text-xs text-white/65">Counted from activity recorded in Kavach. {m.views} footage view{m.views === 1 ? '' : 's'} logged. Face search does not exist in Kavach.</p>
      </div>
      <div>
        <SectionTitle>Audit log</SectionTitle>
        <div className="mb-2 flex gap-2 overflow-x-auto no-scrollbar">
          {[['all', 'All'], ['footage', 'Footage'], ['lookup', 'Lookups'], ['system', 'System']].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setCat(k)} className={cls('shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold', cat === k ? 'bg-brand text-ink' : 'bg-card text-slate-600 ring-1 ring-slate-200')}>{l}</button>
          ))}
        </div>
        <Card className="divide-y divide-slate-100 p-0">
          {list.length === 0 && <p className="p-4 text-center text-sm text-slate-500">Nothing logged yet. Every camera view, snapshot, unblur request and lookup appears here.</p>}
          {list.map((a) => (
            <div key={a.id} className="fade-up flex gap-3 px-4 py-3">
              <span className={cls('mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg', a.cat === 'footage' ? 'bg-red-50 text-red-600' : a.cat === 'system' ? 'bg-slate-100 text-slate-600' : 'bg-brand-50 text-brand')}>
                <Icon name={a.cat === 'footage' ? 'video' : a.cat === 'system' ? 'settings' : 'eye'} className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1 text-sm">
                <div className="font-semibold text-slate-900">{a.action}</div>
                <div className="text-xs text-slate-500"><b className="font-medium text-slate-700">{a.who}</b> · {fmtDay(a.time, now)}, {fmtTime(a.time)}</div>
                <div className="mt-0.5 text-xs italic text-slate-500">Reason: {a.reason}</div>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
