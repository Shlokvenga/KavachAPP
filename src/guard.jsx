// Guard app: live alert feed, campus map, active Saathi Walks, demo triggers.
import { useState } from 'react';
import { ALERT_TYPES, CP, ESCALATE_MS, PRI, ROUTES, cls, cpShort, distM, fmtTime, mmss, ago } from './data.js';
import {
  acceptAlert, audit, equipmentLeaving, guardById, lastPassed, nextStep, playSpeaker, resolveAlert,
  skipTime, toggleLights, TRIGGERS, useApp, visitorWrongZone,
} from './store.js';
import CampusMap from './map.jsx';
import { Badge, BottomNav, Btn, Card, ClipPlayer, DemoPanel, Icon, LiveDot, NightPhoto, SectionTitle } from './ui.jsx';

const byPriority = (a, b) => PRI[ALERT_TYPES[a.type].pri].rank - PRI[ALERT_TYPES[b.type].pri].rank || b.time - a.time;

export default function GuardApp() {
  const { s } = useApp();
  const [tab, setTab] = useState('alerts');
  const [me, setMe] = useState('ramesh');
  const g = guardById(s, me);
  const open = s.alerts.filter((a) => a.status !== 'resolved');

  return (
    <>
      <div className="shrink-0 bg-navy px-4 pb-3 pt-3 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-blue-200">Guard console</div>
            <div className="text-lg font-bold">On duty · {g.name}</div>
            <div className="text-xs text-blue-200">Post: {g.post} · Radio channel 4</div>
          </div>
          <Badge className="bg-white/10 text-white"><LiveDot />Live</Badge>
        </div>
        <div className="mt-2 flex gap-1.5" role="tablist" aria-label="Switch guard">
          {s.guards.map((x) => (
            <button key={x.id} type="button" onClick={() => setMe(x.id)}
              className={cls('flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition', me === x.id ? 'bg-saffron text-slate-900' : 'bg-white/10 text-blue-100 hover:bg-white/20')}>
              <span className={cls('grid h-4 w-4 place-items-center rounded-full text-[9px]', me === x.id ? 'bg-slate-900 text-saffron' : 'bg-white/20')}>{x.name[0]}</span>
              {x.name}
            </button>
          ))}
        </div>
      </div>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto" key={tab}>
        {tab === 'alerts' && <AlertFeed me={me} />}
        {tab === 'map' && <MapTab me={me} />}
        {tab === 'walks' && <WalksTab />}
        {tab === 'demo' && <DemoTab />}
      </div>

      <BottomNav value={tab} onChange={setTab} items={[
        { id: 'alerts', label: 'Alerts', icon: 'bell', badge: open.length },
        { id: 'map', label: 'Live map', icon: 'map' },
        { id: 'walks', label: 'Walks', icon: 'walk', dot: s.walk && s.walk.phase === 'active' },
        { id: 'demo', label: 'Demo', icon: 'zap' },
      ]} />
    </>
  );
}

function AlertFeed({ me }) {
  const { s } = useApp();
  const [filter, setFilter] = useState('open');
  const open = s.alerts.filter((a) => a.status !== 'resolved').sort(byPriority);
  const done = s.alerts.filter((a) => a.status === 'resolved');
  const list = filter === 'open' ? open : done;
  const esc = open.filter((a) => a.escalated).length;
  return (
    <div className="space-y-3 p-4 pb-8">
      <div className="grid grid-cols-3 gap-2">
        {[[open.filter((a) => a.status === 'new').length, 'New', 'text-red-600'], [open.filter((a) => a.status === 'accepted').length, 'Accepted', 'text-navy'], [esc, 'Escalated', 'text-amber-600']].map(([n, k, c]) => (
          <Card key={k} className="px-3 py-2.5 text-center"><div className={cls('text-2xl font-extrabold', c)}>{n}</div><div className="text-[11px] font-medium text-slate-500">{k}</div></Card>
        ))}
      </div>
      <div className="flex gap-2">
        {[['open', `Open (${open.length})`], ['done', `Resolved (${done.length})`]].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setFilter(k)}
            className={cls('rounded-full px-3.5 py-1.5 text-sm font-semibold transition', filter === k ? 'bg-navy text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200')}>{l}</button>
        ))}
      </div>
      {list.length === 0 && (
        <Card className="py-10 text-center">
          <Icon name="shieldCheck" className="mx-auto h-10 w-10 text-emerald-500" />
          <div className="mt-2 font-semibold text-slate-900">All clear</div>
          <div className="text-sm text-slate-500">Use the Demo tab to create sample alerts.</div>
        </Card>
      )}
      {list.map((a) => <AlertCard key={a.id} a={a} me={me} />)}
    </div>
  );
}

export function AlertCard({ a, me, compact }) {
  const { s, mutate, now } = useApp();
  const T = ALERT_TYPES[a.type];
  const P = PRI[T.pri];
  const cp = CP[a.cp];
  const assigned = guardById(s, a.assigned);
  const meG = guardById(s, me);
  const acc = a.acceptedBy && guardById(s, a.acceptedBy);
  const resolved = a.status === 'resolved';
  const left = Math.max(0, Math.ceil((ESCALATE_MS - (now - a.time)) / 1000));
  const act = (fn) => mutate((d) => fn(d, a.id, me));
  const logView = (what) => mutate((d) => audit(d, `Guard ${meG.name}`, `${what} · ${cp.name}`, `Responding to alert ${a.id}`));

  return (
    <Card className={cls('fade-up overflow-hidden p-0', a.status === 'new' && !resolved && (T.pri === 'medium' ? 'ring-2 ring-amber-300' : 'ring-2 ring-red-300'), resolved && 'opacity-80')}>
      {a.escalated && !resolved && (
        <div className="flex items-center gap-2 bg-amber-500 px-4 py-1.5 text-xs font-bold text-slate-900"><Icon name="alert" className="h-4 w-4" />Escalated to Security Head</div>
      )}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <span className={cls('grid h-11 w-11 shrink-0 place-items-center rounded-xl', P.tile)}><Icon name={T.icon} /></span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold leading-tight text-slate-900">{T.label}</span>
              <Badge className={P.badge}>{P.label}</Badge>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
              <span className="flex items-center gap-1"><Icon name="pin" className="h-3 w-3" />{cp.name}</span>
              <span>{fmtTime(a.time)} · {ago(a.time, now)}</span>
            </div>
          </div>
          <StatusBadge a={a} />
        </div>

        <p className="mt-3 text-sm text-slate-700">{a.detail}</p>

        {!compact && (
          <div className={cls('mt-3 grid gap-2', a.photo ? 'grid-cols-2' : 'grid-cols-1')}>
            {a.photo && (
              <button type="button" className="text-left" onClick={() => logView('Viewed Saathi Walk last-seen photo')}>
                <NightPhoto cp={a.photo.cp} time={a.photo.time} className="aspect-video w-full" />
                <div className="mt-1 text-[11px] font-medium text-slate-500">Last seen · {cpShort(a.photo.cp)}, {fmtTime(a.photo.time)}</div>
              </button>
            )}
            <div>
              <ClipPlayer cp={a.cp} onView={() => logView('Viewed 10 s clip')} label={a.photo ? '10 s clip' : '10 s clip · faces blurred'} />
              {a.photo && <div className="mt-1 text-[11px] font-medium text-slate-500">Faces blurred</div>}
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
          <Badge className="bg-slate-100 text-slate-600"><Icon name="user" className="h-3 w-3" />Nearest: {assigned.name} ({distM(assigned, cp)} m)</Badge>
          {a.lights && <Badge className="bg-yellow-100 text-yellow-800"><Icon name="bulb" className="h-3 w-3" />Lights ON</Badge>}
          {a.status === 'new' && !a.escalated && <Badge className="bg-red-50 text-red-700"><Icon name="clock" className="h-3 w-3" />Escalates in {mmss(left)}</Badge>}
        </div>

        {a.speaker && (
          <div className="fade-up mt-3 flex items-start gap-2 rounded-xl bg-slate-900 p-3 text-sm text-white">
            <Icon name="speaker" className="mt-0.5 h-4 w-4 text-saffron" />
            <span>"You are being recorded. Security is on the way."<span className="block text-[11px] text-slate-400">Played on area speaker at {fmtTime(a.speakerAt)}</span></span>
          </div>
        )}

        {a.status === 'accepted' && acc && (
          <div className="fade-up mt-3 flex items-center gap-3 rounded-xl bg-blue-50 p-3 text-sm text-navy">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-navy text-white"><Icon name="nav" className="h-4 w-4" /></span>
            <span className="flex-1"><b>{acc.name}</b> navigating to {cp.name}<span className="block text-xs text-slate-600">{a.dist} m · about {Math.max(1, Math.ceil(a.dist / 80))} min · accepted {fmtTime(a.acceptedAt)}</span></span>
          </div>
        )}

        {resolved && (
          <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
            <div className="flex items-center gap-1.5 font-semibold"><Icon name="checkCircle" className="h-4 w-4" />Resolved {a.resolvedBy === 'system' ? 'automatically' : a.resolvedBy === 'student' ? 'by student' : `by ${guardById(s, a.resolvedBy).name}`} · {fmtTime(a.resolvedAt)}</div>
            {a.note && <div className="mt-0.5 text-xs">{a.note}</div>}
          </div>
        )}

        {!resolved && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {a.status === 'new' ? (
              <Btn size="sm" className="col-span-2" icon="nav" onClick={() => act(acceptAlert)}>Accept and navigate</Btn>
            ) : null}
            <Btn size="sm" v={a.lights ? 'accent' : 'outline'} icon="bulb" onClick={() => act(toggleLights)}>{a.lights ? 'Lights on' : 'Turn on area lights'}</Btn>
            <Btn size="sm" v="outline" icon="speaker" onClick={() => act(playSpeaker)}>Play speaker warning</Btn>
            <Btn size="sm" v="success" className="col-span-2" icon="check" onClick={() => act(resolveAlert)}>Resolve</Btn>
          </div>
        )}
      </div>
    </Card>
  );
}

function StatusBadge({ a }) {
  if (a.status === 'resolved') return <Badge className="bg-emerald-100 text-emerald-700">Resolved</Badge>;
  if (a.status === 'accepted') return <Badge className="bg-blue-100 text-navy">Accepted</Badge>;
  return <Badge className="bg-red-600 text-white"><span className="h-1.5 w-1.5 rounded-full bg-white blink" />New</Badge>;
}

function MapTab({ me }) {
  const { s } = useApp();
  const open = s.alerts.filter((a) => a.status !== 'resolved').sort(byPriority);
  const [sel, setSel] = useState(null);
  const selected = open.find((a) => a.id === sel) || null;
  return (
    <div className="space-y-3 p-4 pb-8">
      <Card className="p-2">
        <CampusMap alerts={s.alerts} guards={s.guards} walk={s.walk} selected={sel} onSelect={setSel} />
        <div className="flex flex-wrap gap-x-3 gap-y-1 px-2 pb-1 pt-2 text-[11px] text-slate-600">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-600" />Alert</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" />Warning</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-navy" />Guard</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-saffron" />Saathi Walk</span>
          <span className="flex items-center gap-1"><span className="grid h-3 w-3 place-items-center rounded-full border border-navy text-[6px] font-bold text-navy">A</span>Checkpoint</span>
        </div>
      </Card>
      {selected ? (
        <>
          <SectionTitle right={<button type="button" className="text-xs font-semibold text-navy" onClick={() => setSel(null)}>Show all</button>}>Selected alert</SectionTitle>
          <AlertCard a={selected} me={me} />
        </>
      ) : (
        <>
          <SectionTitle>Tap a red dot or pick an alert</SectionTitle>
          {open.length === 0 && <Card className="text-center text-sm text-slate-500">No open alerts on campus.</Card>}
          {open.map((a) => (
            <button key={a.id} type="button" onClick={() => setSel(a.id)} className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm ring-1 ring-slate-200/70">
              <span className={cls('grid h-9 w-9 place-items-center rounded-xl', PRI[ALERT_TYPES[a.type].pri].tile)}><Icon name={ALERT_TYPES[a.type].icon} className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-900">{ALERT_TYPES[a.type].label}</span>
                <span className="block text-xs text-slate-500">{CP[a.cp].name} · {fmtTime(a.time)}</span>
              </span>
              <StatusBadge a={a} />
            </button>
          ))}
        </>
      )}
    </div>
  );
}

function WalksTab() {
  const { s, now } = useApp();
  const w = s.walk;
  return (
    <div className="space-y-3 p-4 pb-8">
      <Card className="flex items-start gap-3 bg-blue-50 ring-blue-100">
        <Icon name="info" className="mt-0.5 h-5 w-5 text-navy" />
        <p className="text-sm text-slate-700">Names show here only because the student <b>opted in</b> to a Saathi Walk. Everyone else stays anonymous.</p>
      </Card>
      <Card className="p-2"><CampusMap alerts={[]} guards={s.guards} walk={w} /></Card>
      {w && <PriyaWalk w={w} now={now} />}
      {s.otherWalks.map((o) => (
        <Card key={o.id} className="flex items-center gap-3 p-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 font-bold text-slate-600">{o.name[0]}</span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-900">{o.name} → {o.dest}</div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${o.progress * 100}%` }} /></div>
            <div className="mt-1 text-xs text-slate-500">Last: {CP[o.at].name} · started {ago(o.started, now)}</div>
          </div>
          <Badge className="bg-emerald-100 text-emerald-700">On time</Badge>
        </Card>
      ))}
    </div>
  );
}

function PriyaWalk({ w, now }) {
  const { s } = useApp();
  const passed = w.steps.filter((x) => x.status === 'passed').length;
  const last = lastPassed(w);
  const next = nextStep(w);
  const openA = s.alerts.filter((a) => a.walk && a.status !== 'resolved' && [w.sosAlert, w.missedAlert, w.followerAlert].includes(a.id));
  const state = w.phase === 'arrived' ? ['Reached safely', 'bg-emerald-100 text-emerald-700']
    : openA.some((a) => a.type === 'sos') ? ['SOS', 'bg-red-600 text-white']
      : openA.some((a) => a.type === 'missed') ? ['Missed checkpoint', 'bg-red-100 text-red-700']
        : w.missing ? ['Checking in…', 'bg-amber-100 text-amber-800']
          : openA.length ? ['Follower alert', 'bg-violet-100 text-violet-700'] : ['On time', 'bg-emerald-100 text-emerald-700'];
  return (
    <Card className="p-3 ring-2 ring-saffron/60">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-saffron font-bold text-slate-900">P</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900">Priya S. → {ROUTES[w.dest].dest}</div>
          <div className="text-xs text-slate-500">{w.phase === 'arrived' ? `Arrived ${fmtTime(w.arrivedAt)} · photos deleted` : `Last: ${cpShort(last.cp)} ${fmtTime(last.time)} · next: ${next ? cpShort(next.cp) : '-'}`}</div>
        </div>
        <Badge className={state[1]}>{state[0]}</Badge>
      </div>
      <div className="mt-3 flex gap-1">
        {w.steps.map((st) => (
          <div key={st.cp} className="flex-1 text-center">
            <div className={cls('h-1.5 rounded-full', st.status === 'passed' ? 'bg-emerald-500' : st.status === 'missed' ? 'bg-red-500' : 'bg-slate-200')} />
            <div className="mt-1 text-[10px] font-semibold text-slate-500">{cpShort(st.cp)}</div>
          </div>
        ))}
      </div>
      <div className="mt-1 text-right text-[11px] text-slate-400">{passed}/{w.steps.length} · started {ago(w.startedAt, now)}{w.sharing ? ' · shared with a friend' : ''}</div>
    </Card>
  );
}

function DemoTab() {
  const { s, mutate } = useApp();
  const osc = s.inventory.find((i) => i.id === 'osc4');
  const triggers = [
    { k: 'wall', icon: 'fence', t: 'Wall crossing', d: 'Boundary Wall East', run: TRIGGERS.wall },
    { k: 'tailgate', icon: 'tailgate', t: 'Tailgating at gate', d: 'Main Gate, Lane 2', run: TRIGGERS.tailgate },
    { k: 'tamper', icon: 'cameraOff', t: 'Camera tampered', d: 'Canteen Junction C-2', run: TRIGGERS.tamper },
    { k: 'lab', icon: 'cpu', t: 'Oscilloscope leaving lab', d: osc.holder ? `Issued to ${osc.holder}` : 'Not issued: lab + gate', run: (d) => equipmentLeaving(d, 'osc4') },
    { k: 'visitor', icon: 'badge', t: 'Visitor in wrong zone', d: 'Seen near Hostel D', run: visitorWrongZone },
  ];
  return (
    <div className="space-y-3 p-4 pb-8">
      <DemoPanel title="Demo triggers: create sample alerts">
        <div className="grid grid-cols-2 gap-2">
          {triggers.map((x) => (
            <button key={x.k} type="button" onClick={() => mutate(x.run)}
              className="flex flex-col items-start gap-2 rounded-2xl bg-white p-3 text-left shadow-sm ring-1 ring-slate-200 transition hover:ring-navy active:scale-[.98]">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-red-50 text-red-600"><Icon name={x.icon} className="h-5 w-5" /></span>
              <span className="text-sm font-semibold leading-tight text-slate-900">{x.t}</span>
              <span className="text-[11px] text-slate-500">{x.d}</span>
            </button>
          ))}
          <button type="button" onClick={() => mutate((d) => skipTime(d))}
            className="flex flex-col items-start gap-2 rounded-2xl bg-amber-50 p-3 text-left ring-1 ring-amber-200 transition active:scale-[.98]">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-100 text-amber-700"><Icon name="forward" className="h-5 w-5" /></span>
            <span className="text-sm font-semibold leading-tight text-slate-900">Skip 2 minutes</span>
            <span className="text-[11px] text-slate-500">Test auto-escalation</span>
          </button>
        </div>
      </DemoPanel>
      <Card className="text-sm text-slate-600">
        <div className="mb-1 font-semibold text-slate-900">Rules running</div>
        <ul className="list-disc space-y-1 pl-5">
          <li>Alerts not accepted in 2 min go to the Security Head.</li>
          <li>RFID instrument at lab door + not issued → alert lab door and Main Gate.</li>
          <li>Visitor pass zone checked by anonymous cameras.</li>
        </ul>
      </Card>
    </div>
  );
}
