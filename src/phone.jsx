// Phone edition (the Android app and the phone web app): sign in, then the Student
// or Guard app for that account. The Admin console is in the laptop edition
// (src/laptop.jsx), served by the hub.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GENDER, cls, pad } from './data.js';
import { AppCtx, useApp } from './ctx.js';
import { useKavach } from './useKavach.js';
import { parsePairText } from './sync.js';
import { PairSheet, SyncChip, loadDeviceName } from './pair.jsx';
import { currentUser, fingerprintOn, logout, removeAccount } from './auth.js';
import { isNative, moveToBackground, onBackButton } from './native.js';
import { BACK, runBack, useBack } from './back.js';
import { AuthScreen, LockScreen } from './login.jsx';
import { Logo, Toasts } from './ui.jsx';
import StudentApp from './student.jsx';
import GuardApp from './guard.jsx';

const APPS = { student: StudentApp, guard: GuardApp };

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

// A pairing link (the QR on the laptop, opened by the phone's camera app) pairs at once.
function pairFromUrl() {
  const p = parsePairText(location.href);
  if (p) { try { history.replaceState(null, '', location.pathname); } catch (e) { /* ignore */ } }
  return p;
}

function App() {
  const [user, setUser] = useState(() => currentUser());
  // with fingerprint login on, the app asks for it each time it starts
  const [locked, setLocked] = useState(() => !!user && isNative() && fingerprintOn(user.email));
  const [pairOpen, setPairOpen] = useState(() => pairFromUrl());
  const native = isNative();
  const wide = useMedia('(min-width: 768px)') && !native;
  const me = user && !locked ? user : null;
  const role = me ? me.role : null;

  const k = useKavach({ edition: 'phone', role, me, deviceName: loadDeviceName(role === 'guard' ? 'Guard phone' : 'Student phone') });
  const { act, actAs, s } = k;

  // Android back: close what is open, go back a page, return to Home; at the very
  // start, move the app to the background (it stays signed in) instead of quitting.
  useEffect(() => onBackButton(() => { if (!runBack()) moveToBackground(); }), []);
  useBack(() => setPairOpen(false), !!pairOpen, BACK.sheet);

  // make sure the campus (and the hub) knows who is signed in; a guard goes on duty
  const known = !!(me && s.users[me.id]);
  useEffect(() => { if (me && !known) act('hello'); }, [me, known, act]);

  const signOut = useCallback(() => {
    if (!window.confirm('Log out of Kavach on this phone?')) return;
    act('signOut');
    logout();
    setUser(null);
  }, [act]);
  const removeMe = useCallback(() => {
    if (!user || !window.confirm(`Remove ${user.email} from this phone? You will need to create the account again to use it here.`)) return;
    act('signOut');
    removeAccount(user.email);
    setUser(null);
  }, [act, user]);
  const lockLogout = useCallback(() => { actAs(user, 'signOut'); logout(); setUser(null); setLocked(false); }, [actAs, user]);
  const openPair = useCallback(() => setPairOpen(true), []);

  const ctx = useMemo(() => ({ ...k, role, user: me, signOut, removeMe, roles: role ? [role] : [], openPair }), [k, role, me, signOut, removeMe, openPair]);

  let screen;
  if (!user) screen = <AuthScreen onSignedIn={(u) => { setUser(u); setLocked(false); }} />;
  else if (locked) screen = <LockScreen user={user} onUnlock={() => setLocked(false)} onLogout={lockLogout} />;
  else { const RoleApp = APPS[user.role] || StudentApp; screen = <RoleApp />; }

  const theme = me && me.role === 'student' ? GENDER[me.gender].theme : null;
  return (
    <AppCtx.Provider value={ctx}>
      {wide ? (
        <div className="desk-bg flex min-h-screen flex-col items-center">
          <header className="flex w-full max-w-[1240px] items-center gap-3 px-6 py-4">
            <Logo className="h-9 w-9" />
            <span className="flex-1">
              <span className="block font-display text-xl font-bold uppercase leading-none tracking-[.08em] text-brand">Kavach</span>
              <span className="block text-[11px] font-medium text-slate-500">Phone edition · open it on a phone, or install the Android app</span>
            </span>
            <SyncChip onClick={openPair} className="h-9" />
          </header>
          <Phone framed theme={theme} role={role}>{screen}</Phone>
        </div>
      ) : (
        <Phone theme={theme} role={role}>{screen}</Phone>
      )}
      {pairOpen && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 md:items-center">
          <div data-phone="pair" className="relative flex h-[100dvh] w-full max-w-[420px] flex-col overflow-hidden bg-ink md:h-[min(820px,92vh)] md:rounded-[32px]">
            <PairSheet onClose={() => setPairOpen(false)} initial={typeof pairOpen === 'object' ? pairOpen : null} />
          </div>
        </div>
      )}
    </AppCtx.Provider>
  );
}

function Phone({ framed, theme, role, children }) {
  const { s } = useApp();
  const allToasts = s.toasts.filter((t) => t.role === 'all');
  // Overlays (sheets, camera viewer, prompts) are absolutely positioned inside the
  // content box below the status bar, so they never hide under it.
  const inner = (
    <div data-phone={role || 'signin'} className={cls('flex h-full w-full flex-col overflow-hidden bg-slate-50', theme, !framed && 'pt-[env(safe-area-inset-top)]')}>
      {framed && <StatusBar />}
      <div className="relative flex min-h-0 flex-1 flex-col">
        {children}
        {role && <Toasts role={role} />}
        {allToasts.length > 0 && (
          <div className="toast-in absolute inset-x-3 top-2 z-[70] rounded-2xl bg-emerald-600 px-3.5 py-3 text-sm font-medium text-white shadow-xl">
            {allToasts[allToasts.length - 1].msg}
          </div>
        )}
      </div>
    </div>
  );
  if (!framed) return <div className="h-[100dvh] w-full">{inner}</div>;
  return (
    <div className="relative shrink-0 rounded-[48px] bg-black p-[10px] shadow-[0_30px_80px_-20px_rgba(0,229,255,.18)] ring-1 ring-line"
      style={{ width: 384, height: 'min(820px, calc(100vh - 104px))', minHeight: 640 }}>
      <div className="h-full w-full overflow-hidden rounded-[38px]">{inner}</div>
      <div className="pointer-events-none absolute left-1/2 top-[18px] z-[80] h-[24px] w-[92px] -translate-x-1/2 rounded-full bg-ink" />
    </div>
  );
}

function StatusBar() {
  const { now } = useApp();
  const d = new Date(now);
  return (
    <div className="relative z-[75] flex h-11 shrink-0 items-center justify-between bg-ink px-7 pt-1 text-[13px] font-semibold text-white">
      <span className="tabular-nums">{d.getHours() % 12 || 12}:{pad(d.getMinutes())}</span>
      <span className="flex items-center gap-1.5">
        <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor" aria-hidden="true"><rect x="0" y="7" width="3" height="4" rx="1" /><rect x="4.5" y="5" width="3" height="6" rx="1" /><rect x="9" y="2.5" width="3" height="8.5" rx="1" /><rect x="13.5" y="0" width="3" height="11" rx="1" /></svg>
        <svg width="25" height="12" viewBox="0 0 25 12" fill="none" aria-hidden="true"><rect x=".5" y=".5" width="21" height="11" rx="3" stroke="currentColor" opacity=".5" /><rect x="2" y="2" width="15" height="8" rx="1.8" fill="currentColor" /><rect x="22.5" y="4" width="2" height="4" rx="1" fill="currentColor" opacity=".5" /></svg>
      </span>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
