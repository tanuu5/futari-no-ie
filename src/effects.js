// Post-processing chain and small particle systems (steam, fireflies, falling leaves).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { mulberry32, clamp, lerp } from './util.js';

// GTAO that skips the invisible shadow proxy, glass, water, foliage and the sky.
class AOPass extends GTAOPass {
  _overrideVisibility() {
    super._overrideVisibility();
    const cache = this._visibilityCache;
    this.scene.traverse((o) => {
      if (!o.visible) return;
      const m = o.material;
      if (o.userData.noAO || (m && !Array.isArray(m) && m.transparent)) {
        o.visible = false;
        cache.push(o);
      }
    });
  }
}

// NaN / Inf guard. One bad half-float pixel is enough to turn a whole block of the screen
// black once the bloom blurs and downsamples it, and some GPUs produce such pixels at grazing
// angles. Bit tests are used instead of isnan(), which fast-math compilers may optimise away.
const GUARD_GLSL = /* glsl */ `
  bool badFloat(float x) { return (floatBitsToUint(x) & 0x7f800000u) == 0x7f800000u; }
  bool badVec(vec3 v) { return badFloat(v.x) || badFloat(v.y) || badFloat(v.z); }
  vec3 safeNormalize(vec3 v) { float l = length(v); return l > 1e-6 ? v / l : vec3(0.0, 0.0, 1.0); }
`;

const GuardShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    ${GUARD_GLSL}
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      if (badVec(c.rgb) || badFloat(c.a)) c = vec4(0.0, 0.0, 0.0, 1.0);
      gl_FragColor = vec4(min(c.rgb, vec3(64.0)), c.a);
    }`,
};

// Make three's GTAO robust against rounding: clamp cosines before sqrt/acos, avoid normalising
// zero vectors, and never output NaN. Falls back to the guard pass if the source ever changes.
function hardenShader(material, edits, label) {
  let src = material.fragmentShader;
  let applied = 0;
  for (const [from, to] of edits) {
    if (src.includes(from)) { src = src.split(from).join(to); applied++; }
  }
  if (applied < edits.length) console.warn(`[fx] ${label}: ${applied}/${edits.length} safety edits applied`);
  material.fragmentShader = src.replace('void main() {', `${GUARD_GLSL}\n\t\tvoid main() {`);
  material.needsUpdate = true;
}

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    uRes: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uTilt: { value: 1 },
    uFocus: { value: 0.5 },
    uBand: { value: 0.16 },
    uPx: { value: 1 },
    uVignette: { value: 0.28 },
    uGrain: { value: 0.022 },
    uNight: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uRes;
    uniform float uTime, uTilt, uFocus, uBand, uPx, uVignette, uGrain, uNight;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 uv = vUv;
      vec3 col = texture2D(tDiffuse, uv).rgb;
      float d = max(0.0, abs(uv.y - uFocus) - uBand);
      float amt = clamp(d / 0.34, 0.0, 1.0) * uTilt;
      if (amt > 0.003) {
        vec3 acc = col;
        float w = 1.0;
        float rad = amt * 6.5 * uPx;
        float rot = hash(uv * uRes) * 6.2831;
        for (int i = 0; i < 14; i++) {
          float fi = float(i);
          float a = fi * 2.39996323 + rot;
          float r = sqrt((fi + 0.5) / 14.0) * rad;
          acc += texture2D(tDiffuse, uv + vec2(cos(a), sin(a)) * r / uRes).rgb;
          w += 1.0;
        }
        col = acc / w;
      }
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      // night: shadows lose their colour like real scotopic vision; lamp-lit areas keep it
      float nightMix = uNight * (1.0 - smoothstep(0.08, 0.45, l));
      col = mix(col, vec3(l) * vec3(0.9, 0.97, 1.12), nightMix * 0.55);
      col = mix(col, col * vec3(1.035, 1.0, 0.955), smoothstep(0.35, 1.0, l));
      col = col * 0.985 + 0.01;
      vec2 q = uv - 0.5;
      q.x *= uRes.x / uRes.y;
      col *= 1.0 - uVignette * smoothstep(0.4, 1.15, length(q));
      col += (hash(uv * uRes + fract(uTime) * 91.0) - 0.5) * uGrain;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export class PostFX {
  constructor(renderer, scene, camera, quality) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: quality === 'low' ? 0 : 4 });
    this.composer = new EffectComposer(renderer, rt);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);
    this.ao = new AOPass(scene, camera, size.x, size.y);
    this.ao.updateGtaoMaterial({ radius: 0.55, distanceExponent: 1.4, thickness: 1.2, scale: 1.15, samples: 16, distanceFallOff: 1 });
    this.ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    this.ao.blendIntensity = 1.0;
    hardenShader(this.ao.gtaoMaterial, [
      ['normalize(viewDelta)', 'safeNormalize(viewDelta)'],
      ['vec3 normalInSlice = normalize(', 'vec3 normalInSlice = safeNormalize('],
      ['vec2 sinHorizons = sqrt(1. - cosHorizons * cosHorizons);',
        'cosHorizons = clamp(cosHorizons, -1., 1.);\n\t\t\t\tvec2 sinHorizons = sqrt(max(vec2(0.), 1. - cosHorizons * cosHorizons));'],
      ['ao = pow(ao, scale);', 'ao = pow(ao, scale);\n\t\t\tif (badFloat(ao)) ao = 1.0;'],
    ], 'GTAO');
    hardenShader(this.ao.pdMaterial, [
      ['denoised /= totalWeight;\n\t\t\t}', 'denoised /= totalWeight;\n\t\t\t}\n\t\t\tif (badVec(denoised)) denoised = vec3(1.0);'],
    ], 'AO denoise');
    this.composer.addPass(this.ao);
    // scrub NaN / Inf before anything blurs the image
    this.composer.addPass(new ShaderPass(GuardShader));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.36, 0.55, 0.95);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.final = new ShaderPass(FinalShader);
    this.composer.addPass(this.final);
    this.setQuality(quality);
  }

  setQuality(q) {
    this.quality = q;
    const samples = q === 'low' ? 0 : 4;
    for (const rt of [this.composer.renderTarget1, this.composer.renderTarget2]) {
      if (rt.samples !== samples) { rt.samples = samples; rt.dispose(); }
    }
    this.ao.enabled = q === 'high';
    this.bloom.strength = q === 'high' ? 0.36 : 0.28;
  }

  setSize(w, h, pr) {
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.final.uniforms.uRes.value.set(w * pr, h * pr);
    this.final.uniforms.uPx.value = pr;
  }

  render(dt, t, tilt, night = 0) {
    this.final.uniforms.uNight.value = night;
    this.final.uniforms.uTime.value = t;
    this.final.uniforms.uTilt.value = tilt;
    this.composer.render(dt);
  }
}

// ---------------- particles ----------------
const pointVert = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  varying float vAlpha;
  uniform float uScale;
  void main() {
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;
const pointFrag = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    float a = texture2D(uMap, gl_PointCoord).a * vAlpha;
    if (a < 0.003) discard;
    gl_FragColor = vec4(uColor, a);
  }`;

class PointCloud {
  constructor(n, tex, color, additive) {
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.size = new Float32Array(n);
    this.alpha = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: pointVert,
      fragmentShader: pointFrag,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uMap: { value: tex }, uColor: { value: new THREE.Color(color) }, uScale: { value: 400 } },
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.userData.noAO = true;
  }
  flush() {
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
    g.attributes.aAlpha.needsUpdate = true;
  }
}

export class Particles {
  constructor(scene, T, maple) {
    this.rnd = mulberry32(99);
    // steam
    this.steam = new PointCloud(90, T.dot, 0xf4f1ec, false);
    this.steamP = Array.from({ length: 90 }, () => ({ life: 0, max: 1, x: 0, y: -99, z: 0, vx: 0, vz: 0, s: 0 }));
    this.emitters = { pot: { pos: new THREE.Vector3(), on: false, rate: 10, acc: 0 }, bath: { pos: new THREE.Vector3(), on: false, rate: 14, acc: 0 }, mug: { pos: new THREE.Vector3(), on: false, rate: 4, acc: 0 } };
    scene.add(this.steam.points);
    // fireflies
    this.flies = new PointCloud(34, T.dot, 0xd8ff8a, true);
    this.flyP = Array.from({ length: 34 }, (_, i) => {
      const inCourt = i < 20;
      return {
        cx: inCourt ? -3.6 + this.rnd() * 6.8 : -12 + this.rnd() * 24,
        cz: inCourt ? -0.8 + this.rnd() * 2.8 : 8 + this.rnd() * 4.5,
        cy: inCourt ? 0.1 + this.rnd() * 1.4 : 0.2 + this.rnd() * 1.2,
        ph: this.rnd() * 100, sp: 0.3 + this.rnd() * 0.5,
      };
    });
    this.flies.mat.uniforms.uColor.value.setRGB(2.2, 3.0, 1.0);
    scene.add(this.flies.points);
    // falling maple leaves
    this.leafClusters = maple.clusters;
    const leafGeo = new THREE.PlaneGeometry(0.1, 0.1);
    const leafMat = new THREE.MeshStandardMaterial({ map: T.leaf, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 });
    this.leaves = new THREE.InstancedMesh(leafGeo, leafMat, 14);
    this.leafP = Array.from({ length: 14 }, (_, i) => this.spawnLeaf({ t: -this.rnd() * 20 - i }));
    const cols = ['#d9a53d', '#df8a33', '#cf5a2c', '#b9b44c', '#c4502d'].map((c) => new THREE.Color(c));
    for (let i = 0; i < 14; i++) this.leaves.setColorAt(i, cols[i % cols.length]);
    this.leaves.instanceColor.needsUpdate = true;
    this.leaves.castShadow = true;
    this.leaves.userData.noAO = true;
    this.leaves.frustumCulled = false;
    scene.add(this.leaves);
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._s = new THREE.Vector3();
    this._p = new THREE.Vector3();
  }

  spawnLeaf(o = {}) {
    const c = this.leafClusters[Math.floor(this.rnd() * this.leafClusters.length)];
    return {
      x: c.x + (this.rnd() - 0.5) * 0.6, y: c.y, z: c.z + (this.rnd() - 0.5) * 0.6,
      t: o.t ?? 0, fall: 0.18 + this.rnd() * 0.12, sway: 0.3 + this.rnd() * 0.4, ph: this.rnd() * 6, rest: 0,
    };
  }

  setScale(px) {
    for (const pc of [this.steam, this.flies]) pc.mat.uniforms.uScale.value = px;
  }

  update(dt, t, night) {
    const r = this.rnd;
    // steam
    for (const e of Object.values(this.emitters)) {
      if (!e.on) continue;
      e.acc += dt * e.rate;
      while (e.acc > 1) {
        e.acc -= 1;
        const p = this.steamP.find((q) => q.life <= 0);
        if (!p) break;
        p.x = e.pos.x + (r() - 0.5) * (e === this.emitters.bath ? 0.8 : 0.08);
        p.z = e.pos.z + (r() - 0.5) * (e === this.emitters.bath ? 1.1 : 0.08);
        p.y = e.pos.y;
        p.vx = (r() - 0.5) * 0.05; p.vz = (r() - 0.5) * 0.05;
        p.max = 2 + r() * 1.6; p.life = p.max;
        p.s = e === this.emitters.mug ? 0.06 : 0.16 + r() * 0.12;
      }
    }
    this.steamP.forEach((p, i) => {
      if (p.life > 0) {
        p.life -= dt;
        p.y += dt * 0.22;
        p.x += p.vx * dt + Math.sin(t * 1.3 + i) * 0.02 * dt;
        p.z += p.vz * dt;
      }
      const k = p.life > 0 ? p.life / p.max : 0;
      this.steam.pos[i * 3] = p.x; this.steam.pos[i * 3 + 1] = p.life > 0 ? p.y : -99; this.steam.pos[i * 3 + 2] = p.z;
      this.steam.size[i] = p.s * (1.6 - k * 0.8);
      this.steam.alpha[i] = Math.sin(k * Math.PI) * 0.22;
    });
    this.steam.flush();

    // fireflies: only on warm dark evenings
    const on = night;
    this.flyP.forEach((f, i) => {
      const a = t * f.sp + f.ph;
      const x = f.cx + Math.sin(a) * 0.5 + Math.sin(a * 0.37) * 0.3;
      const y = f.cy + Math.sin(a * 0.8) * 0.25;
      const z = f.cz + Math.cos(a * 0.9) * 0.45;
      this.flies.pos[i * 3] = x; this.flies.pos[i * 3 + 1] = y; this.flies.pos[i * 3 + 2] = z;
      const blink = Math.pow(Math.max(0, Math.sin(t * (0.9 + (i % 5) * 0.21) + f.ph)), 6);
      this.flies.alpha[i] = blink * on * 0.9;
      this.flies.size[i] = 0.07;
    });
    this.flies.flush();

    // leaves
    this.leafP.forEach((p, i) => {
      p.t += dt;
      if (p.t < 0) {
        this._m.makeTranslation(0, -500, 0);
      } else {
        if (p.rest > 0) {
          p.rest -= dt;
          if (p.rest <= 0) Object.assign(p, this.spawnLeaf());
        } else {
          p.y -= p.fall * dt;
          p.x += Math.sin(p.t * 1.7 + p.ph) * p.sway * dt;
          p.z += Math.cos(p.t * 1.3 + p.ph) * p.sway * 0.6 * dt;
          const floor = (p.x > -4 && p.x < 4 && p.z > -1 && p.z < 2.2) ? -0.29 : 0.01;
          if (p.y < floor) { p.y = floor; p.rest = 6 + this.rnd() * 6; }
        }
        const s = p.rest > 0 ? Math.max(0.02, clamp(p.rest / 2, 0, 1)) : 1;
        this._e.set(p.rest > 0 ? -Math.PI / 2 : p.t * 2.1 + p.ph, p.t * 1.3, p.rest > 0 ? p.ph : Math.sin(p.t * 3) * 0.8);
        this._q.setFromEuler(this._e);
        this._m.compose(this._p.set(p.x, p.y, p.z), this._q, this._s.set(s, s, s));
      }
      this.leaves.setMatrixAt(i, this._m);
    });
    this.leaves.instanceMatrix.needsUpdate = true;
  }
}

export { lerp };
