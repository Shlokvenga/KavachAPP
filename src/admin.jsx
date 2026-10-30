// Admin dashboard: overview, visitor passes, lab inventory, alert heatmap, audit log.
import { useState } from 'react';
import { ALERT_TYPES, COLLEGE, CP, PRI, QR_PERIOD, VISITOR_PURPOSES, VISITOR_ZONES, cls, fmtDay, fmtTime, pad, qrCode, ago } from './data.js';
import { audit, equipmentLeaving, toast, useApp, visitorWrongZone } from './store.js';
import CampusMap from './map.jsx';
import { Badge, BottomNav, Btn, Card, DemoPanel, Icon, LiveDot, QR, Ring, SectionTitle, Sheet, useFastNow } from './ui.jsx';

export default function AdminApp() {
  const { s } = useApp();
  const [tab, setTab] = useState('overview');
  const open = s.alerts.filter((a) => a.status !== 'resolved').length;
  const low = s.inventory.filter((i) => i.kind === 'consumable' && i.stock < i.min).length;
  return (
    <>
      <div className="shrink-0 bg-navy px-4 pb-3 pt-3 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-blue-200">{COLLEGE}</div>
            <div className="text-lg font-bold">Admin dashboard</div>
          </div>
          <Badge className="bg-white/10 text-white"><LiveDot />Live</Badge>
        </div>
      </div>
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto" key={tab}>
        {tab === 'overview' && <Overview go={setTab} />}
        {tab === 'visitors' && <Visitors />}
        {tab === 'stock' && <Inventory />}
        {tab === 'heat' && <Heatmap />}
        {tab === 'audit' && <Audit />}
      </div>
      <BottomNav value={tab} onChange={setTab} items={[
        { id: 'overview', label: 'Overview', icon: 'chart', badge: open },
        { id: 'visitors', label: 'Visitors', icon: 'badge' },
        { id: 'stock', label: 'Lab stock', icon: 'box', badge: low },
        { id: 'heat', label: 'Heatmap', icon: 'flame' },
        { id: 'audit', label: 'Audit', icon: 'eye' },
      ]} />
    </>
  );
}

function Stat({ icon, label, value, tone = 'navy', sub, onClick }) {
  const tones = { navy: 'bg-blue-100 text-navy', red: 'bg-red-100 text-red-600', amber: 'bg-amber-100 text-amber-700', green: 'bg-emerald-100 text-emerald-700', violet: 'bg-violet-100 text-violet-700' };
  return (
    <button type="button" onClick={onClick} className="rounded-2xl bg-white p-3.5 text-left shadow-sm ring-1 ring-slate-200/70 transition hover:shadow-md">
      <span className={cls('grid h-9 w-9 place-items-center rounded-xl', tones[tone])}><Icon name={icon} className="h-5 w-5" /></span>
      <span className="mt-2 block text-2xl font-extrabold tabular-nums text-slate-900">{value}</span>
      <span className="block text-xs font-medium text-slate-500">{label}</span>
      {sub && <span className="mt-0.5 block text-[11px] text-slate-400">{sub}</span>}
    </button>
  );
}

function Overview({ go }) {
  const { s, mutate, now } = useApp();
  const open = s.alerts.filter((a) => a.status !== 'resolved');
  const walks = s.otherWalks.length + (s.walk && s.walk.phase === 'active' ? 1 : 0);
  const issued = 37 + s.issued.filter((i) => i.status === 'issued').reduce((a, b) => a + b.qty, 0);
  const visitors = s.visitors.filter((v) => v.status !== 'left').length;
  const osc = s.inventory.find((i) => i.id === 'osc4');
  return (
    <div className="space-y-4 p-4 pb-8">
      <div className="grid grid-cols-2 gap-3">
        <Stat icon="users" label="Inside campus now" value={s.inside.toLocaleString('en-IN')} sub="From gate scans" />
        <Stat icon="login" label="Entries today" value={s.entriesToday.toLocaleString('en-IN')} tone="green" />
        <Stat icon="walk" label="Active Saathi Walks" value={walks} tone="amber" sub={`${s.walksCompleted} finished today here`} />
        <Stat icon="bell" label="Open alerts" value={open.length} tone={open.length ? 'red' : 'green'} sub={`${open.filter((a) => a.escalated).length} escalated`} />
        <Stat icon="box" label="Lab items issued" value={issued} tone="violet" onClick={() => go('stock')} />
        <Stat icon="badge" label="Visitors on campus" value={visitors} onClick={() => go('visitors')} />
      </div>

      <div>
        <SectionTitle right={<span className="text-xs text-slate-400">auto-updating</span>}>Live alerts</SectionTitle>
        <Card className="divide-y divide-slate-100 p-0">
          {open.length === 0 && <div className="p-4 text-center text-sm text-slate-500">No open alerts.</div>}
          {open.slice(0, 5).map((a) => (
            <div key={a.id} className="flex items-center gap-3 px-4 py-3">
              <span className={cls('grid h-9 w-9 place-items-center rounded-xl', PRI[ALERT_TYPES[a.type].pri].tile)}><Icon name={ALERT_TYPES[a.type].icon} className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-slate-900">{ALERT_TYPES[a.type].label}</div>
                <div className="text-xs text-slate-500">{CP[a.cp].name} · {ago(a.time, now)}</div>
              </div>
              {a.escalated ? <Badge className="bg-amber-100 text-amber-800">Escalated</Badge> : a.status === 'accepted' ? <Badge className="bg-blue-100 text-navy">Accepted</Badge> : <Badge className="bg-red-600 text-white">New</Badge>}
            </div>
          ))}
        </Card>
      </div>

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
          {osc.holder ? <Badge className="bg-emerald-100 text-emerald-700">Issued to {osc.holder}</Badge> : <Badge className="bg-slate-200 text-slate-700">In lab · not issued</Badge>}
        </div>
        <Btn v="outline" size="sm" className="mt-3 w-full" icon="zap" onClick={() => mutate((d) => equipmentLeaving(d, 'osc4'))}>Simulate: Oscilloscope #4 passes lab door</Btn>
      </Card>
    </div>
  );
}

// ---------------- Visitors ----------------
function Visitors() {
  const { s, mutate, now } = useApp();
  const t = new Date(now);
  const hhmm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const blank = { name: '', phone: '', purpose: 'Meeting', dest: 'Admin Block', from: hhmm(t), to: hhmm(new Date(now + 2 * 3600 * 1000)) };
  const [f, setF] = useState(blank);
  const [show, setShow] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const valid = f.name.trim().length > 1 && f.phone.replace(/\D/g, '').length >= 10 && f.from < f.to;
  const create = () => {
    const id = `V-${201 + s.visitors.length}`;
    mutate((d) => {
      d.visitors.unshift({ id, ...f, name: f.name.trim(), status: 'expected', created: Date.now() });
      audit(d, 'Admin (Ms. Kulkarni)', `Created visitor pass ${id} · ${f.name.trim()}`, `${f.purpose} at ${f.dest}`, 'lookup');
      toast(d, 'admin', `Pass ${id} created. QR sent by SMS`, 'success');
      toast(d, 'guard', `Visitor expected: ${f.name.trim()} → ${f.dest}`, 'info');
    });
    setShow(id);
    setF(blank);
  };
  const input = 'mt-1 w-full rounded-xl border-0 bg-slate-50 px-3 py-2.5 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-navy';
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
        <Btn v="outline" className="w-full" icon="badge" onClick={() => mutate(visitorWrongZone)}>Visitor seen near Hostel D</Btn>
      </DemoPanel>

      <div>
        <SectionTitle>Active visitors ({active.length})</SectionTitle>
        <div className="space-y-2">
          {active.map((v) => (
            <Card key={v.id} className="fade-up p-3">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-blue-100 font-bold text-navy">{v.name[0]}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-900">{v.name} <span className="font-normal text-slate-400">· {v.id}</span></div>
                  <div className="text-xs text-slate-500">{v.purpose} · {v.dest} · {v.from}–{v.to}</div>
                </div>
                <Badge className={v.status === 'inside' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>{v.status === 'inside' ? 'Inside' : 'Expected'}</Badge>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Btn size="sm" v="soft" icon="qr" onClick={() => setShow(v.id)}>Show pass</Btn>
                {v.status === 'expected'
                  ? <Btn size="sm" v="outline" icon="login" onClick={() => mutate((d) => { d.visitors.find((x) => x.id === v.id).status = 'inside'; toast(d, 'admin', `${v.name} checked in at Main Gate`, 'success'); })}>Check in</Btn>
                  : <Btn size="sm" v="outline" icon="logout" onClick={() => mutate((d) => { d.visitors.find((x) => x.id === v.id).status = 'left'; toast(d, 'admin', `${v.name} checked out. Pass closed`, 'info'); })}>Check out</Btn>}
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
        <div className="w-full rounded-2xl bg-gradient-to-r from-navy to-navy-light p-4 text-white">
          <div className="text-xs text-blue-200">Temporary pass · {v.id}</div>
          <div className="text-lg font-bold">{v.name}</div>
          <div className="text-sm text-blue-100">{v.purpose} · {v.dest}</div>
          <div className="mt-1 text-xs text-blue-200">Valid today {v.from} to {v.to} · Allowed zone: {v.dest}</div>
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
function Inventory() {
  const { s, mutate } = useApp();
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
                    {i.rfid ? (i.holder ? <Badge className="bg-blue-100 text-navy">Issued · {i.holder}</Badge> : <Badge className="bg-emerald-100 text-emerald-700">In lab</Badge>)
                      : isLow ? <Badge className="bg-amber-200 text-amber-900">Low</Badge> : <Badge className="bg-emerald-100 text-emerald-700">OK</Badge>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <Btn className="w-full" icon="file" onClick={() => { setReport(true); mutate((d) => audit(d, 'Admin (Ms. Kulkarni)', 'Generated yearly stock verification report', 'Annual audit, Electronics Lab', 'lookup')); }}>Generate yearly stock verification report</Btn>
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
  const rows = s.inventory.map((i) => {
    if (i.rfid) return { name: i.name, open: 1, issued: '-', now: i.holder ? 0 : 1, status: i.holder ? `With ${i.holder}` : 'Located ✓' };
    const [opening, issuedYr] = s.yearly[i.id];
    return { name: i.name, open: opening, issued: issuedYr, now: i.stock, status: i.stock < i.min ? 'Reorder' : 'OK' };
  });
  return (
    <Sheet title="Stock verification report" onClose={onClose} tall>
      <div className="print-area">
        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <div className="flex items-center gap-2"><Icon name="file" className="h-5 w-5 text-navy" /><span className="font-bold text-slate-900">LabLedger · Yearly stock verification</span></div>
          <div className="mt-1 text-xs text-slate-500">Electronics Lab · {COLLEGE} · AY {ay}</div>
          <div className="text-xs text-slate-500">Generated {fmtDay(now, now)} {new Date(now).toLocaleDateString('en-IN')}, {fmtTime(now)} by Kavach</div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[[s.inventory.length, 'Items verified'], [2, 'RFID located'], [short.length, 'Short returns']].map(([v, k]) => (
              <div key={k} className="rounded-xl bg-white p-2 ring-1 ring-slate-200"><div className="text-lg font-extrabold text-slate-900">{v}</div><div className="text-[10px] text-slate-500">{k}</div></div>
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
            <li>1,284 issues and 1,251 returns counted automatically by shelf weight sensors.</li>
            <li>{out.length} item record{out.length === 1 ? '' : 's'} currently with students. Due before semester end.</li>
            <li>{short.length ? `${short.length} short return(s) declared by students: ${short.map((x) => `${x.missing} × ${x.name}`).join(', ')}.` : 'No unexplained losses this year.'}</li>
            <li>Both RFID instruments seen by lab door reader in the last 24 h.</li>
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

// ---------------- Heatmap ----------------
function Heatmap() {
  const { s } = useApp();
  const heat = { ...s.heatBase };
  const live = {};
  for (const a of s.alerts) if (!a.seed) { heat[a.cp] = (heat[a.cp] || 0) + 1; live[a.cp] = (live[a.cp] || 0) + 1; }
  const ranked = Object.entries(heat).sort((a, b) => b[1] - a[1]);
  const max = ranked[0][1];
  const top = { GATE: 'Tailgating', WALL: 'Wall crossing', B: 'Follower', D: 'Visitor zone', C: 'Camera tamper', LAB: 'Equipment exit', A: 'Loitering', ADMIN: 'Visitor zone' };
  return (
    <div className="space-y-4 p-4 pb-8">
      <Card className="p-2">
        <CampusMap heat={heat} showGuards={false} />
        <div className="flex items-center justify-between px-2 pb-1 pt-2 text-[11px] text-slate-500">
          <span>Last 30 days + live</span>
          <span className="flex items-center gap-1">Fewer <span className="h-2 w-16 rounded-full bg-gradient-to-r from-red-100 to-red-600" /> More</span>
        </div>
      </Card>
      <div>
        <SectionTitle>Zones by alerts</SectionTitle>
        <Card className="space-y-3">
          {ranked.map(([id, n]) => (
            <div key={id}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-900">{CP[id].name}</span>
                <span className="tabular-nums text-slate-600"><b className="text-slate-900">{n}</b>{live[id] ? <span className="ml-1 text-xs font-semibold text-red-600">+{live[id]} today</span> : null}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"><div className="grow h-full rounded-full bg-gradient-to-r from-amber-400 to-red-600" style={{ width: `${(n / max) * 100}%` }} /></div>
              <div className="mt-0.5 text-[11px] text-slate-500">Mostly: {top[id]}</div>
            </div>
          ))}
        </Card>
      </div>
      <Card className="flex items-start gap-3 bg-blue-50 ring-blue-100">
        <Icon name="bulb" className="mt-0.5 h-5 w-5 text-navy" />
        <p className="text-sm text-slate-700"><b>Suggestion:</b> add a second guard at the Main Gate 8–9 am and brighter lights at Boundary Wall East.</p>
      </Card>
    </div>
  );
}

// ---------------- Audit ----------------
function Audit() {
  const { s, now } = useApp();
  const [cat, setCat] = useState('all');
  const list = s.audit.filter((a) => cat === 'all' || a.cat === cat);
  const m = s.monthly;
  const month = new Date(now).toLocaleDateString('en-IN', { month: 'long' });
  return (
    <div className="space-y-4 p-4 pb-8">
      <div className="rounded-3xl bg-gradient-to-br from-navy to-navy-light p-5 text-white shadow-md">
        <div className="text-xs font-bold uppercase tracking-wider text-saffron">Transparency · {month}</div>
        <p className="mt-2 text-lg font-bold leading-snug">{m.walks} walks, {m.followers} follower alerts, {m.faceSearches} face searches, {m.unblurs} unblurs reviewed by the student committee.</p>
        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          {[[m.walks, 'Walks'], [m.followers, 'Follower alerts'], [m.faceSearches, 'Face searches'], [m.unblurs, 'Unblurs']].map(([v, k]) => (
            <div key={k} className="rounded-xl bg-white/10 px-1 py-2"><div className="text-xl font-extrabold">{v}</div><div className="text-[10px] leading-tight text-blue-100">{k}</div></div>
          ))}
        </div>
        <p className="mt-3 text-xs text-blue-200">Published to students every month. Face search is switched off by design.</p>
      </div>
      <div>
        <SectionTitle>Audit log</SectionTitle>
        <div className="mb-2 flex gap-2 overflow-x-auto no-scrollbar">
          {[['all', 'All'], ['footage', 'Footage'], ['lookup', 'Lookups'], ['system', 'System']].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setCat(k)} className={cls('shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold', cat === k ? 'bg-navy text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200')}>{l}</button>
          ))}
        </div>
        <Card className="divide-y divide-slate-100 p-0">
          {list.map((a) => (
            <div key={a.id} className="fade-up flex gap-3 px-4 py-3">
              <span className={cls('mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg', a.cat === 'footage' ? 'bg-red-50 text-red-600' : a.cat === 'system' ? 'bg-slate-100 text-slate-600' : 'bg-blue-50 text-navy')}>
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
