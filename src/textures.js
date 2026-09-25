// Procedural textures drawn on canvas at startup, so the project ships no image files.
// Tiled textures use world-scale UVs (meters); `size` is how many meters one tile covers.
import * as THREE from 'three';
import { mulberry32, makeNoise, fbm } from './util.js';

let ANISO = 8;
export const setAnisotropy = (a) => { ANISO = a; };

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d', { willReadFrequently: true })];
}

function toTexture(c, size = 1, { srgb = true, tile = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (tile) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1 / size, 1 / size);
  }
  t.anisotropy = ANISO;
  return t;
}

// Per-pixel fill without allocations: fn(x, y, out) writes rgb into out.
function pixels(g, w, h, fn) {
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  const o = [0, 0, 0];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      fn(x, y, o);
      const i = (y * w + x) * 4;
      d[i] = o[0];
      d[i + 1] = o[1];
      d[i + 2] = o[2];
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
}

// Draw a horizontal span [a, b) that wraps around a tile of width S.
function wrapDraw(S, a, b, fn) {
  const a0 = ((a % S) + S) % S;
  const b0 = a0 + (b - a);
  fn(a0, b0);
  if (b0 > S) fn(a0 - S, b0 - S);
}

export function woodFloor() {
  const S = 1024;
  const [c, g] = canvas(S);
  const rnd = mulberry32(11);
  const rows = 16, rh = S / rows;
  for (let r = 0; r < rows; r++) {
    const y0 = r * rh;
    const off = rnd() * S;
    const bounds = [0];
    let x = 0;
    for (;;) {
      const len = S * (0.32 + rnd() * 0.36);
      if (x + len > S - S * 0.22) { bounds.push(S); break; }
      x += len;
      bounds.push(x);
    }
    for (let i = 0; i < bounds.length - 1; i++) {
      const a = bounds[i] + off, b = bounds[i + 1] + off;
      const hue = 28 + rnd() * 7, sat = 34 + rnd() * 14, lig = 57 + rnd() * 12;
      wrapDraw(S, a, b, (xa, xb) => {
        g.fillStyle = `hsl(${hue},${sat}%,${lig}%)`;
        g.fillRect(xa, y0, xb - xa, rh);
      });
      const lines = 9 + Math.floor(rnd() * 9);
      for (let k = 0; k < lines; k++) {
        const yy = y0 + 2 + rnd() * (rh - 4), amp = 0.4 + rnd() * 2.2, fr = 0.004 + rnd() * 0.014, ph = rnd() * 6.28;
        const col = `rgba(${(95 + rnd() * 40) | 0},${(58 + rnd() * 25) | 0},${(28 + rnd() * 10) | 0},${0.05 + rnd() * 0.11})`;
        const lw = 0.5 + rnd() * 1.6;
        wrapDraw(S, a, b, (xa, xb) => {
          g.strokeStyle = col;
          g.lineWidth = lw;
          g.beginPath();
          for (let xx = xa; xx <= xb + 0.1; xx += 8) {
            const yv = yy + Math.sin((xx - xa) * fr + ph) * amp;
            if (xx === xa) g.moveTo(xx, yv); else g.lineTo(xx, yv);
          }
          g.stroke();
        });
      }
      if (rnd() < 0.25) {
        const kx = a + (b - a) * (0.2 + rnd() * 0.6), ky = y0 + rh * (0.3 + rnd() * 0.4), kr = 5 + rnd() * 5;
        wrapDraw(S, kx - kr, kx + kr, (xa) => {
          g.fillStyle = 'rgba(95,58,30,0.32)';
          g.beginPath();
          g.ellipse(xa + kr, ky, kr, 2.5, 0, 0, Math.PI * 2);
          g.fill();
        });
      }
      wrapDraw(S, a, a + 2, (xa, xb) => {
        g.fillStyle = 'rgba(60,38,22,0.65)';
        g.fillRect(xa, y0, xb - xa, rh);
      });
    }
    g.fillStyle = 'rgba(60,38,22,0.55)';
    g.fillRect(0, y0, S, 1.6);
  }
  return { map: toTexture(c, 2.4) };
}

export function plaster() {
  const S = 512;
  const [c, g] = canvas(S);
  const n = makeNoise(3);
  pixels(g, S, S, (x, y, o) => {
    const v = fbm(n, (x / S) * 8, (y / S) * 8, 8, 8, 4);
    const w = n((x / S) * 96, (y / S) * 96, 96, 96);
    const k = 0.955 + (v - 0.5) * 0.07 + (w - 0.5) * 0.025;
    o[0] = 246 * k; o[1] = 243 * k; o[2] = 237 * k;
  });
  return toTexture(c, 1.8);
}

// Vertical board siding, grayscale so the material color sets the tone.
export function cladding() {
  const S = 512;
  const [c, g] = canvas(S);
  const n = makeNoise(8);
  const boards = 10, bw = S / boards;
  pixels(g, S, S, (x, y, o) => {
    const b = Math.floor(x / bw);
    const bv = ((b * 7919) % 13) / 13;
    const gr = fbm(n, (x / S) * 64, (y / S) * 4, 64, 4, 3);
    const v = 150 + bv * 28 + (gr - 0.5) * 55;
    o[0] = v; o[1] = v; o[2] = v;
  });
  for (let i = 0; i < boards; i++) {
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillRect(i * bw, 0, 3, S);
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(i * bw + 3, 0, 2, S);
  }
  return toTexture(c, 2.0);
}

export function tiles({ S = 512, n = 4, size = 1.2, base = [212, 208, 200], vary = 10, grout = [150, 145, 138], gw = 3, seed = 9, noiseAmt = 16 } = {}) {
  const [c, g] = canvas(S);
  const rnd = mulberry32(seed);
  const nz = makeNoise(seed);
  const ts = S / n;
  const tv = Array.from({ length: n * n }, () => (rnd() - 0.5) * vary);
  pixels(g, S, S, (x, y, o) => {
    const tx = Math.floor(x / ts), ty = Math.floor(y / ts);
    const lx = x - tx * ts, ly = y - ty * ts;
    const edge = Math.min(lx, ly, ts - lx, ts - ly);
    if (edge < gw / 2) { o[0] = grout[0]; o[1] = grout[1]; o[2] = grout[2]; return; }
    const nv = (fbm(nz, (x / S) * 8, (y / S) * 8, 8, 8, 3) - 0.5) * noiseAmt;
    const t = tv[ty * n + tx] + nv + (edge < gw / 2 + 1.5 ? -6 : 0);
    o[0] = base[0] + t; o[1] = base[1] + t; o[2] = base[2] + t;
  });
  return toTexture(c, size);
}

export function subway() {
  const W = 256, Hh = 256;
  const [c, g] = canvas(W, Hh);
  const cols = 4, rows = 8, tw = W / cols, th = Hh / rows;
  const rnd = mulberry32(4);
  g.fillStyle = '#bdbab4';
  g.fillRect(0, 0, W, Hh);
  for (let r = 0; r < rows; r++) {
    for (let k = -1; k < cols; k++) {
      const x = k * tw + (r % 2 ? tw / 2 : 0);
      const v = 236 + rnd() * 12;
      const grd = g.createLinearGradient(0, r * th, 0, r * th + th);
      grd.addColorStop(0, `rgb(${v},${v},${v - 3})`);
      grd.addColorStop(1, `rgb(${v - 14},${v - 14},${v - 17})`);
      g.fillStyle = grd;
      g.fillRect(x + 1.5, r * th + 1.5, tw - 3, th - 3);
    }
  }
  return toTexture(c, 0.6);
}

export function cork() {
  const S = 256;
  const [c, g] = canvas(S);
  const rnd = mulberry32(12);
  const n = makeNoise(12);
  pixels(g, S, S, (x, y, o) => {
    const v = fbm(n, (x / S) * 16, (y / S) * 16, 16, 16, 3);
    o[0] = 176 + (v - 0.5) * 50; o[1] = 132 + (v - 0.5) * 40; o[2] = 90 + (v - 0.5) * 30;
  });
  for (let i = 0; i < 2600; i++) {
    const x = rnd() * S, y = rnd() * S, r = 0.5 + rnd() * 1.6;
    g.fillStyle = rnd() < 0.5 ? `rgba(90,55,30,${0.25 + rnd() * 0.4})` : `rgba(228,196,148,${0.2 + rnd() * 0.35})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  return toTexture(c, 0.6);
}

// Grayscale weave; tint with material.color.
export function fabric() {
  const S = 256;
  const [c, g] = canvas(S);
  const n = makeNoise(21);
  pixels(g, S, S, (x, y, o) => {
    const cx = x % 4, cy = y % 4;
    const over = ((x >> 2) + (y >> 2)) & 1;
    const w = over ? Math.sin((Math.PI * (cx + 0.5)) / 4) : Math.sin((Math.PI * (cy + 0.5)) / 4);
    const nv = fbm(n, (x / S) * 32, (y / S) * 32, 32, 32, 2);
    const v = 205 + w * 36 + (nv - 0.5) * 28;
    o[0] = v; o[1] = v; o[2] = v;
  });
  return toTexture(c, 0.25);
}

// Grayscale-warm wood grain for furniture; tint with material.color.
export function woodGrain() {
  const S = 512;
  const [c, g] = canvas(S);
  const n = makeNoise(31);
  pixels(g, S, S, (x, y, o) => {
    const v = fbm(n, (x / S) * 3, (y / S) * 24, 3, 24, 4);
    const ring = Math.abs(Math.sin(v * 28));
    const fine = n((x / S) * 8, (y / S) * 160, 8, 160);
    const val = 206 + ring * 30 - (1 - ring) * 8 + (fine - 0.5) * 22;
    o[0] = val; o[1] = val * 0.97; o[2] = val * 0.93;
  });
  return toTexture(c, 1.2);
}

export function lawn() {
  const S = 512;
  const [c, g] = canvas(S);
  const n = makeNoise(41);
  pixels(g, S, S, (x, y, o) => {
    const v = fbm(n, (x / S) * 8, (y / S) * 8, 8, 8, 4);
    const f = n((x / S) * 128, (y / S) * 128, 128, 128);
    const k = (v - 0.5) * 0.35 + (f - 0.5) * 0.18;
    o[0] = 98 * (1 + k) + 8; o[1] = 128 * (1 + k * 0.8) + 6; o[2] = 62 * (1 + k);
  });
  return toTexture(c, 5);
}

// Side of the diorama plinth: soil strata. u tiles every 4 m, v spans the full height.
export function soilStrata() {
  const W = 512, Hh = 256;
  const [c, g] = canvas(W, Hh);
  const n = makeNoise(51);
  const rnd = mulberry32(52);
  const layers = [
    [0.04, [92, 120, 58]],
    [0.22, [80, 60, 43]],
    [0.3, [132, 99, 68]],
    [0.18, [152, 140, 121]],
    [0.26, [98, 88, 80]],
  ];
  pixels(g, W, Hh, (x, y, o) => {
    const wob = (fbm(n, (x / W) * 6, 0.5, 6, 256, 3) - 0.5) * 0.08;
    const t = y / Hh + wob;
    let acc = 0, col = layers[layers.length - 1][1];
    for (const [th, cl] of layers) {
      acc += th;
      if (t < acc) { col = cl; break; }
    }
    const v = (fbm(n, (x / W) * 24, (y / Hh) * 12, 24, 12, 3) - 0.5) * 40;
    o[0] = col[0] + v; o[1] = col[1] + v; o[2] = col[2] + v;
  });
  for (let i = 0; i < 520; i++) {
    const x = rnd() * W, y = Hh * (0.55 + rnd() * 0.45), r = 1 + rnd() * 3.5, v = 118 + rnd() * 70;
    g.fillStyle = `rgba(${v},${v - 6},${v - 14},0.8)`;
    g.beginPath();
    g.ellipse(x, y, r * 1.4, r, rnd() * 3, 0, Math.PI * 2);
    g.fill();
  }
  const t = toTexture(c, 1);
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.repeat.set(1 / 4, 1);
  return t;
}

export function gravel() {
  const S = 512;
  const [c, g] = canvas(S);
  const rnd = mulberry32(61);
  g.fillStyle = '#8f897f';
  g.fillRect(0, 0, S, S);
  const shifts = [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]];
  for (let i = 0; i < 5200; i++) {
    const x = rnd() * S, y = rnd() * S, r = 1.2 + rnd() * 3.2, v = 110 + rnd() * 100, rot = rnd() * 3.14;
    for (const [ox, oy] of shifts) {
      const px = x + ox, py = y + oy;
      if (px < -8 || px > S + 8 || py < -8 || py > S + 8) continue;
      g.fillStyle = 'rgba(40,36,30,0.35)';
      g.beginPath();
      g.ellipse(px + 0.8, py + 1, r * 1.3, r, rot, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = `rgb(${v},${v - 4},${v - 10})`;
      g.beginPath();
      g.ellipse(px, py, r * 1.3, r, rot, 0, Math.PI * 2);
      g.fill();
    }
  }
  return toTexture(c, 1.6);
}

export function moss() {
  const S = 512;
  const [c, g] = canvas(S);
  const n = makeNoise(71);
  pixels(g, S, S, (x, y, o) => {
    const v = fbm(n, (x / S) * 6, (y / S) * 6, 6, 6, 4);
    const f = n((x / S) * 150, (y / S) * 150, 150, 150);
    const k = (v - 0.5) * 0.6 + (f - 0.5) * 0.25;
    o[0] = 88 * (1 + k); o[1] = 118 * (1 + k * 0.8); o[2] = 56 * (1 + k);
  });
  return toTexture(c, 3);
}

export function deckBoards() {
  const S = 512;
  const [c, g] = canvas(S);
  const n = makeNoise(81);
  const rnd = mulberry32(82);
  const rows = 16, rh = S / rows;
  const shades = Array.from({ length: rows }, () => rnd());
  pixels(g, S, S, (x, y, o) => {
    const r = Math.floor(y / rh);
    if (y - r * rh < 2) { o[0] = 40; o[1] = 33; o[2] = 28; return; }
    const gr = fbm(n, (x / S) * 4, (y / S) * 64, 4, 64, 3);
    const v = 158 + shades[r] * 26 + (gr - 0.5) * 40;
    o[0] = v; o[1] = v * 0.88; o[2] = v * 0.76;
  });
  return toTexture(c, 2.0);
}

export function concrete() {
  const S = 256;
  const [c, g] = canvas(S);
  const n = makeNoise(91);
  const rnd = mulberry32(92);
  pixels(g, S, S, (x, y, o) => {
    const v = fbm(n, (x / S) * 8, (y / S) * 8, 8, 8, 4);
    const f = n((x / S) * 64, (y / S) * 64, 64, 64);
    const val = 184 + (v - 0.5) * 34 + (f - 0.5) * 14;
    o[0] = val; o[1] = val - 1; o[2] = val - 4;
  });
  for (let i = 0; i < 300; i++) {
    g.fillStyle = `rgba(90,90,90,${0.2 + rnd() * 0.3})`;
    g.beginPath();
    g.arc(rnd() * S, rnd() * S, 0.4 + rnd() * 1.1, 0, Math.PI * 2);
    g.fill();
  }
  return toTexture(c, 1.5);
}

export function sedum() {
  const S = 256;
  const [c, g] = canvas(S);
  const rnd = mulberry32(101);
  const n = makeNoise(102);
  pixels(g, S, S, (x, y, o) => {
    const v = fbm(n, (x / S) * 6, (y / S) * 6, 6, 6, 3);
    o[0] = 92 + v * 60; o[1] = 116 + v * 40; o[2] = 50 + v * 10;
  });
  for (let i = 0; i < 3000; i++) {
    const t = rnd();
    g.fillStyle = t < 0.5
      ? `rgba(${140 + rnd() * 50},${160 + rnd() * 40},70,0.8)`
      : t < 0.82 ? `rgba(70,${100 + rnd() * 30},40,0.8)` : `rgba(${170 + rnd() * 50},${80 + rnd() * 30},60,0.75)`;
    g.beginPath();
    g.arc(rnd() * S, rnd() * S, 1 + rnd() * 1.6, 0, Math.PI * 2);
    g.fill();
  }
  return toTexture(c, 1);
}

export function bark() {
  const S = 256;
  const [c, g] = canvas(S);
  const n = makeNoise(111);
  pixels(g, S, S, (x, y, o) => {
    const v = fbm(n, (x / S) * 3, (y / S) * 16, 3, 16, 4);
    const r = Math.abs(Math.sin(v * 20));
    const val = 92 + r * 48 + (v - 0.5) * 30;
    o[0] = val; o[1] = val * 0.86; o[2] = val * 0.74;
  });
  const t = toTexture(c, 1);
  t.repeat.set(3, 2);
  return t;
}

// White maple leaf on transparent; instance colors tint it.
export function mapleLeaf() {
  const S = 128;
  const [c, g] = canvas(S);
  g.clearRect(0, 0, S, S);
  g.translate(S / 2, S * 0.56);
  const R = S * 0.95;
  const pt = (deg, r) => {
    const a = (deg * Math.PI) / 180;
    g.lineTo(R * r * Math.sin(a), -R * r * Math.cos(a));
  };
  const L = [[-118, 0.27], [-74, 0.41], [-37, 0.45], [0, 0.48], [37, 0.45], [74, 0.41], [118, 0.27]];
  g.beginPath();
  g.moveTo(0, R * 0.05);
  pt(-150, 0.13);
  for (let i = 0; i < L.length; i++) {
    const [a, r] = L[i];
    if (i > 0) {
      const sa = (L[i - 1][0] + a) / 2;
      pt(sa, 0.15 + 0.03 * Math.cos((sa * Math.PI) / 180));
    }
    pt(a - 11, r * 0.66);
    pt(a - 6, r * 0.78);
    pt(a - 7, r * 0.86);
    pt(a, r);
    pt(a + 7, r * 0.86);
    pt(a + 6, r * 0.78);
    pt(a + 11, r * 0.66);
  }
  pt(150, 0.13);
  g.closePath();
  g.fillStyle = '#ffffff';
  g.fill();
  g.strokeStyle = 'rgba(214,214,214,1)';
  g.lineWidth = 1.3;
  for (const [a, r] of L) {
    g.beginPath();
    g.moveTo(0, 0);
    const rad = (a * Math.PI) / 180;
    g.lineTo(R * r * 0.84 * Math.sin(rad), -R * r * 0.84 * Math.cos(rad));
    g.stroke();
  }
  g.strokeStyle = '#ffffff';
  g.lineWidth = 2.4;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(0, S * 0.36);
  g.stroke();
  return toTexture(c, 1, { tile: false });
}

export function blob() {
  const S = 128;
  const [c, g] = canvas(S);
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, 'rgba(0,0,0,0.6)');
  grd.addColorStop(0.45, 'rgba(0,0,0,0.3)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  return toTexture(c, 1, { tile: false });
}

export function softDot() {
  const S = 64;
  const [c, g] = canvas(S);
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  return toTexture(c, 1, { tile: false });
}

export function waterNormal() {
  const S = 256;
  const [c, g] = canvas(S);
  const n = makeNoise(121);
  const h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) h[y * S + x] = fbm(n, (x / S) * 6, (y / S) * 6, 6, 6, 4);
  }
  pixels(g, S, S, (x, y, o) => {
    const xl = h[y * S + ((x - 1 + S) % S)], xr = h[y * S + ((x + 1) % S)];
    const yu = h[((y - 1 + S) % S) * S + x], yd = h[((y + 1) % S) * S + x];
    let nx = (xl - xr) * 14, ny = (yu - yd) * 14, nz = 1;
    const l = Math.hypot(nx, ny, nz);
    nx /= l; ny /= l; nz /= l;
    o[0] = (nx * 0.5 + 0.5) * 255; o[1] = (ny * 0.5 + 0.5) * 255; o[2] = (nz * 0.5 + 0.5) * 255;
  });
  return toTexture(c, 1.5, { srgb: false });
}

export function pvPanel() {
  const W = 256, Hh = 416;
  const [c, g] = canvas(W, Hh);
  g.fillStyle = '#c3c7cc';
  g.fillRect(0, 0, W, Hh);
  const m = 6, cols = 6, rows = 10;
  const cw = (W - m * 2) / cols, ch = (Hh - m * 2) / rows;
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < cols; k++) {
      const x = m + k * cw, y = m + r * ch;
      const grd = g.createLinearGradient(x, y, x + cw, y + ch);
      grd.addColorStop(0, '#22304d');
      grd.addColorStop(1, '#172139');
      g.fillStyle = grd;
      g.fillRect(x + 0.8, y + 0.8, cw - 1.6, ch - 1.6);
      g.strokeStyle = 'rgba(180,190,210,0.25)';
      g.lineWidth = 0.6;
      g.beginPath();
      for (let i = 1; i < 3; i++) {
        g.moveTo(x + (cw * i) / 3, y + 1);
        g.lineTo(x + (cw * i) / 3, y + ch - 1);
      }
      g.stroke();
    }
  }
  return toTexture(c, 1, { tile: false });
}

function diamond(g, cx, cy, w, h, col) {
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(cx, cy - h);
  g.lineTo(cx + w, cy);
  g.lineTo(cx, cy + h);
  g.lineTo(cx - w, cy);
  g.closePath();
  g.fill();
}

function fiberNoise(g, W, Hh, seed, amt = 18) {
  const img = g.getImageData(0, 0, W, Hh);
  const d = img.data;
  const rnd = mulberry32(seed);
  for (let i = 0; i < d.length; i += 4) {
    const v = (rnd() - 0.5) * amt;
    d[i] += v; d[i + 1] += v; d[i + 2] += v;
  }
  g.putImageData(img, 0, 0);
}

export function rugKilim() {
  const W = 512, Hh = 360;
  const [c, g] = canvas(W, Hh);
  g.fillStyle = '#e7dccb';
  g.fillRect(0, 0, W, Hh);
  g.fillStyle = '#a4573a';
  g.fillRect(0, 0, W, 22); g.fillRect(0, Hh - 22, W, 22); g.fillRect(0, 0, 22, Hh); g.fillRect(W - 22, 0, 22, Hh);
  g.fillStyle = '#2d4b78';
  g.fillRect(30, 30, W - 60, 8); g.fillRect(30, Hh - 38, W - 60, 8);
  for (let i = 0; i < 5; i++) {
    const cx = 72 + i * 92, cy = Hh / 2;
    diamond(g, cx, cy, 40, 88, '#2d4b78');
    diamond(g, cx, cy, 26, 58, '#e7dccb');
    diamond(g, cx, cy, 12, 28, '#c07443');
  }
  for (let x = 36; x < W - 36; x += 16) {
    diamond(g, x + 8, 54, 6, 8, '#c07443');
    diamond(g, x + 8, Hh - 54, 6, 8, '#c07443');
  }
  fiberNoise(g, W, Hh, 5, 22);
  return toTexture(c, 1, { tile: false });
}

export function rugStripe() {
  const W = 512, Hh = 340;
  const [c, g] = canvas(W, Hh);
  const cols = ['#d9d2c4', '#d9d2c4', '#3a5a88', '#d9d2c4', '#b9ad96', '#d9d2c4'];
  for (let x = 0, i = 0; x < W; i++) {
    const w = 18 + ((i * 37) % 5) * 10;
    g.fillStyle = cols[i % cols.length];
    g.fillRect(x, 0, w, Hh);
    x += w;
  }
  fiberNoise(g, W, Hh, 9, 26);
  return toTexture(c, 1, { tile: false });
}

export function painting(kind) {
  const W = 256, Hh = 320;
  const [c, g] = canvas(W, Hh);
  if (kind === 0) {
    g.fillStyle = '#efe6d6'; g.fillRect(0, 0, W, Hh);
    g.fillStyle = '#d9824f'; g.beginPath(); g.arc(W * 0.5, Hh * 0.42, 62, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2d4b78'; g.fillRect(0, Hh * 0.62, W, 10);
    g.fillStyle = '#5a7f58'; g.fillRect(0, Hh * 0.7, W, 18);
    g.fillStyle = '#3d3a36'; g.fillRect(0, Hh * 0.82, W, 6);
  } else if (kind === 1) {
    g.fillStyle = '#f1efe9'; g.fillRect(0, 0, W, Hh);
    const blocks = [[20, 30, 120, 150, '#c9a646'], [150, 30, 86, 80, '#2d4b78'], [150, 120, 86, 150, '#e3ddd1'], [20, 190, 120, 100, '#b85f3c']];
    for (const [x, y, w, h, col] of blocks) { g.fillStyle = col; g.fillRect(x, y, w, h); }
  } else {
    g.fillStyle = '#e9ede6'; g.fillRect(0, 0, W, Hh);
    g.strokeStyle = '#3e5d3b'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(W * 0.5, Hh * 0.9); g.bezierCurveTo(W * 0.45, Hh * 0.6, W * 0.62, Hh * 0.35, W * 0.5, Hh * 0.1); g.stroke();
    for (let i = 0; i < 7; i++) {
      const t = 0.2 + i * 0.1, y = Hh * (0.9 - t * 0.85), s = i % 2 ? 1 : -1;
      g.beginPath(); g.ellipse(W * 0.5 + s * 30, y, 30, 10, s * 0.5, 0, Math.PI * 2);
      g.fillStyle = `rgba(90,127,88,${0.55 + i * 0.05})`; g.fill();
    }
  }
  return toTexture(c, 1, { tile: false });
}

export function noren(text) {
  const W = 256, Hh = 256;
  const [c, g] = canvas(W, Hh);
  g.fillStyle = '#2d4468';
  g.fillRect(0, 0, W, Hh);
  g.fillStyle = 'rgba(255,255,255,0.1)';
  g.fillRect(W / 2 - 2, 60, 4, Hh);
  if (text) {
    g.fillStyle = '#f4f1ea';
    g.font = 'bold 120px "Hiragino Mincho ProN", "Yu Mincho", serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, W / 2, Hh * 0.52);
  }
  fiberNoise(g, W, Hh, 13, 14);
  return toTexture(c, 1, { tile: false });
}

// The study whiteboard shows a sketch of this very house.
export function whiteboard(walls) {
  const W = 1024, Hh = 512;
  const [c, g] = canvas(W, Hh);
  g.fillStyle = '#f5f6f3';
  g.fillRect(0, 0, W, Hh);
  const sx = (x) => 110 + (x + 9.5) * 22;
  const sz = (z) => 70 + (z + 7.5) * 22;
  g.strokeStyle = '#2b4f8c';
  g.lineCap = 'round';
  for (const w of walls) {
    g.lineWidth = w.kind === 'ext' ? 4 : 2;
    g.beginPath();
    if (w.axis === 'x') { g.moveTo(sx(w.from), sz(w.at)); g.lineTo(sx(w.to), sz(w.at)); }
    else { g.moveTo(sx(w.at), sz(w.from)); g.lineTo(sx(w.at), sz(w.to)); }
    g.stroke();
  }
  g.fillStyle = 'rgba(77,119,67,0.25)';
  g.fillRect(sx(-4), sz(-2.2), 8 * 22, 4.4 * 22);
  g.fillStyle = '#2b2b2b';
  g.font = 'bold 30px sans-serif';
  g.fillText('ふたりの家 v3', 560, 96);
  g.font = '22px sans-serif';
  const lines = ['・段差ゼロ（平屋）', '・回遊動線 1.2m', '・排熱 → 給湯', '・寝室 ↔ ドック 対角', '・湿度 45〜50%'];
  lines.forEach((t, i) => g.fillText(t, 580, 150 + i * 40));
  g.strokeStyle = '#c4613b';
  g.lineWidth = 3;
  g.beginPath(); g.arc(sx(7.2), sz(4.6), 34, 0, Math.PI * 2); g.stroke();
  const notes = [[840, 330, '#f3d46b'], [900, 380, '#f2a8a0'], [780, 400, '#a8d2f0']];
  for (const [x, y, col] of notes) {
    g.fillStyle = col;
    g.fillRect(x, y, 90, 80);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    for (let i = 0; i < 3; i++) g.fillRect(x + 12, y + 18 + i * 18, 60 - i * 12, 3);
  }
  return toTexture(c, 1, { tile: false });
}
