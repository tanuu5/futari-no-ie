// Time of day: sun and moon positions (Tokyo, late September), a shader sky with stars,
// image-based lighting regenerated from that sky, and the house lamps.
import * as THREE from 'three';
import { clamp, damp, smoothstep, lerp } from './util.js';

const DEG = Math.PI / 180;
const LAT = 35.7 * DEG;
const SUN_DEC = -1.2 * DEG; // a few days after the autumn equinox
const MOON_DEC = 2.0 * DEG;
const SOLAR_NOON = 11.65; // hours, local clock

export function celestial(minute, offsetHours = 0, dec = SUN_DEC, out = new THREE.Vector3()) {
  const H = (minute / 60 - SOLAR_NOON - offsetHours) * 15 * DEG;
  const sinAlt = Math.sin(LAT) * Math.sin(dec) + Math.cos(LAT) * Math.cos(dec) * Math.cos(H);
  const alt = Math.asin(clamp(sinAlt, -1, 1));
  const cosAz = (Math.sin(dec) - sinAlt * Math.sin(LAT)) / (Math.max(1e-4, Math.cos(alt)) * Math.cos(LAT));
  let az = Math.acos(clamp(cosAz, -1, 1));
  if (Math.sin(H) > 0) az = Math.PI * 2 - az;
  const dir = out.set(Math.sin(az) * Math.cos(alt), Math.sin(alt), -Math.cos(az) * Math.cos(alt));
  return { alt: alt / DEG, az: az / DEG, dir };
}
export const sunAt = (m, out) => celestial(m, 0, SUN_DEC, out);
export const moonAt = (m, out) => celestial(m, 12.75, MOON_DEC, out);

const C = (hex) => new THREE.Color(hex);
// Keyframes by sun altitude (degrees). Colors are converted to linear by THREE.Color.
const KEYS = [
  { a: -18, top: '#060b1c', hor: '#101a36', bot: '#060812', hs: '#2e4476', hg: '#14161f', hi: 0.62, ei: 0.2, ex: 1.35 },
  { a: -8, top: '#0e1a3c', hor: '#2a3764', bot: '#0c1020', hs: '#3a5186', hg: '#191820', hi: 0.6, ei: 0.22, ex: 1.25 },
  { a: -3, top: '#223164', hor: '#b86a5a', bot: '#1f1824', hs: '#5b6894', hg: '#3d2d28', hi: 0.62, ei: 0.3, ex: 1.14 },
  { a: 2, top: '#3b5a94', hor: '#eea06a', bot: '#473631', hs: '#8f9fc6', hg: '#74553f', hi: 0.64, ei: 0.44, ex: 1.08 },
  { a: 10, top: '#5680bb', hor: '#f0cda0', bot: '#716a62', hs: '#a4bcdc', hg: '#86705a', hi: 0.62, ei: 0.5, ex: 1.02 },
  { a: 25, top: '#6799d0', hor: '#d6e3eb', bot: '#949d98', hs: '#b9d0e8', hg: '#978470', hi: 0.6, ei: 0.55, ex: 1.0 },
  { a: 60, top: '#6597d3', hor: '#dde8ee', bot: '#a1aaa5', hs: '#c2d7ec', hg: '#a08d75', hi: 0.64, ei: 0.6, ex: 1.0 },
].map((k) => ({ ...k, top: C(k.top), hor: C(k.hor), bot: C(k.bot), hs: C(k.hs), hg: C(k.hg) }));

// Indoors the "sky" is a warm white ceiling: ambient light is biased toward it by day.
const WARM = C('#f3e8d8');
const WARM_GROUND = C('#b9926b');

const SUN_COLORS = [[-2, C('#ff6a3a')], [3, C('#ff9656')], [8, C('#ffbe86')], [18, C('#ffe0bb')], [35, C('#fff2e0')], [90, C('#fff6ea')]];

// Interpolated keyframe, written into a reused object (called every frame).
const KEY_OUT = { top: new THREE.Color(), hor: new THREE.Color(), bot: new THREE.Color(), hs: new THREE.Color(), hg: new THREE.Color(), hi: 0, ei: 0, ex: 1 };
function sampleKeys(alt) {
  const o = KEY_OUT;
  let A = KEYS[KEYS.length - 1], B = A, t = 0;
  if (alt <= KEYS[0].a) { A = B = KEYS[0]; }
  else {
    for (let i = 0; i < KEYS.length - 1; i++) {
      if (alt <= KEYS[i + 1].a) { A = KEYS[i]; B = KEYS[i + 1]; t = (alt - A.a) / (B.a - A.a); break; }
    }
  }
  o.top.lerpColors(A.top, B.top, t); o.hor.lerpColors(A.hor, B.hor, t); o.bot.lerpColors(A.bot, B.bot, t);
  o.hs.lerpColors(A.hs, B.hs, t); o.hg.lerpColors(A.hg, B.hg, t);
  o.hi = lerp(A.hi, B.hi, t); o.ei = lerp(A.ei, B.ei, t); o.ex = lerp(A.ex, B.ex, t);
  return o;
}

function sunColor(alt, out) {
  for (let i = 0; i < SUN_COLORS.length - 1; i++) {
    const [a0, c0] = SUN_COLORS[i], [a1, c1] = SUN_COLORS[i + 1];
    if (alt <= a1) return out.lerpColors(c0, c1, clamp((alt - a0) / (a1 - a0)));
  }
  return out.copy(SUN_COLORS[SUN_COLORS.length - 1][1]);
}

const skyVert = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * wp;
    gl_Position.z = gl_Position.w * 0.99999;
  }`;
const skyFrag = /* glsl */ `
  uniform vec3 uTop, uHor, uBot, uSunDir, uMoonDir, uSunCol, uBounce;
  uniform float uSunVis, uMoonVis, uStars, uTime, uEnv;
  varying vec3 vDir;
  float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = h > 0.0 ? mix(uHor, uTop, pow(smoothstep(0.0, 0.85, h), 0.6)) : mix(uHor, uBot, 1.0 - smoothstep(-0.25, 0.0, h));
    float sd = max(dot(d, uSunDir), 0.0);
    col += uSunCol * (pow(sd, 6.0) * 0.18 + pow(sd, 48.0) * 0.35) * uSunVis * (1.0 - 0.6 * smoothstep(0.1, 0.6, h));
    if (uEnv > 0.5) {
      // environment only: warm bounce from the ground and walls
      col = mix(col, uBounce, (1.0 - smoothstep(-0.35, 0.02, h)) * 0.85);
    } else {
      col += uSunCol * pow(sd, 1400.0) * 40.0 * uSunVis;
      float md = max(dot(d, uMoonDir), 0.0);
      col += vec3(1.0, 0.95, 0.84) * (smoothstep(0.99962, 0.99972, md) * 2.6 + pow(md, 90.0) * 0.1) * uMoonVis;
      if (uStars > 0.0 && h > 0.0) {
        vec3 g = d * 420.0;
        vec3 cell = floor(g);
        float s = hash(cell);
        vec3 f = fract(g) - 0.5;
        float star = step(0.9965, s) * (1.0 - smoothstep(0.05, 0.5, length(f)));
        float tw = 0.65 + 0.35 * sin(uTime * (1.0 + s * 3.0) + s * 60.0);
        col += vec3(0.9, 0.95, 1.0) * star * tw * uStars * smoothstep(0.02, 0.3, h) * 2.2;
      }
    }
    gl_FragColor = vec4(col, 1.0);
  }`;

function makeSky(env) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: skyVert,
    fragmentShader: skyFrag,
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uBot: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunCol: { value: new THREE.Color() }, uBounce: { value: new THREE.Color() },
      uSunVis: { value: 1 }, uMoonVis: { value: 0 }, uStars: { value: 0 }, uTime: { value: 0 }, uEnv: { value: env ? 1 : 0 },
    },
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(env ? 50 : 400, 48, 24), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -100;
  mesh.userData.noAO = true;
  return mesh;
}

export class Lighting {
  constructor(scene, renderer, quality) {
    this.scene = scene;
    this.renderer = renderer;
    this.sky = makeSky(false);
    scene.add(this.sky);
    this.envScene = new THREE.Scene();
    this.envSky = makeSky(true);
    this.envScene.add(this.envSky);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    // the sky is rendered into a small cube map and filtered into one reused PMREM target
    this.cubeRT = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType });
    this.cubeCam = new THREE.CubeCamera(0.1, 100, this.cubeRT);
    this.envRT = null;
    this.lastEnvMinute = -999;
    this.envClock = 1;
    this._sunDir = new THREE.Vector3();
    this._moonDir = new THREE.Vector3();
    this._sunCol = new THREE.Color();
    this._haze = new THREE.Color();

    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    const s = this.sun.shadow;
    s.mapSize.set(quality === 'low' ? 2048 : 4096, quality === 'low' ? 2048 : 4096);
    s.camera.left = -17; s.camera.right = 17; s.camera.top = 17; s.camera.bottom = -17;
    s.camera.near = 1; s.camera.far = 90;
    s.bias = -0.0004;
    s.normalBias = 0.03;
    s.radius = quality === 'low' ? 2 : 4;
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbfd6ea, 0x9c8b77, 0.7);
    scene.add(this.hemi);

    this.lamps = new Map();
    this.state = {};
  }

  addLamp(spec) {
    const light = new THREE.PointLight(spec.color, 0, spec.distance, 2);
    light.position.copy(spec.pos);
    light.castShadow = false;
    this.scene.add(light);
    this.lamps.set(spec.id, { ...spec, light, level: 0, want: 0 });
  }

  addSpot(id, pos, target, { color = 0xffc98a, power = 30, distance = 9, angle = 0.55 } = {}) {
    const light = new THREE.SpotLight(color, 0, distance, angle, 0.6, 1.6);
    light.position.copy(pos);
    light.target.position.copy(target);
    this.scene.add(light, light.target);
    this.lamps.set(id, { id, power, light, mats: [], level: 0, want: 0 });
  }

  setLamp(id, on) {
    const l = this.lamps.get(id);
    if (l) l.want = on ? 1 : 0;
  }

  setQuality(q) {
    const s = this.sun.shadow;
    const size = q === 'low' ? 2048 : 4096;
    if (s.mapSize.x !== size) {
      s.mapSize.set(size, size);
      if (s.map) { s.map.dispose(); s.map = null; }
    }
    s.radius = q === 'low' ? 2 : 4;
  }

  update(minute, dt, t, { force = false } = {}) {
    const sun = sunAt(minute, this._sunDir);
    const moon = moonAt(minute, this._moonDir);
    const k = sampleKeys(sun.alt);
    const sc = sunColor(sun.alt, this._sunCol);
    const dayF = smoothstep(-1, 12, sun.alt);
    const nightF = 1 - smoothstep(-9, 1, sun.alt);
    const moonUp = smoothstep(-2, 12, moon.alt);

    // directional light: the sun by day, the moon by night
    const useSun = sun.alt > -3;
    const dir = useSun ? sun.dir : moon.dir;
    this.sun.position.copy(dir).multiplyScalar(40);
    this.sun.target.position.set(0, 0, 0);
    if (useSun) {
      this.sun.color.copy(sc);
      this.sun.intensity = 4.0 * dayF;
    } else {
      this.sun.color.set(0x9fb2ff);
      this.sun.intensity = 0.95 * moonUp * nightF;
    }
    const warmK = 0.6 * dayF;
    this.hemi.color.copy(k.hs).lerp(WARM, warmK);
    this.hemi.groundColor.copy(k.hg).lerp(WARM_GROUND, warmK * 0.8);
    this.hemi.intensity = k.hi;
    this.renderer.toneMappingExposure = k.ex;

    // the visible backdrop below the horizon stays light and hazy so the diorama floats in air
    const haze = this._haze.lerpColors(k.hor, k.top, 0.35).multiplyScalar(0.92);
    for (const u of [this.sky.material.uniforms, this.envSky.material.uniforms]) {
      const env = u === this.envSky.material.uniforms;
      u.uTop.value.copy(k.top);
      u.uHor.value.copy(k.hor);
      u.uBot.value.copy(haze);
      if (env) {
        u.uTop.value.lerp(WARM, warmK * 0.75);
        u.uHor.value.lerp(WARM, warmK * 0.5);
      }
      u.uSunDir.value.copy(sun.dir);
      u.uMoonDir.value.copy(moon.dir);
      u.uSunCol.value.copy(sc);
      u.uSunVis.value = smoothstep(-4, 2, sun.alt);
      u.uMoonVis.value = moonUp * (0.35 + 0.65 * nightF);
      u.uStars.value = smoothstep(-5, -13, sun.alt);
      u.uTime.value = t;
      u.uBounce.value.copy(k.hg).lerp(WARM_GROUND, warmK).multiplyScalar(1.1);
    }
    this.scene.environmentIntensity = k.ei;

    // Regenerate the environment map when the light has changed enough: at most ~3×/s while
    // playing and ~10×/s while scrubbing. The PMREM target is reused, so nothing is allocated.
    this.envClock += dt;
    const due = Math.abs(minute - this.lastEnvMinute) > 6;
    if (!this.envRT || (force && this.envClock > 0.1) || (due && this.envClock > 0.33)) {
      this.envClock = 0;
      this.cubeCam.update(this.renderer, this.envScene);
      this.envRT = this.pmrem.fromCubemap(this.cubeRT.texture, this.envRT);
      this.scene.environment = this.envRT.texture;
      this.lastEnvMinute = minute;
    }

    // lamps
    for (const l of this.lamps.values()) {
      l.level = damp(l.level, l.want, 3.5, dt);
      if (l.level < 0.002) l.level = 0;
      l.light.intensity = l.power * l.level * 1.6;
      for (const m of l.mats || []) m.emissiveIntensity = (l.glowK ?? 1.1) * l.level;
      if (l.bulbMat) l.bulbMat.emissiveIntensity = 3.5 * l.level;
    }

    this.state = { sunAlt: sun.alt, moonAlt: moon.alt, dayF, nightF, darkness: 1 - smoothstep(-2, 10, sun.alt) };
    return this.state;
  }
}
