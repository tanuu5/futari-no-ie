// Daily life: a navigation graph, two schedules, and actors whose position is a pure
// function of the clock, so scrubbing the timeline always lands in the right moment.
import * as THREE from 'three';
import { NAV, NAV_EDGES, QUIET_NODES, SPOTS, SCHEDULE, EXTRA_LINES, groundY, roomAt } from './plan.js';
import { createCharacter, poseTarget, applyPose, blendPose, initialPose, setEyes } from './characters.js';
import { dampAngle, damp, smoothstep, clamp, wrapMin } from './util.js';

const SETTLE = 1.2; // sim minutes to ease from an approach point into a seat
const SIT = new Set(['sit', 'sitCharge', 'type', 'write', 'read', 'relax', 'eat', 'sitEdge', 'sitEdgeMug', 'sleep']);
export const isNight = (m) => m >= 21 * 60 + 30 || m < 6 * 60 + 30;

class Nav {
  constructor() {
    this.nodes = {};
    for (const [id, [x, z]] of Object.entries(NAV)) this.nodes[id] = { id, x, z, adj: [] };
    for (const [a, b] of NAV_EDGES) {
      const A = this.nodes[a], B = this.nodes[b];
      if (!A || !B) { console.warn('[nav] bad edge', a, b); continue; }
      const d = Math.hypot(A.x - B.x, A.z - B.z);
      A.adj.push([b, d]);
      B.adj.push([a, d]);
    }
  }

  // Dijkstra. avoidQuiet adds a penalty to nodes next to the bedroom. Returns { path, cost }.
  route(from, to, avoidQuiet) {
    if (from === to) return { path: [from], cost: 0 };
    const dist = {}, prev = {}, done = new Set();
    for (const id in this.nodes) dist[id] = Infinity;
    dist[from] = 0;
    for (;;) {
      let u = null, best = Infinity;
      for (const id in dist) if (!done.has(id) && dist[id] < best) { best = dist[id]; u = id; }
      if (u === null || u === to) break;
      done.add(u);
      for (const [v, w] of this.nodes[u].adj) {
        const nd = dist[u] + w + (avoidQuiet && QUIET_NODES.has(v) ? 14 : 0);
        if (nd < dist[v]) { dist[v] = nd; prev[v] = u; }
      }
    }
    const path = [];
    let c = to;
    while (c !== undefined) {
      path.unshift(c);
      if (c === from) break;
      c = prev[c];
    }
    return path[0] === from ? { path, cost: dist[to] } : { path: [from, to], cost: Infinity };
  }

  // Spots may name several nodes: choose the cheapest way out of one spot and into the next.
  bestRoute(fromPt, fromNodes, toPt, toNodes, avoidQuiet) {
    let best = null;
    for (const a of fromNodes) {
      for (const b of toNodes) {
        const r = this.route(a, b, avoidQuiet);
        const A = this.nodes[a], B = this.nodes[b];
        const cost = Math.hypot(A.x - fromPt[0], A.z - fromPt[1]) + r.cost + Math.hypot(B.x - toPt[0], B.z - toPt[1]);
        if (!best || cost < best.cost) best = { path: r.path, cost };
      }
    }
    return best.path;
  }
}

export class Actor {
  constructor(kind, M, schedule, nav, { speed }) {
    this.kind = kind;
    this.c = createCharacter(kind, M);
    this.root = this.c.root;
    this.speed = speed; // meters per sim minute (= m/s at ×1)
    this.pos = new THREE.Vector3();
    this.heading = 0;
    this.targetHeading = 0;
    this.traveling = false;
    this.cur = initialPose(this.c);
    this.seg = null;
    this.talking = false;
    this.privacy = false;
    this.segments = this.buildSegments(schedule, nav);
    this._p = new THREE.Vector3();
    this._t = new THREE.Vector3();
    this._target = {};
  }

  buildSegments(schedule, nav) {
    const n = schedule.length;
    const segs = [];
    for (let i = 0; i < n; i++) {
      const [start, spotId, label, line] = schedule[i];
      const end = i + 1 < n ? schedule[i + 1][0] : 1440;
      const prevSpot = SPOTS[schedule[(i - 1 + n) % n][1]];
      const spot = SPOTS[spotId];
      if (!spot) throw new Error(`unknown spot ${spotId}`);
      let curve = null, length = 0;
      const same = prevSpot === spot || (prevSpot.x === spot.x && prevSpot.z === spot.z);
      if (!same) {
        const pts = [];
        const push = (x, z) => {
          const last = pts[pts.length - 1];
          if (!last || Math.hypot(last[0] - x, last[1] - z) > 0.05) pts.push([x, z]);
        };
        push(prevSpot.x, prevSpot.z);
        if (prevSpot.ap) push(prevSpot.ap[0], prevSpot.ap[1]);
        const avoid = this.kind === 'claude' && isNight(start);
        const from = prevSpot.ap || [prevSpot.x, prevSpot.z];
        const tgt = spot.ap || [spot.x, spot.z];
        const path = nav.bestRoute(from, [].concat(prevSpot.node), tgt, [].concat(spot.node), avoid);
        for (const id of path) push(nav.nodes[id].x, nav.nodes[id].z);
        push(tgt[0], tgt[1]);
        if (pts.length >= 2) {
          curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
          length = curve.getLength();
        }
      }
      const travel = curve ? Math.min(length / this.speed, (end - start) * 0.7) : 0;
      segs.push({ i, start, end, spotId, spot, label, line, curve, length, travel, arrive: start + travel });
    }
    return segs;
  }

  segmentAt(m) {
    for (const s of this.segments) if (m >= s.start && m < s.end) return s;
    return this.segments[this.segments.length - 1];
  }

  update(minute, dt, t, ctx) {
    const seg = this.segmentAt(minute);
    this.seg = seg;
    const e = minute - seg.start;
    const spot = seg.spot;
    let pose, seatY = spot.y ?? 0.45;
    const sinceArrive = e - seg.travel;
    if (seg.curve && e < seg.travel) {
      this.traveling = true;
      const u = clamp(e / seg.travel, 0, 0.9999);
      const p = seg.curve.getPointAt(u, this._p);
      const tan = seg.curve.getTangentAt(u, this._t);
      this.pos.set(p.x, groundY(p.x, p.z), p.z);
      this.targetHeading = Math.atan2(tan.x, tan.z);
      this.phase = ((u * seg.length) / this.c.D.stride) * Math.PI * 2;
      pose = 'walk';
    } else {
      this.traveling = false;
      const k = spot.ap ? smoothstep(0, SETTLE, sinceArrive) : 1;
      const ax = spot.ap ? spot.ap[0] : spot.x, az = spot.ap ? spot.ap[1] : spot.z;
      const x = ax + (spot.x - ax) * k, z = az + (spot.z - az) * k;
      this.pos.set(x, groundY(x, z), z);
      this.targetHeading = spot.face;
      pose = spot.pose;
      if (spot.ap && k < 0.4 && SIT.has(pose)) pose = 'stand';
    }
    this.pose = pose;
    this.sinceArrive = sinceArrive;

    // placement
    this.root.visible = pose !== 'hidden';
    this.root.position.copy(this.pos);
    const snap = Math.abs(wrapAngleDiff(this.heading, this.targetHeading)) > 2.8 && ctx.scrubbed;
    this.heading = snap ? this.targetHeading : dampAngle(this.heading, this.targetHeading, this.traveling ? 12 : 7, dt);
    this.root.rotation.y = this.heading;

    // pose
    const target = poseTarget(this.c, pose, t, { phase: this.phase, seatY, sinceArrive, talking: this.talking }, this._target);
    if (ctx.scrubbed) Object.assign(this.cur, target);
    else blendPose(this.cur, target, dt, pose === 'walk');
    applyPose(this.c, this.cur);

    // props
    for (const [name, obj] of Object.entries(this.c.props)) obj.visible = !this.traveling && spot.prop === name && sinceArrive > 0.6;

    // faces and lights
    const happy = this.talking ? 1 : 0;
    this.happy = damp(this.happy || 0, happy, 6, dt);
    let eyes = this.cur.eyes;
    if (this.kind === 'claude') {
      const m = this.c.mats;
      const dark = ctx.darkness;
      m.eye.emissiveIntensity = (this.privacy ? 0.6 : 2.2) + dark * 2.2;
      if (this.privacy) eyes = Math.min(eyes, 0.3);
      m.status.emissiveIntensity = damp(m.status.emissiveIntensity, this.privacy ? 0.05 : 1.4 + dark, 5, dt);
      let core = 2.0 + dark * 1.2;
      if (pose === 'charge') core = 0.8 + 1.8 * (0.5 + 0.5 * Math.sin(t * 1.6));
      else if (pose === 'write' || pose === 'tinker') core = 2.4 + Math.sin(t * 6.5) * 0.35 + dark;
      m.core.emissiveIntensity = damp(m.core.emissiveIntensity, core, 4, dt);
    }
    setEyes(this.c, eyes, t + (this.kind === 'claude' ? 1.7 : 0), this.happy);
  }

  headWorld(out) {
    return this.c.joints.head.getWorldPosition(out);
  }
}

function wrapAngleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export class Life {
  constructor(scene, M, T) {
    this.nav = new Nav();
    this.human = new Actor('human', M, SCHEDULE.human, this.nav, { speed: 1.7 });
    this.claude = new Actor('claude', M, SCHEDULE.claude, this.nav, { speed: 1.45 });
    this.actors = [this.human, this.claude];
    const blobMat = new THREE.MeshBasicMaterial({ map: T.blob, transparent: true, depthWrite: false, opacity: 0.55, color: 0x000000 });
    this.blobs = this.actors.map(() => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), blobMat);
      m.rotation.x = -Math.PI / 2;
      m.renderOrder = 2;
      m.userData.noAO = true;
      scene.add(m);
      return m;
    });
    for (const a of this.actors) scene.add(a.root);
    this.lines = this.buildLines();
    this._v = new THREE.Vector3();
  }

  buildLines() {
    const lines = [];
    for (const a of this.actors) {
      for (const s of a.segments) {
        if (s.line) lines.push({ t: wrapMin(s.arrive + 0.4), who: a.kind, text: s.line });
      }
    }
    for (const l of EXTRA_LINES) lines.push({ ...l });
    for (const l of lines) l.thought = l.text.startsWith('（');
    return lines.sort((x, y) => x.t - y.t);
  }

  // The line each actor is saying at this minute (if any).
  activeLines(minute, span) {
    const out = {};
    for (const l of this.lines) {
      const d = wrapMin(minute - l.t);
      if (d < span && (!out[l.who] || d < out[l.who].age)) out[l.who] = { ...l, age: d };
    }
    return out;
  }

  update(minute, dt, t, ctx) {
    const talk = this.activeLines(minute, ctx.lineSpan);
    this.human.talking = !!talk.human && !talk.human.thought;
    this.claude.talking = !!talk.claude && !talk.claude.thought;
    // Claude dims its sensors near the sensor-free rooms while the human is inside.
    const hs = this.human.seg ? this.human.seg.spot.room : null;
    const cp = this.claude.pos;
    const nearPrivate = (cp.x > 4.3 && cp.x < 5.3 && cp.z > -3.6 && cp.z < 0.9) && (hs === 'bed' || hs === 'bath');
    this.claude.privacy = nearPrivate || (this.claude.seg && this.claude.seg.spotId === 'c_door');
    for (const a of this.actors) a.update(minute, dt, t, ctx);
    this.actors.forEach((a, i) => {
      const b = this.blobs[i];
      b.visible = a.root.visible;
      b.position.set(a.pos.x, a.pos.y + 0.012, a.pos.z);
      const lying = a.pose === 'sleep';
      b.scale.set(lying ? 0.9 : 1, lying ? 1.9 : 1, 1);
      b.rotation.z = a.heading;
    });
    this.talk = talk;
  }

  state(minute) {
    const h = this.human, c = this.claude;
    return {
      minute,
      humanSpot: h.seg.spotId,
      claudeSpot: c.seg.spotId,
      humanRoom: roomAt(h.pos.x, h.pos.z),
      claudeRoom: roomAt(c.pos.x, c.pos.z),
      humanTraveling: h.traveling,
      claudeTraveling: c.traveling,
      humanLabel: h.traveling ? `移動中 → ${h.seg.label}` : h.seg.label,
      claudeLabel: c.traveling ? `移動中 → ${c.seg.label}` : c.seg.label,
    };
  }

  timeline() {
    return {
      human: this.human.segments.map((s) => ({ start: s.start, end: s.end, label: s.label, room: s.spot.room, spot: s.spotId })),
      claude: this.claude.segments.map((s) => ({ start: s.start, end: s.end, label: s.label, room: s.spot.room, spot: s.spotId })),
    };
  }
}
