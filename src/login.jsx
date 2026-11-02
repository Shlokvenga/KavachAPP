// Sign-in for the phone edition: log in, create an account (@kletech.ac.in only),
// fingerprint login, and the lock shown when the app opens with fingerprint login on.
import { useEffect, useState } from 'react';
import { DEPTS, EMAIL_DOMAIN, GENDER, HOSTELS, POSTS, YEARS, cls } from './data.js';
import {
  checkPassword, fingerprintOn, listAccounts, login, loginWithFingerprint, register, setFingerprint,
} from './auth.js';
import { biometricStatus, fingerprint } from './native.js';
import { BACK, useBack } from './back.js';
import { useApp } from './ctx.js';
import { Avatar, Btn, Icon, Logo, Toggle } from './ui.jsx';

export function useBiometric() {
  const [bio, setBio] = useState({ available: false, reason: 'checking' });
  useEffect(() => { let on = true; biometricStatus().then((b) => on && setBio(b)); return () => { on = false; }; }, []);
  return bio;
}

const BIO_HELP = {
  'none-enrolled': 'Add a fingerprint in Android Settings → Security to use it here.',
  'no-hardware': 'This phone has no fingerprint sensor.',
  unavailable: 'The fingerprint sensor is not available right now.',
  web: 'Fingerprint works in the Android app.',
  checking: '',
};
export const bioHelp = (b) => BIO_HELP[b.reason] || '';

// ---------- form bits ----------
const inputCls = 'h-12 w-full rounded-xl bg-slate-100 px-3.5 text-[15px] text-slate-900 ring-1 ring-line placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand';

function Field({ label, error, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-slate-600">{label}</span>
      {children}
      {(error || hint) && <span className={cls('mt-1 block text-xs', error ? 'text-red-700' : 'text-slate-500')}>{error || hint}</span>}
    </label>
  );
}

function Choice({ value, onChange, options, label }) {
  return (
    <div className="flex gap-1.5" role="radiogroup" aria-label={label}>
      {options.map(([k, l]) => (
        <button key={k} type="button" role="radio" aria-checked={value === k} onClick={() => onChange(k)}
          className={cls('h-11 flex-1 rounded-xl px-2 text-sm font-semibold ring-1 transition',
            value === k ? 'bg-brand text-ink ring-brand' : 'bg-slate-100 text-slate-600 ring-line')}>{l}</button>
      ))}
    </div>
  );
}

function Shell({ children, onBack, title }) {
  return (
    <div className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto bg-ink">
      {onBack ? (
        <div className="sticky top-0 z-10 flex items-center gap-2 bg-ink/90 px-3 py-3 backdrop-blur">
          <button type="button" aria-label="Back" onClick={onBack} className="grid h-10 w-10 place-items-center rounded-full text-slate-700 hover:bg-slate-100"><Icon name="chevL" /></button>
          <h1 className="font-display text-lg font-semibold text-slate-900">{title}</h1>
        </div>
      ) : (
        <div className="flex flex-col items-center px-6 pb-2 pt-12 text-center">
          <Logo className="h-14 w-14" />
          <div className="mt-3 font-display text-2xl font-bold uppercase tracking-[.1em] text-slate-900">Kavach</div>
          <div className="mt-1 text-xs text-slate-500">Campus safety · KLE Technological University</div>
        </div>
      )}
      <div className="mx-auto w-full max-w-[420px] flex-1 px-5 pb-10">{children}</div>
    </div>
  );
}

// ---------- sign-in flow ----------
export function AuthScreen({ onSignedIn }) {
  const [view, setView] = useState('login'); // login | register | fingerprint
  const [user, setUser] = useState(null);
  const done = (u) => { setUser(u); setView('fingerprint'); };
  if (view === 'register') return <Register onBack={() => setView('login')} onDone={done} />;
  if (view === 'fingerprint') return <OfferFingerprint user={user} onDone={() => onSignedIn(user)} />;
  return <Login onRegister={() => setView('register')} onDone={done} onFingerprint={onSignedIn} />;
}

function Login({ onRegister, onDone, onFingerprint }) {
  const saved = listAccounts();
  const [email, setEmail] = useState(saved[0] ? saved[0].email : '');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const bio = useBiometric();

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try { onDone(await login(email, pw)); } catch (x) { setErr(x.message); setBusy(false); }
  };
  const withFinger = async (acc) => {
    setErr('');
    try {
      if (await fingerprint('Log in to Kavach', acc.email)) onFingerprint(loginWithFingerprint(acc.email));
    } catch (x) { setErr(x.message); }
  };
  const quick = saved.filter((a) => a.fingerprint && bio.available);

  return (
    <Shell>
      {quick.length > 0 && (
        <div className="mt-6 space-y-2">
          {quick.map((a) => (
            <button key={a.email} type="button" onClick={() => withFinger(a)}
              className={cls('flex w-full items-center gap-3 rounded-2xl bg-card p-3 text-left ring-1 ring-line transition hover:ring-brand active:scale-[.99]', a.profile.role === 'student' && GENDER[a.profile.gender].theme)}>
              <Avatar size={40} gender={a.profile.gender} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-slate-900">{a.profile.name}</span>
                <span className="block truncate text-xs text-slate-500">{a.profile.role === 'guard' ? 'Guard' : 'Student'} · {a.email}</span>
              </span>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-brand text-ink"><Icon name="fingerprint" /></span>
            </button>
          ))}
          <div className="flex items-center gap-3 pt-3 text-[11px] uppercase tracking-wider text-slate-400"><span className="h-px flex-1 bg-line" />or use your password<span className="h-px flex-1 bg-line" /></div>
        </div>
      )}
      <form onSubmit={submit} className={cls('space-y-4', quick.length ? 'mt-3' : 'mt-8')}>
        <Field label="College email">
          <input className={inputCls} type="email" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false}
            placeholder={`name@${EMAIL_DOMAIN}`} value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Password">
          <input className={inputCls} type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required />
        </Field>
        {err && <p className="text-sm text-red-700" role="alert">{err}</p>}
        <Btn type="submit" className="w-full" disabled={busy || !email || !pw}>{busy ? 'Signing in…' : 'Log in'}</Btn>
      </form>
      <div className="mt-8 text-center text-sm text-slate-500">
        New to Kavach?{' '}
        <button type="button" onClick={onRegister} className="font-semibold text-brand">Create an account</button>
      </div>
      <p className="mt-10 text-center text-[11px] leading-relaxed text-slate-400">Your account stays on this phone. You stay signed in until you log out.</p>
    </Shell>
  );
}

function Register({ onBack, onDone }) {
  useBack(onBack, true, BACK.page);
  const [f, setF] = useState({ role: 'student', name: '', email: '', gender: '', usn: '', dept: '', year: '', hostel: '', room: '', post: '', phone: '', password: '', password2: '' });
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => {
    const val = v && v.target ? v.target.value : v;
    setF((x) => {
      const n = { ...x, [k]: val };
      // suggest the hostel that matches
      if (k === 'gender' && !x.hostel && n.role === 'student') n.hostel = val === 'male' ? 'boys' : 'girls';
      return n;
    });
    if (errs[k]) setErrs((e) => ({ ...e, [k]: undefined }));
  };
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { onDone(await register(f)); } catch (x) { setErrs(x.fields || { form: x.message }); setBusy(false); }
  };
  const student = f.role === 'student';
  return (
    <Shell onBack={onBack} title="Create account">
      <form onSubmit={submit} className="mt-2 space-y-4" noValidate>
        <Field label="I am a">
          <Choice label="Role" value={f.role} onChange={set('role')} options={[['student', 'Student'], ['guard', 'Security guard']]} />
        </Field>
        <Field label="Full name" error={errs.name}>
          <input className={inputCls} autoComplete="name" value={f.name} onChange={set('name')} />
        </Field>
        <Field label="College email" error={errs.email} hint={`Only @${EMAIL_DOMAIN} addresses`}>
          <input className={inputCls} type="email" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false}
            placeholder={`name@${EMAIL_DOMAIN}`} value={f.email} onChange={set('email')} />
        </Field>
        <Field label="Gender" error={errs.gender} hint={student ? 'Sets your theme and your hostel route' : 'Students can ask for a female guard'}>
          <Choice label="Gender" value={f.gender} onChange={set('gender')} options={[['female', 'Female'], ['male', 'Male']]} />
        </Field>
        {student ? (
          <>
            <Field label="USN" error={errs.usn}>
              <input className={cls(inputCls, 'font-mono uppercase')} autoCapitalize="characters" spellCheck={false} placeholder="01FE21BCS045" value={f.usn} onChange={set('usn')} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Department" error={errs.dept}>
                <select className={inputCls} value={f.dept} onChange={set('dept')}>
                  <option value="">Choose…</option>
                  {DEPTS.map((d) => <option key={d}>{d}</option>)}
                </select>
              </Field>
              <Field label="Year" error={errs.year}>
                <select className={inputCls} value={f.year} onChange={set('year')}>
                  <option value="">Choose…</option>
                  {YEARS.map((y) => <option key={y}>{y}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Where you stay" error={errs.hostel}>
              <Choice label="Hostel" value={f.hostel} onChange={set('hostel')} options={Object.entries(HOSTELS).map(([k, h]) => [k, h.label])} />
            </Field>
            {f.hostel && f.hostel !== 'day' && (
              <Field label="Room (optional)">
                <input className={inputCls} value={f.room} onChange={set('room')} placeholder="214" />
              </Field>
            )}
          </>
        ) : (
          <Field label="Post" error={errs.post} hint="Alerts and Saathi Walks near your post come to you">
            <Choice label="Post" value={f.post} onChange={set('post')} options={Object.entries(POSTS).map(([k, p]) => [k, p.label])} />
          </Field>
        )}
        <Field label="Mobile (optional)" error={errs.phone}>
          <input className={inputCls} type="tel" inputMode="tel" autoComplete="tel" placeholder="98450 12345" value={f.phone} onChange={set('phone')} />
        </Field>
        <Field label="Password" error={errs.password} hint="At least 8 characters">
          <input className={inputCls} type="password" autoComplete="new-password" value={f.password} onChange={set('password')} />
        </Field>
        <Field label="Confirm password" error={errs.password2}>
          <input className={inputCls} type="password" autoComplete="new-password" value={f.password2} onChange={set('password2')} />
        </Field>
        {errs.form && <p className="text-sm text-red-700" role="alert">{errs.form}</p>}
        {Object.values(errs).some(Boolean) && !errs.form && <p className="text-sm text-red-700" role="alert">Some details need fixing.</p>}
        <Btn type="submit" className="w-full" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</Btn>
      </form>
    </Shell>
  );
}

function OfferFingerprint({ user, onDone }) {
  const bio = useBiometric();
  const [err, setErr] = useState('');
  useEffect(() => {
    if (bio.reason === 'checking') return;
    if (!bio.available || fingerprintOn(user.email)) onDone();
  }, [bio, user, onDone]);
  if (!bio.available || fingerprintOn(user.email)) return <div className="flex-1 bg-ink" />;
  const enable = async () => {
    setErr('');
    try {
      if (await fingerprint('Turn on fingerprint login', 'Touch the sensor to confirm')) { setFingerprint(user.email, true); onDone(); }
    } catch (x) { setErr(x.message); }
  };
  return (
    <Shell>
      <div className="mt-10 flex flex-col items-center text-center">
        <span className="grid h-20 w-20 place-items-center rounded-full bg-brand/15 text-brand ring-1 ring-brand/40"><Icon name="fingerprint" className="h-10 w-10" sw={1.6} /></span>
        <h2 className="mt-5 font-display text-2xl font-semibold text-slate-900">Use your fingerprint?</h2>
        <p className="mt-2 text-sm text-slate-500">Open Kavach and your ID with your fingerprint instead of typing your password.</p>
      </div>
      {err && <p className="mt-4 text-center text-sm text-red-700">{err}</p>}
      <div className="mt-8 space-y-2">
        <Btn className="w-full" icon="fingerprint" onClick={enable}>Turn on fingerprint login</Btn>
        <Btn v="ghost" className="w-full" onClick={onDone}>Not now</Btn>
      </div>
    </Shell>
  );
}

// Shown when the app opens with fingerprint login on.
export function LockScreen({ user, onUnlock, onLogout }) {
  const [mode, setMode] = useState('finger'); // finger | password
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const bio = useBiometric();
  const ask = async () => {
    setErr('');
    try {
      if (await fingerprint('Unlock Kavach', user.email)) onUnlock();
      else setMode('password');
    } catch (x) { setErr(x.message); setMode('password'); }
  };
  useEffect(() => {
    if (bio.reason === 'checking') return;
    if (bio.available) ask(); else setMode('password');
  }, [bio.reason]); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    if (await checkPassword(user.email, pw)) onUnlock();
    else { setErr('Wrong password'); setBusy(false); }
  };
  return (
    <div className={cls('flex min-h-0 flex-1 flex-col items-center overflow-y-auto bg-ink px-6 pt-16 text-center', user.role === 'student' && GENDER[user.gender].theme)}>
      <Avatar size={72} gender={user.gender} />
      <div className="mt-4 font-display text-xl font-semibold text-slate-900">{user.name}</div>
      <div className="text-xs text-slate-500">{user.email}</div>
      {mode === 'finger' ? (
        <button type="button" onClick={ask} className="mt-14 grid h-24 w-24 place-items-center rounded-full bg-brand/15 text-brand ring-1 ring-brand/40 active:scale-95" aria-label="Unlock with fingerprint">
          <Icon name="fingerprint" className="h-12 w-12" sw={1.5} />
        </button>
      ) : (
        <form onSubmit={submit} className="mt-10 w-full max-w-[320px] space-y-3 text-left">
          <Field label="Password">
            <input className={inputCls} type="password" autoComplete="current-password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} />
          </Field>
          <Btn type="submit" className="w-full" disabled={busy || !pw}>{busy ? 'Checking…' : 'Unlock'}</Btn>
        </form>
      )}
      {err && <p className="mt-4 text-sm text-red-700">{err}</p>}
      <div className="mt-8 flex gap-6 text-sm">
        {mode === 'password' && bio.available && <button type="button" className="font-semibold text-brand" onClick={ask}>Use fingerprint</button>}
        {mode === 'finger' && <button type="button" className="font-semibold text-brand" onClick={() => setMode('password')}>Use password</button>}
        <button type="button" className="text-slate-500" onClick={onLogout}>Log out</button>
      </div>
    </div>
  );
}

// ---------- account settings shared by the Student profile and the Guard app ----------
export function FingerprintSetting() {
  const { user } = useApp();
  const bio = useBiometric();
  const [on, setOn] = useState(() => fingerprintOn(user.email));
  const [err, setErr] = useState('');
  const change = async (v) => {
    setErr('');
    if (!v) { setFingerprint(user.email, false); setOn(false); return; }
    try {
      if (await fingerprint('Turn on fingerprint login', 'Touch the sensor to confirm')) { setFingerprint(user.email, true); setOn(true); }
    } catch (x) { setErr(x.message); }
  };
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand"><Icon name="fingerprint" className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-900">Fingerprint login</span>
        <span className={cls('block text-xs', err ? 'text-red-700' : 'text-slate-500')}>{err || (bio.available ? 'Open Kavach and your ID with your fingerprint' : bioHelp(bio))}</span>
      </span>
      <Toggle on={on && bio.available} onChange={change} label="Fingerprint login" disabled={!bio.available} />
    </div>
  );
}
