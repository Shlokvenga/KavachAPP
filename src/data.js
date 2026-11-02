// Constants, campus setup and small helpers. There is no pre-filled activity:
// every alert, scan, walk, visitor and statistic comes from what happens in the app.
import { CAMERAS, CHECKPOINTS, GUARD_POSTS, camsAt } from './campus.js';

export const MIN = 60 * 1000;
export const HOUR = 60 * MIN;
export const ESCALATE_MS = 2 * MIN;
export const QR_PERIOD = 10; // seconds

// People are real accounts (see src/auth.js). The signed-in person on this device
// is s.me; everyone who has used Kavach is in s.users, and guards on duty are in
// s.guards. Female students get the pink theme, male students the blue one.
export const EMAIL_DOMAIN = 'kletech.ac.in';
export const HOSTELS = {
  girls: { label: 'Girls Hostel', home: 'D' },
  boys: { label: 'Boys Hostel', home: 'E' },
  day: { label: 'Day scholar', home: null },
};
export const POSTS = {
  gate: { label: 'Main Gate', ...GUARD_POSTS.gate },
  girls: { label: 'Girls Hostel', ...GUARD_POSTS.girls },
  boys: { label: 'Boys Hostel', ...GUARD_POSTS.boys },
};
export const DEPTS = [
  'Computer Science & Engineering', 'Electronics & Communication', 'Electrical & Electronics', 'Mechanical Engineering',
  'Civil Engineering', 'Automation & Robotics', 'Biotechnology', 'Chemical Engineering', 'Architecture', 'MCA', 'MBA',
];
export const YEARS = ['1st year', '2nd year', '3rd year', '4th year', 'Postgraduate'];
const NOBODY = { id: '', role: 'student', name: '', first: '', gender: 'female', dept: '', year: '', hostel: 'day', home: null, phone: '' };
export const studentOf = (s) => s.me || NOBODY;
export const studentById = (s, id) => (s.users && s.users[id]) || null;
export const homeOf = (u) => (HOSTELS[u.hostel] || HOSTELS.day).home;
export const GENDER = {
  female: { label: 'Female', theme: 'theme-female', chip: 'bg-pink-500/15 text-pink-300 ring-1 ring-pink-400/40', dot: 'bg-pink-400' },
  male: { label: 'Male', theme: 'theme-male', chip: 'bg-blue-500/15 text-blue-300 ring-1 ring-blue-400/40', dot: 'bg-blue-400' },
};

export const COLLEGE = 'KLE Technological University';
export const COLLEGE_SHORT = 'KLE Tech, Hubballi';

// Checkpoints come from the campus model (src/campus.js).
export const CP = Object.fromEntries(Object.entries(CHECKPOINTS).map(([id, c]) => [id, { id, ...c }]));

export const cpShort = (id) => (['A', 'B', 'C', 'D', 'E', 'F', 'K'].includes(id) ? CP[id].tag : CP[id].name);

// Saathi Walk routes on the real campus (see src/campus.js). mins = walking time
// for that stretch; post = the guard post that watches the route.
export const ROUTES = {
  D: {
    dest: 'Girls Hostel',
    sub: 'Via Sports Arena path and Hostel Lane',
    post: 'girls',
    finalScan: 'hostel QR',
    steps: [
      { cp: 'A', mins: 0 },
      { cp: 'B', mins: 2 },
      { cp: 'C', mins: 2 },
      { cp: 'D', mins: 2 },
    ],
  },
  E: {
    dest: 'Boys Hostel',
    sub: 'Via Workshop Path',
    post: 'boys',
    finalScan: 'hostel QR',
    steps: [
      { cp: 'A', mins: 0 },
      { cp: 'F', mins: 3 },
      { cp: 'E', mins: 4 },
    ],
  },
  GATE: {
    dest: 'Main Gate (PB Road)',
    sub: 'Via Main Building',
    post: 'gate',
    finalScan: 'gate QR',
    steps: [
      { cp: 'A', mins: 0 },
      { cp: 'ADMIN', mins: 2 },
      { cp: 'GATE', mins: 1 },
    ],
  },
};

export { CAMERAS, camsAt };
export const camById = (id) => CAMERAS.find((c) => c.id === id);

export const ALERT_TYPES = {
  sos: { label: 'SOS', icon: 'siren', pri: 'critical' },
  missed: { label: 'Missed checkpoint', icon: 'clock', pri: 'high' },
  follower: { label: 'Follower detected', icon: 'users', pri: 'high' },
  wall: { label: 'Wall crossing', icon: 'fence', pri: 'high' },
  lab: { label: 'Lab equipment leaving without issue', icon: 'cpu', pri: 'high' },
  tailgate: { label: 'Tailgating at gate', icon: 'tailgate', pri: 'medium' },
  tamper: { label: 'Camera tampered', icon: 'cameraOff', pri: 'medium' },
  camoffline: { label: 'Camera offline', icon: 'cameraOff', pri: 'medium' },
  flagged: { label: 'Guard-flagged incident', icon: 'flag', pri: 'high' },
  visitor: { label: 'Visitor in wrong zone', icon: 'badge', pri: 'medium' },
  fall: { label: 'Person fallen', icon: 'alert', pri: 'high' },
  running: { label: 'Running detected', icon: 'activity', pri: 'medium' },
  loiter: { label: 'Loitering', icon: 'clock', pri: 'medium' },
  crowd: { label: 'Crowding', icon: 'users', pri: 'medium' },
  bag: { label: 'Unattended bag', icon: 'box', pri: 'medium' },
};

export const PRI = {
  critical: { label: 'Critical', rank: 0, badge: 'bg-red-600 text-white', tile: 'bg-red-600 text-white' },
  high: { label: 'High', rank: 1, badge: 'bg-red-100 text-red-700', tile: 'bg-red-100 text-red-600' },
  medium: { label: 'Medium', rank: 2, badge: 'bg-amber-100 text-amber-800', tile: 'bg-amber-100 text-amber-700' },
};

export const VISITOR_PURPOSES = ['Meeting', 'Parent visit', 'Delivery', 'Interview', 'Event', 'Maintenance'];
export const VISITOR_ZONES = ['Main Building', 'LHC', 'C-LITE', 'EC & EE Lab', 'Canteen', 'BT Auditorium'];

export const DISPUTE_REASONS = ["I didn't take this", 'Quantity is wrong', 'It was already damaged', 'Wrong time or bench', 'Something else'];

// ---------- utils ----------
export const pad = (n) => String(n).padStart(2, '0');
export function fmtTime(ms, withSec = false) {
  const d = new Date(ms);
  let h = d.getHours();
  const ap = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return `${h}:${pad(d.getMinutes())}${withSec ? ':' + pad(d.getSeconds()) : ''} ${ap}`;
}
export function fmtDay(ms, now = Date.now()) {
  const a = new Date(ms); const b = new Date(now);
  const d0 = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const d1 = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  const diff = Math.round((d1 - d0) / (24 * HOUR));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return a.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
export function ago(ms, now) {
  const s = Math.max(0, Math.floor((now - ms) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}
export const mmss = (s) => `${Math.floor(s / 60)}:${pad(s % 60)}`;
export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36).toUpperCase().padStart(7, '0');
}
export const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
export const cls = (...a) => a.filter(Boolean).join(' ');
export const distM = (a, b) => Math.round(Math.hypot(a.x - b.x, a.y - b.y)); // positions are in metres
export const qrCode = (id, slot) => `KAVACH|${id}|${slot}|${hash(id + ':' + slot + ':k4v4ch').slice(0, 6)}`;
// Checks a scanned pass: format, signature and age (a code is valid for its own
// 10 s window plus one more, so a screenshot stops working within 20 s).
// Prototype signature only; a real deployment would use an HMAC with a server key.
export function verifyQr(text, now = Date.now()) {
  const m = /^KAVACH\|([A-Z0-9]{6,12})\|(\d+)\|([A-Z0-9]{6})$/.exec(String(text).trim());
  if (!m) return { ok: false, reason: 'Not a Kavach pass' };
  const [, id, slotStr, sig] = m;
  const slot = Number(slotStr);
  if (qrCode(id, slot).split('|')[3] !== sig) return { ok: false, id, reason: 'Forged or altered code' };
  const age = Math.floor(now / (QR_PERIOD * 1000)) - slot;
  if (age < 0) return { ok: false, id, reason: 'Code from the future (check phone clock)' };
  if (age > 1) return { ok: false, id, reason: `Expired code (${age * QR_PERIOD} s old)`, expired: true };
  return { ok: true, id };
}

// ---------- initial state (empty) ----------
// Only campus setup is here: the camera registry and the lab's stock register.
// People, guards on duty and all activity start empty.
export const LAB_ITEMS = [
  { id: 'res220', name: 'Resistor 220 Ω', short: 'resistor', stock: 500, min: 100, gram: 0.25, kind: 'consumable', shelf: 'E-3' },
  { id: 'ledr', name: 'LED (red)', short: 'LED', stock: 300, min: 80, gram: 0.3, kind: 'consumable', shelf: 'E-3' },
  { id: 'uno', name: 'Arduino Uno', short: 'Arduino Uno', stock: 20, min: 8, gram: 25, kind: 'consumable', shelf: 'E-4' },
  { id: 'ultra', name: 'Ultrasonic sensor', short: 'ultrasonic sensor', stock: 25, min: 10, gram: 8.5, kind: 'consumable', shelf: 'E-4' },
  { id: 'osc4', name: 'Oscilloscope #4', short: 'Oscilloscope #4', stock: 1, min: 0, kind: 'instrument', rfid: 'RF-0A4C', bench: 'Bench 6', holder: null },
  { id: 'dmm7', name: 'Digital Multimeter #7', short: 'Multimeter #7', stock: 1, min: 0, kind: 'instrument', rfid: 'RF-11D7', bench: 'Bench 2', holder: null },
];

export const STATE_VERSION = 5;
export function makeInitial() {
  return {
    v: STATE_VERSION,
    seq: 1000,
    users: {},
    gate: { dirs: {}, log: [] },
    walk: null,
    walksCompleted: 0,
    guards: [],
    alerts: [],
    inventory: LAB_ITEMS.map((i) => ({ ...i, open: i.stock })),
    issued: [],
    disputes: [],
    returnCount: 0,
    visitors: [],
    audit: [],
    // camera status in state is only what happened to it (tampered / offline);
    // "live" means a real camera is connected on this device (see vision/live.js)
    cams: Object.fromEntries(CAMERAS.map((c) => [c.id, { status: 'none', zoom: 1, pan: 0, since: null }])),
    ai: { events: 0, byRule: {}, gate: [], used: [] },
    darkSpots: [],
    toasts: [],
  };
}

// Saved state from version 4 had demo students and guards: keep the campus
// activity, drop the demo people.
export function migrate(s) {
  if (!s || typeof s !== 'object') return null;
  if (s.v === 4) {
    const { gender, ...rest } = s;
    const demo = ['21BRS045', '21BRS018'];
    return {
      ...rest, v: STATE_VERSION, users: {}, guards: [], walk: null,
      gate: { dirs: Object.fromEntries(Object.entries(s.gate.dirs).filter(([k]) => !demo.includes(k))), log: s.gate.log.filter((l) => !demo.includes(l.sid)) },
      issued: s.issued.filter((i) => !demo.includes(i.sid)),
      disputes: s.disputes.filter((x) => !demo.includes(x.sid)),
      inventory: s.inventory.map((i) => (demo.includes(i.holder) ? { ...i, holder: null } : i)),
    };
  }
  return s.v === STATE_VERSION ? s : null;
}

// ---------- statistics, always computed from recorded activity ----------
const startOfDay = (now = Date.now()) => { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const presence = (s, sid) => s.gate.dirs[sid] || 'OUT';
export const myLog = (s) => s.gate.log.filter((l) => l.sid === studentOf(s).id);
export function campusStats(s, now = Date.now()) {
  const today = startOfDay(now);
  const studentsIn = Object.values(s.gate.dirs).filter((d) => d === 'IN').length;
  const visitorsIn = s.visitors.filter((v) => v.status === 'inside').length;
  return {
    inside: studentsIn + visitorsIn,
    studentsIn,
    visitorsIn,
    entriesToday: s.gate.log.filter((l) => l.dir === 'IN' && l.time >= today).length + s.visitors.filter((v) => v.checkedInAt && v.checkedInAt >= today).length,
    walksActive: s.walk && s.walk.phase === 'active' ? 1 : 0,
    openAlerts: s.alerts.filter((a) => a.status !== 'resolved').length,
    escalated: s.alerts.filter((a) => a.status !== 'resolved' && a.escalated).length,
    labIssued: s.issued.filter((i) => i.status === 'issued').reduce((a, b) => a + b.qty, 0),
    visitors: s.visitors.filter((v) => v.status !== 'left').length,
  };
}
export function transparency(s) {
  return {
    walks: s.walksCompleted + (s.walk && s.walk.phase === 'active' ? 1 : 0),
    followers: s.alerts.filter((a) => a.type === 'follower').length,
    faceSearches: 0, // there is no face search in Kavach
    views: s.audit.filter((a) => a.cat === 'footage').length,
  };
}
export function heatFrom(s) {
  const heat = {};
  for (const a of s.alerts) heat[a.cp] = (heat[a.cp] || 0) + 1;
  return heat;
}
