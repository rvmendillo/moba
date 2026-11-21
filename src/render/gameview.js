// Turns interpolated match state into the 3D scene: units, pets, status effects, FX, fog of war, overlay.
import * as THREE from 'three';
import { HEROES } from '../data/heroes.js';
import { PETS } from '../data/items.js';
import { MINION_TYPE_LIST, MONSTER_LIST, MONSTERS } from '../data/units.js';
import { F } from '../sim/world.js';
import { buildHumanoid } from './models.js';
import { poseHumanoid } from './anim.js';
import { buildMinion, buildMonster, buildTower, buildCore, buildPet, animateCreature, animateStructure, animatePet } from './creatures.js';
import { FX } from './fx.js';
import { Overlay } from './overlay.js';
import { U, canvasTex } from './materials.js';

const ringGeo = new THREE.RingGeometry(0.72, 0.9, 48).rotateX(-Math.PI / 2);
const blobGeo = new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2);
let blobTex = null;
function blobMat() {
  if (!blobTex) blobTex = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(30,40,80,0.55)'); gr.addColorStop(1, 'rgba(30,40,80,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  return new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false });
}
const shieldMat = new THREE.ShaderMaterial({
  uniforms: { uTime: U.uTime, uColor: { value: new THREE.Color(0xcff4ff) } },
  vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform float uTime; uniform vec3 uColor; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.5); float s = 0.5 + 0.5 * sin(uTime * 4.0 + vN.y * 8.0); gl_FragColor = vec4(uColor * 1.8, f * (0.55 + 0.25 * s)); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});
const glowBasic = (c, k = 2.4) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });

export class GameView {
  constructor(core, state, opts) {
    this.core = core; this.state = state;
    this.myId = opts.myId; this.myTeam = opts.myTeam;
    this.scene = core.scene; this.env = core.env;
    this.fx = new FX(this.scene, this.env);
    this.views = new Map();
    this.overlay = new Overlay(opts.overlayCanvas);
    this.camYaw = this.myTeam === 1 ? Math.PI : 0;
    this.camOverride = null;
    this.camPos = new THREE.Vector3();
    this.heroNames = new Map();
    this.time = 0;
    this.onEvent = opts.onEvent || (() => {});
    this.fowCanvas = document.createElement('canvas');
    this.fowCanvas.width = this.fowCanvas.height = 128;
    this.fowTex = new THREE.CanvasTexture(this.fowCanvas);
    this.fowTex.colorSpace = THREE.NoColorSpace;
    U.uFow.value = this.fowTex; U.uFowOn.value = 1;
    this.fowT = 0;
    this.lastSample = null;
    this.towerRings = new Map();
  }
  dispose() {
    for (const v of this.views.values()) { this.scene.remove(v.root); if (v.pet) this.scene.remove(v.pet.root); }
    for (const r of this.towerRings.values()) this.scene.remove(r);
    this.views.clear(); this.towerRings.clear();
    this.scene.remove(this.fx.group); this.scene.remove(this.fx.parts.points);
    this.fx.parts.geo.dispose();
    U.uFowOn.value = 0;
    this.core.grade.uniforms.uGray.value = 0;
    this.core.shake = 0;
  }
  // ---------------------------------------------------------------- unit views
  makeView(u) {
    const root = new THREE.Group();
    let M, pet = null, barH = 2.6, label = '';
    const team = u.team;
    switch (u.kind) {
      case 0: {
        const def = HEROES[u.type];
        const flash = { value: 0 };
        M = buildHumanoid(def.look, { outline: true, flash });
        M.flash = flash;
        M.root.scale.multiplyScalar(1.3);
        barH = 2.55 * 1.3 * (def.look.height || 1) + 0.3;
        const hd = this.state.hero(u.id);
        const petId = hd ? PETS[hd.pet]?.id : 'fox';
        if (petId) { pet = buildPet(petId); pet.seed = u.id; pet.root.scale.setScalar(1.35); this.scene.add(pet.root); pet.pos = new THREE.Vector3(u.x, 0, u.z); }
        const ringCol = u.id === this.myId ? 0x6dff9a : team === this.myTeam ? 0x4fb8ff : 0xff4d63;
        const ring = new THREE.Mesh(ringGeo, glowBasic(ringCol, 1.6));
        ring.scale.setScalar(1.15);
        ring.material.opacity = 0.85;
        ring.position.y = 0.06; ring.renderOrder = 2;
        root.add(ring);
        if (u.id === this.myId) {
          const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.36, 3).rotateX(Math.PI / 2), glowBasic(ringCol, 1.8));
          arrow.position.set(0, 0.07, 1.05); arrow.scale.y = 0.25;
          root.add(arrow);
        }
        break;
      }
      case 1: {
        const type = MINION_TYPE_LIST[u.type];
        M = buildMinion(type, team);
        if (type !== 'titan') M.root.scale.setScalar(1.2);
        barH = type === 'siege' ? 2.4 : type === 'titan' ? 4.2 : 1.8;
        break;
      }
      case 2: M = buildTower(team); barH = 8.2; break;
      case 3: M = buildCore(team); barH = 8.6; break;
      case 4: {
        const type = MONSTER_LIST[u.type];
        M = buildMonster(type);
        const T = MONSTERS[type];
        if (T.scale && T.scale !== 1) M.root.scale.setScalar(T.scale);
        barH = type === 'titan' ? 6.6 : type === 'tortoise' ? 4.2 : type === 'owl' || type === 'stag' ? 2.8 : 1.6;
        label = T.boss ? T.name : '';
        break;
      }
    }
    M.seed = u.id % 7;
    root.add(M.root);
    if (u.kind <= 1 || u.kind === 4) {
      const blob = new THREE.Mesh(blobGeo, blobMat());
      const r = u.kind === 4 && (MONSTER_LIST[u.type] === 'titan' || MONSTER_LIST[u.type] === 'tortoise') ? 3 : u.kind === 0 ? 0.8 : 0.6;
      blob.scale.set(r, 1, r); blob.position.y = 0.04; blob.renderOrder = 1;
      root.add(blob);
    }
    if (u.kind === 2 || u.kind === 3) { M.rubble.root.visible = false; root.add(M.rubble.root); }
    this.scene.add(root);
    const v = { id: u.id, kind: u.kind, team, root, M, pet, barH, label, phase: 0, fade: 1, deadAt: -1, status: {}, boss: label !== '', facing: u.facing };
    return v;
  }
  status(v, key, make) {
    if (!v.status[key]) { v.status[key] = make(); v.root.add(v.status[key]); }
    v.status[key].visible = true;
    return v.status[key];
  }
  hideStatus(v, key) { if (v.status[key]) v.status[key].visible = false; }
  updateView(v, u, dt) {
    const t = this.time;
    const alive = (u.flags & F.alive) !== 0;
    const visible = this.state.visibleTo(u, this.myTeam) || !alive && u.kind >= 2;
    const y = this.env.height(u.x, u.z);
    v.root.position.set(u.x, y + (u.airH || 0), u.z);
    v.x = u.x; v.z = u.z; v.y = y;
    // facing smoothing
    let d = u.facing - v.facing;
    while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    v.facing += d * Math.min(1, dt * 14);
    const speed = Math.hypot(u.vx || 0, u.vz || 0);
    v.phase += dt * (5 + speed * 1.45);
    const st = { speed: (u.flags & F.dash) ? 0 : speed, phase: v.phase, anim: u.anim, age: u.animAge, dash: (u.flags & F.dash) !== 0, dashP: Math.min(1, u.animAge / 0.4), recall: (u.flags & F.recall) !== 0, stun: (u.flags & (F.stun | F.sleep)) !== 0, air: (u.flags & F.air) !== 0, dead: !alive, deadAge: 0 };
    if (!alive) { if (v.deadAt < 0) v.deadAt = t; st.deadAge = t - v.deadAt; } else v.deadAt = -1;
    v.M.t = t;
    if (u.kind === 0) {
      v.M.root.rotation.y = v.facing;
      poseHumanoid(v.M, st, t);
      if (v.M.flash.value > 0) v.M.flash.value = Math.max(0, v.M.flash.value - dt * 4);
      // pet follows
      if (v.pet) {
        const P = v.pet;
        const side = 1.1, back = -1.0;
        const ox = Math.sin(v.facing) * back + Math.cos(v.facing) * side, oz = Math.cos(v.facing) * back - Math.sin(v.facing) * side;
        const tx = u.x + ox, tz = u.z + oz;
        const prev = P.pos.clone();
        P.pos.x += (tx - P.pos.x) * Math.min(1, dt * 5); P.pos.z += (tz - P.pos.z) * Math.min(1, dt * 5);
        const pv = Math.hypot(P.pos.x - prev.x, P.pos.z - prev.z) / Math.max(dt, 1e-3);
        P.root.position.set(P.pos.x, this.env.height(P.pos.x, P.pos.z), P.pos.z);
        if (pv > 0.3) P.face = Math.atan2(P.pos.x - prev.x, P.pos.z - prev.z);
        else P.face = P.face ?? v.facing;
        P.root.rotation.y += ((P.face - P.root.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 8);
        animatePet(P, { speed: pv }, t + P.seed);
        P.root.visible = visible && alive;
      }
    } else if (u.kind === 1 || u.kind === 4) {
      v.M.root.rotation.y = v.facing;
      v.M.root.position.y = 0;
      animateCreature(v.M, st, t);
    } else {
      animateStructure(v.M, t, alive, u.team);
      if (!alive && v.M.rubble) { v.M.rubble.root.visible = true; for (const k of Object.keys(v.M.bones)) if (k !== 'root') v.M.bones[k].visible = false; v.M.root.children.forEach((c) => { if (c.isMesh) c.visible = false; }); }
    }
    // visibility / death fade
    let show = visible;
    if (!alive) {
      if (u.kind === 0) show = st.deadAge < 2.2;
      else if (u.kind === 1 || u.kind === 4) show = st.deadAge < 2.4;
    }
    v.root.visible = show;
    // status effects
    const fl = u.flags;
    if (alive && show) {
      if (fl & F.shield) { const s = this.status(v, 'shield', () => new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), shieldMat)); s.scale.setScalar(u.kind === 0 ? 1.25 : 1.5); s.position.y = 1.1; } else this.hideStatus(v, 'shield');
      if (fl & (F.stun | F.sleep)) {
        const s = this.status(v, 'stun', () => { const g = new THREE.Group(); for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), glowBasic(0xfff27a, 2.2)); m.position.set(Math.cos(i * 2.1) * 0.4, 0, Math.sin(i * 2.1) * 0.4); g.add(m); } return g; });
        s.position.y = v.barH - 0.1; s.rotation.y = t * 5;
      } else this.hideStatus(v, 'stun');
      if (fl & F.root) { const s = this.status(v, 'root', () => new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.09, 6, 16).rotateX(Math.PI / 2), glowBasic(0xbff3ff, 1.8))); s.position.y = 0.25; s.rotation.y = t; } else this.hideStatus(v, 'root');
      if ((fl & F.ember) || (fl & F.azure)) {
        const s = this.status(v, 'buff', () => new THREE.Mesh(new THREE.RingGeometry(0.95, 1.15, 40).rotateX(-Math.PI / 2), glowBasic(0xffffff, 1.4)));
        s.material.color.set(fl & F.ember ? 0xff8a3a : 0x58c8ff).multiplyScalar(1.6); s.position.y = 0.08; s.rotation.y = t * 1.5; s.scale.setScalar(1 + Math.sin(t * 4) * 0.05);
      } else this.hideStatus(v, 'buff');
      if (fl & F.recall) {
        const s = this.status(v, 'recall', () => { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 5, 24, 1, true).translate(0, 2.5, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x9fe8ff).multiplyScalar(1.6), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); g.add(m); const r = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.25, 40).rotateX(-Math.PI / 2), glowBasic(0x9fe8ff, 1.8)); r.position.y = 0.07; g.add(r); return g; });
        s.children[0].material.opacity = 0.25 + 0.15 * Math.sin(t * 8);
        if (Math.random() < 0.5) this.fx.parts.emit(u.x + (Math.random() - 0.5) * 1.6, v.y + 0.2, u.z + (Math.random() - 0.5) * 1.6, 0, 2.5, 0, 0.9, 0.35, 0x9fe8ff, 1, -1, 0);
      } else this.hideStatus(v, 'recall');
      if ((fl & F.burn) && Math.random() < 0.5) this.fx.parts.emit(u.x + (Math.random() - 0.5) * 0.6, v.y + 0.6 + Math.random(), u.z + (Math.random() - 0.5) * 0.6, 0, 1.5, 0, 0.5, 0.5, Math.random() < 0.5 ? 0xff7a3a : 0xffcf6b, 0, -1, 1, 0.5);
      if ((fl & F.slow) && Math.random() < 0.15) this.fx.parts.emit(u.x + (Math.random() - 0.5) * 0.8, v.y + 0.3, u.z + (Math.random() - 0.5) * 0.8, 0, 0.6, 0, 0.6, 0.3, 0x9fd8ff, 2, 0.5, 0);
      if ((fl & F.regen) && Math.random() < 0.3) this.fx.parts.emit(u.x + (Math.random() - 0.5) * 1, v.y + 0.3, u.z + (Math.random() - 0.5) * 1, 0, 1.5, 0, 0.8, 0.3, 0x8dffb0, 1, -0.5, 0);
      if ((fl & F.haste) && speed > 2 && Math.random() < 0.4) this.fx.parts.emit(u.x, v.y + 0.5 + Math.random(), u.z, -(u.vx || 0) * 0.3, 0.2, -(u.vz || 0) * 0.3, 0.35, 0.3, 0xe8fbff, 0, 0, 2);
      if ((fl & F.invis) && u.team === this.myTeam && Math.random() < 0.3) this.fx.parts.emit(u.x + (Math.random() - 0.5) * 0.8, v.y + Math.random() * 2, u.z + (Math.random() - 0.5) * 0.8, 0, 0.4, 0, 0.6, 0.3, 0xe8f2ff, 1, 0, 0);
    } else for (const k of Object.keys(v.status)) v.status[k].visible = false;
    // flying pets / pets hidden with hero
    if (v.pet && !show) v.pet.root.visible = false;
    return { id: u.id, kind: u.kind, team: u.team, x: u.x, y: v.y + (u.airH || 0), z: u.z, hp: u.hp, maxHp: u.maxHp, mana: u.mana, maxMana: u.maxMana, shield: u.shield, level: u.level, alive, visible: show && alive, barH: v.barH, recall: u.recall, boss: v.boss, label: v.label, invuln: (fl & F.invuln) !== 0 };
  }
  // ---------------------------------------------------------------- frame
  frame(dt) {
    this.time += dt;
    const S = this.state;
    S.tick(dt);
    const snap = S.sample();
    if (!snap) return;
    this.lastSample = snap;
    const seen = new Set();
    const bars = [];
    let me = null;
    for (const h of S.heroList) this.heroNames.set(h.id, h.name);
    for (const u of snap.units) {
      seen.add(u.id);
      let v = this.views.get(u.id);
      if (!v) { v = this.makeView(u); this.views.set(u.id, v); }
      const b = this.updateView(v, u, dt);
      bars.push(b);
      if (u.id === this.myId) me = u;
    }
    for (const [id, v] of this.views) if (!seen.has(id)) { this.scene.remove(v.root); if (v.pet) this.scene.remove(v.pet.root); this.views.delete(id); }
    // events
    for (const e of S.takeEvents()) this.handleEvent(e);
    this.fx.syncProjectiles(snap.projs.filter((p) => true), dt);
    this.fx.syncZones(snap.zones, this.myTeam);
    this.fx.update(dt, this.core.viewH);
    // camera
    const target = new THREE.Vector3();
    if (this.camOverride) target.set(this.camOverride.x, 0, this.camOverride.z);
    else if (me) target.set(me.x, 0, me.z);
    else target.copy(this.core.camTarget);
    target.y = this.env.height(target.x, target.z);
    this.core.updateCamera(dt, target, this.camYaw, this.zoom || 1);
    U.uPlayer.value.set(me ? me.x : 9999, 0, me ? me.z : 9999);
    // tower range warnings
    this.updateTowerRings(snap.units, me);
    // fog of war
    this.fowT -= dt;
    if (this.fowT <= 0) { this.fowT = 0.15; this.drawFow(snap.units); }
    this.bars = bars;
    this.me = me;
    // grayscale when dead
    const dead = me && !(me.flags & F.alive);
    this.core.grade.uniforms.uGray.value += ((dead ? 0.75 : 0) - this.core.grade.uniforms.uGray.value) * Math.min(1, dt * 3);
  }
  render(dt) {
    this.core.render(dt, this.time);
    if (this.bars) this.overlay.draw(this.core.camera, this.bars, this.myId, this.myTeam, dt, this.heroNames);
  }
  updateTowerRings(units, me) {
    for (const u of units) {
      if ((u.kind !== 2 && u.kind !== 3) || u.team === this.myTeam) continue;
      let ring = this.towerRings.get(u.id);
      const near = me && (me.flags & F.alive) && (u.flags & F.alive) && Math.hypot(me.x - u.x, me.z - u.z) < 13;
      if (!ring && near) {
        ring = new THREE.Mesh(new THREE.RingGeometry(8.6, 8.9, 72).rotateX(-Math.PI / 2), glowBasic(0xff4d63, 1.5));
        ring.position.set(u.x, this.env.height(u.x, u.z) + 0.12, u.z);
        this.scene.add(ring); this.towerRings.set(u.id, ring);
      }
      if (ring) { ring.visible = !!near; ring.material.opacity = 0.6 + 0.3 * Math.sin(this.time * 6); }
    }
  }
  drawFow(units) {
    const g = this.fowCanvas.getContext('2d');
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#000'; g.fillRect(0, 0, 128, 128);
    g.globalCompositeOperation = 'lighter';
    const k = 128 / 120;
    for (const u of units) {
      if (u.team !== this.myTeam || !(u.flags & F.alive)) continue;
      const r = (u.kind === 0 ? 11 : u.kind === 1 ? 7 : 10.5) * k;
      const x = (u.x + 60) * k, y = (u.z + 60) * k;
      const gr = g.createRadialGradient(x, y, r * 0.55, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    this.fowTex.needsUpdate = true;
  }
  unitPos(id) { const v = this.views.get(id); return v ? { x: v.x, y: v.y, z: v.z, barH: v.barH, kind: v.kind, team: v.team } : null; }
  handleEvent(e) {
    switch (e[0]) {
      case 'fx': this.fx.event(e); break;
      case 'tele': { const [, x, z, r, dur, kind, team] = e; this.fx.telegraph(x, z, r, dur, team === this.myTeam ? 0x58c8ff : 0xff4d63); void kind; break; }
      case 'hit': { const p = this.unitPos(e[1]); if (p && this.views.get(e[1]).root.visible) this.fx.hit(p.x, p.z, e[2], e[2] === 1 ? (p.team === 0 ? 0xff7a8a : 0x7fd0ff) : 0xfff2d0); break; }
      case 'dmg': {
        const [, tid, amt, type, crit, src] = e;
        const p = this.unitPos(tid);
        if (!p) break;
        const v = this.views.get(tid);
        if (type !== 3 && v && v.M && v.M.flash && amt > 30) v.M.flash.value = 0.45;
        const mine = src === this.myId || tid === this.myId;
        if (!mine && type !== 3) break;
        if (type === 3 && tid !== this.myId && src !== this.myId) break;
        const color = type === 3 ? '#7dff9e' : tid === this.myId ? '#ff6b6b' : type === 1 ? '#c9a2ff' : type === 2 ? '#ffffff' : crit ? '#ffd84a' : '#ffe9c2';
        this.overlay.number(p.x, p.y + p.barH - 0.4, p.z, (type === 3 ? '+' : '') + amt + (crit ? '!' : ''), color, crit ? 22 : type === 3 ? 15 : 16, crit ? 2 : 0);
        break;
      }
      case 'gold': if (e[1] === this.myId) this.overlay.number(e[3], this.env.height(e[3], e[4]) + 2.2, e[4], '+' + e[2], '#ffd54a', 14, 1); break;
      case 'shake': this.core.shake = Math.max(this.core.shake, e[1]); break;
      case 'lvl': { const p = this.unitPos(e[1]); if (p) { this.fx.pillar(p.x, p.z, 0.8, 4, 0xffe08a, 0.8); this.fx.ringBurst(p.x, p.z, 0.8, 20, 0xffe08a, { shape: 1, vy: 3, grav: -1 }); } break; }
    }
    this.onEvent(e);
  }
}
