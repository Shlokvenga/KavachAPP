// Shared state actions. Every role (Student, Guard, Admin) reads and writes one
// state object, so a change in one app shows up live in the others. Each action
// receives a draft (a fresh clone) and mutates it. They run in the browser and,
// when phones are paired, on the laptop hub too, so nothing here may use React or
// browser-only APIs without a guard. src/actions.js names them.
import {
  ALERT_TYPES, CP, ESCALATE_MS, MIN, POSTS, ROUTES, camById, camsAt, cpShort, distM, fmtTime, presence, studentById, studentOf, verifyQr,
} from './data.js';
import { RULES } from './vision/rules.js';

export function vibrate(pattern = [180, 80, 180]) {
  try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* not supported */ }
}

// Student toasts are addressed to one student, so with several phones paired
// each student only sees their own.
export function toast(d, role, msg, kind = 'info', sid = role === 'student' ? studentOf(d).id : null) {
  d.toasts.push({ id: ++d.seq, role, msg, kind, sid, until: Date.now() + 3600 });
  if (d.toasts.length > 14) d.toasts.shift();
}

export function audit(d, who, action, reason, cat = 'footage') {
  d.audit.unshift({ id: 'au' + ++d.seq, who, action, reason, cat, time: Date.now() });
}

// With no guard signed in, alerts and walks go to the security office.
const OFFICE = { id: null, name: 'Security office', post: 'Control room', x: 0, y: 0 };
export const guardById = (d, id) => (id && d.guards.find((g) => g.id === id)) || { ...OFFICE };
export const guardLabel = (g) => (g && g.id ? `Guard ${g.name}` : 'The security office');
const nearestOf = (list, p) => [...list].sort((a, b) => distM(a, p) - distM(b, p))[0] || null;
export const nearestGuard = (d, cpId) => nearestOf(d.guards, CP[cpId]);

// Every action carries the signed-in person (`who`), so the hub and every
// paired phone know them. Guards are on duty from sign-in until sign-out.
const clip = (v, n = 60) => String(v == null ? '' : v).slice(0, n);
export function upsertUser(d, who) {
  if (!who || !who.id || !['student', 'guard'].includes(who.role)) return;
  const u = {
    id: clip(who.id, 16), role: who.role, email: clip(who.email, 80), name: clip(who.name), first: clip(who.first, 30),
    gender: who.gender === 'male' ? 'male' : 'female', dept: clip(who.dept), year: clip(who.year, 20),
    hostel: clip(who.hostel, 10), room: clip(who.room, 12), phone: clip(who.phone, 20), post: clip(who.post, 10),
  };
  d.users[u.id] = u;
  if (u.role !== 'guard') return;
  const p = POSTS[u.post] || POSTS.gate;
  let g = d.guards.find((x) => x.id === u.id);
  if (!g) { g = { id: u.id, x: p.x, y: p.y }; d.guards.push(g); }
  else if (g.postId !== u.post) { g.x = p.x; g.y = p.y; }
  Object.assign(g, { name: u.first, full: u.name, post: p.label, postId: u.post, female: u.gender === 'female' });
}

export function signOut(d) {
  const me = d.me;
  if (me && me.role === 'guard') d.guards = d.guards.filter((g) => g.id !== me.id);
}

export function createAlert(d, { type, cp, detail, photo = null, walk = false, assign = null, cam = null, student = null }) {
  const g = (assign && d.guards.find((x) => x.id === assign)) || nearestGuard(d, cp);
  const a = {
    id: 'AL-' + ++d.seq, type, cp, detail, photo, walk, cam: cam || camsAt(cp)[0] || null,
    time: Date.now(), status: 'new', escalated: false,
    assigned: g ? g.id : null, acceptedBy: null, lights: false, speaker: false, resolvedBy: null, note: null, student,
  };
  d.alerts.unshift(a);
  toast(d, 'guard', `${ALERT_TYPES[type].label} · ${CP[cp].name}`, 'alert');
  if (ALERT_TYPES[type].pri !== 'medium') toast(d, 'admin', `New ${ALERT_TYPES[type].label.toLowerCase()} alert at ${CP[cp].name}`, 'alert');
  return a;
}

const findAlert = (d, id) => d.alerts.find((a) => a.id === id);

// ---------- timers (run every second) ----------
// Returns true if anything changed (the hub only syncs real changes).
export function tick(d) {
  const now = Date.now();
  const nToasts = d.toasts.length;
  d.toasts = d.toasts.filter((t) => t.until > now);
  let changed = d.toasts.length !== nToasts;

  const esc = d.alerts.filter((a) => a.status === 'new' && !a.escalated && now - a.time >= ESCALATE_MS);
  for (const a of esc) { a.escalated = true; a.escalatedAt = now; }
  if (esc.length) {
    changed = true;
    const what = esc.length === 1 ? esc[0].id : `${esc.length} alerts`;
    toast(d, 'guard', `${what} not accepted in 2 min. Escalated to Security Head`, 'warn');
    toast(d, 'admin', `${what} escalated to Security Head`, 'warn');
  }

  const w = d.walk;
  if (w && w.phase === 'active' && w.missing) {
    if (w.missing.stage === 'countdown' && now >= w.missing.until) {
      w.missing = { stage: 'prompt', until: now + 30 * 1000 };
      vibrate([300, 120, 300, 120, 300]);
      changed = true;
    } else if (w.missing.stage === 'prompt' && now >= w.missing.until) {
      raiseMissed(d);
      changed = true;
    }
  }
  return changed;
}

// ---------- student: gate ----------
function logGate(d, sid, dir, place) {
  d.gate.dirs[sid] = dir;
  d.gate.log.unshift({ id: 'g' + ++d.seq, sid, dir, place, time: Date.now() });
  d.gate.log = d.gate.log.slice(0, 200);
}

export function gateScan(d, dir) {
  logGate(d, studentOf(d).id, dir, 'Main Gate');
}

const walkStudent = (w) => ({ id: w.sid, name: w.name, gender: w.gender });

// ---------- student: Saathi Walk ----------
// The walk belongs to one student; another paired phone must not drive it.
export const myWalk = (s) => (s.walk && s.walk.sid === studentOf(s).id ? s.walk : null);
export const lastPassed = (w) => [...w.steps].reverse().find((s) => s.status === 'passed');
export const nextStep = (w) => w.steps.find((s) => s.status !== 'passed');

// The guard at the route's post watches the walk, else the nearest one on duty
// (a female guard if the student asked for one and one is on duty).
export function walkGuard(d, r, femaleGuard) {
  const women = d.guards.filter((g) => g.female);
  const pool = femaleGuard && women.length ? women : d.guards;
  return pool.find((g) => g.postId === r.post) || nearestOf(pool, CP[r.steps[r.steps.length - 1].cp]);
}

// `snap` is an anonymised frame from a real camera at the checkpoint, if one is connected.
export function startWalk(d, destKey, sharing, { femaleGuard = false, snap = null } = {}) {
  const r = ROUTES[destKey];
  const st = studentOf(d);
  const now = Date.now();
  if (d.walk && d.walk.phase === 'active' && d.walk.sid !== st.id) {
    toast(d, 'student', `${d.walk.first} is on a Saathi Walk right now. This prototype escorts one walk at a time.`, 'warn');
    return;
  }
  d.walk = {
    id: 'W-' + ++d.seq,
    sid: st.id,
    name: st.name,
    first: st.first,
    gender: st.gender,
    femaleGuard,
    dest: destKey,
    guard: (walkGuard(d, r, femaleGuard) || {}).id || null,
    startedAt: now,
    phase: 'active',
    sharing: !!sharing,
    link: `kavach.app/w/${(d.seq * 7919).toString(36)}${st.id.slice(-3)}`,
    steps: r.steps.map((s, i) => ({ ...s, status: i === 0 ? 'passed' : 'pending', time: i === 0 ? now : null, snap: i === 0 ? snap : null })),
    missing: null,
    followerAt: null,
    followerAlert: null,
    sosAlert: null,
    missedAlert: null,
  };
  const g = guardById(d, d.walk.guard);
  toast(d, 'student', snap ? `Photo captured at checkpoint A · ${fmtTime(now)}` : `Checked in at checkpoint A · ${fmtTime(now)}`, 'success');
  toast(d, 'guard', `Saathi Walk started: ${st.name} → ${r.dest} (watching: ${g.id ? g.name : 'any guard'})`, 'info');
}

export function passNext(d, snap = null) {
  const w = d.walk;
  const step = nextStep(w);
  if (!step) return;
  const now = Date.now();
  step.status = 'passed';
  step.time = now;
  step.snap = snap;
  w.missing = null;
  if (w.missedAlert) {
    const a = findAlert(d, w.missedAlert);
    if (a && a.status !== 'resolved') {
      a.status = 'resolved'; a.resolvedAt = now; a.resolvedBy = 'system';
      a.note = `${w.first} passed ${cpShort(step.cp)} at ${fmtTime(now)}. Auto-closed.`;
      toast(d, 'guard', `${a.id} auto-closed: ${w.first} passed ${cpShort(step.cp)}`, 'success');
    }
    w.missedAlert = null;
  }
  if (step === w.steps[w.steps.length - 1]) arrive(d);
  else toast(d, 'student', `Passed ${cpShort(step.cp)}${snap ? ' · photo captured' : ''}`, 'success');
}

function arrive(d) {
  const w = d.walk;
  const now = Date.now();
  w.phase = 'arrived';
  w.arrivedAt = now;
  d.walksCompleted += 1;
  const ids = [w.sosAlert, w.followerAlert, w.missedAlert];
  let photos = w.steps.filter((x) => x.snap).length;
  for (const a of d.alerts) {
    if (!a.walk || !a.student || a.student.id !== w.sid) continue;
    if (a.status !== 'resolved' && ids.includes(a.id)) { a.status = 'resolved'; a.resolvedAt = now; a.resolvedBy = 'system'; a.note = 'Student reached safely.'; }
    if (a.photo && a.photo.snap) { a.photo.snap = null; photos += 1; }
  }
  for (const st of w.steps) { st.hadPhoto = !!st.snap; st.snap = null; } // the promise: walk photos are deleted on arrival
  w.photosDeleted = photos;
  audit(d, 'System', `Deleted ${photos} Saathi Walk photo${photos === 1 ? '' : 's'} (${w.id})`, `${w.name} reached ${ROUTES[w.dest].dest} safely`, 'system');
  logGate(d, w.sid, w.dest === 'GATE' ? 'OUT' : 'IN', `${ROUTES[w.dest].dest} (${ROUTES[w.dest].finalScan})`);
  toast(d, 'guard', `${w.name} reached ${ROUTES[w.dest].dest} safely ✓`, 'success');
}

export function goMissing(d) {
  d.walk.missing = { stage: 'countdown', until: Date.now() + 5000 };
}

export function raiseMissed(d) {
  const w = d.walk;
  const last = lastPassed(w);
  const next = nextStep(w);
  next.status = 'missed';
  const a = createAlert(d, {
    type: 'missed',
    cp: last.cp,
    detail: `Missed checkpoint ${cpShort(next.cp)}. Last seen at ${cpShort(last.cp)}, ${fmtTime(last.time)}. Saathi Walk: ${w.name} → ${ROUTES[w.dest].dest}. No answer to "Are you OK?"`,
    photo: { cp: last.cp, time: last.time, cam: camsAt(last.cp)[0], snap: last.snap },
    walk: true,
    assign: w.guard,
    student: walkStudent(w),
  });
  w.missing = { stage: 'alerted' };
  w.missedAlert = a.id;
  toast(d, 'student', `${guardLabel(guardById(d, w.guard))} has been alerted`, 'warn', w.sid);
}

export function answerOk(d) {
  const w = d.walk;
  w.missing = null;
  toast(d, 'student', 'Glad you are OK. Your walk continues.', 'success', d.walk && d.walk.sid);
}

export function sos(d) {
  const w = d.walk;
  const last = lastPassed(w);
  w.missing = null;
  const a = createAlert(d, {
    type: 'sos',
    cp: last.cp,
    detail: `SOS from ${w.name} (Saathi Walk → ${ROUTES[w.dest].dest}). Last checkpoint ${cpShort(last.cp)}, ${fmtTime(last.time)}. Cameras there switch to INVESTIGATE.`,
    photo: { cp: last.cp, time: last.time, cam: camsAt(last.cp)[0], snap: last.snap },
    walk: true,
    assign: w.guard,
    student: walkStudent(w),
  });
  w.sosAlert = a.id;
  toast(d, 'student', `SOS sent. ${guardLabel(guardById(d, w.guard))} notified.`, 'alert', w.sid);
  vibrate([400, 100, 400]);
}

export function cancelSos(d) {
  const w = d.walk;
  const a = findAlert(d, w.sosAlert);
  if (a && a.status !== 'resolved') {
    a.status = 'resolved'; a.resolvedAt = Date.now(); a.resolvedBy = 'student'; a.note = 'Cancelled by student: "I am safe now".';
    toast(d, 'guard', `${a.id} cancelled by student (safe)`, 'success');
  }
  w.sosAlert = null;
  toast(d, 'student', 'SOS cancelled. Stay safe!', 'info');
}

export function follower(d) {
  const w = d.walk;
  const last = lastPassed(w);
  const g = guardById(d, w.guard);
  const a = createAlert(d, {
    type: 'follower',
    cp: last.cp,
    detail: `${w.name} reported someone following (Saathi Walk). Last checkpoint ${cpShort(last.cp)}.`,
    walk: true,
    assign: w.guard,
    student: walkStudent(w),
  });
  w.followerAt = Date.now();
  w.followerAlert = a.id;
  vibrate([120, 60, 120, 60, 120]);
  toast(d, 'student', `${guardLabel(g)} notified discreetly`, 'warn', w.sid);
}

// ---------- guard ----------
export function acceptAlert(d, id, guardId) {
  const a = findAlert(d, id);
  const g = d.guards.find((x) => x.id === guardId);
  if (!a || !g || a.status === 'resolved') return;
  const cp = CP[a.cp];
  a.status = 'accepted';
  a.acceptedBy = guardId;
  a.acceptedName = g.name;
  a.acceptedAt = Date.now();
  a.dist = distM(g, cp);
  a.from = { x: g.x, y: g.y };
  g.x = cp.x - 10;
  g.y = cp.y - 10;
  toast(d, 'guard', `Navigating to ${cp.name} · ${a.dist} m · ~${Math.max(1, Math.ceil(a.dist / 80))} min`, 'info');
  if (a.walk) toast(d, 'student', `Guard ${g.name} accepted and is on the way`, 'success', a.student && a.student.id);
}

export function toggleLights(d, id) {
  const a = findAlert(d, id);
  a.lights = !a.lights;
  toast(d, 'guard', `Area lights ${a.lights ? 'ON' : 'OFF'} · ${CP[a.cp].name}`, a.lights ? 'success' : 'info');
  if (a.walk && a.lights) toast(d, 'student', 'Lights near you were turned on', 'info', a.student && a.student.id);
}

export function playSpeaker(d, id) {
  const a = findAlert(d, id);
  a.speaker = true;
  a.speakerAt = Date.now();
  toast(d, 'guard', `Speaker warning played at ${CP[a.cp].name}`, 'info');
}

export function resolveAlert(d, id, guardId) {
  const a = findAlert(d, id);
  if (!a) return;
  a.status = 'resolved';
  a.resolvedAt = Date.now();
  a.resolvedBy = guardId;
  if (!a.acceptedBy) a.acceptedBy = guardId;
  if (!a.acceptedName) a.acceptedName = guardById(d, guardId).name;
  if ((a.type === 'tamper' || a.type === 'camoffline') && a.cam && d.cams[a.cam]) {
    d.cams[a.cam].status = 'none';
    d.cams[a.cam].since = Date.now();
    a.note = a.note || `${a.cam} checked and fixed.`;
  }
  const g = guardById(d, guardId);
  a.resolvedName = g.name;
  toast(d, 'guard', `${a.id} resolved by ${g.name}`, 'success');
  toast(d, 'admin', `${a.id} resolved by ${g.name}`, 'success');
  if (a.walk) toast(d, 'student', `Guard ${g.name} marked your alert resolved`, 'success', a.student && a.student.id);
}

export function skipTime(d, ms = 2 * MIN) {
  for (const a of d.alerts) if (a.status === 'new') a.time -= ms;
}

// ---------- triggers ----------
function setCam(d, id, status) {
  d.cams[id].status = status;
  d.cams[id].since = Date.now();
}

export const TRIGGERS = {
  wall: (d) => createAlert(d, { type: 'wall', cp: 'WALL', cam: 'CAM-W1', detail: 'Person climbing over the east boundary wall. Thermal camera CAM-W1.' }),
  tailgate: (d) => createAlert(d, { type: 'tailgate', cp: 'GATE', cam: 'CAM-G2', detail: 'Two people passed on one scan at Lane 2. Second person not verified.' }),
  tamper: (d) => {
    setCam(d, 'CAM-K2', 'tampered');
    createAlert(d, { type: 'tamper', cp: 'K', cam: 'CAM-K2', detail: 'CAM-K2 covered or moved. View blocked for 20 s.' });
  },
  camoffline: (d) => {
    setCam(d, 'CAM-W2', 'offline');
    createAlert(d, { type: 'camoffline', cp: 'WALL', cam: 'CAM-W2', detail: 'CAM-W2 (east wall, thermal) stopped sending video. Power or network fault.' });
    toast(d, 'admin', 'CAM-W2 went offline. East wall coverage reduced.', 'warn');
  },
};

// ---------- CCTV ----------
export function viewFeed(d, camId, who, reason = 'Live monitoring (on duty)') {
  audit(d, who, `Viewed live feed ${camId} · ${camById(camId).name}`, reason);
}

export function camPtz(d, camId, change) {
  const c = d.cams[camId];
  if (change.zoom) c.zoom = Math.min(3, Math.max(1, +(c.zoom + change.zoom).toFixed(1)));
  if (change.pan) c.pan = Math.max(-40, Math.min(40, c.pan + change.pan));
  if (change.reset) { c.zoom = 1; c.pan = 0; }
}

export function snapshot(d, camId, who) {
  audit(d, who, `Saved snapshot from ${camId}`, 'Evidence for incident log (faces stay blurred)');
  toast(d, 'guard', `Snapshot saved from ${camId}. Faces stay blurred.`, 'success');
}

export function talkDown(d, camId) {
  toast(d, 'guard', `Speaker at ${camById(camId).name}: "You are being recorded. Security is on the way."`, 'info');
}

export function flagIncident(d, camId, guardId) {
  const cam = camById(camId);
  const g = guardById(d, guardId);
  createAlert(d, { type: 'flagged', cp: cam.cp, cam: camId, assign: guardId, detail: `Flagged by Guard ${g.name} while watching ${camId} (${cam.name}).` });
}

export function requestUnblur(d, camId, who, reason) {
  audit(d, who, `Requested unblur · ${camId}`, `${reason}. Sent to student committee for review`);
  toast(d, 'guard', 'Unblur request sent to the student committee', 'info');
  toast(d, 'admin', `Unblur request for ${camId} awaiting committee review`, 'warn');
}

export function reportDarkSpot(d, cp) {
  d.darkSpots.unshift({ id: 'DK-' + ++d.seq, cp, time: Date.now() });
  toast(d, 'student', 'Thanks! Reported to campus maintenance.', 'success');
  toast(d, 'admin', `Student reported a dark spot / camera issue near ${CP[cp].name}`, 'info');
}

// Cross-module rule: RFID instrument crossing the lab door is checked against the issue ledger.
export function equipmentLeaving(d, itemId = 'osc4') {
  const it = d.inventory.find((i) => i.id === itemId);
  if (it.holder) {
    const who = studentById(d, it.holder);
    toast(d, 'guard', `${it.name} passed lab door. Issued to ${who ? who.name : it.holder}. Allowed ✓`, 'success');
    toast(d, 'admin', `${it.name} left lab: issued to ${it.holder}. No alert`, 'success');
    toast(d, 'student', `${it.name} checked out on your account at lab door`, 'info', it.holder);
    return false;
  }
  createAlert(d, { type: 'lab', cp: 'LAB', cam: 'CAM-L1', detail: `${it.name} (RFID ${it.rfid}) passed the lab door without being issued.` });
  createAlert(d, { type: 'lab', cp: 'GATE', cam: 'CAM-G1', detail: `Hold at gate: ${it.name} (RFID ${it.rfid}) left the EC & EE lab without issue. Check bags at exit.` });
  toast(d, 'admin', 'Cross-module rule fired: lab door + Main Gate alerted', 'warn');
  return true;
}

export function visitorWrongZone(d) {
  const v = d.visitors.find((x) => x.status === 'inside') || d.visitors.find((x) => x.status !== 'left') || null;
  createAlert(d, {
    type: 'visitor',
    cp: 'D',
    cam: 'CAM-D2',
    detail: v ? `${v.name} (pass ${v.id}) seen near the Girls Hostel by CAM-D2. Allowed zone: ${v.dest}, ${v.from}–${v.to}.` : 'Someone without a visitor pass seen near the Girls Hostel.',
  });
  toast(d, 'admin', 'Visitor outside allowed zone. Guard alerted.', 'warn');
}

// ---------- lab ----------
export function issueItems(d, picks) {
  const st = studentOf(d);
  const lines = [];
  for (const [id, q] of Object.entries(picks)) {
    if (!q) continue;
    const it = d.inventory.find((x) => x.id === id);
    it.stock -= q;
    if (it.rfid) it.holder = st.id;
    d.issued.unshift({ id: 'IS-' + ++d.seq, sid: st.id, itemId: id, name: it.name, qty: q, time: Date.now(), status: 'issued', rfid: !!it.rfid, bench: it.bench || null });
    lines.push(`${q} × ${it.name}`);
  }
  toast(d, 'student', `Issued to you: ${lines.join(', ')}`, 'success');
  toast(d, 'admin', `Lab issue → ${st.name}: ${lines.join(', ')}`, 'info');
}

export function returnItem(d, issueId, missing) {
  const is = d.issued.find((x) => x.id === issueId);
  const it = d.inventory.find((x) => x.id === is.itemId);
  is.status = missing ? 'short' : 'returned';
  is.missing = missing;
  is.returnedAt = Date.now();
  it.stock += is.qty - missing;
  if (it.rfid) it.holder = null;
  if (is.qty > 1) d.returnCount += 1;
  if (missing) toast(d, 'admin', `Short return: ${missing} ${it.short} missing (${(studentById(d, is.sid) || {}).name || is.sid})`, 'warn');
  toast(d, 'student', missing ? `Returned with ${missing} ${it.short} reported missing` : `Returned: ${is.qty} × ${is.name} ✓`, missing ? 'warn' : 'success', is.sid);
}

export function raiseDispute(d, label, reason) {
  const st = studentOf(d);
  d.disputes.unshift({ id: 'DS-' + ++d.seq, sid: st.id, label, reason, time: Date.now(), status: 'open' });
  audit(d, `${st.name} (${st.id})`, `Raised dispute · ${label}`, reason, 'lookup');
  toast(d, 'student', 'Dispute sent to Lab In-charge and student committee', 'success');
  toast(d, 'admin', `New dispute from ${st.id}: ${label}`, 'info');
}

// ---------- on-device AI ----------
// A behaviour event from a real camera becomes a normal alert, with the
// anonymised snapshot, the confidence and the plain-language reason attached.
export function aiEvent(d, camId, ev, snap) {
  const cam = camById(camId);
  const type = RULES[ev.rule].alert;
  d.ai.events += 1;
  d.ai.byRule[ev.rule] = (d.ai.byRule[ev.rule] || 0) + 1;
  if (ev.rule === 'tamper' && d.cams[camId]) { d.cams[camId].status = 'tampered'; d.cams[camId].since = Date.now(); }
  const a = createAlert(d, { type, cp: cam.cp, cam: camId, detail: `${cam.name}: ${ev.explain}.` });
  a.ai = { rule: ev.rule, name: RULES[ev.rule].name, conf: +ev.conf.toFixed(2), explain: ev.explain, model: ev.rule === 'tamper' ? 'Image statistics (no ML)' : 'CenterNet + tracker, on device' };
  a.snap = snap || null;
  a.live = true;
}

// A pass shown to a live gate camera: verify the signed, rotating code, apply
// anti-passback, then (if a face is enrolled on this device) the 1:1 face check.
export function gateQr(d, camId, text, face) {
  const cam = camById(camId);
  const q = verifyQr(text);
  const now = Date.now();
  const rec = { id: 'GQ-' + ++d.seq, cam: camId, time: now, ok: false, reason: q.reason || '', face: face || null };
  const holder = q.ok ? studentById(d, q.id) : null;
  if (q.ok && d.ai.used.includes(text)) { rec.reason = 'Code already used (one scan per code)'; }
  else if (q.ok && !holder) { rec.reason = 'Unknown student ID'; }
  else if (q.ok) {
    const dir = presence(d, q.id) === 'IN' ? 'OUT' : 'IN';
    if (face && !face.ok && face.decision !== 'NOT ENROLLED') rec.reason = 'Face check failed: ' + face.reasons[0];
    else {
      rec.ok = true; rec.dir = dir; rec.who = holder.name;
      d.ai.used = [text, ...d.ai.used].slice(0, 50);
      logGate(d, q.id, dir, `Main Gate (${camId}, live)`);
    }
  }
  d.ai.gate.unshift(rec);
  d.ai.gate = d.ai.gate.slice(0, 12);
  const faceTxt = face ? (face.decision === 'MATCH' ? ` · face 1:1 ${(face.sim * 100).toFixed(0)}%, live ✓` : face.decision === 'NOT ENROLLED' ? ' · no face enrolled' : '') : '';
  // the student toast goes to the pass holder, whichever device ran the camera
  if (rec.ok) {
    toast(d, 'guard', `${cam.name}: ${holder.name} → ${rec.dir}${faceTxt}`, 'success');
    toast(d, 'student', `Entry logged at the gate: ${rec.dir}, ${fmtTime(now)}${faceTxt}`, 'success', q.id);
  } else {
    toast(d, 'guard', `${cam.name}: rejected. ${rec.reason}`, 'alert');
    if (holder) toast(d, 'student', `Gate rejected your pass: ${rec.reason}`, 'alert', q.id);
  }
}

export function gateFaceResult(d, result) {
  if (!result.ok) return null;
  const sid = studentOf(d).id;
  const dir = presence(d, sid) === 'IN' ? 'OUT' : 'IN';
  logGate(d, sid, dir, 'Main Gate (face 1:1, live)');
  return dir;
}
