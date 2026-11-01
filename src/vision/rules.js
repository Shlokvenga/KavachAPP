// Behaviour analytics on top of the anonymous tracker. Every rule is explainable:
// an event carries the measured values and the threshold that fired it, so a guard
// (and the audit log) can see exactly why the AI raised an alert.
import { Tracker, center, foot, heading, speed, wander } from './tracker.js';

const BAGS = new Set(['backpack', 'handbag', 'suitcase']);
const ASSETS = new Set(['laptop']); // stand-in for RFID lab equipment in the demo
const COOLDOWN_S = 25;

export const RULES = {
  crowd: { name: 'Crowding', alert: 'crowd', about: 'Too many people in view' },
  loiter: { name: 'Loitering', alert: 'loiter', about: 'Someone stays in one spot too long' },
  running: { name: 'Running', alert: 'running', about: 'Sudden running (chase or panic)' },
  follow: { name: 'Following', alert: 'follower', about: 'One person keeps pace behind another' },
  fall: { name: 'Fall', alert: 'fall', about: 'Person goes from standing to lying' },
  bag: { name: 'Unattended bag', alert: 'bag', about: 'Bag left with nobody near' },
  intrusion: { name: 'Line crossing', alert: 'wall', about: 'Person crosses the perimeter line' },
  tailgate: { name: 'Tailgating', alert: 'tailgate', about: 'More people pass than QR scans' },
  asset: { name: 'Asset exit', alert: 'lab', about: 'Laptop carried through the lab door' },
  tamper: { name: 'Camera tamper', alert: 'tamper', about: 'Lens covered, blurred or camera moved' },
};

// Default rules and thresholds per camera scene (see src/campus.js).
// Thresholds are demo-friendly; `sensitivity` (0.5..1.5) scales them.
function defaults(cam) {
  const base = { sensitivity: 1, crowdN: 4, loiterS: 15, runBL: 2.0, followS: 5, bagS: 12, enabled: {} };
  const on = (...r) => Object.fromEntries(Object.keys(RULES).map((k) => [k, r.includes(k)]));
  switch (cam.scene) {
    case 'gate': return { ...base, crowdN: 5, enabled: on('tailgate', 'crowd', 'running', 'tamper'), line: [0.05, 0.62, 0.95, 0.62] };
    case 'wall': return { ...base, enabled: on('intrusion', 'loiter', 'tamper'), line: [0.5, 0.05, 0.5, 0.95], loiterS: 8 };
    case 'building': return { ...base, enabled: on('asset', 'loiter', 'fall', 'tamper'), line: [0.05, 0.7, 0.95, 0.7] };
    case 'junction': return { ...base, enabled: on('crowd', 'bag', 'loiter', 'running', 'tamper') };
    case 'lawn': return { ...base, enabled: on('crowd', 'bag', 'loiter', 'fall', 'tamper') };
    default: return { ...base, enabled: on('follow', 'running', 'loiter', 'fall', 'tamper') }; // paths
  }
}

const side = (line, p) => {
  const [x1, y1, x2, y2] = line;
  return (x2 - x1) * (p[1] - y1) - (y2 - y1) * (p[0] - x1);
};

// Camera tamper from classic image statistics (no ML): covered / blurred / moved.
class TamperWatch {
  constructor() { this.base = null; this.baseSharp = 0; this.since = {}; this.frames = 0; }
  check(st, t) {
    this.frames += 1;
    if (!this.base) { this.base = st.thumb.slice(); this.baseSharp = st.sharp; return null; }
    let diff = 0;
    for (let i = 0; i < st.thumb.length; i++) diff += Math.abs(st.thumb[i] - this.base[i]);
    diff /= st.thumb.length;
    const cond = {
      covered: st.mean < 22 || st.std < 7,
      blurred: this.baseSharp > 40 && st.sharp < this.baseSharp * 0.28,
      moved: diff > 38 && st.motion < 3,
    };
    const need = { covered: 2, blurred: 3, moved: 4 };
    let hit = null;
    for (const k of Object.keys(cond)) {
      if (cond[k]) { this.since[k] = this.since[k] ?? t; if (t - this.since[k] >= need[k]) hit = hit || k; }
      else delete this.since[k];
    }
    if (!hit && this.frames > 5) {
      // adapt slowly to lighting changes while the view is normal
      for (let i = 0; i < st.thumb.length; i++) this.base[i] = this.base[i] * 0.97 + st.thumb[i] * 0.03;
      this.baseSharp = this.baseSharp * 0.97 + st.sharp * 0.03;
    }
    if (hit === 'moved') { this.base = st.thumb.slice(); this.since = {}; }
    return hit ? { kind: hit, mean: st.mean, std: st.std, sharp: st.sharp, baseSharp: this.baseSharp, diff } : null;
  }
}

export function createAnalyzer(cam) {
  const tracker = new Tracker();
  const tamper = new TamperWatch();
  const cfg = defaults(cam);
  const cooldown = {};
  const pairSince = {};
  let crowdSince = null;
  const crossings = [];

  const ready = (key, t) => !(cooldown[key] && t - cooldown[key] < COOLDOWN_S);
  const fire = (out, t, key, ev) => { if (!ready(key, t)) return; cooldown[key] = t; out.push({ cam: cam.id, cp: cam.cp, ...ev }); };

  function analyze(dets, t, stats, ctx = {}) {
    const k = cfg.sensitivity;
    const out = [];
    tracker.update(dets, t);
    const people = tracker.live('person');
    const E = cfg.enabled;

    if (E.crowd) {
      const n = people.length;
      const limit = Math.max(2, Math.round(cfg.crowdN / k));
      if (n >= limit) {
        crowdSince = crowdSince ?? t;
        if (t - crowdSince >= 2) fire(out, t, 'crowd', { rule: 'crowd', conf: Math.min(0.99, 0.6 + (n - limit) * 0.1), ids: people.map((p) => p.id), explain: `${n} people in view for ${Math.round(t - crowdSince)} s (rule: ${limit} or more)` });
      } else crowdSince = null;
    }

    for (const p of people) {
      const age = t - p.first;
      if (E.loiter && age >= cfg.loiterS / k) {
        const w = wander(p, 8);
        if (w < 0.9) fire(out, t, 'loiter' + p.id, { rule: 'loiter', conf: Math.min(0.95, 0.55 + (age - cfg.loiterS) / 60), ids: [p.id], explain: `#${p.id} stayed within ${w.toFixed(1)} body-heights for ${Math.round(age)} s (rule: over ${Math.round(cfg.loiterS / k)} s)` });
      }
      if (E.running) {
        const v = speed(p, 0.8);
        const lim = cfg.runBL / k;
        if (v > lim && p.hist.length >= 4) {
          p.tags.fast = (p.tags.fast || 0) + 1;
          if (p.tags.fast >= 2) fire(out, t, 'run' + p.id, { rule: 'running', conf: Math.min(0.95, 0.5 + (v - lim) / 4), ids: [p.id], explain: `#${p.id} moving at ${v.toFixed(1)} body-lengths/s (walking is about 0.5–1, rule: over ${lim.toFixed(1)})` });
        } else p.tags.fast = 0;
      }
      if (E.fall) {
        const now = p.box[3] / Math.max(0.01, p.box[2]);
        const before = p.hist.filter((h) => t - h.t <= 2.5 && t - h.t >= 0.6).map((h) => h.box[3] / Math.max(0.01, h.box[2]));
        const wasUp = before.length && Math.max(...before) > 1.25;
        if (wasUp && now < 0.95) {
          p.tags.down = p.tags.down ?? t;
          if (t - p.tags.down >= 0.6) fire(out, t, 'fall' + p.id, { rule: 'fall', conf: Math.min(0.95, 0.55 + (Math.max(...before) - now) / 3), ids: [p.id], explain: `#${p.id} went from upright (height/width ${Math.max(...before).toFixed(1)}) to lying (${now.toFixed(1)}) within 2.5 s` });
        } else delete p.tags.down;
      }
    }

    if (E.follow) {
      const moving = people.filter((p) => speed(p, 1.5) > 0.25);
      const seen = new Set();
      for (const a of moving) for (const b of moving) {
        if (a.id >= b.id) continue;
        const ha = heading(a); const hb = heading(b);
        const cos = ha[0] * hb[0] + ha[1] * hb[1];
        const [ax, ay] = center(a.box); const [bx, by] = center(b.box);
        const gap = Math.hypot(ax - bx, ay - by) / ((a.box[3] + b.box[3]) / 2);
        const key = a.id + '-' + b.id;
        seen.add(key);
        if (cos > 0.75 && gap > 0.35 && gap < 2.8) {
          pairSince[key] = pairSince[key] ?? t;
          const dur = t - pairSince[key];
          if (dur >= cfg.followS / k) {
            // the one behind is the one further back along the shared heading
            const behind = (ax - bx) * ha[0] + (ay - by) * ha[1] < 0 ? a : b;
            const ahead = behind === a ? b : a;
            fire(out, t, 'follow' + key, { rule: 'follow', conf: Math.min(0.95, 0.55 + dur / 40), ids: [behind.id, ahead.id], explain: `#${behind.id} kept pace behind #${ahead.id} for ${Math.round(dur)} s at ${gap.toFixed(1)} body-lengths, same direction (cos ${cos.toFixed(2)})` });
          }
        } else delete pairSince[key];
      }
      for (const key of Object.keys(pairSince)) if (!seen.has(key)) delete pairSince[key];
    }

    if (E.bag) {
      for (const o of tracker.live().filter((x) => BAGS.has(x.label))) {
        const near = people.some((p) => { const [px, py] = center(p.box); const [ox, oy] = center(o.box); return Math.hypot(px - ox, py - oy) < 0.18; });
        if (near) o.tags.lastNear = t;
        const alone = t - (o.tags.lastNear ?? o.first);
        if (t - o.first >= cfg.bagS / k && alone >= 5 && wander(o, 8) < 0.4) fire(out, t, 'bag' + o.id, { rule: 'bag', conf: 0.7, ids: [o.id], explain: `${o.label} #${o.id} still for ${Math.round(t - o.first)} s, nobody within reach for ${Math.round(alone)} s` });
      }
    }

    if (cfg.line && (E.intrusion || E.tailgate || E.asset)) {
      const targets = tracker.live().filter((x) => x.label === 'person' || ASSETS.has(x.label));
      for (const tr of targets) {
        const sd = side(cfg.line, foot(tr.box));
        const prev = tr.side.v;
        if (Math.abs(sd) > 0.004) {
          if (prev !== undefined && Math.sign(prev) !== Math.sign(sd)) {
            const dir = sd < 0 ? 'IN' : 'OUT';
            crossings.push({ t, id: tr.id, label: tr.label, dir });
            if (E.intrusion && tr.label === 'person') fire(out, t, 'cross' + tr.id, { rule: 'intrusion', conf: 0.85, ids: [tr.id], explain: `#${tr.id} crossed the perimeter line (${dir === 'IN' ? 'inward' : 'outward'})` });
            if (E.asset && ASSETS.has(tr.label)) fire(out, t, 'asset' + tr.id, { rule: 'asset', conf: 0.75, ids: [tr.id], explain: `${tr.label} #${tr.id} carried across the lab-door line (${dir})` });
          }
          tr.side.v = sd;
        }
      }
      while (crossings.length && t - crossings[0].t > 10) crossings.shift();
      if (E.tailgate) {
        const ins = crossings.filter((c) => c.label === 'person' && c.dir === 'IN' && t - c.t <= 3);
        const scans = ctx.scansSince ? ctx.scansSince(6) : 0;
        if (ins.length >= 2 && ins.length > scans) fire(out, t, 'tailgate', { rule: 'tailgate', conf: Math.min(0.95, 0.6 + (ins.length - scans) * 0.15), ids: ins.map((c) => c.id), explain: `${ins.length} people crossed the gate line within 3 s but only ${scans} QR scan${scans === 1 ? " was" : "s were"} recorded` });
      }
    }

    if (E.tamper && stats) {
      const tm = tamper.check(stats, t);
      if (tm) {
        const why = { covered: `image almost uniform (brightness ${Math.round(tm.mean)}, contrast ${tm.std.toFixed(0)})`, blurred: `sharpness fell to ${Math.round(tm.sharp)} from a normal ${Math.round(tm.baseSharp)}`, moved: `view changed by ${Math.round(tm.diff)} grey levels and stayed changed` }[tm.kind];
        fire(out, t, 'tamper', { rule: 'tamper', conf: 0.8, ids: [], tamper: tm.kind, explain: `Camera ${tm.kind}: ${why}` });
      }
    }

    return { tracks: tracker.tracks, events: out, crossings: crossings.length };
  }

  return { cam, cfg, analyze, tracker };
}
