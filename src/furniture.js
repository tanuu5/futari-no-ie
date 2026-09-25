// Furniture and fittings, room by room (world coordinates, see plan.js).
// Static pieces merge into a few meshes; lamps, rugs, art and animated bits stay separate.
// Wall-mounted pieces go into per-wall "decor" groups so they hide with their cut-away wall.
import * as THREE from 'three';
import { Builder, placeMatrix } from './builder.js';
import { CUT } from './plan.js';
import { mulberry32 } from './util.js';

const BOOK_COLORS = ['#8b3a2e', '#2f4b6e', '#d9c7a0', '#4d6b4a', '#a8763e', '#6d5a7a', '#c9b89a', '#3b3b3b',
  '#b85c38', '#e8e0d0', '#5a7d8c', '#7a3b4b', '#c2a25a', '#29384a'].map((c) => new THREE.Color(c));

const DECOR_KEYS = ['ext+z', 'ext-z', 'ext+x', 'ext-x', 'int-x', 'int-z'];

export function buildFurniture(M, T) {
  const b = new Builder(M);
  const decor = Object.fromEntries(DECOR_KEYS.map((k) => [k, new Builder(M)]));
  const decorExtras = Object.fromEntries(DECOR_KEYS.map((k) => [k, new THREE.Group()]));
  const books = [];
  const lamps = [];
  const extras = new THREE.Group();
  extras.name = 'furniture-extras';
  const H = {}; // handles for animated / controllable parts

  // ---------- helpers ----------
  const chair = (bb, x, z, ry, { wood = 'woodLight', seat = 'fabricOat', h = 0.45, arms = false } = {}) => {
    bb.at(x, 0, z, ry, (c) => {
      c.rbox(seat, 0, h - 0.03, 0, 0.46, 0.06, 0.44, 0.025);
      for (const [lx, lz] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]]) c.cyl(wood, lx, (h - 0.06) / 2, lz, 0.018, 0.015, h - 0.06, 8);
      c.cyl(wood, -0.19, h + 0.2, -0.2, 0.015, 0.018, 0.42, 8);
      c.cyl(wood, 0.19, h + 0.2, -0.2, 0.015, 0.018, 0.42, 8);
      c.rbox(wood, 0, h + 0.33, -0.2, 0.44, 0.13, 0.03, 0.012);
      if (arms) { c.rbox(wood, -0.23, h + 0.17, -0.02, 0.04, 0.03, 0.4, 0.01); c.rbox(wood, 0.23, h + 0.17, -0.02, 0.04, 0.03, 0.4, 0.01); }
    });
  };
  const armchair = (bb, x, z, ry, fabric = 'fabricSage') => {
    bb.at(x, 0, z, ry, (c) => {
      c.rbox('woodMid', 0, 0.06, 0, 0.74, 0.1, 0.72, 0.02);
      c.rbox(fabric, 0, 0.27, 0.02, 0.76, 0.32, 0.76, 0.07);
      c.rbox(fabric, 0, 0.39, 0.06, 0.52, 0.12, 0.56, 0.05);
      c.rbox(fabric, 0, 0.66, -0.3, 0.74, 0.62, 0.18, 0.08);
      c.rbox(fabric, -0.34, 0.5, 0.0, 0.14, 0.34, 0.72, 0.06);
      c.rbox(fabric, 0.34, 0.5, 0.0, 0.14, 0.34, 0.72, 0.06);
    });
  };
  const table = (bb, cx, cz, w, d, h, { top = 'woodLight', leg = 'woodMid', ry = 0, inset = 0.08 } = {}) => {
    bb.at(cx, 0, cz, ry, (c) => {
      c.rbox(top, 0, h - 0.02, 0, w, 0.04, d, 0.012);
      const lx = w / 2 - inset, lz = d / 2 - inset;
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) c.rbox(leg, sx * lx, (h - 0.04) / 2, sz * lz, 0.05, h - 0.04, 0.05, 0.012);
    });
  };
  const sofa = (bb, cx, cz, w, ry, fabric = 'fabricOat') => {
    bb.at(cx, 0, cz, ry, (c) => {
      const d = 1.0;
      c.rbox('woodDark', 0, 0.05, 0, w - 0.12, 0.08, d - 0.12, 0.02);
      c.rbox(fabric, 0, 0.2, 0.0, w, 0.22, d, 0.06);
      const n = 2, cw = (w - 0.36) / n;
      for (let i = 0; i < n; i++) {
        const x = -w / 2 + 0.18 + cw * (i + 0.5);
        c.rbox(fabric, x, 0.37, 0.08, cw - 0.02, 0.14, d - 0.3, 0.06);
        c.rbox(fabric, x, 0.63, -d / 2 + 0.17, cw - 0.03, 0.44, 0.22, 0.09);
      }
      c.rbox(fabric, -w / 2 + 0.09, 0.42, 0.0, 0.18, 0.5, d, 0.07);
      c.rbox(fabric, w / 2 - 0.09, 0.42, 0.0, 0.18, 0.5, d, 0.07);
    });
  };
  // Shelf running along local X, open toward local +Z.
  const shelf = (bb, cx, cz, ry, w, h, d, rows, { key = 'woodLight', fill = 0.82, seed = 1, back = true, objects = true } = {}) => {
    const r = mulberry32(seed);
    bb.at(cx, 0, cz, ry, (c) => {
      const th = 0.025;
      c.bx(key, -w / 2, 0, -d / 2, -w / 2 + th, h, d / 2);
      c.bx(key, w / 2 - th, 0, -d / 2, w / 2, h, d / 2);
      c.bx(key, -w / 2, 0, -d / 2, w / 2, 0.06, d / 2);
      const step = (h - 0.06 - th) / rows;
      for (let i = 0; i <= rows; i++) {
        const y = 0.06 + i * step;
        c.bx(key, -w / 2 + th, y, -d / 2, w / 2 - th, y + th, d / 2);
      }
      if (back) c.bx(key, -w / 2, 0.06, -d / 2, w / 2, h, -d / 2 + 0.012);
      for (let i = 0; i < rows; i++) {
        const y = 0.06 + i * step + th;
        const rowH = step - th;
        let x = -w / 2 + th + 0.01;
        while (x < w / 2 - th - 0.05) {
          const roll = r();
          if (roll > fill) {
            if (objects && roll > fill + (1 - fill) * 0.5 && x < w / 2 - 0.2) {
              const kind = r();
              if (kind < 0.4) c.cyl(r() < 0.5 ? 'ceramic' : 'potTerra', x + 0.06, y + 0.07, 0, 0.045, 0.04, 0.14, 12);
              else if (kind < 0.7) c.ell('stoneDark', x + 0.06, y + 0.03, 0.0, 0.05, 0.03, 0.04, r() * 3);
              else { c.cyl('potGray', x + 0.06, y + 0.05, 0, 0.05, 0.04, 0.1, 10); c.ell('leafGreen', x + 0.06, y + 0.14, 0, 0.07, 0.06, 0.07, 0, 0, 0, 8); }
              x += 0.14;
            } else x += 0.05 + r() * 0.1;
            continue;
          }
          const bw = 0.018 + r() * 0.034;
          const bh = Math.min(rowH - 0.02, 0.15 + r() * 0.15);
          const bd = Math.min(d - 0.04, 0.13 + r() * 0.08);
          const lean = r() < 0.05 ? 0.22 : 0;
          const m = c.matrix.clone().multiply(placeMatrix(x + bw / 2 + (lean ? 0.03 : 0), y, d / 2 - bd / 2 - 0.012, 0, 0, -lean, bw, bh, bd));
          books.push({ m, c: BOOK_COLORS[(r() * BOOK_COLORS.length) | 0] });
          x += bw + 0.002 + (lean ? 0.06 : 0);
        }
      }
    });
  };
  const leafRosette = (bb, y0, s, n, r, spread, big, seed, keyA = 'leafGreen', keyB = 'leafDark') => {
    const rr = mulberry32(seed);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rr() * 0.6;
      const rad = (r * (0.4 + rr() * 0.6)) * s;
      const y = y0 + (0.12 + rr() * spread) * s;
      const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
      bb.rod('leafDark', 0, y0, 0, x, y, z, 0.006 * s, 5);
      bb.ell(i % 3 ? keyA : keyB, x + Math.cos(a) * 0.06 * s * big, y + 0.01, z + Math.sin(a) * 0.06 * s * big,
        0.06 * s * big, 0.012 * s, 0.12 * s * big, Math.atan2(Math.cos(a), Math.sin(a)), 0.35 + rr() * 0.5, 0, 10);
    }
  };
  const plant = (bb, x, z, s = 1, { pot = 'potTerra', seed = 1, big = 1, n = 8, spread = 0.45, y = 0 } = {}) => {
    bb.at(x, y, z, 0, (c) => {
      c.cyl(pot, 0, 0.15 * s, 0, 0.15 * s, 0.11 * s, 0.3 * s, 18);
      c.cyl('soil', 0, 0.295 * s, 0, 0.135 * s, 0.135 * s, 0.01, 14);
      leafRosette(c, 0.3 * s, s, n, 0.28, spread, big, seed);
    });
  };
  const tallPlant = (bb, x, z, s = 1, seed = 3) => {
    const rr = mulberry32(seed);
    bb.at(x, 0, z, 0, (c) => {
      c.cyl('potGray', 0, 0.2 * s, 0, 0.19 * s, 0.15 * s, 0.4 * s, 18);
      c.cyl('soil', 0, 0.395 * s, 0, 0.17 * s, 0.17 * s, 0.01, 14);
      c.rod('bark', 0, 0.4 * s, 0, 0.03 * s, 1.5 * s, 0.02 * s, 0.018 * s, 6);
      for (let i = 0; i < 16; i++) {
        const y = (0.8 + rr() * 0.85) * s, a = rr() * Math.PI * 2, rad = (0.05 + rr() * 0.2) * s;
        c.ell(i % 2 ? 'leafGreen' : 'leafDark', Math.cos(a) * rad, y, Math.sin(a) * rad, 0.09 * s, 0.012 * s, 0.13 * s,
          Math.atan2(Math.cos(a), Math.sin(a)), 0.2 + rr() * 0.5, 0, 10);
      }
    });
  };
  const shadeMat = (color = 0xf3ead9) => new THREE.MeshStandardMaterial({
    color, roughness: 0.9, emissive: 0xffc98f, emissiveIntensity: 0, side: THREE.DoubleSide,
  });
  const addLamp = (id, pos, { color = 0xffc58a, power = 9, distance = 7, shade, bulbAt, glow = 1 } = {}) => {
    const mats = [];
    if (shade) {
      const m = shadeMat(shade.color);
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(shade.rt, shade.rb, shade.h, 28, 1, true), m);
      mesh.position.set(...shade.at);
      mesh.userData.noAO = true;
      extras.add(mesh);
      mats.push(m);
    }
    const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff4e0, emissive: 0xffd6a0, emissiveIntensity: 0 });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), bulbMat);
    bulb.position.set(...(bulbAt || pos));
    bulb.userData.noAO = true;
    extras.add(bulb);
    lamps.push({ id, pos: new THREE.Vector3(...pos), color, power, distance, mats, bulbMat, glow });
  };
  const rug = (tex, x, z, w, d, ry = 0) => {
    const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 1 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m);
    mesh.rotation.set(-Math.PI / 2, 0, ry);
    mesh.position.set(x, 0.006, z);
    mesh.receiveShadow = true;
    extras.add(mesh);
  };
  // Picture on a wall; ry turns the plane's +Z normal to face into the room.
  const art = (gk, tex, x, y, z, w, h, ry) => {
    const grp = new THREE.Group();
    grp.position.set(x, y - CUT, z);
    grp.rotation.y = ry;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, h + 0.06, 0.03), M.woodDark);
    frame.position.z = 0.015;
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
    pic.position.z = 0.032;
    frame.receiveShadow = pic.receiveShadow = true;
    grp.add(frame, pic);
    decorExtras[gk].add(grp);
  };
  const D = (gk) => decor[gk].push(0, -CUT, 0); // builder offset for decor groups (pop after use)

  // ========== KITCHEN ==========
  b.rbox('lacquer', -8.5, 0.925, -6.56, 0.68, 1.85, 0.64, 0.02); // fridge
  b.bx('steel', -8.2, 0.95, -6.235, -8.185, 1.55, -6.22);
  b.bx('black', -8.1, 0, -6.85, -4.4, 0.08, -6.34);
  b.bx('lacquer', -8.1, 0.08, -6.9, -4.4, 0.86, -6.28);
  for (let i = 1; i < 7; i++) b.bx('black', -8.1 + i * 0.6 - 0.003, 0.1, -6.281, -8.1 + i * 0.6 + 0.003, 0.84, -6.275);
  for (let i = 0; i < 6; i++) b.bx('woodLight', -8.1 + i * 0.6 + 0.15, 0.79, -6.278, -8.1 + i * 0.6 + 0.45, 0.81, -6.262);
  b.bx('counter', -8.12, 0.86, -6.92, -4.38, 0.9, -6.24);
  b.bx('steel', -7.92, 0.8, -6.8, -7.2, 0.903, -6.4);
  b.bx('black', -7.88, 0.82, -6.76, -7.24, 0.905, -6.44);
  b.rod('steel', -7.56, 0.9, -6.84, -7.56, 1.22, -6.84, 0.015, 8);
  b.rod('steel', -7.56, 1.22, -6.84, -7.56, 1.2, -6.62, 0.012, 8);
  b.bx('cooktop', -5.82, 0.9, -6.82, -4.98, 0.912, -6.34);
  H.burnerMat = new THREE.MeshStandardMaterial({ color: 0x2a1410, emissive: 0xff4a1c, emissiveIntensity: 0 });
  for (const [x, z, r] of [[-5.6, -6.68, 0.1], [-5.2, -6.68, 0.08], [-5.4, -6.47, 0.07]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.006, 6, 32), H.burnerMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, 0.914, z);
    extras.add(ring);
  }
  b.cyl('steel', -5.6, 0.995, -6.68, 0.13, 0.12, 0.16, 20);
  b.cyl('steel', -5.6, 1.078, -6.68, 0.135, 0.135, 0.01, 20);
  b.sphere('black', -5.6, 1.095, -6.68, 0.016, 8);
  b.cyl('ceramic', -4.72, 0.95, -6.6, 0.07, 0.06, 0.1, 14); // utensil jar
  for (let i = 0; i < 4; i++) b.rod('woodDark', -4.72 + (i - 1.5) * 0.02, 0.95, -6.6, -4.72 + (i - 1.5) * 0.04, 1.2, -6.6 + (i % 2 ? 0.02 : -0.02), 0.006, 5);
  H.steamPot = new THREE.Vector3(-5.6, 1.12, -6.68);
  D('ext-z');
  decor['ext-z'].bx('subway', -6.05, 0.9, -6.905, -4.4, 1.62, -6.892);
  decor['ext-z'].rbox('steel', -5.4, 1.9, -6.64, 0.86, 0.1, 0.5, 0.01);
  decor['ext-z'].bx('steel', -5.62, 1.95, -6.9, -5.18, 2.7, -6.68);
  decor['ext-z'].bx('woodLight', -4.9, 1.55, -6.9, -4.4, 1.58, -6.66); // spice shelf
  for (let i = 0; i < 5; i++) decor['ext-z'].cyl(i % 2 ? 'ceramic' : 'potTerra', -4.85 + i * 0.1, 1.63, -6.78, 0.035, 0.035, 0.1, 10);
  decor['ext-z'].pop();

  // island with a cutting board
  b.rbox('woodLight', -6.5, 0.44, -4.96, 2.0, 0.88, 0.7, 0.02);
  b.bx('black', -7.45, 0, -5.26, -5.55, 0.07, -4.66);
  b.rbox('counter', -6.5, 0.9, -4.96, 2.06, 0.04, 0.76, 0.01);
  b.rbox('woodLight', -6.55, 0.93, -4.85, 0.45, 0.025, 0.3, 0.01);
  b.sphere('tomato', -6.7, 0.965, -4.9, 0.035, 12);
  b.sphere('tomato', -6.62, 0.962, -4.8, 0.032, 12);
  b.ell('leafGreen', -6.42, 0.955, -4.86, 0.06, 0.02, 0.04, 0.4);
  b.bx('steel', -6.45, 0.943, -4.78, -6.25, 0.947, -4.755);
  b.cyl('fabricOat', -7.25, 0.99, -5.1, 0.12, 0.1, 0.14, 16); // bread basket
  b.ell('woodLight', -7.25, 1.07, -5.1, 0.09, 0.035, 0.06, 0.3);
  for (const x of [-7.0, -6.0]) {
    b.rod('black', x, 2.7, -4.96, x, 2.05, -4.96, 0.004, 4);
  }
  addLamp('island', [-6.5, 2.0, -4.96], { power: 4.2, distance: 6, shade: { rt: 0.05, rb: 0.13, h: 0.16, at: [-7.0, 1.97, -4.96] }, bulbAt: [-7.0, 1.92, -4.96] });
  { // second pendant shade shares the island lamp
    const m = shadeMat();
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.13, 0.16, 28, 1, true), m);
    mesh.position.set(-6.0, 1.97, -4.96);
    extras.add(mesh);
    lamps[lamps.length - 1].mats.push(m);
  }

  // ========== DINING ==========
  table(b, -2.6, -4.6, 1.8, 0.9, 0.74);
  chair(b, -3.1, -5.36, 0);
  chair(b, -2.1, -5.36, 0);
  chair(b, -3.1, -3.84, Math.PI);
  chair(b, -2.1, -3.84, Math.PI);
  chair(b, -1.33, -4.6, -Math.PI / 2, { seat: 'fabricTerra' });
  b.cyl('ceramic', -3.1, 0.746, -4.84, 0.13, 0.12, 0.012, 24); // plate
  b.rbox('fabricCream', -3.1, 0.741, -4.84, 0.4, 0.004, 0.3, 0.002);
  b.cyl('ceramic', -2.62, 0.8, -4.6, 0.045, 0.035, 0.12, 14); // vase
  for (let i = 0; i < 5; i++) {
    const a = i * 1.3;
    b.rod('leafDark', -2.62, 0.85, -4.6, -2.62 + Math.cos(a) * 0.06, 1.02, -4.6 + Math.sin(a) * 0.06, 0.003, 4);
    b.sphere(i % 2 ? 'fabricMustard' : 'fabricCream', -2.62 + Math.cos(a) * 0.06, 1.03, -4.6 + Math.sin(a) * 0.06, 0.02, 8);
  }
  // Claude's place: an induction charging pad set into the tabletop
  H.padMat = new THREE.MeshStandardMaterial({ color: 0x3a2a24, emissive: 0xff8a52, emissiveIntensity: 0.05, roughness: 0.4 });
  {
    const pad = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.13, 40), H.padMat);
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(-1.83, 0.7415, -4.6);
    extras.add(pad);
    b.cyl('terra', -1.83, 0.741, -4.6, 0.1, 0.1, 0.002, 32);
  }
  b.rbox('woodMid', -2.8, 0.38, -6.68, 2.8, 0.76, 0.42, 0.015); // sideboard
  for (let i = 0; i < 4; i++) b.bx('black', -4.2 + 0.7 * (i + 1) - 0.003, 0.08, -6.469, -4.2 + 0.7 * (i + 1) + 0.003, 0.72, -6.465);
  plant(b, -3.9, -6.66, 0.7, { pot: 'ceramic', seed: 5, y: 0.76 });
  b.rbox('woodDark', -1.8, 0.83, -6.7, 0.3, 0.12, 0.18, 0.02); // radio
  b.cyl('brass', -1.72, 0.84, -6.605, 0.03, 0.03, 0.01, 14, Math.PI / 2);
  b.rod('black', -2.6, 2.7, -4.6, -2.6, 1.95, -4.6, 0.004, 4);
  addLamp('dining', [-2.6, 1.78, -4.6], { power: 8, distance: 6, shade: { rt: 0.07, rb: 0.3, h: 0.2, at: [-2.6, 1.86, -4.6], color: 0xe9e2d4 }, bulbAt: [-2.6, 1.8, -4.6] });

  // ========== LIVING ==========
  rug(T.rugKilim, 1.2, -5.1, 2.8, 1.95);
  sofa(b, 1.2, -6.17, 2.9, 0);
  b.rbox('fabricIndigo', -0.02, 0.62, -6.35, 0.36, 0.34, 0.14, 0.06, 0.2);
  b.rbox('fabricMustard', 2.42, 0.62, -6.35, 0.36, 0.34, 0.14, 0.06, -0.2);
  b.rbox('fabricMustard', 2.55, 0.55, -5.95, 0.2, 0.2, 0.7, 0.04); // throw over the arm
  b.rbox('woodLight', 1.25, 0.34, -4.57, 1.4, 0.05, 0.56, 0.02); // coffee table
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.cyl('woodMid', 1.25 + sx * 0.6, 0.16, -4.57 + sz * 0.2, 0.02, 0.018, 0.32, 8);
  b.rbox('woodDark', 1.0, 0.375, -4.6, 0.38, 0.02, 0.26, 0.01); // tray
  b.cyl('ceramic', 0.95, 0.42, -4.62, 0.035, 0.03, 0.08, 12);
  b.rbox('fabricIndigo', 1.42, 0.38, -4.5, 0.22, 0.03, 0.16, 0.004);
  plant(b, 1.75, -4.6, 0.45, { pot: 'ceramic', seed: 9, n: 6, y: 0.365 });
  // record cabinet + turntable
  b.rbox('woodMid', 3.35, 0.3, -6.66, 1.0, 0.6, 0.44, 0.015);
  for (let i = 0; i < 12; i++) b.bx(i % 3 ? 'paper' : 'fabricIndigo', 2.95 + i * 0.022, 0.06, -6.84, 2.967 + i * 0.022, 0.4, -6.5); // records inside
  b.rbox('woodDark', 3.3, 0.635, -6.66, 0.44, 0.07, 0.36, 0.01);
  H.platter = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.012, 32), M.black);
  H.platter.position.set(3.26, 0.676, -6.66);
  {
    const label = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.013, 16), M.red);
    H.platter.add(label);
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.014, 0.01), M.fabricCream);
    mark.position.x = 0.07;
    H.platter.add(mark);
  }
  extras.add(H.platter);
  b.rod('steel', 3.47, 0.69, -6.54, 3.35, 0.69, -6.7, 0.005, 5);
  b.rbox('woodDark', 3.72, 0.8, -6.7, 0.2, 0.34, 0.2, 0.02); // speaker
  b.cyl('black', 3.72, 0.8, -6.599, 0.06, 0.06, 0.01, 16, Math.PI / 2);
  tallPlant(b, 3.6, -5.55, 1.05, 7);
  // floor lamp west of the sofa
  b.cyl('black', -0.62, 0.015, -6.45, 0.15, 0.17, 0.03, 20);
  b.rod('brass', -0.62, 0.03, -6.45, -0.62, 1.42, -6.45, 0.012, 8);
  addLamp('living', [-0.62, 1.42, -6.45], { power: 8, distance: 6.5, shade: { rt: 0.16, rb: 0.22, h: 0.3, at: [-0.62, 1.5, -6.45] } });

  // ========== GALLERY (book corridor) ==========
  shelf(b, 4.22, -5.65, Math.PI / 2, 2.5, 2.1, 0.34, 6, { seed: 11 });
  D('int-z');
  art('int-z', T.paintings[0], 5.135, 1.55, -1.25, 0.5, 0.62, -Math.PI / 2);
  art('int-z', T.paintings[2], 5.135, 1.55, -5.3, 0.44, 0.55, -Math.PI / 2);
  art('int-z', T.paintings[1], -5.135, 1.55, 1.3, 0.46, 0.58, Math.PI / 2);
  // door status lamps (sensor-free rooms): lit amber while occupied
  H.doorLampBed = new THREE.MeshStandardMaterial({ color: 0x223, emissive: 0x9ad28a, emissiveIntensity: 0.8 });
  H.doorLampBath = new THREE.MeshStandardMaterial({ color: 0x223, emissive: 0x9ad28a, emissiveIntensity: 0.8 });
  for (const [mat, z] of [[H.doorLampBed, -2.3], [H.doorLampBath, -0.6]]) {
    decor['int-z'].rbox('woodDark', 5.125, 1.45, z, 0.02, 0.16, 0.1, 0.008);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.1, 0.05), mat);
    lamp.position.set(5.112, 1.45 - CUT, z);
    lamp.userData.noAO = true;
    decorExtras['int-z'].add(lamp);
  }
  decor['int-z'].pop();

  // ========== BEDROOM ==========
  b.at(7.1, 0, -5.85, 0, (c) => {
    c.rbox('woodLight', 0, 0.17, 0, 1.66, 0.26, 2.12, 0.02);
    c.rbox('fabricCream', 0, 0.41, 0.02, 1.56, 0.22, 2.0, 0.06);
    c.rbox('woodLight', 0, 0.55, -1.03, 1.72, 0.9, 0.07, 0.02);
    c.rbox('fabricCream', -0.38, 0.6, -0.78, 0.62, 0.15, 0.4, 0.07);
    c.rbox('fabricCream', 0.38, 0.6, -0.78, 0.62, 0.15, 0.4, 0.07);
    c.rbox('fabricIndigo', 0, 0.54, 0.82, 1.6, 0.05, 0.4, 0.02);
  });
  H.duvetFlat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.07, 1.35), M.fabricCream);
  H.duvetFlat.position.set(7.1, 0.56, -5.55);
  {
    // the quilt puffs up over a sleeper: a sphere with a flattened underside
    const rg = new THREE.SphereGeometry(1, 24, 12);
    const rp = rg.attributes.position;
    for (let i = 0; i < rp.count; i++) if (rp.getY(i) < 0) rp.setY(i, rp.getY(i) * 0.15);
    rg.computeVertexNormals();
    // pole vertices that no triangle uses keep a zero normal; give them a valid one anyway
    const rn = rg.attributes.normal;
    for (let i = 0; i < rn.count; i++) if (Math.hypot(rn.getX(i), rn.getY(i), rn.getZ(i)) < 1e-4) rn.setXYZ(i, 0, 1, 0);
    H.duvetSleep = new THREE.Mesh(rg, M.fabricCream);
    H.duvetSleep.scale.set(0.8, 0.29, 0.76);
    H.duvetSleep.position.set(7.1, 0.52, -5.5);
  }
  for (const m of [H.duvetFlat, H.duvetSleep]) { m.castShadow = true; m.receiveShadow = true; extras.add(m); }
  H.duvetSleep.visible = false;
  // nightstands
  b.rbox('woodMid', 5.95, 0.26, -6.68, 0.46, 0.52, 0.4, 0.015);
  b.rbox('woodMid', 8.25, 0.26, -6.68, 0.46, 0.52, 0.4, 0.015);
  b.rbox('woodDark', 8.18, 0.56, -6.7, 0.14, 0.08, 0.07, 0.01); // clock
  b.bx('paper', 8.3, 0.52, -6.64, 8.46, 0.55, -6.52);
  b.cyl('ceramic', 5.95, 0.54, -6.7, 0.05, 0.07, 0.04, 16);
  b.rod('brass', 5.95, 0.56, -6.7, 5.95, 0.78, -6.7, 0.006, 6);
  addLamp('bed', [5.95, 0.84, -6.7], { power: 4.5, distance: 5, shade: { rt: 0.08, rb: 0.12, h: 0.14, at: [5.95, 0.86, -6.7] } });
  // wardrobe
  b.rbox('woodLight', 5.49, 1.05, -4.45, 0.45, 2.1, 1.5, 0.015);
  b.bx('woodDark', 5.716, 0.1, -4.453, 5.721, 2.0, -4.447);
  b.bx('brass', 5.717, 1.0, -4.6, 5.725, 1.3, -4.58);
  b.bx('brass', 5.717, 1.0, -4.32, 5.725, 1.3, -4.3);
  // reading corner
  armchair(b, 8.25, -3.05, -Math.PI / 2);
  b.rbox('woodMid', 8.6, 0.25, -3.75, 0.36, 0.5, 0.36, 0.02);
  b.rbox('fabricIndigo', 8.6, 0.52, -3.75, 0.16, 0.04, 0.22, 0.004);
  b.cyl('black', 8.62, 0.015, -2.5, 0.12, 0.14, 0.03, 18);
  b.rod('black', 8.62, 0.03, -2.5, 8.55, 1.35, -2.62, 0.01, 6);
  addLamp('reading', [8.52, 1.32, -2.7], { power: 5, distance: 5, shade: { rt: 0.07, rb: 0.14, h: 0.16, at: [8.52, 1.36, -2.68] } });
  rug(T.rugStripe, 7.1, -4.2, 2.2, 1.4);
  plant(b, 8.55, -4.1, 0.85, { seed: 21 });
  // curtains on the east window (animated open/close)
  {
    const curtainMat = new THREE.MeshStandardMaterial({ map: T.fabric, color: 0xe9e2d5, roughness: 0.95, side: THREE.DoubleSide });
    const wave = new THREE.PlaneGeometry(1.2, 2.25, 24, 1);
    const wp = wave.attributes.position;
    for (let i = 0; i < wp.count; i++) wp.setZ(i, Math.sin(wp.getX(i) * 26) * 0.025);
    wave.computeVertexNormals();
    H.curtains = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      const z = side < 0 ? -6.12 : -3.68;
      pivot.position.set(8.82, 1.18 - CUT, z);
      pivot.rotation.y = -Math.PI / 2;
      const mesh = new THREE.Mesh(wave, curtainMat);
      mesh.position.x = -side * 0.6; // pivot sits at the window edge
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      pivot.add(mesh);
      decorExtras['ext+x'].add(pivot);
      H.curtains.push({ pivot, mesh, side });
    }
    D('ext+x');
    decor['ext+x'].bx('woodDark', 8.8, 2.33, -6.2, 8.84, 2.36, -3.6);
    decor['ext+x'].pop();
  }

  // ========== BATH ==========
  b.rbox('woodLight', 6.15, 0.42, -1.87, 1.4, 0.84, 0.52, 0.015); // vanity
  b.rbox('counter', 6.15, 0.855, -1.87, 1.44, 0.03, 0.56, 0.008);
  b.cyl('ceramic', 6.15, 0.91, -1.85, 0.2, 0.16, 0.1, 28);
  b.cyl('black', 6.15, 0.955, -1.85, 0.16, 0.16, 0.004, 24);
  b.rod('steel', 6.15, 0.87, -2.1, 6.15, 1.1, -2.1, 0.012, 8);
  b.rod('steel', 6.15, 1.1, -2.1, 6.15, 1.08, -1.95, 0.01, 8);
  for (let i = 0; i < 4; i++) b.cyl(i % 2 ? 'ceramic' : 'terra', 5.6 + i * 0.07, 0.92, -2.02, 0.022, 0.022, 0.1, 10);
  H.mirrorMat = new THREE.MeshStandardMaterial({ color: 0xdfe6e6, metalness: 1, roughness: 0.04 });
  D('int-x');
  decor['int-x'].rbox('woodDark', 6.15, 1.6, -2.125, 1.02, 0.8, 0.03, 0.01);
  {
    const mirror = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 0.72), H.mirrorMat);
    mirror.position.set(6.15, 1.6 - CUT, -2.105);
    decorExtras['int-x'].add(mirror);
  }
  decor['int-x'].pop();
  // towels
  b.rbox('woodLight', 5.45, 0.5, 1.4, 0.36, 1.0, 1.1, 0.01);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) b.rbox(['fabricCream', 'fabricSage', 'fabricIndigo'][(i + j) % 3], 5.47, 0.2 + i * 0.3, 1.15 + j * 0.5, 0.3, 0.12, 0.38, 0.04);
  b.cyl('woodLight', 6.8, 0.2, 1.75, 0.18, 0.15, 0.4, 18); // hamper
  // tub
  b.rbox('ceramic', 8.22, 0.28, -1.25, 1.26, 0.56, 1.64, 0.06);
  H.bathWater = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.02, 1.46), M.water);
  H.bathWater.position.set(8.22, 0.5, -1.25);
  extras.add(H.bathWater);
  b.rbox('woodLight', 7.55, 0.14, 0.35, 0.3, 0.28, 0.24, 0.03); // bath stool
  b.cyl('woodLight', 7.95, 0.08, 0.55, 0.13, 0.11, 0.16, 18); // oke (wooden bucket)
  D('ext+x');
  decor['ext+x'].rod('steel', 8.88, 1.2, 0.3, 8.88, 2.0, 0.3, 0.012, 8);
  decor['ext+x'].cyl('steel', 8.8, 2.02, 0.3, 0.08, 0.08, 0.02, 20, 0, 0.35);
  decor['ext+x'].pop();
  H.steamBath = new THREE.Vector3(8.22, 0.6, -1.25);
  // WC
  b.rbox('ceramic', 8.55, 0.2, 1.52, 0.4, 0.4, 0.55, 0.12);
  b.rbox('ceramic', 8.75, 0.55, 1.52, 0.16, 0.4, 0.5, 0.05);
  b.cyl('ceramic', 8.5, 0.405, 1.52, 0.2, 0.2, 0.02, 24);
  // privacy veil over the bath while in use
  H.bathVeil = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.02, 3.12), new THREE.MeshPhysicalMaterial({
    color: 0xf1f4f3, roughness: 0.5, transparent: true, opacity: 0, depthWrite: false,
  }));
  H.bathVeil.position.set(8.02, 2.62, -0.58);
  H.bathVeil.userData.noAO = true;
  extras.add(H.bathVeil);

  // ========== CLAUDE'S ROOM ==========
  // charging dock against the service wall (the heat exchanger lives inside that wall)
  b.cyl('ivory', 7.3, 0.02, 2.82, 0.46, 0.48, 0.04, 40);
  b.cyl('terra', 7.3, 0.042, 2.82, 0.34, 0.34, 0.006, 40);
  // backrest: a tall rounded shell with a warm band at the base and a cooling hood on top
  b.rbox('ivory', 7.3, 0.92, 2.45, 0.9, 1.76, 0.16, 0.12);
  b.rbox('terra', 7.3, 0.22, 2.54, 0.92, 0.1, 0.05, 0.03);
  b.rbox('ivory', 7.3, 1.74, 2.58, 0.66, 0.1, 0.34, 0.05);
  for (let i = 0; i < 4; i++) b.bx('black', 7.06 + i * 0.16, 1.785, 2.44, 7.18 + i * 0.16, 1.792, 2.72);
  D('int-x');
  for (const x of [7.05, 7.55]) decor['int-x'].rod('steel', x, 1.75, 2.45, x, 2.45, 2.4, 0.03, 10); // heat pipes into the service wall
  decor['int-x'].bx('black', 6.9, 2.05, 2.34, 7.7, 2.45, 2.36);
  for (let i = 0; i < 6; i++) decor['int-x'].bx('steel', 6.92, 2.08 + i * 0.06, 2.36, 7.68, 2.1 + i * 0.06, 2.375);
  decor['int-x'].pop();
  H.dockMat = new THREE.MeshStandardMaterial({ color: 0x3a2a24, emissive: 0xff8f5a, emissiveIntensity: 0.3 });
  {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.016, 10, 48), H.dockMat);
    ring.position.set(7.3, 1.12, 2.548);
    ring.userData.noAO = true;
    extras.add(ring);
    const floorRing = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.39, 48), H.dockMat);
    floorRing.rotation.x = -Math.PI / 2;
    floorRing.position.set(7.3, 0.046, 2.82);
    extras.add(floorRing);
  }
  // workbench under the east window
  b.rbox('woodMid', 8.6, 0.88, 5.0, 0.6, 0.05, 1.8, 0.01);
  for (const z of [4.2, 5.8]) for (const x of [8.38, 8.84]) b.rod('steel', x, 0, z, x, 0.86, z, 0.018, 8);
  b.rbox('woodMid', 8.6, 0.25, 5.0, 0.55, 0.03, 1.7, 0.01);
  b.rbox('terra', 8.62, 0.98, 4.45, 0.3, 0.16, 0.2, 0.02); // toolbox
  b.rbox('black', 8.62, 1.07, 4.45, 0.12, 0.02, 0.02, 0.005);
  b.rbox('ivory', 8.55, 0.94, 5.25, 0.08, 0.05, 0.1, 0.02); // spare hand (Claude's)
  b.cyl('terra', 8.55, 0.94, 5.33, 0.03, 0.03, 0.06, 12, Math.PI / 2);
  for (let i = 0; i < 4; i++) b.rbox(['potGray', 'terra', 'fabricIndigo', 'woodLight'][i], 8.72, 0.95, 4.9 + i * 0.12, 0.14, 0.09, 0.1, 0.01);
  b.rod('black', 8.8, 0.9, 5.7, 8.7, 1.3, 5.6, 0.01, 6); // magnifier arm
  b.torus('steel', 8.6, 1.3, 5.55, 0.07, 0.012, 0.9, 24, 0.5);
  b.rbox('fabricGray', 8.6, 0.47, 4.95, 0.4, 0.4, 0.4, 0.04); // parts bin under the bench
  D('ext+x');
  decor['ext+x'].bx('woodDark', 8.87, 1.02, 4.1, 8.9, 1.16, 5.9);
  for (let i = 0; i < 6; i++) decor['ext+x'].rod(i % 2 ? 'terra' : 'black', 8.86, 1.08, 4.25 + i * 0.28, 8.86, 0.9, 4.25 + i * 0.28, 0.008, 6);
  decor['ext+x'].pop();
  // desk by the south window
  table(b, 7.95, 6.55, 1.3, 0.62, 0.72, { top: 'woodLight', leg: 'woodMid' });
  chair(b, 7.95, 5.9, 0, { seat: 'fabricTerra' });
  b.rbox('paper', 7.8, 0.735, 6.5, 0.3, 0.012, 0.22, 0.004);
  b.rbox('paper', 8.1, 0.735, 6.5, 0.3, 0.012, 0.22, 0.004);
  b.rod('fabricIndigo', 7.95, 0.745, 6.42, 8.1, 0.745, 6.35, 0.004, 5);
  b.cyl('potTerra', 7.45, 0.78, 6.7, 0.05, 0.04, 0.09, 12);
  for (let i = 0; i < 6; i++) b.ell('leafGreen', 7.45 + Math.cos(i) * 0.02, 0.86 + (i % 3) * 0.015, 6.7 + Math.sin(i) * 0.02, 0.018, 0.04, 0.018, i, 0.4);
  b.rbox('woodDark', 8.45, 0.8, 6.78, 0.16, 0.13, 0.015, 0.004, -0.4); // photo frame
  {
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.09), new THREE.MeshStandardMaterial({ map: T.paintings[0], roughness: 0.8 }));
    photo.position.set(8.447, 0.8, 6.77);
    photo.rotation.y = Math.PI - 0.4;
    extras.add(photo);
  }
  b.cyl('black', 8.35, 0.735, 6.72, 0.06, 0.07, 0.02, 16);
  b.rod('black', 8.35, 0.74, 6.72, 8.3, 1.05, 6.6, 0.008, 6);
  addLamp('claudeDesk', [8.3, 1.02, 6.55], { power: 3.2, distance: 4, shade: { rt: 0.04, rb: 0.08, h: 0.1, at: [8.3, 1.05, 6.56] }, color: 0xffb877 });
  // keepsake shelf on the west wall
  D('int-z');
  for (let i = 0; i < 3; i++) decor['int-z'].rbox('woodLight', 5.42, 1.0 + i * 0.4, 4.55, 0.3, 0.03, 1.4, 0.008);
  decor['int-z'].ell('stoneDark', 5.42, 1.05, 4.1, 0.06, 0.035, 0.045, 0.3);
  decor['int-z'].cyl('potTerra', 5.42, 1.07, 4.45, 0.04, 0.035, 0.09, 12);
  decor['int-z'].rbox('paper', 5.42, 1.03, 4.85, 0.18, 0.03, 0.24, 0.005);
  decor['int-z'].ell('bark', 5.42, 1.06, 5.1, 0.03, 0.05, 0.03, 0);
  decor['int-z'].rbox('woodDark', 5.34, 1.52, 4.3, 0.02, 0.2, 0.16, 0.006);
  decor['int-z'].ell('tomato', 5.42, 1.45, 4.75, 0.03, 0.03, 0.03, 0);
  decor['int-z'].cyl('ceramic', 5.42, 1.47, 5.0, 0.045, 0.04, 0.1, 12);
  decor['int-z'].rbox('ivory', 5.42, 1.85, 4.4, 0.06, 0.07, 0.06, 0.02); // tiny robot figurine
  decor['int-z'].sphere('terra', 5.42, 1.91, 4.4, 0.025, 10);
  decor['int-z'].pop();
  {
    const pressed = new THREE.Group();
    const leafTexMat = new THREE.MeshStandardMaterial({ map: T.paintings[2], roughness: 0.9 });
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.18), leafTexMat);
    pic.position.set(5.352, 1.52 - CUT, 4.3);
    pic.rotation.y = Math.PI / 2;
    pressed.add(pic);
    decorExtras['int-z'].add(pressed);
  }
  {
    const round = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.01, 48), M.fabricOat);
    round.position.set(7.0, 0.005, 4.5);
    round.receiveShadow = true;
    extras.add(round);
  }
  tallPlant(b, 8.55, 2.75, 0.95, 13);
  b.rbox('rubber', 6.3, 0.008, 6.62, 1.0, 0.016, 0.5, 0.004); // brush mat at the garden door
  for (let i = 0; i < 12; i++) b.bx('black', 5.85 + i * 0.08, 0.016, 6.4, 5.87 + i * 0.08, 0.03, 6.84);

  // ========== STUDY ==========
  table(b, -1.3, 3.8, 1.4, 0.64, 0.72);
  table(b, 0.45, 3.8, 1.4, 0.64, 0.72);
  chair(b, -1.3, 4.52, Math.PI, { seat: 'fabricIndigo' });
  chair(b, 0.45, 4.52, Math.PI, { seat: 'fabricTerra' });
  // human's desk: monitor, keyboard, mug
  b.rbox('black', -1.3, 0.745, 3.62, 0.22, 0.01, 0.16, 0.004);
  b.rod('black', -1.3, 0.75, 3.62, -1.3, 0.95, 3.62, 0.015, 8);
  b.rbox('black', -1.3, 1.1, 3.6, 0.64, 0.38, 0.03, 0.01);
  H.screenMat = new THREE.MeshStandardMaterial({ color: 0x151719, emissive: 0x9fb8dd, emissiveIntensity: 0.05, roughness: 0.25 });
  {
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.34), H.screenMat);
    scr.position.set(-1.3, 1.1, 3.617);
    scr.rotation.y = 0;
    extras.add(scr);
  }
  b.rbox('lacquer', -1.3, 0.75, 3.98, 0.42, 0.018, 0.13, 0.006);
  b.cyl('terra', -0.8, 0.78, 3.9, 0.04, 0.035, 0.09, 14);
  // Claude's desk: no monitor — paper, pen, a small cactus
  for (let i = 0; i < 4; i++) b.rbox('paper', 0.2 + i * 0.12, 0.745 + i * 0.004, 3.8 + (i % 2) * 0.05, 0.22, 0.008, 0.3, 0.003, (i - 1.5) * 0.15);
  b.rbox('paper', 0.75, 0.76, 3.7, 0.24, 0.03, 0.3, 0.004);
  b.cyl('woodDark', 0.95, 0.79, 3.62, 0.035, 0.035, 0.1, 12);
  for (let i = 0; i < 3; i++) b.rod(['fabricIndigo', 'terra', 'black'][i], 0.94 + i * 0.012, 0.8, 3.62, 0.93 + i * 0.02, 0.9, 3.62, 0.004, 4);
  b.cyl('potTerra', 0.02, 0.77, 3.6, 0.035, 0.03, 0.06, 12);
  b.ell('leafGreen', 0.02, 0.83, 3.6, 0.025, 0.05, 0.025, 0);
  // shared desk lamp on the half wall
  b.cyl('black', -0.42, 1.04, 3.5, 0.06, 0.07, 0.02, 14);
  b.rod('black', -0.42, 1.05, 3.5, -0.42, 1.38, 3.62, 0.008, 6);
  addLamp('study', [-0.42, 1.36, 3.7], { power: 5.5, distance: 5.5, shade: { rt: 0.05, rb: 0.1, h: 0.12, at: [-0.42, 1.38, 3.68] } });
  // bookshelves along the south wall
  shelf(b, -1.7, 6.72, Math.PI, 1.2, 2.2, 0.34, 6, { seed: 3 });
  shelf(b, 1.7, 6.72, Math.PI, 1.2, 2.2, 0.34, 6, { seed: 4 });
  for (const [x, s] of [[-3.4, 5], [0, 6], [3.4, 8]]) shelf(b, x, 6.72, Math.PI, 1.9, 0.9, 0.34, 2, { seed: s });
  plant(b, -3.4, 6.72, 0.55, { pot: 'ceramic', seed: 31, n: 6, y: 0.9 });
  // whiteboard on the west wall
  D('int-z');
  decor['int-z'].rbox('steel', -5.125, 1.4, 5.2, 0.02, 1.04, 2.04, 0.01);
  decor['int-z'].bx('steel', -5.12, 0.86, 4.3, -5.05, 0.88, 6.1);
  for (let i = 0; i < 3; i++) decor['int-z'].rod(['fabricIndigo', 'red', 'black'][i], -5.07, 0.89, 4.5 + i * 0.08, -5.07, 0.89, 4.62 + i * 0.08, 0.008, 6);
  decor['int-z'].pop();
  {
    const wb = new THREE.Mesh(new THREE.PlaneGeometry(1.96, 0.98), new THREE.MeshStandardMaterial({ map: T.whiteboard, roughness: 0.35 }));
    wb.position.set(-5.112, 1.4 - CUT, 5.2);
    wb.rotation.y = Math.PI / 2;
    decorExtras['int-z'].add(wb);
  }
  // worktable with a model of this house
  table(b, 3.5, 4.85, 1.7, 0.85, 0.76, { top: 'woodLight' });
  b.rbox('leafDark', 3.3, 0.762, 4.85, 0.6, 0.004, 0.45, 0.002);
  b.at(3.3, 0.766, 4.85, 0.2, (c) => {
    c.bx('lacquer', -0.2, 0, -0.15, 0.2, 0.012, 0.15);
    c.bx('paper', -0.18, 0.012, -0.13, 0.18, 0.05, -0.11);
    c.bx('paper', -0.18, 0.012, 0.11, 0.18, 0.05, 0.13);
    c.bx('paper', -0.18, 0.012, -0.13, -0.16, 0.05, 0.13);
    c.bx('paper', 0.16, 0.012, -0.13, 0.18, 0.05, 0.13);
    c.bx('leafGreen', -0.08, 0.012, -0.05, 0.08, 0.016, 0.05);
    c.sphere('terra', 0.12, 0.03, 0.06, 0.012, 8);
  });
  b.rbox('paper', 3.95, 0.765, 4.65, 0.3, 0.01, 0.4, 0.003, 0.3);
  b.cyl('ceramic', 4.05, 0.8, 5.05, 0.04, 0.035, 0.08, 12);
  tallPlant(b, 4.8, 3.85, 0.9, 17);
  armchair(b, -4.35, 6.25, Math.PI * 0.8, 'fabricMustard');

  // ========== ENTRANCE (doma) ==========
  b.rbox('woodLight', -8.72, 0.22, 4.9, 0.36, 0.44, 1.5, 0.03); // bench
  b.rbox('fabricIndigo', -8.72, 0.455, 4.6, 0.3, 0.03, 0.5, 0.01);
  b.rbox('woodLight', -8.7, 0.5, 3.1, 0.4, 1.0, 1.4, 0.015); // shoe cabinet
  b.bx('woodDark', -8.499, 0.06, 3.097, -8.494, 0.95, 3.103);
  plant(b, -8.7, 2.85, 0.5, { pot: 'ceramic', seed: 41, n: 7, y: 1.0 });
  plant(b, -5.65, 6.45, 1.0, { seed: 43, big: 1.6, n: 9 });
  b.cyl('potGray', -6.15, 0.25, 6.62, 0.1, 0.09, 0.5, 14); // umbrella stand
  b.rod('fabricIndigo', -6.18, 0.3, 6.62, -6.12, 1.0, 6.6, 0.012, 6);
  b.rod('terra', -6.12, 0.3, 6.64, -6.18, 0.95, 6.66, 0.012, 6);
  // dust gate: brush mat + air-nozzle arch (for Claude's joints and the human's pollen)
  b.rbox('rubber', -7.1, 0.008, 6.25, 1.2, 0.016, 1.1, 0.004);
  for (let i = 0; i < 14; i++) b.bx('black', -7.64 + i * 0.08, 0.016, 5.75, -7.62 + i * 0.08, 0.032, 6.75);
  for (const x of [-7.78, -6.42]) {
    b.rbox('lacquer', x, 1.1, 5.75, 0.08, 2.2, 0.12, 0.02);
    for (let i = 0; i < 7; i++) b.cyl('black', x + (x < -7 ? 0.045 : -0.045), 0.35 + i * 0.26, 5.75, 0.012, 0.012, 0.012, 8, 0, Math.PI / 2);
  }
  b.rbox('lacquer', -7.1, 2.23, 5.75, 1.44, 0.08, 0.12, 0.02);
  D('int-z');
  decor['int-z'].bx('woodDark', -5.27, 1.62, 4.6, -5.2, 1.68, 6.3);
  for (let i = 0; i < 4; i++) decor['int-z'].rod('brass', -5.27, 1.62, 4.8 + i * 0.45, -5.36, 1.66, 4.8 + i * 0.45, 0.008, 6);
  decor['int-z'].rbox('fabricSage', -5.38, 1.2, 4.8, 0.08, 0.72, 0.42, 0.04); // coat
  decor['int-z'].rbox('fabricTerra', -5.36, 1.32, 5.7, 0.07, 0.5, 0.34, 0.04); // Claude's rain poncho
  decor['int-z'].sphere('fabricMustard', -5.36, 1.72, 5.25, 0.1, 12, 1, 0.6, 1); // hat
  decor['int-z'].pop();

  // ========== UTILITY ==========
  for (const z of [-1.58, -0.9]) {
    b.rbox('lacquer', -8.58, 0.43, z, 0.6, 0.86, 0.62, 0.03);
    b.torus('steel', -8.275, 0.46, z, 0.18, 0.02, 0, 32, Math.PI / 2);
    b.cyl('black', -8.28, 0.46, z, 0.16, 0.16, 0.01, 28, 0, Math.PI / 2);
  }
  b.rbox('woodLight', -7.05, 0.45, -1.86, 2.3, 0.9, 0.55, 0.015); // folding counter
  b.rbox('counter', -7.05, 0.915, -1.86, 2.34, 0.03, 0.58, 0.006);
  for (let i = 0; i < 4; i++) b.rbox(['fabricCream', 'fabricIndigo', 'fabricSage', 'fabricMustard'][i], -7.6 + i * 0.3, 0.955 + (i % 2) * 0.03, -1.86, 0.26, 0.05 + (i % 2) * 0.04, 0.22, 0.015);
  b.cyl('woodLight', -6.3, 0.16, -1.2, 0.2, 0.17, 0.32, 18); // laundry basket
  b.ell('fabricCream', -6.3, 0.32, -1.2, 0.17, 0.05, 0.17);
  shelf(b, -7.55, 1.95, Math.PI, 2.6, 2.0, 0.36, 5, { seed: 51, fill: 0.35, objects: true });
  for (let i = 0; i < 10; i++) b.cyl(['ceramic', 'potTerra', 'paper'][i % 3], -8.6 + i * 0.25, 1.305, 1.95, 0.05, 0.05, 0.14, 12);
  // drying rack with hanging clothes
  b.rod('steel', -8.1, 1.95, 0.35, -6.0, 1.95, 0.35, 0.012, 8);
  for (let i = 0; i < 6; i++) {
    const x = -7.85 + i * 0.34;
    b.rod('steel', x, 1.95, 0.35, x, 1.88, 0.35, 0.003, 4);
    b.rbox(['fabricCream', 'fabricIndigo', 'fabricSage', 'fabricTerra', 'fabricOat', 'fabricMustard'][i], x, 1.62, 0.35, 0.28, 0.52 - (i % 2) * 0.12, 0.02, 0.01);
  }
  // home battery (LED bar shows the charge level)
  b.rbox('lacquer', -8.78, 0.65, 0.95, 0.22, 1.1, 0.7, 0.03);
  H.batteryMat = new THREE.MeshStandardMaterial({ color: 0x1b2a1b, emissive: 0x7fe08a, emissiveIntensity: 1.2 });
  H.batteryLeds = [];
  for (let i = 0; i < 5; i++) {
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.05, 0.08), H.batteryMat.clone());
    led.position.set(-8.667, 0.8 + i * 0.07, 0.95);
    led.userData.noAO = true;
    extras.add(led);
    H.batteryLeds.push(led);
  }

  // ---------- books ----------
  const bookGeo = new THREE.BoxGeometry(1, 1, 1);
  bookGeo.translate(0, 0.5, 0);
  const bookMat = new THREE.MeshStandardMaterial({ roughness: 0.78 });
  const bookMesh = new THREE.InstancedMesh(bookGeo, bookMat, books.length);
  books.forEach((bk, i) => {
    bookMesh.setMatrixAt(i, bk.m);
    bookMesh.setColorAt(i, bk.c);
  });
  bookMesh.instanceMatrix.needsUpdate = true;
  if (bookMesh.instanceColor) bookMesh.instanceColor.needsUpdate = true;
  bookMesh.receiveShadow = true;
  bookMesh.castShadow = false;
  bookMesh.computeBoundingSphere();

  const group = b.build({ cast: true, name: 'furniture' });
  group.add(bookMesh);
  group.add(extras);
  extras.traverse((o) => { if (o.isMesh && o.castShadow === false) o.receiveShadow = true; });

  const decorGroups = {};
  for (const k of DECOR_KEYS) {
    const g = new THREE.Group();
    g.add(decor[k].build({ cast: false, name: `decor-${k}` }));
    g.add(decorExtras[k]);
    decorGroups[k] = g;
  }
  return { group, decorGroups, lamps, handles: H };
}
