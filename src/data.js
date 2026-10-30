// Mock data, constants and small helpers. Everything here is fake demo data.

export const MIN = 60 * 1000;
export const HOUR = 60 * MIN;
export const ESCALATE_MS = 2 * MIN;
export const QR_PERIOD = 10; // seconds

export const STUDENT = {
  name: 'Priya Sharma',
  first: 'Priya',
  id: '21BRS045',
  dept: 'Electronics & Communication',
  year: '3rd year',
  phone: '+91 98450 21045',
  hostel: 'Girls Hostel D, Room 214',
  blood: 'B+',
};

export const COLLEGE = 'Demo College of Engineering';

// Campus checkpoints. x/y are positions on the 360x300 illustrated map.
export const CP = {
  GATE: { id: 'GATE', name: 'Main Gate', tag: 'G', x: 180, y: 278 },
  A: { id: 'A', name: 'Library', tag: 'A', x: 128, y: 152 },
  B: { id: 'B', name: 'Workshop Path', tag: 'B', x: 204, y: 122 },
  C: { id: 'C', name: 'Canteen Junction', tag: 'C', x: 262, y: 168 },
  D: { id: 'D', name: 'Girls Hostel D', tag: 'D', x: 300, y: 70 },
  LAB: { id: 'LAB', name: 'Electronics Lab', tag: 'L', x: 66, y: 94 },
  ADMIN: { id: 'ADMIN', name: 'Admin Block', tag: 'Ad', x: 92, y: 228 },
  WALL: { id: 'WALL', name: 'Boundary Wall East', tag: 'W', x: 344, y: 214 },
};

export const cpShort = (id) => (CP[id].tag.length === 1 && id !== 'GATE' && id !== 'LAB' && id !== 'WALL' ? CP[id].tag : CP[id].name);

export const GUARDS = [
  { id: 'ramesh', name: 'Ramesh', post: 'Main Gate', x: 204, y: 266 },
  { id: 'sunita', name: 'Sunita', post: 'Hostel D', x: 280, y: 92 },
  { id: 'imran', name: 'Imran', post: 'Library', x: 104, y: 170 },
];

export const ROUTES = {
  D: {
    dest: 'Girls Hostel D',
    sub: 'Via Workshop Path and Canteen',
    guard: 'sunita',
    finalScan: 'hostel QR',
    steps: [
      { cp: 'A', mins: 0 },
      { cp: 'B', mins: 3 },
      { cp: 'C', mins: 4 },
      { cp: 'D', mins: 3 },
    ],
  },
  GATE: {
    dest: 'Main Gate (auto stand)',
    sub: 'Via Admin Block',
    guard: 'ramesh',
    finalScan: 'gate QR',
    steps: [
      { cp: 'A', mins: 0 },
      { cp: 'ADMIN', mins: 3 },
      { cp: 'GATE', mins: 3 },
    ],
  },
};

export const ALERT_TYPES = {
  sos: { label: 'SOS', icon: 'siren', pri: 'critical' },
  missed: { label: 'Missed checkpoint', icon: 'clock', pri: 'high' },
  follower: { label: 'Follower detected', icon: 'users', pri: 'high' },
  wall: { label: 'Wall crossing', icon: 'fence', pri: 'high' },
  lab: { label: 'Lab equipment leaving without issue', icon: 'cpu', pri: 'high' },
  tailgate: { label: 'Tailgating at gate', icon: 'tailgate', pri: 'medium' },
  tamper: { label: 'Camera tampered', icon: 'cameraOff', pri: 'medium' },
  visitor: { label: 'Visitor in wrong zone', icon: 'badge', pri: 'medium' },
};

export const PRI = {
  critical: { label: 'Critical', rank: 0, badge: 'bg-red-600 text-white', tile: 'bg-red-600 text-white' },
  high: { label: 'High', rank: 1, badge: 'bg-red-100 text-red-700', tile: 'bg-red-100 text-red-600' },
  medium: { label: 'Medium', rank: 2, badge: 'bg-amber-100 text-amber-800', tile: 'bg-amber-100 text-amber-700' },
};

export const VISITOR_PURPOSES = ['Meeting', 'Parent visit', 'Delivery', 'Interview', 'Event', 'Maintenance'];
export const VISITOR_ZONES = ['Admin Block', 'Library', 'Electronics Lab', 'Canteen Junction', 'Main Gate'];

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
export const distM = (a, b) => Math.round(Math.hypot(a.x - b.x, a.y - b.y) * 2.4);
export const qrCode = (id, slot) => `KAVACH|${id}|${slot}|${hash(id + ':' + slot + ':k4v4ch').slice(0, 6)}`;

// ---------- initial state ----------
export function makeInitial() {
  const now = Date.now();
  const at = (daysAgo, h, m) => { const x = new Date(now); x.setDate(x.getDate() - daysAgo); x.setHours(h, m, 0, 0); return x.getTime(); };
  const base = { seed: true, escalated: false, lights: false, speaker: false, photo: null, walk: false };
  return {
    seq: 1040,
    lastDrift: now,
    inside: 1247,
    entriesToday: 3382,
    gate: {
      dir: 'OUT',
      log: [
        { id: 'g6', dir: 'OUT', place: 'Main Gate', time: at(1, 18, 14) },
        { id: 'g5', dir: 'OUT', place: 'Electronics Lab', time: at(1, 16, 3) },
        { id: 'g4', dir: 'IN', place: 'Electronics Lab', time: at(1, 14, 1) },
        { id: 'g3', dir: 'OUT', place: 'Library', time: at(1, 12, 40) },
        { id: 'g2', dir: 'IN', place: 'Library', time: at(1, 10, 22) },
        { id: 'g1', dir: 'IN', place: 'Main Gate', time: at(1, 8, 47) },
        { id: 'g0', dir: 'OUT', place: 'Main Gate', time: at(2, 17, 40) },
      ],
    },
    walk: null,
    walksCompleted: 0,
    otherWalks: [
      { id: 'w1', name: 'Ananya K.', dest: 'Girls Hostel D', at: 'C', progress: 0.7, started: now - 7 * MIN },
      { id: 'w2', name: 'Rahul M.', dest: 'Main Gate (auto stand)', at: 'ADMIN', progress: 0.5, started: now - 3 * MIN },
    ],
    guards: GUARDS.map((g) => ({ ...g })),
    alerts: [
      { ...base, id: 'AL-1038', type: 'tamper', cp: 'C', detail: 'Camera C-2 view blocked for 40 s.', time: now - 47 * MIN, status: 'resolved', assigned: 'imran', acceptedBy: 'imran', resolvedBy: 'imran', resolvedAt: now - 35 * MIN, note: 'Leaf stuck on lens. Cleaned.' },
      { ...base, id: 'AL-1035', type: 'tailgate', cp: 'GATE', detail: 'Two people entered on one scan, Lane 2.', time: now - 2 * HOUR, status: 'resolved', assigned: 'ramesh', acceptedBy: 'ramesh', resolvedBy: 'ramesh', resolvedAt: now - 2 * HOUR + 4 * MIN, note: 'Second person was a visitor with a valid pass.' },
    ],
    inventory: [
      { id: 'res220', name: 'Resistor 220 Ω', short: 'resistor', stock: 500, min: 100, gram: 0.25, kind: 'consumable', shelf: 'E-3' },
      { id: 'ledr', name: 'LED (red)', short: 'LED', stock: 300, min: 80, gram: 0.3, kind: 'consumable', shelf: 'E-3' },
      { id: 'uno', name: 'Arduino Uno', short: 'Arduino Uno', stock: 20, min: 8, gram: 25, kind: 'consumable', shelf: 'E-4' },
      { id: 'ultra', name: 'Ultrasonic sensor', short: 'ultrasonic sensor', stock: 25, min: 30, gram: 8.5, kind: 'consumable', shelf: 'E-4' },
      { id: 'osc4', name: 'Oscilloscope #4', short: 'Oscilloscope #4', stock: 1, min: 0, kind: 'instrument', rfid: 'RF-0A4C', bench: 'Bench 6', holder: null },
      { id: 'dmm7', name: 'Digital Multimeter #7', short: 'Multimeter #7', stock: 1, min: 0, kind: 'instrument', rfid: 'RF-11D7', bench: 'Bench 2', holder: null },
    ],
    yearly: { res220: [1200, 820], ledr: [800, 510], uno: [30, 14], ultra: [40, 19] }, // [opening + received, issued this year]
    issued: [
      { id: 'IS-1021', itemId: 'uno', name: 'Arduino Uno', qty: 1, time: at(1, 15, 10), status: 'issued' },
      { id: 'IS-1012', itemId: 'ledr', name: 'LED (red)', qty: 6, time: at(4, 11, 30), status: 'returned', returnedAt: at(4, 13, 2) },
    ],
    sessions: [
      { id: 'SE-77', label: 'Oscilloscope #4', bench: 'Bench 6', slot: '2 to 4 pm', day: 'Today', status: 'normal' },
      { id: 'SE-71', label: 'Digital Multimeter #7', bench: 'Bench 2', slot: '11 am to 12 pm', day: 'Mon', status: 'normal' },
    ],
    disputes: [],
    returnCount: 0,
    visitors: [
      { id: 'V-201', name: 'Rakesh Gupta', phone: '98201 44718', purpose: 'Delivery', dest: 'Electronics Lab', from: '10:00', to: '13:00', status: 'inside', created: now - 50 * MIN },
      { id: 'V-202', name: 'Anjali Nair', phone: '99860 31207', purpose: 'Parent visit', dest: 'Admin Block', from: '11:30', to: '12:30', status: 'expected', created: now - 20 * MIN },
    ],
    audit: [
      { id: 'au5', who: 'Guard Imran', action: 'Viewed 10 s clip · Library corridor', reason: 'Responding to alert AL-1031', cat: 'footage', time: now - 2 * HOUR - 8 * MIN },
      { id: 'au4', who: 'System', action: 'Auto-deleted 38 Saathi Walk photos', reason: 'All walkers reached safely last night', cat: 'system', time: now - 9 * HOUR },
      { id: 'au3', who: 'Lab In-charge (Dr. Mehta)', action: 'Looked up issue record · 21BRS045', reason: 'Overdue item check', cat: 'lookup', time: now - 26 * HOUR },
      { id: 'au2', who: 'Security Head (Mr. Rao)', action: 'Unblurred clip · Workshop Path', reason: 'Bike theft complaint T-12. Approved by student committee', cat: 'footage', time: now - 3 * 24 * HOUR },
      { id: 'au1', who: 'Admin (Ms. Kulkarni)', action: 'Exported monthly transparency report', reason: 'Student council meeting', cat: 'lookup', time: now - 5 * 24 * HOUR },
    ],
    heatBase: { GATE: 14, WALL: 9, B: 7, D: 6, C: 4, LAB: 3, A: 2, ADMIN: 1 },
    monthly: { walks: 214, followers: 3, faceSearches: 0, unblurs: 2 },
    toasts: [],
  };
}
