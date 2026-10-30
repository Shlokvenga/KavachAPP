// KLE Technological University, B.V. Bhoomaraddi Campus, Vidyanagar, Hubballi.
// APPROXIMATE, schematic layout for the prototype. Positions are in metres from the
// campus centre (x = east, y = north). Edit this file to match the real campus;
// the 2D map, the 3D digital twin and the camera coverage all read from it.

export const ORIGIN = { lat: 15.3694, lon: 75.1228 }; // approx. campus centre
export const CAMPUS_NAME = 'KLE Technological University';
export const CAMPUS_SHORT = 'KLE Tech, Hubballi';

// metres -> 2D map (viewBox 360 x 300)
export const SCALE = 0.66;
export const toMap = (x, y) => ({ x: 180 + x * SCALE, y: 150 - y * SCALE });
// metres -> lon/lat degrees
export function toGeo(x, y) {
  const lat = ORIGIN.lat + y / 111320;
  const lon = ORIGIN.lon + x / (111320 * Math.cos((ORIGIN.lat * Math.PI) / 180));
  return { lon, lat };
}

export const BOUNDARY = { w: 520, d: 420 }; // campus wall, centred on origin

// kind: academic | admin | hostel | amenity | research | lab
export const BUILDINGS = [
  { id: 'main', name: 'Main Building', short: 'Main Bldg', kind: 'admin', x: 0, y: -140, w: 130, d: 34, h: 17, color: '#FBF8F4', roof: '#E3D9C7' },
  { id: 'lib', name: 'Central Library', short: 'Library', kind: 'academic', x: -128, y: -44, w: 62, d: 40, h: 14 },
  { id: 'ece', name: 'ECE Block · Electronics Lab', short: 'ECE Block', kind: 'lab', x: -190, y: 66, w: 72, d: 40, h: 18 },
  { id: 'cse', name: 'CSE Block', short: 'CSE Block', kind: 'academic', x: -190, y: 152, w: 72, d: 38, h: 18 },
  { id: 'mech', name: 'Mechanical Workshops', short: 'Workshops', kind: 'academic', x: 52, y: 48, w: 86, d: 34, h: 10 },
  { id: 'civil', name: 'Civil & Architecture', short: 'Civil · Arch', kind: 'academic', x: 52, y: 130, w: 80, d: 34, h: 16 },
  { id: 'eee', name: 'EEE Block', short: 'EEE Block', kind: 'academic', x: -80, y: 70, w: 54, d: 36, h: 16 },
  { id: 'canteen', name: 'Canteen', short: 'Canteen', kind: 'amenity', x: 168, y: -14, w: 44, d: 30, h: 6 },
  { id: 'gh', name: 'Girls Hostel', short: 'Girls Hostel', kind: 'hostel', x: 190, y: 158, w: 76, d: 44, h: 21 },
  { id: 'bh', name: 'Boys Hostel', short: 'Boys Hostel', kind: 'hostel', x: -62, y: 172, w: 86, d: 32, h: 21 },
  { id: 'rc', name: 'Research Centre (green roof)', short: 'Research Ctr', kind: 'research', x: -182, y: -140, w: 66, d: 50, h: 8, roof: '#7FA66B' },
  { id: 'audi', name: 'Auditorium', short: 'Auditorium', kind: 'amenity', x: 104, y: -150, w: 56, d: 40, h: 15 },
];

export const LAWNS = [
  { x: 0, y: -183, w: 120, d: 26 }, // front lawn and statue
  { x: -40, y: -80, w: 70, d: 34 },
  { x: 120, y: 80, w: 60, d: 40 },
];
export const GROUND = { x: 205, y: -128, rx: 42, ry: 66, name: 'Sports ground' };

// Roads / walkways as polylines (metres)
export const ROADS = [
  [[0, -212], [0, -165], [0, -60]], // main avenue from PB Road gate
  [[0, -60], [-80, -40]], // to library
  [[-80, -40], [10, 12], [122, -30], [152, 114]], // Saathi Walk route A-B-C-D
  [[-80, -40], [-150, 34]], // to ECE
  [[-150, 34], [-150, 150]],
  [[0, -60], [122, -30]],
  [[-80, -40], [-78, -138], [0, -196]], // west loop via Main Building
  [[10, 12], [10, 150], [-62, 150]],
  [[0, -196], [104, -196], [104, -170]],
];

// Checkpoints (identity is checked only here)
export const CHECKPOINTS = {
  GATE: { name: 'Main Gate (PB Road)', tag: 'G', x: 0, y: -205 },
  A: { name: 'Central Library', tag: 'A', x: -80, y: -40 },
  B: { name: 'Workshop Path', tag: 'B', x: 10, y: 12 },
  C: { name: 'Canteen Junction', tag: 'C', x: 122, y: -30 },
  D: { name: 'Girls Hostel', tag: 'D', x: 152, y: 114 },
  LAB: { name: 'ECE Electronics Lab', tag: 'L', x: -150, y: 34 },
  ADMIN: { name: 'Main Building', tag: 'M', x: -78, y: -138 },
  WALL: { name: 'East Boundary Wall', tag: 'W', x: 252, y: 40 },
};

export const GUARD_POSTS = {
  ramesh: { x: 22, y: -196 },
  sunita: { x: 176, y: 100 },
  imran: { x: -104, y: -64 },
};

// CCTV cameras. heading: degrees clockwise from north. range in metres.
// All analytics are behaviour-only; faces are blurred and never searched.
export const CAMERAS = [
  { id: 'CAM-G1', name: 'Main Gate · Lane 1', cp: 'GATE', x: -14, y: -200, heading: 0, fov: 70, range: 40, type: 'Gate 1:1 verify', scene: 'gate', analytics: ['Tailgating', 'Wrong way'] },
  { id: 'CAM-G2', name: 'Main Gate · Lane 2', cp: 'GATE', x: 14, y: -200, heading: 0, fov: 70, range: 40, type: 'Gate 1:1 verify', scene: 'gate', analytics: ['Tailgating', 'Crowding'] },
  { id: 'CAM-M1', name: 'Main Building lawn', cp: 'ADMIN', x: -40, y: -170, heading: 60, fov: 90, range: 60, type: 'PTZ dome', scene: 'lawn', analytics: ['Loitering'] },
  { id: 'CAM-A1', name: 'Library entrance', cp: 'A', x: -86, y: -30, heading: 160, fov: 80, range: 45, type: 'Dome', scene: 'building', analytics: ['Loitering', 'Fall'] },
  { id: 'CAM-B1', name: 'Workshop Path south', cp: 'B', x: -10, y: 0, heading: 60, fov: 70, range: 70, type: 'Bullet, IR night', scene: 'path', analytics: ['Following', 'Running'] },
  { id: 'CAM-B2', name: 'Workshop Path north', cp: 'B', x: 40, y: 8, heading: 120, fov: 70, range: 70, type: 'Bullet, IR night', scene: 'path', analytics: ['Following', 'Fall'] },
  { id: 'CAM-C1', name: 'Canteen Junction', cp: 'C', x: 112, y: -40, heading: 30, fov: 100, range: 50, type: 'PTZ dome', scene: 'junction', analytics: ['Crowding', 'Fight'] },
  { id: 'CAM-C2', name: 'Canteen backside', cp: 'C', x: 150, y: -36, heading: 300, fov: 70, range: 40, type: 'Bullet', scene: 'junction', analytics: ['Loitering', 'Tamper'] },
  { id: 'CAM-D2', name: 'Hostel approach', cp: 'D', x: 140, y: 60, heading: 20, fov: 70, range: 60, type: 'Bullet, IR night', scene: 'path', analytics: ['Following', 'Visitor zone'] },
  { id: 'CAM-D1', name: 'Girls Hostel gate', cp: 'D', x: 160, y: 124, heading: 210, fov: 80, range: 40, type: 'Gate 1:1 verify', scene: 'gate', analytics: ['Tailgating', 'Visitor zone'] },
  { id: 'CAM-L1', name: 'ECE lab door (RFID)', cp: 'LAB', x: -156, y: 44, heading: 150, fov: 70, range: 25, type: 'Dome + RFID', scene: 'building', analytics: ['Asset exit'] },
  { id: 'CAM-H1', name: 'Boys Hostel path', cp: 'B', x: -20, y: 148, heading: 270, fov: 80, range: 50, type: 'Bullet', scene: 'path', analytics: ['Loitering'] },
  { id: 'CAM-W1', name: 'East wall north (thermal)', cp: 'WALL', x: 252, y: 60, heading: 180, fov: 40, range: 110, type: 'Thermal', scene: 'wall', analytics: ['Intrusion'] },
  { id: 'CAM-W2', name: 'East wall south (thermal)', cp: 'WALL', x: 252, y: -60, heading: 0, fov: 40, range: 110, type: 'Thermal', scene: 'wall', analytics: ['Intrusion'] },
];

export const camsAt = (cp) => CAMERAS.filter((c) => c.cp === cp).map((c) => c.id);
