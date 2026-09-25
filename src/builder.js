// Builder: accumulate primitives per material key, then merge into one mesh per key.
// Static scenery ends up as a handful of draw calls instead of thousands.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { NO_CAST } from './materials.js';

const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

export function placeMatrix(x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), _s.set(sx, sy, sz));
}

// Box-projected UVs in meters, chosen per vertex from the dominant normal axis.
export function boxUV(geo) {
  const p = geo.attributes.position, n = geo.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); }
    else if (ax >= az) { u = p.getZ(i); v = p.getY(i); }
    else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u;
    uv[i * 2 + 1] = v;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

function normalizeGeo(g) {
  const geo = g.index ? g.toNonIndexed() : g.clone();
  for (const name of Object.keys(geo.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'uv') geo.deleteAttribute(name);
  }
  if (!geo.attributes.normal) geo.computeVertexNormals();
  if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
  geo.clearGroups();
  geo.morphAttributes = {};
  return geo;
}

// One axis-aligned face (quad) with world UVs, as its own tiny geometry.
function faceGeo(face, x0, y0, z0, x1, y1, z1) {
  let P, N;
  switch (face) {
    case 'px': P = [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]]; N = [1, 0, 0]; break;
    case 'nx': P = [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]]; N = [-1, 0, 0]; break;
    case 'pz': P = [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]; N = [0, 0, 1]; break;
    case 'nz': P = [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]]; N = [0, 0, -1]; break;
    case 'py': P = [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]]; N = [0, 1, 0]; break;
    default: P = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]]; N = [0, -1, 0];
  }
  const idx = [0, 1, 2, 0, 2, 3];
  const pos = new Float32Array(18), nor = new Float32Array(18), uv = new Float32Array(12);
  idx.forEach((k, i) => {
    const [x, y, z] = P[k];
    pos.set([x, y, z], i * 3);
    nor.set(N, i * 3);
    let u, v;
    if (face === 'px' || face === 'nx') { u = z; v = y; }
    else if (face === 'pz' || face === 'nz') { u = x; v = y; }
    else { u = x; v = z; }
    uv.set([u, v], i * 2);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

export class Builder {
  constructor(materials) {
    this.M = materials;
    this.parts = new Map();
    this.stack = [new THREE.Matrix4()];
  }

  get matrix() { return this.stack[this.stack.length - 1]; }

  push(x = 0, y = 0, z = 0, ry = 0) {
    this.stack.push(this.matrix.clone().multiply(placeMatrix(x, y, z, ry)));
    return this;
  }

  pop() {
    this.stack.pop();
    return this;
  }

  // Run fn with a local frame at (x, y, z) rotated by ry.
  at(x, y, z, ry, fn) {
    this.push(x, y, z, ry);
    fn(this);
    this.pop();
    return this;
  }

  add(key, geo, matrix = null, uv = 'box') {
    const g = normalizeGeo(geo);
    if (matrix) g.applyMatrix4(matrix);
    if (uv === 'box') boxUV(g);
    g.applyMatrix4(this.matrix);
    if (!this.parts.has(key)) this.parts.set(key, []);
    this.parts.get(key).push(g);
    geo.dispose();
    return this;
  }

  // Axis-aligned box from min/max with per-face material keys.
  // keys: string for all faces, or { px, nx, py, ny, pz, nz, all } (null skips a face).
  faces(keys, x0, y0, z0, x1, y1, z1) {
    if (x1 - x0 < 1e-5 || y1 - y0 < 1e-5 || z1 - z0 < 1e-5) return this;
    for (const f of ['px', 'nx', 'py', 'ny', 'pz', 'nz']) {
      const key = typeof keys === 'string' ? keys : (f in keys ? keys[f] : keys.all);
      if (!key) continue;
      const g = faceGeo(f, x0, y0, z0, x1, y1, z1);
      g.applyMatrix4(this.matrix);
      if (!this.parts.has(key)) this.parts.set(key, []);
      this.parts.get(key).push(g);
    }
    return this;
  }

  box(key, cx, cy, cz, sx, sy, sz, ry = 0) {
    return this.add(key, new THREE.BoxGeometry(sx, sy, sz), placeMatrix(cx, cy, cz, ry));
  }

  // Box from min/max corners (axis aligned in the local frame).
  bx(key, x0, y0, z0, x1, y1, z1) {
    return this.box(key, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0);
  }

  rbox(key, cx, cy, cz, sx, sy, sz, r = 0.03, ry = 0, seg = 2) {
    const rr = Math.max(0.001, Math.min(r, sx / 2 - 1e-3, sy / 2 - 1e-3, sz / 2 - 1e-3));
    return this.add(key, new RoundedBoxGeometry(sx, sy, sz, seg, rr), placeMatrix(cx, cy, cz, ry));
  }

  cyl(key, cx, cy, cz, rTop, rBot, h, seg = 20, rx = 0, rz = 0, ry = 0) {
    return this.add(key, new THREE.CylinderGeometry(rTop, rBot, h, seg), placeMatrix(cx, cy, cz, ry, rx, rz));
  }

  sphere(key, cx, cy, cz, r, seg = 16, sx = 1, sy = 1, sz = 1) {
    return this.add(key, new THREE.SphereGeometry(r, seg, Math.max(6, seg * 0.75 | 0)), placeMatrix(cx, cy, cz, 0, 0, 0, sx, sy, sz));
  }

  torus(key, cx, cy, cz, r, tube, rx = Math.PI / 2, seg = 24, ry = 0) {
    return this.add(key, new THREE.TorusGeometry(r, tube, 8, seg), placeMatrix(cx, cy, cz, ry, rx, 0));
  }

  // Ellipsoid with yaw/pitch/roll; radii along local x, y, z.
  ell(key, cx, cy, cz, rx, ry, rz, yaw = 0, pitch = 0, roll = 0, seg = 12) {
    return this.add(key, new THREE.SphereGeometry(1, seg, Math.max(6, (seg * 0.7) | 0)), placeMatrix(cx, cy, cz, yaw, pitch, roll, rx, ry, rz));
  }

  // Cylinder between two points.
  rod(key, x0, y0, z0, x1, y1, z1, r = 0.01, seg = 6, r1 = r) {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
    const len = Math.hypot(dx, dy, dz) || 1e-4;
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / len, dy / len, dz / len));
    const m = new THREE.Matrix4().compose(new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), q, new THREE.Vector3(1, 1, 1));
    return this.add(key, new THREE.CylinderGeometry(r1, r, len, seg), m);
  }

  build({ cast = true, receive = true, name = '' } = {}) {
    const group = new THREE.Group();
    group.name = name;
    for (const [key, list] of this.parts) {
      const mat = this.M[key];
      if (!mat) { console.warn('[builder] missing material', key); continue; }
      const geo = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      if (!geo) continue;
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = `${name}:${key}`;
      mesh.castShadow = cast && !mat.transparent && !NO_CAST.has(key);
      mesh.receiveShadow = receive;
      mesh.userData.matKey = key;
      if (mat.transparent) mesh.userData.noAO = true;
      group.add(mesh);
    }
    this.parts.clear();
    return group;
  }
}
