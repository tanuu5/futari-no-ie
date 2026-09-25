// DOM layer: timeline, now-card, toolbar, design notes, pins, speech bubbles, room labels.
import * as THREE from 'three';
import { NOTES, TAGS, BRIEF } from './content.js';
import { ROOMS, COURT_LABEL, roomArea } from './plan.js';
import { sunAt } from './lighting.js';
import { fmtTime, wrapMin, clamp } from './util.js';

const $ = (id) => document.getElementById(id);
const LANE_LEFT = () => (window.innerWidth <= 860 ? 52 : 64);

function phaseLabel(minute) {
  const alt = sunAt(minute).alt;
  const h = minute / 60;
  if (alt < -6) return h < 12 ? '夜明け前' : '夜';
  if (alt < 6) return h < 12 ? '夜明け' : '夕暮れ';
  if (h < 10) return '朝';
  if (h < 14) return '昼';
  if (h < 16.5) return '午後';
  return '夕方';
}

function skyGradient() {
  const stops = [];
  for (let m = 0; m <= 1440; m += 20) {
    const a = sunAt(m).alt;
    let c;
    if (a < -8) c = [29, 38, 64];
    else if (a < 0) { const k = (a + 8) / 8; c = [29 + k * (200 - 29), 38 + k * (132 - 38), 64 + k * (110 - 64)]; }
    else if (a < 10) { const k = a / 10; c = [200 + k * (214 - 200), 132 + k * (226 - 132), 110 + k * (236 - 110)]; }
    else c = [214, 226, 236];
    stops.push(`rgb(${c.map((v) => v | 0).join(',')}) ${((m / 1440) * 100).toFixed(2)}%`);
  }
  return `linear-gradient(90deg, ${stops.join(',')})`;
}

export class UI {
  constructor(app) {
    this.app = app;
    this.v = new THREE.Vector3();
    this.showPins = true;
    this.currentNote = -1;
    this.dragging = false;
    this.buildTimeline();
    this.buildNotes();
    this.buildOverlay();
    this.bind();
    $('brief-body').innerHTML = BRIEF;
    $('notes-count').textContent = String(NOTES.length);
    if (window.innerWidth <= 860) this.setNotesOpen(false);
  }

  // ---------- timeline ----------
  buildTimeline() {
    const tl = this.app.life.timeline();
    const overlap = (a, b) => Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
    const together = (s, others) => others.some((o) => overlap(s, o) > (s.end - s.start) * 0.5 && o.room === s.room && ['ldk', 'court', 'deck', 'study'].includes(s.room));
    const lane = (el, segs, cls, others) => {
      for (const s of segs) {
        const d = document.createElement('div');
        const rest = /眠って|充電/.test(s.label);
        d.className = `seg ${cls}${rest ? ' rest' : ''}${together(s, others) ? ' together' : ''}`;
        d.style.left = `${(s.start / 1440) * 100}%`;
        d.style.width = `${((s.end - s.start) / 1440) * 100}%`;
        d.textContent = s.label.replace(/（.*?）/g, '');
        d.title = `${fmtTime(s.start)}–${fmtTime(s.end)} ${s.label}`;
        el.appendChild(d);
      }
    };
    lane($('lane-human'), tl.human, 'human', tl.claude);
    lane($('lane-claude'), tl.claude, 'claude', tl.human);
    const ticks = $('tl-ticks');
    for (let h = 0; h <= 24; h += 3) {
      const s = document.createElement('span');
      s.style.left = `${(h / 24) * 100}%`;
      s.textContent = String(h);
      ticks.appendChild(s);
    }
    $('tl-sky').style.background = skyGradient();
  }

  minuteFromEvent(e) {
    const r = $('tl-track').getBoundingClientRect();
    const left = r.left + LANE_LEFT();
    const f = clamp((e.clientX - left) / (r.right - left), 0, 0.9999);
    return f * 1440;
  }

  // ---------- notes ----------
  buildNotes() {
    const list = $('notes-list');
    NOTES.forEach((n, i) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = `<span class="n">${String(i + 1).padStart(2, '0')}</span><span>${n.title}</span><span class="tag ${TAGS[n.tag].cls}">${TAGS[n.tag].label.split(' ')[0]}</span>`;
      b.addEventListener('click', () => this.openNote(i));
      li.appendChild(b);
      list.appendChild(li);
    });
  }

  openNote(i, fly = true) {
    i = (i + NOTES.length) % NOTES.length;
    const n = NOTES[i];
    this.currentNote = i;
    $('notecard').hidden = false;
    $('note-no').textContent = String(i + 1).padStart(2, '0');
    $('note-title').textContent = n.title;
    $('note-tag').innerHTML = `<span class="tag ${TAGS[n.tag].cls}">${TAGS[n.tag].label}</span>`;
    $('note-human').textContent = n.human;
    $('note-claude').textContent = n.claude;
    $('note-answer').textContent = n.answer;
    [...$('notes-list').querySelectorAll('button')].forEach((b, k) => b.setAttribute('aria-current', k === i ? 'true' : 'false'));
    this.pins.forEach((p, k) => p.el.classList.toggle('active', k === i));
    $('intro').hidden = true;
    if (window.innerWidth <= 860) this.setNotesOpen(false);
    if (fly) {
      if (n.follow) {
        this.app.follow(n.follow, n.view);
      } else {
        const target = new THREE.Vector3(...(n.target || n.pos));
        const pos = target.clone().add(new THREE.Vector3(...n.view).multiplyScalar(Math.min(1.7, this.app.viewScale || 1)));
        this.app.flyTo(pos, target);
      }
    }
  }

  closeNote() {
    $('notecard').hidden = true;
    this.currentNote = -1;
    this.pins.forEach((p) => p.el.classList.remove('active'));
    [...$('notes-list').querySelectorAll('button')].forEach((b) => b.setAttribute('aria-current', 'false'));
  }

  setNotesOpen(open) {
    $('notes-toggle').setAttribute('aria-expanded', open ? 'true' : 'false');
    $('notes-list').hidden = !open;
  }

  // ---------- overlay: pins, bubbles, labels ----------
  buildOverlay() {
    const ov = $('overlay');
    this.pins = NOTES.map((n, i) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'pin';
      el.innerHTML = `${i + 1}<span class="pin-tip">${n.title}</span>`;
      el.setAttribute('aria-label', `設計ノート ${i + 1}: ${n.title}`);
      el.addEventListener('click', (e) => { e.stopPropagation(); this.openNote(i); });
      ov.appendChild(el);
      return { el, note: n, pos: new THREE.Vector3(...n.pos) };
    });
    this.bubbles = {};
    for (const who of ['human', 'claude']) {
      const el = document.createElement('div');
      el.className = `bubble ${who}`;
      el.setAttribute('aria-hidden', 'true');
      ov.appendChild(el);
      this.bubbles[who] = { el, text: '' };
    }
    this.labels = [...ROOMS.filter((r) => r.label), { ...COURT_LABEL, court: true }].map((r) => {
      const el = document.createElement('div');
      el.className = 'room-label';
      el.setAttribute('aria-hidden', 'true');
      const area = r.court ? r.area : roomArea(r);
      const jo = area / 1.62;
      el.innerHTML = `<b>${r.name}</b>${r.sub ? `<span>${r.sub}</span><br>` : ''}<small>${area.toFixed(1)} m²${r.court ? '' : ` · ${jo.toFixed(1)}帖`}</small>`;
      ov.appendChild(el);
      return { el, pos: new THREE.Vector3(r.label[0], 0.05, r.label[1]) };
    });
  }

  place(el, world, dx = 0, dy = 0) {
    const cam = this.app.camera;
    const v = this.v.copy(world).project(cam);
    const w = window.innerWidth, h = window.innerHeight;
    if (v.z > 1 || v.z < -1) { el.style.visibility = 'hidden'; return false; }
    const x = (v.x * 0.5 + 0.5) * w + dx, y = (-v.y * 0.5 + 0.5) * h + dy;
    if (x < -50 || x > w + 50 || y < -50 || y > h + 50) { el.style.visibility = 'hidden'; return false; }
    el.style.visibility = 'visible';
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    return true;
  }

  // ---------- events ----------
  bind() {
    const app = this.app;
    $('btn-play').addEventListener('click', () => this.setPlaying(!app.sim.playing));
    document.querySelectorAll('.speeds .chip').forEach((c) => {
      c.addEventListener('click', () => {
        app.sim.speed = Number(c.dataset.speed);
        document.querySelectorAll('.speeds .chip').forEach((o) => o.setAttribute('aria-pressed', o === c ? 'true' : 'false'));
      });
    });
    const track = $('tl-track');
    track.addEventListener('pointerdown', (e) => {
      this.dragging = true;
      track.setPointerCapture(e.pointerId);
      app.setTime(this.minuteFromEvent(e));
    });
    track.addEventListener('pointermove', (e) => { if (this.dragging) app.setTime(this.minuteFromEvent(e)); });
    const end = () => { this.dragging = false; };
    track.addEventListener('pointerup', end);
    track.addEventListener('pointercancel', end);
    track.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 60 : 10;
      if (e.key === 'ArrowRight') { app.setTime(app.sim.minute + step); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { app.setTime(app.sim.minute - step); e.preventDefault(); }
    });

    $('follow-human').addEventListener('click', () => app.follow(app.followWho === 'human' ? null : 'human'));
    $('follow-claude').addEventListener('click', () => app.follow(app.followWho === 'claude' ? null : 'claude'));

    const roofLabels = { auto: '自動', on: '表示', off: 'なし' };
    $('tool-roof').addEventListener('click', () => {
      const order = ['auto', 'on', 'off'];
      const next = order[(order.indexOf(app.house.roofMode) + 1) % 3];
      app.house.roofMode = next;
      $('roof-state').textContent = roofLabels[next];
    });
    $('tool-notes').addEventListener('click', (e) => {
      this.showPins = !this.showPins;
      const b = e.currentTarget;
      b.setAttribute('aria-pressed', String(this.showPins));
      b.querySelector('.tool-v').textContent = this.showPins ? 'ON' : 'OFF';
    });
    $('tool-tilt').addEventListener('click', (e) => {
      app.tiltOn = !app.tiltOn;
      const b = e.currentTarget;
      b.setAttribute('aria-pressed', String(app.tiltOn));
      b.querySelector('.tool-v').textContent = app.tiltOn ? 'ON' : 'OFF';
    });
    $('tool-quality').addEventListener('click', () => {
      app.setQuality(app.quality === 'high' ? 'low' : 'high');
    });
    $('tool-reset').addEventListener('click', () => { this.closeNote(); app.resetView(); });

    $('notes-toggle').addEventListener('click', () => this.setNotesOpen($('notes-toggle').getAttribute('aria-expanded') !== 'true'));
    $('note-close').addEventListener('click', () => this.closeNote());
    $('note-prev').addEventListener('click', () => this.openNote(this.currentNote - 1));
    $('note-next').addEventListener('click', () => this.openNote(this.currentNote + 1));

    let briefOpener = null;
    const openBrief = (anchorLast) => {
      briefOpener = document.activeElement;
      $('brief').hidden = false;
      const body = $('brief-body');
      body.scrollTop = anchorLast ? body.scrollHeight : 0;
      $('brief-close').focus();
    };
    this.closeBrief = () => {
      if ($('brief').hidden) return;
      $('brief').hidden = true;
      if (briefOpener && typeof briefOpener.focus === 'function') briefOpener.focus();
    };
    $('btn-brief').addEventListener('click', () => openBrief(false));
    $('intro-brief').addEventListener('click', () => openBrief(false));
    $('btn-about').addEventListener('click', () => openBrief(true));
    $('brief-close').addEventListener('click', () => this.closeBrief());
    $('brief').addEventListener('click', (e) => { if (e.target === $('brief')) this.closeBrief(); });
    // keep Tab inside the dialog while it is open
    $('brief').addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const focusables = [...$('brief').querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])')];
      const body = $('brief-body');
      if (!body.hasAttribute('tabindex')) body.setAttribute('tabindex', '0');
      focusables.push(body);
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
    });
    $('intro-close').addEventListener('click', () => { $('intro').hidden = true; });
    // the intro steps aside once the viewer starts exploring the model
    let drags = 0;
    $('scene').addEventListener('pointerdown', () => { if (++drags >= 2) $('intro').hidden = true; });

    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.key === 'Escape') {
        if (!$('brief').hidden) this.closeBrief();
        else if (!$('notecard').hidden) this.closeNote();
      }
      if (e.key === ' ' && document.activeElement === document.body) { this.setPlaying(!app.sim.playing); e.preventDefault(); }
    });
  }

  setPlaying(on) {
    this.app.sim.playing = on;
    const b = $('btn-play');
    b.setAttribute('aria-pressed', String(on));
    b.setAttribute('aria-label', on ? '一時停止' : '再生');
  }

  setQualityLabel(q) {
    $('quality-state').textContent = q === 'high' ? '高' : '標準';
  }

  setFollowState(who) {
    $('follow-human').setAttribute('aria-pressed', String(who === 'human'));
    $('follow-claude').setAttribute('aria-pressed', String(who === 'claude'));
  }

  // ---------- per frame ----------
  update(state, talk, darkness) {
    const app = this.app;
    const m = app.sim.minute;
    const time = fmtTime(m);
    if (time !== this._time) {
      this._time = time;
      $('now-time').textContent = time;
      $('tl-head-label').textContent = time;
      $('now-phase').textContent = phaseLabel(m);
      const track = $('tl-track');
      track.setAttribute('aria-valuenow', String(Math.floor(m)));
      track.setAttribute('aria-valuetext', `${Math.floor(m / 60)}時${Math.floor(m % 60)}分`);
    }
    if (state.humanLabel !== this._hl) { this._hl = state.humanLabel; $('now-human').textContent = state.humanLabel; }
    if (state.claudeLabel !== this._cl) { this._cl = state.claudeLabel; $('now-claude').textContent = state.claudeLabel; }
    const f = m / 1440;
    $('tl-head').style.left = `calc(${LANE_LEFT()}px + (100% - ${LANE_LEFT()}px) * ${f.toFixed(5)})`;

    // pins
    for (const p of this.pins) {
      if (!this.showPins) { p.el.style.visibility = 'hidden'; continue; }
      if (p.note.follow) {
        const a = app.life[p.note.follow];
        p.pos.set(a.pos.x, a.pos.y + p.note.pos[1], a.pos.z);
        if (!a.root.visible) { p.el.style.visibility = 'hidden'; continue; }
      }
      this.place(p.el, p.pos);
    }
    // room labels
    const nightCls = darkness > 0.6;
    if (nightCls !== this._night) { this._night = nightCls; $('overlay').classList.toggle('night', nightCls); }
    const dist = app.camera.position.distanceTo(app.rig.controls.target);
    const showLabels = this.showPins && dist < 40 && app.house.roofT < 0.5;
    for (const l of this.labels) {
      if (!showLabels) { l.el.style.visibility = 'hidden'; continue; }
      if (this.place(l.el, l.pos)) l.el.style.transform += ' translate(-50%, -50%)';
    }
    // speech bubbles
    for (const who of ['human', 'claude']) {
      const b = this.bubbles[who];
      const line = talk[who];
      const actor = app.life[who];
      if (line && actor) {
        if (b.text !== line.text) {
          b.text = line.text;
          b.el.textContent = line.text;
          b.el.classList.toggle('thought', !!line.thought);
        }
        const head = actor.headWorld(this.v2 || (this.v2 = new THREE.Vector3()));
        head.y += who === 'claude' ? 0.42 : 0.45;
        if (!actor.root.visible) head.set(8.0, 2.2, -1.0); // bath: the voice comes from behind the veil
        if (this.place(b.el, head)) {
          b.el.style.transform += ' translate(-50%, -100%)';
          b.el.classList.add('show');
        }
      } else {
        b.el.classList.remove('show');
        b.text = '';
      }
    }
    // north arrow follows the camera
    const cam = app.camera;
    const fx = app.rig.controls.target.x - cam.position.x, fz = app.rig.controls.target.z - cam.position.z;
    const ang = Math.atan2(fx, -fz);
    $('north-needle').setAttribute('transform', `rotate(${(-ang * 180) / Math.PI} 20 20)`);
  }
}

export { wrapMin };
