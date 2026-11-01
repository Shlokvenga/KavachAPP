// Gate pass verification: valid, expired, forged and malformed codes.
// Run with: npm test
import { QR_PERIOD, qrCode, verifyQr } from '../src/data.js';

const now = Date.now();
const slot = Math.floor(now / (QR_PERIOD * 1000));
const cases = [
  ['current code', qrCode('21BRS045', slot), true],
  ['previous window (screenshot < 20 s)', qrCode('21BRS045', slot - 1), true],
  ['screenshot 30 s old', qrCode('21BRS045', slot - 3), false],
  ['code from the future', qrCode('21BRS045', slot + 2), false],
  ['forged signature', `KAVACH|21BRS045|${slot}|ABCDEF`, false],
  ['ID swapped, old signature', qrCode('21BRS045', slot).replace('21BRS045', '21BRS046'), false],
  ['not a pass', 'https://example.com', false],
];
let fail = 0;
for (const [name, text, want] of cases) {
  const r = verifyQr(text, now);
  const ok = r.ok === want;
  if (!ok) fail++;
  console.log(ok ? 'PASS' : 'FAIL', name.padEnd(36), r.ok ? 'accepted' : `rejected: ${r.reason}`);
}
process.exit(fail ? 1 : 0);
