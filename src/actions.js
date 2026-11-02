// Every change to the shared state goes through a named action, so the same
// change can run on this device and, when paired, on the laptop hub that
// keeps the one copy every phone and the admin console sync from.
//   act('passNext', snap)  →  ACTIONS.passNext(draft, snap)
// Each action is sent with the signed-in person (`who`); while it runs, d.me is
// that person and they are added to d.users (and to d.guards for a guard).
import { studentOf } from './data.js';
import * as S from './store.js';

// walk actions only act on the walk of the student who sent them
const own = (fn) => (d, ...a) => (S.myWalk(d) ? fn(d, ...a) : undefined);

const ADMIN = 'Admin (Security office)';
const findVisitor = (d, id) => d.visitors.find((x) => x.id === id);

export const ACTIONS = {
  // student
  hello: () => {}, // just records who signed in (a guard goes on duty)
  signOut: S.signOut,
  gateScan: S.gateScan, startWalk: S.startWalk, passNext: own(S.passNext),
  goMissing: own(S.goMissing), answerOk: own(S.answerOk), sos: own(S.sos), cancelSos: own(S.cancelSos), follower: own(S.follower),
  reportDarkSpot: S.reportDarkSpot, issueItems: S.issueItems, returnItem: S.returnItem, raiseDispute: S.raiseDispute,
  walkSharing: own((d, on) => { d.walk.sharing = !!on; }),
  skipMissingTimer: own((d) => { if (d.walk.missing) d.walk.missing.until = Date.now(); }),
  closeWalk: own((d) => { d.walk = null; }),
  notify: (d, role, msg, kind) => S.toast(d, role, msg, kind),
  gateFace: (d, r) => {
    const me = studentOf(d);
    S.gateFaceResult(d, r);
    const pct = r.sim != null ? `${(r.sim * 100).toFixed(0)}%` : '';
    S.toast(d, 'guard', r.ok ? `Gate face check: ${me.name} matched 1:1 (${pct})` : r.decision === 'MANUAL CHECK' ? `Gate: ${me.name} needs a manual ID check (${pct})` : `Gate face check rejected: ${(r.reasons || [])[0] || 'no match'}`, r.ok ? 'success' : 'alert');
  },

  // guard
  acceptAlert: S.acceptAlert, toggleLights: S.toggleLights, playSpeaker: S.playSpeaker, resolveAlert: S.resolveAlert,
  skipTime: S.skipTime,
  guardLog: (d, guardName, what, place, alertId) => S.audit(d, `Guard ${guardName}`, `${what} · ${place}`, `Responding to alert ${alertId}`),
  trigger: (d, k) => { if (S.TRIGGERS[k]) S.TRIGGERS[k](d); },
  equipmentLeaving: S.equipmentLeaving, visitorWrongZone: S.visitorWrongZone,

  // cameras
  viewFeed: S.viewFeed, camPtz: S.camPtz, snapshot: S.snapshot, talkDown: S.talkDown,
  flagIncident: S.flagIncident, requestUnblur: S.requestUnblur,
  aiEvent: S.aiEvent, gateQr: S.gateQr,
  // a checkpoint photo filled in later by the device that has the camera there
  attachSnap: (d, walkId, cp, snap) => {
    const st = d.walk && d.walk.id === walkId && d.walk.steps.find((x) => x.cp === cp);
    if (st && st.status === 'passed' && !st.snap && d.walk.phase === 'active') st.snap = snap;
  },

  // admin (laptop console only)
  createVisitor: (d, f) => {
    let n = 201 + d.visitors.length;
    while (findVisitor(d, `V-${n}`)) n += 1;
    const id = `V-${n}`;
    d.visitors.unshift({ id, ...f, name: f.name.trim(), status: 'expected', created: Date.now() });
    S.audit(d, ADMIN, `Created visitor pass ${id} · ${f.name.trim()}`, `${f.purpose} at ${f.dest}`, 'lookup');
    S.toast(d, 'admin', `Pass ${id} created. QR sent by SMS`, 'success');
    S.toast(d, 'guard', `Visitor expected: ${f.name.trim()} → ${f.dest}`, 'info');
    return id;
  },
  visitorIn: (d, id) => {
    const v = findVisitor(d, id); if (!v) return;
    v.status = 'inside'; v.checkedInAt = Date.now();
    S.toast(d, 'admin', `${v.name} checked in at Main Gate`, 'success');
  },
  visitorOut: (d, id) => {
    const v = findVisitor(d, id); if (!v) return;
    v.status = 'left'; v.leftAt = Date.now();
    S.toast(d, 'admin', `${v.name} checked out. Pass closed`, 'info');
  },
  stockReport: (d) => S.audit(d, ADMIN, 'Generated yearly stock verification report', 'Annual audit, Electronics Lab', 'lookup'),
};

// Actions only the laptop console may run when phones are paired to the hub.
export const ADMIN_ONLY = new Set(['createVisitor', 'visitorIn', 'visitorOut', 'stockReport']);

export function applyAction(d, name, args = [], who = null) {
  const fn = ACTIONS[name];
  if (!fn) throw new Error('Unknown action: ' + name);
  if (who) { S.upsertUser(d, who); d.me = d.users[who.id] || null; }
  try { return fn(d, ...args); } finally { delete d.me; }
}
