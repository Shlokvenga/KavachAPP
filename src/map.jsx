// 2D illustrated map of KLE Tech, Hubballi, drawn from src/campus.js.
// Used by the Guard app, the student's camera coverage view and as the
// fallback when the 3D digital twin can't start.
import { BOUNDARY, BUILDINGS, CAMERAS, GROUND, LAWNS, ROADS, SCALE, toMap } from './campus.js';
import { ALERT_TYPES, CP, cls } from './data.js';

const KIND = { academic: '#16303b', admin: '#1d3b47', hostel: '#1a2f3d', amenity: '#172b33', research: '#12352c', lab: '#183641' };
const CAM_COL = { online: '#00e5ff', none: '#4b6370', offline: '#64748b', tampered: '#f59e0b' };
const font = { fontFamily: "'Space Grotesk Variable', 'Space Grotesk', system-ui, sans-serif" };

function rect(b) {
  const p = toMap(b.x - b.w / 2, b.y + b.d / 2);
  return { x: p.x, y: p.y, w: b.w * SCALE, h: b.d * SCALE };
}
const pts = (line) => line.map(([x, y]) => { const p = toMap(x, y); return `${p.x},${p.y}`; }).join(' ');

function wedge(c) {
  const o = toMap(c.x, c.y);
  let d = `M${o.x} ${o.y}`;
  for (let i = 0; i <= 8; i++) {
    const a = ((c.heading - c.fov / 2 + (c.fov * i) / 8) * Math.PI) / 180;
    const p = toMap(c.x + Math.sin(a) * c.range, c.y + Math.cos(a) * c.range);
    d += ` L${p.x} ${p.y}`;
  }
  return d + 'Z';
}

export default function CampusMap({
  alerts = [], guards = [], walk = null, heat = null, selected, onSelect, showGuards = true,
  cams = null, showCams = false, onCam, selectedCam, highlightCams = null,
}) {
  const open = alerts.filter((a) => a.status !== 'resolved');
  const byCp = {};
  const route = walk && walk.phase === 'active' ? walk.steps.map((s) => toMap(CP[s.cp].x, CP[s.cp].y)) : null;
  const lastIdx = walk ? walk.steps.map((s) => s.status).lastIndexOf('passed') : -1;
  const walkPos = route && lastIdx >= 0 ? route[lastIdx] : null;
  const maxHeat = heat ? Math.max(1, ...Object.values(heat)) : 1;
  const wall = rect({ x: 0, y: 0, w: BOUNDARY.w, d: BOUNDARY.d });
  const gate = toMap(0, -210);
  const ground = toMap(GROUND.x, GROUND.y);

  return (
    <svg viewBox="0 0 360 300" className="h-auto w-full select-none" role="img" aria-label="KLE Tech campus map" style={font}>
      <rect width="360" height="300" rx="18" fill="#060c11" />
      <rect x="0" y="289" width="360" height="11" fill="#111d24" />
      <text x="352" y="297" textAnchor="end" fontSize="6.5" fill="#7b929c" fontWeight="600">PB Road</text>
      <rect x={wall.x} y={wall.y} width={wall.w} height={wall.h} rx="6" fill="#0a161c" stroke="#22353f" strokeWidth="2.5" />
      <path d={`M${wall.x + wall.w} ${toMap(0, 110).y} L${wall.x + wall.w} ${toMap(0, -110).y}`} stroke={open.some((a) => a.cp === 'WALL') ? '#F43F5E' : '#2c4450'} strokeWidth="4.5" strokeLinecap="round" />
      {LAWNS.map((l) => { const r = rect(l); return <rect key={l.x + ',' + l.y} x={r.x} y={r.y} width={r.w} height={r.h} rx="4" fill="#0e2a24" />; })}
      <ellipse cx={ground.x} cy={ground.y} rx={GROUND.rx * SCALE} ry={GROUND.ry * SCALE} fill="#0e2a24" stroke="#1f4a3e" strokeWidth="1.5" />
      <text x={ground.x} y={ground.y + 2.5} textAnchor="middle" fontSize="6.5" fill="#3f8f72" fontWeight="600">Sports ground</text>
      {ROADS.map((r) => <polyline key={'r' + pts(r)} points={pts(r)} stroke="#13232b" strokeWidth="9" fill="none" strokeLinecap="round" strokeLinejoin="round" />)}
      {ROADS.map((r) => <polyline key={'w' + pts(r)} points={pts(r)} stroke="#1c323c" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />)}
      <rect x={gate.x - 9} y={gate.y - 3} width="18" height="7" rx="2" fill="#00e5ff" />
      {BUILDINGS.map((b) => {
        const r = rect(b);
        return (
          <g key={b.id}>
            <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="3" fill={KIND[b.kind]} stroke="rgba(0,229,255,.28)" strokeWidth=".8" />
            <text x={r.x + r.w / 2} y={r.y + r.h / 2 + 2.4} textAnchor="middle" fontSize="6.6" fontWeight="600" fill="#9db1b9">{b.short}</text>
          </g>
        );
      })}

      {showCams && CAMERAS.map((c) => {
        const st = (cams && cams[c.id] && cams[c.id].status) || 'none';
        const hi = (highlightCams && highlightCams.includes(c.id)) || selectedCam === c.id;
        return <path key={'fov' + c.id} d={wedge(c)} fill={CAM_COL[st]} opacity={hi ? 0.32 : st === 'none' ? 0.05 : 0.12} />;
      })}

      {route && <polyline points={route.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#10B981" strokeWidth="3" strokeDasharray="6 4" strokeLinecap="round" className="route-dash" />}

      {heat && Object.entries(heat).map(([id, n]) => {
        const p = toMap(CP[id].x, CP[id].y);
        const k = n / maxHeat;
        return (
          <g key={'h' + id}>
            <circle cx={p.x} cy={p.y} r={12 + k * 24} fill="#F43F5E" opacity={0.12 + k * 0.28} />
            <circle cx={p.x} cy={p.y} r={8 + k * 12} fill="#F43F5E" opacity={0.18 + k * 0.32} />
          </g>
        );
      })}

      {Object.values(CP).map((c) => {
        const p = toMap(c.x, c.y);
        return (
          <g key={c.id}>
            <rect x={p.x - 7.5} y={p.y - 7.5} width="15" height="15" rx="4.5" fill="#060c11" stroke="#00e5ff" strokeWidth="1.4" />
            <text x={p.x} y={p.y + 3} textAnchor="middle" fontSize="8" fontWeight="800" fill="#00e5ff">{c.tag}</text>
          </g>
        );
      })}

      {heat && Object.entries(heat).map(([id, n]) => {
        const p = toMap(CP[id].x, CP[id].y);
        const lx = p.x > 320 ? p.x - 27 : p.x + 9;
        return (
          <g key={'hl' + id}>
            <rect x={lx} y={p.y - 18} width="18" height="12" rx="6" fill="#be123c" />
            <text x={lx + 9} y={p.y - 9.5} textAnchor="middle" fontSize="8" fontWeight="800" fill="#fff">{n}</text>
          </g>
        );
      })}

      {showCams && CAMERAS.map((c) => {
        const st = (cams && cams[c.id] && cams[c.id].status) || 'none';
        const p = toMap(c.x, c.y);
        const sel = selectedCam === c.id;
        return (
          <g key={'cam' + c.id} onClick={onCam ? () => onCam(c.id) : undefined} className={cls(onCam && 'cursor-pointer')}>
            <circle cx={p.x} cy={p.y} r={sel ? 6 : 4.2} fill={CAM_COL[st]} stroke="#05090d" strokeWidth="1.4" />
            {(st === 'tampered' || st === 'offline') && <circle cx={p.x} cy={p.y} r="5" fill={CAM_COL[st]} className="pulse-ring" />}
            <circle cx={p.x} cy={p.y} r="11" fill="transparent" />
          </g>
        );
      })}

      {open.filter((a) => a.status === 'accepted' && a.acceptedBy && a.from).map((a) => {
        const f = toMap(a.from.x, a.from.y); const t = toMap(CP[a.cp].x, CP[a.cp].y);
        return <line key={'nav' + a.id} x1={f.x} y1={f.y} x2={t.x} y2={t.y} stroke="#38bdf8" strokeWidth="2" strokeDasharray="3 3" opacity=".7" />;
      })}

      {walkPos && (
        <g style={{ transform: `translate(${walkPos.x}px, ${walkPos.y}px)`, transition: 'transform 1.2s ease-in-out' }}>
          <circle r="7" fill="#10B981" opacity=".5" className="pulse-ring" />
          <circle r="6" fill="#10B981" stroke="#05090d" strokeWidth="2" />
          <text y="-10" textAnchor="middle" fontSize="7" fontWeight="700" fill="#6ee7b7">{walk.first || walk.name}</text>
        </g>
      )}

      {showGuards && guards.map((g) => {
        const p = toMap(g.x, g.y);
        return (
          <g key={g.id} style={{ transform: `translate(${p.x}px, ${p.y}px)`, transition: 'transform 2.5s ease-in-out' }}>
            <circle r="7.5" fill="#0ea5e9" stroke="#05090d" strokeWidth="2" />
            <text y="3" textAnchor="middle" fontSize="8" fontWeight="800" fill="#fff">{g.name[0]}</text>
          </g>
        );
      })}

      {open.map((a) => {
        const k = (byCp[a.cp] = (byCp[a.cp] || 0) + 1) - 1;
        const p = toMap(CP[a.cp].x, CP[a.cp].y);
        const x = p.x + 11 + (k % 3) * 9;
        const y = p.y - 9 - Math.floor(k / 3) * 9;
        const crit = ALERT_TYPES[a.type].pri !== 'medium';
        return (
          <g key={a.id} onClick={() => onSelect && onSelect(a.id)} className={cls(onSelect && 'cursor-pointer')}>
            <circle cx={x} cy={y} r="6" fill={crit ? '#F43F5E' : '#f59e0b'} className="pulse-ring" />
            <circle cx={x} cy={y} r={selected === a.id ? 7 : 5.5} fill={crit ? '#F43F5E' : '#f59e0b'} stroke="#fff" strokeWidth={selected === a.id ? 2.5 : 1.5} />
            <circle cx={x} cy={y} r="14" fill="transparent" />
          </g>
        );
      })}
    </svg>
  );
}
