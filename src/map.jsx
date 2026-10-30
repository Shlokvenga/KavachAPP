// Illustrated campus map shared by Guard (live alerts) and Admin (heatmap).
import { ALERT_TYPES, CP, cls } from './data.js';

const BUILDINGS = [
  { x: 70, y: 118, w: 50, h: 24, label: 'Library' },
  { x: 214, y: 90, w: 58, h: 22, label: 'Workshop' },
  { x: 274, y: 178, w: 54, h: 22, label: 'Canteen' },
  { x: 222, y: 26, w: 64, h: 30, label: 'Girls Hostel D' },
  { x: 20, y: 58, w: 70, h: 24, label: 'Electronics Lab' },
  { x: 24, y: 236, w: 58, h: 26, label: 'Admin Block' },
];
const TREES = [[40, 160], [52, 190], [160, 196], [150, 86], [326, 120], [236, 214], [24, 288], [120, 270], [334, 28], [180, 40], [110, 60], [150, 240]];
const ROADS = [
  'M180 300 L180 252 Q150 238 128 200 L128 152',
  'M128 152 L204 122 L262 168',
  'M262 168 Q312 128 300 70',
  'M180 252 L262 168',
  'M128 152 L66 94',
  'M180 262 L92 228',
];

export default function CampusMap({ alerts = [], guards = [], walk = null, heat = null, selected, onSelect, showGuards = true }) {
  const open = alerts.filter((a) => a.status !== 'resolved');
  const byCp = {};
  const route = walk && walk.phase === 'active' ? walk.steps.map((s) => CP[s.cp]) : null;
  const lastIdx = walk ? walk.steps.map((s) => s.status).lastIndexOf('passed') : -1;
  const walkPos = route && lastIdx >= 0 ? route[lastIdx] : null;
  const maxHeat = heat ? Math.max(1, ...Object.values(heat)) : 1;
  const font = { fontFamily: 'Inter, system-ui, sans-serif' };

  return (
    <svg viewBox="0 0 360 300" className="h-auto w-full select-none" role="img" aria-label="Campus map" style={font}>
      <rect width="360" height="300" rx="18" fill="#e7f3ea" />
      <rect x="8" y="8" width="344" height="284" rx="14" fill="none" stroke="#94a3b8" strokeWidth="3" />
      <path d="M352 150 L352 280" stroke={open.some((a) => a.cp === 'WALL') ? '#dc2626' : '#64748b'} strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="292" cy="250" rx="44" ry="26" fill="#cfe8d4" stroke="#a7d3b0" />
      <text x="292" y="253" textAnchor="middle" fontSize="8" fill="#4d7c5a" fontWeight="600">Sports ground</text>
      {TREES.map(([x, y]) => <circle key={x + '-' + y} cx={x} cy={y} r="6" fill="#a7d3b0" />)}
      {ROADS.map((d) => <path key={d} d={d} stroke="#cbd5e1" strokeWidth="13" fill="none" strokeLinecap="round" strokeLinejoin="round" />)}
      {ROADS.map((d) => <path key={'w' + d} d={d} stroke="#fff" strokeWidth="9" fill="none" strokeLinecap="round" strokeLinejoin="round" />)}
      {BUILDINGS.map((b) => (
        <g key={b.label}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="5" fill="#dbe4f3" stroke="#9fb1d6" />
          <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 3} textAnchor="middle" fontSize="7.5" fontWeight="600" fill="#334155">{b.label}</text>
        </g>
      ))}
      <g>
        <rect x="160" y="286" width="8" height="12" rx="2" fill="#1E3A8A" />
        <rect x="192" y="286" width="8" height="12" rx="2" fill="#1E3A8A" />
        <text x="180" y="297" textAnchor="middle" fontSize="7" fontWeight="700" fill="#1E3A8A">GATE</text>
      </g>
      <text x="340" y="146" textAnchor="end" fontSize="7" fill="#64748b" fontWeight="600">East wall</text>

      {route && (
        <polyline points={route.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#F59E0B" strokeWidth="3.5"
          strokeDasharray="7 5" strokeLinecap="round" className="route-dash" />
      )}

      {heat && Object.entries(heat).map(([id, n]) => {
        const p = CP[id];
        const k = n / maxHeat;
        return (
          <g key={'h' + id}>
            <circle cx={p.x} cy={p.y} r={12 + k * 26} fill="#ef4444" opacity={0.12 + k * 0.3} />
            <circle cx={p.x} cy={p.y} r={8 + k * 14} fill="#ef4444" opacity={0.18 + k * 0.35} />
          </g>
        );
      })}

      {Object.values(CP).map((p) => (
        <g key={p.id}>
          <circle cx={p.x} cy={p.y} r="8.5" fill="#fff" stroke="#1E3A8A" strokeWidth="2" />
          <text x={p.x} y={p.y + 3} textAnchor="middle" fontSize={p.tag.length > 1 ? 6.5 : 8.5} fontWeight="800" fill="#1E3A8A">{p.tag}</text>
        </g>
      ))}

      {heat && Object.entries(heat).map(([id, n]) => {
        const lx = CP[id].x > 320 ? CP[id].x - 27 : CP[id].x + 9;
        return (
          <g key={'hl' + id}>
            <rect x={lx} y={CP[id].y - 18} width="18" height="12" rx="6" fill="#991b1b" />
            <text x={lx + 9} y={CP[id].y - 9.5} textAnchor="middle" fontSize="8" fontWeight="800" fill="#fff">{n}</text>
          </g>
        );
      })}

      {open.filter((a) => a.status === 'accepted' && a.acceptedBy).map((a) => {
        const g = guards.find((x) => x.id === a.acceptedBy);
        if (!g || !a.from) return null;
        return <line key={'nav' + a.id} x1={a.from.x} y1={a.from.y} x2={CP[a.cp].x} y2={CP[a.cp].y} stroke="#1E3A8A" strokeWidth="2" strokeDasharray="3 3" opacity=".6" />;
      })}

      {walkPos && (
        <g style={{ transform: `translate(${walkPos.x}px, ${walkPos.y}px)`, transition: 'transform 1.2s ease-in-out' }}>
          <circle r="7" fill="#F59E0B" opacity=".5" className="pulse-ring" />
          <circle r="6" fill="#F59E0B" stroke="#fff" strokeWidth="2" />
          <text y="-10" textAnchor="middle" fontSize="7" fontWeight="700" fill="#92400e">Priya</text>
        </g>
      )}

      {showGuards && guards.map((g) => (
        <g key={g.id} style={{ transform: `translate(${g.x}px, ${g.y}px)`, transition: 'transform 2.5s ease-in-out' }}>
          <circle r="8" fill="#1E3A8A" stroke="#fff" strokeWidth="2" />
          <text y="3" textAnchor="middle" fontSize="8" fontWeight="800" fill="#fff">{g.name[0]}</text>
        </g>
      ))}

      {open.map((a) => {
        const k = (byCp[a.cp] = (byCp[a.cp] || 0) + 1) - 1;
        const p = CP[a.cp];
        const x = p.x + 11 + (k % 3) * 9;
        const y = p.y - 9 - Math.floor(k / 3) * 9;
        const crit = ALERT_TYPES[a.type].pri !== 'medium';
        return (
          <g key={a.id} onClick={() => onSelect && onSelect(a.id)} className={cls(onSelect && 'cursor-pointer')}>
            <circle cx={x} cy={y} r="6" fill={crit ? '#dc2626' : '#f59e0b'} className="pulse-ring" />
            <circle cx={x} cy={y} r={selected === a.id ? 7 : 5.5} fill={crit ? '#dc2626' : '#f59e0b'} stroke="#fff" strokeWidth={selected === a.id ? 2.5 : 1.5} />
            <circle cx={x} cy={y} r="14" fill="transparent" />
          </g>
        );
      })}
    </svg>
  );
}
