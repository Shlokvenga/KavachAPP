// KLE Technological University, B.V. Bhoomaraddi Campus, Vidyanagar, Hubballi.
// Campus boundary and building footprints are OpenStreetMap geometry (way ids kept
// below), ported from the CAMIQ project. Checkpoints, cameras, guard posts and
// walkways are placed by us on that geometry (metres from ORIGIN, x = east, y = north)
// and are a plan, not a survey. The 2D map, the 3D twin, walk routes and camera
// coverage all read from this file.

export const ORIGIN = { lat: 15.36933, lon: 75.12238 };
export const CAMPUS_NAME = 'KLE Technological University';
export const CAMPUS_SHORT = 'KLE Tech, Hubballi';

const M_PER_DEG_LAT = 111320;
const M_PER_DEG_LON = 111320 * Math.cos((ORIGIN.lat * Math.PI) / 180);
// lon/lat degrees <-> local metres
export const toLocal = ([lon, lat]) => [(lon - ORIGIN.lon) * M_PER_DEG_LON, (lat - ORIGIN.lat) * M_PER_DEG_LAT];
export const toGeo = (x, y) => ({ lon: ORIGIN.lon + x / M_PER_DEG_LON, lat: ORIGIN.lat + y / M_PER_DEG_LAT });

// OSM way 381443665: institutional boundary
const BOUNDARY_GEO = [
  [75.1181956, 15.3715382], [75.1185491, 15.3708846], [75.1208472, 15.3682531], [75.121312, 15.3686263],
  [75.1219187, 15.3680486], [75.1221057, 15.3682104], [75.1231725, 15.3672778], [75.1243516, 15.3682219],
  [75.1246949, 15.3666546], [75.1250387, 15.3655302], [75.1256653, 15.3660185], [75.1262735, 15.3664003],
  [75.1270402, 15.3670453], [75.1273659, 15.3666853], [75.1275143, 15.3669375], [75.1276992, 15.3668363],
  [75.1280365, 15.3674097], [75.1279477, 15.3676725], [75.1276802, 15.3684931], [75.1267138, 15.369387],
  [75.1260353, 15.3703981], [75.1257249, 15.3705134], [75.1248666, 15.3704565], [75.1244976, 15.3714139],
  [75.1220633, 15.3711768], [75.1213575, 15.3711068], [75.1207355, 15.3717598], [75.1204529, 15.371765],
  [75.1204573, 15.3719866], [75.1196409, 15.3720016], [75.1196036, 15.3718995],
];
export const BOUNDARY = BOUNDARY_GEO.map(toLocal);

// OSM building footprints. kind: academic | admin | hostel | amenity | research | lab
const BUILDINGS_GEO = [
  { id: 'main', osm: 'way-388061988', name: 'Main Building (BVBCET Block)', short: 'Main Building', kind: 'admin', h: 18, geo: [[75.1223758, 15.3691403], [75.1224338, 15.36908], [75.1226779, 15.3692983], [75.1220013, 15.3700016], [75.1212891, 15.3693647], [75.1214204, 15.3692282], [75.1214873, 15.369288], [75.1219012, 15.3688578], [75.1218032, 15.3687702], [75.121919, 15.3686498], [75.1222344, 15.3689319], [75.1222125, 15.3689547], [75.1221657, 15.3690034], [75.1220324, 15.3688843], [75.1215178, 15.3694192], [75.1220075, 15.3698573], [75.1225486, 15.3692948]] },
  { id: 'lhc', osm: 'way-388062012', name: 'LHC (Lecture Hall Complex)', short: 'LHC', kind: 'academic', h: 16, geo: [[75.1225783, 15.3709315], [75.1226202, 15.3709223], [75.1226498, 15.3710477], [75.1228984, 15.3709932], [75.1228739, 15.3708894], [75.1227318, 15.3709205], [75.1226193, 15.3704434], [75.1221979, 15.3705358], [75.1221668, 15.3704038], [75.1219264, 15.3704564], [75.1219634, 15.3706131], [75.1221528, 15.3705716], [75.122198, 15.3707633], [75.1220268, 15.3708008], [75.1220577, 15.3709322], [75.1225529, 15.3708237]] },
  { id: 'clite', osm: 'way-381454798', name: 'C-LITE Innovation Center', short: 'C-LITE', kind: 'research', h: 15, geo: [[75.1234701, 15.3701773], [75.1233393, 15.370054], [75.1230657, 15.3700539], [75.1229203, 15.3701877], [75.1229203, 15.3704515], [75.1230442, 15.3705709], [75.1231942, 15.3705709], [75.1233259, 15.370571], [75.1234701, 15.3704515]] },
  { id: 'gh', osm: 'way-381451253', name: 'KLE Girls Hostel', short: 'Girls Hostel', kind: 'hostel', h: 14, geo: [[75.119135, 15.3715195], [75.1192268, 15.3711327], [75.118499, 15.3709721], [75.1184072, 15.3713588]] },
  { id: 'bh', osm: 'way-552744239', name: 'BVB Boys Hostel', short: 'Boys Hostel', kind: 'hostel', h: 14, geo: [[75.1253467, 15.3692163], [75.1253196, 15.3689349], [75.1256385, 15.3688787], [75.1260657, 15.3689289], [75.1260803, 15.369166], [75.1258844, 15.369361]] },
  { id: 'mech', osm: 'way-388050619', name: 'School of Mechanical Engineering', short: 'Mechanical', kind: 'academic', h: 14, geo: [[75.1240852, 15.3692862], [75.1240691, 15.3690095], [75.1230204, 15.3691103], [75.1232266, 15.3694687], [75.1235783, 15.3694388]] },
  { id: 'eee', osm: 'way-381453921', name: 'Dept. of Electrical & Electronics (EEE)', short: 'EEE', kind: 'academic', h: 14, geo: [[75.1224705, 15.3695903], [75.1226922, 15.3693785], [75.1229238, 15.3694673], [75.1230056, 15.3697071], [75.1228055, 15.3698514]] },
  { id: 'ecee', osm: 'way-1547959743', name: 'EC & EE Building', short: 'EC & EE Lab', kind: 'lab', h: 15, geo: [[75.1235013, 15.3680279], [75.1232147, 15.3678025], [75.123418, 15.3676281], [75.1236944, 15.3678652]] },
  { id: 'civil', osm: 'way-381453309', name: 'Civil Engineering Department', short: 'Civil', kind: 'academic', h: 13, geo: [[75.1231274, 15.3690008], [75.1239597, 15.3689333], [75.1239358, 15.368659], [75.1233923, 15.3683135], [75.1230698, 15.3683397]] },
  { id: 'bt', osm: 'way-388062017', name: 'Department of Biotechnology', short: 'Biotech', kind: 'academic', h: 14, geo: [[75.1240038, 15.3704344], [75.1238301, 15.3705109], [75.1237899, 15.3707127], [75.1240447, 15.3707592], [75.1243451, 15.3706506], [75.1243612, 15.3704153]] },
  { id: 'audi', osm: 'way-381454704', name: 'BT Auditorium', short: 'BT Audi', kind: 'amenity', h: 12, geo: [[75.1240038, 15.3704344], [75.1239004, 15.3703026], [75.1240428, 15.3702519], [75.1242393, 15.3703209], [75.12414, 15.3704478]] },
  { id: 'sandbox', osm: 'way-381454191', name: 'Deshpande Foundation / Sandbox', short: 'Sandbox', kind: 'research', h: 14, geo: [[75.123272, 15.3708258], [75.1232073, 15.3711797], [75.123736, 15.3712665], [75.1238075, 15.3709237]] },
  { id: 'smsr', osm: 'way-552744240', name: 'School of Management Studies (SMSR)', short: 'SMSR', kind: 'academic', h: 12, geo: [[75.1226832, 15.370008], [75.1224271, 15.3697969], [75.1221751, 15.3700823], [75.1224169, 15.3702737]] },
  { id: 'canteen', osm: 'way-381456907', name: 'KLE Tech Canteen', short: 'Canteen', kind: 'amenity', h: 9, geo: [[75.1227251, 15.3682715], [75.1226692, 15.3685001], [75.122496, 15.3684411], [75.1226447, 15.3682445]] },
  { id: 'arena', osm: 'way-1547959745', name: 'Indoor Sports Arena', short: 'Sports Arena', kind: 'amenity', h: 13, geo: [[75.1202428, 15.3692229], [75.1205558, 15.3688564], [75.1207814, 15.3690504], [75.1204521, 15.3694091]] },
];
const centroid = (pts) => [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
export const BUILDINGS = BUILDINGS_GEO.map((g) => {
  const poly = g.geo.map(toLocal);
  const [x, y] = centroid(poly);
  return { ...g, poly, x, y };
});

// Bounding box of the campus in metres, used to fit the 2D map and paint the 3D ground.
const xs = BOUNDARY.map((p) => p[0]); const ys = BOUNDARY.map((p) => p[1]);
export const BOUNDS = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };

// metres -> 2D map coordinates (viewBox MAP_W x MAP_H)
export const MAP_W = 360;
const PAD = 10;
export const SCALE = (MAP_W - 2 * PAD) / (BOUNDS.maxX - BOUNDS.minX);
export const MAP_H = Math.round((BOUNDS.maxY - BOUNDS.minY) * SCALE + 2 * PAD);
export const toMap = (x, y) => ({ x: PAD + (x - BOUNDS.minX) * SCALE, y: PAD + (BOUNDS.maxY - y) * SCALE });

// Walkways between checkpoints (schematic, not from OSM).
export const ROADS = [
  [[-85, -108], [-60, -86]], // Main Gate to Main Building
  [[-60, -86], [-128, -10], [-103, 54]], // around the Main Building to the Library Walkway
  [[-103, 54], [-185, 35], [-285, 125], [-345, 185]], // Girls Hostel route
  [[-103, 54], [-60, 98], [20, 118], [60, 70], [60, 25]], // north of SMSR to the Workshop Path
  [[60, 25], [65, -35], [230, -35], [305, -30]], // Boys Hostel route
  [[-60, -86], [10, -82], [45, -95], [100, -150]], // canteen and the EC & EE lab
];

// Checkpoints (identity is checked only here)
export const CHECKPOINTS = {
  GATE: { name: 'Main Gate (PB Road)', tag: 'G', x: -85, y: -108 },
  ADMIN: { name: 'Main Building', tag: 'M', x: -60, y: -86 },
  A: { name: 'Library Walkway', tag: 'A', x: -103, y: 54 },
  B: { name: 'Sports Arena Path', tag: 'B', x: -185, y: 35 },
  C: { name: 'Hostel Lane', tag: 'C', x: -285, y: 125 },
  D: { name: 'Girls Hostel', tag: 'D', x: -345, y: 185 },
  F: { name: 'Workshop Path', tag: 'F', x: 60, y: 25 },
  E: { name: 'Boys Hostel', tag: 'E', x: 305, y: -30 },
  K: { name: 'Canteen Junction', tag: 'K', x: 45, y: -95 },
  LAB: { name: 'EC & EE Lab', tag: 'L', x: 100, y: -150 },
  WALL: { name: 'East Boundary Wall', tag: 'W', x: 510, y: -48 },
};

export const GUARD_POSTS = {
  gate: { x: -70, y: -100 },
  girls: { x: -320, y: 160 },
  boys: { x: 290, y: -15 },
};

// CCTV cameras. heading: degrees clockwise from north. range in metres.
// All analytics are behaviour-only; faces are never searched.
export const CAMERAS = [
  { id: 'CAM-G1', name: 'Main Gate · Lane 1', cp: 'GATE', x: -95, y: -100, heading: 45, fov: 70, range: 40, type: 'Gate 1:1 verify', scene: 'gate', analytics: ['Tailgating', 'Wrong way'] },
  { id: 'CAM-G2', name: 'Main Gate · Lane 2', cp: 'GATE', x: -72, y: -118, heading: 45, fov: 70, range: 40, type: 'Gate 1:1 verify', scene: 'gate', analytics: ['Tailgating', 'Crowding'] },
  { id: 'CAM-M1', name: 'Main Building front', cp: 'ADMIN', x: -45, y: -98, heading: 330, fov: 90, range: 50, type: 'PTZ dome', scene: 'lawn', analytics: ['Loitering'] },
  { id: 'CAM-A1', name: 'Library Walkway', cp: 'A', x: -112, y: 46, heading: 290, fov: 80, range: 60, type: 'Dome', scene: 'building', analytics: ['Loitering', 'Fall'] },
  { id: 'CAM-B1', name: 'Sports Arena path', cp: 'B', x: -178, y: 28, heading: 315, fov: 70, range: 80, type: 'Bullet, IR night', scene: 'path', analytics: ['Following', 'Running'] },
  { id: 'CAM-C1', name: 'Hostel Lane', cp: 'C', x: -278, y: 118, heading: 315, fov: 70, range: 70, type: 'Bullet, IR night', scene: 'path', analytics: ['Following', 'Fall'] },
  { id: 'CAM-D2', name: 'Girls Hostel approach', cp: 'D', x: -310, y: 150, heading: 315, fov: 70, range: 60, type: 'Bullet, IR night', scene: 'path', analytics: ['Following', 'Visitor zone'] },
  { id: 'CAM-D1', name: 'Girls Hostel gate', cp: 'D', x: -338, y: 178, heading: 135, fov: 80, range: 40, type: 'Gate 1:1 verify', scene: 'gate', analytics: ['Tailgating', 'Visitor zone'] },
  { id: 'CAM-F1', name: 'Workshop Path', cp: 'F', x: 55, y: 32, heading: 160, fov: 70, range: 70, type: 'Bullet, IR night', scene: 'path', analytics: ['Following', 'Running'] },
  { id: 'CAM-H1', name: 'Boys Hostel path', cp: 'E', x: 285, y: -32, heading: 270, fov: 80, range: 60, type: 'Bullet, IR night', scene: 'path', analytics: ['Following', 'Loitering'] },
  { id: 'CAM-K1', name: 'Canteen Junction', cp: 'K', x: 40, y: -88, heading: 200, fov: 100, range: 50, type: 'PTZ dome', scene: 'junction', analytics: ['Crowding', 'Fight'] },
  { id: 'CAM-K2', name: 'Canteen backside', cp: 'K', x: 20, y: -125, heading: 30, fov: 70, range: 40, type: 'Bullet', scene: 'junction', analytics: ['Loitering', 'Tamper'] },
  { id: 'CAM-L1', name: 'EC & EE lab door (RFID)', cp: 'LAB', x: 95, y: -143, heading: 225, fov: 70, range: 25, type: 'Dome + RFID', scene: 'building', analytics: ['Asset exit'] },
  { id: 'CAM-W1', name: 'East wall north (thermal)', cp: 'WALL', x: 498, y: -36, heading: 315, fov: 40, range: 120, type: 'Thermal', scene: 'wall', analytics: ['Intrusion'] },
  { id: 'CAM-W2', name: 'East wall south (thermal)', cp: 'WALL', x: 540, y: -78, heading: 135, fov: 40, range: 120, type: 'Thermal', scene: 'wall', analytics: ['Intrusion'] },
];

export const camsAt = (cp) => CAMERAS.filter((c) => c.cp === cp).map((c) => c.id);
