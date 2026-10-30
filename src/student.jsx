// Student app: Home, My ID, Saathi Walk, Lab (LabLedger), Profile.
import { useState } from 'react';
import {
  COLLEGE, CP, DISPUTE_REASONS, MIN, QR_PERIOD, ROUTES, STUDENT, cls, cpShort, fmtDay, fmtTime, qrCode,
} from './data.js';
import {
  answerOk, cancelSos, follower, gateScan, goMissing, guardById, issueItems, lastPassed, nextStep,
  passNext, raiseDispute, returnItem, sos, startWalk, toast, useApp,
} from './store.js';
import {
  Avatar, Badge, BottomNav, Btn, Card, DemoPanel, Icon, LiveDot, NightPhoto, QR, ResultSheet, Ring,
  ScanOverlay, ScreenHeader, SectionTitle, Sheet, Stepper, Toggle, useFastNow,
} from './ui.jsx';

export default function StudentApp() {
  const { s, mutate, now } = useApp();
  const [tab, setTab] = useState('home');
  const w = s.walk;
  const walking = w && w.phase === 'active';
  const sosOpen = walking && w.sosAlert && s.alerts.find((a) => a.id === w.sosAlert && a.status !== 'resolved');
  const showFollower = walking && w.followerAt && now - w.followerAt < 8000;

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
        <div className="shake absolute inset-x-3 top-14 z-40 flex items-start gap-3 rounded-2xl bg-slate-900 p-3.5 text-white shadow-2xl ring-2 ring-saffron">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-saffron text-slate-900"><Icon name="vibrate" className="h-5 w-5" /></span>
          <div className="text-sm">
            <div className="font-semibold">Someone has been behind you for 3 checkpoints.</div>
            <div className="mt-0.5 text-slate-300">Guard {guardById(s, w.guard).name} notified. Keep walking to a lit area.</div>
          </div>
        </div>
      )}

      {walking && (
        <button type="button" onClick={() => (sosOpen ? setTab('walk') : mutate(sos))} aria-label="SOS"
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

// ---------------- Home ----------------
function Home({ go }) {
  const { s, now } = useApp();
  const inside = s.gate.dir === 'IN';
  const lastGate = s.gate.log.find((l) => l.place === 'Main Gate');
  const w = s.walk;
  const hr = new Date(now).getHours();
  const greet = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  const mine = s.issued.filter((i) => i.status === 'issued');
  return (
    <div className="pb-28">
      <div className="rounded-b-[32px] bg-gradient-to-br from-navy to-navy-light px-5 pb-20 pt-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-blue-200">{greet},</div>
            <div className="text-2xl font-extrabold">{STUDENT.first} 👋</div>
          </div>
          <button type="button" onClick={() => go('profile')} aria-label="Profile"><Avatar size={46} /></button>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-blue-100">
          <Icon name="shieldCheck" className="h-4 w-4 text-saffron" /> Kavach protected · {COLLEGE}
        </div>
      </div>

      <div className="-mt-14 space-y-4 px-4">
        <Card className="fade-up">
          <div className="flex items-center gap-3">
            <span className={cls('grid h-11 w-11 place-items-center rounded-2xl', inside ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500')}>
              <Icon name={inside ? 'login' : 'logout'} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-slate-900">{inside ? 'You are inside campus' : 'You are outside campus'}</div>
              <div className="text-xs text-slate-500">Last gate scan: {lastGate.dir} · {fmtDay(lastGate.time, now)}, {fmtTime(lastGate.time)}</div>
            </div>
          </div>
          <Btn className="mt-3 w-full" icon="qr" onClick={() => go('id')}>Show my ID</Btn>
        </Card>

        {w && w.phase === 'active' && (
          <button type="button" onClick={() => go('walk')} className="fade-up flex w-full items-center gap-3 rounded-2xl bg-saffron p-4 text-left text-slate-900 shadow-sm">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/40"><Icon name="walk" /></span>
            <span className="flex-1">
              <span className="block font-bold">Saathi Walk in progress</span>
              <span className="block text-xs">To {ROUTES[w.dest].dest} · next: {nextStep(w) ? CP[nextStep(w).cp].name : 'arrived'}</span>
            </span>
            <Icon name="chevR" />
          </button>
        )}

        <div className="grid grid-cols-2 gap-3">
          {[
            { id: 'id', icon: 'qr', t: 'My ID', d: 'Rotating QR pass', c: 'bg-blue-100 text-navy' },
            { id: 'walk', icon: 'moon', t: 'Saathi Walk', d: 'Night escort home', c: 'bg-amber-100 text-amber-700' },
            { id: 'lab', icon: 'flask', t: 'LabLedger', d: `${mine.length} item${mine.length === 1 ? '' : 's'} with you`, c: 'bg-violet-100 text-violet-700' },
            { id: 'profile', icon: 'eye', t: 'My data', d: 'What we store', c: 'bg-emerald-100 text-emerald-700' },
          ].map((q) => (
            <button key={q.id} type="button" onClick={() => go(q.id)} className="rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200/70 transition hover:shadow-md active:scale-[.98]">
              <span className={cls('grid h-10 w-10 place-items-center rounded-xl', q.c)}><Icon name={q.icon} /></span>
              <span className="mt-3 block font-bold text-slate-900">{q.t}</span>
              <span className="block text-xs text-slate-500">{q.d}</span>
            </button>
          ))}
        </div>

        <Card className="flex items-start gap-3 bg-gradient-to-br from-blue-50 to-white">
          <Icon name="shield" className="mt-0.5 h-6 w-6 text-navy" />
          <div>
            <div className="font-bold text-slate-900">Identify at the doors, anonymous in between.</div>
            <p className="mt-0.5 text-sm text-slate-600">Cameras between checkpoints watch for danger, never for names.</p>
          </div>
        </Card>

        <div>
          <SectionTitle right={<button type="button" className="text-xs font-semibold text-navy" onClick={() => go('id')}>See all</button>}>Recent activity</SectionTitle>
          <Card className="divide-y divide-slate-100 p-0">
            {s.gate.log.slice(0, 3).map((l) => <LogRow key={l.id} l={l} now={now} />)}
          </Card>
        </div>
      </div>
    </div>
  );
}

function LogRow({ l, now }) {
  const isIn = l.dir === 'IN';
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className={cls('grid h-9 w-9 place-items-center rounded-xl', isIn ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600')}>
        <Icon name={isIn ? 'login' : 'logout'} className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-slate-900">{l.place}</div>
        <div className="text-xs text-slate-500">{fmtDay(l.time, now)} · {fmtTime(l.time)}</div>
      </div>
      <Badge className={isIn ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}>{l.dir}</Badge>
    </div>
  );
}

// ---------------- My ID ----------------
function MyId() {
  const { s, mutate, now } = useApp();
  const [lock, setLock] = useState('locked'); // locked | scanning | open
  const [scan, setScan] = useState(null); // { mode } while scanning
  const [result, setResult] = useState(null);
  const fast = useFastNow(200);
  const slot = Math.floor(fast / (QR_PERIOD * 1000));
  const left = QR_PERIOD - ((fast / 1000) % QR_PERIOD);
  const nextDir = s.gate.dir === 'IN' ? 'OUT' : 'IN';

  const unlock = () => {
    setLock('scanning');
    try { navigator.vibrate && navigator.vibrate(30); } catch (e) { /* ignore */ }
    setTimeout(() => setLock('open'), 1300);
  };

  const finishScan = (mode) => {
    const t = Date.now();
    if (mode === 'expired') {
      setResult({ ok: false, title: 'Rejected: code expired', note: `This code was made ${QR_PERIOD * 3 + Math.floor(((t / 1000) % QR_PERIOD))} s ago. Screenshots don't work.`, rows: [['QR code', 'Expired', false], ['Face check', 'Not started'], ['Entry logged', 'No', false]] });
    } else if (mode === 'repeat') {
      const d = s.gate.dir;
      setResult({ ok: false, title: d === 'IN' ? 'Already inside, scan OUT first' : 'Already outside, scan IN first', note: 'Anti-passback: one pass cannot be used twice in a row.', rows: [['QR code', 'Valid', true], ['Face matched (1:1)', 'Yes', true], [`Entry logged: ${d}`, 'Blocked', false]] });
    } else {
      mutate((d) => gateScan(d, nextDir));
      setResult({ ok: true, title: nextDir === 'IN' ? `Welcome in, ${STUDENT.first}!` : `Goodbye, ${STUDENT.first}!`, note: 'Main Gate · Lane 2', rows: [['Face matched (1:1)', '✓', true], ['Liveness', '✓', true], ['Entry logged', `${nextDir}, ${fmtTime(t)}`, true]] });
    }
    setScan(null);
  };

  if (lock !== 'open') {
    return (
      <div className="flex min-h-full flex-col pb-24">
        <ScreenHeader title="My ID" sub="Your campus pass" />
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="mb-2 grid h-14 w-14 place-items-center rounded-2xl bg-blue-100 text-navy"><Icon name="lock" className="h-7 w-7" /></div>
          <h2 className="text-xl font-bold text-slate-900">Your ID is locked</h2>
          <p className="mt-1 text-sm text-slate-500">Only you can open your pass.</p>
          <button type="button" onClick={unlock} disabled={lock === 'scanning'}
            className="relative mt-8 grid h-36 w-36 place-items-center rounded-full bg-white shadow-lg ring-1 ring-slate-200 transition active:scale-95">
            {lock === 'scanning' && <span className="pulse-ring-html absolute inset-0 rounded-full bg-blue-200" />}
            <span className="relative">
              <Icon name="fingerprint" className="h-20 w-20 text-slate-300" sw={1.5} />
              {lock === 'scanning' && <span className="fp-fill absolute inset-0 text-navy"><Icon name="fingerprint" className="h-20 w-20" sw={1.5} /></span>}
            </span>
          </button>
          <Btn className="mt-8 w-full max-w-[260px]" icon="fingerprint" onClick={unlock} disabled={lock === 'scanning'}>
            {lock === 'scanning' ? 'Reading fingerprint…' : 'Unlock with fingerprint'}
          </Btn>
          <button type="button" onClick={unlock} className="mt-3 text-sm font-medium text-slate-500 underline-offset-2 hover:underline">Use phone PIN instead</button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-28">
      <ScreenHeader title="My ID" sub="Show this at any checkpoint" right={
        <button type="button" onClick={() => setLock('locked')} className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200"><Icon name="lock" className="h-3.5 w-3.5" />Lock</button>
      } />
      <div className="space-y-4 px-4 pt-4">
        <div className="fade-up overflow-hidden rounded-3xl bg-white shadow-md ring-1 ring-slate-200/70">
          <div className="flex items-center gap-3 bg-gradient-to-r from-navy to-navy-light p-4 text-white">
            <Avatar size={56} />
            <div className="min-w-0">
              <div className="text-lg font-bold">{STUDENT.name}</div>
              <div className="text-sm text-blue-100">{STUDENT.id}</div>
              <div className="truncate text-xs text-blue-200">{STUDENT.dept} · {STUDENT.year}</div>
            </div>
          </div>
          <div className="flex flex-col items-center px-4 pb-4 pt-5">
            <div className="rounded-2xl p-2 ring-1 ring-slate-200">
              <QR key={slot} text={qrCode(STUDENT.id, slot)} size={196} fade />
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Ring value={left} max={QR_PERIOD} size={44} stroke={4}><span className="text-sm font-bold tabular-nums text-slate-800">{Math.ceil(left)}</span></Ring>
              <div className="text-left">
                <div className="text-sm font-semibold text-slate-900">New code in {Math.ceil(left)} s</div>
                <div className="text-xs text-slate-500">Screenshots stop working in 10 seconds.</div>
              </div>
            </div>
            <div className="mt-2 font-mono text-[10px] text-slate-400">#{qrCode(STUDENT.id, slot).split('|')[3]} · {fmtTime(slot * QR_PERIOD * 1000, true)}</div>
          </div>
        </div>

        <DemoPanel title="Demo: checkpoint scanner">
          <Btn className="w-full" icon="scan" onClick={() => setScan({ mode: 'ok' })}>Simulate gate scan <span className="font-normal opacity-80">(next: {nextDir})</span></Btn>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Btn v="outline" size="sm" onClick={() => setScan({ mode: 'expired' })}>Try screenshot QR</Btn>
            <Btn v="outline" size="sm" onClick={() => setScan({ mode: 'repeat' })}>Scan {s.gate.dir} again</Btn>
          </div>
        </DemoPanel>

        <div>
          <SectionTitle>Pass history</SectionTitle>
          <Card className="divide-y divide-slate-100 p-0">
            {s.gate.log.slice(0, 8).map((l) => <LogRow key={l.id} l={l} now={now} />)}
          </Card>
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
    </div>
  );
}

// ---------------- Saathi Walk ----------------
function SaathiWalk() {
  const { s } = useApp();
  const w = s.walk;
  if (!w) return <WalkIntro />;
  if (w.phase === 'arrived') return <WalkArrived />;
  return <WalkActive />;
}

function RouteSteps({ steps, now, live }) {
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
              passed ? 'bg-emerald-500 text-white' : missed ? 'bg-red-600 text-white' : isNext ? 'bg-saffron text-slate-900' : 'bg-slate-100 text-slate-500')}>
              {isNext && !missed && <span className="pulse-soft absolute inset-0 rounded-full bg-saffron" />}
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
              {live && passed && (
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"><Icon name="camera" className="h-3 w-3" />Photo {fmtTime(st.time)}</span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function WalkIntro() {
  const { mutate, now } = useApp();
  const [pick, setPick] = useState(false);
  const [dest, setDest] = useState('D');
  const [share, setShare] = useState(false);
  const r = ROUTES[dest];
  const total = r.steps.reduce((a, b) => a + b.mins, 0);
  return (
    <div className="pb-28">
      <ScreenHeader title="Saathi Walk" sub="Night escort, checkpoint to checkpoint" />
      <div className="space-y-4 px-4 pt-4">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0f1d4a] to-navy p-6 text-white shadow-md">
          {[[30, 20], [80, 40], [250, 26], [290, 60], [200, 14], [140, 50]].map(([x, y]) => (
            <span key={x} className="blink absolute h-1 w-1 rounded-full bg-white" style={{ left: x, top: y, animationDelay: `${x * 7}ms` }} />
          ))}
          <Icon name="moon" className="h-10 w-10 text-saffron" />
          <h2 className="mt-3 text-2xl font-extrabold leading-tight">Walking back late?<br />A Saathi walks with you.</h2>
          <p className="mt-2 text-sm text-blue-100">Guards see you only at checkpoints. Photos are deleted when you reach.</p>
          <Btn v="accent" size="lg" className="mt-5 w-full text-lg" icon="walk" onClick={() => setPick(true)}>Help me get home</Btn>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[['heart', 'Opt-in only'], ['camera', 'Photos at checkpoints'], ['trash', 'Deleted on arrival']].map(([ic, t]) => (
            <Card key={t} className="px-2 py-3"><Icon name={ic} className="mx-auto h-5 w-5 text-navy" /><div className="mt-1.5 text-xs font-semibold text-slate-700">{t}</div></Card>
          ))}
        </div>
        <Card className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><Icon name="users" /></span>
          <div className="text-sm text-slate-600"><b className="text-slate-900">3 guards on duty</b> tonight. Sunita is near Hostel D.</div>
        </Card>
      </div>

      {pick && (
        <Sheet title="Where are you going?" onClose={() => setPick(false)} tall>
          <div className="space-y-2">
            {Object.entries(ROUTES).map(([k, rt]) => (
              <button key={k} type="button" onClick={() => setDest(k)}
                className={cls('flex w-full items-center gap-3 rounded-2xl p-3 text-left ring-2 transition', dest === k ? 'bg-blue-50 ring-navy' : 'bg-white ring-slate-200')}>
                <span className={cls('grid h-10 w-10 place-items-center rounded-xl', dest === k ? 'bg-navy text-white' : 'bg-slate-100 text-slate-500')}><Icon name={k === 'D' ? 'home' : 'logout'} /></span>
                <span className="flex-1"><span className="block font-semibold text-slate-900">{rt.dest}</span><span className="block text-xs text-slate-500">{rt.sub}</span></span>
                <span className="text-sm font-bold text-slate-700">{rt.steps.reduce((a, b) => a + b.mins, 0)} min</span>
              </button>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900">Your route</h4>
            <span className="text-xs text-slate-500">Starts at Library (A), where you are</span>
          </div>
          <div className="mt-3 rounded-2xl bg-slate-50 p-4"><RouteSteps steps={r.steps} now={now} /></div>
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-50 p-3">
            <div className="text-sm"><div className="font-semibold text-slate-900">Share with a friend</div><div className="text-xs text-slate-500">They see your progress live</div></div>
            <Toggle on={share} onChange={setShare} label="Share with a friend" />
          </div>
          <Btn v="accent" size="lg" className="mt-4 w-full" icon="walk" onClick={() => mutate((d) => startWalk(d, dest, share))}>Start walk · {total} min</Btn>
        </Sheet>
      )}
    </div>
  );
}

function WalkActive() {
  const { s, mutate, now } = useApp();
  const [finalScan, setFinalScan] = useState(false);
  const [copied, setCopied] = useState(false);
  const w = s.walk;
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

  const statusLine = (a) => !a ? '' : a.status === 'resolved' ? `Resolved${a.note ? ': ' + a.note : ''}` : a.status === 'accepted' ? `${guardById(s, a.acceptedBy).name} is on the way` : a.escalated ? 'Escalated to Security Head' : `Waiting for ${g.name} to accept`;

  const copy = () => {
    try { navigator.clipboard && navigator.clipboard.writeText('https://' + w.link); } catch (e) { /* ignore */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="pb-32">
      <ScreenHeader title="Saathi Walk" sub={`To ${r.dest}`} right={<Badge className="bg-emerald-100 text-emerald-700"><LiveDot />LIVE</Badge>} />
      <div className="space-y-3 px-4 pt-4">
        <div className="rounded-3xl bg-gradient-to-br from-[#0f1d4a] to-navy p-4 text-white shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-blue-200">Walking to</div>
              <div className="text-lg font-bold">{r.dest}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-blue-200">Started</div>
              <div className="font-semibold">{fmtTime(w.startedAt)}</div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-white/10 p-2.5 text-sm">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-saffron font-bold text-slate-900">{g.name[0]}</span>
            <span className="flex-1">Guard on watch: <b>{g.name}</b></span>
            <Icon name="phone" className="h-4 w-4 text-blue-200" />
          </div>
        </div>

        {sosA && sosA.status !== 'resolved' && (
          <Card className="fade-up border-0 bg-red-600 text-white ring-0">
            <div className="flex items-center gap-2 font-bold"><Icon name="siren" />SOS sent · {fmtTime(sosA.time)}</div>
            <p className="mt-1 text-sm text-red-100">High priority. Last checkpoint {cpShort(last.cp)}. {statusLine(sosA)}.</p>
            <Btn v="dark" size="sm" className="mt-3 w-full" onClick={() => mutate(cancelSos)}>I'm safe now, cancel SOS</Btn>
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
            <div className={cls('flex items-center gap-2 font-bold', missA.status === 'resolved' ? 'text-emerald-800' : 'text-red-700')}><Icon name="bell" className="h-5 w-5" />Guard {g.name} alerted</div>
            <p className="mt-1 text-sm text-slate-700">{missA.detail.split('. Saathi')[0]}.</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{statusLine(missA)}</p>
          </Card>
        )}

        {folA && (
          <Card className="fade-up flex items-start gap-3 bg-violet-50 ring-violet-200">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-600 text-white"><Icon name="vibrate" className="h-5 w-5" /></span>
            <div className="text-sm">
              <div className="font-bold text-violet-900">Someone has been behind you for 3 checkpoints.</div>
              <div className="text-slate-600">Guard {g.name} notified. {statusLine(folA)}.</div>
            </div>
          </Card>
        )}

        <Card className="flex items-center gap-3">
          <NightPhoto cp={last.cp} time={last.time} className="h-16 w-24" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900"><Icon name="camera" className="h-4 w-4 text-navy" />Photo captured at checkpoint {cpShort(last.cp)}</div>
            <div className="text-xs text-slate-500">{fmtTime(last.time, true)} · deleted when you arrive</div>
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
            <Toggle on={w.sharing} onChange={(v) => mutate((d) => { d.walk.sharing = v; })} label="Share with a friend" />
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
              onClick={() => (isFinal ? setFinalScan(true) : mutate(passNext))}>
              {isFinal ? `Scan ${r.finalScan} at ${cpShort(next.cp)}` : `Pass next checkpoint (${cpShort(next.cp)})`}
            </Btn>
            <div className="grid grid-cols-2 gap-2">
              <Btn v="outline" size="sm" icon="clock" disabled={busy || !!(missA && missA.status !== 'resolved')} onClick={() => mutate(goMissing)}>Go missing</Btn>
              <Btn v="outline" size="sm" disabled={!!(folA && folA.status !== 'resolved')} onClick={() => mutate(follower)}>Someone is following me</Btn>
            </div>
          </div>
        </DemoPanel>
      </div>

      {finalScan && (
        <ScanOverlay subtitle={CP[next.cp].name} title={`Scanning ${r.finalScan}`} mode="face" duration={2200}
          steps={[`Reading ${r.finalScan}`, 'Face match 1:1', 'Closing your walk']}
          onDone={() => { setFinalScan(false); mutate(passNext); }} />
      )}
    </div>
  );
}

function AreYouOk() {
  const { s, mutate, now } = useApp();
  const w = s.walk;
  const left = Math.max(0, Math.ceil((w.missing.until - now) / 1000));
  const next = nextStep(w);
  const g = guardById(s, w.guard);
  return (
    <div className="fade-in absolute inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-[#0f1d4a] to-slate-950 px-6 text-center text-white">
      <Ring value={left} max={30} size={120} stroke={8} color="#F59E0B" track="rgba(255,255,255,.15)">
        <div><div className="text-4xl font-black tabular-nums">{left}</div><div className="text-[10px] uppercase tracking-wider text-blue-200">seconds</div></div>
      </Ring>
      <h2 className="mt-6 text-4xl font-black">Are you OK?</h2>
      <p className="mt-2 text-blue-100">You have not reached {CP[next.cp].name} ({cpShort(next.cp)}) on time.</p>
      <div className="mt-8 grid w-full max-w-[300px] gap-3">
        <Btn v="success" size="lg" className="h-16 text-lg" icon="check" onClick={() => mutate(answerOk)}>I'm OK</Btn>
        <Btn v="danger" size="lg" className="h-16 text-lg" icon="siren" onClick={() => mutate(sos)}>Help</Btn>
      </div>
      <p className="mt-6 text-xs text-blue-200">No answer? Guard {g.name} gets your last photo and location.</p>
      <button type="button" className="mt-3 text-xs font-semibold text-saffron underline" onClick={() => mutate((d) => { d.walk.missing.until = Date.now(); })}>Demo: skip timer</button>
    </div>
  );
}

function WalkArrived() {
  const { s, mutate } = useApp();
  const w = s.walk;
  const mins = Math.max(1, Math.round((w.arrivedAt - w.startedAt) / MIN));
  return (
    <div className="pb-28">
      <ScreenHeader title="Saathi Walk" sub="Walk complete" />
      <div className="flex flex-col items-center px-6 pt-8 text-center">
        <div className="pop grid h-24 w-24 place-items-center rounded-full bg-emerald-100 text-emerald-600 ring-8 ring-emerald-50">
          <Icon name="home" className="h-11 w-11" />
        </div>
        <h2 className="mt-5 text-2xl font-extrabold text-slate-900">You reached safely.</h2>
        <p className="mt-1 flex items-center gap-1.5 font-semibold text-emerald-700"><Icon name="trash" className="h-4 w-4" />All walk photos deleted.</p>
        <p className="mt-1 text-sm text-slate-500">{ROUTES[w.dest].dest} · {fmtTime(w.arrivedAt)}</p>
      </div>
      <div className="mt-6 space-y-3 px-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[[`${mins} min`, 'Walk time'], [w.steps.length, 'Checkpoints'], ['0', 'Photos kept']].map(([v, k]) => (
            <Card key={k} className="px-2 py-3"><div className="text-xl font-extrabold text-slate-900">{v}</div><div className="text-xs text-slate-500">{k}</div></Card>
          ))}
        </div>
        <Card>
          <div className="grid grid-cols-4 gap-2">
            {w.steps.map((st) => (
              <div key={st.cp} className="text-center">
                <NightPhoto cp={st.cp} time={st.time || w.arrivedAt} deleted className="aspect-[4/3] w-full" />
                <div className="mt-1 text-[11px] font-semibold text-slate-600">{cpShort(st.cp)}</div>
              </div>
            ))}
          </div>
        </Card>
        <Btn className="w-full" onClick={() => mutate((d) => { d.walk = null; })}>Done</Btn>
      </div>
    </div>
  );
}

// ---------------- Lab (LabLedger) ----------------
function Lab() {
  const { s, mutate, now } = useApp();
  const [stage, setStage] = useState(null); // scanShelf | shelf | weighing
  const [picks, setPicks] = useState({});
  const [ret, setRet] = useState(null); // { issue, phase: 'scan' | 'result', missing }
  const [dispute, setDispute] = useState(null);
  const mine = s.issued.filter((i) => i.status === 'issued');
  const past = s.issued.filter((i) => i.status !== 'issued').slice(0, 4);
  const count = Object.values(picks).reduce((a, b) => a + b, 0);
  const grams = Object.entries(picks).reduce((a, [id, q]) => a + q * (s.inventory.find((x) => x.id === id).gram || 0), 0);
  const disputed = (label) => s.disputes.some((d) => d.label === label);

  const startReturn = (issue, forceOk) => setRet({ issue, phase: 'scan', forceOk });
  const checkDone = () => {
    const is = ret.issue;
    const missing = !ret.forceOk && !is.rfid && is.qty > 1 && s.returnCount % 2 === 0 ? 1 : 0;
    if (!missing) mutate((d) => returnItem(d, is.id, 0));
    setRet({ ...ret, phase: 'result', missing });
  };
  const item = (id) => s.inventory.find((x) => x.id === id);

  return (
    <div className="pb-28">
      <ScreenHeader title="LabLedger" sub="Electronics Lab · borrow and return" />
      <div className="space-y-4 px-4 pt-4">
        <button type="button" onClick={() => setStage('scanShelf')}
          className="flex w-full items-center gap-4 rounded-3xl bg-gradient-to-br from-navy to-navy-light p-5 text-left text-white shadow-md active:scale-[.99]">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/15"><Icon name="scan" className="h-7 w-7" /></span>
          <span className="flex-1">
            <span className="block text-lg font-bold">Scan QR at shelf</span>
            <span className="block text-sm text-blue-100">Pick items, the shelf weighs and counts them</span>
          </span>
          <Icon name="chevR" />
        </button>

        <div>
          <SectionTitle>My issued items</SectionTitle>
          {mine.length === 0 && <Card className="text-center text-sm text-slate-500">Nothing with you right now.</Card>}
          <div className="space-y-2">
            {mine.map((is) => (
              <Card key={is.id} className="fade-up flex items-center gap-3 p-3">
                <span className={cls('grid h-11 w-11 place-items-center rounded-xl', is.rfid ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-navy')}><Icon name={is.rfid ? 'cpu' : 'box'} /></span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-900">{is.qty} × {is.name}</div>
                  <div className="text-xs text-slate-500">{fmtDay(is.time, now)}, {fmtTime(is.time)}{is.rfid ? ' · RFID tagged' : ''}</div>
                  <button type="button" className="text-xs font-semibold text-slate-400 hover:text-navy" onClick={() => setDispute(`${is.qty} × ${is.name} (${is.id})`)}>
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
            {s.sessions.map((se) => {
              const label = `${se.label}, ${se.bench}, ${se.day} ${se.slot}`;
              return (
                <Card key={se.id} className="p-3">
                  <div className="flex items-start gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><Icon name="activity" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-900">{se.label}, {se.bench}</div>
                      <div className="text-xs text-slate-500">Your session {se.day === 'Today' ? '' : se.day + ' '}{se.slot}: <span className="font-semibold text-emerald-700">normal ✓</span></div>
                      <div className="mt-0.5 text-[11px] text-slate-400">Power and usage pattern looked normal. No damage flagged.</div>
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
            <Card className="divide-y divide-slate-100 p-0">
              {past.map((is) => (
                <div key={is.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <Icon name={is.status === 'short' ? 'alert' : 'checkCircle'} className={cls('h-4 w-4', is.status === 'short' ? 'text-amber-500' : 'text-emerald-500')} />
                  <span className="flex-1 text-slate-700">{is.qty} × {is.name}</span>
                  <span className="text-xs text-slate-500">{is.status === 'short' ? `${is.missing} missing` : fmtDay(is.returnedAt, now)}</span>
                </div>
              ))}
            </Card>
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
                <span className={cls('grid h-10 w-10 place-items-center rounded-xl', it.rfid ? 'bg-violet-100 text-violet-700' : 'bg-white text-navy ring-1 ring-slate-200')}><Icon name={it.rfid ? 'cpu' : 'box'} className="h-5 w-5" /></span>
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
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-blue-50 p-3 text-sm text-navy">
            <Icon name="activity" className="h-5 w-5" />
            <span className="flex-1">Weight sensor: <b className="tabular-nums">{grams.toFixed(1)} g</b> removed</span>
            <span className="font-semibold">{count} item{count === 1 ? '' : 's'}</span>
          </div>
          <Btn className="mt-3 w-full" size="lg" disabled={!count} onClick={() => setStage('weighing')}>Confirm and issue</Btn>
        </Sheet>
      )}
      {stage === 'weighing' && (
        <ScanOverlay subtitle="LabLedger" title="Counting your items" mode="weight" duration={2000}
          steps={['Weight sensor counting', 'Reading RFID tags', `Issuing to ${STUDENT.id}`]}
          onDone={() => { mutate((d) => issueItems(d, picks)); setStage(null); }} />
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
            <Btn v="outline" className="w-full" onClick={() => { mutate((d) => returnItem(d, ret.issue.id, 1)); setRet(null); }}>Return {ret.issue.qty - 1}, report 1 missing</Btn>
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
  const { mutate } = useApp();
  const [reason, setReason] = useState(null);
  const [text, setText] = useState('');
  return (
    <Sheet title="Raise a dispute" onClose={onClose}>
      <p className="text-sm text-slate-500">Record: <b className="text-slate-800">{label}</b></p>
      <div className="mt-3 flex flex-wrap gap-2">
        {DISPUTE_REASONS.map((r) => (
          <button key={r} type="button" onClick={() => setReason(r)}
            className={cls('rounded-full px-3 py-2 text-sm font-medium ring-1 transition', reason === r ? 'bg-navy text-white ring-navy' : 'bg-white text-slate-700 ring-slate-300')}>{r}</button>
        ))}
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Add details (optional)"
        className="mt-3 w-full rounded-2xl border-0 bg-slate-50 p-3 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-navy" />
      <p className="mt-2 text-xs text-slate-500">Reviewed by the Lab In-charge and a student committee member within 3 days.</p>
      <Btn className="mt-3 w-full" disabled={!reason} onClick={() => { mutate((d) => raiseDispute(d, label, reason + (text ? `: ${text}` : ''))); onClose(); }}>Send dispute</Btn>
    </Sheet>
  );
}

// ---------------- Profile & privacy ----------------
function Profile() {
  const { s, reset } = useApp();
  const [page, setPage] = useState('main');
  if (page === 'data') return <MyData onBack={() => setPage('main')} />;
  const rows = [
    ['idcard', 'Student ID', STUDENT.id],
    ['flask', 'Department', STUDENT.dept],
    ['user', 'Year', STUDENT.year],
    ['home', 'Hostel', STUDENT.hostel],
    ['phone', 'Phone', STUDENT.phone],
  ];
  return (
    <div className="pb-28">
      <div className="rounded-b-[32px] bg-gradient-to-br from-navy to-navy-light px-5 pb-6 pt-6 text-center text-white">
        <Avatar size={84} className="mx-auto ring-4" />
        <h2 className="mt-3 text-xl font-bold">{STUDENT.name}</h2>
        <p className="text-sm text-blue-100">{STUDENT.dept} · {STUDENT.year}</p>
        <Badge className="mt-2 bg-white/15 text-white"><Icon name="shieldCheck" className="h-3.5 w-3.5 text-saffron" />Verified student</Badge>
      </div>
      <div className="space-y-4 px-4 pt-4">
        <Card className="divide-y divide-slate-100 p-0">
          {rows.map(([ic, k, v]) => (
            <div key={k} className="flex items-center gap-3 px-4 py-3">
              <Icon name={ic} className="h-4 w-4 text-slate-400" />
              <span className="w-24 text-sm text-slate-500">{k}</span>
              <span className="min-w-0 flex-1 truncate text-right text-sm font-semibold text-slate-900">{v}</span>
            </div>
          ))}
        </Card>
        <Card className="divide-y divide-slate-100 p-0">
          {[
            { ic: 'eye', t: 'My data and privacy', d: 'What is stored and for how long', go: () => setPage('data') },
            { ic: 'flag', t: 'My disputes', d: s.disputes.length ? `${s.disputes.length} open` : 'None open', go: () => setPage('data') },
            { ic: 'refresh', t: 'Reset demo', d: 'Restore all mock data', go: reset },
          ].map((x) => (
            <button key={x.t} type="button" onClick={x.go} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-navy"><Icon name={x.ic} className="h-4 w-4" /></span>
              <span className="flex-1"><span className="block text-sm font-semibold text-slate-900">{x.t}</span><span className="block text-xs text-slate-500">{x.d}</span></span>
              <Icon name="chevR" className="h-4 w-4 text-slate-400" />
            </button>
          ))}
        </Card>
      </div>
    </div>
  );
}

function MyData({ onBack }) {
  const { s, mutate } = useApp();
  const w = s.walk;
  const walkPhotos = w && w.phase === 'active' ? w.steps.filter((x) => x.status === 'passed').length : 0;
  const myLookups = s.audit.filter((a) => a.action.includes(STUDENT.id) || a.who.includes(STUDENT.id));
  const data = [
    ['Name, ID, department, photo', 'To check it is you at checkpoints', 'While enrolled'],
    ['Face template (encrypted)', 'Only a 1:1 match with your own ID', 'Deleted when you graduate'],
    ['Entry and exit log', `Headcount in emergencies · ${s.gate.log.length} records now`, '30 days'],
    ['Saathi Walk photos', `Only during a walk · ${walkPhotos} stored now`, 'Deleted on arrival (max 12 h)'],
    ['Lab issue records', `${s.issued.length} records`, 'Until returned + 1 semester'],
    ['Camera video between checkpoints', 'Anonymous, faces blurred, no names', '7 days'],
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
        <div className="rounded-3xl bg-gradient-to-br from-navy to-navy-light p-5 text-white shadow-md">
          <div className="flex items-center gap-2 text-saffron"><Icon name="shieldCheck" /><span className="text-sm font-bold uppercase tracking-wider">Our privacy promise</span></div>
          <ul className="mt-3 space-y-2.5">
            {promise.map(([b, t]) => (
              <li key={b} className="flex gap-2.5 text-sm">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-400 text-navy"><Icon name="check" className="h-3 w-3" sw={3.5} /></span>
                <span><b>{b}</b> <span className="text-blue-100">{t}</span></span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <SectionTitle>What is stored</SectionTitle>
          <Card className="divide-y divide-slate-100 p-0">
            {data.map(([k, why, keep]) => (
              <div key={k} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900">{k}</span>
                  <Badge className="shrink-0 bg-blue-50 text-navy"><Icon name="clock" className="h-3 w-3" />{keep}</Badge>
                </div>
                <div className="mt-0.5 text-xs text-slate-500">{why}</div>
              </div>
            ))}
          </Card>
        </div>

        <div>
          <SectionTitle>Who looked at my data</SectionTitle>
          <Card className="divide-y divide-slate-100 p-0">
            {myLookups.length === 0 && <div className="p-4 text-sm text-slate-500">No one, this month.</div>}
            {myLookups.slice(0, 4).map((a) => (
              <div key={a.id} className="px-4 py-3 text-sm">
                <div className="font-semibold text-slate-900">{a.who}</div>
                <div className="text-xs text-slate-500">{a.action} · {fmtTime(a.time)}</div>
                <div className="text-xs italic text-slate-500">Reason: {a.reason}</div>
              </div>
            ))}
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Btn v="outline" size="sm" icon="download" onClick={() => mutate((d) => toast(d, 'student', 'Your data export will be emailed within 24 h', 'success'))}>Download my data</Btn>
          <Btn v="outline" size="sm" icon="trash" onClick={() => mutate((d) => toast(d, 'student', 'Deletion request sent to the Data Officer', 'info'))}>Request deletion</Btn>
        </div>
      </div>
    </div>
  );
}
