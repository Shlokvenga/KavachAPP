// 3D digital twin of the campus, built on CesiumJS (@cesium/engine).
// Bundled separately (www/twin.js) and loaded on demand; exposes window.KavachTwin.
// Runs fully offline: no globe tiles, no Ion, no web workers. The ground is a
// texture we paint ourselves and every primitive is created synchronously.
import {
  BoundingSphere, Cartesian2, Cartesian3, Color, ColorGeometryInstanceAttribute, CylinderGeometry, GeometryInstance, HeadingPitchRange,
  Math as CMath, Matrix4, NearFarScalar, PolygonGeometry, PolygonHierarchy, Rectangle, RectangleGeometry,
} from '@cesium/core';
import {
  CesiumWidget, DirectionalLight, EllipsoidSurfaceAppearance, HorizontalOrigin, LabelCollection, LabelStyle, Material, PerInstanceColorAppearance,
  PointPrimitiveCollection, PolylineCollection, Primitive, PrimitiveCollection, ScreenSpaceEventHandler, ScreenSpaceEventType, Transforms, VerticalOrigin,
  ApproximateTerrainHeights,
} from '@cesium/engine';
import { BOUNDARY, BUILDINGS, CAMERAS, CHECKPOINTS, GROUND, LAWNS, ORIGIN, ROADS, toGeo } from './campus.js';

const C = (css, a = 1) => Color.fromCssColorString(css).withAlpha(a);
const pos = (x, y, z = 0) => { const g = toGeo(x, y); return Cartesian3.fromDegrees(g.lon, g.lat, z); };
const KIND_COLOR = { academic: '#1d3a46', admin: '#25495a', hostel: '#1f3b4d', amenity: '#1b333d', research: '#173f35', lab: '#1e4250' };
const CAM_COLOR = { online: '#00e5ff', none: '#4b6370', offline: '#64748b', tampered: '#f59e0b' };
const ALERT_COLOR = { critical: '#F43F5E', high: '#F43F5E', medium: '#f59e0b' };
const AREA = { w: 700, d: 560 }; // painted ground, a bit larger than the campus wall

function paintGround() {
  const px = 2; // pixels per metre
  const cv = document.createElement('canvas');
  cv.width = AREA.w * px; cv.height = AREA.d * px;
  const g = cv.getContext('2d');
  const X = (x) => (x + AREA.w / 2) * px;
  const Y = (y) => (AREA.d / 2 - y) * px;
  g.fillStyle = '#071015'; g.fillRect(0, 0, cv.width, cv.height); // city outside
  g.fillStyle = '#121f26'; g.fillRect(0, Y(-222), cv.width, 18 * px); // PB Road
  g.strokeStyle = '#2c4450'; g.setLineDash([12, 12]); g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, Y(-231)); g.lineTo(cv.width, Y(-231)); g.stroke(); g.setLineDash([]);
  g.fillStyle = '#0b171d'; g.fillRect(X(-BOUNDARY.w / 2), Y(BOUNDARY.d / 2), BOUNDARY.w * px, BOUNDARY.d * px); // campus
  g.fillStyle = '#0d2621';
  for (const l of LAWNS) g.fillRect(X(l.x - l.w / 2), Y(l.y + l.d / 2), l.w * px, l.d * px);
  g.fillStyle = '#0d2621'; g.beginPath(); g.ellipse(X(GROUND.x), Y(GROUND.y), GROUND.rx * px, GROUND.ry * px, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#1f4a3e'; g.lineWidth = 2; g.stroke();
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const [w, col] of [[11, '#132630'], [8, '#1d3540']]) {
    g.strokeStyle = col; g.lineWidth = w * px;
    for (const r of ROADS) { g.beginPath(); r.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)))); g.stroke(); }
  }
  g.strokeStyle = 'rgba(0,229,255,.55)'; g.lineWidth = 2 * px;
  g.strokeRect(X(-BOUNDARY.w / 2), Y(BOUNDARY.d / 2), BOUNDARY.w * px, BOUNDARY.d * px);
  g.fillStyle = '#0b171d'; g.fillRect(X(-12), Y(-206), 24 * px, 8 * px); // gate opening
  return cv.toDataURL('image/png');
}

function rectPositions(b) {
  const hw = b.w / 2; const hd = b.d / 2;
  return [pos(b.x - hw, b.y - hd), pos(b.x + hw, b.y - hd), pos(b.x + hw, b.y + hd), pos(b.x - hw, b.y + hd)];
}

function staticScene(scene) {
  const sw = toGeo(-AREA.w / 2, -AREA.d / 2); const ne = toGeo(AREA.w / 2, AREA.d / 2);
  scene.primitives.add(new Primitive({
    geometryInstances: new GeometryInstance({
      geometry: new RectangleGeometry({ rectangle: Rectangle.fromDegrees(sw.lon, sw.lat, ne.lon, ne.lat), vertexFormat: EllipsoidSurfaceAppearance.VERTEX_FORMAT }),
    }),
    appearance: new EllipsoidSurfaceAppearance({ aboveGround: false, material: Material.fromType('Image', { image: paintGround() }) }),
    asynchronous: false,
  }));

  const walls = [];
  const bw = BOUNDARY.w / 2; const bd = BOUNDARY.d / 2;
  for (const [x, y, w, d] of [[0, bd, BOUNDARY.w, 1.2], [0, -bd, BOUNDARY.w, 1.2], [-bw, 0, 1.2, BOUNDARY.d], [bw, 0, 1.2, BOUNDARY.d]]) {
    walls.push(new GeometryInstance({
      id: 'wall',
      geometry: new PolygonGeometry({ polygonHierarchy: new PolygonHierarchy(rectPositions({ x, y, w, d })), height: 0, extrudedHeight: 2.6, vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT }),
      attributes: { color: ColorGeometryInstanceAttribute.fromColor(C('#2c4450')) },
    }));
  }
  const blds = [];
  for (const b of BUILDINGS) {
    blds.push(new GeometryInstance({
      id: 'bld:' + b.id,
      geometry: new PolygonGeometry({ polygonHierarchy: new PolygonHierarchy(rectPositions(b)), height: 0, extrudedHeight: b.h, vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT }),
      attributes: { color: ColorGeometryInstanceAttribute.fromColor(C(KIND_COLOR[b.kind])) },
    }));
    blds.push(new GeometryInstance({
      id: 'bld:' + b.id,
      geometry: new PolygonGeometry({ polygonHierarchy: new PolygonHierarchy(rectPositions({ ...b, w: b.w - 3, d: b.d - 3 })), height: b.h, extrudedHeight: b.h + 0.8, vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT }),
      attributes: { color: ColorGeometryInstanceAttribute.fromColor(C(b.kind === 'research' ? '#1f6b55' : '#0f2a33')) },
    }));
  }
  scene.primitives.add(new Primitive({ geometryInstances: [...walls, ...blds], appearance: new PerInstanceColorAppearance({ closed: true }), asynchronous: false }));

  const labels = scene.primitives.add(new LabelCollection());
  for (const b of BUILDINGS) {
    labels.add({
      position: pos(b.x, b.y, b.h + 6), text: b.short, font: '600 13px "Space Grotesk Variable", system-ui, sans-serif',
      fillColor: C('#d6e2e6'), outlineColor: C('#05090d'), outlineWidth: 3, style: LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: VerticalOrigin.BOTTOM, horizontalOrigin: HorizontalOrigin.CENTER,
      scaleByDistance: new NearFarScalar(150, 1.1, 1500, 0.55), disableDepthTestDistance: Number.POSITIVE_INFINITY, id: 'bld:' + b.id,
    });
  }
  const pts = scene.primitives.add(new PointPrimitiveCollection());
  for (const [id, cp] of Object.entries(CHECKPOINTS)) {
    pts.add({ position: pos(cp.x, cp.y, 1.5), pixelSize: 15, color: C('#060c11'), outlineColor: C('#00e5ff'), outlineWidth: 3, id: 'cp:' + id, disableDepthTestDistance: Number.POSITIVE_INFINITY });
    labels.add({
      position: pos(cp.x, cp.y, 1.5), text: cp.tag, font: '800 11px "Space Grotesk Variable", system-ui, sans-serif', fillColor: C('#00e5ff'),
      horizontalOrigin: HorizontalOrigin.CENTER, verticalOrigin: VerticalOrigin.CENTER, disableDepthTestDistance: Number.POSITIVE_INFINITY, id: 'cp:' + id,
    });
  }
}

function wedge(cam) {
  const out = [pos(cam.x, cam.y, 0.4)];
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    const a = CMath.toRadians(cam.heading - cam.fov / 2 + (cam.fov * i) / steps);
    out.push(pos(cam.x + Math.sin(a) * cam.range, cam.y + Math.cos(a) * cam.range, 0.4));
  }
  return out;
}

function create(container, { onPick } = {}) {
  // Cesium wants a base URL for optional assets; nothing we use is loaded from it.
  if (!window.CESIUM_BASE_URL) window.CESIUM_BASE_URL = './cesium/';
  // We have no terrain, so skip downloading Cesium's terrain-height table.
  if (!ApproximateTerrainHeights._terrainHeights) {
    ApproximateTerrainHeights._terrainHeights = {};
    ApproximateTerrainHeights._initPromise = Promise.resolve();
  }
  const widget = new CesiumWidget(container, {
    globe: false, skyBox: false, skyAtmosphere: false, baseLayer: false, scene3DOnly: true,
    creditContainer: document.createElement('div'), msaaSamples: 4, shadows: false,
    contextOptions: { webgl: { preserveDrawingBuffer: true } },
  });
  const scene = widget.scene;
  if (scene.sun) scene.sun.show = false;
  if (scene.moon) scene.moon.show = false;
  scene.backgroundColor = C('#05090d');
  const enu = Transforms.eastNorthUpToFixedFrame(pos(0, 0));
  scene.light = new DirectionalLight({ direction: Cartesian3.normalize(Matrix4.multiplyByPointAsVector(enu, new Cartesian3(0.45, 0.55, -0.7), new Cartesian3()), new Cartesian3()), intensity: 2.2 });
  const ctl = scene.screenSpaceCameraController;
  ctl.minimumZoomDistance = 40; ctl.maximumZoomDistance = 2500; ctl.enableCollisionDetection = false;

  staticScene(scene);
  const dyn = scene.primitives.add(new PrimitiveCollection());
  let pulses = [];
  let sig = '';

  const removePulse = scene.preRender.addEventListener(() => {
    const t = (performance.now() % 1400) / 1400;
    for (const p of pulses) { p.pixelSize = 12 + 22 * t; p.color = p.color.withAlpha(0.7 * (1 - t)); }
  });

  function update(d) {
    const s = JSON.stringify(d);
    if (s === sig) return;
    sig = s;
    dyn.removeAll();
    pulses = [];
    const L = d.layers || {};
    const pts = new PointPrimitiveCollection();
    const lines = new PolylineCollection();
    const labels = new LabelCollection();

    if (L.cams !== false) {
      const inst = [];
      for (const cam of CAMERAS) {
        const st = (d.cams && d.cams[cam.id]) || 'none';
        const sel = d.selected === 'cam:' + cam.id;
        inst.push(new GeometryInstance({
          id: 'cam:' + cam.id,
          geometry: new PolygonGeometry({ polygonHierarchy: new PolygonHierarchy(wedge(cam)), height: 0.4, vertexFormat: PerInstanceColorAppearance.FLAT_VERTEX_FORMAT }),
          attributes: { color: ColorGeometryInstanceAttribute.fromColor(C(CAM_COLOR[st], sel ? 0.4 : st === 'none' ? 0.06 : 0.16)) },
        }));
        lines.add({ positions: [pos(cam.x, cam.y, 0), pos(cam.x, cam.y, 7)], width: 2, material: Material.fromType('Color', { color: C('#4b6370') }) });
        pts.add({ position: pos(cam.x, cam.y, 7), pixelSize: sel ? 14 : 10, color: C(CAM_COLOR[st]), outlineColor: C('#ffffff'), outlineWidth: 2, id: 'cam:' + cam.id, disableDepthTestDistance: Number.POSITIVE_INFINITY });
        if (L.labels !== false) {
          labels.add({ position: pos(cam.x, cam.y, 7), text: cam.id, font: '600 10px "Space Grotesk Variable", system-ui, sans-serif', fillColor: C('#ffffff'), outlineColor: C('#05090d'), outlineWidth: 3, style: LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cartesian2(0, -14), horizontalOrigin: HorizontalOrigin.CENTER, scaleByDistance: new NearFarScalar(150, 1, 1200, 0.5), disableDepthTestDistance: Number.POSITIVE_INFINITY, id: 'cam:' + cam.id });
        }
      }
      dyn.add(new Primitive({ geometryInstances: inst, appearance: new PerInstanceColorAppearance({ flat: true, translucent: true }), asynchronous: false }));
    }

    if (L.heat && d.heat) {
      const max = Math.max(1, ...Object.values(d.heat));
      const inst = [];
      for (const [cp, n] of Object.entries(d.heat)) {
        const p = CHECKPOINTS[cp]; if (!p) continue;
        const h = 8 + (n / max) * 90;
        inst.push(new GeometryInstance({
          id: 'heat:' + cp,
          geometry: new CylinderGeometry({ length: h, topRadius: 9 + (n / max) * 8, bottomRadius: 9 + (n / max) * 8, vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT }),
          modelMatrix: Transforms.eastNorthUpToFixedFrame(pos(p.x, p.y, h / 2)),
          attributes: { color: ColorGeometryInstanceAttribute.fromColor(Color.lerp(C('#f59e0b'), C('#F43F5E'), n / max, new Color()).withAlpha(0.8)) },
        }));
        labels.add({ position: pos(p.x, p.y, h + 4), text: String(n), font: '800 14px "Space Grotesk Variable", system-ui, sans-serif', fillColor: C('#ffffff'), outlineColor: C('#4c0519'), outlineWidth: 4, style: LabelStyle.FILL_AND_OUTLINE, horizontalOrigin: HorizontalOrigin.CENTER, verticalOrigin: VerticalOrigin.BOTTOM, disableDepthTestDistance: Number.POSITIVE_INFINITY });
      }
      if (inst.length) dyn.add(new Primitive({ geometryInstances: inst, appearance: new PerInstanceColorAppearance({ closed: true, translucent: true }), asynchronous: false }));
    }

    if (L.walk !== false && d.walk && d.walk.route.length) {
      const route = d.walk.route.map((id) => CHECKPOINTS[id]);
      lines.add({ positions: route.map((p) => pos(p.x, p.y, 2)), width: 5, material: Material.fromType('PolylineDash', { color: C('#10B981'), dashLength: 18 }) });
      const at = CHECKPOINTS[d.walk.at];
      if (at) {
        const p = pts.add({ position: pos(at.x, at.y, 3), pixelSize: 18, color: C('#10B981', 0.6), disableDepthTestDistance: Number.POSITIVE_INFINITY });
        pulses.push(p);
        pts.add({ position: pos(at.x, at.y, 3), pixelSize: 12, color: C('#10B981'), outlineColor: C('#ffffff'), outlineWidth: 2, id: 'walk', disableDepthTestDistance: Number.POSITIVE_INFINITY });
        labels.add({ position: pos(at.x, at.y, 3), text: 'Saathi Walk', font: '700 11px "Space Grotesk Variable", system-ui, sans-serif', fillColor: C('#10B981'), outlineColor: C('#05090d'), outlineWidth: 3, style: LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cartesian2(0, -16), horizontalOrigin: HorizontalOrigin.CENTER, disableDepthTestDistance: Number.POSITIVE_INFINITY });
      }
    }

    if (L.guards !== false) {
      for (const g of d.guards || []) {
        pts.add({ position: pos(g.x, g.y, 2), pixelSize: 13, color: C('#38bdf8'), outlineColor: C('#ffffff'), outlineWidth: 2, id: 'guard:' + g.id, disableDepthTestDistance: Number.POSITIVE_INFINITY });
        labels.add({ position: pos(g.x, g.y, 2), text: g.name, font: '700 11px "Space Grotesk Variable", system-ui, sans-serif', fillColor: C('#dbeafe'), outlineColor: C('#05090d'), outlineWidth: 3, style: LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cartesian2(0, 16), horizontalOrigin: HorizontalOrigin.CENTER, verticalOrigin: VerticalOrigin.TOP, disableDepthTestDistance: Number.POSITIVE_INFINITY });
      }
    }

    if (L.alerts !== false) {
      const per = {};
      for (const a of d.alerts || []) {
        const p = CHECKPOINTS[a.cp]; if (!p) continue;
        const k = (per[a.cp] = (per[a.cp] || 0) + 1) - 1;
        const x = p.x + 10 + k * 9; const y = p.y + 8;
        const col = ALERT_COLOR[a.pri] || '#ef4444';
        lines.add({ positions: [pos(x, y, 0), pos(x, y, 90)], width: 10, material: Material.fromType('PolylineGlow', { color: C(col, 0.9), glowPower: 0.25 }) });
        pulses.push(pts.add({ position: pos(x, y, 3), pixelSize: 20, color: C(col, 0.6), disableDepthTestDistance: Number.POSITIVE_INFINITY }));
        pts.add({ position: pos(x, y, 3), pixelSize: d.selected === 'alert:' + a.id ? 16 : 12, color: C(col), outlineColor: C('#ffffff'), outlineWidth: 2, id: 'alert:' + a.id, disableDepthTestDistance: Number.POSITIVE_INFINITY });
        if (L.labels !== false) labels.add({ position: pos(x, y, 92), text: a.label, font: '700 12px "Space Grotesk Variable", system-ui, sans-serif', fillColor: C('#ffffff'), outlineColor: C('#7f1d1d'), outlineWidth: 4, style: LabelStyle.FILL_AND_OUTLINE, horizontalOrigin: HorizontalOrigin.CENTER, verticalOrigin: VerticalOrigin.BOTTOM, scaleByDistance: new NearFarScalar(200, 1, 1500, 0.6), disableDepthTestDistance: Number.POSITIVE_INFINITY, id: 'alert:' + a.id });
      }
    }
    dyn.add(lines); dyn.add(pts); dyn.add(labels);
  }

  const handler = new ScreenSpaceEventHandler(scene.canvas);
  handler.setInputAction((e) => {
    const p = scene.pick(e.position);
    const id = p && (typeof p.id === 'string' ? p.id : p.id && p.id.id);
    if (onPick) onPick(typeof id === 'string' ? id : null);
  }, ScreenSpaceEventType.LEFT_CLICK);

  const VIEWS = {
    overview: { x: 0, y: -520, z: 460, pitch: -40, heading: 0 },
    top: { x: 0, y: -1, z: 900, pitch: -90, heading: 0 },
    walk: { x: 40, y: -230, z: 260, pitch: -38, heading: 10 },
  };
  function view(name = 'overview', duration = 1.2) {
    const v = VIEWS[name] || VIEWS.overview;
    const dest = pos(v.x, v.y, v.z);
    const o = { heading: CMath.toRadians(v.heading), pitch: CMath.toRadians(v.pitch), roll: 0 };
    if (duration) scene.camera.flyTo({ destination: dest, orientation: o, duration });
    else scene.camera.setView({ destination: dest, orientation: o });
  }
  function focus(x, y, range = 170) {
    scene.camera.flyToBoundingSphere(new BoundingSphere(pos(x, y, 5), 30), { offset: new HeadingPitchRange(CMath.toRadians(15), CMath.toRadians(-38), range), duration: 1.1 });
  }
  function flyTo(key) {
    if (!key) return;
    const [kind, id] = key.split(':');
    if (kind === 'cam') { const c = CAMERAS.find((x) => x.id === id); if (c) focus(c.x, c.y, 140); }
    if (kind === 'cp' && CHECKPOINTS[id]) focus(CHECKPOINTS[id].x, CHECKPOINTS[id].y);
    if (kind === 'bld') { const b = BUILDINGS.find((x) => x.id === id); if (b) focus(b.x, b.y, 220); }
  }
  view('overview', 0);

  return {
    update, view, flyTo, focus,
    resize: () => widget.resize(),
    destroy: () => { removePulse(); handler.destroy(); widget.destroy(); },
    origin: ORIGIN,
  };
}

window.KavachTwin = { create };
