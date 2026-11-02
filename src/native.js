// The Android app's own plugin (android/.../KavachNativePlugin.java): fingerprint
// prompt, back button and "move to background". In a browser these report that
// fingerprint is unavailable, and the app falls back to the password.
import { Capacitor, registerPlugin } from '@capacitor/core';

const Native = registerPlugin('KavachNative');

export const isNative = () => Capacitor.isNativePlatform();

// { available, reason }: reason is 'none-enrolled' | 'no-hardware' | 'unavailable' | 'web'
export async function biometricStatus() {
  if (!isNative()) return { available: false, reason: 'web' };
  try { return await Native.biometricStatus(); } catch (e) { return { available: false, reason: 'unavailable' }; }
}

// Shows the system fingerprint prompt. Resolves true on a match; false if the user
// cancelled or chose the password instead; throws with a message on other errors
// (too many attempts, sensor locked).
export async function fingerprint(title = 'Unlock Kavach', subtitle = 'Touch the fingerprint sensor') {
  if (!isNative()) return false;
  try {
    await Native.authenticate({ title, subtitle, cancel: 'Use password' });
    return true;
  } catch (e) {
    if (e && ['cancelled', 'password'].includes(e.code)) return false;
    throw new Error((e && e.message) || 'Fingerprint failed');
  }
}

export function onBackButton(handler) {
  if (!isNative()) return () => {};
  const p = Native.addListener('backButton', handler);
  return () => { Promise.resolve(p).then((h) => h && h.remove()); };
}

export function moveToBackground() {
  if (isNative()) Native.minimize().catch(() => {});
}
