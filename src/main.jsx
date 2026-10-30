// App shell: start screen, role switcher, phone frame(s), shared state and timers.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { STUDENT, cls, makeInitial, pad } from './data.js';
import { AppCtx, tick, toast, useApp } from './store.js';
import { Avatar, Btn, Icon, Logo, Toasts } from './ui.jsx';
import StudentApp from './student.jsx';
import GuardApp from './guard.jsx';
import AdminApp from './admin.jsx';

const ROLES = [
  { id: 'student', label: 'Student', icon: 'user', title: 'Student app', who: 'Priya Sharma · 21BRS045', desc: 'Rotating QR ID, Saathi Walk night escort, LabLedger and your privacy.' },
  { id: 'guard', label: 'Guard', icon: 'shield', title: 'Guard console', who: 'Ramesh, Sunita, Imran', desc: 'Live campus map, alert feed with clips, lights, speaker warnings.' },
  { id: 'admin', label: 'Admin', icon: 'chart', title: 'Admin dashboard', who: 'Security & lab office', desc: 'Live stats, visitor passes, lab stock, heatmap and audit log.' },
];
const APPS = { student: StudentApp, guard: GuardApp, admin: AdminApp };

function useMedia(q) {
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const h = () => setM(mq.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, [q]);
  return m;
}

function App() {
  const [s, setS] = useState(makeInitial);
  const [now, setNow] = useState(Date.now());
  const [started, setStarted] = useState(false);
  const [role, setRoleState] = useState('student');
  const [split, setSplit] = useState(false);
  const [gen, setGen] = useState(0);
  const wide = useMedia('(min-width: 768px)');
  const xl = useMedia('(min-width: 1200px)');
  const splitOn = split && xl;

  const mutate = useCallback((fn) => setS((prev) => { const d = structuredClone(prev); fn(d); return d; }), []);
  const setRole = useCallback((r) => { setRoleState(r); setStarted(true); }, []);
  const reset = useCallback(() => {
    setS(() => { const d = makeInitial(); toast(d, 'all', 'Demo reset. All mock data restored.', 'success'); return d; });
    setGen((g) => g + 1);
  }, []);

  useEffect(() => {
    const id = setInterval(() => { setNow(Date.now()); mutate(tick); }, 1000);
    return () => clearInterval(id);
  }, [mutate]);

  const ctx = useMemo(() => ({ s, mutate, now, role, setRole, split: splitOn, reset }), [s, mutate, now, role, setRole, splitOn, reset]);

  const phone = (r, key) => (
    <Phone key={key} framed={wide} role={r}>
      {r === 'start' ? <StartScreen onOpen={setRole} /> : <RoleApp role={r} />}
    </Phone>
  );

  return (
    <AppCtx.Provider value={ctx}>
      {wide ? (
        <div className="desk-bg flex min-h-screen flex-col items-center">
          <TopBar started={started} setStarted={setStarted} split={splitOn} setSplit={setSplit} canSplit={xl} />
          <div className="flex w-full flex-1 items-start justify-center gap-6 px-4 pb-6">
            {splitOn ? (
              ROLES.map((r) => (
                <div key={r.id + gen} className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-600"><Icon name={r.icon} className="h-4 w-4" />{r.title}</div>
                  {phone(r.id, r.id + gen)}
                </div>
              ))
            ) : (
              <>
                <DemoGuide />
                {phone(started ? role : 'start', (started ? role : 'start') + gen)}
              </>
            )}
          </div>
        </div>
      ) : (
        phone(started ? role : 'start', (started ? role : 'start') + gen)
      )}
    </AppCtx.Provider>
  );
}

function RoleApp({ role }) {
  const App = APPS[role];
  return <App />;
}

function Phone({ framed, role, children }) {
  const { reset, setRole, s } = useApp();
  const showBar = !framed && role !== 'start';
  const allToasts = s.toasts.filter((t) => t.role === 'all');
  const inner = (
    <div data-phone={role} className="relative flex h-full w-full flex-col overflow-hidden bg-slate-50">
      {framed && <StatusBar dark={role !== 'start' && role !== 'student'} />}
      {showBar && (
        <div className="flex shrink-0 items-center gap-2 bg-slate-900 px-3 py-1.5 pt-[max(6px,env(safe-area-inset-top))]">
          <Logo className="h-6 w-6" />
          <RoleSwitch value={role} onChange={setRole} compact />
          <button type="button" onClick={reset} aria-label="Reset demo" className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white"><Icon name="refresh" className="h-4 w-4" /></button>
        </div>
      )}
      {children}
      {role !== 'start' && <Toasts role={role} />}
      {allToasts.length > 0 && (
        <div className="toast-in absolute inset-x-3 top-[52px] z-[70] flex items-center gap-2 rounded-2xl bg-emerald-600 px-3.5 py-3 text-sm font-medium text-white shadow-xl">
          <Icon name="checkCircle" />{allToasts[allToasts.length - 1].msg}
        </div>
      )}
    </div>
  );
  if (!framed) return <div className="h-[100dvh] w-full">{inner}</div>;
  return (
    <div className="relative shrink-0 rounded-[48px] bg-slate-900 p-[10px] shadow-[0_30px_60px_-20px_rgba(15,23,42,.45)] ring-1 ring-black/20"
      style={{ width: 384, height: 'min(820px, calc(100vh - 104px))', minHeight: 640 }}>
      <div className="h-full w-full overflow-hidden rounded-[38px]">{inner}</div>
      <div className="pointer-events-none absolute left-1/2 top-[18px] z-[80] h-[24px] w-[92px] -translate-x-1/2 rounded-full bg-slate-900" />
    </div>
  );
}

function StatusBar({ dark }) {
  const { now } = useApp();
  const d = new Date(now);
  return (
    <div className={cls('relative z-[75] flex h-11 shrink-0 items-center justify-between px-7 pt-1 text-[13px] font-semibold', dark ? 'bg-navy text-white' : 'bg-slate-50 text-slate-900')}>
      <span className="tabular-nums">{d.getHours() % 12 || 12}:{pad(d.getMinutes())}</span>
      <span className="flex items-center gap-1.5">
        <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor" aria-hidden="true"><rect x="0" y="7" width="3" height="4" rx="1" /><rect x="4.5" y="5" width="3" height="6" rx="1" /><rect x="9" y="2.5" width="3" height="8.5" rx="1" /><rect x="13.5" y="0" width="3" height="11" rx="1" /></svg>
        <span className="text-[11px]">4G</span>
        <svg width="25" height="12" viewBox="0 0 25 12" fill="none" aria-hidden="true"><rect x=".5" y=".5" width="21" height="11" rx="3" stroke="currentColor" opacity=".5" /><rect x="2" y="2" width="15" height="8" rx="1.8" fill="currentColor" /><rect x="22.5" y="4" width="2" height="4" rx="1" fill="currentColor" opacity=".5" /></svg>
      </span>
    </div>
  );
}

function RoleSwitch({ value, onChange, compact, light }) {
  return (
    <div className={cls('flex flex-1 rounded-full p-1', light ? 'bg-slate-200/80' : 'bg-white/10')} role="tablist" aria-label="Switch role">
      {ROLES.map((r) => {
        const on = r.id === value;
        return (
          <button key={r.id} type="button" role="tab" aria-selected={on} onClick={() => onChange(r.id)}
            className={cls('flex flex-1 items-center justify-center gap-1.5 rounded-full font-semibold transition',
              compact ? 'h-7 text-xs' : 'h-10 text-sm',
              on ? (light ? 'bg-white text-navy shadow' : 'bg-saffron text-slate-900') : (light ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'))}>
            {!compact && <Icon name={r.icon} className="h-4 w-4" />}{r.label}
          </button>
        );
      })}
    </div>
  );
}

function StartScreen({ onOpen }) {
  const [pick, setPick] = useState('student');
  const r = ROLES.find((x) => x.id === pick);
  return (
    <div className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto bg-gradient-to-b from-navy via-navy to-[#0f1d4a] text-white">
      <div className="px-5 pt-4"><RoleSwitch value={pick} onChange={setPick} /></div>
      <div className="flex flex-col items-center px-6 pt-8 text-center">
        <div className="relative">
          <span className="pulse-soft absolute inset-0 rounded-[28px] bg-saffron/40" />
          <div className="relative grid h-24 w-24 place-items-center rounded-[28px] bg-white shadow-2xl"><Logo className="h-16 w-16" /></div>
        </div>
        <h1 className="mt-5 text-4xl font-black tracking-tight">Kavach</h1>
        <p className="mt-1 text-sm font-medium text-blue-100">Smart campus safety and asset protection</p>
        <p className="mt-4 rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-saffron">Identify at the doors, anonymous in between.</p>
      </div>

      <div className="mt-7 px-5">
        <div key={pick} className="fade-up rounded-3xl bg-white p-5 text-slate-900 shadow-xl">
          <div className="flex items-center gap-3">
            {pick === 'student' ? <Avatar size={52} className="ring-blue-100" /> : (
              <span className="grid h-[52px] w-[52px] place-items-center rounded-full bg-blue-100 text-navy"><Icon name={r.icon} className="h-6 w-6" /></span>
            )}
            <div>
              <div className="text-lg font-bold">{r.title}</div>
              <div className="text-xs text-slate-500">{r.who}</div>
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-600">{r.desc}</p>
          <Btn v="accent" size="lg" className="mt-4 w-full" onClick={() => onOpen(pick)}>Open {r.label.toLowerCase()} app<Icon name="chevR" /></Btn>
        </div>
      </div>

      <div className="mt-6 space-y-3 px-5 pb-8">
        {[
          ['qr', 'Verified at the doors', 'Rotating QR + 1:1 face match at gate, labs and hostels.'],
          ['eye', 'Anonymous in between', 'Cameras look for danger, never for names.'],
          ['moon', 'Saathi Walk', 'Opt-in night escort. Photos deleted when you reach.'],
        ].map(([ic, t, d]) => (
          <div key={t} className="flex items-start gap-3 rounded-2xl bg-white/[.07] p-3 ring-1 ring-white/10">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-saffron/20 text-saffron"><Icon name={ic} className="h-5 w-5" /></span>
            <div><div className="text-sm font-semibold">{t}</div><div className="text-xs text-blue-200">{d}</div></div>
          </div>
        ))}
        <p className="pt-2 text-center text-[11px] text-blue-300">Prototype · all data is mock · {STUDENT.name} is a demo student</p>
      </div>
    </div>
  );
}

function TopBar({ started, setStarted, split, setSplit, canSplit }) {
  const { role, setRole, reset } = useApp();
  return (
    <header className="flex w-full max-w-[1240px] items-center gap-4 px-6 py-4">
      <button type="button" onClick={() => { setStarted(false); setSplit(false); }} className="flex items-center gap-2.5 text-left">
        <Logo className="h-9 w-9" />
        <span>
          <span className="block text-lg font-black leading-none text-navy">Kavach</span>
          <span className="block text-[11px] font-medium text-slate-500">Identify at the doors, anonymous in between.</span>
        </span>
      </button>
      <div className="mx-auto w-full max-w-[360px]">
        {!split && <RoleSwitch value={started ? role : null} onChange={setRole} light />}
      </div>
      <div className="flex items-center gap-2">
        {canSplit && (
          <Btn v={split ? 'primary' : 'outline'} size="sm" icon="columns" onClick={() => setSplit(!split)}>{split ? 'Single view' : 'Side by side'}</Btn>
        )}
        {started && !split && <Btn v="outline" size="sm" icon="home" onClick={() => setStarted(false)}>Start screen</Btn>}
        <Btn v="outline" size="sm" icon="refresh" onClick={reset}>Reset demo</Btn>
      </div>
    </header>
  );
}

const GUIDE = [
  ['student', 'My ID', 'Unlock with fingerprint, watch the QR rotate, simulate a gate scan, then scan again to see anti-passback.'],
  ['student', 'Saathi Walk', 'Help me get home → Start. Pass a checkpoint, then try Go missing and let the 30 s timer run out.'],
  ['guard', 'Guard', 'See the missed checkpoint with last photo. Accept, turn on lights, play the speaker warning.'],
  ['guard', 'Demo triggers', 'Fire a wall crossing or Oscilloscope leaving lab. Leave one alone for 2 min to escalate.'],
  ['admin', 'Admin', 'Create a visitor pass, check lab stock, generate the stock report, read the audit log.'],
];

function DemoGuide() {
  const { setRole } = useApp();
  return (
    <aside className="sticky top-4 hidden w-[280px] shrink-0 lg:block">
      <div className="rounded-3xl bg-white/80 p-5 shadow-sm ring-1 ring-slate-200 backdrop-blur">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-saffron-dark"><Icon name="zap" className="h-4 w-4" />5-minute demo</div>
        <ol className="mt-3 space-y-3">
          {GUIDE.map(([r, t, d], i) => (
            <li key={t}>
              <button type="button" onClick={() => setRole(r)} className="group flex gap-3 text-left">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-navy text-xs font-bold text-white">{i + 1}</span>
                <span>
                  <span className="block text-sm font-semibold text-slate-900 group-hover:text-navy group-hover:underline">{t}</span>
                  <span className="block text-xs text-slate-500">{d}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
        <p className="mt-4 border-t border-slate-200 pt-3 text-xs text-slate-500">All roles share live data. Try <b>Side by side</b> on a wide screen to see changes flow between apps.</p>
      </div>
    </aside>
  );
}

createRoot(document.getElementById('root')).render(<App />);
