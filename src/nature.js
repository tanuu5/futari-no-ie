// Landscape: the diorama plinth, lawn and grass, the sunken courtyard with pond and koi,
// procedural maple trees, raised vegetable beds, paths, hedges.
import * as THREE from 'three';
import { Builder, placeMatrix } from './builder.js';
import { COURT, DECK, RAMP, GARDEN_Y, GROUND_Y, PLINTH, FOOT } from './plan.js';
import { mulberry32 } from './util.js';

const shared = { time: { value: 0 } };

// Inject a gentle wind sway into a standard material (instanced or not).
function addWind(mat, { amp = 0.25, heightPow = 2, freq = 1.4, useUv = true } = {}) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = shared.time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 ip = vec3(0.0);
        #ifdef USE_INSTANCING
          ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        #endif
        float ph = dot(ip, vec3(0.73, 0.0, 0.51));
        float k = ${useUv ? `pow(clamp(uv.y, 0.0, 1.0), ${heightPow.toFixed(1)})` : '1.0'};
        float gust = 0.6 + 0.4 * sin(uTime * 0.35 + ip.x * 0.08);
        transformed.x += (sin(uTime * ${freq.toFixed(2)} + ph) * ${amp.toFixed(3)} + 0.08) * k * gust;
        transformed.z += cos(uTime * ${(freq * 0.83).toFixed(2)} + ph * 1.3) * ${(amp * 0.6).toFixed(3)} * k * gust;`);
  };
  mat.customProgramCacheKey = () => `wind-${amp}-${heightPow}-${freq}-${useUv}`;
}

function roundedRectShape(x0, x1, z0, z1, r) {
  // Shape coordinates are (x, -z) so that rotating -90° about X lands them on the XZ plane.
  const s = new THREE.Shape();
  const X0 = x0, X1 = x1, Y0 = -z1, Y1 = -z0;
  s.moveTo(X0 + r, Y0);
  s.lineTo(X1 - r, Y0);
  s.quadraticCurveTo(X1, Y0, X1, Y0 + r);
  s.lineTo(X1, Y1 - r);
  s.quadraticCurveTo(X1, Y1, X1 - r, Y1);
  s.lineTo(X0 + r, Y1);
  s.quadraticCurveTo(X0, Y1, X0, Y1 - r);
  s.lineTo(X0, Y0 + r);
  s.quadraticCurveTo(X0, Y0, X0 + r, Y0);
  return s;
}

function rectPath(x0, x1, z0, z1) {
  const p = new THREE.Path();
  p.moveTo(x0, -z1);
  p.lineTo(x1, -z1);
  p.lineTo(x1, -z0);
  p.lineTo(x0, -z0);
  p.lineTo(x0, -z1);
  return p;
}

// Flat shape geometry lying on the XZ plane at height y (UVs are world meters).
function flatShape(shape, y, curveSegments = 12) {
  const g = new THREE.ShapeGeometry(shape, curveSegments);
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

function blobPoints(cx, cz, rx, rz, n, rnd, wob = 0.18) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + (rnd() - 0.5) * wob;
    pts.push(new THREE.Vector2(cx + Math.cos(a) * rx * k, -(cz + Math.sin(a) * rz * k)));
  }
  const curve = new THREE.SplineCurve([...pts, pts[0]]);
  return curve.getSpacedPoints(64).slice(0, -1);
}

function rockGeometry(rnd, detail = 1) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.attributes.position;
  const seedA = rnd() * 10, seedB = rnd() * 10;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + 0.18 * Math.sin(x * 3.1 + seedA) * Math.cos(z * 2.7 + seedB) + (rnd() - 0.5) * 0.08;
    p.setXYZ(i, x * k, y * k, z * k);
  }
  g.computeVertexNormals();
  return g;
}

// ---------------- procedural tree ----------------
function growTree(rnd, o) {
  const branches = [];
  const clusters = [];
  const up = new THREE.Vector3(0, 1, 0);
  const branch = (p0, dir, len, r0, depth) => {
    const bend = new THREE.Vector3((rnd() - 0.5) * 0.3, 0.1, (rnd() - 0.5) * 0.3).multiplyScalar(len);
    const p1 = p0.clone().addScaledVector(dir, len);
    const pm = p0.clone().lerp(p1, 0.5).add(bend);
    const r1 = r0 * o.taper;
    branches.push({ pts: [p0, pm, p1], r0, r1 });
    if (depth >= o.depth) { clusters.push(p1.clone()); return; }
    if (depth >= o.depth - 1) clusters.push(pm.clone().lerp(p1, 0.6));
    const n = depth === 0 ? o.split0 : 2 + (rnd() < o.extra ? 1 : 0);
    const baseAz = rnd() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const az = baseAz + (i / n) * Math.PI * 2 + (rnd() - 0.5) * 0.9;
      const tilt = (depth === 0 ? o.tilt0 : o.tilt1) + (rnd() - 0.5) * 0.35;
      const nd = new THREE.Vector3(Math.sin(tilt) * Math.cos(az), Math.cos(tilt), Math.sin(tilt) * Math.sin(az));
      nd.lerp(dir, depth === 0 ? 0.15 : 0.25).normalize();
      branch(p1, nd, len * o.lenK * (0.85 + rnd() * 0.3), r1, depth + 1);
    }
  };
  branch(o.base.clone(), up, o.trunk, o.radius, 0);
  return { branches, clusters };
}

function tubeFor(b, rnd) {
  const curve = new THREE.CatmullRomCurve3(b.pts);
  const segs = 6, radial = 7;
  const g = new THREE.TubeGeometry(curve, segs, 1, radial, false);
  const p = g.attributes.position;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const c = curve.getPointAt(t);
    const r = b.r0 + (b.r1 - b.r0) * t;
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      p.setXYZ(k, c.x + (p.getX(k) - c.x) * r, c.y + (p.getY(k) - c.y) * r, c.z + (p.getZ(k) - c.z) * r);
    }
  }
  g.computeVertexNormals();
  void rnd;
  return g;
}

function makeTree(M, T, rnd, o) {
  const { branches, clusters } = growTree(rnd, o);
  const geos = branches.map((br) => tubeFor(br, rnd));
  const bark = new Builder(M);
  for (const g of geos) bark.add('bark', g, null, 'keep');
  const group = bark.build({ cast: true, name: 'tree' });

  // leaves
  const perCluster = o.leaves;
  const count = clusters.length * perCluster;
  const leafGeo = new THREE.PlaneGeometry(1, 1);
  leafGeo.translate(0, 0.35, 0);
  const leafMat = new THREE.MeshStandardMaterial({ map: T.leaf, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.75 });
  addWind(leafMat, { amp: 0.25, useUv: false, freq: 1.7 });
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, count);
  const depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: T.leaf, alphaTest: 0.5 });
  leaves.customDepthMaterial = depthMat;
  const col = new THREE.Color();
  const palette = o.palette.map((c) => new THREE.Color(c));
  let n = 0;
  const top = Math.max(...clusters.map((c) => c.y));
  for (const c of clusters) {
    for (let i = 0; i < perCluster; i++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * o.clusterR;
      const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
      const y = c.y + (rnd() - 0.35) * o.clusterR * 0.55;
      const s = o.leafSize * (0.75 + rnd() * 0.5);
      const m = placeMatrix(x, y, z, rnd() * Math.PI * 2, -Math.PI / 2 + (rnd() - 0.5) * 1.2, (rnd() - 0.5) * 0.8, s, s, s);
      leaves.setMatrixAt(n, m);
      const heightK = (y - o.base.y) / (top - o.base.y + 0.01);
      const outer = r / o.clusterR;
      let pick = rnd();
      pick = Math.min(0.999, pick * (0.75 + 0.35 * heightK + 0.25 * outer));
      col.copy(palette[Math.floor(pick * palette.length)]).multiplyScalar(0.85 + rnd() * 0.3);
      leaves.setColorAt(n, col);
      n++;
    }
  }
  leaves.instanceMatrix.needsUpdate = true;
  leaves.instanceColor.needsUpdate = true;
  leaves.castShadow = true;
  leaves.receiveShadow = true;
  leaves.userData.noAO = true;
  leaves.computeBoundingSphere();
  group.add(leaves);
  return { group, clusters, leaves };
}

// ---------------- main ----------------
export function buildNature(M, T, quality) {
  const root = new THREE.Group();
  root.name = 'nature';
  const b = new Builder(M);
  const rnd = mulberry32(77);
  const handles = { lamps: [] };

  // ----- plinth -----
  const P = PLINTH;
  const outline = roundedRectShape(P.x0, P.x1, P.z0, P.z1, P.r);
  const lawnShape = roundedRectShape(P.x0, P.x1, P.z0, P.z1, P.r);
  lawnShape.holes.push(rectPath(COURT.x0, COURT.x1, COURT.z0, COURT.z1));
  const lawnMesh = new THREE.Mesh(flatShape(lawnShape, GROUND_Y), M.lawn);
  lawnMesh.receiveShadow = true;
  root.add(lawnMesh);
  // sides with soil strata
  {
    // getSpacedPoints() repeats the first point at the end; drop it so no segment has zero
    // length (a zero normal becomes NaN in the shader and the bloom spreads it as a black block).
    const pts = outline.getSpacedPoints(220);
    const ring = pts.slice(0, -1);
    const N = ring.length;
    const pos = [], nor = [], uv = [], idx = [];
    let acc = 0;
    const top = GROUND_Y, bot = P.bottom;
    for (let i = 0; i <= N; i++) {
      const a = ring[i % N];
      const prev = ring[(i - 1 + N) % N], next = ring[(i + 1) % N];
      if (i > 0) acc += a.distanceTo(ring[i - 1]);
      const dx = next.x - prev.x, dz = -(next.y - prev.y);
      const len = Math.hypot(dx, dz);
      const n = [-dz / len, 0, dx / len];
      pos.push(a.x, top, -a.y, a.x, bot, -a.y);
      nor.push(...n, ...n);
      uv.push(acc, 1, acc, 0);
    }
    for (let i = 0; i < N; i++) {
      const k = i * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    const mesh = new THREE.Mesh(g, M.soilSide);
    mesh.material.side = THREE.DoubleSide;
    mesh.receiveShadow = true;
    root.add(mesh);
    const bottom = new THREE.Mesh(flatShape(outline, P.bottom), M.plinthBottom);
    bottom.rotation.x = 0;
    bottom.material.side = THREE.DoubleSide;
    root.add(bottom);
    // a thin grass lip overhanging the edge
    const lip = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.slice(0, -1).map((p) => new THREE.Vector3(p.x, GROUND_Y - 0.01, -p.y)), true), 220, 0.035, 5, true), M.hedge);
    lip.receiveShadow = true;
    root.add(lip);
  }

  // ----- courtyard ground & pond -----
  const pondPts = blobPoints(1.3, -0.15, 1.05, 0.58, 10, rnd, 0.22);
  const pondShape = new THREE.Shape(pondPts);
  {
    const ground = new THREE.Shape();
    ground.moveTo(COURT.x0, -COURT.z1);
    ground.lineTo(COURT.x1, -COURT.z1);
    ground.lineTo(COURT.x1, -DECK.z1);
    ground.lineTo(COURT.x0, -DECK.z1);
    ground.lineTo(COURT.x0, -COURT.z1);
    ground.holes.push(new THREE.Path(pondPts.slice().reverse()));
    const gm = new THREE.Mesh(flatShape(ground, GARDEN_Y), M.moss);
    gm.receiveShadow = true;
    root.add(gm);
    // basin: an extruded pond volume seen from the inside
    const basinGeo = new THREE.ExtrudeGeometry(pondShape, { depth: 0.42, bevelEnabled: false, curveSegments: 8 });
    basinGeo.rotateX(-Math.PI / 2);
    basinGeo.translate(0, GARDEN_Y - 0.42, 0);
    const basin = new THREE.Mesh(basinGeo, new THREE.MeshStandardMaterial({ color: 0x2a2822, roughness: 1, side: THREE.BackSide }));
    basin.receiveShadow = true;
    root.add(basin);
    // water
    const water = new THREE.Mesh(flatShape(pondShape, GARDEN_Y - 0.075), M.water);
    water.userData.noAO = true;
    water.receiveShadow = true;
    root.add(water);
    handles.water = water;
    // rim rocks
    for (let i = 0; i < pondPts.length; i += 4) {
      const p = pondPts[i];
      const s = 0.1 + rnd() * 0.1;
      b.add(rnd() < 0.5 ? 'stone' : 'stoneDark', rockGeometry(rnd, 1), placeMatrix(p.x, GARDEN_Y + s * 0.2, -p.y, rnd() * 6, 0, 0, s * 1.4, s * 0.8, s * 1.2));
    }
    // koi
    handles.koi = [];
    const koiWhite = new THREE.MeshStandardMaterial({ color: 0xf2eee6, roughness: 0.4 });
    const koiOrange = new THREE.MeshStandardMaterial({ color: 0xe8662e, roughness: 0.4 });
    for (let i = 0; i < 3; i++) {
      const fish = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), i === 1 ? koiWhite : koiOrange);
      body.scale.set(0.035, 0.022, 0.1);
      const patch = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), i === 1 ? koiOrange : koiWhite);
      patch.scale.set(0.028, 0.016, 0.045);
      patch.position.set(0, 0.009, 0.02);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.07, 6), body.material);
      tail.rotation.x = -Math.PI / 2;
      tail.scale.set(1, 0.3, 1);
      tail.position.z = -0.11;
      fish.add(body, patch, tail);
      fish.userData = { tail, phase: i * 2.1, speed: 0.35 + i * 0.07 };
      root.add(fish);
      handles.koi.push(fish);
    }
    handles.pondCenter = new THREE.Vector3(1.3, GARDEN_Y - 0.13, -0.15);
  }
  // shoe stone in front of the engawa, stepping stones along the garden path
  b.add('stone', rockGeometry(rnd, 2), placeMatrix(-0.95, GARDEN_Y + 0.02, -0.72, 0.2, 0, 0, 0.55, 0.1, 0.3));
  for (let x = 3.1; x > -3.6; x -= 0.56) {
    const z = 0.95 + Math.sin(x * 1.7) * 0.05;
    b.add('stone', rockGeometry(rnd, 1), placeMatrix(x, GARDEN_Y + 0.005, z, rnd() * 3, 0, 0, 0.22 + rnd() * 0.05, 0.03, 0.18 + rnd() * 0.04));
  }
  // ramp (deck level down to the garden)
  {
    const len = Math.hypot(RAMP.z1 - RAMP.z0, -GARDEN_Y);
    const ang = Math.atan2(-GARDEN_Y, RAMP.z1 - RAMP.z0);
    b.add('deck', new THREE.BoxGeometry(RAMP.x1 - RAMP.x0, 0.06, len), placeMatrix((RAMP.x0 + RAMP.x1) / 2, GARDEN_Y / 2 - 0.03, (RAMP.z0 + RAMP.z1) / 2, 0, ang, 0));
    b.bx('woodDark', RAMP.x0 - 0.04, GARDEN_Y, RAMP.z0, RAMP.x0, -0.02, RAMP.z1);
    b.rod('woodDark', RAMP.x0 + 0.02, 0.8, RAMP.z0, RAMP.x0 + 0.02, 0.5, RAMP.z1, 0.02, 6); // handrail
    for (const z of [RAMP.z0 + 0.1, (RAMP.z0 + RAMP.z1) / 2, RAMP.z1 - 0.1]) {
      const yb = GARDEN_Y * ((z - RAMP.z0) / (RAMP.z1 - RAMP.z0));
      b.rod('woodDark', RAMP.x0 + 0.02, yb, z, RAMP.x0 + 0.02, yb + 0.8 - 0.3 * ((z - RAMP.z0) / (RAMP.z1 - RAMP.z0)) + 0.0, z, 0.018, 6);
    }
  }
  // raised vegetable beds (60 cm: no bending for the human, easy reach for Claude)
  const bedTop = GARDEN_Y + 0.62;
  for (const [x0, x1] of [[-3.75, -1.55], [-1.3, 0.9]]) {
    b.faces({ py: null, ny: null, all: 'woodMid' }, x0, GARDEN_Y, 1.25, x1, bedTop, 1.95);
    b.faces({ py: 'woodLight', ny: null, all: 'woodLight' }, x0 - 0.03, bedTop, 1.22, x1 + 0.03, bedTop + 0.03, 1.28);
    b.faces({ py: 'woodLight', ny: null, all: 'woodLight' }, x0 - 0.03, bedTop, 1.92, x1 + 0.03, bedTop + 0.03, 1.98);
    b.faces({ py: 'soil', ny: null, all: 'soil' }, x0 + 0.02, bedTop - 0.06, 1.27, x1 - 0.02, bedTop - 0.02, 1.93);
    for (let i = 0; i < 3; i++) b.bx('woodDark', x0, GARDEN_Y + 0.08 + i * 0.2, 1.245, x1, GARDEN_Y + 0.1 + i * 0.2, 1.25);
  }
  // tomatoes (bed A)
  for (let i = 0; i < 4; i++) {
    const x = -3.45 + i * 0.55, z = 1.6;
    b.rod('woodLight', x, bedTop - 0.05, z, x, bedTop + 0.95, z, 0.008, 5);
    for (let k = 0; k < 16; k++) {
      const y = bedTop + 0.1 + k * 0.055, a = k * 2.4 + i, r = 0.05 + (k % 3) * 0.035;
      b.ell(k % 2 ? 'leafGreen' : 'leafDark', x + Math.cos(a) * r, y, z + Math.sin(a) * r, 0.034, 0.008, 0.075, Math.atan2(Math.cos(a), Math.sin(a)), 0.55);
    }
    for (let k = 0; k < 4; k++) b.sphere(k === 3 ? 'leafGreen' : 'tomato', x + Math.cos(k * 1.7) * 0.09, bedTop + 0.25 + k * 0.13, z + 0.1 + Math.sin(k) * 0.03, 0.03 + (k % 2) * 0.006, 10);
  }
  // eggplants and herbs (bed B)
  for (let i = 0; i < 3; i++) {
    const x = -1.0 + i * 0.55, z = 1.58;
    for (let k = 0; k < 9; k++) {
      const a = k * 0.7 + i, r = 0.07 + (k % 2) * 0.05;
      b.ell(k % 3 ? 'leafDark' : 'leafGreen', x + Math.cos(a) * r, bedTop + 0.12 + (k % 3) * 0.07, z + Math.sin(a) * r, 0.05, 0.01, 0.1, Math.atan2(Math.cos(a), Math.sin(a)), 0.45);
    }
    b.ell('eggplant', x + 0.05, bedTop + 0.1, z + 0.12, 0.03, 0.07, 0.03, 0, 0.3);
    b.ell('eggplant', x - 0.06, bedTop + 0.12, z + 0.09, 0.026, 0.06, 0.026, 0, -0.3);
  }
  for (let i = 0; i < 5; i++) b.ell('leafGreen', 0.55 + (i % 2) * 0.15, bedTop + 0.06, 1.4 + i * 0.1, 0.07, 0.05, 0.07);
  // fern clumps at the tree base
  for (let i = 0; i < 4; i++) {
    const cx = -3.4 + i * 0.5, cz = -0.75 + (i % 2) * 0.35;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      b.ell('leafDark', cx + Math.cos(a) * 0.12, GARDEN_Y + 0.08, cz + Math.sin(a) * 0.12, 0.04, 0.012, 0.16, Math.atan2(Math.cos(a), Math.sin(a)), 0.5);
    }
  }
  // rain chain into a stone basin
  for (let y = GARDEN_Y + 0.1, i = 0; y < 2.72; y += 0.085, i++) b.torus('steel', 3.78, y, 1.98, 0.024, 0.006, i % 2 ? Math.PI / 2 : 0, 10, i % 2 ? Math.PI / 2 : 0);
  b.cyl('stoneDark', 3.78, GARDEN_Y + 0.06, 1.98, 0.15, 0.12, 0.12, 16);
  // ground spotlight fixture for the maple
  b.cyl('black', -2.75, GARDEN_Y + 0.05, 0.55, 0.05, 0.06, 0.1, 10);

  // ----- maple in the courtyard -----
  const maple = makeTree(M, T, mulberry32(12), {
    base: new THREE.Vector3(-2.3, GARDEN_Y, -0.2), trunk: 1.4, radius: 0.11, taper: 0.66, depth: 4,
    split0: 3, extra: 0.45, tilt0: 0.55, tilt1: 0.85, lenK: 0.68, clusterR: 0.5, leaves: 120, leafSize: 0.125,
    palette: ['#5f8a34', '#6d9540', '#7ea24b', '#5a7f30', '#8fae4f', '#b9b44c', '#d9a53d', '#df8a33', '#cf5a2c', '#b63f27'],
  });
  root.add(maple.group);
  handles.maple = maple;

  // ----- exterior trees -----
  const t1 = makeTree(M, T, mulberry32(33), {
    base: new THREE.Vector3(11.3, GROUND_Y, 10.0), trunk: 1.7, radius: 0.2, taper: 0.64, depth: 4,
    split0: 3, extra: 0.5, tilt0: 0.45, tilt1: 0.85, lenK: 0.72, clusterR: 0.7, leaves: 80, leafSize: 0.16,
    palette: ['#4f7a31', '#5d8a38', '#6b9640', '#557f35', '#79a049', '#8aa84e', '#a9ad4c'],
  });
  root.add(t1.group);
  const t2 = makeTree(M, T, mulberry32(44), {
    base: new THREE.Vector3(-11.6, GROUND_Y, -8.4), trunk: 1.5, radius: 0.17, taper: 0.64, depth: 4,
    split0: 3, extra: 0.45, tilt0: 0.5, tilt1: 0.9, lenK: 0.7, clusterR: 0.62, leaves: 75, leafSize: 0.15,
    palette: ['#4a7430', '#58843a', '#66903f', '#517a33', '#739a47', '#c8a043', '#d8b04a'],
  });
  root.add(t2.group);

  // ----- paths, patio, gravel edge -----
  const gravelEdge = (x0, z0, x1, z1) => b.faces({ py: 'gravel', ny: null, all: 'stoneDark' }, x0, GROUND_Y, z0, x1, GROUND_Y + 0.02, z1);
  gravelEdge(-9.6, -7.6, 9.6, -7.1);
  gravelEdge(-9.6, 7.1, -7.9, 7.6);
  gravelEdge(-6.3, 7.1, 5.3, 7.6);
  gravelEdge(7.45, 7.1, 9.6, 7.6);
  gravelEdge(-9.6, -7.1, -9.1, 7.1);
  gravelEdge(9.1, -7.1, 9.6, 7.1);
  // approach: gravel bed + stone slabs, gentle slope to the flush entrance
  b.faces({ py: 'gravel', ny: null, all: 'stoneDark' }, -7.9, GROUND_Y, 8.6, -6.3, GROUND_Y + 0.02, P.z1 - 0.05);
  {
    const len = Math.hypot(1.5, -GROUND_Y);
    b.add('stone', new THREE.BoxGeometry(1.6, 0.05, len), placeMatrix(-7.1, GROUND_Y / 2 - 0.005, 7.85, 0, Math.atan2(-GROUND_Y, 1.5), 0));
  }
  for (let z = 9.0; z < P.z1 - 0.3; z += 0.72) b.rbox('stone', -7.1 + Math.sin(z * 2.3) * 0.12, GROUND_Y + 0.03, z, 0.95, 0.05, 0.46, 0.03);
  // gate posts and mailbox
  for (const x of [-8.15, -6.05]) {
    b.rbox('woodDark', x, 0.55, P.z1 - 0.45, 0.14, 1.4, 0.14, 0.02);
    b.rbox('woodDark', x, 1.27, P.z1 - 0.45, 0.2, 0.05, 0.2, 0.01);
  }
  b.rod('woodDark', -5.5, GROUND_Y, P.z1 - 0.5, -5.5, 1.0, P.z1 - 0.5, 0.03, 8);
  b.rbox('terra', -5.5, 1.08, P.z1 - 0.5, 0.3, 0.2, 0.2, 0.03);
  // garden bollard lights along the path
  const bollardMat = new THREE.MeshStandardMaterial({ color: 0xf3ead9, emissive: 0xffc98f, emissiveIntensity: 0 });
  handles.bollardMat = bollardMat;
  for (const z of [8.8, 10.6, 12.4]) {
    for (const x of [-8.25]) {
      b.cyl('black', x, GROUND_Y + 0.25, z, 0.05, 0.05, 0.5, 10);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.08, 12), bollardMat);
      cap.position.set(x, GROUND_Y + 0.46, z);
      cap.userData.noAO = true;
      root.add(cap);
    }
  }
  // Claude's patio outside the garden door
  b.faces({ py: 'deck', ny: null, all: 'woodDark' }, 5.3, GROUND_Y, 7.1, 7.45, -0.02, 8.9);
  b.at(6.9, -0.02, 8.3, -0.6, (c) => {
    c.rbox('woodLight', 0, 0.42, 0, 0.46, 0.05, 0.44, 0.02);
    for (const [lx, lz] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]]) c.cyl('woodMid', lx, 0.2, lz, 0.018, 0.016, 0.4, 6);
    c.rbox('woodLight', 0, 0.72, -0.2, 0.44, 0.3, 0.04, 0.02);
  });
  b.cyl('steel', 5.75, 0.1, 8.55, 0.09, 0.1, 0.2, 14); // watering can
  b.rod('steel', 5.75, 0.15, 8.62, 5.75, 0.26, 8.78, 0.012, 6);
  b.cyl('potTerra', 7.2, 0.12, 7.4, 0.16, 0.12, 0.28, 14);
  for (let k = 0; k < 7; k++) b.ell('leafGreen', 7.2 + Math.cos(k) * 0.08, 0.32 + (k % 3) * 0.05, 7.4 + Math.sin(k) * 0.08, 0.06, 0.04, 0.09, k, 0.4);
  // outdoor heat-pump unit by the utility room
  b.rbox('lacquer', -9.62, 0.3, 0.9, 0.34, 0.6, 0.85, 0.02);
  b.cyl('black', -9.8, 0.32, 0.9, 0.22, 0.22, 0.01, 24, 0, Math.PI / 2);
  // bench under the big tree
  b.at(10.3, GROUND_Y, 8.6, -0.5, (c) => {
    c.rbox('woodLight', 0, 0.44, 0, 1.4, 0.05, 0.42, 0.02);
    c.rbox('woodLight', 0, 0.7, -0.2, 1.4, 0.28, 0.04, 0.02);
    for (const x of [-0.6, 0.6]) c.rbox('black', x, 0.21, 0, 0.05, 0.42, 0.4, 0.01);
  });

  // ----- hedges & fence -----
  const hedge = (x0, x1, z0, z1, h = 0.85) => {
    b.rbox('hedge', (x0 + x1) / 2, GROUND_Y + h / 2, (z0 + z1) / 2, x1 - x0, h, z1 - z0, 0.2);
    const n = Math.round(Math.max(x1 - x0, z1 - z0) / 0.35);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      b.ell('hedge', x + (rnd() - 0.5) * 0.1, GROUND_Y + h - 0.02, z + (rnd() - 0.5) * 0.1, 0.24, 0.12, 0.24, rnd() * 3);
    }
  };
  hedge(P.x0 + 0.5, -8.35, P.z1 - 0.9, P.z1 - 0.35);
  hedge(-5.85, P.x1 - 0.5, P.z1 - 0.9, P.z1 - 0.35);
  for (let x = P.x0 + 0.8; x < P.x1 - 0.6; x += 1.6) b.rbox('woodDark', x, GROUND_Y + 0.4, P.z0 + 0.45, 0.08, 0.8, 0.08, 0.01);
  b.bx('woodMid', P.x0 + 0.8, GROUND_Y + 0.55, P.z0 + 0.42, P.x1 - 0.8, GROUND_Y + 0.62, P.z0 + 0.48);
  b.bx('woodMid', P.x0 + 0.8, GROUND_Y + 0.25, P.z0 + 0.42, P.x1 - 0.8, GROUND_Y + 0.32, P.z0 + 0.48);
  for (const x of [P.x0 + 0.45, P.x1 - 0.45]) {
    for (let z = P.z0 + 1.6; z < P.z1 - 1.3; z += 1.6) b.rbox('woodDark', x, GROUND_Y + 0.4, z, 0.08, 0.8, 0.08, 0.01);
    b.bx('woodMid', x - 0.03, GROUND_Y + 0.55, P.z0 + 1.6, x + 0.03, GROUND_Y + 0.62, P.z1 - 1.3);
    b.bx('woodMid', x - 0.03, GROUND_Y + 0.25, P.z0 + 1.6, x + 0.03, GROUND_Y + 0.32, P.z1 - 1.3);
  }
  // shrubs
  const shrub = (x, z, s) => {
    for (let i = 0; i < 5; i++) b.ell(i % 2 ? 'hedge' : 'leafDark', x + (rnd() - 0.5) * s, GROUND_Y + s * 0.35 + rnd() * s * 0.2, z + (rnd() - 0.5) * s, s * 0.45, s * 0.38, s * 0.45, rnd() * 3);
  };
  for (const [x, z, s] of [[-12.2, 5.5, 0.9], [-12.6, 1.0, 0.7], [12.4, -3.5, 0.85], [12.1, 3.2, 0.7], [-3.5, -9.2, 0.8], [4.5, -9.6, 0.9], [8.0, 11.0, 0.7], [-3.0, 11.4, 0.75], [1.5, 12.0, 0.6], [12.6, -9.2, 0.9]]) shrub(x, z, s);

  const built = b.build({ cast: true, name: 'garden' });
  root.add(built);

  // ----- grass blades on the lawn -----
  {
    const blade = new THREE.BufferGeometry();
    const hw = 0.5;
    const verts = [-hw, 0, 0, hw, 0, 0, -hw * 0.7, 0.33, 0.02, hw * 0.7, 0.33, 0.02, -hw * 0.35, 0.7, 0.06, hw * 0.35, 0.7, 0.06, 0, 1, 0.12];
    const uvs = [0, 0, 1, 0, 0, 0.33, 1, 0.33, 0, 0.7, 1, 0.7, 0.5, 1];
    blade.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    blade.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    blade.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5, 4, 5, 6]);
    const nrm = [];
    for (let i = 0; i < 7; i++) nrm.push(0, 0.9, 0.44);
    blade.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    const count = quality === 'low' ? 9000 : 26000;
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide });
    addWind(mat, { amp: 1.0, heightPow: 2, freq: 1.9 });
    const prev = mat.onBeforeCompile;
    mat.onBeforeCompile = (shader) => {
      prev(shader);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vH;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvH = uv.y;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vH;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= mix(0.45, 1.05, vH);');
    };
    mat.customProgramCacheKey = () => 'grass';
    const grass = new THREE.InstancedMesh(blade, mat, count);
    const col = new THREE.Color();
    const greens = ['#6f9a45', '#7aa24c', '#5f8a3a', '#86ab55', '#98b35c', '#6a8f3f'].map((c) => new THREE.Color(c));
    let n = 0;
    const gr = mulberry32(5);
    const inRect = (x, z, x0, x1, z0, z1) => x > x0 && x < x1 && z > z0 && z < z1;
    let guard = 0;
    while (n < count && guard++ < count * 4) {
      const x = P.x0 + 0.3 + gr() * (P.x1 - P.x0 - 0.6);
      const z = P.z0 + 0.3 + gr() * (P.z1 - P.z0 - 0.6);
      if (inRect(x, z, FOOT.x0 - 0.75, FOOT.x1 + 0.75, FOOT.z0 - 0.75, FOOT.z1 + 0.75)) continue;
      if (inRect(x, z, -8.1, -6.1, 7, P.z1)) continue;
      if (inRect(x, z, 5.2, 7.6, 7, 9.1)) continue;
      if (inRect(x, z, -10.0, -9.2, 0.3, 1.5)) continue;
      const corner = Math.min(x - P.x0, P.x1 - x, z - P.z0, P.z1 - z);
      if (corner < 0.25) continue;
      const hgt = 0.1 + gr() * 0.16;
      const m = placeMatrix(x, GROUND_Y, z, gr() * Math.PI * 2, 0, 0, 0.05 + gr() * 0.03, hgt, hgt);
      grass.setMatrixAt(n, m);
      col.copy(greens[(gr() * greens.length) | 0]).multiplyScalar(0.85 + gr() * 0.3);
      grass.setColorAt(n, col);
      n++;
    }
    grass.count = n;
    grass.instanceMatrix.needsUpdate = true;
    grass.instanceColor.needsUpdate = true;
    grass.receiveShadow = true;
    grass.castShadow = false;
    grass.userData.noAO = true;
    grass.frustumCulled = false;
    root.add(grass);
  }

  // ----- lamps that live in the garden -----
  {
    // paper lantern (andon) on the engawa
    const frameB = new Builder(M);
    frameB.at(-0.95, 0, -1.4, 0.3, (c) => {
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) c.bx('woodDark', sx * 0.11 - 0.012, 0, sz * 0.11 - 0.012, sx * 0.11 + 0.012, 0.42, sz * 0.11 + 0.012);
      c.bx('woodDark', -0.13, 0.4, -0.13, 0.13, 0.43, 0.13);
      c.bx('woodDark', -0.13, 0.05, -0.13, 0.13, 0.07, 0.13);
    });
    root.add(frameB.build({ cast: true, name: 'andon' }));
    const paperMat = new THREE.MeshStandardMaterial({ color: 0xf5eddc, emissive: 0xffc27a, emissiveIntensity: 0, roughness: 0.9 });
    const paper = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.33, 0.21), paperMat);
    paper.position.set(-0.95, 0.235, -1.4);
    paper.rotation.y = 0.3;
    paper.userData.noAO = true;
    root.add(paper);
    handles.lamps.push({ id: 'andon', pos: new THREE.Vector3(-0.95, 0.3, -1.3), color: 0xffb46e, power: 2.4, distance: 4, mats: [paperMat], glowK: 1.8 });
    // porch light on a post by the front door
    const porchMat = new THREE.MeshStandardMaterial({ color: 0xf5eddc, emissive: 0xffc98f, emissiveIntensity: 0 });
    const porch = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.22, 16), porchMat);
    porch.position.set(-8.35, 1.7, 7.95);
    porch.userData.noAO = true;
    root.add(porch);
    const post = new Builder(M);
    post.rod('black', -8.35, GROUND_Y, 7.95, -8.35, 1.6, 7.95, 0.025, 8);
    post.cyl('black', -8.35, 1.83, 7.95, 0.02, 0.13, 0.05, 16);
    root.add(post.build({ cast: true, name: 'porch-post' }));
    handles.lamps.push({ id: 'porch', pos: new THREE.Vector3(-8.35, 1.62, 7.95), color: 0xffc27a, power: 3.2, distance: 6, mats: [porchMat] });
  }

  handles.uplight = { pos: new THREE.Vector3(-2.75, GARDEN_Y + 0.12, 0.55), target: new THREE.Vector3(-2.3, 2.3, -0.2) };

  handles.update = (t) => {
    shared.time.value = t;
    if (M.water.normalMap) {
      M.water.normalMap.offset.set(t * 0.012, t * 0.007);
    }
    const c = handles.pondCenter;
    for (const f of handles.koi) {
      const u = f.userData;
      const a = t * u.speed + u.phase;
      const x = c.x + Math.cos(a) * 0.62;
      const z = c.z + Math.sin(a * 2) * 0.26;
      const dx = -Math.sin(a) * 0.62, dz = Math.cos(a * 2) * 0.52;
      f.position.set(x, c.y + Math.sin(a * 3) * 0.015, z);
      f.rotation.y = Math.atan2(dx, dz);
      u.tail.rotation.y = Math.sin(t * 6 + u.phase) * 0.35;
    }
  };

  return { root, handles };
}

export { shared as natureShared };
