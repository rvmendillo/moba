// Procedural anime-style hero models: rig of bones, each bone holds merged toon/glow meshes.
import * as THREE from 'three';
import { toonMat, glowMat, outlineMat, PartBuilder, mtx, canvasTex, noise2 } from './materials.js';

const C = (c) => new THREE.Color(c);
let SHARED = null;
export function sharedMats() {
  if (SHARED) return SHARED;
  SHARED = { glow: glowMat(2.4), outline: outlineMat(0.018, 0x141a2c), outlineThin: outlineMat(0.012, 0x141a2c) };
  return SHARED;
}

// ------------------------------------------------------------------ geometry helpers
const GEO = {};
function headGeo() {
  if (GEO.head) return GEO.head;
  const g = new THREE.SphereGeometry(1, 28, 20);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (y < 0) {
      const t = -y;
      const k = 1 - 0.24 * Math.pow(t, 1.6);
      x *= k; z *= 1 - 0.12 * Math.pow(t, 1.4);
      if (z > 0) z += 0.06 * t * z;
      y *= 1.02;
    }
    if (z < 0) z *= 0.94;
    p.setXYZ(i, x * 0.96, y, z * 0.97);
  }
  g.computeVertexNormals();
  GEO.head = g;
  return g;
}
export function skirtGeo(rTop, rBot, h, th = 0.025, segs = 20, flare = 0.15) {
  const pts = [];
  const n = 6;
  for (let i = 0; i <= n; i++) { const t = i / n; pts.push(new THREE.Vector2(rTop + (rBot - rTop) * (t + flare * Math.sin(t * Math.PI) * 0.0) * (1 + flare * t * t), -h * t)); }
  for (let i = n; i >= 0; i--) { const t = i / n; pts.push(new THREE.Vector2(Math.max(0.01, (rTop + (rBot - rTop) * t * (1 + flare * t * t)) - th), -h * t)); }
  pts.reverse(); // outer wall bottom->top so normals face outward
  return new THREE.LatheGeometry(pts, segs);
}
function capsule(r, len, rs = 10) { return new THREE.CapsuleGeometry(r, Math.max(0.001, len), 4, rs); }
function sph(r, ws = 14, hs = 10) { return new THREE.SphereGeometry(r, ws, hs); }
function halfSph(r) { return new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2); }
function blade(len, w, th) {
  const g = new THREE.OctahedronGeometry(1, 0);
  g.scale(w, len / 2, th);
  g.translate(0, len / 2, 0);
  return g;
}

// ------------------------------------------------------------------ face texture
export function faceTexture(look) {
  return canvasTex(512, 256, (g, W, H) => {
    g.fillStyle = look.skin; g.fillRect(0, 0, W, H);
    // subtle shading at the back of the head
    const cx = W * 0.25;
    const eyeY = H * 0.53, sep = W * 0.052;
    const female = !!look.female;
    if (look.body === 'yeti') {
      // cute yeti face: blue face patch
      g.fillStyle = '#cfe3ff';
      g.beginPath(); g.ellipse(cx, H * 0.56, W * 0.11, H * 0.17, 0, 0, Math.PI * 2); g.fill();
    }
    // blush
    for (const s of [-1, 1]) {
      const gr = g.createRadialGradient(cx + s * sep * 1.25, eyeY + H * 0.085, 0, cx + s * sep * 1.25, eyeY + H * 0.085, W * 0.025);
      gr.addColorStop(0, 'rgba(255,130,150,0.45)'); gr.addColorStop(1, 'rgba(255,130,150,0)');
      g.fillStyle = gr; g.fillRect(cx + s * sep * 1.25 - 20, eyeY + H * 0.085 - 20, 40, 40);
    }
    const ew = W * 0.021 * (female ? 1.08 : 1), eh = H * 0.062 * (female ? 1.1 : 0.95);
    for (const s of [-1, 1]) {
      const ex = cx + s * sep;
      // sclera
      g.fillStyle = '#ffffff';
      g.beginPath(); g.ellipse(ex, eyeY, ew * 1.05, eh, 0, 0, Math.PI * 2); g.fill();
      // iris
      const ir = g.createLinearGradient(0, eyeY - eh, 0, eyeY + eh);
      ir.addColorStop(0, '#1b1b2e'); ir.addColorStop(0.35, look.eyes); ir.addColorStop(1, '#ffffff');
      g.fillStyle = ir;
      g.beginPath(); g.ellipse(ex, eyeY + eh * 0.08, ew * 0.82, eh * 0.86, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(10,10,25,0.9)';
      g.beginPath(); g.ellipse(ex, eyeY + eh * 0.12, ew * 0.36, eh * 0.42, 0, 0, Math.PI * 2); g.fill();
      // highlights
      g.fillStyle = '#ffffff';
      g.beginPath(); g.ellipse(ex - s * ew * 0.25, eyeY - eh * 0.3, ew * 0.28, eh * 0.22, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(ex + s * ew * 0.3, eyeY + eh * 0.38, ew * 0.14, 0, Math.PI * 2); g.fill();
      // upper lash line
      g.strokeStyle = '#221a26'; g.lineCap = 'round';
      g.lineWidth = H * (female ? 0.018 : 0.014);
      g.beginPath(); g.ellipse(ex, eyeY + eh * 0.15, ew * 1.2, eh * 1.12, 0, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
      if (female) { g.beginPath(); g.moveTo(ex + s * ew * 1.1, eyeY - eh * 0.55); g.lineTo(ex + s * ew * 1.55, eyeY - eh * 0.85); g.stroke(); }
      g.lineWidth = H * 0.006;
      g.beginPath(); g.ellipse(ex, eyeY - eh * 0.1, ew * 1.0, eh * 1.05, 0, Math.PI * 0.2, Math.PI * 0.8); g.stroke();
      // brows
      g.strokeStyle = look.hair && look.hair.color && look.hair.style !== 'none' ? shade(look.hair.color, -0.35) : '#6b5a5a';
      g.lineWidth = H * 0.011;
      g.beginPath(); g.moveTo(ex - ew * 1.1, eyeY - eh * 1.55 - (s > 0 ? 0 : 0)); g.quadraticCurveTo(ex, eyeY - eh * 1.95, ex + ew * 1.1, eyeY - eh * 1.6); g.stroke();
    }
    // nose
    g.strokeStyle = 'rgba(150,90,80,0.5)'; g.lineWidth = H * 0.006;
    g.beginPath(); g.moveTo(cx, eyeY + eh * 1.2); g.lineTo(cx + W * 0.003, eyeY + eh * 1.6); g.stroke();
    // mouth
    g.strokeStyle = '#8a3b45'; g.lineWidth = H * 0.008;
    g.beginPath(); g.arc(cx, eyeY + eh * 2.0, W * 0.012, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
  });
}
function shade(hex, k) { const c = C(hex); const hsl = {}; c.getHSL(hsl); c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + k))); return '#' + c.getHexString(); }

// ------------------------------------------------------------------ rig
class RigBuilder {
  constructor() { this.bones = {}; this.pbs = {}; this.root = new THREE.Group(); this.bones.root = this.root; }
  bone(name, parent, x = 0, y = 0, z = 0) {
    const b = new THREE.Group();
    b.position.set(x, y, z);
    b.name = name;
    (this.bones[parent] || this.root).add(b);
    this.bones[name] = b;
    return b;
  }
  pb(bone, kind = 'toon') {
    const key = bone + ':' + kind;
    if (!this.pbs[key]) this.pbs[key] = new PartBuilder();
    return this.pbs[key];
  }
  add(bone, geo, color, m, kind = 'toon', opts) { this.pb(bone, kind).add(geo, color, m, opts); return this; }
  finalize(mats, outline) {
    const meshes = [];
    for (const [key, pb] of Object.entries(this.pbs)) {
      const [bone, kind] = key.split(':');
      const mat = mats[kind];
      const mesh = pb.mesh(mat);
      if (!mesh) continue;
      mesh.castShadow = kind !== 'glow';
      this.bones[bone].add(mesh);
      meshes.push(mesh);
      if (outline && kind === 'toon') {
        const o = new THREE.Mesh(mesh.geometry, outline);
        o.castShadow = false;
        this.bones[bone].add(o);
        meshes.push(o);
      }
    }
    return meshes;
  }
}

// ------------------------------------------------------------------ hair & headgear
function buildHair(R, look, hr) {
  const h = look.hair || {};
  const col = h.color || '#333', col2 = h.color2 || col;
  if (h.style === 'none') return;
  const cap = (s = 1.07) => R.add('head', new THREE.SphereGeometry(hr * s, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), col, mtx(0, hr * 0.02, -hr * 0.03, -0.18));
  const bangs = (n = 5, len = 0.42, spread = 1.0) => {
    for (let i = 0; i < n; i++) {
      const t = (i / (n - 1) - 0.5) * spread;
      const g = new THREE.ConeGeometry(hr * 0.2, hr * len, 5);
      R.add('head', g, i % 2 ? col : col2, mtx(t * hr * 1.4, hr * 0.62 - hr * len * 0.35, hr * 0.84 - Math.abs(t) * hr * 0.25, Math.PI + 0.35, 0, t * 0.6));
    }
  };
  switch (h.style) {
    case 'spiky':
      cap(1.06);
      for (let i = 0; i < 11; i++) {
        const a = (i / 11) * Math.PI * 2;
        const up = 0.35 + (i % 3) * 0.18;
        const g = new THREE.ConeGeometry(hr * 0.24, hr * (0.75 + (i % 2) * 0.25), 5);
        const dir = new THREE.Vector3(Math.sin(a) * 0.9, up + 0.4, Math.cos(a) * 0.7 - 0.35).normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        const m = new THREE.Matrix4().compose(dir.clone().multiplyScalar(hr * 0.85).add(new THREE.Vector3(0, hr * 0.15, 0)), q, new THREE.Vector3(1, 1, 1));
        R.add('head', g, i % 3 ? col : col2, m);
      }
      bangs(5, 0.55, 1.2);
      break;
    case 'short':
      cap(1.06);
      for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; R.add('head', new THREE.ConeGeometry(hr * 0.22, hr * 0.4, 5), col, mtx(Math.sin(a) * hr * 0.75, hr * 0.7, Math.cos(a) * hr * 0.6 - hr * 0.2, -0.6 * Math.cos(a), 0, 0.6 * Math.sin(a))); }
      bangs(4, 0.32, 0.9);
      break;
    case 'long':
      cap(1.08);
      R.add('head', capsule(hr * 0.62, hr * 1.7), col, mtx(0, -hr * 0.75, -hr * 0.62, 0.12, 0, 0, 1.25, 1, 0.55));
      for (const s of [-1, 1]) R.add('head', capsule(hr * 0.2, hr * 1.3), col2, mtx(s * hr * 0.82, -hr * 0.45, hr * 0.15, 0.05, 0, s * 0.08));
      bangs(6, 0.45, 1.25);
      break;
    case 'longbraid':
      cap(1.08);
      for (let i = 0; i < 7; i++) R.add('head', sph(hr * (0.26 - i * 0.018)), i % 2 ? col : col2, mtx(0, -hr * 0.2 - i * hr * 0.33, -hr * 0.95 - Math.sin(i * 0.4) * hr * 0.1));
      for (const s of [-1, 1]) R.add('head', capsule(hr * 0.16, hr * 0.8), col, mtx(s * hr * 0.85, -hr * 0.2, hr * 0.2));
      bangs(5, 0.38, 1.1);
      break;
    case 'ponytail':
      cap(1.07);
      R.add('head', new THREE.TorusGeometry(hr * 0.16, hr * 0.06, 6, 12), look.colors.accent, mtx(0, hr * 0.55, -hr * 0.85, 0.6));
      for (let i = 0; i < 6; i++) R.add('head', sph(hr * (0.3 - i * 0.035), 10, 8), i % 2 ? col : col2, mtx(0, hr * 0.45 - i * hr * 0.32, -hr * 1.15 - Math.sin(i * 0.5) * hr * 0.35, 0, 0, 0, 1, 1.3, 1));
      bangs(5, 0.45, 1.1);
      for (const s of [-1, 1]) R.add('head', capsule(hr * 0.14, hr * 0.7), col2, mtx(s * hr * 0.86, -hr * 0.1, hr * 0.3));
      break;
    case 'twinbuns':
      cap(1.07);
      for (const s of [-1, 1]) {
        R.add('head', sph(hr * 0.36), col, mtx(s * hr * 0.72, hr * 0.78, -hr * 0.18));
        R.add('head', new THREE.TorusGeometry(hr * 0.3, hr * 0.06, 6, 14), look.colors.accent, mtx(s * hr * 0.68, hr * 0.7, -hr * 0.18, 0.4, 0, s * 0.6));
        R.add('head', capsule(hr * 0.15, hr * 1.25), col2, mtx(s * hr * 0.98, -hr * 0.2, -hr * 0.4, 0.15, 0, s * 0.18));
      }
      R.add('head', capsule(hr * 0.5, hr * 0.9), col, mtx(0, -hr * 0.4, -hr * 0.65, 0.1, 0, 0, 1.3, 1, 0.5));
      bangs(6, 0.4, 1.2);
      break;
    case 'bob':
      R.add('head', new THREE.SphereGeometry(hr * 1.12, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.72), col, mtx(0, hr * 0.0, -hr * 0.08, -0.32));
      bangs(7, 0.48, 1.35);
      break;
    case 'wild':
      cap(1.08);
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        R.add('head', new THREE.ConeGeometry(hr * 0.22, hr * (0.5 + (i % 3) * 0.2), 5), i % 4 ? col : col2, mtx(Math.sin(a) * hr * 0.85, hr * 0.35 + Math.cos(i) * hr * 0.2, Math.cos(a) * hr * 0.7 - hr * 0.3, -1.1 * Math.cos(a) - 0.4, 0, 1.1 * Math.sin(a)));
      }
      for (let i = 0; i < 4; i++) R.add('head', capsule(hr * 0.17, hr * 1.0), i % 2 ? col : col2, mtx((i - 1.5) * hr * 0.35, -hr * 0.55, -hr * 0.85, 0.2, 0, (i - 1.5) * 0.15));
      bangs(5, 0.45, 1.15);
      break;
  }
}
function buildHeadgear(R, look, hr) {
  const co = look.colors;
  switch (look.head) {
    case 'horned_helm': {
      R.add('head', new THREE.SphereGeometry(hr * 1.12, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), co.second, mtx(0, hr * 0.05, 0));
      R.add('head', new THREE.TorusGeometry(hr * 1.1, hr * 0.08, 6, 24), co.accent, mtx(0, hr * 0.08, 0, Math.PI / 2));
      for (const s of [-1, 1]) {
        for (let i = 0; i < 4; i++) R.add('head', new THREE.ConeGeometry(hr * (0.2 - i * 0.04), hr * 0.45, 6), i === 3 ? '#ffffff' : '#e8dcc0', mtx(s * hr * (1.0 + i * 0.22), hr * (0.45 + i * 0.25), -hr * 0.05 * i, 0, 0, -s * (0.9 - i * 0.25)));
      }
      R.add('head', blade(hr * 0.7, hr * 0.12, hr * 0.06), co.glow, mtx(0, hr * 0.85, hr * 0.75, 0.5), 'glow');
      break;
    }
    case 'winged_helm': {
      R.add('head', new THREE.SphereGeometry(hr * 1.1, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.48), co.main, mtx(0, hr * 0.08, 0));
      R.add('head', new THREE.TorusGeometry(hr * 1.08, hr * 0.07, 6, 24), co.accent, mtx(0, hr * 0.1, 0, Math.PI / 2));
      for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
        R.add('head', sph(hr * 0.5, 10, 6), i % 2 ? '#ffffff' : '#e6eefc', mtx(s * hr * (1.05 + i * 0.12), hr * (0.35 + i * 0.22), -hr * (0.15 + i * 0.15), 0, 0, -s * (0.5 + i * 0.25), 0.25, 1.05 - i * 0.15, 0.6));
      }
      R.add('head', sph(hr * 0.12), co.glow, mtx(0, hr * 0.55, hr * 0.95), 'glow');
      break;
    }
    case 'hood':
      R.add('head', new THREE.SphereGeometry(hr * 1.2, 20, 14, Math.PI * 0.5 + 0.9, Math.PI * 2 - 1.8, 0, Math.PI * 0.8), co.main, mtx(0, hr * 0.05, -hr * 0.05));
      R.add('head', new THREE.TorusGeometry(hr * 0.95, hr * 0.06, 6, 20, Math.PI * 1.25), co.accent, mtx(0, hr * 0.1, hr * 0.45, 0, 0, -Math.PI * 0.12 - Math.PI * 0.5));
      R.add('head', capsule(hr * 0.5, hr * 0.5), co.main, mtx(0, -hr * 0.6, -hr * 0.7, 0.4, 0, 0, 1.2, 1, 0.6));
      break;
    case 'hood_mask':
      R.add('head', new THREE.SphereGeometry(hr * 1.18, 20, 14, Math.PI * 0.5 + 1.0, Math.PI * 2 - 2.0, 0, Math.PI * 0.78), co.main, mtx(0, hr * 0.05, -hr * 0.05));
      R.add('head', new THREE.SphereGeometry(hr * 1.02, 18, 10, Math.PI * 0.5 - 1.2, 2.4, Math.PI * 0.6, Math.PI * 0.28), co.second, mtx(0, 0, 0));
      R.add('head', sph(hr * 0.1), co.glow, mtx(0, hr * 0.62, hr * 1.02), 'glow');
      break;
    case 'witch_hat': {
      R.add('head', new THREE.CylinderGeometry(hr * 1.9, hr * 1.9, hr * 0.06, 28), co.main, mtx(0, hr * 0.55, -hr * 0.05, -0.12));
      const cone = new THREE.ConeGeometry(hr * 0.95, hr * 2.3, 16, 4);
      const p = cone.attributes.position;
      for (let i = 0; i < p.count; i++) { const y = p.getY(i) / (hr * 2.3) + 0.5; p.setZ(i, p.getZ(i) - y * y * hr * 0.9); }
      cone.computeVertexNormals();
      R.add('head', cone, co.main, mtx(0, hr * 1.7, -hr * 0.15, -0.12));
      R.add('head', new THREE.TorusGeometry(hr * 0.95, hr * 0.12, 6, 20), co.second, mtx(0, hr * 0.68, -hr * 0.08, Math.PI / 2 - 0.12));
      R.add('head', sph(hr * 0.16), co.glow, mtx(hr * 0.5, hr * 0.85, hr * 0.75), 'glow');
      break;
    }
    case 'feather_hat':
      R.add('head', sph(hr * 1.0, 18, 10), co.main, mtx(hr * 0.15, hr * 0.62, -hr * 0.1, -0.2, 0, -0.25, 1.15, 0.45, 1.1));
      R.add('head', new THREE.TorusGeometry(hr * 0.95, hr * 0.07, 6, 20), co.accent, mtx(0, hr * 0.5, 0, Math.PI / 2 - 0.15));
      for (let i = 0; i < 3; i++) R.add('head', sph(hr * 0.5, 10, 6), i === 1 ? '#ffffff' : co.glow, mtx(-hr * 0.7 - i * hr * 0.08, hr * (1.0 + i * 0.12), -hr * (0.4 + i * 0.25), -0.9 - i * 0.25, 0, 0.4, 0.22, 1.2, 0.5));
      break;
    case 'fur_hat':
      R.add('head', new THREE.CylinderGeometry(hr * 1.05, hr * 1.12, hr * 0.95, 18), co.main, mtx(0, hr * 0.62, 0));
      R.add('head', new THREE.TorusGeometry(hr * 1.1, hr * 0.22, 8, 20), '#f2ede4', mtx(0, hr * 0.25, 0, Math.PI / 2));
      for (const s of [-1, 1]) R.add('head', capsule(hr * 0.3, hr * 0.5), '#f2ede4', mtx(s * hr * 1.02, -hr * 0.15, 0, 0, 0, s * 0.15, 0.6, 1, 1));
      R.add('head', new THREE.CylinderGeometry(hr * 0.45, hr * 0.45, hr * 0.16, 14), '#3a3a44', mtx(0, hr * 0.62, hr * 1.05, Math.PI / 2));
      R.add('head', sph(hr * 0.28, 12, 8), co.glow, mtx(-hr * 0.0, hr * 0.62, hr * 1.12, 0, 0, 0, 1, 1, 0.4), 'glow');
      break;
    case 'circlet':
      R.add('head', new THREE.TorusGeometry(hr * 1.04, hr * 0.045, 6, 24), co.accent, mtx(0, hr * 0.35, 0, Math.PI / 2 + 0.25));
      R.add('head', new THREE.OctahedronGeometry(hr * 0.14), co.glow, mtx(0, hr * 0.55, hr * 1.0, 0, 0, 0, 1, 1.5, 0.6), 'glow');
      break;
    case 'yeti_horns':
      for (const s of [-1, 1]) for (let i = 0; i < 4; i++) R.add('head', new THREE.ConeGeometry(hr * (0.16 - i * 0.025), hr * 0.42, 6), i < 2 ? '#d9e6f7' : '#9fd8ff', mtx(s * hr * (0.7 + i * 0.2), hr * (0.75 + i * 0.22), -hr * 0.1, 0, 0, -s * (0.5 - i * 0.25)));
      break;
  }
  if (look.ears === 'elf') for (const s of [-1, 1]) R.add('head', new THREE.ConeGeometry(hr * 0.13, hr * 0.75, 5), look.skin, mtx(s * hr * 1.08, hr * 0.12, -hr * 0.05, 0, 0, -s * 1.25));
  if (look.ears === 'cat') for (const s of [-1, 1]) {
    R.add('head', new THREE.ConeGeometry(hr * 0.3, hr * 0.55, 4), look.hair.color, mtx(s * hr * 0.6, hr * 1.02, -hr * 0.1, 0, 0, -s * 0.35));
    R.add('head', new THREE.ConeGeometry(hr * 0.17, hr * 0.35, 4), '#ffc2cf', mtx(s * hr * 0.6, hr * 0.98, -hr * 0.02, 0, 0, -s * 0.35));
  }
  if (look.beard) {
    R.add('head', sph(hr * 0.55, 12, 8), look.beard, mtx(0, -hr * 0.62, hr * 0.45, 0, 0, 0, 1.1, 0.9, 0.7));
    R.add('head', new THREE.ConeGeometry(hr * 0.35, hr * 0.6, 8), look.beard, mtx(0, -hr * 1.0, hr * 0.5, Math.PI));
  }
}

// ------------------------------------------------------------------ weapons
function buildWeapon(R, look) {
  const co = look.colors;
  const w = look.weapon;
  const glow = co.glow;
  switch (w) {
    case 'sword': {
      R.bone('weaponR', 'handR', 0, -0.04, 0).rotation.x = Math.PI / 2;
      R.add('weaponR', new THREE.CylinderGeometry(0.026, 0.03, 0.22, 8), co.dark, mtx(0, 0, 0));
      R.add('weaponR', new THREE.BoxGeometry(0.26, 0.05, 0.07), co.accent, mtx(0, 0.13, 0));
      R.add('weaponR', sph(0.04), co.accent, mtx(0, -0.13, 0));
      R.add('weaponR', blade(1.0, 0.065, 0.016), glow, mtx(0, 0.15, 0), 'glow');
      break;
    }
    case 'mace_shield': {
      R.bone('weaponR', 'handR', 0, -0.04, 0).rotation.x = Math.PI / 2;
      R.add('weaponR', new THREE.CylinderGeometry(0.03, 0.035, 0.75, 8), '#8a6a4a', mtx(0, 0.22, 0));
      R.add('weaponR', new THREE.IcosahedronGeometry(0.15, 0), co.second, mtx(0, 0.66, 0));
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; R.add('weaponR', new THREE.ConeGeometry(0.04, 0.16, 5), glow, mtx(Math.cos(a) * 0.15, 0.66, Math.sin(a) * 0.15, Math.sin(a) * 1.57, 0, -Math.cos(a) * 1.57), 'glow'); }
      const sh = R.bone('shield', 'foreArmL', 0.07, -0.12, 0.05);
      sh.rotation.y = -0.15;
      R.add('shield', new THREE.BoxGeometry(0.06, 0.82, 0.58), co.main, mtx(0.04, 0, 0.0));
      R.add('shield', new THREE.BoxGeometry(0.075, 0.86, 0.06), co.accent, mtx(0.04, 0, 0.3));
      R.add('shield', new THREE.BoxGeometry(0.075, 0.86, 0.06), co.accent, mtx(0.04, 0, -0.3));
      R.add('shield', new THREE.BoxGeometry(0.075, 0.06, 0.62), co.accent, mtx(0.04, 0.42, 0));
      R.add('shield', new THREE.BoxGeometry(0.075, 0.06, 0.62), co.accent, mtx(0.04, -0.42, 0));
      R.add('shield', new THREE.OctahedronGeometry(0.12), glow, mtx(0.1, 0.05, 0, 0, 0, 0, 0.5, 1.4, 1), 'glow');
      break;
    }
    case 'spear': {
      R.bone('weaponR', 'handR', 0, -0.04, 0).rotation.x = Math.PI / 2;
      R.add('weaponR', new THREE.CylinderGeometry(0.025, 0.025, 2.0, 8), co.second, mtx(0, 0.35, 0));
      R.add('weaponR', new THREE.TorusGeometry(0.035, 0.012, 6, 10), co.accent, mtx(0, 1.25, 0, Math.PI / 2));
      R.add('weaponR', blade(0.42, 0.07, 0.02), glow, mtx(0, 1.35, 0), 'glow');
      for (const s of [-1, 1]) R.add('weaponR', sph(0.09, 8, 6), '#ffffff', mtx(s * 0.08, 1.28, 0, 0, 0, s * 0.8, 0.35, 1.0, 0.25));
      break;
    }
    case 'daggers': {
      for (const [b, hand] of [['weaponR', 'handR'], ['weaponL', 'handL']]) {
        R.bone(b, hand, 0, -0.04, 0).rotation.x = Math.PI / 2;
        R.add(b, new THREE.CylinderGeometry(0.02, 0.022, 0.12, 6), co.dark, mtx(0, 0, 0));
        R.add(b, new THREE.BoxGeometry(0.12, 0.03, 0.04), co.accent, mtx(0, 0.07, 0));
        R.add(b, blade(0.42, 0.05, 0.012), glow, mtx(0, 0.08, 0), 'glow');
      }
      break;
    }
    case 'claws': {
      for (const [b, hand] of [['weaponR', 'handR'], ['weaponL', 'handL']]) {
        R.bone(b, hand, 0, -0.02, 0).rotation.x = Math.PI / 2;
        R.add(b, sph(0.075, 10, 8), co.second, mtx(0, 0, 0, 0, 0, 0, 1.1, 1, 1.1));
        for (let i = -1; i <= 1; i++) R.add(b, new THREE.ConeGeometry(0.018, 0.3, 5), glow, mtx(i * 0.045, 0.2, 0.02, 0.2, 0, i * 0.1), 'glow');
      }
      break;
    }
    case 'staff_star': {
      const b = R.bone('weaponR', 'handR', 0, -0.05, 0.02);
      R.add('weaponR', new THREE.CylinderGeometry(0.025, 0.03, 1.7, 8), '#f2f6ff', mtx(0, 0.35, 0));
      R.add('weaponR', new THREE.TorusGeometry(0.16, 0.022, 8, 24), co.accent, mtx(0, 1.32, 0));
      const star = R.bone('star', 'weaponR', 0, 1.32, 0);
      R.add('star', new THREE.OctahedronGeometry(0.12), glow, mtx(0, 0, 0, 0, 0, 0, 0.7, 1.4, 0.7), 'glow');
      R.add('star', new THREE.OctahedronGeometry(0.08), '#ffffff', mtx(0, 0, 0, 0, 0, Math.PI / 2, 0.6, 1.5, 0.6), 'glow');
      void b; void star;
      break;
    }
    case 'lantern': {
      R.bone('weaponR', 'handR', 0, -0.05, 0.02);
      R.add('weaponR', new THREE.CylinderGeometry(0.025, 0.03, 1.4, 8), '#3a2a2a', mtx(0, 0.25, 0));
      R.add('weaponR', new THREE.TorusGeometry(0.1, 0.02, 6, 14, Math.PI), co.accent, mtx(0.08, 0.95, 0));
      R.add('weaponR', new THREE.CylinderGeometry(0.09, 0.09, 0.2, 6, 1, true), co.accent, mtx(0.18, 0.78, 0));
      R.add('weaponR', sph(0.08), glow, mtx(0.18, 0.78, 0), 'glow');
      break;
    }
    case 'staff_bell': {
      R.bone('weaponR', 'handR', 0, -0.05, 0.02);
      R.add('weaponR', new THREE.CylinderGeometry(0.025, 0.03, 1.7, 8), '#ffffff', mtx(0, 0.35, 0));
      R.add('weaponR', new THREE.TorusGeometry(0.2, 0.03, 8, 20, Math.PI * 1.3), co.accent, mtx(0, 1.38, 0, 0, 0, -Math.PI * 0.15));
      R.add('weaponR', new THREE.LatheGeometry([new THREE.Vector2(0.01, 0.1), new THREE.Vector2(0.05, 0.08), new THREE.Vector2(0.07, 0.0), new THREE.Vector2(0.1, -0.05)], 12), co.glow, mtx(0, 1.32, 0), 'glow');
      break;
    }
    case 'bow': {
      const b = R.bone('weaponL', 'handL', 0, -0.03, 0.03);
      b.rotation.set(0, 0, 0);
      const arc = new THREE.TorusGeometry(0.62, 0.028, 6, 24, Math.PI * 0.78);
      R.add('weaponL', arc, co.main, mtx(-0.5, 0.0, 0, 0, -Math.PI / 2, -Math.PI * 0.39));
      R.add('weaponL', new THREE.CylinderGeometry(0.006, 0.006, 1.18, 4), '#ffffff', mtx(-0.0, 0, 0.0, 0, 0, 0), 'glow');
      for (const s of [-1, 1]) R.add('weaponL', new THREE.OctahedronGeometry(0.05), glow, mtx(0, s * 0.58, 0.02), 'glow');
      // quiver
      R.add('chest', new THREE.CylinderGeometry(0.08, 0.07, 0.6, 10), '#6b4a3a', mtx(-0.1, 0.05, -0.22, 0.35, 0, -0.35));
      for (let i = 0; i < 4; i++) R.add('chest', new THREE.ConeGeometry(0.025, 0.12, 4), co.glow, mtx(-0.18 + i * 0.03, 0.38, -0.3 + i * 0.01, 0.35, 0, -0.35), 'glow');
      break;
    }
    case 'crossbow': {
      R.bone('weaponR', 'handR', 0, -0.06, 0.05).rotation.x = Math.PI / 2;
      R.add('weaponR', new THREE.BoxGeometry(0.08, 0.75, 0.1), '#7a5434', mtx(0, 0.2, 0));
      R.add('weaponR', new THREE.TorusGeometry(0.38, 0.03, 6, 18, Math.PI * 0.8), co.second, mtx(0, 0.52, 0, Math.PI / 2, 0, Math.PI * 0.1));
      R.add('weaponR', new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8), co.accent, mtx(0, 0.5, 0.06));
      R.add('weaponR', blade(0.2, 0.03, 0.03), co.glow, mtx(0, 0.55, 0.06), 'glow');
      // backpack
      R.add('chest', new THREE.BoxGeometry(0.34, 0.36, 0.18), '#6d4c34', mtx(0, 0.02, -0.25));
      R.add('chest', capsule(0.08, 0.3), '#e8dcc8', mtx(0, 0.22, -0.28, 0, 0, Math.PI / 2));
      break;
    }
    case 'harp': {
      const b = R.bone('weaponL', 'handL', 0.02, -0.02, 0.08);
      b.rotation.set(0.2, 0, 0);
      R.add('weaponL', new THREE.TorusGeometry(0.26, 0.03, 6, 18, Math.PI * 1.1), co.accent, mtx(0, 0.2, 0, 0, Math.PI / 2, 0));
      R.add('weaponL', new THREE.CylinderGeometry(0.025, 0.025, 0.5, 6), co.accent, mtx(0, 0.2, -0.24));
      for (let i = 0; i < 5; i++) R.add('weaponL', new THREE.CylinderGeometry(0.004, 0.004, 0.36 - Math.abs(i - 2) * 0.05, 3), co.glow, mtx(0, 0.2, -0.16 + i * 0.07), 'glow');
      break;
    }
    case 'fists': {
      for (const h of ['handR', 'handL']) for (let i = -1; i <= 1; i++) R.add(h, new THREE.OctahedronGeometry(0.05), co.glow, mtx(i * 0.06, -0.06, 0.08, 0, 0, 0, 0.6, 1.4, 0.6), 'glow');
      break;
    }
  }
}

// ------------------------------------------------------------------ outfit / body
function limb(R, bone, r0, r1, len, col, rz = 0) {
  const g = new THREE.CylinderGeometry(r1, r0, len, 10);
  R.add(bone, g, col, mtx(0, -len / 2, 0, 0, 0, rz));
  R.add(bone, sph(r1 * 1.02, 10, 8), col, mtx(0, -len, 0));
  R.add(bone, sph(r0 * 1.02, 10, 8), col, mtx(0, 0, 0));
}

export function buildHumanoid(look, opts = {}) {
  const R = new RigBuilder();
  const co = look.colors;
  const bulk = look.bulk || 1;
  const fem = !!look.female;
  const yeti = look.body === 'yeti';
  const skin = look.skin;
  const legLen = yeti ? 0.3 : 0.4;
  const hipY = yeti ? 0.72 : 0.9;
  const hr = yeti ? 0.32 : 0.25;
  const sw = (fem ? 0.2 : 0.235) * bulk * (yeti ? 1.55 : 1);
  const outfit = look.outfit;
  const longSkirt = ['robe', 'priestess'].includes(outfit);
  // bones
  R.bone('body', 'root', 0, hipY, 0);
  R.bone('pelvis', 'body', 0, 0, 0);
  R.bone('spine', 'body', 0, 0.08, 0);
  R.bone('chest', 'spine', 0, yeti ? 0.3 : 0.24, 0);
  R.bone('neck', 'chest', 0, yeti ? 0.32 : 0.22, 0);
  R.bone('head', 'neck', 0, yeti ? 0.1 : 0.06, yeti ? 0.06 : 0.01);
  for (const [s, L] of [[1, 'L'], [-1, 'R']]) {
    R.bone('shoulder' + L, 'chest', s * sw, yeti ? 0.16 : 0.13, 0);
    R.bone('arm' + L, 'shoulder' + L, 0, 0, 0);
    R.bone('foreArm' + L, 'arm' + L, 0, yeti ? -0.38 : -0.27, 0);
    R.bone('hand' + L, 'foreArm' + L, 0, yeti ? -0.36 : -0.24, 0);
    R.bone('leg' + L, 'pelvis', s * (yeti ? 0.2 : fem ? 0.1 : 0.11) * bulk, -0.04, 0);
    R.bone('shin' + L, 'leg' + L, 0, -legLen, 0);
    R.bone('foot' + L, 'shin' + L, 0, -legLen, 0);
  }
  // ---- body
  if (yeti) {
    const fur = C(co.main), tip = C(co.second);
    const furFn = (x, y, z, nx, ny, nz, c) => c.copy(fur).lerp(tip, Math.max(0, noise2(x * 9, z * 9 + y * 5)) * 0.8);
    R.add('chest', sph(0.52, 18, 14), co.main, mtx(0, 0.02, 0, 0, 0, 0, 1.08, 1.05, 0.9), 'toon', { colorFn: furFn });
    R.add('pelvis', sph(0.4, 16, 12), co.main, mtx(0, 0.06, 0, 0, 0, 0, 1.15, 0.8, 0.95), 'toon', { colorFn: furFn });
    R.add('chest', sph(0.36, 14, 10), '#dfeaf8', mtx(0, -0.08, 0.2, 0, 0, 0, 1, 1.1, 0.7));
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; R.add('chest', sph(0.13, 8, 6), i % 2 ? co.main : co.second, mtx(Math.cos(a) * 0.48, 0.32 + Math.sin(i * 1.7) * 0.06, Math.sin(a) * 0.4)); }
    if (look.scarf) { R.add('chest', new THREE.TorusGeometry(0.3, 0.09, 8, 18), look.scarf, mtx(0, 0.34, 0.03, Math.PI / 2)); R.add('chest', capsule(0.07, 0.3), look.scarf, mtx(0.18, 0.1, 0.32, 0.2, 0, 0.2)); }
    for (const L of ['L', 'R']) {
      limb(R, 'arm' + L, 0.15, 0.13, 0.38, co.main);
      limb(R, 'foreArm' + L, 0.13, 0.12, 0.36, co.main);
      R.add('hand' + L, sph(0.16, 12, 10), co.second, mtx(0, -0.06, 0.02, 0, 0, 0, 1, 0.85, 1.1));
      limb(R, 'leg' + L, 0.17, 0.15, 0.3, co.main);
      limb(R, 'shin' + L, 0.15, 0.14, 0.3, co.main);
      R.add('foot' + L, sph(0.17, 12, 8), co.second, mtx(0, -0.02, 0.06, 0, 0, 0, 1, 0.55, 1.35));
    }
  } else {
    const shirt = co.main, pants = co.dark, boots = outfit === 'leopard' ? '#f0ede6' : co.dark;
    // torso
    R.add('chest', sph(0.24 * bulk, 16, 12), shirt, mtx(0, 0.02, 0, 0, 0, 0, fem ? 0.92 : 1, 1.05, 0.78));
    R.add('spine', new THREE.CylinderGeometry(0.19 * bulk * (fem ? 0.82 : 1), 0.2 * bulk * (fem ? 0.95 : 1), 0.22, 14), shirt, mtx(0, 0.1, 0, 0, 0, 0, 1, 1, 0.8));
    R.add('pelvis', sph(0.21 * bulk, 14, 10), pants, mtx(0, 0.0, 0, 0, 0, 0, fem ? 1.08 : 1, 0.72, 0.82));
    R.add('neck', new THREE.CylinderGeometry(0.055, 0.065, 0.14, 10), skin, mtx(0, 0.04, 0));
    if (fem) R.add('chest', sph(0.11, 10, 8), shirt, mtx(0, -0.02, 0.12, 0, 0, 0, 1.6, 0.8, 0.8));
    // belt
    R.add('spine', new THREE.TorusGeometry(0.19 * bulk * (fem ? 0.9 : 1), 0.035, 6, 18), co.accent, mtx(0, -0.02, 0, Math.PI / 2, 0, 0, 1, 0.8, 1));
    // limbs
    const sleeve = ['ninja', 'robe', 'priestess', 'coat', 'hunter', 'heavy'].includes(outfit) ? shirt : outfit === 'dress' || outfit === 'bard' ? co.second : skin;
    for (const L of ['L', 'R']) {
      limb(R, 'arm' + L, 0.065 * bulk, 0.058 * bulk, 0.25, sleeve);
      limb(R, 'foreArm' + L, 0.058 * bulk, 0.05 * bulk, 0.21, ['heavy', 'armor_light', 'ranger', 'hunter', 'leopard'].includes(outfit) ? co.second : outfit === 'ninja' ? co.second : sleeve === skin ? skin : shirt);
      R.add('hand' + L, sph(0.058 * bulk, 10, 8), outfit === 'heavy' ? co.second : skin, mtx(0, -0.03, 0.01, 0, 0, 0, 0.9, 1.1, 1));
      limb(R, 'leg' + L, 0.088 * bulk, 0.072 * bulk, legLen - 0.02, longSkirt ? pants : pants);
      limb(R, 'shin' + L, 0.07 * bulk, 0.058 * bulk, legLen - 0.04, boots);
      R.add('foot' + L, capsule(0.065 * bulk, 0.12), boots, mtx(0, -0.02, 0.06, Math.PI / 2));
      R.add('shin' + L, new THREE.CylinderGeometry(0.085 * bulk, 0.08 * bulk, 0.07, 10), co.accent, mtx(0, -0.04, 0));
    }
    // outfit specifics
    const shoulderPads = (r, col) => { for (const L of ['L', 'R']) { R.add('arm' + L, halfSph(r), col, mtx(0, 0.02, 0, 0, 0, 0, 1, 0.8, 1)); R.add('arm' + L, new THREE.TorusGeometry(r * 0.98, r * 0.12, 6, 14), co.accent, mtx(0, 0.02, 0, Math.PI / 2)); } };
    const skirt = (bone, rTop, rBot, h, col, y = 0, trim = co.accent) => {
      R.add(bone, skirtGeo(rTop, rBot, h, 0.025, 22, 0.2), col, mtx(0, y, 0));
      R.add(bone, new THREE.TorusGeometry(rBot * 1.08, 0.022, 6, 22), trim, mtx(0, y - h, 0, Math.PI / 2));
    };
    switch (outfit) {
      case 'heavy':
        R.add('chest', sph(0.27 * bulk, 16, 12), co.second, mtx(0, 0.04, 0.03, 0, 0, 0, 1, 0.95, 0.8));
        shoulderPads(0.17, co.second);
        R.add('chest', new THREE.TorusGeometry(0.17, 0.08, 8, 18), '#f4f1ea', mtx(0, 0.24, 0, Math.PI / 2));
        skirt('pelvis', 0.24 * bulk, 0.3 * bulk, 0.34, co.main, 0.06);
        R.add('chest', new THREE.OctahedronGeometry(0.06), co.glow, mtx(0, 0.06, 0.24, 0, 0, 0, 1, 1.4, 0.5), 'glow');
        break;
      case 'coat':
        skirt('spine', 0.2 * bulk, 0.33, 0.62, co.main, 0.02, co.accent);
        R.add('chest', new THREE.CylinderGeometry(0.15, 0.2, 0.14, 14, 1, true), co.second, mtx(0, 0.26, -0.02));
        R.add('chest', new THREE.BoxGeometry(0.05, 0.36, 0.02), co.second, mtx(0, 0.0, 0.2));
        for (const L of ['L', 'R']) R.add('arm' + L, new THREE.TorusGeometry(0.075, 0.02, 6, 12), co.accent, mtx(0, -0.24, 0, Math.PI / 2));
        break;
      case 'armor_light':
        R.add('chest', sph(0.25, 16, 12), co.second, mtx(0, 0.05, 0.02, 0, 0, 0, 0.95, 0.9, 0.75));
        shoulderPads(0.11, co.main);
        skirt('pelvis', 0.21, 0.29, 0.3, co.main, 0.05, co.accent);
        break;
      case 'ninja':
        R.add('spine', new THREE.TorusGeometry(0.175, 0.05, 6, 16), co.accent, mtx(0, 0.0, 0, Math.PI / 2));
        R.add('pelvis', skirtGeo(0.19, 0.23, 0.18, 0.02, 16, 0.1), co.main, mtx(0, 0.04, 0));
        break;
      case 'leopard': {
        const spotFn = (x, y, z, nx, ny, nz, c) => (noise2(x * 22, y * 22 + z * 18) > 0.28 ? c.set('#5a5047') : c.set(co.main));
        R.add('chest', sph(0.26, 16, 12), co.main, mtx(0, 0.06, -0.01, 0, 0, 0, 1, 0.95, 0.82), 'toon', { colorFn: spotFn });
        R.add('chest', new THREE.TorusGeometry(0.16, 0.07, 8, 16), '#f6f3ec', mtx(0, 0.22, 0, Math.PI / 2));
        R.add('pelvis', skirtGeo(0.2, 0.25, 0.16, 0.02, 16, 0.1), co.second, mtx(0, 0.04, 0), 'toon');
        for (const L of ['L', 'R']) R.add('shin' + L, new THREE.TorusGeometry(0.08, 0.035, 6, 12), '#f6f3ec', mtx(0, -0.06, 0, Math.PI / 2));
        break;
      }
      case 'dress':
        skirt('spine', 0.17, 0.4, 0.56, co.main, 0.05, co.second);
        R.add('spine', skirtGeo(0.17, 0.33, 0.45, 0.02, 20, 0.2), co.second, mtx(0, 0.02, 0));
        for (const L of ['L', 'R']) R.add('arm' + L, sph(0.09, 12, 8), co.second, mtx(0, -0.02, 0));
        R.add('chest', new THREE.TorusGeometry(0.14, 0.03, 6, 16), co.accent, mtx(0, 0.22, 0, Math.PI / 2));
        break;
      case 'robe':
        skirt('spine', 0.19, 0.38, 0.95, co.main, 0.08, co.accent);
        R.add('spine', new THREE.TorusGeometry(0.18, 0.045, 6, 16), co.second, mtx(0, 0.0, 0, Math.PI / 2));
        for (const L of ['L', 'R']) R.add('foreArm' + L, new THREE.CylinderGeometry(0.12, 0.06, 0.24, 12, 1, true), co.main, mtx(0, -0.16, 0));
        break;
      case 'priestess':
        skirt('spine', 0.19, 0.38, 0.95, co.main, 0.08, co.accent);
        R.add('spine', skirtGeo(0.18, 0.2, 0.5, 0.02, 12, 0.05), co.second, mtx(0, 0.03, 0.03, 0, 0, 0, 0.4, 1, 1.05));
        R.add('chest', new THREE.TorusGeometry(0.15, 0.035, 6, 16), co.accent, mtx(0, 0.22, 0, Math.PI / 2));
        for (const L of ['L', 'R']) R.add('foreArm' + L, new THREE.CylinderGeometry(0.11, 0.06, 0.22, 12, 1, true), co.main, mtx(0, -0.15, 0));
        break;
      case 'ranger':
        skirt('spine', 0.2, 0.3, 0.42, co.main, 0.04, co.accent);
        R.add('chest', new THREE.BoxGeometry(0.06, 0.5, 0.03), '#6b4a3a', mtx(0, 0.02, 0.19, 0, 0, 0.6));
        break;
      case 'hunter':
        skirt('spine', 0.22, 0.32, 0.55, co.main, 0.04, '#f2ede4');
        R.add('chest', new THREE.TorusGeometry(0.17, 0.07, 8, 16), '#f2ede4', mtx(0, 0.22, 0, Math.PI / 2));
        R.add('chest', new THREE.BoxGeometry(0.04, 0.38, 0.02), co.second, mtx(0, 0.0, 0.2));
        break;
      case 'bard':
        skirt('spine', 0.19, 0.29, 0.38, co.main, 0.04, co.accent);
        for (const L of ['L', 'R']) R.add('arm' + L, sph(0.1, 12, 8), co.second, mtx(0, -0.04, 0));
        for (let i = 0; i < 3; i++) R.add('chest', sph(0.022, 6, 4), co.accent, mtx(0, 0.12 - i * 0.09, 0.2));
        break;
    }
    if (look.scarf && !yeti) {
      R.add('chest', new THREE.TorusGeometry(0.11, 0.05, 8, 16), look.scarf, mtx(0, 0.27, 0.01, Math.PI / 2));
      R.bone('scarfTail', 'chest', -0.06, 0.24, -0.12);
      R.add('scarfTail', new THREE.BoxGeometry(0.1, 0.03, 0.5), look.scarf, mtx(0, 0, -0.25));
    }
  }
  // cape
  if (look.cape) {
    R.bone('cape', 'chest', 0, yeti ? 0.3 : 0.2, -0.12 * bulk);
    const cg = new THREE.PlaneGeometry(0.5 * bulk, 1.0, 1, 6);
    const p = cg.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); const t = 0.5 - y; p.setX(i, p.getX(i) * (1 + t * 0.6)); p.setZ(i, -Math.sin(t * 1.2) * 0.12 - Math.abs(p.getX(i)) * 0.25); }
    cg.translate(0, -0.5, 0);
    cg.computeVertexNormals();
    // make double sided by adding a flipped copy
    const back = cg.clone(); back.scale(1, 1, 1); const idx = back.index.array; for (let i = 0; i < idx.length; i += 3) { const t = idx[i]; idx[i] = idx[i + 2]; idx[i + 2] = t; } const nn = back.attributes.normal; for (let i = 0; i < nn.count; i++) nn.setXYZ(i, -nn.getX(i), -nn.getY(i), -nn.getZ(i));
    R.add('cape', cg, look.cape, mtx(0, 0, -0.005));
    R.add('cape', back, shade(look.cape, -0.12), mtx(0, 0, 0.005));
  }
  // tail
  if (look.tail) {
    R.bone('tail', 'pelvis', 0, 0.02, -0.18);
    for (let i = 0; i < 7; i++) R.add('tail', sph(0.07 - i * 0.004, 8, 6), i % 2 ? '#e9e6df' : '#6b6259', mtx(0, -0.02 - i * 0.05, -i * 0.12, 0, 0, 0, 1, 1, 1.3));
  }
  // head
  const head = new THREE.Mesh(headGeo(), toonMat({ vertexColors: false, map: faceTexture(look), flash: opts.flash }));
  head.scale.setScalar(hr);
  head.position.y = hr * 0.95;
  head.castShadow = true;
  R.bones.head.add(head);
  R.bone('headTop', 'head', 0, hr * 0.95, 0);
  // reparent hair/headgear geometry to be centered at head center
  const H0 = new RigBuilder();
  H0.bones = R.bones; H0.pbs = R.pbs;
  const wrap = { add: (bone, geo, col, m, kind, o) => { const mm = new THREE.Matrix4().makeTranslation(0, hr * 0.95, 0).multiply(m || new THREE.Matrix4()); return R.add(bone, geo, col, mm, kind, o); } };
  buildHair(wrap, look, hr);
  buildHeadgear(wrap, look, hr);
  buildWeapon(R, look);
  const mats = { toon: toonMat({ flash: opts.flash, rim: look.colors.glow }), glow: sharedMats().glow };
  const meshes = R.finalize(mats, opts.outline ? sharedMats().outline : null);
  if (opts.outline) {
    const ho = new THREE.Mesh(headGeo(), sharedMats().outline);
    ho.scale.setScalar(hr); ho.position.y = hr * 0.95;
    R.bones.head.add(ho);
  }
  const root = R.root;
  root.scale.setScalar(look.height || 1);
  return { root, bones: R.bones, meshes, head, hipY, legLen, style: look.weapon, yeti, mats };
}
