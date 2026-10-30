// Shared UI building blocks.
import { useEffect, useMemo, useRef, useState } from 'react';
import qrcode from 'qrcode-generator';
import { CP, cls, pad } from './data.js';
import { useApp } from './store.js';

const ICONS = {
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  qr: '<rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/>',
  walk: '<circle cx="13" cy="4" r="2"/><path d="M12.4 8 11 14"/><path d="m8 11.5 4.3-2.6 3.2 3.1"/><path d="M11 14 8 21"/><path d="m11 14 3 3v4"/>',
  flask: '<path d="M9 3h6"/><path d="M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3"/><path d="M7 15h10"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  shieldCheck: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14"/><path d="M15 6v14"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  checkCircle: '<circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  xCircle: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  cameraOff: '<path d="m2 2 20 20"/><path d="M7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16"/><path d="M9.5 4h5L17 7h3a2 2 0 0 1 2 2v7.5"/><path d="M14.12 15.12A3 3 0 1 1 9.88 10.88"/>',
  fingerprint: '<path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/><path d="M14 13.12c0 2.38 0 6.38-1 8.88"/><path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/><path d="M2 12a10 10 0 0 1 18-6"/><path d="M2 16h.01"/><path d="M21.8 16c.2-2 .131-5.354 0-6"/><path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2"/><path d="M8.65 22c.21-.66.45-1.32.57-2"/><path d="M9 6.8a6 6 0 0 1 9 5.2v2"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  bulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
  speaker: '<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>',
  nav: '<polygon points="3 11 22 2 13 21 11 13 3 11"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98"/><path d="m15.41 6.51-6.82 3.98"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  chevR: '<path d="m9 18 6-6-6-6"/>',
  chevL: '<path d="m15 18-6-6 6-6"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  tailgate: '<circle cx="8" cy="5" r="2"/><circle cx="16" cy="5" r="2"/><path d="M8 9v6l-2 6"/><path d="M8 15l2 6"/><path d="M16 9v6l-2 6"/><path d="M16 15l2 6"/><path d="M3 12h18" stroke-dasharray="2 2"/>',
  box: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  minus: '<path d="M5 12h14"/>',
  login: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5"/><path d="M15 12H3"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/>',
  chart: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  columns: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="M15 3v18"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  idcard: '<rect width="20" height="14" x="2" y="5" rx="2"/><circle cx="8" cy="12" r="2"/><path d="M14 10h4"/><path d="M14 14h4"/>',
  badge: '<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9 2v3h6V2"/><circle cx="12" cy="11" r="2.5"/><path d="M8 18a4 4 0 0 1 8 0"/>',
  cpu: '<rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  video: '<path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2"/>',
  vibrate: '<path d="m2 8 2 2-2 2 2 2-2 2"/><path d="m22 8-2 2 2 2-2 2 2 2"/><rect width="8" height="14" x="8" y="5" rx="1"/>',
  siren: '<path d="M7 18v-6a5 5 0 1 1 10 0v6"/><path d="M5 21a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2z"/><path d="M21 12h1"/><path d="M18.5 4.5 18 5"/><path d="M2 12h1"/><path d="M12 2v1"/><path d="m4.93 4.93.71.71"/>',
  fence: '<path d="M4 3 2 5v15c0 .6.4 1 1 1h2c.6 0 1-.4 1-1V5Z"/><path d="M6 8h4"/><path d="M6 18h4"/><path d="m12 3-2 2v15c0 .6.4 1 1 1h2c.6 0 1-.4 1-1V5Z"/><path d="M14 8h4"/><path d="M14 18h4"/><path d="m20 3-2 2v15c0 .6.4 1 1 1h2c.6 0 1-.4 1-1V5Z"/>',
  forward: '<polygon points="13 19 22 12 13 5 13 19"/><polygon points="2 19 11 12 2 5 2 19"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  printer: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
};

export function Icon({ name, className = 'h-5 w-5', sw = 2 }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
      className={cls('shrink-0', className)} aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS[name] || ICONS.info }} />
  );
}

export function Logo({ className = 'h-8 w-8' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="#1E3A8A" stroke="#fff" strokeWidth="1.2" />
      <path d="m8.6 12 2.4 2.4 4.4-4.6" stroke="#F59E0B" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Default white card; a bg-* or ring colour in className replaces the default instead of fighting it.
export const Card = ({ className = '', children, ...p }) => (
  <div className={cls('rounded-2xl p-4 shadow-sm ring-1', !/(^|\s)bg-(?!gradient)/.test(className) && 'bg-white',
    !/(^|\s)ring-(?!\d|inset)/.test(className) && 'ring-slate-200/70', className)} {...p}>{children}</div>
);

const BTN = {
  primary: 'bg-navy text-white hover:bg-navy-light active:bg-navy-dark shadow-sm',
  accent: 'bg-saffron text-slate-900 hover:brightness-105 active:brightness-95 shadow-sm',
  danger: 'bg-red-600 text-white hover:bg-red-500 active:bg-red-700 shadow-sm',
  success: 'bg-emerald-600 text-white hover:bg-emerald-500 active:bg-emerald-700 shadow-sm',
  outline: 'bg-white text-navy ring-1 ring-inset ring-slate-300 hover:bg-slate-50 active:bg-slate-100',
  soft: 'bg-blue-50 text-navy hover:bg-blue-100 active:bg-blue-200',
  ghost: 'text-navy hover:bg-slate-100',
  dark: 'bg-white/10 text-white ring-1 ring-inset ring-white/20 hover:bg-white/20',
};
export function Btn({ v = 'primary', size = 'md', icon, className, children, disabled, ...p }) {
  const sz = { sm: 'min-h-9 py-1.5 px-3 text-[13px] rounded-xl gap-1.5', md: 'min-h-12 py-2 px-4 text-[15px] rounded-2xl gap-2', lg: 'min-h-14 py-2 px-5 text-base rounded-2xl gap-2' }[size];
  return (
    <button type="button" disabled={disabled}
      className={cls('inline-flex items-center justify-center text-center leading-tight font-semibold transition active:scale-[.98] disabled:opacity-40 disabled:pointer-events-none', sz, BTN[v], className)} {...p}>
      {icon && <Icon name={icon} className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} />}
      {children}
    </button>
  );
}

export const Badge = ({ className, children }) => (
  <span className={cls('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', className)}>{children}</span>
);

export function Toggle({ on, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={cls('relative h-7 w-12 shrink-0 rounded-full transition-colors', on ? 'bg-emerald-500' : 'bg-slate-300')}>
      <span className={cls('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all', on ? 'left-[22px]' : 'left-0.5')} />
    </button>
  );
}

export function Stepper({ value, onChange, max = 99 }) {
  return (
    <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
      <button type="button" aria-label="Less" onClick={() => onChange(Math.max(0, value - 1))}
        className="grid h-8 w-8 place-items-center rounded-lg bg-white text-navy shadow-sm active:scale-95 disabled:opacity-40" disabled={value <= 0}>
        <Icon name="minus" className="h-4 w-4" />
      </button>
      <span className="w-8 text-center font-bold tabular-nums">{value}</span>
      <button type="button" aria-label="More" onClick={() => onChange(Math.min(max, value + 1))}
        className="grid h-8 w-8 place-items-center rounded-lg bg-white text-navy shadow-sm active:scale-95 disabled:opacity-40" disabled={value >= max}>
        <Icon name="plus" className="h-4 w-4" />
      </button>
    </div>
  );
}

export function Sheet({ onClose, title, children, tall }) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end">
      <div className="fade-in absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div className={cls('sheet relative flex flex-col rounded-t-[28px] bg-white shadow-2xl', tall ? 'max-h-[92%]' : 'max-h-[85%]')}>
        <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-slate-300" />
        {title && (
          <div className="flex shrink-0 items-center justify-between px-5 pb-1 pt-3">
            <h3 className="text-lg font-bold text-slate-900">{title}</h3>
            <button type="button" aria-label="Close" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200">
              <Icon name="x" className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="no-scrollbar overflow-y-auto px-5 pb-6 pt-2">{children}</div>
      </div>
    </div>
  );
}

export function Ring({ value, max, size = 48, stroke = 4, color = '#F59E0B', track = '#e2e8f0', children, className }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(1, value / max)));
  return (
    <div className={cls('relative shrink-0', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset .25s linear' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

export function QR({ text, size = 200, fade }) {
  const { n, path } = useMemo(() => {
    const q = qrcode(0, 'H');
    q.addData(text);
    q.make();
    const count = q.getModuleCount();
    let d = '';
    for (let r = 0; r < count; r++) for (let c = 0; c < count; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    return { n: count, path: d };
  }, [text]);
  const logo = n * 0.22;
  return (
    <svg viewBox={`-2 -2 ${n + 4} ${n + 4}`} width={size} height={size} shapeRendering="crispEdges" className={cls('rounded-xl', fade && 'fade-in')} role="img" aria-label="Rotating QR code">
      <rect x="-2" y="-2" width={n + 4} height={n + 4} fill="#fff" />
      <path d={path} fill="#0f172a" />
      <g transform={`translate(${(n - logo) / 2} ${(n - logo) / 2})`} shapeRendering="geometricPrecision">
        <rect width={logo} height={logo} rx={logo * 0.22} fill="#fff" />
        <svg x={logo * 0.1} y={logo * 0.1} width={logo * 0.8} height={logo * 0.8} viewBox="0 0 24 24">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="#1E3A8A" />
          <path d="m8.6 12 2.4 2.4 4.4-4.6" stroke="#F59E0B" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        </svg>
      </g>
    </svg>
  );
}

export function Avatar({ size = 48, className }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={cls('shrink-0 rounded-full ring-2 ring-white', className)} role="img" aria-label="Priya Sharma photo">
      <circle cx="32" cy="32" r="32" fill="#FDE68A" />
      <path d="M17 27c-1 10 0 17 4 21l5-3c-3-4-4-10-3-16z" fill="#1f2937" />
      <path d="M47 27c1 10 0 17-4 21l-5-3c3-4 4-10 3-16z" fill="#1f2937" />
      <path d="M10 64c2-12 11-18 22-18s20 6 22 18z" fill="#1E3A8A" />
      <path d="M27 42h10v6a5 5 0 0 1-10 0z" fill="#B97A4E" />
      <ellipse cx="32" cy="30" rx="11" ry="13" fill="#C98B5C" />
      <path d="M20 29c0-11 6-16 12-16s13 5 12 16c-3-6-7-9-12-9.5-2 3-7 7-12 9.5z" fill="#1f2937" />
      <circle cx="32" cy="23.5" r="1.1" fill="#dc2626" />
      <circle cx="27.5" cy="31" r="1.2" fill="#1f2937" />
      <circle cx="36.5" cy="31" r="1.2" fill="#1f2937" />
      <path d="M29 37c1.8 1.4 4.2 1.4 6 0" stroke="#7c2d12" strokeWidth="1.3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// Night-time still from a checkpoint camera (illustration).
export function NightPhoto({ cp, time, className, deleted }) {
  const ts = new Date(time);
  const stamp = `CAM-${CP[cp].tag.toUpperCase()} · ${pad(ts.getHours())}:${pad(ts.getMinutes())}:${pad(ts.getSeconds())}`;
  return (
    <div className={cls('relative overflow-hidden rounded-xl bg-slate-900', className)}>
      <svg viewBox="0 0 160 100" className={cls('h-full w-full', deleted && 'opacity-30 grayscale')} preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id={`lamp-${cp}`} cx="0.72" cy="0.18" r="0.6">
            <stop offset="0" stopColor="#fde68a" stopOpacity=".55" />
            <stop offset="1" stopColor="#0f172a" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="160" height="100" fill="#0b1224" />
        <rect width="160" height="100" fill={`url(#lamp-${cp})`} />
        <path d="M0 78 L160 64 L160 100 L0 100Z" fill="#1e293b" />
        <path d="M40 100 L95 66 L110 66 L90 100Z" fill="#334155" />
        <rect x="114" y="14" width="2.5" height="56" fill="#475569" />
        <path d="M108 14h16" stroke="#475569" strokeWidth="2.5" />
        <circle cx="120" cy="16" r="2.5" fill="#fde68a" />
        <rect x="8" y="30" width="26" height="40" fill="#1e293b" />
        <rect x="12" y="36" width="5" height="5" fill="#f59e0b" opacity=".6" />
        <rect x="22" y="46" width="5" height="5" fill="#f59e0b" opacity=".4" />
        <g transform="translate(78 44)">
          <circle cx="0" cy="0" r="4.2" fill="#94a3b8" />
          <path d="M-5 6 Q0 3 5 6 L6 22 L-6 22Z" fill="#64748b" />
          <path d="M-3 22 L-4 32 M3 22 L4 32" stroke="#64748b" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M-5 9 l-3 9 M5 9 l3 9" stroke="#64748b" strokeWidth="2" strokeLinecap="round" />
        </g>
      </svg>
      <div className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded bg-black/50 px-1 py-0.5 font-mono text-[8px] text-white">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500 blink" />{stamp}
      </div>
      {deleted && (
        <div className="absolute inset-0 grid place-items-center">
          <span className="flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-slate-700"><Icon name="trash" className="h-3 w-3" />Deleted</span>
        </div>
      )}
    </div>
  );
}

// 10 second clip placeholder. Plays a fake clip and logs the view in the audit log.
export function ClipPlayer({ cp, onView, label = '10 s clip · faces blurred' }) {
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState(false);
  const play = () => {
    if (playing) return;
    setPlaying(true); setDone(false);
    onView && onView();
    setTimeout(() => { setPlaying(false); setDone(true); }, 10000);
  };
  return (
    <button type="button" onClick={play} className="group relative block aspect-video w-full overflow-hidden rounded-xl bg-slate-900 text-left">
      <svg viewBox="0 0 160 90" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
        <rect width="160" height="90" fill="#111827" />
        <path d="M0 70 L160 58 L160 90 L0 90Z" fill="#1f2937" />
        <rect x="10" y="20" width="30" height="40" fill="#1f2937" />
        <rect x="120" y="10" width="2" height="50" fill="#374151" />
        <g className={playing ? 'transition-transform duration-[10000ms] ease-linear' : ''} style={{ transform: playing ? 'translateX(46px)' : 'none' }}>
          <rect x="52" y="40" width="10" height="10" fill="#6b7280" />
          <rect x="50" y="50" width="14" height="20" fill="#4b5563" />
          <rect x="70" y="42" width="9" height="9" fill="#6b7280" />
          <rect x="68" y="51" width="13" height="19" fill="#4b5563" />
        </g>
        {Array.from({ length: 12 }).map((_, i) => <rect key={i} x="0" y={i * 8} width="160" height="1" fill="#fff" opacity=".03" />)}
      </svg>
      <div className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded bg-black/50 px-1.5 py-0.5 font-mono text-[9px] text-white">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500 blink" />CAM-{CP[cp].tag.toUpperCase()}
      </div>
      {!playing && (
        <div className="absolute inset-0 grid place-items-center">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-white/90 text-navy shadow-lg transition group-hover:scale-105">
            <Icon name={done ? 'refresh' : 'play'} className="h-5 w-5" />
          </span>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-4 text-[10px] font-medium text-white">
        {playing ? 'Playing… view logged in audit' : label}
        {playing && <div className="mt-1 h-1 overflow-hidden rounded bg-white/20"><div className="h-full bg-saffron" style={{ animation: 'progress 10s linear both' }} /></div>}
      </div>
    </button>
  );
}

// Full-screen "scanning" animation that walks through a list of steps, then calls onDone.
export function ScanOverlay({ title, subtitle, steps, duration = 2400, mode = 'qr', onDone }) {
  const [t, setT] = useState(0);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const e = Date.now() - start;
      setT(e);
      if (e >= duration) { clearInterval(id); done.current(); }
    }, 80);
    return () => clearInterval(id);
  }, [duration]);
  const per = duration / steps.length;
  return (
    <div className="fade-in absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/[.96] p-6 text-white">
      <div className="text-xs font-semibold uppercase tracking-[.2em] text-saffron">{subtitle}</div>
      <div className="mt-1 text-center text-lg font-bold">{title}</div>
      <div className="relative mt-6 h-52 w-52 overflow-hidden rounded-3xl bg-slate-900 ring-1 ring-white/10">
        {['left-3 top-3 border-l-4 border-t-4 rounded-tl-xl', 'right-3 top-3 border-r-4 border-t-4 rounded-tr-xl', 'left-3 bottom-3 border-l-4 border-b-4 rounded-bl-xl', 'right-3 bottom-3 border-r-4 border-b-4 rounded-br-xl'].map((c) => (
          <span key={c} className={cls('absolute h-8 w-8 border-saffron', c)} />
        ))}
        <div className="absolute inset-0 grid place-items-center text-slate-500">
          {mode === 'face' && (
            <svg viewBox="0 0 100 100" className="h-32 w-32">
              <ellipse cx="50" cy="44" rx="22" ry="27" fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="4 4" />
              <circle cx="41" cy="40" r="2.5" fill="#94a3b8" /><circle cx="59" cy="40" r="2.5" fill="#94a3b8" />
              <path d="M42 56c5 4 11 4 16 0" stroke="#94a3b8" strokeWidth="2" fill="none" strokeLinecap="round" />
              <path d="M20 98c4-16 16-22 30-22s26 6 30 22" fill="none" stroke="#94a3b8" strokeWidth="2" />
            </svg>
          )}
          {mode === 'qr' && <Icon name="qr" className="h-24 w-24" sw={1.4} />}
          {mode === 'weight' && <Icon name="box" className="h-24 w-24" sw={1.4} />}
        </div>
        <div className="scanline" />
      </div>
      <ul className="mt-6 w-full max-w-[260px] space-y-2.5">
        {steps.map((st, i) => {
          const isDone = t >= per * (i + 1) - 40;
          const active = !isDone && t >= per * i;
          return (
            <li key={st} className="flex items-center gap-2.5 text-sm">
              {isDone ? (
                <span className="pop grid h-5 w-5 place-items-center rounded-full bg-emerald-500"><Icon name="check" className="h-3.5 w-3.5" sw={3} /></span>
              ) : active ? (
                <span className="spin h-5 w-5 rounded-full border-2 border-saffron border-t-transparent" />
              ) : (
                <span className="h-5 w-5 rounded-full border-2 border-slate-600" />
              )}
              <span className={isDone ? 'text-white' : active ? 'text-slate-200' : 'text-slate-500'}>{st}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Result sheet used after scans and checks.
export function ResultSheet({ ok, title, rows = [], note, onClose, actions }) {
  return (
    <Sheet onClose={onClose}>
      <div className="flex flex-col items-center pt-2 text-center">
        <div className={cls('pop grid h-20 w-20 place-items-center rounded-full', ok ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600')}>
          <Icon name={ok ? 'check' : 'x'} className="h-10 w-10" sw={3} />
        </div>
        <h3 className={cls('mt-4 text-xl font-bold', ok ? 'text-slate-900' : 'text-red-700')}>{title}</h3>
        {note && <p className="mt-1 text-sm text-slate-500">{note}</p>}
      </div>
      {rows.length > 0 && (
        <div className="mt-5 divide-y divide-slate-100 rounded-2xl bg-slate-50 px-4">
          {rows.map(([k, v, good]) => (
            <div key={k} className="flex items-center justify-between py-3 text-sm">
              <span className="text-slate-600">{k}</span>
              <span className={cls('flex items-center gap-1 font-semibold', good === false ? 'text-red-600' : good ? 'text-emerald-600' : 'text-slate-900')}>
                {v}{good === true && <Icon name="check" className="h-4 w-4" sw={3} />}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-5 space-y-2">{actions || <Btn className="w-full" onClick={onClose}>Done</Btn>}</div>
    </Sheet>
  );
}

const TOAST_STYLE = {
  success: ['bg-emerald-600', 'checkCircle'],
  alert: ['bg-red-600', 'alert'],
  warn: ['bg-amber-500', 'alert'],
  info: ['bg-navy', 'bell'],
};
const ROLE_LABEL = { student: 'Student app', guard: 'Guard app', admin: 'Admin' };

// In single-phone mode, toasts for other roles show as a "push notification" you can tap to jump there.
export function Toasts({ role }) {
  const { s, split, setRole } = useApp();
  const own = s.toasts.filter((t) => t.role === role).slice(-2);
  const other = split ? [] : s.toasts.filter((t) => t.role !== role && t.role !== 'all').slice(-1);
  const list = [...other, ...own];
  if (!list.length) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[52px] z-[60] flex flex-col items-center gap-2 px-3" aria-live="polite">
      {list.map((t) => {
        const [bg, ic] = TOAST_STYLE[t.kind] || TOAST_STYLE.info;
        const other = t.role !== role;
        return other ? (
          <button key={t.id} type="button" onClick={() => setRole(t.role)}
            className="toast-in pointer-events-auto flex w-full items-center gap-3 rounded-2xl bg-white/95 p-3 text-left shadow-xl ring-1 ring-slate-200 backdrop-blur">
            <span className={cls('grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white', bg)}><Icon name={ic} className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">{ROLE_LABEL[t.role]} · tap to open</span>
              <span className="block truncate text-sm font-medium text-slate-800">{t.msg}</span>
            </span>
          </button>
        ) : (
          <div key={t.id} className={cls('toast-in flex w-full items-center gap-2.5 rounded-2xl px-3.5 py-3 text-sm font-medium text-white shadow-xl', bg)}>
            <Icon name={ic} className="h-5 w-5" />
            <span className="min-w-0 flex-1">{t.msg}</span>
          </div>
        );
      })}
    </div>
  );
}

export function BottomNav({ items, value, onChange }) {
  return (
    <nav className="relative z-20 flex shrink-0 border-t border-slate-200 bg-white/95 px-1.5 pb-[max(6px,env(safe-area-inset-bottom))] pt-1 backdrop-blur">
      {items.map((it) => {
        const on = it.id === value;
        return (
          <button key={it.id} type="button" onClick={() => onChange(it.id)} aria-current={on ? 'page' : undefined}
            className={cls('flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] transition', on ? 'font-semibold text-navy' : 'text-slate-500 hover:text-slate-700')}>
            <span className={cls('relative grid h-8 w-12 place-items-center rounded-full transition', on && 'bg-blue-100')}>
              <Icon name={it.icon} className="h-5 w-5" sw={on ? 2.3 : 2} />
              {it.badge > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">{it.badge}</span>}
              {it.dot && <span className="absolute right-1 top-0.5 h-2.5 w-2.5 rounded-full bg-saffron ring-2 ring-white blink" />}
            </span>
            {it.label}
          </button>
        );
      })}
    </nav>
  );
}

export function ScreenHeader({ title, sub, right, onBack }) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200/70 bg-slate-50/90 px-4 py-3 backdrop-blur">
      {onBack && (
        <button type="button" aria-label="Back" onClick={onBack} className="grid h-9 w-9 place-items-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-200">
          <Icon name="chevL" className="h-5 w-5" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-bold text-slate-900">{title}</h1>
        {sub && <p className="truncate text-xs text-slate-500">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export const SectionTitle = ({ children, right }) => (
  <div className="mb-2 mt-1 flex items-center justify-between px-1">
    <h2 className="text-[13px] font-bold uppercase tracking-wide text-slate-500">{children}</h2>
    {right}
  </div>
);

export function DemoPanel({ title = 'Demo controls', children }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-100/60 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
        <Icon name="zap" className="h-3.5 w-3.5" />{title}
      </div>
      {children}
    </div>
  );
}

export const LiveDot = ({ className }) => (
  <span className={cls('relative inline-flex h-2 w-2', className)}>
    <span className="pulse-ring-html absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
  </span>
);

export function useFastNow(ms = 200) {
  const [n, setN] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setN(Date.now()), ms); return () => clearInterval(id); }, [ms]);
  return n;
}

