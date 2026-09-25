// Architecture: floors, walls (with a dollhouse cut-away), doors, roof.
// Visible walls do not cast shadows. An invisible full-height proxy (walls + roof) does,
// so daylight reaches the rooms only through the windows even when the roof is lifted off.
import * as THREE from 'three';
import { Builder, placeMatrix } from './builder.js';
import { H, CUT, ROOMS, WALLS, COURT, DECK } from './plan.js';
import { damp, smoothstep } from './util.js';

const GROUPS = ['ext+z', 'ext-z', 'ext+x', 'ext-x', 'int-x', 'int-z'];
const EPS = 1e-4;

// Which side of each corridor wall faces the corridor (foot lights go there).
const FOOT_SIDE = { iCS: -1, iUC: 1, iBC: -1, iBD: -1, iEC: 1 };

function groupOf(w) {
  if (w.kind === 'ext') return w.axis === 'x' ? (w.out > 0 ? 'ext+z' : 'ext-z') : (w.out > 0 ? 'ext+x' : 'ext-x');
  return w.axis === 'x' ? 'int-x' : 'int-z';
}

export function buildHouse(M, T) {
  const root = new THREE.Group();
  root.name = 'house';

  // ---------- floors & foundation ----------
  const fb = new Builder(M);
  for (const r of ROOMS) fb.faces({ py: r.floor }, r.x0, -0.3, r.z0, r.x1, 0, r.z1);
  const found = { py: null, all: 'foundation' };
  fb.faces(found, -9.1, -0.3, -7.1, 9.1, 0, COURT.z0);
  fb.faces(found, -9.1, -0.3, COURT.z1, 9.1, 0, 7.1);
  fb.faces(found, -9.1, -0.3, COURT.z0, COURT.x0, 0, COURT.z1);
  fb.faces(found, COURT.x1, -0.3, COURT.z0, 9.1, 0, COURT.z1);
  fb.faces({ py: 'deck', ny: null, all: 'woodDark' }, DECK.x0, -0.3, DECK.z0, DECK.x1, 0, DECK.z1);
  root.add(fb.build({ cast: false, name: 'floors' }));

  // ---------- walls ----------
  const lower = new Builder(M);
  const upper = Object.fromEntries(GROUPS.map((g) => [g, new Builder(M).push(0, -CUT, 0)]));
  const proxy = new Builder(M);
  const trim = new Builder(M);
  const foot = new Builder({ footLight: M.cap });
  const doors = [];
  const norens = [];

  for (const w of WALLS) {
    const g = groupOf(w);
    const half = w.t / 2;
    const isX = w.axis === 'x';
    const box = (u0, u1, d0, d1) => (isX ? [u0, w.at + d0, u1, w.at + d1] : [w.at + d0, u0, w.at + d1, u1]);
    const outFace = isX ? (w.out > 0 ? 'pz' : 'nz') : (w.out > 0 ? 'px' : 'nx');
    const sides = isX ? ['pz', 'nz'] : ['px', 'nx'];
    const ends = isX ? ['px', 'nx'] : ['pz', 'nz'];

    const wallKeys = (top, bottom) => {
      const k = { py: top, ny: bottom };
      for (const f of sides) k[f] = 'plaster';
      for (const f of ends) k[f] = 'plaster';
      if (w.kind === 'ext') k[outFace] = 'cladding';
      if (w.kind === 'court') k[outFace] = 'woodLight';
      return k;
    };
    const simpleKeys = (key) => (top, bottom) => ({ all: key, py: top, ny: bottom });

    // Route a box into the lower / upper builders, splitting at the cut height.
    const put = (makeKeys, u0, u1, y0, y1, d0, d1, topKey, bottomKey, capKey) => {
      const [x0, z0, x1, z1] = box(u0, u1, d0, d1);
      if (y1 <= CUT + EPS) lower.faces(makeKeys(topKey, bottomKey), x0, y0, z0, x1, y1, z1);
      else if (y0 >= CUT - EPS) upper[g].faces(makeKeys(topKey, bottomKey), x0, y0, z0, x1, y1, z1);
      else {
        lower.faces(makeKeys(capKey, bottomKey), x0, y0, z0, x1, CUT, z1);
        upper[g].faces(makeKeys(topKey, null), x0, CUT, z0, x1, y1, z1);
      }
    };
    const putSimple = (key, u0, u1, y0, y1, d0, d1) =>
      put(simpleKeys(key), u0, u1, y0, y1, d0, d1, key, y0 > EPS ? key : null, key);

    const ops = [...w.open].sort((a, b) => a.a - b.a);
    const pieces = [];
    let u = w.from;
    for (const o of ops) {
      if (o.a > u + EPS) pieces.push({ u0: u, u1: o.a, y0: 0, y1: H });
      if (o.y0 > EPS) pieces.push({ u0: o.a, u1: o.b, y0: 0, y1: o.y0, sill: o });
      if (o.y1 < H - EPS) pieces.push({ u0: o.a, u1: o.b, y0: o.y1, y1: H });
      u = o.b;
    }
    if (w.to > u + EPS) pieces.push({ u0: u, u1: w.to, y0: 0, y1: H });

    for (const p of pieces) {
      const top = p.y1 >= H - EPS ? 'cap' : p.sill ? 'woodLight' : 'plaster';
      const bottom = p.y0 > EPS ? 'plaster' : null;
      put(wallKeys, p.u0, p.u1, p.y0, p.y1, -half, half, top, bottom, 'cap');
      const [x0, z0, x1, z1] = box(p.u0, p.u1, -half, half);
      proxy.bx('shadowProxy', x0, p.y0, z0, x1, p.y1, z1);
      if (p.y0 < EPS) {
        const faceSides = w.kind === 'int' ? [-1, 1] : [w.out > 0 ? -1 : 1];
        for (const s of faceSides) {
          const d0 = s > 0 ? half : -half - 0.012, d1 = s > 0 ? half + 0.012 : -half;
          const [bx0, bz0, bx1, bz1] = box(p.u0, p.u1, d0, d1);
          trim.bx('woodMid', bx0, 0, bz0, bx1, 0.07, bz1);
        }
        const fs = FOOT_SIDE[w.id];
        if (fs && p.u1 - p.u0 > 0.3) {
          const d0 = fs > 0 ? half + 0.012 : -half - 0.02, d1 = fs > 0 ? half + 0.02 : -half - 0.012;
          const [fx0, fz0, fx1, fz1] = box(p.u0 + 0.05, p.u1 - 0.05, d0, d1);
          foot.bx('footLight', fx0, 0.09, fz0, fx1, 0.105, fz1);
        }
      }
      if (p.sill && p.sill.type === 'half') {
        const [cx0, cz0, cx1, cz1] = box(p.u0 - 0.02, p.u1 + 0.02, -half - 0.05, half + 0.05);
        lower.bx('woodLight', cx0, p.y1 - 0.001, cz0, cx1, p.y1 + 0.035, cz1);
      }
    }

    for (const o of ops) {
      const fw = 0.045;
      const fd = Math.min(0.07, w.t * 0.6);
      if (o.type === 'win' || o.type === 'fix') {
        const glassKey = o.frost ? 'glassFrost' : 'glass';
        putSimple('frame', o.a, o.b, o.y1 - fw, o.y1, -fd / 2, fd / 2);
        putSimple('frame', o.a, o.b, o.y0, o.y0 + (o.y0 > 0 ? fw : 0.025), -fd / 2, fd / 2);
        putSimple('frame', o.a, o.a + fw, o.y0, o.y1, -fd / 2, fd / 2);
        putSimple('frame', o.b - fw, o.b, o.y0, o.y1, -fd / 2, fd / 2);
        const span = o.b - o.a;
        const n = o.type === 'win' ? Math.max(2, Math.ceil(span / 1.4)) : Math.ceil(span / 1.9);
        for (let i = 1; i < n; i++) {
          const um = o.a + (span * i) / n;
          putSimple('frame', um - fw / 2, um + fw / 2, o.y0, o.y1, -fd / 2, fd / 2);
        }
        put(simpleKeys(glassKey), o.a + fw, o.b - fw, o.y0 + fw * 0.5, o.y1 - fw, -0.006, 0.006, glassKey, glassKey, glassKey);
        if (o.y0 > 0.3 && w.kind !== 'int') {
          const s = w.out > 0 ? -1 : 1; // interior side
          const d0 = s > 0 ? -0.01 : -half - 0.06, d1 = s > 0 ? half + 0.06 : 0.01;
          putSimple('woodLight', o.a - 0.05, o.b + 0.05, o.y0 - 0.025, o.y0 + 0.006, d0, d1);
        }
      } else if (o.type === 'door') {
        const trimKey = w.kind === 'ext' || w.kind === 'court' ? 'frame' : 'woodMid';
        const td = half + 0.012;
        putSimple(trimKey, o.a - 0.04, o.b + 0.04, o.y1, o.y1 + 0.05, -td, td);
        putSimple(trimKey, o.a - 0.04, o.a, 0, o.y1, -td, td);
        putSimple(trimKey, o.b, o.b + 0.04, 0, o.y1, -td, td);
        // overhead rail on the side the leaf runs
        const rs = o.door.side;
        const r0 = Math.min(o.a, o.a + (o.b - o.a) * o.door.slide) - 0.05;
        const r1 = Math.max(o.b, o.b + (o.b - o.a) * o.door.slide) + 0.05;
        const rd0 = rs > 0 ? half : -half - 0.05, rd1 = rs > 0 ? half + 0.05 : -half;
        putSimple('frame', r0, r1, o.y1 + 0.05, o.y1 + 0.09, rd0, rd1);
        doors.push(makeDoor(M, w, o, g));
      } else if (o.type === 'hole') {
        const td = half + 0.01;
        putSimple('woodMid', o.a - 0.03, o.b + 0.03, o.y1, o.y1 + 0.04, -td, td);
        if (o.noren !== undefined) norens.push({ w, o, g });
      }
    }
  }

  // courtyard corner posts
  for (const [x, z] of [[COURT.x0, COURT.z0], [COURT.x1, COURT.z0], [COURT.x0, COURT.z1], [COURT.x1, COURT.z1]]) {
    lower.faces({ all: 'woodMid', py: 'cap', ny: null }, x - 0.09, 0, z - 0.09, x + 0.09, CUT, z + 0.09);
    upper['int-x'].faces({ all: 'woodMid', ny: null }, x - 0.09, CUT, z - 0.09, x + 0.09, H, z + 0.09);
    proxy.bx('shadowProxy', x - 0.09, 0, z - 0.09, x + 0.09, H, z + 0.09);
  }

  root.add(lower.build({ cast: false, name: 'walls-lower' }));
  root.add(trim.build({ cast: false, name: 'trim' }));

  const cutGroups = {};
  for (const gk of GROUPS) {
    const grp = new THREE.Group();
    grp.name = `walls-${gk}`;
    grp.position.y = CUT;
    grp.add(upper[gk].build({ cast: false, name: `walls-${gk}` }));
    root.add(grp);
    cutGroups[gk] = { group: grp, h: 1, target: 1 };
  }

  // noren curtains (the bath one says ゆ, "hot water")
  for (const { w, o, g } of norens) {
    const width = o.b - o.a - 0.04;
    const mat = new THREE.MeshStandardMaterial({ map: o.noren ? T.norenYu : T.noren, roughness: 0.95, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, 0.7), mat);
    const mid = (o.a + o.b) / 2;
    const y = o.y1 - 0.05 - 0.35 - CUT;
    if (w.axis === 'x') mesh.position.set(mid, y, w.at);
    else { mesh.position.set(w.at, y, mid); mesh.rotation.y = Math.PI / 2; }
    mesh.receiveShadow = true;
    cutGroups[g].group.add(mesh);
  }

  for (const d of doors) root.add(d.mesh);

  const footMat = new THREE.MeshStandardMaterial({ color: 0x2a2622, emissive: 0xffc78a, emissiveIntensity: 0 });
  const footGroup = foot.build({ cast: false, receive: false, name: 'footlights' });
  footGroup.traverse((o) => { if (o.isMesh) { o.material = footMat; o.userData.noAO = true; } });
  root.add(footGroup);

  const roof = buildRoof(M, proxy);
  root.add(roof.group);

  const proxyGroup = proxy.build({ cast: true, receive: false, name: 'shadow-proxy' });
  proxyGroup.traverse((o) => {
    if (o.isMesh) { o.castShadow = true; o.userData.noAO = true; o.frustumCulled = false; }
  });
  root.add(proxyGroup);

  return new House(root, cutGroups, doors, roof, footMat);
}

function makeDoor(M, w, o, g) {
  const d = o.door;
  const width = o.b - o.a + 0.05;
  const height = o.y1 + 0.02;
  const th = 0.036;
  const b = new Builder(M);
  if (d.style === 'glass') {
    b.bx('frame', -width / 2, 0, -th / 2, -width / 2 + 0.05, height, th / 2);
    b.bx('frame', width / 2 - 0.05, 0, -th / 2, width / 2, height, th / 2);
    b.bx('frame', -width / 2, height - 0.05, -th / 2, width / 2, height, th / 2);
    b.bx('frame', -width / 2, 0, -th / 2, width / 2, 0.08, th / 2);
    b.bx('glass', -width / 2 + 0.05, 0.08, -0.006, width / 2 - 0.05, height - 0.05, 0.006);
  } else {
    b.rbox(d.style === 'wood' ? 'woodMid' : 'woodLight', 0, height / 2, 0, width, height, th, 0.008);
    b.bx('woodDark', -width / 2 + 0.05, 0.02, -th / 2 - 0.003, width / 2 - 0.05, 0.035, th / 2 + 0.003);
  }
  const hx = d.slide > 0 ? -width / 2 + 0.08 : width / 2 - 0.08;
  b.bx('black', hx - 0.012, 0.82, -th / 2 - 0.022, hx + 0.012, 1.12, th / 2 + 0.022);

  const group = new THREE.Group();
  const leaf = new THREE.Group();
  leaf.add(b.build({ cast: true, name: `door-${d.id}` }));
  group.add(leaf);
  const mid = (o.a + o.b) / 2;
  const off = d.side * (w.t / 2 + 0.026);
  if (w.axis === 'x') group.position.set(mid, 0, w.at + off);
  else {
    group.position.set(w.at + off, 0, mid);
    group.rotation.y = -Math.PI / 2; // local +X runs along world +Z
  }
  return {
    id: d.id,
    mesh: group,
    leaf,
    group: g,
    center: new THREE.Vector3(w.axis === 'x' ? mid : w.at, 0, w.axis === 'x' ? w.at : mid),
    travel: (o.b - o.a) * 0.96 * d.slide,
    height,
    private: d.private || null,
    defaultOpen: !d.closed,
    t: d.closed ? 0 : 1,
  };
}

function buildRoof(M, proxy) {
  const b = new Builder(M);
  const y0 = H, y1 = H + 0.28;
  const wings = [
    { x0: -9.55, x1: 9.55, z0: -7.55, z1: COURT.z0 + 0.32, top: 'roofMetal' },
    { x0: -9.55, x1: 9.55, z0: COURT.z1 - 0.32, z1: 7.55, top: 'roofMetal' },
    { x0: -9.55, x1: COURT.x0 + 0.32, z0: COURT.z0 + 0.32, z1: COURT.z1 - 0.32, top: 'sedum' },
    { x0: COURT.x1 - 0.32, x1: 9.55, z0: COURT.z0 + 0.32, z1: COURT.z1 - 0.32, top: 'sedum' },
  ];
  for (const wg of wings) {
    b.faces({ py: wg.top, ny: 'soffit', all: 'fascia' }, wg.x0, y0, wg.z0, wg.x1, y1, wg.z1);
    proxy.bx('shadowProxy', wg.x0, y0, wg.z0, wg.x1, y1, wg.z1);
  }
  const tilt = 0.14;
  const xs = [];
  for (let x = -8.4; x <= 8.5; x += 1.08) xs.push(x);
  const addRow = (z, list) => {
    for (const x of list) b.add('pv', new THREE.BoxGeometry(1.0, 0.04, 1.62), placeMatrix(x, y1 + 0.16, z, 0, tilt), 'keep');
  };
  addRow(-5.9, xs);
  addRow(-4.1, xs);
  addRow(4.75, xs.filter((x) => x > -3.6));
  const group = b.build({ cast: false, receive: true, name: 'roof' });
  return { group };
}

class House {
  constructor(root, cutGroups, doors, roof, footMat) {
    this.root = root;
    this.cutGroups = cutGroups;
    this.doors = doors;
    this.roof = roof;
    this.footMat = footMat;
    this.roofMode = 'auto'; // auto | on | off
    this.roofT = 0;
    this.roofMats = new Set();
    roof.group.traverse((o) => { if (o.isMesh) this.roofMats.add(o.material); });
    this._v = new THREE.Vector3();
  }

  // Cut away walls whose outer face looks toward the camera, unless the roof is on.
  updateCut(camera, target, dt) {
    const v = this._v.copy(camera.position).sub(target);
    v.y = 0;
    const len = v.length() || 1;
    const vx = v.x / len, vz = v.z / len;
    const dist = camera.position.distanceTo(target);
    const wantRoof = this.roofMode === 'on' ? 1 : this.roofMode === 'off' ? 0 : dist > (this.roofDistance || 46) ? 1 : 0;
    this.roofT = damp(this.roofT, wantRoof, 4, dt);
    if (Math.abs(this.roofT - wantRoof) < 0.002) this.roofT = wantRoof;
    const roofShown = this.roofT > 0.5;
    const facing = {
      'ext+z': vz > 0.2, 'ext-z': -vz > 0.2, 'ext+x': vx > 0.2, 'ext-x': -vx > 0.2,
      'int-x': Math.abs(vz) > 0.3, 'int-z': Math.abs(vx) > 0.3,
    };
    for (const [k, c] of Object.entries(this.cutGroups)) {
      c.target = roofShown ? 1 : facing[k] ? 0 : 1;
      c.h = damp(c.h, c.target, 9, dt);
      if (Math.abs(c.h - c.target) < 0.002) c.h = c.target;
      c.group.scale.y = Math.max(0.0001, c.h);
      c.group.visible = c.h > 0.01;
    }
    const t = smoothstep(0, 1, this.roofT);
    this.roof.group.visible = t > 0.01;
    this.roof.group.position.y = (1 - t) * 2.5;
    for (const m of this.roofMats) {
      m.opacity = t;
      m.depthWrite = t > 0.98;
    }
  }

  // Doors slide open when someone walks through. A private door stays shut while the human
  // is inside; only the human, on the way out, may open it (Claude knocks and waits).
  updateDoors(actors, humanRoom, dt) {
    const human = actors.find((a) => a.kind === 'human');
    const leavingTo = human && human.traveling && human.seg ? human.seg.spot.room : null;
    for (const d of this.doors) {
      const occupied = d.private && humanRoom === d.private;
      let want = occupied ? 0 : d.defaultOpen ? 1 : 0;
      for (const a of actors) {
        if (!a.traveling) continue;
        if (occupied && (a !== human || leavingTo === d.private)) continue;
        const dx = a.pos.x - d.center.x, dz = a.pos.z - d.center.z;
        if (dx * dx + dz * dz < 1.6 * 1.6) want = 1;
      }
      d.t = damp(d.t, want, 7, dt);
      d.leaf.position.x = d.travel * d.t;
      const h = this.cutGroups[d.group].h;
      d.leaf.scale.y = Math.min(d.height, CUT + (d.height - CUT) * h) / d.height;
    }
  }

  setFootLights(v) {
    this.footMat.emissiveIntensity = v;
  }
}
