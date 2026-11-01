// Behaviour rules: scripted movements through the real tracker + rules (no camera, no ML).
// Run with: npm test
import { createAnalyzer } from '../src/vision/rules.js';
const cam = (scene) => ({ id: 'CAM-T', cp: 'B', scene });
const person = (x, y, w = 0.08, h = 0.3) => ({ label: 'person', score: 0.8, box: [x, y, w, h] });
const still = { mean: 120, std: 40, sharp: 300, motion: 2, thumb: new Float32Array(64).fill(120) };
function run(scene, frames, dt = 0.2, ctx = {}, cfgPatch = {}) {
  const A = createAnalyzer(cam(scene));
  Object.assign(A.cfg, cfgPatch);
  const ev = [];
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const out = A.analyze(f.dets || f, i * dt, f.stats || still, ctx);
    ev.push(...out.events);
  }
  return ev.map((e) => e.rule + ': ' + e.explain);
}
const R = {};
// following: two people walking right, 0.12 apart, for 12 s (path camera)
R.follow = run('path', Array.from({ length: 45 }, (_, i) => [person(0.05 + i * 0.012, 0.5, 0.04, 0.12), person(0.15 + i * 0.012, 0.5, 0.04, 0.12)]));
R.walkTogetherShort = run('path', Array.from({ length: 15 }, (_, i) => [person(0.05 + i * 0.012, 0.5, 0.04, 0.12), person(0.15 + i * 0.012, 0.5, 0.04, 0.12)]));
R.oppositeWays = run('path', Array.from({ length: 45 }, (_, i) => [person(0.05 + i * 0.012, 0.5, 0.04, 0.12), person(0.9 - i * 0.012, 0.7, 0.04, 0.12)]));
// walking alone at normal pace: should raise nothing
R.walkAlone = run('path', Array.from({ length: 60 }, (_, i) => [person(0.05 + i * 0.012, 0.4)]));
// running: 0.05 frame-width per 0.2 s with 0.3 body height = ~0.8 bl per 0.2 s
R.running = run('path', Array.from({ length: 7 }, (_, i) => [person(0.02 + i * 0.13, 0.4)]));
// fall: upright then lying
R.fall = run('path', [...Array.from({ length: 10 }, () => [person(0.5, 0.4, 0.1, 0.32)]), ...Array.from({ length: 8 }, () => [person(0.45, 0.62, 0.3, 0.1)])]);
// loiter: standing still 20 s
R.loiter = run('path', Array.from({ length: 100 }, () => [person(0.5, 0.4)]));
// tailgating: two people cross the gate line (y=0.62, moving up) within 1 s, only 1 scan
R.tailgate = run('gate', Array.from({ length: 20 }, (_, i) => [person(0.4, 0.5 - i * 0.03 + 0.2), person(0.55, 0.55 - i * 0.03 + 0.2)]), 0.2, { scansSince: () => 1 });
R.tailgateScanned = run('gate', Array.from({ length: 20 }, (_, i) => [person(0.4, 0.5 - i * 0.03 + 0.2), person(0.55, 0.55 - i * 0.03 + 0.2)]), 0.2, { scansSince: () => 2 });
// perimeter: one person crosses vertical line x=0.5
R.intrusion = run('wall', Array.from({ length: 20 }, (_, i) => [person(0.2 + i * 0.03, 0.4)]));
// crowd at junction: 5 people for 3 s
R.crowd = run('junction', Array.from({ length: 15 }, () => [0.1, 0.25, 0.4, 0.55, 0.7].map((x) => person(x, 0.4))));
// unattended bag: bag still 20 s, owner leaves after 3 s
R.bag = run('junction', Array.from({ length: 100 }, (_, i) => [{ label: 'backpack', score: 0.6, box: [0.5, 0.7, 0.06, 0.08] }, ...(i < 15 ? [person(0.48, 0.4)] : [])]));
// tamper: lens covered (black, flat) for 3 s after a normal view
const covered = { mean: 8, std: 2, sharp: 5, motion: 0, thumb: new Float32Array(64).fill(8) };
R.tamper = run('path', [...Array.from({ length: 10 }, () => ({ dets: [], stats: still })), ...Array.from({ length: 20 }, () => ({ dets: [], stats: covered }))]);
let fail = 0;
const expect = { follow: 'follow', walkTogetherShort: null, oppositeWays: null, walkAlone: null, running: 'running', fall: 'fall', loiter: 'loiter', tailgate: 'tailgate', tailgateScanned: null, intrusion: 'intrusion', crowd: 'crowd', bag: 'bag', tamper: 'tamper' };
for (const [k, want] of Object.entries(expect)) {
  const got = R[k];
  const ok = want ? got.some((e) => e.startsWith(want + ':')) : got.length === 0;
  if (!ok) fail++;
  console.log(ok ? 'PASS' : 'FAIL', k.padEnd(16), got.slice(0, 2).join(' || ') || '(no events)');
}
process.exit(fail ? 1 : 0);
