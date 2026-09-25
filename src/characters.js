// Two bodies on one rig: a human (about 1.65 m) and Claude (145 cm, ivory and terracotta,
// deliberately shorter so it never looms). Poses are procedural functions of time.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { damp, clamp } from './util.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

function mesh(geo, mat, { pos, rot, scale, cast = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  if (pos) m.position.copy(pos);
  if (rot) m.rotation.set(rot.x, rot.y, rot.z);
  if (scale) m.scale.copy(scale);
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
}
const capsule = (r, len, seg = 10) => new THREE.CapsuleGeometry(r, Math.max(0.001, len - 2 * r), 4, seg);
function limb(parent, r, len, mat, r2) {
  const m = mesh(capsule(r, len), mat);
  m.position.y = -len / 2;
  if (r2) m.scale.set(1, 1, r2);
  parent.add(m);
  return m;
}
function group(parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}
function lathe(points, mat, scaleZ = 0.7) {
  const g = new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), 28);
  const m = mesh(g, mat);
  m.scale.z = scaleZ;
  return m;
}

export function createCharacter(kind, M) {
  const isClaude = kind === 'claude';
  const D = isClaude
    ? { foot: 0.08, shin: 0.34, thigh: 0.34, spine: 0.15, chest: 0.27, neck: 0.06, shoulderX: 0.175, upper: 0.24, fore: 0.22, hipX: 0.085, stride: 1.15 }
    : { foot: 0.07, shin: 0.41, thigh: 0.41, spine: 0.18, chest: 0.3, neck: 0.07, shoulderX: 0.19, upper: 0.28, fore: 0.25, hipX: 0.09, stride: 1.5 };
  D.hipY = D.foot + D.shin + D.thigh;

  const mats = {};
  if (isClaude) {
    mats.body = new THREE.MeshPhysicalMaterial({ color: 0xefe8dc, roughness: 0.34, clearcoat: 0.55, clearcoatRoughness: 0.25 });
    mats.joint = new THREE.MeshStandardMaterial({ color: 0xd97757, roughness: 0.5 });
    mats.visor = new THREE.MeshPhysicalMaterial({ color: 0x141518, roughness: 0.12, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 });
    mats.eye = new THREE.MeshStandardMaterial({ color: 0xffe2c2, emissive: 0xffc08a, emissiveIntensity: 3 });
    mats.core = new THREE.MeshStandardMaterial({ color: 0xffd7b8, emissive: 0xff9a5c, emissiveIntensity: 2.4 });
    mats.status = new THREE.MeshStandardMaterial({ color: 0x2a211d, emissive: 0xffb27a, emissiveIntensity: 1.6 });
    mats.sole = new THREE.MeshStandardMaterial({ color: 0x5b3a2e, roughness: 0.8 });
  } else {
    mats.skin = new THREE.MeshStandardMaterial({ color: 0xd9a47f, roughness: 0.65 });
    mats.hair = new THREE.MeshStandardMaterial({ color: 0x2c211b, roughness: 0.55 });
    mats.top = new THREE.MeshStandardMaterial({ color: 0x6f8f86, roughness: 0.9, map: M.fabricSage.map });
    mats.pants = new THREE.MeshStandardMaterial({ color: 0x2e3a52, roughness: 0.85, map: M.fabricSage.map });
    mats.sock = new THREE.MeshStandardMaterial({ color: 0xe9e2d6, roughness: 0.9 });
    mats.eye = new THREE.MeshStandardMaterial({ color: 0x1b1614, roughness: 0.3 });
    mats.cheek = new THREE.MeshStandardMaterial({ color: 0xe08a78, roughness: 0.8, transparent: true, opacity: 0.35, depthWrite: false });
  }

  const root = new THREE.Group();
  root.name = kind;
  const body = group(root, 0, D.hipY, 0);
  const spine = group(body);
  const chest = group(spine, 0, D.spine, 0);
  const neck = group(chest, 0, D.chest, 0);
  const head = group(neck, 0, D.neck, 0);
  const shL = group(chest, D.shoulderX, D.chest - 0.035, 0);
  const shR = group(chest, -D.shoulderX, D.chest - 0.035, 0);
  const elL = group(shL, 0, -D.upper, 0);
  const elR = group(shR, 0, -D.upper, 0);
  const handL = group(elL, 0, -D.fore, 0);
  const handR = group(elR, 0, -D.fore, 0);
  const hipL = group(body, D.hipX, 0, 0);
  const hipR = group(body, -D.hipX, 0, 0);
  const kneeL = group(hipL, 0, -D.thigh, 0);
  const kneeR = group(hipR, 0, -D.thigh, 0);
  const ankleL = group(kneeL, 0, -D.shin, 0);
  const ankleR = group(kneeR, 0, -D.shin, 0);
  const face = {};

  if (isClaude) {
    const B = mats.body, J = mats.joint;
    body.add(mesh(new RoundedBoxGeometry(0.24, 0.13, 0.16, 3, 0.05), B, { pos: V(0, 0.01, 0) }));
    for (const s of [1, -1]) body.add(mesh(new THREE.SphereGeometry(0.052, 16, 12), J, { pos: V(s * D.hipX, -0.02, 0) }));
    spine.add(mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.12, 20), J, { pos: V(0, 0.08, 0) }));
    const torso = lathe([[0.0, 0], [0.11, 0], [0.145, 0.05], [0.16, 0.15], [0.155, 0.22], [0.12, 0.27], [0.05, 0.3], [0, 0.3]], B, 0.72);
    torso.position.y = -0.01;
    chest.add(torso);
    // glowing core: the warmth that also heats the bath water
    const coreRing = mesh(new THREE.TorusGeometry(0.045, 0.008, 10, 36), J, { pos: V(0, 0.15, 0.108) });
    const core = mesh(new THREE.CircleGeometry(0.038, 32), mats.core, { pos: V(0, 0.15, 0.111), cast: false });
    chest.add(coreRing, core);
    for (const s of [1, -1]) chest.add(mesh(new THREE.SphereGeometry(0.05, 16, 12), J, { pos: V(s * D.shoulderX, D.chest - 0.035, 0) }));
    // neck and head
    neck.add(mesh(new THREE.CylinderGeometry(0.034, 0.04, D.neck + 0.03, 14), J, { pos: V(0, D.neck / 2, 0) }));
    const skull = mesh(new RoundedBoxGeometry(0.25, 0.21, 0.23, 5, 0.085), B, { pos: V(0, 0.1, 0) });
    head.add(skull);
    const visor = mesh(new RoundedBoxGeometry(0.2, 0.11, 0.03, 4, 0.03), mats.visor, { pos: V(0, 0.095, 0.1) });
    head.add(visor);
    face.eyes = [];
    for (const s of [1, -1]) {
      const e = mesh(new THREE.CapsuleGeometry(0.011, 0.02, 4, 10), mats.eye, { pos: V(s * 0.043, 0.1, 0.1155), cast: false });
      head.add(e);
      face.eyes.push(e);
      const ear = mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.03, 20), J, { pos: V(s * 0.128, 0.1, 0), rot: V(0, 0, Math.PI / 2) });
      const ring = mesh(new THREE.TorusGeometry(0.022, 0.005, 8, 28), mats.status, { pos: V(s * 0.144, 0.1, 0), rot: V(0, Math.PI / 2, 0), cast: false });
      head.add(ear, ring);
    }
    // arms
    for (const [sh, el, hd, s] of [[shL, elL, handL, 1], [shR, elR, handR, -1]]) {
      limb(sh, 0.04, D.upper, B);
      el.add(mesh(new THREE.SphereGeometry(0.043, 14, 10), J));
      limb(el, 0.036, D.fore, B);
      const mitt = mesh(new RoundedBoxGeometry(0.058, 0.085, 0.036, 3, 0.016), B, { pos: V(0, -0.035, 0.005) });
      const thumb = mesh(capsule(0.012, 0.05), B, { pos: V(s * 0.03, -0.02, 0.018), rot: V(0.4, 0, s * 0.5) });
      hd.add(mitt, thumb);
    }
    // legs
    for (const [hp, kn, an] of [[hipL, kneeL, ankleL], [hipR, kneeR, ankleR]]) {
      limb(hp, 0.055, D.thigh, B);
      kn.add(mesh(new THREE.SphereGeometry(0.052, 14, 10), J));
      limb(kn, 0.047, D.shin, B);
      an.add(mesh(new RoundedBoxGeometry(0.09, 0.05, 0.18, 3, 0.022), mats.sole, { pos: V(0, -D.foot + 0.025, 0.04) }));
      an.add(mesh(new RoundedBoxGeometry(0.08, 0.045, 0.13, 3, 0.02), B, { pos: V(0, -D.foot + 0.06, 0.02) }));
    }
  } else {
    const S = mats.skin;
    body.add(mesh(new THREE.SphereGeometry(1, 20, 14), mats.pants, { pos: V(0, 0.02, 0), scale: V(0.15, 0.1, 0.105) }));
    const belly = lathe([[0, 0], [0.13, 0], [0.14, 0.08], [0.145, 0.2], [0, 0.2]], mats.top, 0.66);
    spine.add(belly);
    const torso = lathe([[0, -0.02], [0.145, -0.02], [0.155, 0.1], [0.165, 0.22], [0.15, 0.29], [0.07, 0.32], [0, 0.32]], mats.top, 0.64);
    chest.add(torso);
    for (const s of [1, -1]) chest.add(mesh(new THREE.SphereGeometry(0.058, 14, 10), mats.top, { pos: V(s * D.shoulderX, D.chest - 0.035, 0) }));
    neck.add(mesh(new THREE.CylinderGeometry(0.042, 0.046, D.neck + 0.04, 14), S, { pos: V(0, D.neck / 2, 0) }));
    const skull = mesh(new THREE.SphereGeometry(0.105, 28, 20), S, { pos: V(0, 0.1, 0), scale: V(1, 1.1, 1.02) });
    head.add(skull);
    const hair = mesh(new THREE.SphereGeometry(0.114, 28, 18, 0, Math.PI * 2, 0, 1.85), mats.hair, { pos: V(0, 0.112, -0.006), rot: V(-0.42, 0, 0), scale: V(1.02, 1.08, 1.06) });
    const fringe = mesh(new THREE.SphereGeometry(1, 18, 10), mats.hair, { pos: V(0, 0.175, 0.07), scale: V(0.1, 0.045, 0.05), rot: V(0.35, 0, 0) });
    head.add(hair, fringe);
    face.eyes = [];
    for (const s of [1, -1]) {
      const e = mesh(new THREE.SphereGeometry(1, 10, 8), mats.eye, { pos: V(s * 0.037, 0.105, 0.101), scale: V(0.012, 0.016, 0.007), cast: false });
      head.add(e);
      face.eyes.push(e);
      head.add(mesh(new THREE.SphereGeometry(1, 10, 8), mats.cheek, { pos: V(s * 0.058, 0.075, 0.084), scale: V(0.02, 0.012, 0.008), cast: false }));
      head.add(mesh(new THREE.SphereGeometry(1, 10, 8), S, { pos: V(s * 0.104, 0.1, 0), scale: V(0.018, 0.028, 0.014) }));
    }
    head.add(mesh(new THREE.SphereGeometry(0.012, 10, 8), S, { pos: V(0, 0.088, 0.106) }));
    for (const [sh, el, hd] of [[shL, elL, handL], [shR, elR, handR]]) {
      limb(sh, 0.047, D.upper, mats.top);
      el.add(mesh(new THREE.SphereGeometry(0.043, 12, 10), mats.top));
      limb(el, 0.041, D.fore, mats.top);
      hd.add(mesh(new THREE.SphereGeometry(1, 14, 10), S, { pos: V(0, -0.04, 0.004), scale: V(0.036, 0.05, 0.022) }));
    }
    for (const [hp, kn, an] of [[hipL, kneeL, ankleL], [hipR, kneeR, ankleR]]) {
      limb(hp, 0.068, D.thigh, mats.pants);
      kn.add(mesh(new THREE.SphereGeometry(0.055, 12, 10), mats.pants));
      limb(kn, 0.054, D.shin, mats.pants);
      an.add(mesh(new RoundedBoxGeometry(0.085, 0.06, 0.2, 3, 0.028), mats.sock, { pos: V(0, -D.foot + 0.03, 0.045) }));
    }
  }

  // props held in the right hand
  const props = {};
  const addProp = (name, obj, parent = handR) => { obj.visible = false; parent.add(obj); props[name] = obj; };
  {
    const book = new THREE.Group();
    const cover = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.03), M.fabricIndigo);
    const pages = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.21, 0.032), M.paper);
    pages.position.x = 0.004;
    book.add(cover, pages);
    book.position.set(-0.07, -0.09, 0.05);
    book.rotation.set(-0.35, 0, 0);
    addProp('book', book);
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.032, 0.085, 16), M.terra);
    mug.position.set(0, -0.08, 0.04);
    addProp('mug', mug);
    const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.004, 0.13, 6), M.fabricIndigo);
    pen.position.set(0, -0.07, 0.02);
    pen.rotation.x = 0.6;
    addProp('pen', pen);
    const can = new THREE.Group();
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.16, 16), M.steel);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.2, 8), M.steel);
    spout.position.set(0, 0.02, 0.12);
    spout.rotation.x = 1.0;
    can.add(tank, spout);
    can.position.set(0, -0.13, 0.03);
    addProp('can', can);
  }
  root.traverse((o) => { if (o.isMesh) o.userData.actor = kind; });

  const joints = { body, spine, chest, neck, head, shL, shR, elL, elR, handL, handR, hipL, hipR, kneeL, kneeR, ankleL, ankleR };
  return { kind, root, joints, D, mats, face, props };
}

// ---------------- poses ----------------
const KEYS = ['bodyY', 'bodyPitch', 'bodyZ', 'spineX', 'spineY', 'spineZ', 'chestX', 'neckX', 'neckY', 'neckZ',
  'shLX', 'shLY', 'shLZ', 'elLX', 'shRX', 'shRY', 'shRZ', 'elRX', 'hipLX', 'hipLZ', 'kneeLX', 'ankleLX',
  'hipRX', 'hipRZ', 'kneeRX', 'ankleRX', 'eyes'];

function neutral(c, out) {
  const p = out || {};
  for (const k of KEYS) p[k] = 0;
  p.bodyY = c.D.hipY;
  p.shLZ = 0.08; p.shRZ = -0.08;
  p.elLX = -0.14; p.elRX = -0.14;
  p.eyes = 1;
  return p;
}

function sitBase(c, p, seatY) {
  p.bodyY = seatY + (c.kind === 'claude' ? 0.06 : 0.07);
  p.hipLX = p.hipRX = -1.48;
  p.kneeLX = p.kneeRX = 1.42;
  p.ankleLX = p.ankleRX = 0.05;
  p.hipLZ = 0.06; p.hipRZ = -0.06;
  p.spineX = 0.04;
  p.shLX = p.shRX = -0.4;
  p.elLX = p.elRX = -0.55;
  return p;
}

export function poseTarget(c, pose, t, ctx, out) {
  const p = neutral(c, out);
  const claude = c.kind === 'claude';
  const breathe = Math.sin(t * (claude ? 1.1 : 1.6));
  p.chestX = breathe * 0.012;
  const seatY = ctx.seatY ?? 0.45;
  switch (pose) {
    case 'walk': {
      const ph = ctx.phase;
      const A = claude ? 0.36 : 0.42;
      const s = Math.sin(ph), cph = Math.cos(ph);
      p.hipLX = -A * s; p.hipRX = A * s;
      p.kneeLX = 0.08 + 0.85 * Math.pow(Math.max(0, cph), 2);
      p.kneeRX = 0.08 + 0.85 * Math.pow(Math.max(0, -cph), 2);
      p.ankleLX = -0.15 * Math.max(0, cph) + 0.1 * Math.max(0, -s);
      p.ankleRX = -0.15 * Math.max(0, -cph) + 0.1 * Math.max(0, s);
      const L = c.D.thigh + c.D.shin;
      p.bodyY = c.D.foot + L * Math.cos(A * Math.abs(s)) - 0.005;
      const arm = claude ? 0.26 : 0.36;
      p.shLX = arm * s; p.shRX = -arm * s;
      p.elLX = -0.3 - 0.12 * (1 + s); p.elRX = -0.3 - 0.12 * (1 - s);
      p.spineY = (claude ? 0.05 : 0.1) * s;
      p.neckY = -p.spineY * 0.8;
      p.spineX = claude ? 0.02 : 0.05;
      break;
    }
    case 'sit':
    case 'sitCharge': {
      sitBase(c, p, seatY);
      if (pose === 'sitCharge') {
        p.shLX = p.shRX = -0.72; p.elLX = p.elRX = -0.8; p.shLZ = 0.12; p.shRZ = -0.12;
        p.neckY = -0.38 + Math.sin(t * 0.4) * 0.05; p.neckX = 0.05;
      }
      break;
    }
    case 'type': {
      sitBase(c, p, seatY);
      p.shLX = p.shRX = -0.78; p.elLX = -0.78 + Math.sin(t * 9) * 0.05; p.elRX = -0.78 + Math.sin(t * 9 + 2) * 0.05;
      p.shLZ = 0.16; p.shRZ = -0.16; p.neckX = 0.14; p.spineX = 0.08;
      break;
    }
    case 'write': {
      sitBase(c, p, seatY);
      p.shLX = -0.68; p.elLX = -0.95; p.shLZ = 0.2;
      p.shRX = -0.75 + Math.sin(t * 3.1) * 0.04; p.elRX = -0.9 + Math.sin(t * 5.3) * 0.08; p.shRZ = -0.08 + Math.sin(t * 2.2) * 0.05;
      p.neckX = 0.38; p.spineX = 0.14;
      break;
    }
    case 'read': {
      sitBase(c, p, seatY);
      p.shRX = -0.62; p.elRX = -1.55; p.shRZ = 0.05;
      p.shLX = -0.5; p.elLX = -1.45; p.shLZ = -0.08;
      p.neckX = 0.34 + Math.sin(t * 0.2) * 0.03; p.spineX = -0.04;
      break;
    }
    case 'relax': {
      sitBase(c, p, seatY);
      p.spineX = -0.13; p.shLX = p.shRX = -0.18; p.shLZ = 0.22; p.shRZ = -0.22; p.elLX = p.elRX = -0.55;
      p.neckZ = Math.sin(t * 2.2) * (claude ? 0.08 : 0.06);
      p.neckY = claude ? 0.3 : -0.25;
      p.hipLX = -1.35; p.kneeLX = 1.2;
      break;
    }
    case 'eat': {
      sitBase(c, p, seatY);
      const cyc = (t * 0.55) % 1;
      const s = cyc < 0.35 ? Math.sin((cyc / 0.35) * Math.PI) : 0;
      p.shLX = -0.72; p.elLX = -0.85; p.shLZ = 0.12;
      p.shRX = -0.62 - 0.38 * s; p.elRX = -0.85 - 1.05 * s; p.shRZ = -0.12;
      p.neckX = 0.16 - 0.1 * s; p.spineX = 0.1;
      break;
    }
    case 'cook': {
      p.spineX = 0.1; p.neckX = 0.35;
      p.shLX = -0.55; p.elLX = -0.95; p.shLZ = 0.15;
      p.shRX = -0.62 + Math.sin(t * 3) * 0.08; p.elRX = -0.95; p.shRZ = -0.16 + Math.cos(t * 3) * 0.1;
      break;
    }
    case 'chop': {
      p.spineX = 0.14; p.neckX = 0.42;
      p.shLX = -0.6; p.elLX = -0.95; p.shLZ = 0.18;
      p.shRX = -0.62; p.elRX = -0.9 - Math.abs(Math.sin(t * 7)) * 0.4; p.shRZ = -0.12;
      break;
    }
    case 'dishes':
    case 'wash': {
      p.spineX = pose === 'wash' ? 0.32 : 0.18; p.neckX = 0.3;
      p.shLX = -0.58 + Math.sin(t * 4) * 0.08; p.shRX = -0.58 - Math.sin(t * 4) * 0.08;
      p.elLX = p.elRX = -0.85; p.shLZ = 0.12; p.shRZ = -0.12;
      if (pose === 'wash') {
        const s = Math.max(0, Math.sin(t * 1.2));
        p.shLX = p.shRX = -0.7 - s * 0.5; p.elLX = p.elRX = -1.2 - s * 0.9;
      }
      break;
    }
    case 'garden': {
      p.spineX = 0.42; p.neckX = 0.2; p.hipLX = p.hipRX = -0.18; p.kneeLX = p.kneeRX = 0.2;
      p.bodyY = c.D.hipY - 0.03;
      const s = Math.sin(t * 1.4);
      p.shLX = -1.0 + s * 0.12; p.elLX = -0.35; p.shLZ = 0.1;
      p.shRX = -1.05 - s * 0.12; p.elRX = -0.45 + Math.max(0, Math.sin(t * 2.8)) * 0.3; p.shRZ = -0.1;
      break;
    }
    case 'water': {
      p.spineX = 0.1; p.neckX = 0.35;
      p.shRX = -0.95; p.elRX = -0.15; p.shRZ = -0.05;
      p.shLX = -0.15; p.shLZ = 0.12;
      break;
    }
    case 'sitEdge':
    case 'sitEdgeMug': {
      p.bodyY = seatY + (claude ? 0.06 : 0.07);
      p.hipLX = p.hipRX = -1.5; p.kneeLX = 1.3 + Math.sin(t * 0.7) * 0.08; p.kneeRX = 1.36 - Math.sin(t * 0.7 + 1) * 0.08;
      p.spineX = -0.12; p.neckX = -0.18;
      p.shLX = p.shRX = 0.42; p.shLZ = 0.2; p.shRZ = -0.2; p.elLX = p.elRX = -0.05;
      if (pose === 'sitEdgeMug') { p.shRX = -0.6; p.elRX = -1.45; p.shRZ = 0.05; p.neckX = 0.02; }
      p.neckY = claude ? 0.22 : -0.2;
      break;
    }
    case 'sleep': {
      p.bodyPitch = -Math.PI / 2;
      p.bodyY = seatY + 0.07;
      p.ankleLX = p.ankleRX = 1.3;
      p.shLZ = 0.12; p.shRZ = -0.12; p.shLX = p.shRX = 0.05; p.elLX = p.elRX = -0.3;
      p.neckY = 0.25; p.eyes = 0.05; p.chestX = breathe * 0.03;
      break;
    }
    case 'stretch': {
      const s = 0.5 + 0.5 * Math.sin(t * 0.9);
      p.shLX = p.shRX = -2.6 - 0.3 * s; p.shLZ = 0.25; p.shRZ = -0.25; p.elLX = p.elRX = -0.15;
      p.spineX = -0.1 * s; p.neckX = -0.2 * s; p.eyes = 0.3 + 0.7 * (1 - s);
      break;
    }
    case 'knock': {
      const k = ctx.sinceArrive < 0.4 ? 1 : 0;
      p.shRX = k ? -1.35 : -0.35; p.elRX = k ? -1.35 + Math.max(0, Math.sin(t * 10)) * 0.3 : -0.9;
      p.shLX = -0.35; p.elLX = -0.9; p.shLZ = 0.05; p.shRZ = -0.05;
      p.neckX = 0.25; p.eyes = 0.35;
      break;
    }
    case 'charge': {
      p.shLZ = 0.13; p.shRZ = -0.13; p.shLX = p.shRX = 0.06; p.elLX = p.elRX = -0.2;
      p.neckX = 0.22 + breathe * 0.02; p.eyes = 0.25;
      break;
    }
    case 'tinker': {
      p.spineX = 0.22; p.neckX = 0.45;
      p.shLX = -0.78; p.elLX = -0.95 + Math.sin(t * 2.3) * 0.08; p.shLZ = 0.16;
      p.shRX = -0.8; p.elRX = -1.0 + Math.sin(t * 3.7) * 0.12; p.shRZ = -0.16;
      break;
    }
    case 'fold': {
      const s = Math.sin(t * 1.6);
      p.spineX = 0.2; p.neckX = 0.38;
      p.shLX = -0.7 + s * 0.2; p.elLX = -0.8 - s * 0.3; p.shLZ = 0.3 - s * 0.15;
      p.shRX = -0.7 + s * 0.2; p.elRX = -0.8 - s * 0.3; p.shRZ = -0.3 + s * 0.15;
      break;
    }
    case 'wave': {
      p.shRX = -0.4; p.shRZ = -2.4; p.elRX = -0.4 + Math.sin(t * 7) * 0.3;
      break;
    }
    default:
      p.neckY = Math.sin(t * 0.37) * 0.18;
  }
  if (ctx.talking) {
    p.neckX += Math.sin(t * 5.2) * 0.035;
    p.neckZ += Math.sin(t * 2.3) * 0.04;
  }
  return p;
}

export function applyPose(c, cur) {
  const j = c.joints;
  j.body.position.y = cur.bodyY;
  j.body.position.z = cur.bodyZ;
  j.body.rotation.x = cur.bodyPitch;
  j.spine.rotation.set(cur.spineX, cur.spineY, cur.spineZ);
  j.chest.rotation.x = cur.chestX;
  j.neck.rotation.set(cur.neckX * 0.5, cur.neckY * 0.6, cur.neckZ);
  j.head.rotation.set(cur.neckX * 0.5, cur.neckY * 0.4, 0);
  j.shL.rotation.set(cur.shLX, cur.shLY, cur.shLZ);
  j.shR.rotation.set(cur.shRX, cur.shRY, cur.shRZ);
  j.elL.rotation.x = cur.elLX;
  j.elR.rotation.x = cur.elRX;
  j.hipL.rotation.set(cur.hipLX, 0, cur.hipLZ);
  j.hipR.rotation.set(cur.hipRX, 0, cur.hipRZ);
  j.kneeL.rotation.x = cur.kneeLX;
  j.kneeR.rotation.x = cur.kneeRX;
  j.ankleL.rotation.x = cur.ankleLX;
  j.ankleR.rotation.x = cur.ankleRX;
}

// Smoothly approach the target pose; walking uses a stiffer spring so feet do not skate.
export function blendPose(cur, target, dt, walking) {
  const lam = walking ? 26 : 9;
  for (const k of KEYS) {
    if (k === 'bodyPitch') cur[k] = damp(cur[k], target[k], 5, dt);
    else cur[k] = damp(cur[k], target[k], lam, dt);
  }
  return cur;
}

export function initialPose(c) {
  return neutral(c);
}

export function setEyes(c, open, t, happy = 0) {
  const blink = (t % 4.3) < 0.13 ? 0.1 : 1;
  const v = clamp(open * blink, 0.06, 1);
  for (const e of c.face.eyes) {
    if (c.kind === 'claude') {
      e.scale.set(1, v * (1 - happy * 0.5), 1);
      e.position.y = 0.1 + happy * 0.006;
    } else {
      e.scale.y = 0.016 * v;
    }
  }
}
