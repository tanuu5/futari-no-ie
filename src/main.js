// ふたりの家 — entry point: renderer, scene assembly, camera rig and the main loop.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createTextures, createMaterials } from './materials.js';
import { setAnisotropy } from './textures.js';
import { WALLS, PLINTH } from './plan.js';
import { buildHouse } from './house.js';
import { buildFurniture } from './furniture.js';
import { buildNature } from './nature.js';
import { Lighting } from './lighting.js';
import { Life, isNight } from './life.js';
import { PostFX, Particles } from './effects.js';
import { UI } from './ui.js';
import { clamp, damp, wrapMin, easeInOut, prefersReducedMotion } from './util.js';

const START_MINUTE = 16 * 60 + 52; // just before both head out to harvest, then sunset and lamps
const AMBER = new THREE.Color(0xffa24a);
const GREEN = new THREE.Color(0x9ad28a);
const UP_OFFSET = new THREE.Vector3(0, 1.0, 0);
const MUG_OFFSET = new THREE.Vector3(0, 0.02, 0.05);
const HOME_TARGET = new THREE.Vector3(0, 0, 0.6);
const HOME_DIR = new THREE.Vector3(15.5, 19.5, 26.9).normalize();
const HOME_DIST = 36.5;
const HOME = { pos: HOME_TARGET.clone().addScaledVector(HOME_DIR, HOME_DIST), target: HOME_TARGET.clone(), dist: HOME_DIST };
// Fit the house to any aspect ratio: portrait screens get a wider lens and a longer throw.
function fitHome(camera) {
  const aspect = innerWidth / Math.max(1, innerHeight);
  camera.fov = aspect < 1 ? 40 : 30;
  const halfV = Math.tan((camera.fov * Math.PI) / 360);
  HOME.dist = Math.max(HOME_DIST, 11.5 / (halfV * aspect));
  HOME.pos.copy(HOME_TARGET).addScaledVector(HOME_DIR, HOME.dist);
  return HOME.dist / HOME_DIST;
}
// Resolve on the next frame, or shortly after if the page is in a background tab.
const nextFrame = () => new Promise((resolve) => {
  let done = false;
  const go = () => { if (!done) { done = true; resolve(); } };
  requestAnimationFrame(go);
  setTimeout(go, 60);
});

class CameraRig {
  constructor(camera, dom, reduced) {
    this.camera = camera;
    this.reduced = reduced;
    const c = (this.controls = new OrbitControls(camera, dom));
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.minDistance = 3.2;
    c.maxDistance = 64;
    c.minPolarAngle = 0.12;
    c.maxPolarAngle = 1.36;
    c.screenSpacePanning = false;
    c.zoomSpeed = 0.9;
    c.rotateSpeed = 0.7;
    c.autoRotateSpeed = 0.28;
    c.target.copy(HOME.target);
    camera.position.copy(HOME.pos);
    this.fly = null;
    this.idle = 0;
    this.followPos = null;
    c.addEventListener('start', () => {
      this.fly = null;
      this.idle = 0;
      c.autoRotate = false;
    });
  }

  flyTo(pos, target, dur = 1.5) {
    if (this.reduced) {
      this.camera.position.copy(pos);
      this.controls.target.copy(target);
      return;
    }
    this.fly = { p0: this.camera.position.clone(), t0: this.controls.target.clone(), p1: pos.clone(), t1: target.clone(), t: 0, dur };
    this.idle = 0;
    this.controls.autoRotate = false;
  }

  update(dt, follow) {
    const c = this.controls;
    this.idle += dt;
    if (this.fly) {
      const f = this.fly;
      f.t += dt;
      const k = easeInOut(clamp(f.t / f.dur));
      this.camera.position.lerpVectors(f.p0, f.p1, k);
      c.target.lerpVectors(f.t0, f.t1, k);
      if (k >= 1) this.fly = null;
    } else if (follow) {
      const want = follow.clone();
      const d = want.sub(c.target).multiplyScalar(1 - Math.exp(-4 * dt));
      c.target.add(d);
      this.camera.position.add(d);
    }
    // keep the orbit centre over the diorama
    c.target.x = clamp(c.target.x, PLINTH.x0 + 2, PLINTH.x1 - 2);
    c.target.z = clamp(c.target.z, PLINTH.z0 + 2, PLINTH.z1 - 2);
    c.target.y = clamp(c.target.y, -0.5, 3);
    if (!this.reduced && !follow && !this.fly && this.idle > 45) c.autoRotate = true;
    c.update(dt);
  }
}

async function main() {
  const canvas = document.getElementById('scene');
  const loading = document.getElementById('loading');
  const bar = document.getElementById('loading-bar');
  const progress = (f) => { bar.style.width = `${Math.round(f * 100)}%`; };

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
  } catch (e) {
    loading.hidden = true;
    document.getElementById('nogl').hidden = false;
    return;
  }
  const reduced = prefersReducedMotion();
  const mobile = matchMedia('(pointer: coarse)').matches && Math.min(innerWidth, innerHeight) < 820;
  let quality = mobile || (navigator.hardwareConcurrency || 8) <= 4 ? 'low' : 'high';
  const pixelRatio = () => Math.min(window.devicePixelRatio || 1, quality === 'high' ? 1.5 : 1.15);
  renderer.setPixelRatio(pixelRatio());
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  setAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));
  progress(0.08);
  await nextFrame();

  const T = createTextures(WALLS);
  progress(0.35);
  await nextFrame();
  const M = createMaterials(T);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.3, 1200);

  const house = buildHouse(M, T);
  scene.add(house.root);
  progress(0.5);
  await nextFrame();
  const furn = buildFurniture(M, T);
  scene.add(furn.group);
  for (const [k, g] of Object.entries(furn.decorGroups)) house.cutGroups[k].group.add(g);
  progress(0.62);
  await nextFrame();
  const nature = buildNature(M, T, quality);
  scene.add(nature.root);
  progress(0.78);
  await nextFrame();

  const lighting = new Lighting(scene, renderer, quality);
  const porch = nature.handles.lamps.find((l) => l.id === 'porch');
  porch.mats.push(nature.handles.bollardMat);
  for (const l of [...furn.lamps, ...nature.handles.lamps]) lighting.addLamp(l);
  lighting.addLamp({ id: 'bath', pos: new THREE.Vector3(7.95, 2.1, -0.7), color: 0xffd8ab, power: 4.5, distance: 4.5, mats: [] });
  // soft cove light along the living-room ceiling, on together with the floor lamp
  lighting.addLamp({ id: 'livingFill', pos: new THREE.Vector3(1.0, 2.45, -4.4), color: 0xffd2a0, power: 7, distance: 7.5, mats: [] });
  lighting.addLamp({ id: 'diningFill', pos: new THREE.Vector3(-4.2, 2.45, -4.4), color: 0xffd2a0, power: 5, distance: 7, mats: [] });
  lighting.addSpot('uplight', nature.handles.uplight.pos, nature.handles.uplight.target, { power: 90, distance: 8, angle: 0.62 });

  const life = new Life(scene, M, T);
  const particles = new Particles(scene, T, nature.handles.maple);

  // a bowl and chopsticks appear at the human's place during meals
  const meal = new THREE.Group();
  {
    const bowlMat = M.ceramic.clone();
    bowlMat.side = THREE.DoubleSide;
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), bowlMat);
    bowl.position.set(-3.18, 0.808, -4.84);
    bowl.scale.set(1, 0.8, 1);
    const rice = new THREE.Mesh(new THREE.SphereGeometry(0.058, 16, 8), M.fabricCream);
    rice.scale.set(1, 0.35, 1);
    rice.position.set(-3.18, 0.81, -4.84);
    const soup = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.06, 18), M.woodDark);
    soup.position.set(-2.98, 0.79, -4.8);
    const sticks = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 0.22), M.woodDark);
    sticks.position.set(-3.1, 0.765, -4.66);
    sticks.rotation.y = Math.PI / 2;
    meal.add(bowl, rice, soup, sticks);
    meal.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    meal.visible = false;
    scene.add(meal);
  }

  const fx = new PostFX(renderer, scene, camera, quality);
  const rig = new CameraRig(camera, canvas, reduced);

  const app = {
    renderer, scene, camera, house, life, rig, quality,
    sim: { minute: START_MINUTE, speed: 1, playing: !reduced, scrubbed: true },
    tiltOn: !reduced,
    followWho: null,
    viewScale: 1,
    setTime(m) {
      this.sim.minute = wrapMin(m);
      this.sim.scrubbed = true;
    },
    flyTo(pos, target) {
      this.follow(null);
      rig.flyTo(pos, target);
    },
    follow(who, view) {
      this.followWho = who;
      ui.setFollowState(who);
      if (who) {
        const a = life[who];
        const target = a.pos.clone().add(new THREE.Vector3(0, 1.0, 0));
        const offset = (view ? new THREE.Vector3(...view) : new THREE.Vector3(3.2, 4.2, 6.0)).multiplyScalar(Math.min(1.7, this.viewScale || 1));
        rig.flyTo(target.clone().add(offset), target, 1.2);
      }
    },
    resetView() {
      this.follow(null);
      rig.flyTo(HOME.pos, HOME.target, 1.6);
    },
    setQuality(q) {
      this.quality = quality = q;
      fx.setQuality(q);
      lighting.setQuality(q);
      renderer.setPixelRatio(pixelRatio());
      resize();
      ui.setQualityLabel(q);
    },
  };
  const ui = new UI(app);
  ui.setQualityLabel(quality);
  if (!app.sim.playing) ui.setPlaying(false);

  let userMoved = false;
  rig.controls.addEventListener('start', () => { userMoved = true; });
  function resize() {
    const w = innerWidth, h = innerHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    const prevDist = HOME.dist;
    app.viewScale = fitHome(camera);
    rig.controls.maxDistance = Math.max(64, HOME.dist * 1.5);
    house.roofDistance = HOME.dist * 1.26;
    if (!userMoved && !rig.fly && Math.abs(prevDist - HOME.dist) > 0.01) {
      camera.position.copy(HOME.pos);
      rig.controls.target.copy(HOME.target);
    }
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const pr = renderer.getPixelRatio();
    fx.setSize(w, h, pr);
    particles.setScale((h * pr) / (2 * Math.tan((camera.fov * Math.PI) / 360)));
  }
  addEventListener('resize', resize);
  resize();

  // make every shader ready before the first visible frame
  lighting.update(START_MINUTE, 0.016, 0, { force: true });
  life.update(START_MINUTE, 0.016, 0, { scrubbed: true, darkness: 0, lineSpan: 6 });
  try { await renderer.compileAsync(scene, camera); } catch (e) { /* older browsers */ }
  progress(1);
  loading.classList.add('done');
  setTimeout(() => { loading.hidden = true; }, 700);

  // ---------- per-frame rules: the house responds to its residents ----------
  const H = furn.handles;
  const tmp = new THREE.Vector3();
  let curtain = 1, veil = 0, foot = 0, flies = 0, platterSpin = 0;
  const batteryLevel = (m) => {
    const h = m / 60;
    if (h >= 6 && h < 15) return 0.45 + ((h - 6) / 9) * 0.55;
    if (h >= 15 && h < 18) return 1 - ((h - 15) / 3) * 0.1;
    const k = h >= 18 ? (h - 18) / 12 : (h + 6) / 12;
    return 0.9 - k * 0.45;
  };

  function rules(st, ls, dt, t) {
    const m = app.sim.minute;
    const dark = ls.sunAlt < 5;
    const hs = st.humanSpot, cs = st.claudeSpot, hr = st.humanRoom;
    const hHere = !st.humanTraveling, cHere = !st.claudeTraveling;
    const awake = hs !== 'h_bed';
    lighting.setLamp('island', dark && hr === 'ldk' && (hs === 'h_cook' || hs === 'h_din'));
    lighting.setLamp('dining', dark && hr === 'ldk' && awake);
    lighting.setLamp('living', dark && (hr === 'ldk' || hr === 'deck') && awake);
    lighting.setLamp('livingFill', dark && hr === 'ldk' && awake);
    lighting.setLamp('diningFill', dark && hr === 'ldk' && awake);
    lighting.setLamp('bed', dark && hr === 'bed' && hs !== 'h_bed' && hs !== 'h_readbed');
    lighting.setLamp('reading', dark && hs === 'h_readbed');
    lighting.setLamp('study', dark && hs === 'h_desk');
    lighting.setLamp('claudeDesk', dark && cs === 'c_desk' && cHere);
    lighting.setLamp('andon', dark && (hs === 'h_moon' || hs === 'h_coffee' || cs === 'c_moon'));
    lighting.setLamp('bath', hs === 'h_bath' && dark);
    const eve = m > 17 * 60 + 10 && m < 23 * 60 + 30;
    lighting.setLamp('porch', dark && eve);
    lighting.setLamp('uplight', dark && eve);

    foot = damp(foot, isNight(m) ? 1.6 : 0, 2, dt);
    house.setFootLights(foot);

    const sleeping = hs === 'h_bed' && hHere;
    H.duvetSleep.visible = sleeping;
    H.duvetFlat.visible = !sleeping;
    const closed = hs === 'h_bed' || hs === 'h_readbed' || m < 6 * 60 + 35;
    curtain = damp(curtain, closed ? 1 : 0.16, 1.5, dt);
    for (const c of H.curtains) c.pivot.scale.x = curtain;

    H.padMat.emissiveIntensity = cs === 'c_din' && cHere ? 2.2 + Math.sin(t * 2.2) * 0.6 : 0.05;
    H.dockMat.emissiveIntensity = cs === 'c_dock' && cHere ? 1.1 + 1.4 * (0.5 + 0.5 * Math.sin(t * 1.6)) : 0.25;
    H.screenMat.emissiveIntensity = hs === 'h_desk' && hHere ? 0.95 : 0.04;
    H.doorLampBed.emissive.copy(hr === 'bed' ? AMBER : GREEN);
    H.doorLampBath.emissive.copy(hr === 'bath' ? AMBER : GREEN);
    veil = damp(veil, hs === 'h_bath' && hHere ? 0.86 : 0, 2, dt);
    H.bathVeil.material.opacity = veil;
    H.bathVeil.visible = veil > 0.01;
    H.bathWater.visible = true;
    const lvl = batteryLevel(m);
    H.batteryLeds.forEach((led, i) => { led.material.emissiveIntensity = lvl * 5 > i + 0.5 ? 1.4 : 0.03; });
    const cooking = (hs === 'h_cook' && hHere) || (cs === 'c_cook' && cHere);
    H.burnerMat.emissiveIntensity = cooking ? 1.8 : 0;
    const music = (hs === 'h_sofa2' && hHere) || (cs === 'c_sofa' && cHere);
    platterSpin = damp(platterSpin, music ? 3.49 : 0, 1.5, dt);
    H.platter.rotation.y += platterSpin * dt;
    meal.visible = hs === 'h_din' && hHere && life.human.sinceArrive > 0.8;

    particles.emitters.pot.on = cooking;
    particles.emitters.pot.pos.copy(H.steamPot);
    particles.emitters.bath.on = hs === 'h_bath' && hHere;
    particles.emitters.bath.pos.copy(H.steamBath);
    const mug = hs === 'h_coffee' || hs === 'h_moon';
    particles.emitters.mug.on = mug && hHere && life.human.sinceArrive > 0.8;
    if (mug) particles.emitters.mug.pos.copy(life.human.c.joints.handR.getWorldPosition(tmp)).add(MUG_OFFSET);
    flies = damp(flies, ls.sunAlt < -4 && m > 18 * 60 + 30 && m < 23 * 60 + 40 ? 1 : 0, 1, dt);
    return flies;
  }

  // ---------- main loop ----------
  let last = performance.now();
  let t = 0;
  let fpsAcc = 0, fpsFrames = 0, fpsChecked = false;
  const followPos = new THREE.Vector3();

  const frame = () => {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    t += dt;
    const sim = app.sim;
    if (sim.playing && !ui.dragging) sim.minute = wrapMin(sim.minute + dt * sim.speed);
    const scrubbed = sim.scrubbed;
    sim.scrubbed = false;

    const ls = lighting.update(sim.minute, dt, t, { force: scrubbed });
    const lineSpan = clamp(sim.speed * 5, 6, 40);
    life.update(sim.minute, dt, t, { scrubbed, darkness: ls.darkness, lineSpan });
    const st = life.state(sim.minute);
    const fliesOn = rules(st, ls, dt, t);
    house.updateDoors(life.actors, st.humanRoom, dt);

    let follow = null;
    if (app.followWho) {
      const a = life[app.followWho];
      follow = followPos.copy(a.pos).add(UP_OFFSET);
    }
    rig.update(dt, follow);
    house.updateCut(camera, rig.controls.target, dt);
    nature.handles.update(t);
    particles.update(dt, t, fliesOn);

    const dist = camera.position.distanceTo(rig.controls.target);
    const tilt = app.tiltOn ? clamp((dist - 7) / 22, 0.1, 1) : 0;
    if (innerWidth > 0 && innerHeight > 0) {
      if (canvas.width === 0) resize();
      fx.render(dt, t, tilt, ls.darkness);
    }
    ui.update(st, life.talk || {}, ls.darkness);

    // one-time automatic quality fallback on slow machines.
    // Only real frames count: throttled/background ticks (dt >= 90 ms) are ignored.
    if (!fpsChecked && t > 2 && !document.hidden && dt > 0.001 && dt < 0.09) {
      fpsAcc += dt;
      fpsFrames++;
      if (fpsFrames >= 90) {
        fpsChecked = true;
        const fps = fpsFrames / fpsAcc;
        if (fps < 26 && app.quality === 'high') app.setQuality('low');
      }
    }
  };
  // Full rate while visible; a slow tick in background tabs so time keeps flowing.
  const run = () => {
    frame();
    if (document.hidden) setTimeout(run, 500);
    else requestAnimationFrame(run);
  };
  run();
  window.__futari = { app, frame };
}

main().catch((e) => {
  console.error(e);
  const p = document.querySelector('#loading p');
  if (p) p.textContent = '読み込みに失敗しました。ページを再読み込みしてください。';
});
