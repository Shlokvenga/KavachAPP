// Android back button / back gesture. Screens register what "back" means for them
// (close a sheet, leave a sub-page, return to the Home tab); the newest handler with
// the highest level runs. When nothing is registered the app goes to the background
// instead of quitting, so the login stays (see phone.jsx).
import { useEffect, useRef } from 'react';

export const BACK = { tab: 0, page: 1, sheet: 2, block: 3 };

const stack = [];
let seq = 0;

export function pushBack(fn, level = BACK.page) {
  const e = { fn, level, n: ++seq };
  stack.push(e);
  return () => { const i = stack.indexOf(e); if (i >= 0) stack.splice(i, 1); };
}

// Pass a no-op with BACK.block to stop "back" while something must not be dismissed.
export function useBack(fn, active = true, level = BACK.page) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => (active && fn ? pushBack(() => ref.current && ref.current(), level) : undefined), [active, level, !!fn]);
}

// Returns false when there is nothing to go back to.
export function runBack() {
  if (!stack.length) return false;
  const top = stack.reduce((a, b) => (b.level > a.level || (b.level === a.level && b.n > a.n) ? b : a));
  top.fn();
  return true;
}
