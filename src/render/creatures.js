// Minions, jungle monsters, bosses, towers, cores and pets (prototype-cached geometry).
import * as THREE from 'three';
import { toonMat, glowMat, PartBuilder, mtx, noise2 } from './materials.js';

const TEAM = [
  { main: '#4f86d8', light: '#d8e8fb', accent: '#9fe6ff', glow: '#58c8ff', metal: '#c9d6ea' },
  { main: '#c83c5c', light: '#fbe0e6', accent: '#ffd36b', glow: '#ff5a78', metal: '#e8d2b8' },
];
let MATS = null;
export function creatureMats() {
  if (MATS) return MATS;
  MATS = { toon: toonMat({ rim: 0xdfefff }), glow: glowMat(2.6), glowSoft: glowMat(1.6) };
  return MATS;
}
const capsule = (r, l, rs = 8) => new THREE.CapsuleGeometry(r, Math.max(0.001, l), 3, rs);
const sph = (r, w = 12, h = 8) => new THREE.SphereGeometry(r, w, h);

class Proto {
  constructor() { this.bones = []; this.pbs = new Map(); this.bones.push({ name: 'root', parent: null, p: [0, 0, 0] }); }
  bone(name, parent, x = 0, y = 0, z = 0) { this.bones.push({ name, parent, p: [x, y, z] }); return this; }
  add(bone, geo, color, m, kind = 'toon', opts) {
    const k = bone + ':' + kind;
    if (!this.pbs.has(k)) this.pbs.set(k, new PartBuilder());
    this.pbs.get(k).add(geo, color, m, opts);
    return this;
  }
  bake() { this.geos = []; for (const [k, pb] of this.pbs) { const [bone, kind] = k.split(':'); this.geos.push({ bone, kind, g: pb.geometry() }); } this.pbs = null; return this; }
  instance(shadow = true) {
    const mats = creatureMats();
    const bones = {};
    for (const b of this.bones) {
      const g = new THREE.Group();
      g.position.set(...b.p);
      bones[b.name] = g;
      if (b.parent) bones[b.parent].add(g);
    }
    for (const { bone, kind, g } of this.geos) {
      const m = new THREE.Mesh(g, mats[kind] || mats.toon);
      m.castShadow = shadow && kind === 'toon';
      bones[bone].add(m);
    }
    return { root: bones.root, bones };
  }
}
const CACHE = new Map();
function proto(key, fn) { if (!CACHE.has(key)) { const p = new Proto(); fn(p); CACHE.set(key, p.bake()); } return CACHE.get(key); }

// ------------------------------------------------------------------ minions
function minionProto(type, team) {
  const T = TEAM[team];
  return proto('minion:' + type + team, (P) => {
    if (type === 'melee') {
      P.bone('body', 'root', 0, 0.5, 0).bone('armR', 'body', -0.2, 0.32, 0).bone('armL', 'body', 0.2, 0.32, 0).bone('legL', 'root', 0.09, 0.42, 0).bone('legR', 'root', -0.09, 0.42, 0);
      P.add('body', sph(0.2), T.metal, mtx(0, 0.22, 0, 0, 0, 0, 1, 1.05, 0.85));
      P.add('body', new THREE.CylinderGeometry(0.17, 0.22, 0.2, 10), T.main, mtx(0, 0.02, 0));
      P.add('body', sph(0.2), T.metal, mtx(0, 0.58, 0.0, 0, 0, 0, 1, 0.95, 1));
      P.add('body', new THREE.BoxGeometry(0.26, 0.05, 0.05), '#1c2433', mtx(0, 0.58, 0.18));
      P.add('body', new THREE.ConeGeometry(0.07, 0.3, 6), T.main, mtx(0, 0.82, -0.04, -0.4));
      P.add('armR', capsule(0.05, 0.16), T.metal, mtx(0, -0.12, 0));
      P.add('armR', new THREE.BoxGeometry(0.03, 0.42, 0.06), '#e8f2ff', mtx(0, -0.25, 0.22, Math.PI / 2), 'glowSoft');
      P.add('armL', capsule(0.05, 0.16), T.metal, mtx(0, -0.12, 0));
      P.add('armL', new THREE.CylinderGeometry(0.17, 0.17, 0.04, 12), T.main, mtx(0.07, -0.18, 0.06, 0, 0, Math.PI / 2));
      P.add('armL', sph(0.05), T.accent, mtx(0.1, -0.18, 0.06), 'glow');
      for (const L of ['legL', 'legR']) P.add(L, capsule(0.06, 0.26), '#3a4560', mtx(0, -0.2, 0));
    } else if (type === 'ranged') {
      P.bone('body', 'root', 0, 0.45, 0).bone('armR', 'body', -0.17, 0.36, 0).bone('armL', 'body', 0.17, 0.36, 0).bone('legL', 'root', 0.08, 0.38, 0).bone('legR', 'root', -0.08, 0.38, 0);
      const robe = new THREE.ConeGeometry(0.28, 0.75, 12, 1, true);
      P.add('body', robe, T.main, mtx(0, 0.12, 0));
      P.add('body', new THREE.CylinderGeometry(0.16, 0.18, 0.3, 10), T.main, mtx(0, 0.3, 0));
      P.add('body', sph(0.18), '#f2d6c6', mtx(0, 0.6, 0.02));
      P.add('body', new THREE.SphereGeometry(0.22, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), T.light, mtx(0, 0.62, -0.02, -0.2));
      P.add('body', new THREE.ConeGeometry(0.12, 0.3, 8), T.light, mtx(0, 0.86, -0.12, -0.5));
      P.add('armR', capsule(0.045, 0.14), T.main, mtx(0, -0.1, 0));
      P.add('armR', new THREE.CylinderGeometry(0.018, 0.018, 0.6, 5), '#6b4a3a', mtx(0, -0.05, 0.1));
      P.add('armR', sph(0.08), T.glow, mtx(0, 0.26, 0.1), 'glow');
      P.add('armL', capsule(0.045, 0.14), T.main, mtx(0, -0.1, 0));
      for (const L of ['legL', 'legR']) P.add(L, capsule(0.05, 0.2), '#2c3448', mtx(0, -0.16, 0));
    } else if (type === 'siege') {
      P.bone('body', 'root', 0, 0.7, 0).bone('armR', 'body', -0.48, 0.38, 0).bone('armL', 'body', 0.48, 0.38, 0).bone('legL', 'root', 0.24, 0.6, 0).bone('legR', 'root', -0.24, 0.6, 0);
      const rockFn = (x, y, z, nx, ny, nz, c) => (ny > 0.6 ? c.set('#f4f8ff') : c.set(noise2(x * 6, z * 6 + y * 4) > 0 ? '#8a9bb8' : '#7586a6'));
      P.add('body', new THREE.IcosahedronGeometry(0.5, 0), '#8a9bb8', mtx(0, 0.25, 0, 0, 0, 0, 1.1, 1, 0.9), 'toon', { colorFn: rockFn });
      P.add('body', new THREE.IcosahedronGeometry(0.26, 0), '#8a9bb8', mtx(0, 0.82, 0.08), 'toon', { colorFn: rockFn });
      P.add('body', new THREE.OctahedronGeometry(0.18), T.glow, mtx(0, 0.3, 0.42, 0, 0, 0, 1, 1.3, 0.6), 'glow');
      for (const s of [-1, 1]) P.add('body', new THREE.OctahedronGeometry(0.06), T.glow, mtx(s * 0.09, 0.85, 0.3), 'glow');
      for (const [L, s] of [['armR', -1], ['armL', 1]]) { P.add(L, new THREE.IcosahedronGeometry(0.18, 0), '#7586a6', mtx(0, -0.15, 0), 'toon', { colorFn: rockFn }); P.add(L, new THREE.IcosahedronGeometry(0.22, 0), '#8a9bb8', mtx(0, -0.48, 0.05), 'toon', { colorFn: rockFn }); P.add(L, new THREE.ConeGeometry(0.06, 0.25, 5), T.glow, mtx(s * 0.08, -0.4, 0.2, 1.2), 'glow'); }
      for (const L of ['legL', 'legR']) P.add(L, new THREE.IcosahedronGeometry(0.2, 0), '#6c7c9c', mtx(0, -0.35, 0), 'toon', { colorFn: rockFn });
    }
  });
}
export function buildMinion(type, team) {
  if (type === 'titan') { const m = buildMonster('titan', team); m.root.scale.setScalar(0.62); return m; }
  const inst = minionProto(type, team).instance();
  return { ...inst, kind: 'minion', type };
}

// ------------------------------------------------------------------ monsters
function quadruped(P, o) {
  P.bone('body', 'root', 0, o.h, 0).bone('head', 'body', 0, o.headY, o.len * 0.55).bone('tail', 'body', 0, 0.05, -o.len * 0.5);
  for (const [n, x, z] of [['legFL', o.w, o.len * 0.36], ['legFR', -o.w, o.len * 0.36], ['legBL', o.w, -o.len * 0.36], ['legBR', -o.w, -o.len * 0.36]]) P.bone(n, 'body', x, -o.h * 0.15, z);
}
function monsterProto(type, team) {
  return proto('mon:' + type + (team ?? ''), (P) => {
    switch (type) {
      case 'wolf': case 'wolfBig': {
        const big = type === 'wolfBig';
        const o = { h: 0.62, w: 0.17, len: 1.0, headY: 0.18 };
        quadruped(P, o);
        const fur = big ? '#e8eef8' : '#cfd9e8', dark = '#7d8aa3';
        const furFn = (x, y, z, nx, ny, nz, c) => (ny < -0.2 ? c.set('#f6f9ff') : c.set(noise2(x * 8, z * 8) > 0.2 ? dark : fur));
        P.add('body', capsule(0.25, 0.6), fur, mtx(0, 0, 0, Math.PI / 2), 'toon', { colorFn: furFn });
        P.add('body', sph(0.3), fur, mtx(0, 0.05, 0.3, 0, 0, 0, 1, 1.05, 1), 'toon', { colorFn: furFn });
        P.add('head', sph(0.2), fur, mtx(0, 0.05, 0.08), 'toon', { colorFn: furFn });
        P.add('head', new THREE.ConeGeometry(0.12, 0.3, 8), fur, mtx(0, -0.02, 0.32, Math.PI / 2));
        P.add('head', sph(0.04), '#1a1a22', mtx(0, -0.02, 0.47));
        for (const s of [-1, 1]) { P.add('head', new THREE.ConeGeometry(0.07, 0.2, 4), fur, mtx(s * 0.11, 0.2, 0.0, -0.2, 0, -s * 0.3)); P.add('head', sph(0.032), '#7ff0ff', mtx(s * 0.09, 0.08, 0.22), 'glow'); }
        for (const L of ['legFL', 'legFR', 'legBL', 'legBR']) P.add(L, capsule(0.06, 0.38), fur, mtx(0, -0.24, 0));
        P.add('tail', new THREE.ConeGeometry(0.1, 0.5, 8), fur, mtx(0, 0, -0.22, -Math.PI / 2 + 0.6));
        if (big) for (let i = 0; i < 5; i++) P.add('body', new THREE.ConeGeometry(0.06, 0.28, 6), '#9fe8ff', mtx(0, 0.28, 0.25 - i * 0.14, -0.4), 'glow');
        break;
      }
      case 'stag': {
        const o = { h: 1.05, w: 0.2, len: 1.2, headY: 0.65 };
        quadruped(P, o);
        const fur = '#a86f4a', belly = '#f2dcc4';
        P.add('body', capsule(0.3, 0.7), fur, mtx(0, 0, 0, Math.PI / 2), 'toon', { colorFn: (x, y, z, nx, ny, nz, c) => (ny < -0.3 ? c.set(belly) : c.set(fur)) });
        P.add('body', capsule(0.12, 0.5), fur, mtx(0, 0.35, 0.45, -0.7));
        P.add('head', sph(0.16), fur, mtx(0, 0.0, 0.05));
        P.add('head', new THREE.ConeGeometry(0.1, 0.28, 8), fur, mtx(0, -0.05, 0.25, Math.PI / 2 + 0.2));
        for (const s of [-1, 1]) {
          P.add('head', sph(0.03), '#ffcf6b', mtx(s * 0.08, 0.04, 0.15), 'glow');
          for (let i = 0; i < 4; i++) P.add('head', new THREE.CylinderGeometry(0.02, 0.03, 0.32, 5), '#ffb347', mtx(s * (0.1 + i * 0.07), 0.18 + i * 0.16, -0.02 - i * 0.03, -0.2, 0, -s * (0.35 + i * 0.12)), 'glow');
          P.add('head', new THREE.CylinderGeometry(0.015, 0.02, 0.22, 5), '#ff8a3a', mtx(s * 0.22, 0.35, 0.05, 0.6, 0, -s * 0.9), 'glow');
        }
        for (const L of ['legFL', 'legFR', 'legBL', 'legBR']) { P.add(L, capsule(0.06, 0.7), fur, mtx(0, -0.42, 0)); P.add(L, sph(0.05), '#3a2a22', mtx(0, -0.82, 0)); }
        P.add('tail', sph(0.1), belly, mtx(0, 0.05, -0.05));
        for (let i = 0; i < 4; i++) P.add('body', new THREE.ConeGeometry(0.05, 0.22, 5), '#ff9a3a', mtx(0, 0.3, 0.2 - i * 0.18, -0.6), 'glow');
        break;
      }
      case 'beetle': case 'beetleBig': {
        const big = type === 'beetleBig';
        P.bone('body', 'root', 0, 0.35, 0).bone('legsL', 'body', 0.25, -0.1, 0).bone('legsR', 'body', -0.25, -0.1, 0).bone('head', 'body', 0, 0, 0.42);
        P.add('body', new THREE.SphereGeometry(0.45, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), '#5b6fa0', mtx(0, -0.05, 0, 0, 0, 0, 1, 0.75, 1.2));
        P.add('body', sph(0.3), '#3d4a6e', mtx(0, -0.05, 0, 0, 0, 0, 1.3, 0.5, 1.4));
        const n = big ? 7 : 4;
        for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; P.add('body', new THREE.ConeGeometry(0.07, 0.4 + (i % 2) * 0.15, 6), i % 2 ? '#9fe8ff' : '#c9a8ff', mtx(Math.cos(a) * 0.2, 0.32, Math.sin(a) * 0.25, Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4), 'glow'); }
        P.add('head', sph(0.17), '#3d4a6e', mtx(0, 0, 0.02));
        for (const s of [-1, 1]) { P.add('head', new THREE.ConeGeometry(0.035, 0.28, 5), '#c9d6ea', mtx(s * 0.08, -0.02, 0.2, Math.PI / 2, 0, s * 0.4)); P.add('head', sph(0.03), '#7ff0ff', mtx(s * 0.08, 0.07, 0.13), 'glow'); }
        for (const [L, s] of [['legsL', 1], ['legsR', -1]]) for (let i = -1; i <= 1; i++) P.add(L, capsule(0.03, 0.32), '#2e3754', mtx(s * 0.12, -0.12, i * 0.22, 0, 0, s * 0.9));
        break;
      }
      case 'owl': {
        P.bone('body', 'root', 0, 1.0, 0).bone('head', 'body', 0, 0.55, 0.05).bone('wingL', 'body', 0.38, 0.25, -0.05).bone('wingR', 'body', -0.38, 0.25, -0.05);
        const fe = '#4a78c8', light = '#dfeaff';
        P.add('body', sph(0.45, 16, 12), fe, mtx(0, 0, 0, 0, 0, 0, 1, 1.15, 0.95));
        P.add('body', sph(0.36, 14, 10), light, mtx(0, -0.05, 0.14, 0, 0, 0, 0.9, 1.05, 0.7));
        P.add('head', sph(0.34, 16, 12), fe, mtx(0, 0, 0, 0, 0, 0, 1.1, 0.9, 1));
        for (const s of [-1, 1]) {
          P.add('head', sph(0.13), '#ffffff', mtx(s * 0.14, 0.0, 0.25, 0, 0, 0, 1, 1, 0.4));
          P.add('head', sph(0.08), '#7ff0ff', mtx(s * 0.14, 0.0, 0.3), 'glow');
          P.add('head', new THREE.ConeGeometry(0.08, 0.28, 4), fe, mtx(s * 0.22, 0.32, -0.02, 0, 0, -s * 0.4));
        }
        P.add('head', new THREE.ConeGeometry(0.05, 0.12, 4), '#ffcf6b', mtx(0, -0.08, 0.33, Math.PI / 2 + 0.4));
        for (const [W, s] of [['wingL', 1], ['wingR', -1]]) { P.add(W, sph(0.3, 12, 8), fe, mtx(s * 0.25, -0.15, 0, 0, 0, s * 0.3, 1.4, 0.4, 0.75)); for (let i = 0; i < 3; i++) P.add(W, new THREE.OctahedronGeometry(0.06), '#9fe8ff', mtx(s * (0.3 + i * 0.15), -0.12, 0.1, 0, 0, 0, 1, 1.6, 0.5), 'glow'); }
        P.add('body', new THREE.TorusGeometry(0.75, 0.025, 6, 32), '#7fd8ff', mtx(0, -0.85, 0, Math.PI / 2), 'glow');
        break;
      }
      case 'tortoise': {
        P.bone('body', 'root', 0, 1.1, 0).bone('head', 'body', 0, 0.05, 1.7);
        for (const [n, x, z] of [['legFL', 1.1, 0.9], ['legFR', -1.1, 0.9], ['legBL', 1.1, -0.9], ['legBR', -1.1, -0.9]]) P.bone(n, 'body', x, -0.4, z);
        const shellFn = (x, y, z, nx, ny, nz, c) => (Math.abs(noise2(x * 2.2, z * 2.2)) < 0.05 ? c.set('#2a5e70') : ny > 0.7 ? c.set('#eef6ff') : c.set('#3f8aa0'));
        P.add('body', new THREE.SphereGeometry(1.7, 22, 14, 0, Math.PI * 2, 0, Math.PI / 2), '#3f8aa0', mtx(0, -0.2, 0, 0, 0, 0, 1, 0.78, 1.15), 'toon', { colorFn: shellFn });
        P.add('body', new THREE.CylinderGeometry(1.72, 1.6, 0.35, 22), '#d8c89a', mtx(0, -0.32, 0, 0, 0, 0, 1, 1, 1.15));
        const spikes = [[0, 1.3, 0, 1.6], [0.7, 1.0, 0.5, 1.0], [-0.7, 1.0, 0.5, 1.1], [0.6, 1.0, -0.6, 1.2], [-0.6, 1.0, -0.6, 0.9], [0, 1.05, -1.0, 1.0], [0, 1.1, 0.95, 1.0]];
        for (const [x, y, z, h] of spikes) { P.add('body', new THREE.CylinderGeometry(0.14, 0.18, h, 6), '#bff3ff', mtx(x, y - 0.3 + h / 2, z, x * 0.2, 0, -x * 0.25), 'glow'); P.add('body', new THREE.ConeGeometry(0.14, 0.4, 6), '#ffffff', mtx(x - x * 0.12 * h, y - 0.3 + h + 0.18, z, x * 0.2, 0, -x * 0.25), 'glow'); }
        P.add('head', sph(0.42, 14, 10), '#7fb89a', mtx(0, 0.1, 0.25, 0, 0, 0, 1, 0.85, 1.25));
        P.add('head', capsule(0.3, 0.6), '#7fb89a', mtx(0, -0.05, -0.35, Math.PI / 2 - 0.2));
        for (const s of [-1, 1]) P.add('head', sph(0.07), '#7ff0ff', mtx(s * 0.22, 0.25, 0.55), 'glow');
        for (const L of ['legFL', 'legFR', 'legBL', 'legBR']) P.add(L, capsule(0.3, 0.5), '#6aa184', mtx(0, -0.35, 0));
        break;
      }
      case 'titan': {
        const glow = team === 0 ? '#58c8ff' : team === 1 ? '#ff5a78' : '#8fe6ff';
        P.bone('body', 'root', 0, 2.2, 0).bone('head', 'body', 0, 1.55, 0.2).bone('armL', 'body', 1.25, 1.1, 0).bone('armR', 'body', -1.25, 1.1, 0).bone('legL', 'body', 0.55, -0.3, 0).bone('legR', 'body', -0.55, -0.3, 0);
        const ice = (x, y, z, nx, ny, nz, c) => (ny > 0.6 ? c.set('#f4f9ff') : c.set(noise2(x * 3, y * 3 + z * 3) > 0 ? '#9fc6ea' : '#7fa8d8'));
        P.add('body', new THREE.IcosahedronGeometry(1.1, 1), '#9fc6ea', mtx(0, 0.75, 0, 0, 0, 0, 1.25, 1.05, 0.9), 'toon', { colorFn: ice });
        P.add('body', new THREE.IcosahedronGeometry(0.75, 0), '#7fa8d8', mtx(0, -0.05, 0, 0, 0, 0, 1.2, 0.8, 0.9), 'toon', { colorFn: ice });
        P.add('body', new THREE.OctahedronGeometry(0.38), glow, mtx(0, 0.85, 0.85, 0, 0, 0, 1, 1.3, 0.6), 'glow');
        for (const s of [-1, 1]) for (let i = 0; i < 3; i++) P.add('body', new THREE.ConeGeometry(0.16, 0.9 - i * 0.2, 6), '#dff4ff', mtx(s * (1.05 + i * 0.12), 1.55 + i * 0.1, -0.1 - i * 0.2, -0.2, 0, -s * (0.5 + i * 0.2)), 'glow');
        P.add('head', new THREE.IcosahedronGeometry(0.5, 0), '#9fc6ea', mtx(0, 0.2, 0, 0, 0, 0, 1, 0.9, 1), 'toon', { colorFn: ice });
        for (const s of [-1, 1]) P.add('head', sph(0.08), glow, mtx(s * 0.18, 0.25, 0.42), 'glow');
        for (let i = 0; i < 5; i++) P.add('head', new THREE.ConeGeometry(0.08, 0.5 - Math.abs(i - 2) * 0.1, 5), glow, mtx((i - 2) * 0.16, 0.75 - Math.abs(i - 2) * 0.06, -0.05, 0, 0, -(i - 2) * 0.25), 'glow');
        for (const [L, s] of [['armL', 1], ['armR', -1]]) { P.add(L, new THREE.IcosahedronGeometry(0.42, 0), '#7fa8d8', mtx(0, -0.4, 0), 'toon', { colorFn: ice }); P.add(L, new THREE.IcosahedronGeometry(0.55, 0), '#9fc6ea', mtx(s * 0.05, -1.25, 0.1), 'toon', { colorFn: ice }); P.add(L, new THREE.ConeGeometry(0.1, 0.5, 5), glow, mtx(s * 0.2, -1.2, 0.45, 1.3), 'glow'); }
        for (const L of ['legL', 'legR']) { P.add(L, new THREE.IcosahedronGeometry(0.45, 0), '#7fa8d8', mtx(0, -0.6, 0), 'toon', { colorFn: ice }); P.add(L, new THREE.IcosahedronGeometry(0.5, 0), '#9fc6ea', mtx(0, -1.35, 0.15, 0, 0, 0, 1, 0.6, 1.3), 'toon', { colorFn: ice }); }
        break;
      }
    }
  });
}
export function buildMonster(type, team) {
  const inst = monsterProto(type, team).instance();
  return { ...inst, kind: 'monster', type };
}

// ------------------------------------------------------------------ structures
function towerProto(team) {
  const T = TEAM[team];
  return proto('tower' + team, (P) => {
    P.bone('crystal', 'root', 0, 6.3, 0).bone('ring', 'root', 0, 6.3, 0);
    const stone = '#e4ecf7', stone2 = '#c9d6e8';
    P.add('root', new THREE.CylinderGeometry(1.55, 1.75, 0.5, 6), stone2, mtx(0, 0.25, 0));
    P.add('root', new THREE.CylinderGeometry(1.4, 1.5, 0.12, 6), '#f6faff', mtx(0, 0.55, 0));
    P.add('root', new THREE.CylinderGeometry(0.62, 0.95, 4.2, 6), stone, mtx(0, 2.6, 0));
    for (const y of [1.2, 2.6, 4.0]) P.add('root', new THREE.CylinderGeometry(0.85 - (y - 1.2) * 0.07, 0.88 - (y - 1.2) * 0.07, 0.16, 6), T.accent === '#ffd36b' ? '#e8c67a' : '#9fc2e8', mtx(0, y, 0));
    P.add('root', new THREE.CylinderGeometry(0.9, 0.62, 0.45, 6), stone2, mtx(0, 4.9, 0));
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; P.add('root', new THREE.BoxGeometry(0.16, 1.6, 0.16), stone, mtx(Math.cos(a) * 0.72, 5.8, Math.sin(a) * 0.72, Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2)); }
    P.add('root', new THREE.ConeGeometry(0.95, 0.45, 6), '#f6faff', mtx(0, 0.72, 0));
    P.add('root', new THREE.TorusGeometry(1.0, 0.07, 6, 6), T.main, mtx(0, 4.75, 0, Math.PI / 2));
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; P.add('root', new THREE.BoxGeometry(0.5, 1.1, 0.04), T.main, mtx(Math.cos(a) * 0.82, 3.1, Math.sin(a) * 0.82, 0, -a + Math.PI / 2, 0)); }
    P.add('crystal', new THREE.OctahedronGeometry(0.62, 0), T.glow, mtx(0, 0, 0, 0, 0, 0, 1, 1.7, 1), 'glow');
    P.add('crystal', new THREE.OctahedronGeometry(0.35, 0), '#ffffff', mtx(0, 0, 0, 0, 0.6, 0, 1, 1.7, 1), 'glow');
    P.add('ring', new THREE.TorusGeometry(1.0, 0.04, 6, 32), T.glow, mtx(0, 0, 0, Math.PI / 2), 'glow');
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; P.add('ring', new THREE.OctahedronGeometry(0.12), T.glow, mtx(Math.cos(a) * 1.0, 0, Math.sin(a) * 1.0, 0, 0, 0, 1, 1.5, 1), 'glow'); }
  });
}
function rubbleProto(team) {
  return proto('rubble' + team, (P) => {
    P.add('root', new THREE.CylinderGeometry(1.5, 1.75, 0.5, 6), '#b9c6da', mtx(0, 0.25, 0));
    P.add('root', new THREE.CylinderGeometry(0.62, 0.95, 1.3, 6), '#cfd9e8', mtx(0, 1.1, 0, 0.1, 0, 0.12));
    for (let i = 0; i < 7; i++) { const a = i * 1.7; P.add('root', new THREE.IcosahedronGeometry(0.3 + (i % 3) * 0.1, 0), '#c3cfe0', mtx(Math.cos(a) * 1.4, 0.3, Math.sin(a) * 1.4)); }
    P.add('root', new THREE.OctahedronGeometry(0.4, 0), '#7f8aa0', mtx(0.9, 0.35, -0.6, 1.2, 0, 0.4, 1, 1.6, 1));
  });
}
export function buildTower(team) { return { ...towerProto(team).instance(), kind: 'tower', rubble: rubbleProto(team).instance(false) }; }
function coreProto(team) {
  const T = TEAM[team];
  return proto('core' + team, (P) => {
    P.bone('crystal', 'root', 0, 5.2, 0).bone('ring', 'root', 0, 5.2, 0).bone('ring2', 'root', 0, 5.2, 0);
    P.add('root', new THREE.CylinderGeometry(3.2, 3.5, 0.6, 8), '#c9d6e8', mtx(0, 0.3, 0));
    P.add('root', new THREE.CylinderGeometry(2.5, 2.8, 0.6, 8), '#e4ecf7', mtx(0, 0.9, 0));
    P.add('root', new THREE.CylinderGeometry(1.7, 2.0, 0.6, 8), '#f6faff', mtx(0, 1.5, 0));
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; P.add('root', new THREE.CylinderGeometry(0.16, 0.22, 2.6, 6), '#f6faff', mtx(Math.cos(a) * 2.3, 2.4, Math.sin(a) * 2.3)); P.add('root', new THREE.OctahedronGeometry(0.2), T.glow, mtx(Math.cos(a) * 2.3, 3.9, Math.sin(a) * 2.3, 0, 0, 0, 1, 1.5, 1), 'glow'); }
    P.add('crystal', new THREE.OctahedronGeometry(1.25, 0), T.glow, mtx(0, 0, 0, 0, 0, 0, 1, 1.75, 1), 'glow');
    P.add('crystal', new THREE.OctahedronGeometry(0.7, 0), '#ffffff', mtx(0, 0, 0, 0, 0.5, 0, 1, 1.7, 1), 'glow');
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; P.add('crystal', new THREE.OctahedronGeometry(0.35, 0), T.glow, mtx(Math.cos(a) * 1.0, -0.8, Math.sin(a) * 1.0, Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5, 1, 1.8, 1), 'glow'); }
    P.add('ring', new THREE.TorusGeometry(2.0, 0.06, 6, 40), T.glow, mtx(0, 0, 0, Math.PI / 2), 'glow');
    P.add('ring2', new THREE.TorusGeometry(2.5, 0.04, 6, 40), '#ffffff', mtx(0, 0, 0, Math.PI / 2 + 0.3), 'glow');
  });
}
export function buildCore(team) { return { ...coreProto(team).instance(), kind: 'core', rubble: rubbleProto(team).instance(false) }; }

// ------------------------------------------------------------------ pets
function petProto(id) {
  return proto('pet:' + id, (P) => {
    P.bone('body', 'root', 0, 0.25, 0).bone('head', 'body', 0, 0.18, 0.14);
    switch (id) {
      case 'fox':
        P.bone('tail', 'body', 0, 0.05, -0.2);
        P.add('body', capsule(0.12, 0.18), '#ffffff', mtx(0, 0, 0, Math.PI / 2));
        P.add('head', sph(0.13), '#ffffff', mtx(0, 0, 0));
        P.add('head', new THREE.ConeGeometry(0.07, 0.14, 6), '#ffffff', mtx(0, -0.02, 0.14, Math.PI / 2));
        for (const s of [-1, 1]) { P.add('head', new THREE.ConeGeometry(0.06, 0.14, 4), '#ffffff', mtx(s * 0.07, 0.13, -0.02)); P.add('head', sph(0.025), '#1a2a3a', mtx(s * 0.06, 0.03, 0.11)); }
        P.add('tail', sph(0.12), '#ffffff', mtx(0, 0.06, -0.12, 0, 0, 0, 0.9, 0.9, 1.7));
        P.add('tail', sph(0.07), '#ffb36b', mtx(0, 0.1, -0.3));
        break;
      case 'penguin':
        P.add('body', sph(0.17), '#2b3550', mtx(0, 0.05, 0, 0, 0, 0, 1, 1.25, 0.95));
        P.add('body', sph(0.13), '#ffffff', mtx(0, 0.02, 0.07, 0, 0, 0, 1, 1.2, 0.8));
        P.add('head', sph(0.12), '#2b3550', mtx(0, 0.06, -0.08));
        P.add('head', new THREE.ConeGeometry(0.035, 0.09, 6), '#ffb347', mtx(0, 0.04, 0.06, Math.PI / 2));
        for (const s of [-1, 1]) { P.add('head', sph(0.022), '#ffffff', mtx(s * 0.05, 0.09, 0.01)); P.add('body', sph(0.06), '#2b3550', mtx(s * 0.16, 0.02, 0, 0, 0, s * 0.3, 0.4, 1.3, 0.8)); P.add('body', sph(0.045), '#ffb347', mtx(s * 0.06, -0.17, 0.06, 0, 0, 0, 1, 0.4, 1.4)); }
        break;
      case 'bunny':
        P.add('body', sph(0.15), '#fff6fb', mtx(0, 0, 0, 0, 0, 0, 1, 0.95, 1.1));
        P.add('head', sph(0.12), '#fff6fb', mtx(0, 0.02, -0.04));
        for (const s of [-1, 1]) { P.add('head', capsule(0.035, 0.16), '#fff6fb', mtx(s * 0.05, 0.2, -0.06, -0.2, 0, -s * 0.15)); P.add('head', capsule(0.018, 0.12), '#ff9ccf', mtx(s * 0.05, 0.2, -0.04, -0.2, 0, -s * 0.15)); P.add('head', sph(0.022), '#3a2a4a', mtx(s * 0.05, 0.04, 0.07)); }
        P.add('body', sph(0.05), '#ffffff', mtx(0, 0.02, -0.16));
        break;
      case 'owl':
        P.bone('wingL', 'body', 0.12, 0.05, 0).bone('wingR', 'body', -0.12, 0.05, 0);
        P.add('body', sph(0.14), '#f4f8ff', mtx(0, 0, 0, 0, 0, 0, 1, 1.15, 1));
        P.add('head', sph(0.12), '#f4f8ff', mtx(0, -0.02, -0.08));
        for (const s of [-1, 1]) { P.add('head', sph(0.04), '#ffcf5c', mtx(s * 0.045, 0.0, 0.02), 'glow'); P.add('head', sph(0.02), '#1a1a22', mtx(s * 0.045, 0.0, 0.05)); }
        P.add('wingL', sph(0.1), '#dfe8f8', mtx(0.06, 0, 0, 0, 0, 0, 1.3, 0.4, 0.9));
        P.add('wingR', sph(0.1), '#dfe8f8', mtx(-0.06, 0, 0, 0, 0, 0, 1.3, 0.4, 0.9));
        break;
      case 'sprite':
        P.bone('wingL', 'body', 0.04, 0.05, -0.03).bone('wingR', 'body', -0.04, 0.05, -0.03);
        P.add('body', sph(0.06), '#bff6ff', mtx(0, 0, 0), 'glow');
        P.add('head', sph(0.07), '#e8fbff', mtx(0, -0.1, -0.12), 'glow');
        P.add('wingL', sph(0.09), '#9fefff', mtx(0.08, 0.04, 0, 0, 0, 0.4, 1.2, 0.15, 0.7), 'glowSoft');
        P.add('wingR', sph(0.09), '#9fefff', mtx(-0.08, 0.04, 0, 0, 0, -0.4, 1.2, 0.15, 0.7), 'glowSoft');
        break;
      case 'seal':
        P.add('body', capsule(0.13, 0.2), '#e6eef8', mtx(0, -0.05, -0.05, Math.PI / 2));
        P.add('head', sph(0.12), '#e6eef8', mtx(0, -0.02, 0.0));
        for (const s of [-1, 1]) { P.add('head', sph(0.025), '#1a2030', mtx(s * 0.05, 0.03, 0.1)); P.add('body', sph(0.06), '#c9d6ea', mtx(s * 0.13, -0.12, 0.05, 0, 0, 0, 1, 0.3, 1.5)); }
        P.add('head', sph(0.025), '#4a5068', mtx(0, -0.02, 0.12));
        break;
      case 'dragon':
        P.bone('wingL', 'body', 0.08, 0.08, -0.02).bone('wingR', 'body', -0.08, 0.08, -0.02).bone('tail', 'body', 0, 0, -0.15);
        P.add('body', sph(0.12), '#6fc8ff', mtx(0, 0, 0, 0, 0, 0, 1, 1, 1.3));
        P.add('head', sph(0.11), '#6fc8ff', mtx(0, 0.02, 0.02));
        P.add('head', new THREE.ConeGeometry(0.06, 0.12, 6), '#6fc8ff', mtx(0, 0, 0.12, Math.PI / 2));
        for (const s of [-1, 1]) { P.add('head', new THREE.ConeGeometry(0.025, 0.12, 5), '#ffe08a', mtx(s * 0.05, 0.11, -0.03, -0.5)); P.add('head', sph(0.022), '#ffe08a', mtx(s * 0.05, 0.04, 0.08), 'glow'); }
        P.add('wingL', new THREE.ConeGeometry(0.12, 0.26, 3), '#9fe0ff', mtx(0.12, 0, 0, 0, 0, -Math.PI / 2, 1, 1, 0.15));
        P.add('wingR', new THREE.ConeGeometry(0.12, 0.26, 3), '#9fe0ff', mtx(-0.12, 0, 0, 0, 0, Math.PI / 2, 1, 1, 0.15));
        P.add('tail', new THREE.ConeGeometry(0.05, 0.25, 6), '#6fc8ff', mtx(0, 0, -0.1, -Math.PI / 2));
        break;
      case 'phoenix':
        P.bone('wingL', 'body', 0.08, 0.05, 0).bone('wingR', 'body', -0.08, 0.05, 0).bone('tail', 'body', 0, 0, -0.1);
        P.add('body', sph(0.11), '#a6ffdf', mtx(0, 0, 0, 0, 0, 0, 1, 1, 1.2), 'glowSoft');
        P.add('head', sph(0.09), '#e6fff6', mtx(0, 0.02, 0), 'glowSoft');
        P.add('head', new THREE.ConeGeometry(0.03, 0.08, 5), '#ffcf6b', mtx(0, 0, 0.1, Math.PI / 2));
        for (let i = 0; i < 3; i++) P.add('head', new THREE.ConeGeometry(0.02, 0.1, 4), '#ff9ccf', mtx(0, 0.1 + i * 0.01, -0.03 - i * 0.03, -0.6 - i * 0.2), 'glow');
        P.add('wingL', sph(0.12), '#ff9ccf', mtx(0.1, 0, 0, 0, 0, 0, 1.3, 0.2, 0.8), 'glowSoft');
        P.add('wingR', sph(0.12), '#ff9ccf', mtx(-0.1, 0, 0, 0, 0, 0, 1.3, 0.2, 0.8), 'glowSoft');
        for (let i = 0; i < 3; i++) P.add('tail', new THREE.ConeGeometry(0.035, 0.3, 4), i === 1 ? '#a6ffdf' : '#c9a8ff', mtx((i - 1) * 0.05, 0, -0.15, -Math.PI / 2 - 0.3, 0, (i - 1) * 0.3), 'glow');
        break;
    }
  });
}
export function buildPet(id) { return { ...petProto(id).instance(false), kind: 'pet', id, flying: ['owl', 'sprite', 'dragon', 'phoenix'].includes(id) }; }

// ------------------------------------------------------------------ animation
export function animateCreature(M, st, t) {
  const B = M.bones;
  const run = Math.min(1, (st.speed || 0) / 4);
  const ph = st.phase || 0;
  const atkP = st.anim && (st.anim === 'atk' || st.anim === 'atk2') && st.age < 0.5 ? st.age / 0.5 : -1;
  const strike = atkP >= 0 ? Math.sin(Math.min(1, atkP * 1.6) * Math.PI) : 0;
  if (M.kind === 'minion') {
    const big = M.type === 'siege';
    const s = Math.sin(ph);
    B.legL.rotation.x = -s * 0.8 * run; B.legR.rotation.x = s * 0.8 * run;
    B.body.position.y = (big ? 0.7 : M.type === 'ranged' ? 0.45 : 0.5) + Math.abs(Math.cos(ph)) * 0.05 * run + Math.sin(t * 2 + M.seed) * 0.01;
    B.body.rotation.x = 0.1 * run;
    B.armL.rotation.x = s * 0.5 * run - (M.type === 'melee' ? 0.5 : 0);
    B.armR.rotation.x = -s * 0.5 * run - strike * 1.8 + (M.type === 'melee' ? -0.3 : 0);
    if (M.type === 'ranged') B.armR.rotation.x = -0.5 - strike * 1.2;
    if (big) { B.armL.rotation.x = -strike * 1.5; B.armR.rotation.x = -strike * 1.5; }
  } else if (M.kind === 'monster') {
    const tp = M.type;
    if (B.legFL) {
      const sp = tp === 'tortoise' ? 0.5 : 1;
      const s = Math.sin(ph * sp);
      B.legFL.rotation.x = s * 0.6 * run; B.legBR.rotation.x = s * 0.6 * run; B.legFR.rotation.x = -s * 0.6 * run; B.legBL.rotation.x = -s * 0.6 * run;
      B.body.position.y = (tp === 'stag' ? 1.05 : tp === 'tortoise' ? 1.1 : 0.62) + Math.abs(Math.cos(ph)) * 0.05 * run + Math.sin(t * 1.5 + M.seed) * 0.015;
      B.head.rotation.x = -strike * 0.6 + Math.sin(t * 1.2 + M.seed) * 0.05;
      B.head.position.z = (tp === 'tortoise' ? 1.7 : tp === 'stag' ? 0.66 : 0.55) + strike * (tp === 'tortoise' ? 0.4 : 0.15);
      if (B.tail) B.tail.rotation.y = Math.sin(t * 6 + M.seed) * 0.4;
      if (tp === 'tortoise') B.body.rotation.x = -strike * 0.12;
    } else if (B.legsL) {
      const s = Math.sin(ph * 2);
      B.legsL.rotation.x = s * 0.4 * run; B.legsR.rotation.x = -s * 0.4 * run;
      B.body.position.y = 0.35 + Math.abs(s) * 0.03 * run;
      B.head.rotation.x = -strike * 0.5; B.body.position.z = strike * 0.2;
    } else if (B.wingL) {
      const f = Math.sin(t * (run > 0.1 ? 10 : 2.5) + M.seed) * (run > 0.1 ? 0.9 : 0.25) + strike * 1.2;
      B.wingL.rotation.z = f; B.wingR.rotation.z = -f;
      B.body.position.y = 1.0 + Math.sin(t * 2 + M.seed) * 0.12;
      B.head.rotation.y = Math.sin(t * 0.7 + M.seed) * 0.4;
    } else if (B.armL) {
      const s = Math.sin(ph * 0.6);
      B.legL.rotation.x = s * 0.5 * run; B.legR.rotation.x = -s * 0.5 * run;
      B.armL.rotation.x = -strike * 2.2 + s * 0.3 * run; B.armR.rotation.x = -strike * 2.2 - s * 0.3 * run;
      B.body.rotation.x = strike * 0.25;
      B.body.position.y = 2.2 + Math.sin(t * 1.2 + M.seed) * 0.05 - strike * 0.15;
    }
  }
  if (st.dead) {
    const d = Math.min(1, st.deadAge / 0.5);
    M.root.rotation.z = d * 1.5 * (M.seed % 2 ? 1 : -1);
    M.root.position.y -= Math.max(0, st.deadAge - 1.0) * 1.2;
  } else M.root.rotation.z = 0;
}
export function animateStructure(M, t, alive, team) {
  const B = M.bones;
  if (B.crystal) { B.crystal.rotation.y = t * 0.6; B.crystal.position.y = (M.kind === 'core' ? 5.2 : 6.3) + Math.sin(t * 1.4 + team) * 0.18; }
  if (B.ring) { B.ring.rotation.y = -t * 0.9; B.ring.rotation.x = Math.sin(t * 0.7) * 0.2; }
  if (B.ring2) { B.ring2.rotation.y = t * 0.5; B.ring2.rotation.z = Math.cos(t * 0.5) * 0.25; }
  void alive;
}
export function animatePet(M, st, t) {
  const B = M.bones;
  const moving = (st.speed || 0) > 0.5;
  if (M.flying) {
    B.body.position.y = 1.5 + Math.sin(t * 2.4 + 1) * 0.15;
    const f = Math.sin(t * (moving ? 16 : 9)) * 0.8;
    if (B.wingL) { B.wingL.rotation.z = f; B.wingR.rotation.z = -f; }
    if (B.tail) B.tail.rotation.x = Math.sin(t * 3) * 0.2;
  } else {
    const hop = moving ? Math.abs(Math.sin(t * 9)) * 0.16 : Math.abs(Math.sin(t * 1.6)) * 0.015;
    B.body.position.y = 0.17 + hop;
    B.body.rotation.x = moving ? -0.15 : 0;
    if (B.tail) B.tail.rotation.y = Math.sin(t * 5) * 0.4;
    B.head.rotation.y = Math.sin(t * 0.8) * 0.3;
  }
}
