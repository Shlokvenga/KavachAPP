// Student app: Home, My ID, Saathi Walk, Lab (LabLedger), Profile.
import { useRef, useState } from 'react';
import {
  CAMERAS, CP, DISPUTE_REASONS, HOSTELS, MIN, QR_PERIOD, ROUTES, camsAt, cls, cpShort, fmtDay, fmtTime, homeOf, myLog, presence, qrCode, studentOf,
} from './data.js';
import CampusMap from './map.jsx';
import { CameraFeed, camStatus } from './cctv.jsx';
import { FaceEnrolPage, GateCheckSheet, useVision } from './vision/ui.jsx';
import { snapshotAt } from './vision/live.js';
import { aiSupported } from './vision/engine.js';
import { guardById, guardLabel, lastPassed, mySos, myWalk, nextStep, walkGuard } from './store.js';
import { useApp } from './ctx.js';
import { BACK, useBack } from './back.js';
import { checkPassword } from './auth.js';
import { fingerprint } from './native.js';
import { FingerprintSetting, bioHelp, useBiometric } from './login.jsx';
import {
  ActionRow, Avatar, Badge, BottomNav, Btn, Card, CheckpointPhoto, DemoPanel, Eyebrow, Facts, Icon, LiveDot, Note, QR, ResultSheet, Ring,
  ScanOverlay, ScreenHeader, SectionTitle, Sheet, Stepper, Toggle, useFastNow,
} from './ui.jsx';

export default function StudentApp() {
  const { s, act, now } = useApp();
  const [tab, setTab] = useState('home');
  const w = myWalk(s);
  const walking = w && w.phase === 'active';
  const sosOpen = walking && w.sosAlert && s.alerts.find((a) => a.id === w.sosAlert && a.status !== 'resolved');
  const showFollower = walking && w.followerAt && now - w.followerAt < 8000;
  useBack(() => setTab('home'), tab !== 'home', BACK.tab);

  return (
    <>
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto" key={tab}>
        {tab === 'home' && <Home go={setTab} />}
        {tab === 'id' && <MyId />}
        {tab === 'walk' && <SaathiWalk />}
        {tab === 'lab' && <Lab />}
        {tab === 'profile' && <Profile />}
      </div>

      {showFollower && (
        <div className="shake absolute inset-x-3 top-2 z-40 flex items-start gap-3 rounded-2xl bg-ink p-3.5 text-white shadow-2xl ring-2 ring-accent">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-ink"><Icon name="vibrate" className="h-5 w-5" /></span>
          <div className="text-sm">
            <div className="font-semibold">Someone has been behind you for 3 checkpoints.</div>
            <div className="mt-0.5 text-slate-300">{guardLabel(guardById(s, w.guard))} notified. Keep walking to a lit area.</div>
          </div>
        </div>
      )}

      {walking && (
        <button type="button" onClick={() => (sosOpen ? setTab('walk') : act('sos'))} aria-label="SOS"
          className="absolute bottom-[84px] right-4 z-30 grid h-16 w-16 place-items-center rounded-full bg-red-600 text-white shadow-xl shadow-red-600/40 ring-4 ring-white active:scale-95">
          <span className="pulse-soft absolute inset-0 rounded-full bg-red-500" />
          <span className="relative text-lg font-black tracking-wide">SOS</span>
        </button>
      )}

      {walking && w.missing && w.missing.stage === 'prompt' && <AreYouOk />}

      <BottomNav value={tab} onChange={setTab} items={[
        { id: 'home', label: 'Home', icon: 'home' },
        { id: 'id', label: 'My ID', icon: 'qr' },
        { id: 'walk', label: 'Saathi Walk', icon: 'walk', dot: walking },
        { id: 'lab', label: 'Lab', icon: 'flask' },
        { id: 'profile', label: 'Profile', icon: 'user' },
      ]} />
    </>
  );
}

// ---------------- SOS (always on Home) ----------------
// Hold the orb for 1 s to send, so a pocket tap does not raise an alarm. During a
// Saathi Walk it uses the walk (last checkpoint, walk guard); otherwise the student
// picks where they are.
const SOS_CP_KEY = 'kavach-sos-place';
const HOLD_MS = 1000;
function SosCard({ go }) {
  const { s, act } = useApp();
  const me = studentOf(s);
  const w = myWalk(s);
  const walking = w && w.phase === 'active';
  const open = mySos(s);
  const [place, setPlace] = useState(() => { try { return localStorage.getItem(SOS_CP_KEY) || 'A'; } catch (e) { return 'A'; } });
  const [silent, setSilent] = useState(false);
  const [pct, setPct] = useState(0);
  const timer = useRef(null);
  const send = () => {
    if (walking) { act('sos'); go('walk'); } else act('sosHere', place, { silent, femaleGuard: me.gender === 'female' });
  };
  const start = (e) => {
    e.preventDefault();
    const t0 = performance.now();
    const step = () => {
      const p = Math.min(100, ((performance.now() - t0) / HOLD_MS) * 100);
      setPct(p);
      if (p >= 100) { timer.current = null; setPct(0); try { navigator.vibrate && navigator.vibrate(60); } catch (x) { /* ignore */ } send(); } else timer.current = requestAnimationFrame(step);
    };
    timer.current = requestAnimationFrame(step);
  };
  const stop = () => { if (timer.current) cancelAnimationFrame(timer.current); timer.current = null; setPct(0); };
  const pick = (v) => { setPlace(v); try { localStorage.setItem(SOS_CP_KEY, v); } catch (e) { /* ignore */ } };

  if (open) {
    const g = guardById(s, open.acceptedBy || open.assigned);
    return (
      <div className="fade-up rounded-2xl border border-red-500/50 bg-red-500/15 p-4">
        <Eyebrow className="text-red-700">SOS active · {open.id}</Eyebrow>
        <div className="mt-1 font-bold text-slate-900">{open.status === 'accepted' ? `${open.acceptedName || g.name} is on the way` : open.escalated ? 'Escalated to the Security Head' : `Waiting for ${g.id ? g.name : 'a guard'} to accept`}</div>
        <div className="mt-0.5 text-xs text-slate-500">Near {CP[open.cp].name} · sent {fmtTime(open.time)}</div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a href="tel:112" className="flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/15 font-mono text-xs font-semibold text-red-700"><Icon name="phone" className="h-3.5 w-3.5" />Call 112</a>
          <Btn v="success" size="sm" icon="check" onClick={() => act('cancelMySos')}>I'm safe</Btn>
        </div>
      </div>
    );
  }
  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Eyebrow>{me.gender === 'female' ? "Women's campus safety" : 'Student emergency'}</Eyebrow>
          <h2 className="font-display text-base font-bold text-slate-900">Emergency SOS</h2>
        </div>
        {walking
          ? <span className="font-mono text-[10px] uppercase text-slate-500">On Saathi Walk</span>
          : (
            <select aria-label="Where are you" value={place} onChange={(e) => pick(e.target.value)}
              className="max-w-[48%] rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 font-mono text-[11px] text-slate-800">
              {Object.values(CP).map((c) => <option key={c.id} value={c.id} className="bg-[#060c11]">{c.name}</option>)}
            </select>
          )}
      </div>
      <div className="flex justify-center py-4">
        <div className="relative grid place-items-center">
          <span className="orb-ring absolute h-36 w-36 rounded-full bg-red-500/25" />
          <button type="button" aria-label="Hold for one second to send SOS"
            onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onContextMenu={(e) => e.preventDefault()}
            className="sos-orb relative flex h-32 w-32 touch-none select-none flex-col items-center justify-center rounded-full text-white transition active:scale-95">
            {pct > 0 && (
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
                <circle cx="50" cy="50" r="47" fill="none" stroke="white" strokeWidth="4" strokeDasharray={`${(pct / 100) * 295} 295`} strokeLinecap="round" />
              </svg>
            )}
            <Icon name="siren" className="h-7 w-7" />
            <span className="mt-1 text-base font-bold tracking-wider">SOS</span>
            <span className="font-mono text-[10px] opacity-90">{pct > 0 ? `${Math.round(pct)}%` : 'HOLD 1 SEC'}</span>
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setSilent((v) => !v)} aria-pressed={silent}
          className={cls('flex min-h-9 items-center justify-center gap-1.5 rounded-lg border font-mono text-xs transition', silent ? 'border-amber-400 bg-amber-500/20 text-amber-700' : 'border-white/15 bg-black/30 text-slate-500')}>
          <Icon name="vibrate" className="h-3.5 w-3.5" />{silent ? 'Silent ON' : 'Silent SOS'}
        </button>
        <a href="tel:112" className="flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/15 font-mono text-xs font-semibold text-red-700"><Icon name="phone" className="h-3.5 w-3.5" />Call 112</a>
      </div>
    </div>
  );
}

// ---------------- Home ----------------
// Things to tap sit on raised surfaces; information is plain text on the background.
function Home({ go }) {
  const { s, now } = useApp();
  const me = studentOf(s);
  const inside = presence(s, me.id) === 'IN';
  const log = myLog(s);
  const lastGate = log[0];
  const w = myWalk(s);
  const hr = new Date(now).getHours();
  const greet = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  const mine = s.issued.filter((i) => i.status === 'issued' && i.sid === me.id);
  return (
    <div className="pb-10">
      <div className="flex items-center gap-3 px-5 pb-2 pt-6">
        <div className="min-w-0 flex-1">
          <div className="text-sm text-slate-500">{greet}</div>
          <div className="truncate font-display text-[28px] font-semibold leading-tight text-slate-900">{me.first}</div>
        </div>
        <button type="button" onClick={() => go('profile')} aria-label="Profile" className="rounded-full active:scale-95"><Avatar size={44} gender={me.gender} /></button>
      </div>
      <p className="flex items-center gap-2 px-5 text-xs text-slate-500">
        <span className={cls('h-2 w-2 rounded-full', inside ? 'bg-emerald-400' : 'bg-slate-400')} />
        {inside ? 'Inside campus' : 'Outside campus'}
        {lastGate && <span className="truncate">· last scan {fmtTime(lastGate.time)}, {lastGate.place}</span>}
      </p>

      <div className="mt-5 space-y-3 px-4">
        <SosCard go={go} />

        {w && w.phase === 'active' && (
          <button type="button" onClick={() => go('walk')} className="fade-up flex w-full items-center gap-3 rounded-2xl bg-accent p-4 text-left text-ink shadow-lg">
            <Icon name="walk" className="h-6 w-6" />
            <span className="min-w-0 flex-1">
              <span className="block font-bold">Saathi Walk in progress</span>
              <span className="block truncate text-xs">To {ROUTES[w.dest].dest} · next: {nextStep(w) ? CP[nextStep(w).cp].name : 'arrived'}</span>
            </span>
            <Icon name="chevR" />
          </button>
        )}

        <button type="button" onClick={() => go('id')} className="flex w-full items-center gap-4 rounded-3xl bg-brand p-5 text-left text-ink shadow-[0_10px_30px_-10px_rgb(var(--brand)/0.7)] active:scale-[.99]">
          <Icon name="qr" className="h-9 w-9" />
          <span className="flex-1">
            <span className="block text-lg font-bold">Show my ID</span>
            <span className="block text-sm opacity-75">Rotating pass for gates and labs</span>
          </span>
          <Icon name="chevR" />
        </button>

        <Card className="divide-y divide-line p-0">
          <ActionRow icon="moon" title="Saathi Walk" sub="A guard watches your walk home at night" onClick={() => go('walk')} />
          <ActionRow icon="flask" title="LabLedger" sub={mine.length ? `${mine.length} item${mine.length === 1 ? '' : 's'} with you` : 'Borrow and return lab items'} onClick={() => go('lab')} />
        </Card>
      </div>

      <div className="mt-8 px-5">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">Recent activity</h2>
          {log.length > 3 && <button type="button" className="text-xs font-semibold text-brand" onClick={() => go('id')}>See all</button>}
        </div>
        {log.length === 0
          ? <p className="mt-3 text-sm text-slate-500">Your gate and checkpoint scans will show here.</p>
          : <div className="mt-1 divide-y divide-line">{log.slice(0, 3).map((l) => <LogRow key={l.id} l={l} now={now} />)}</div>}
      </div>

      <Note icon="shield" className="mt-8 px-5">Identify at the doors, anonymous in between: campus cameras watch for danger, never for names.</Note>
    </div>
  );
}

function LogRow({ l, now }) {
  const isIn = l.dir === 'IN';
  return (
    <div className="flex items-center gap-3 py-2.5">
      <Icon name={isIn ? 'login' : 'logout'} className={cls('h-4 w-4', isIn ? 'text-emerald-600' : 'text-orange-600')} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-slate-800">{l.place}</div>
        <div className="text-xs text-slate-500">{fmtDay(l.time, now)} · {fmtTime(l.time)}</div>
      </div>
      <span className={cls('font-mono text-[11px] font-semibold', isIn ? 'text-emerald-700' : 'text-orange-700')}>{l.dir}</span>
    </div>
  );
}

// ---------------- My ID ----------------
function MyId() {
  const { s, act, now } = useApp();
  const [lock, setLock] = useState('locked'); // locked | open
  const [scan, setScan] = useState(null); // { mode } while scanning
  const [result, setResult] = useState(null);
  const [liveGate, setLiveGate] = useState(false);
  const fast = useFastNow(200);
  const slot = Math.floor(fast / (QR_PERIOD * 1000));
  const left = QR_PERIOD - ((fast / 1000) % QR_PERIOD);
  const me = studentOf(s);
  const myDir = presence(s, me.id);
  const nextDir = myDir === 'IN' ? 'OUT' : 'IN';

  const finishScan = (mode) => {
    const t = Date.now();
    if (mode === 'expired') {
      setResult({ ok: false, title: 'Rejected: code expired', note: `This code was made ${QR_PERIOD * 3 + Math.floor(((t / 1000) % QR_PERIOD))} s ago. Screenshots don't work.`, rows: [['QR code', 'Expired', false], ['Face check', 'Not started'], ['Entry logged', 'No', false]] });
    } else if (mode === 'repeat') {
      const d = myDir;
      setResult({ ok: false, title: d === 'IN' ? 'Already inside, scan OUT first' : 'Already outside, scan IN first', note: 'Anti-passback: one pass cannot be used twice in a row.', rows: [['QR code', 'Valid', true], ['Face matched (1:1)', 'Yes', true], [`Entry logged: ${d}`, 'Blocked', false]] });
    } else {
      act('gateScan', nextDir);
      setResult({ ok: true, title: nextDir === 'IN' ? `Welcome in, ${me.first}!` : `Goodbye, ${me.first}!`, note: 'Main Gate · Lane 2', rows: [['Face matched (1:1)', '✓', true], ['Liveness', '✓', true], ['Entry logged', `${nextDir}, ${fmtTime(t)}`, true]] });
    }
    setScan(null);
  };

  if (lock !== 'open') return <IdLock onOpen={() => setLock('open')} />;

  return (
    <div className="pb-28">
      <ScreenHeader title="My ID" sub="Show this at any checkpoint" right={
        <button type="button" onClick={() => setLock('locked')} className="flex items-center gap-1 rounded-full bg-card px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200"><Icon name="lock" className="h-3.5 w-3.5" />Lock</button>
      } />
      <div className="space-y-5 px-4 pt-4">
        <div className="fade-up overflow-hidden rounded-3xl bg-card shadow-md ring-1 ring-slate-200/70">
          <div className="flex items-center gap-3 bg-gradient-to-r from-brand/15 to-[#060c11] p-4 text-white border-b border-line">
            <Avatar size={56} gender={me.gender} />
            <div className="min-w-0">
              <div className="font-display text-xl font-semibold">{me.name}</div>
              <div className="text-sm text-white/80">{me.id}</div>
              <div className="truncate text-xs text-white/65">{[me.dept, me.year].filter(Boolean).join(' · ')}</div>
            </div>
          </div>
          <div className="flex flex-col items-center px-4 pb-4 pt-5">
            <div className="rounded-2xl p-2 ring-1 ring-slate-200">
              <QR key={slot} text={qrCode(me.id, slot)} size={196} fade />
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Ring value={left} max={QR_PERIOD} size={44} stroke={4}><span className="text-sm font-bold tabular-nums text-slate-800">{Math.ceil(left)}</span></Ring>
              <div className="text-left">
                <div className="text-sm font-semibold text-slate-900">New code in {Math.ceil(left)} s</div>
                <div className="text-xs text-slate-500">Screenshots stop working in 10 seconds.</div>
              </div>
            </div>
            <div className="mt-2 font-mono text-[10px] text-slate-400">#{qrCode(me.id, slot).split('|')[3]} · {fmtTime(slot * QR_PERIOD * 1000, true)}</div>
          </div>
        </div>

        <DemoPanel title="Demo: gate scanner">
          <Btn className="w-full" icon="scan" onClick={() => setScan({ mode: 'ok' })}>Simulate gate scan <span className="font-normal opacity-80">(next: {nextDir})</span></Btn>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Btn v="outline" size="sm" onClick={() => setScan({ mode: 'expired' })}>Try screenshot QR</Btn>
            <Btn v="outline" size="sm" onClick={() => setScan({ mode: 'repeat' })}>Scan {myDir} again</Btn>
          </div>
          {aiSupported() && <Btn v="soft" size="sm" className="mt-2 w-full" icon="camera" onClick={() => setLiveGate(true)}>Live gate check with this camera (AI)</Btn>}
          <p className="mt-2 text-[11px] text-slate-500">Or hold this QR up to a webcam connected as CAM-G1 in the Guard app.</p>
        </DemoPanel>

        <div className="px-1">
          <SectionTitle>Pass history</SectionTitle>
          {myLog(s).length === 0 && <p className="px-1 text-sm text-slate-500">No scans yet.</p>}
          <div className="divide-y divide-line px-1">{myLog(s).slice(0, 8).map((l) => <LogRow key={l.id} l={l} now={now} />)}</div>
        </div>
      </div>

      {scan && (
        <ScanOverlay
          subtitle="Main Gate · Lane 2"
          title={scan.mode === 'expired' ? 'Scanning screenshot…' : 'Verifying you'}
          mode={scan.mode === 'expired' ? 'qr' : 'face'}
          steps={scan.mode === 'expired' ? ['Reading QR code', 'Checking code time'] : ['Reading rotating QR', 'Face match 1:1 with ID photo', 'Liveness check', 'Checking anti-passback']}
          duration={scan.mode === 'expired' ? 1600 : 2600}
          onDone={() => finishScan(scan.mode)}
        />
      )}
      {result && <ResultSheet {...result} onClose={() => setResult(null)} />}
      {liveGate && <GateCheckSheet onClose={() => setLiveGate(false)} />}
    </div>
  );
}

// The pass opens with the phone's fingerprint prompt, or the account password
// where there is no fingerprint (a browser, or none enrolled on the phone).
function IdLock({ onOpen }) {
  const { user } = useApp();
  const bio = useBiometric();
  const [mode, setMode] = useState(null); // null = fingerprint if available | 'password'
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const usePw = mode === 'password' || (bio.reason !== 'checking' && !bio.available);
  const touch = async () => {
    setErr(''); setBusy(true);
    try { if (await fingerprint('Open your Kavach ID', 'Touch the fingerprint sensor')) onOpen(); else setMode('password'); } catch (e) { setErr(e.message); setMode('password'); }
    setBusy(false);
  };
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    if (await checkPassword(user.email, pw)) onOpen(); else { setErr('Wrong password'); setBusy(false); }
  };
  return (
    <div className="flex min-h-full flex-col pb-10">
      <ScreenHeader title="My ID" sub="Your campus pass" />
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <h2 className="font-display text-2xl font-semibold text-slate-900">Your ID is locked</h2>
        <p className="mt-1 text-sm text-slate-500">Only you can open your pass.</p>
        {!usePw ? (
          <>
            <button type="button" onClick={touch} disabled={busy || bio.reason === 'checking'} aria-label="Unlock with fingerprint"
              className="relative mt-10 grid h-32 w-32 place-items-center rounded-full bg-brand/15 text-brand ring-1 ring-brand/40 transition active:scale-95 disabled:opacity-60">
              {busy && <span className="pulse-ring-html absolute inset-0 rounded-full bg-brand-100" />}
              <Icon name="fingerprint" className="relative h-16 w-16" sw={1.5} />
            </button>
            <p className="mt-4 text-sm font-medium text-slate-700">{busy ? 'Touch the sensor…' : 'Tap to unlock with fingerprint'}</p>
            <button type="button" onClick={() => setMode('password')} className="mt-8 text-sm font-semibold text-brand">Use password instead</button>
          </>
        ) : (
          <form onSubmit={submit} className="mt-8 w-full max-w-[300px] space-y-3 text-left">
            <input type="password" autoComplete="current-password" aria-label="Password" placeholder="Your Kavach password" value={pw} onChange={(e) => setPw(e.target.value)}
              className="h-12 w-full rounded-lg border border-white/15 bg-black/40 px-3.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none" />
            <Btn type="submit" className="w-full" icon="lock" disabled={busy || !pw}>{busy ? 'Checking…' : 'Open my ID'}</Btn>
            {bio.available
              ? <button type="button" onClick={() => { setMode(null); setErr(''); }} className="block w-full pt-2 text-center text-sm font-semibold text-brand">Use fingerprint</button>
              : <p className="pt-1 text-center text-xs text-slate-500">{bioHelp(bio)}</p>}
          </form>
        )}
        {err && <p className="mt-4 text-sm text-red-700" role="alert">{err}</p>}
      </div>
    </div>
  );
}

// ---------------- Saathi Walk ----------------
function SaathiWalk() {
  const { s } = useApp();
  const w = myWalk(s);
  if (!w) return <WalkIntro />;
  if (w.phase === 'arrived') return <WalkArrived />;
  return <WalkActive />;
}

function RouteSteps({ steps, now, live }) {
  const { s } = useApp();
  useVision();
  let prevTime = null;
  return (
    <ol className="relative">
      {steps.map((st, i) => {
        const cp = CP[st.cp];
        const last = i === steps.length - 1;
        const isNext = live && st.status !== 'passed' && (i === 0 || steps[i - 1].status === 'passed');
        const expected = isNext && prevTime ? prevTime + st.mins * MIN : null;
        if (st.status === 'passed') prevTime = st.time;
        const passed = st.status === 'passed';
        const missed = st.status === 'missed';
        return (
          <li key={st.cp} className="relative flex gap-3 pb-5 last:pb-0">
            {!last && <span className={cls('absolute left-[17px] top-9 h-[calc(100%-28px)] w-0.5', passed ? 'bg-emerald-400' : 'bg-slate-200')} />}
            <span className={cls('relative z-[1] grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-extrabold',
              passed ? 'bg-emerald-500 text-white' : missed ? 'bg-red-600 text-white' : isNext ? 'bg-accent text-ink' : 'bg-slate-100 text-slate-500')}>
              {isNext && !missed && <span className="pulse-soft absolute inset-0 rounded-full bg-accent" />}
              <span className="relative">{passed ? <Icon name="check" className="h-4 w-4" sw={3} /> : (cp.tag.length === 1 ? cp.tag : <Icon name="pin" className="h-4 w-4" />)}</span>
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-900">{cp.tag.length === 1 && st.cp !== 'GATE' ? `${cp.tag} · ` : ''}{cp.name}</span>
                {!live && <span className="text-xs font-medium text-slate-500">{i === 0 ? 'Start' : `${st.mins} min`}</span>}
              </div>
              {live && (
                <div className={cls('text-xs', passed ? 'text-emerald-700' : missed ? 'font-semibold text-red-600' : isNext ? 'text-amber-700' : 'text-slate-500')}>
                  {passed && (i === 0 ? `Started ${fmtTime(st.time)}` : `Passed ${cpShort(st.cp)}, ${fmtTime(st.time)}`)}
                  {missed && 'Missed. Guard alerted.'}
                  {!passed && !missed && (isNext ? `Expected by ${fmtTime(expected)} · ${st.mins} min` : `About ${st.mins} min`)}
                </div>
              )}
              <div className="mt-1 flex flex-wrap gap-1">
                {live && passed && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"><Icon name={st.snap ? 'camera' : 'check'} className="h-3 w-3" />{st.snap ? `Photo ${fmtTime(st.time)}` : `Checked in ${fmtTime(st.time)}`}</span>
                )}
                {(!live || !passed) && (() => {
                  const n = camsAt(st.cp).length; const on = camsAt(st.cp).filter((id) => camStatus(s, id) === 'online').length;
                  return <span className={cls('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', on ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}><Icon name="video" className="h-3 w-3" />{n} camera{n === 1 ? '' : 's'} · {on} connected</span>;
                })()}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function WalkIntro() {
  const { s, act, now } = useApp();
  const me = studentOf(s);
  const home = homeOf(me);
  const dests = [home, 'GATE'].filter(Boolean);
  const [pick, setPick] = useState(false);
  const [dest, setDest] = useState(dests[0]);
  const [share, setShare] = useState(false);
  const [femaleGuard, setFemaleGuard] = useState(me.gender === 'female');
  const [report, setReport] = useState(false);
  const r = ROUTES[dest];
  const total = r.steps.reduce((a, b) => a + b.mins, 0);
  const watcher = walkGuard(s, r, femaleGuard);
  const women = s.guards.some((g) => g.female);
  const live = CAMERAS.filter((c) => camStatus(s, c.id) === 'online').length;
  return (
    <div className="pb-10">
      <ScreenHeader title="Saathi Walk" sub="Night escort, checkpoint to checkpoint" />
      <div className="px-5 pt-8">
        <Icon name="moon" className="h-9 w-9 text-accent" />
        <h2 className="mt-3 font-display text-[26px] font-semibold leading-tight text-slate-900">Walking back late?<br />A Saathi walks with you.</h2>
        <p className="mt-2 text-sm text-slate-500">Guards see you only at checkpoints. Photos are deleted when you reach.</p>
      </div>
      <div className="mt-6 space-y-3 px-4">
        <Btn v="accent" size="lg" className="w-full text-lg" icon="walk" onClick={() => setPick(true)}>Help me get home</Btn>
        <Btn v="ghost" size="sm" className="w-full" icon="bulb" onClick={() => setReport(true)}>Report a dark spot or broken camera</Btn>
      </div>
      <div className="mt-8 space-y-2.5 px-5">
        <Note icon="users">
          {s.guards.length
            ? <>{s.guards.length} guard{s.guards.length === 1 ? '' : 's'} on duty: {s.guards.map((g) => `${g.name} (${g.post})`).join(', ')}.</>
            : 'No guard is signed in right now. Your walk and any alert go to the security office.'}
        </Note>
        <Note icon="video">{CAMERAS.length} cameras on campus, {live} connected now. They watch behaviour, not names.</Note>
        <Note icon="heart">Opt-in only · photos at checkpoints · deleted on arrival.</Note>
      </div>

      {report && (
        <Sheet title="Where is it?" onClose={() => setReport(false)}>
          <p className="-mt-1 mb-3 text-sm text-slate-500">Maintenance and security get it right away. Your name is not shared.</p>
          <div className="grid grid-cols-2 gap-2">
            {Object.values(CP).map((c) => (
              <button key={c.id} type="button" onClick={() => { act('reportDarkSpot', c.id); setReport(false); }}
                className="flex items-center gap-2 rounded-2xl bg-slate-50 p-3 text-left text-sm font-semibold text-slate-800 ring-1 ring-slate-200 hover:ring-brand">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-card text-xs font-extrabold text-brand ring-1 ring-brand/30">{c.tag}</span>{c.name}
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {pick && (
        <Sheet title="Where are you going?" onClose={() => setPick(false)} tall>
          <div className="space-y-2">
            {dests.map((k) => [k, ROUTES[k]]).map(([k, rt]) => (
              <button key={k} type="button" onClick={() => setDest(k)}
                className={cls('flex w-full items-center gap-3 rounded-2xl p-3 text-left ring-2 transition', dest === k ? 'bg-brand-50 ring-brand' : 'bg-card ring-slate-200')}>
                <span className={cls('grid h-10 w-10 place-items-center rounded-xl', dest === k ? 'bg-brand text-ink' : 'bg-slate-100 text-slate-500')}><Icon name={k === 'GATE' ? 'logout' : 'home'} /></span>
                <span className="flex-1"><span className="block font-semibold text-slate-900">{rt.dest}</span><span className="block text-xs text-slate-500">{rt.sub}</span></span>
                <span className="text-sm font-bold text-slate-700">{rt.steps.reduce((a, b) => a + b.mins, 0)} min</span>
              </button>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900">Your route</h4>
            <span className="text-xs text-slate-500">Starts at the Library walkway (A)</span>
          </div>
          <div className="mt-3 rounded-2xl bg-slate-50 p-4"><RouteSteps steps={r.steps} now={now} /></div>
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-50 p-3">
            <div className="text-sm"><div className="font-semibold text-slate-900">Share with a friend</div><div className="text-xs text-slate-500">They see your progress live</div></div>
            <Toggle on={share} onChange={setShare} label="Share with a friend" />
          </div>
          <div className="mt-2 flex items-center justify-between rounded-2xl bg-slate-50 p-3">
            <div className="text-sm"><div className="font-semibold text-slate-900">Prefer a female guard</div><div className="text-xs text-slate-500">{
              femaleGuard && !women ? 'No female guard on duty now. ' : ''}{watcher ? `Guard ${watcher.name} will watch your walk` : 'The security office will watch your walk'}</div></div>
            <Toggle on={femaleGuard} onChange={setFemaleGuard} label="Prefer a female guard" />
          </div>
          <Btn v="accent" size="lg" className="mt-4 w-full" icon="walk" onClick={() => act('startWalk', dest, share, { femaleGuard, snap: snapshotAt('A') })}>Start walk · {total} min</Btn>
        </Sheet>
      )}
    </div>
  );
}

function WalkActive() {
  const { s, act, now } = useApp();
  const [finalScan, setFinalScan] = useState(false);
  const [copied, setCopied] = useState(false);
  const w = myWalk(s);
  const r = ROUTES[w.dest];
  const g = guardById(s, w.guard);
  const last = lastPassed(w);
  const next = nextStep(w);
  const isFinal = next === w.steps[w.steps.length - 1];
  const find = (id) => id && s.alerts.find((a) => a.id === id);
  const sosA = find(w.sosAlert);
  const missA = find(w.missedAlert);
  const folA = find(w.followerAlert);
  const counting = w.missing && w.missing.stage === 'countdown';
  const busy = counting || (w.missing && w.missing.stage === 'prompt');

  const statusLine = (a) => !a ? '' : a.status === 'resolved' ? `Resolved${a.note ? ': ' + a.note : ''}` : a.status === 'accepted' ? `${a.acceptedName || guardById(s, a.acceptedBy).name} is on the way` : a.escalated ? 'Escalated to Security Head' : g.id ? `Waiting for ${g.name} to accept` : 'Waiting for a guard to accept';

  const copy = () => {
    try { navigator.clipboard && navigator.clipboard.writeText('https://' + w.link); } catch (e) { /* ignore */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="pb-32">
      <ScreenHeader title="Saathi Walk" sub={`To ${r.dest}`} right={<Badge className="bg-emerald-100 text-emerald-700"><LiveDot />LIVE</Badge>} />
      <div className="space-y-3 px-4 pt-4">
        <div className="rounded-3xl bg-gradient-to-br from-brand/15 to-[#060c11] ring-1 ring-brand/25 p-4 text-white shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-white/65">Walking to</div>
              <div className="text-lg font-bold">{r.dest}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-white/65">Started</div>
              <div className="font-semibold">{fmtTime(w.startedAt)}</div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-white/10 p-2.5 text-sm">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-accent font-bold text-ink">{g.id ? g.name[0] : <Icon name="shield" className="h-4 w-4" />}</span>
            <span className="flex-1">{g.id ? <>Guard on watch: <b>{g.name}</b></> : <>Watched by the <b>security office</b></>}</span>
          </div>
        </div>

        {sosA && sosA.status !== 'resolved' && (
          <Card className="fade-up border-0 bg-red-600 text-white ring-0">
            <div className="flex items-center gap-2 font-bold"><Icon name="siren" />SOS sent · {fmtTime(sosA.time)}</div>
            <p className="mt-1 text-sm text-red-100">High priority. Last checkpoint {cpShort(last.cp)}. {statusLine(sosA)}.</p>
            <Btn v="dark" size="sm" className="mt-3 w-full" onClick={() => act('cancelSos')}>I'm safe now, cancel SOS</Btn>
          </Card>
        )}

        {counting && (
          <Card className="fade-up flex items-center gap-3 bg-amber-50 ring-amber-200">
            <Ring value={Math.max(0, (w.missing.until - now) / 1000)} max={5} size={40} color="#d97706"><span className="text-xs font-bold">{Math.max(0, Math.ceil((w.missing.until - now) / 1000))}</span></Ring>
            <div className="text-sm text-amber-900"><b>Simulating: you went off route.</b><br />{CP[next.cp].name} not reached in time…</div>
          </Card>
        )}

        {missA && (
          <Card className={cls('fade-up', missA.status === 'resolved' ? 'bg-emerald-50 ring-emerald-200' : 'bg-red-50 ring-red-200')}>
            <div className={cls('flex items-center gap-2 font-bold', missA.status === 'resolved' ? 'text-emerald-800' : 'text-red-700')}><Icon name="bell" className="h-5 w-5" />{guardLabel(g)} alerted</div>
            <p className="mt-1 text-sm text-slate-700">{missA.detail.split('. Saathi')[0]}.</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{statusLine(missA)}</p>
          </Card>
        )}

        {folA && (
          <Card className="fade-up flex items-start gap-3 bg-violet-50 ring-violet-200">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-600 text-white"><Icon name="vibrate" className="h-5 w-5" /></span>
            <div className="text-sm">
              <div className="font-bold text-violet-900">Someone has been behind you for 3 checkpoints.</div>
              <div className="text-slate-600">{guardLabel(g)} notified. {statusLine(folA)}.</div>
            </div>
          </Card>
        )}

        <Card className="flex items-center gap-3">
          <CheckpointPhoto snap={last.snap} cam={camsAt(last.cp)[0]} time={last.time} className="h-16 w-24 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900"><Icon name={last.snap ? 'camera' : 'check'} className="h-4 w-4 text-brand" />{last.snap ? `Photo captured at checkpoint ${cpShort(last.cp)}` : `Checked in at checkpoint ${cpShort(last.cp)}`}</div>
            <div className="text-xs text-slate-500">{fmtTime(last.time, true)} · {last.snap ? 'deleted when you arrive' : 'no camera connected here, so no photo'}</div>
          </div>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold text-slate-900">Your route</h3>
            <span className="text-xs text-slate-500">{w.steps.filter((x) => x.status === 'passed').length} of {w.steps.length} checkpoints</span>
          </div>
          <RouteSteps steps={w.steps} now={now} live />
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div className="text-sm"><div className="font-semibold text-slate-900">Share with a friend</div><div className="text-xs text-slate-500">Live progress, no photos</div></div>
            <Toggle on={w.sharing} onChange={(v) => act('walkSharing', v)} label="Share with a friend" />
          </div>
          {w.sharing && (
            <div className="fade-up mt-3 flex items-center gap-2 rounded-xl bg-slate-50 p-2 pl-3 ring-1 ring-slate-200">
              <Icon name="link" className="h-4 w-4 text-slate-400" />
              <span className="flex-1 truncate font-mono text-xs text-slate-700">https://{w.link}</span>
              <Btn v="soft" size="sm" icon={copied ? 'check' : 'copy'} onClick={copy}>{copied ? 'Copied' : 'Copy'}</Btn>
            </div>
          )}
        </Card>

        <DemoPanel title="Demo: simulate the walk">
          <div className="space-y-2">
            <Btn v="success" className="w-full" icon={isFinal ? 'qr' : 'check'} disabled={counting}
              onClick={() => (isFinal ? setFinalScan(true) : act('passNext', snapshotAt(next.cp)))}>
              {isFinal ? `Scan ${r.finalScan} at ${cpShort(next.cp)}` : `Pass next checkpoint (${cpShort(next.cp)})`}
            </Btn>
            <div className="grid grid-cols-2 gap-2">
              <Btn v="outline" size="sm" icon="clock" disabled={busy || !!(missA && missA.status !== 'resolved')} onClick={() => act('goMissing')}>Go missing</Btn>
              <Btn v="outline" size="sm" disabled={!!(folA && folA.status !== 'resolved')} onClick={() => act('follower')}>Someone is following me</Btn>
            </div>
          </div>
        </DemoPanel>
      </div>

      {finalScan && (
        <ScanOverlay subtitle={CP[next.cp].name} title={`Scanning ${r.finalScan}`} mode="face" duration={2200}
          steps={[`Reading ${r.finalScan}`, 'Face match 1:1', 'Closing your walk']}
          onDone={() => { setFinalScan(false); act('passNext', snapshotAt(next.cp)); }} />
      )}
    </div>
  );
}

function AreYouOk() {
  const { s, act, now } = useApp();
  useBack(() => {}, true, BACK.block); // answer the question; back does not dismiss it
  const w = myWalk(s);
  const left = Math.max(0, Math.ceil((w.missing.until - now) / 1000));
  const next = nextStep(w);
  const g = guardById(s, w.guard);
  return (
    <div className="fade-in absolute inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-[#2a0711] to-ink px-6 text-center text-white">
      <Ring value={left} max={30} size={120} stroke={8} color="#F43F5E" track="rgba(255,255,255,.12)">
        <div><div className="text-4xl font-black tabular-nums">{left}</div><div className="text-[10px] uppercase tracking-wider text-white/65">seconds</div></div>
      </Ring>
      <h2 className="mt-6 font-display text-[40px] font-semibold">Are you OK?</h2>
      <p className="mt-2 text-white/80">You have not reached {CP[next.cp].name} ({cpShort(next.cp)}) on time.</p>
      <div className="mt-8 grid w-full max-w-[300px] gap-3">
        <Btn v="success" size="lg" className="h-16 text-lg" icon="check" onClick={() => act('answerOk')}>I'm OK</Btn>
        <Btn v="danger" size="lg" className="h-16 text-lg" icon="siren" onClick={() => act('sos')}>Help</Btn>
      </div>
      <p className="mt-6 text-xs text-white/65">No answer? {guardLabel(g)} gets your last photo and location.</p>
      <button type="button" className="mt-3 text-xs font-semibold text-accent underline" onClick={() => act('skipMissingTimer')}>Demo: skip timer</button>
    </div>
  );
}

function WalkArrived() {
  const { s, act } = useApp();
  const w = myWalk(s);
  const mins = Math.max(1, Math.round((w.arrivedAt - w.startedAt) / MIN));
  return (
    <div className="pb-28">
      <ScreenHeader title="Saathi Walk" sub="Walk complete" />
      <div className="flex flex-col items-center px-6 pt-8 text-center">
        <div className="pop grid h-24 w-24 place-items-center rounded-full bg-emerald-100 text-emerald-600 ring-8 ring-emerald-50">
          <Icon name="home" className="h-11 w-11" />
        </div>
        <h2 className="mt-5 font-display text-[26px] font-semibold text-slate-900">You reached safely.</h2>
        <p className="mt-1 flex items-center gap-1.5 font-semibold text-emerald-700"><Icon name="trash" className="h-4 w-4" />{w.photosDeleted ? `All ${w.photosDeleted} walk photo${w.photosDeleted === 1 ? '' : 's'} deleted.` : 'No photos were kept.'}</p>
        <p className="mt-1 text-sm text-slate-500">{ROUTES[w.dest].dest} · {fmtTime(w.arrivedAt)}</p>
      </div>
      <div className="mt-6 space-y-3 px-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[[`${mins} min`, 'Walk time'], [w.steps.length, 'Checkpoints'], [w.photosDeleted || 0, 'Photos deleted']].map(([v, k]) => (
            <Card key={k} className="px-2 py-3"><div className="text-xl font-extrabold text-slate-900">{v}</div><div className="text-xs text-slate-500">{k}</div></Card>
          ))}
        </div>
        <Card>
          <div className={cls('grid gap-2', w.steps.length === 4 ? 'grid-cols-4' : 'grid-cols-3')}>
            {w.steps.map((st) => (
              <div key={st.cp} className="text-center">
                <CheckpointPhoto cam={camsAt(st.cp)[0]} time={st.time || w.arrivedAt} deleted={st.hadPhoto} className="aspect-[4/3] w-full" />
                <div className="mt-1 text-[11px] font-semibold text-slate-600">{cpShort(st.cp)}</div>
              </div>
            ))}
          </div>
        </Card>
        <Btn className="w-full" onClick={() => act('closeWalk')}>Done</Btn>
      </div>
    </div>
  );
}

// ---------------- Lab (LabLedger) ----------------
function Lab() {
  const { s, act, now } = useApp();
  const [stage, setStage] = useState(null); // scanShelf | shelf | weighing
  const [picks, setPicks] = useState({});
  const [ret, setRet] = useState(null); // { issue, phase: 'scan' | 'result', missing }
  const [dispute, setDispute] = useState(null);
  const me = studentOf(s);
  const mine = s.issued.filter((i) => i.status === 'issued' && i.sid === me.id);
  const past = s.issued.filter((i) => i.status !== 'issued' && i.sid === me.id).slice(0, 4);
  const sessions = s.issued.filter((i) => i.rfid && i.sid === me.id).slice(0, 4);
  const count = Object.values(picks).reduce((a, b) => a + b, 0);
  const grams = Object.entries(picks).reduce((a, [id, q]) => a + q * (s.inventory.find((x) => x.id === id).gram || 0), 0);
  const disputed = (label) => s.disputes.some((d) => d.label === label);

  const startReturn = (issue, forceOk) => setRet({ issue, phase: 'scan', forceOk });
  const checkDone = () => {
    const is = ret.issue;
    const missing = !ret.forceOk && !is.rfid && is.qty > 1 && s.returnCount % 2 === 0 ? 1 : 0;
    if (!missing) act('returnItem', is.id, 0);
    setRet({ ...ret, phase: 'result', missing });
  };
  const item = (id) => s.inventory.find((x) => x.id === id);

  return (
    <div className="pb-28">
      <ScreenHeader title="LabLedger" sub="Electronics Lab · borrow and return" />
      <div className="space-y-4 px-4 pt-4">
        <button type="button" onClick={() => setStage('scanShelf')}
          className="flex w-full items-center gap-4 rounded-3xl bg-gradient-to-br from-brand/15 to-[#060c11] ring-1 ring-brand/25 p-5 text-left text-white shadow-md active:scale-[.99]">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/15"><Icon name="scan" className="h-7 w-7" /></span>
          <span className="flex-1">
            <span className="block text-lg font-bold">Scan QR at shelf</span>
            <span className="block text-sm text-white/80">Pick items, the shelf weighs and counts them</span>
          </span>
          <Icon name="chevR" />
        </button>

        <div>
          <SectionTitle>My issued items</SectionTitle>
          {mine.length === 0 && <p className="px-1 text-sm text-slate-500">Nothing with you right now.</p>}
          <div className="space-y-2">
            {mine.map((is) => (
              <Card key={is.id} className="fade-up flex items-center gap-3 p-3">
                <span className={cls('grid h-11 w-11 place-items-center rounded-xl', is.rfid ? 'bg-violet-100 text-violet-700' : 'bg-brand-100 text-brand')}><Icon name={is.rfid ? 'cpu' : 'box'} /></span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-900">{is.qty} × {is.name}</div>
                  <div className="text-xs text-slate-500">{fmtDay(is.time, now)}, {fmtTime(is.time)}{is.rfid ? ' · RFID tagged' : ''}</div>
                  <button type="button" className="text-xs font-semibold text-slate-400 hover:text-brand" onClick={() => setDispute(`${is.qty} × ${is.name} (${is.id})`)}>
                    {disputed(`${is.qty} × ${is.name} (${is.id})`) ? 'Dispute open' : 'Dispute'}
                  </button>
                </div>
                <Btn size="sm" v="soft" onClick={() => startReturn(is)}>Return</Btn>
              </Card>
            ))}
          </div>
        </div>

        <div>
          <SectionTitle>Instrument usage</SectionTitle>
          <div className="space-y-2">
            {sessions.length === 0 && <p className="px-1 text-sm text-slate-500">Instruments you take (RFID tagged) show here with their session times.</p>}
            {sessions.map((se) => {
              const label = `${se.name}, ${se.bench}, ${fmtDay(se.time, now)} ${fmtTime(se.time)}`;
              const inUse = se.status === 'issued';
              return (
                <Card key={se.id} className="p-3">
                  <div className="flex items-start gap-3">
                    <span className={cls('grid h-11 w-11 place-items-center rounded-xl', inUse ? 'bg-brand-100 text-brand' : 'bg-emerald-100 text-emerald-700')}><Icon name="activity" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-900">{se.name}, {se.bench}</div>
                      <div className="text-xs text-slate-500">From {fmtTime(se.time)}{inUse ? ' · in use now' : ` to ${fmtTime(se.returnedAt)} · returned`}</div>
                      <div className="mt-0.5 text-[11px] text-slate-400">{inUse ? 'Return it on the bench tray when done.' : 'No issues reported.'}</div>
                    </div>
                    <Btn size="sm" v="outline" icon="flag" onClick={() => setDispute(label)}>{disputed(label) ? 'Sent' : 'Dispute'}</Btn>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {past.length > 0 && (
          <div>
            <SectionTitle>Returned</SectionTitle>
            <div className="divide-y divide-line">
              {past.map((is) => (
                <div key={is.id} className="flex items-center gap-3 px-1 py-2.5 text-sm">
                  <Icon name={is.status === 'short' ? 'alert' : 'checkCircle'} className={cls('h-4 w-4', is.status === 'short' ? 'text-amber-500' : 'text-emerald-500')} />
                  <span className="flex-1 text-slate-700">{is.qty} × {is.name}</span>
                  <span className="text-xs text-slate-500">{is.status === 'short' ? `${is.missing} missing` : fmtDay(is.returnedAt, now)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {stage === 'scanShelf' && (
        <ScanOverlay subtitle="Electronics Lab" title="Scanning shelf QR" mode="qr" duration={1500}
          steps={['Reading shelf QR', 'Linking tray to your ID']} onDone={() => { setPicks({}); setStage('shelf'); }} />
      )}
      {stage === 'shelf' && (
        <Sheet title="Shelf E-3 / E-4" onClose={() => setStage(null)} tall>
          <p className="-mt-1 mb-3 text-sm text-slate-500">Take items from the tray. Set how many you took.</p>
          <div className="space-y-2">
            {s.inventory.map((it) => (
              <div key={it.id} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                <span className={cls('grid h-10 w-10 place-items-center rounded-xl', it.rfid ? 'bg-violet-100 text-violet-700' : 'bg-card text-brand ring-1 ring-slate-200')}><Icon name={it.rfid ? 'cpu' : 'box'} className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-900">{it.name}</div>
                  <div className="text-xs text-slate-500">{it.rfid ? (it.holder ? `Issued to ${it.holder}` : `RFID ${it.rfid} · ${it.bench}`) : `${it.stock} in stock`}</div>
                </div>
                {it.rfid ? (
                  <Btn size="sm" v={picks[it.id] ? 'success' : 'outline'} disabled={!!it.holder}
                    onClick={() => setPicks({ ...picks, [it.id]: picks[it.id] ? 0 : 1 })}>{picks[it.id] ? 'Taken' : 'Take'}</Btn>
                ) : (
                  <Stepper value={picks[it.id] || 0} max={Math.min(it.stock, 50)} onChange={(v) => setPicks({ ...picks, [it.id]: v })} />
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-brand-50 p-3 text-sm text-brand">
            <Icon name="activity" className="h-5 w-5" />
            <span className="flex-1">Weight sensor: <b className="tabular-nums">{grams.toFixed(1)} g</b> removed</span>
            <span className="font-semibold">{count} item{count === 1 ? '' : 's'}</span>
          </div>
          <Btn className="mt-3 w-full" size="lg" disabled={!count} onClick={() => setStage('weighing')}>Confirm and issue</Btn>
        </Sheet>
      )}
      {stage === 'weighing' && (
        <ScanOverlay subtitle="LabLedger" title="Counting your items" mode="weight" duration={2000}
          steps={['Weight sensor counting', 'Reading RFID tags', `Issuing to ${me.id}`]}
          onDone={() => { act('issueItems', picks); setStage(null); }} />
      )}

      {ret && ret.phase === 'scan' && (
        <ScanOverlay subtitle="Return tray" title={`Checking ${ret.issue.name}`} mode="weight" duration={2000}
          steps={ret.issue.rfid ? ['Reading RFID tag', 'Checking condition', 'Updating ledger'] : ['Weighing return tray', 'Counting items', 'Matching your issue']}
          onDone={checkDone} />
      )}
      {ret && ret.phase === 'result' && (ret.missing ? (
        <ResultSheet ok={false} title={`1 ${item(ret.issue.itemId).short} missing`}
          note={`Tray has ${ret.issue.qty - 1} of ${ret.issue.qty}. Check your bag or bench.`}
          rows={[['Expected', `${ret.issue.qty}`], ['Counted by weight', `${ret.issue.qty - 1}`, false]]}
          onClose={() => setRet(null)}
          actions={<>
            <Btn className="w-full" icon="refresh" onClick={() => startReturn(ret.issue, true)}>Found it, check again</Btn>
            <Btn v="outline" className="w-full" onClick={() => { act('returnItem', ret.issue.id, 1); setRet(null); }}>Return {ret.issue.qty - 1}, report 1 missing</Btn>
          </>} />
      ) : (
        <ResultSheet ok title="All items present ✓" note={`${ret.issue.qty} × ${ret.issue.name} returned`}
          rows={[['Counted', `${ret.issue.qty} of ${ret.issue.qty}`, true], ['Your account', 'Cleared', true]]}
          onClose={() => setRet(null)} />
      ))}

      {dispute && <DisputeSheet label={dispute} onClose={() => setDispute(null)} />}
    </div>
  );
}

function DisputeSheet({ label, onClose }) {
  const { act } = useApp();
  const [reason, setReason] = useState(null);
  const [text, setText] = useState('');
  return (
    <Sheet title="Raise a dispute" onClose={onClose}>
      <p className="text-sm text-slate-500">Record: <b className="text-slate-800">{label}</b></p>
      <div className="mt-3 flex flex-wrap gap-2">
        {DISPUTE_REASONS.map((r) => (
          <button key={r} type="button" onClick={() => setReason(r)}
            className={cls('rounded-full px-3 py-2 text-sm font-medium ring-1 transition', reason === r ? 'bg-brand text-ink ring-brand' : 'bg-card text-slate-700 ring-slate-300')}>{r}</button>
        ))}
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Add details (optional)"
        className="mt-3 w-full rounded-2xl border-0 bg-slate-50 p-3 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-brand" />
      <p className="mt-2 text-xs text-slate-500">Reviewed by the Lab In-charge and a student committee member within 3 days.</p>
      <Btn className="mt-3 w-full" disabled={!reason} onClick={() => { act('raiseDispute', label, reason + (text ? `: ${text}` : '')); onClose(); }}>Send dispute</Btn>
    </Sheet>
  );
}

// ---------------- Profile & privacy ----------------
function Profile() {
  const { s, reset, mode, pairing, openPair, signOut, removeMe } = useApp();
  const me = studentOf(s);
  const [page, setPage] = useState('main');
  if (page === 'data') return <MyData onBack={() => setPage('main')} />;
  if (page === 'face') return <FaceEnrolPage onBack={() => setPage('main')} />;
  const myDisputes = s.disputes.filter((x) => x.sid === me.id);
  return (
    <div className="pb-10">
      <div className="flex flex-col items-center px-5 pb-2 pt-8 text-center">
        <Avatar size={80} gender={me.gender} />
        <h2 className="mt-3 font-display text-2xl font-semibold text-slate-900">{me.name}</h2>
        <p className="text-sm text-slate-500">{me.email}</p>
      </div>

      <Facts className="mx-5 mt-4" rows={[
        ['USN', <span className="font-mono">{me.id}</span>],
        me.dept && ['Department', me.dept],
        me.year && ['Year', me.year],
        ['Stays at', `${(HOSTELS[me.hostel] || HOSTELS.day).label}${me.room ? `, room ${me.room}` : ''}`],
        me.phone && ['Mobile', me.phone],
      ]} />

      <div className="mt-6 space-y-3 px-4">
        <Card className="divide-y divide-line p-0">
          <FingerprintSetting />
          <ActionRow icon="camera" title="Face check at gates" sub="Enrol on this phone for 1:1 checks" onClick={() => setPage('face')} />
          <ActionRow icon="eye" title="My data and privacy" sub={myDisputes.length ? `${myDisputes.length} dispute${myDisputes.length === 1 ? '' : 's'} open` : 'What is stored and for how long'} onClick={() => setPage('data')} />
          <ActionRow icon="wifi" title="Campus hub" sub={mode === 'hub' ? `Paired with ${pairing.hub || pairing.url}` : 'Not paired. Pair with the security laptop'} onClick={openPair} />
        </Card>
        <Btn v="outline" className="w-full" icon="logout" onClick={signOut}>Log out</Btn>
        <div className="flex justify-center gap-5 pt-2 text-xs">
          <button type="button" className="text-slate-500 hover:text-slate-800" onClick={reset}>{mode === 'hub' ? "Clear this phone's data" : 'Clear campus data'}</button>
          <button type="button" className="text-red-700/80 hover:text-red-700" onClick={removeMe}>Remove account from this phone</button>
        </div>
      </div>
    </div>
  );
}

function MyData({ onBack }) {
  const { s, act } = useApp();
  const w = myWalk(s);
  const walkPhotos = w && w.phase === 'active' ? w.steps.filter((x) => x.status === 'passed').length : 0;
  const me = studentOf(s);
  const myLookups = s.audit.filter((a) => a.action.includes(me.id) || a.who.includes(me.id));
  const data = [
    ['Name, USN, department, email', 'To check it is you at checkpoints', 'While enrolled'],
    ['Password', 'Only a salted hash, on this phone', 'Until you remove the account'],
    ['Face template (encrypted)', 'Only a 1:1 match with your own ID', 'Deleted when you graduate'],
    ['Entry and exit log', `Headcount in emergencies · ${myLog(s).length} records now`, '30 days'],
    ['Saathi Walk photos', `Only during a walk · ${walkPhotos} stored now`, 'Deleted on arrival (max 12 h)'],
    ['Lab issue records', `${s.issued.filter((i) => i.sid === me.id).length} records`, 'Until returned + 1 semester'],
    ['Camera video between checkpoints', 'Behaviour AI only, no face search, no names', '7 days'],
  ];
  const promise = [
    ['No face database search.', 'Your face is only matched 1:1 with your own ID.'],
    ['Anonymous between checkpoints.', 'Cameras see behaviour, not names.'],
    ['Walks are opt-in.', 'Nothing is followed unless you start a Saathi Walk.'],
    ['Photos auto-deleted.', 'Walk photos are erased as soon as you arrive.'],
    ['Never for attendance or discipline.', 'Safety only. Written into college policy.'],
    ['Every view is logged.', 'Footage access needs a reason and is audited by the student committee.'],
  ];
  return (
    <div className="pb-28">
      <ScreenHeader title="My data" sub="Exactly what Kavach keeps about you" onBack={onBack} />
      <div className="space-y-4 px-4 pt-4">
        <div className="px-1">
          <SectionTitle>Our privacy promise</SectionTitle>
          <ul className="space-y-2.5">
            {promise.map(([b, t]) => (
              <li key={b} className="flex gap-2.5 text-sm">
                <Icon name="check" className="mt-0.5 h-4 w-4 text-emerald-500" sw={3} />
                <span><span className="font-medium text-slate-800">{b}</span> <span className="text-slate-500">{t}</span></span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <SectionTitle>What a campus camera sees</SectionTitle>
          <Card className="p-3">
            <CameraFeed camId="CAM-B1" />
            <p className="mt-2 text-sm text-slate-600">The AI gives people a temporary number like <b>#12 walking</b>, never a name. {CAMERAS.length} cameras, all shown below.</p>
            <div className="mt-2 overflow-hidden rounded-xl ring-1 ring-slate-200"><CampusMap showCams cams={s.cams} showGuards={false} /></div>
          </Card>
        </div>

        <div>
          <SectionTitle>What is stored</SectionTitle>
          <div className="divide-y divide-line px-1">
            {data.map(([k, why, keep]) => (
              <div key={k} className="py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm text-slate-800">{k}</span>
                  <span className="shrink-0 text-xs text-slate-500">{keep}</span>
                </div>
                <div className="mt-0.5 text-xs text-slate-500">{why}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <SectionTitle>Who looked at my data</SectionTitle>
          <div className="divide-y divide-line px-1">
            {myLookups.length === 0 && <p className="text-sm text-slate-500">No one, this month.</p>}
            {myLookups.slice(0, 4).map((a) => (
              <div key={a.id} className="py-2.5 text-sm">
                <div className="text-slate-800">{a.who}</div>
                <div className="text-xs text-slate-500">{a.action} · {fmtTime(a.time)}</div>
                <div className="text-xs italic text-slate-500">Reason: {a.reason}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Btn v="outline" size="sm" icon="download" onClick={() => act('notify', 'student', 'Your data export will be emailed within 24 h', 'success')}>Download my data</Btn>
          <Btn v="outline" size="sm" icon="trash" onClick={() => act('notify', 'student', 'Deletion request sent to the Data Officer', 'info')}>Request deletion</Btn>
        </div>
      </div>
    </div>
  );
}
