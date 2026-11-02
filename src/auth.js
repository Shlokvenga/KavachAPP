// Accounts on this phone. Only @kletech.ac.in addresses can register. Each account
// is kept on the device (localStorage, which the Android app keeps until it is
// uninstalled) with a salted PBKDF2 hash of the password, never the password itself.
// The sign-in stays until the person logs out. Fingerprint login is per account and
// uses the phone's own fingerprint prompt (src/native.js).
// The public part of the profile (no hash) is shared with the campus through the
// actions, so guards and the security laptop know who a pass or a walk belongs to.
import { EMAIL_DOMAIN, HOSTELS, POSTS, hash } from './data.js';
import { fromHex, pbkdf2, randomBytes, toHex } from './sha256.js';

const ACCOUNTS = 'kavach-accounts';
const SESSION = 'kavach-session';
const ITERATIONS = 20000;

const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (e) { return d; } };
const write = (k, v) => {
  try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {
    throw new Error('This phone could not save your account (storage full or blocked).');
  }
};

export const normEmail = (e) => String(e || '').trim().toLowerCase();
const EMAIL_RE = new RegExp(`^[a-z0-9._%+-]+@${EMAIL_DOMAIN.replace(/\./g, '\\.')}$`);
export const validEmail = (e) => EMAIL_RE.test(normEmail(e));
export const USN_RE = /^[A-Z0-9]{6,12}$/; // same as the pass format (data.js verifyQr)

const accounts = () => read(ACCOUNTS, {});
const hashPw = (pw, saltHex, iter = ITERATIONS) => toHex(pbkdf2(pw, fromHex(saltHex), iter));
// let the screen show "Signing in…" before the hash runs
const later = (fn) => new Promise((ok, no) => setTimeout(() => { try { ok(fn()); } catch (e) { no(e); } }, 30));

export function listAccounts() {
  return Object.entries(accounts()).map(([email, a]) => ({ email, profile: a.profile, fingerprint: !!a.fingerprint, lastLogin: a.lastLogin || 0 }))
    .sort((a, b) => b.lastLogin - a.lastLogin);
}

function startSession(email) {
  const all = accounts();
  all[email].lastLogin = Date.now();
  write(ACCOUNTS, all);
  write(SESSION, { email, at: Date.now() });
  return all[email].profile;
}

// The signed-in profile, or null.
export function currentUser() {
  const s = read(SESSION, null);
  const a = s && accounts()[s.email];
  return a ? a.profile : null;
}

export function logout() { write(SESSION, null); }

export function validate(f) {
  const errs = {};
  if (!validEmail(f.email)) errs.email = `Use your college email (name@${EMAIL_DOMAIN})`;
  else if (accounts()[normEmail(f.email)]) errs.email = 'An account with this email is already on this phone. Log in instead.';
  if (String(f.name || '').trim().length < 2) errs.name = 'Enter your full name';
  if (!f.gender) errs.gender = 'Choose one';
  if (String(f.password || '').length < 8) errs.password = 'At least 8 characters';
  else if (f.password !== f.password2) errs.password2 = 'Passwords do not match';
  if (f.role === 'student') {
    const usn = String(f.usn || '').trim().toUpperCase();
    if (!USN_RE.test(usn)) errs.usn = 'USN as on your ID card, e.g. 01FE21BCS045';
    else if (Object.values(accounts()).some((x) => x.profile.id === usn)) errs.usn = 'This USN already has an account on this phone';
    if (!f.dept) errs.dept = 'Choose your department';
    if (!f.year) errs.year = 'Choose your year';
    if (!HOSTELS[f.hostel]) errs.hostel = 'Choose one';
  } else if (!POSTS[f.post]) errs.post = 'Choose your post';
  if (f.phone && !/^\+?[0-9 ]{10,15}$/.test(f.phone.trim())) errs.phone = 'Enter a 10-digit mobile number';
  return errs;
}

export function register(f) {
  const errs = validate(f);
  if (Object.keys(errs).length) return Promise.reject(Object.assign(new Error('Check the form'), { fields: errs }));
  return later(() => {
    const email = normEmail(f.email);
    const name = f.name.trim().replace(/\s+/g, ' ');
    const profile = {
      id: f.role === 'student' ? f.usn.trim().toUpperCase() : 'G' + hash(email),
      role: f.role, email, name, first: name.split(' ')[0], gender: f.gender, phone: (f.phone || '').trim(),
      ...(f.role === 'student'
        ? { dept: f.dept, year: f.year, hostel: f.hostel, room: (f.room || '').trim() }
        : { post: f.post }),
      created: Date.now(),
    };
    const salt = toHex(randomBytes(16));
    const all = accounts();
    all[email] = { profile, salt, iter: ITERATIONS, hash: hashPw(f.password, salt), fingerprint: false };
    write(ACCOUNTS, all);
    return startSession(email);
  });
}

export function checkPassword(email, password) {
  return later(() => {
    const a = accounts()[normEmail(email)];
    return !!a && hashPw(password, a.salt, a.iter) === a.hash;
  });
}

export async function login(email, password) {
  const e = normEmail(email);
  if (!validEmail(e)) throw new Error(`Use your college email (name@${EMAIL_DOMAIN})`);
  if (!accounts()[e]) throw new Error('No account with this email on this phone. Create one first.');
  if (!(await checkPassword(e, password))) throw new Error('Wrong password');
  return startSession(e);
}

// Call only after the phone's fingerprint prompt succeeded.
export function loginWithFingerprint(email) {
  const a = accounts()[normEmail(email)];
  if (!a || !a.fingerprint) throw new Error('Fingerprint login is not turned on for this account');
  return startSession(normEmail(email));
}

export function setFingerprint(email, on) {
  const all = accounts();
  const a = all[normEmail(email)];
  if (!a) return;
  a.fingerprint = !!on;
  write(ACCOUNTS, all);
}
export const fingerprintOn = (email) => !!(accounts()[normEmail(email)] || {}).fingerprint;

export function removeAccount(email) {
  const e = normEmail(email);
  const all = accounts();
  delete all[e];
  write(ACCOUNTS, all);
  const s = read(SESSION, null);
  if (s && s.email === e) write(SESSION, null);
}
