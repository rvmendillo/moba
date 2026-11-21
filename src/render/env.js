// Frozen-valley environment: terrain, river ice, forested walls, frost grass, crystals, bases, sky, snow.
import * as THREE from 'three';
import { NavGrid, N as GN, RES, HALF, PLAY, LANES, LANE_HALF_W, BASES, TOWERS, CAMPS, PITS, WALLS, BUSHES, RIVER_HALF_W, riverU, laneDistance } from '../sim/map.js';
import { pointInPoly, distToPolyEdge, polyBounds } from '../sim/rng.js';
import { U, fbm, noise2, hash2, canvasTex, injectWorld, PartBuilder, mtx, particleAtlas } from './materials.js';

export const EXT = 82; // terrain half size (beyond playable area)
const TEAM_COL = [0x58c8ff, 0xff5a78];
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- height field
export class HeightField {
  constructor(nav) {
    this.res = 0.5;
    this.n = Math.round((EXT * 2) / this.res) + 1;
    this.h = new Float32Array(this.n * this.n);
    // wall mask from polygons (blurred)
    const M = new Float32Array(GN * GN);
    for (let j = 0; j < GN; j++) for (let i = 0; i < GN; i++) {
      const k = j * GN + i;
      const x = -HALF + (i + 0.5) * RES, z = -HALF + (j + 0.5) * RES;
      if (nav.block[k] && Math.abs(x) < PLAY - 0.5 && Math.abs(z) < PLAY - 0.5) M[k] = 1;
    }
    const B = new Float32Array(GN * GN);
    const r = 3;
    for (let j = 0; j < GN; j++) for (let i = 0; i < GN; i++) {
      let s = 0, c = 0;
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= GN || jj >= GN) continue;
        s += M[jj * GN + ii]; c++;
      }
      B[j * GN + i] = s / c;
    }
    this.wall = B;
    for (let j = 0; j < this.n; j++) for (let i = 0; i < this.n; i++) {
      const x = -EXT + i * this.res, z = -EXT + j * this.res;
      this.h[j * this.n + i] = this.raw(x, z);
    }
  }
  wallAt(x, z) {
    const i = Math.floor((x + HALF) / RES), j = Math.floor((z + HALF) / RES);
    if (i < 0 || j < 0 || i >= GN || j >= GN) return 0;
    return this.wall[j * GN + i];
  }
  raw(x, z) {
    let h = fbm(x * 0.045 + 3.1, z * 0.045 - 1.7, 4) * 0.6 + fbm(x * 0.21, z * 0.21, 2) * 0.1;
    const ld = laneDistance(x, z).d;
    const lk = smooth(LANE_HALF_W + 2.5, LANE_HALF_W - 0.5, ld);
    h *= 1 - lk * 0.85;
    for (const b of BASES) {
      const d = Math.hypot(x - b.core[0], z - b.core[1]);
      const k = smooth(17, 12, d);
      h = h * (1 - k) + k * 0.04;
    }
    for (const p of Object.values(PITS)) {
      const d = Math.hypot(x - p.p[0], z - p.p[1]);
      const k = smooth(6.5, 4.5, d);
      h = h * (1 - k) - k * 0.15;
    }
    const u = Math.abs(riverU(x, z));
    const rk = smooth(RIVER_HALF_W + 1.6, RIVER_HALF_W - 0.6, u);
    h = h * (1 - rk) - rk * 0.42;
    h += this.wallAt(x, z) * 1.0;
    const e = Math.max(Math.abs(x), Math.abs(z)) - (PLAY - 0.8);
    if (e > 0) h += Math.min(e, 14) * 0.42 + fbm(x * 0.08, z * 0.08, 3) * 2.2 * Math.min(1, e / 5);
    return h;
  }
  at(x, z) {
    const fx = (x + EXT) / this.res, fz = (z + EXT) / this.res;
    const i = Math.max(0, Math.min(this.n - 2, Math.floor(fx))), j = Math.max(0, Math.min(this.n - 2, Math.floor(fz)));
    const tx = Math.min(1, Math.max(0, fx - i)), tz = Math.min(1, Math.max(0, fz - j));
    const n = this.n, H = this.h;
    const a = H[j * n + i], b = H[j * n + i + 1], c = H[(j + 1) * n + i], d = H[(j + 1) * n + i + 1];
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  }
}

// ---------------------------------------------------------------- painted ground textures
function paintGround(size) {
  const S = size / (EXT * 2); // px per meter
  const P = (x) => (x + EXT) * S;
  const col = canvasTex(size, size, (g) => {
    g.fillStyle = '#e1eaf8'; g.fillRect(0, 0, size, size);
    // soft tint variation
    let seed = 1;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 420; i++) {
      const x = rnd() * size, y = rnd() * size, r = (8 + rnd() * 30) * S;
      const tints = ['rgba(170,196,240,0.16)', 'rgba(255,255,255,0.28)', 'rgba(196,180,245,0.13)', 'rgba(160,205,240,0.15)'];
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, tints[i % 4]); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // jungle shading: darker near walls
    g.save();
    g.shadowColor = 'rgba(70,95,140,0.55)'; g.shadowBlur = 3.2 * S;
    g.fillStyle = '#b9c8de';
    for (const w of WALLS) { g.beginPath(); w.forEach(([x, z], i) => (i ? g.lineTo(P(x), P(z)) : g.moveTo(P(x), P(z)))); g.closePath(); g.fill(); }
    g.restore();
    // bush ground
    g.fillStyle = 'rgba(120,170,175,0.35)';
    for (const b of BUSHES) { g.beginPath(); b.forEach(([x, z], i) => (i ? g.lineTo(P(x), P(z)) : g.moveTo(P(x), P(z)))); g.closePath(); g.fill(); }
    // camp clearings
    for (const c of CAMPS) {
      const gr = g.createRadialGradient(P(c.p[0]), P(c.p[1]), 0, P(c.p[0]), P(c.p[1]), 4.2 * S);
      gr.addColorStop(0, 'rgba(205,214,232,0.9)'); gr.addColorStop(0.7, 'rgba(214,223,240,0.6)'); gr.addColorStop(1, 'rgba(233,240,250,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(P(c.p[0]), P(c.p[1]), 4.2 * S, 0, Math.PI * 2); g.fill();
    }
    // lanes: packed snow shoulder then cobblestone road
    const strokeLane = (pts, w, style) => { g.strokeStyle = style; g.lineWidth = w * S; g.lineJoin = 'round'; g.lineCap = 'round'; g.beginPath(); pts.forEach(([x, z], i) => (i ? g.lineTo(P(x), P(z)) : g.moveTo(P(x), P(z)))); g.stroke(); };
    for (const pts of Object.values(LANES)) {
      const ext = [[...pts[0]], ...pts, [...pts[pts.length - 1]]];
      strokeLane(ext, (LANE_HALF_W + 1.6) * 2, 'rgba(220,228,240,0.9)');
      strokeLane(ext, LANE_HALF_W * 1.62, '#c4cfdf');
    }
    // cobbles
    for (const pts of Object.values(LANES)) {
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
        const L = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / L, dz = (bz - az) / L;
        const nx = -dz, nz = dx;
        for (let s = 0; s < L; s += 0.75) {
          const row = Math.floor(s / 0.75);
          for (let o = -3.4; o <= 3.4; o += 0.85) {
            const off = o + (row % 2 ? 0.42 : 0);
            if (Math.abs(off) > 3.5) continue;
            const x = ax + dx * s + nx * off, z = az + dz * s + nz * off;
            const v = hash2(x * 3.1, z * 2.7);
            const edge = Math.abs(off) / 3.5;
            if (edge > 0.75 && v < (edge - 0.75) * 3) continue; // ragged edges
            const shade = 186 + Math.floor(v * 34);
            g.fillStyle = `rgb(${shade - 8},${shade},${Math.min(255, shade + 16)})`;
            g.save(); g.translate(P(x), P(z)); g.rotate(Math.atan2(dz, dx) + (v - 0.5) * 0.3);
            const w = 0.62 * S, h = 0.5 * S;
            g.beginPath(); g.roundRect ? g.roundRect(-w / 2, -h / 2, w, h, 0.14 * S) : g.rect(-w / 2, -h / 2, w, h); g.fill();
            g.strokeStyle = 'rgba(110,128,160,0.45)'; g.lineWidth = Math.max(1, 0.05 * S); g.stroke();
            g.restore();
          }
        }
      }
    }
    // drifting snow over lane edges
    for (let i = 0; i < 1400; i++) {
      const lanes = Object.values(LANES);
      const pts = lanes[i % 3];
      const k = Math.floor(rnd() * (pts.length - 1));
      const t = rnd();
      const [ax, az] = pts[k], [bx, bz] = pts[k + 1];
      const L = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / L, nz = (bx - ax) / L;
      const side = rnd() < 0.5 ? -1 : 1;
      const o = side * (2.6 + rnd() * 2.2);
      const x = ax + (bx - ax) * t + nx * o, z = az + (bz - az) * t + nz * o;
      const r = (0.6 + rnd() * 1.4) * S;
      const gr = g.createRadialGradient(P(x), P(z), 0, P(x), P(z), r);
      gr.addColorStop(0, 'rgba(245,249,255,0.85)'); gr.addColorStop(1, 'rgba(245,249,255,0)');
      g.fillStyle = gr; g.fillRect(P(x) - r, P(z) - r, r * 2, r * 2);
    }
    // frozen river
    g.save();
    const rl = 190;
    g.translate(P(0), P(0)); g.rotate(Math.PI / 4);
    const rw = (RIVER_HALF_W + 0.3) * S;
    let gr2 = g.createLinearGradient(0, -rw, 0, rw);
    gr2.addColorStop(0, 'rgba(214,240,255,1)'); gr2.addColorStop(0.18, '#a6dcf5'); gr2.addColorStop(0.5, '#7ec3ea'); gr2.addColorStop(0.82, '#a6dcf5'); gr2.addColorStop(1, 'rgba(214,240,255,1)');
    g.fillStyle = gr2; g.fillRect(-rl * S / 2, -rw, rl * S, rw * 2);
    // cracks
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 0.06 * S;
    for (let i = 0; i < 260; i++) {
      let x = (rnd() - 0.5) * rl * S, y = (rnd() - 0.5) * rw * 1.8;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x += (rnd() - 0.5) * 2.2 * S; y += (rnd() - 0.5) * 1.6 * S; g.lineTo(x, y); }
      g.stroke();
    }
    g.strokeStyle = 'rgba(70,120,170,0.25)'; g.lineWidth = 0.05 * S;
    for (let i = 0; i < 160; i++) { let x = (rnd() - 0.5) * rl * S, y = (rnd() - 0.5) * rw * 1.6; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (rnd() - 0.5) * 1.6 * S; y += (rnd() - 0.5) * 1.2 * S; g.lineTo(x, y); } g.stroke(); }
    // snow banks
    for (const s of [-1, 1]) {
      const gb = g.createLinearGradient(0, s * (rw - 0.9 * S), 0, s * (rw + 0.6 * S));
      gb.addColorStop(0, 'rgba(250,252,255,0)'); gb.addColorStop(1, 'rgba(250,252,255,1)');
      g.fillStyle = gb; g.fillRect(-rl * S / 2, Math.min(s * (rw - 0.9 * S), s * (rw + 0.6 * S)), rl * S, 1.5 * S);
    }
    g.restore();
    // base plazas
    for (const b of BASES) {
      const cx = P(b.core[0]), cz = P(b.core[1]);
      const blue = b.team === 0;
      g.save(); g.translate(cx, cz);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, 15 * S);
      gr.addColorStop(0, blue ? '#e4f3ff' : '#fff0f3'); gr.addColorStop(0.85, blue ? '#d3e8fb' : '#f8dfe6'); gr.addColorStop(1, 'rgba(233,240,250,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 15 * S, 0, Math.PI * 2); g.fill();
      // tiles
      g.strokeStyle = blue ? 'rgba(110,160,215,0.35)' : 'rgba(215,120,140,0.35)'; g.lineWidth = 0.06 * S;
      for (let r = 2; r < 14; r += 1.6) { g.beginPath(); g.arc(0, 0, r * S, 0, Math.PI * 2); g.stroke(); }
      for (let a = 0; a < 24; a++) { const an = (a / 24) * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(an) * 2 * S, Math.sin(an) * 2 * S); g.lineTo(Math.cos(an) * 13.5 * S, Math.sin(an) * 13.5 * S); g.stroke(); }
      g.restore();
      // fountain disc
      const fx = P(b.fountain[0]), fz = P(b.fountain[1]);
      const gf = g.createRadialGradient(fx, fz, 0, fx, fz, 6 * S);
      gf.addColorStop(0, blue ? '#cfeaff' : '#ffd9e1'); gf.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gf; g.beginPath(); g.arc(fx, fz, 6 * S, 0, Math.PI * 2); g.fill();
    }
    // pits
    for (const [key, p] of Object.entries(PITS)) {
      const cx = P(p.p[0]), cz = P(p.p[1]);
      const gr = g.createRadialGradient(cx, cz, 0, cx, cz, 6.4 * S);
      gr.addColorStop(0, key === 'titan' ? '#c9d2ee' : '#c8e6ea'); gr.addColorStop(0.8, key === 'titan' ? '#d5dcf2' : '#d4eef0'); gr.addColorStop(1, 'rgba(225,235,248,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cz, 6.4 * S, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(120,140,190,0.5)'; g.lineWidth = 0.1 * S;
      for (const r of [2.2, 4.2, 5.6]) { g.beginPath(); g.arc(cx, cz, r * S, 0, Math.PI * 2); g.stroke(); }
    }
    // border region: deeper snow with blue shadows
    g.save();
    g.fillStyle = 'rgba(215,226,245,0.6)';
    g.beginPath(); g.rect(0, 0, size, size); g.rect(P(-PLAY), P(-PLAY), (PLAY * 2) * S, (PLAY * 2) * S); g.fill('evenodd');
    g.restore();
  });
  const glow = canvasTex(1024, 1024, (g) => {
    const s = 1024 / (EXT * 2);
    const Q = (x) => (x + EXT) * s;
    g.fillStyle = '#000'; g.fillRect(0, 0, 1024, 1024);
    const rune = (x, z, r, color, n) => {
      g.save(); g.translate(Q(x), Q(z)); g.strokeStyle = color; g.lineWidth = 0.12 * s; g.shadowColor = color; g.shadowBlur = 0.4 * s;
      g.beginPath(); g.arc(0, 0, r * s, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.arc(0, 0, (r - 0.5) * s, 0, Math.PI * 2); g.stroke();
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        g.save(); g.rotate(a); g.translate(0, -(r - 0.25) * s);
        g.beginPath(); g.moveTo(-0.15 * s, 0.1 * s); g.lineTo(0, -0.12 * s); g.lineTo(0.15 * s, 0.1 * s); g.stroke();
        g.restore();
      }
      g.restore();
    };
    for (const b of BASES) {
      const c = b.team === 0 ? '#3aa8ff' : '#ff4a6e';
      rune(b.fountain[0], b.fountain[1], 4.6, c, 16);
      rune(b.fountain[0], b.fountain[1], 2.4, c, 8);
      rune(b.core[0], b.core[1], 5.2, c, 20);
    }
    rune(PITS.titan.p[0], PITS.titan.p[1], 4.2, '#7a6cff', 12);
    rune(PITS.tortoise.p[0], PITS.tortoise.p[1], 4.2, '#30d8c8', 12);
  });
  glow.colorSpace = THREE.SRGBColorSpace;
  return { col, glow };
}

// ---------------------------------------------------------------- prefab geometries
function treeGeometry(variant = 0) {
  const pb = new PartBuilder();
  pb.add(new THREE.CylinderGeometry(0.11, 0.17, 1.0, 6), 0x6b4a3a, mtx(0, 0.5, 0));
  const tiers = 4;
  const green = variant ? 0x2b5f66 : 0x2f6d63;
  for (let i = 0; i < tiers; i++) {
    const r = 1.28 - i * 0.26, h = 1.15 - i * 0.08, y = 0.85 + i * 0.66;
    pb.add(new THREE.ConeGeometry(r, h, 8, 1), i % 2 ? green : 0x337a70, mtx(0, y + h / 2, 0, 0, i * 0.4, 0));
    pb.add(new THREE.ConeGeometry(r * 0.86, h * 0.46, 8, 1), 0xf3f8ff, mtx(0, y + h * 0.74, 0, 0, i * 0.4 + 0.2, 0));
  }
  pb.add(new THREE.ConeGeometry(0.3, 0.5, 6), 0xf8fbff, mtx(0, 0.85 + tiers * 0.66 + 0.2, 0));
  return pb.geometry();
}
function rockGeometry(seed) {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const k = 1 + noise2(x * 1.7 + seed, z * 1.7 + y) * 0.35;
    pos.setXYZ(i, x * k * 1.15, Math.max(-0.2, y * k * 0.72), z * k);
  }
  g.computeVertexNormals();
  const pb = new PartBuilder();
  const rock = new THREE.Color(0x6a7a9c), rock2 = new THREE.Color(0x56658a), snow = new THREE.Color(0xf4f8ff);
  pb.add(g, 0xffffff, null, { colorFn: (x, y, z, nx, ny, nz, c) => (ny > 0.72 + noise2(x * 3, z * 3) * 0.25 ? c.copy(snow) : c.copy(hash2(x * 9, z * 9) > 0.5 ? rock : rock2)) });
  return pb.geometry();
}
function crystalGeometry() {
  const pb = new PartBuilder();
  const n = 6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + i * 0.3;
    const lean = i === 0 ? 0 : 0.35 + (i % 3) * 0.12;
    const h = i === 0 ? 2.2 : 1.0 + ((i * 37) % 10) / 12;
    const r = i === 0 ? 0.26 : 0.15 + ((i * 13) % 5) / 50;
    const body = new THREE.CylinderGeometry(r, r * 1.05, h, 6);
    body.translate(0, h / 2, 0);
    const tip = new THREE.ConeGeometry(r, r * 2.2, 6);
    tip.translate(0, h + r * 1.1, 0);
    const m = mtx(i === 0 ? 0 : Math.cos(a) * 0.22, 0, i === 0 ? 0 : Math.sin(a) * 0.22, Math.sin(a) * lean, 0, -Math.cos(a) * lean);
    const shade = 0.75 + (i % 3) * 0.12;
    pb.add(body, new THREE.Color(shade, shade, 1), m);
    pb.add(tip, 0xffffff, m);
  }
  return pb.geometry();
}
function grassGeometry() {
  const g = new THREE.BufferGeometry();
  const pos = [], uv = [], idx = [];
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI;
    const cx = Math.cos(a) * 0.55, cz = Math.sin(a) * 0.55;
    const b = pos.length / 3;
    pos.push(-cx, 0, -cz, cx, 0, cz, cx, 1.35, cz, -cx, 1.35, -cz);
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setIndex(idx);
  return g;
}
function grassTexture() {
  return canvasTex(256, 256, (g) => {
    g.clearRect(0, 0, 256, 256);
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 46; i++) {
      const x = 14 + rnd() * 228, w = 6 + rnd() * 8, h = 150 + rnd() * 100, bend = (rnd() - 0.5) * 60;
      const gr = g.createLinearGradient(0, 256, 0, 256 - h);
      gr.addColorStop(0, '#2c6e72'); gr.addColorStop(0.45, '#4f9e98'); gr.addColorStop(0.8, '#bfe6e2'); gr.addColorStop(1, '#ffffff');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(x - w / 2, 256); g.quadraticCurveTo(x + bend * 0.3, 256 - h * 0.6, x + bend, 256 - h); g.quadraticCurveTo(x + bend * 0.3 + w * 0.2, 256 - h * 0.55, x + w / 2, 256); g.fill();
    }
  });
}

// ---------------------------------------------------------------- environment
export class Environment {
  constructor(scene, quality) {
    this.scene = scene;
    this.q = quality;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.nav = new NavGrid();
    this.hf = new HeightField(this.nav);
    this.anim = [];
    this.buildTerrain();
    this.buildRiver();
    this.buildWalls();
    this.buildGrass();
    this.buildBases();
    this.buildLamps();
    this.buildBorder();
    this.buildSky();
    this.buildSnow();
    this.buildMotes();
  }
  height(x, z) { return this.hf.at(x, z); }
  buildTerrain() {
    const size = this.q >= 2 ? 2048 : 1536;
    const { col, glow } = paintGround(size);
    this.groundTex = col;
    const seg = this.q >= 2 ? 260 : 180;
    const geo = new THREE.PlaneGeometry(EXT * 2, EXT * 2, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, this.hf.at(pos.getX(i), pos.getZ(i)));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ map: col, emissiveMap: glow, emissive: 0xffffff, emissiveIntensity: 1.6, roughness: 0.92, metalness: 0.0, envMapIntensity: 0.3 });
    injectWorld(mat, { sparkle: this.q >= 1 ? 2.4 : 0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    this.group.add(mesh);
    this.terrain = mesh;
  }
  buildRiver() {
    const tex = canvasTex(512, 128, (g) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, 512, 128);
      let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 60; i++) {
        const x = rnd() * 512, y = rnd() * 128, r = 10 + rnd() * 40;
        const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(200,235,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }, { repeat: true });
    tex.repeat.set(6, 1);
    const alpha = canvasTex(4, 128, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, 128);
      gr.addColorStop(0, '#000'); gr.addColorStop(0.12, '#666'); gr.addColorStop(0.3, '#ddd'); gr.addColorStop(0.7, '#ddd'); gr.addColorStop(0.88, '#666'); gr.addColorStop(1, '#000');
      g.fillStyle = gr; g.fillRect(0, 0, 4, 128);
    }, { linear: true });
    const geo = new THREE.PlaneGeometry(200, (RIVER_HALF_W + 0.9) * 2, 1, 1);
    geo.rotateX(-Math.PI / 2);
    geo.rotateY(-Math.PI / 4);
    const mat = new THREE.MeshStandardMaterial({ color: 0xa8e4ff, map: tex, alphaMap: alpha, transparent: true, opacity: 0.6, roughness: 0.12, metalness: 0.1, envMapIntensity: 1.1, depthWrite: false });
    injectWorld(mat, { sparkle: 1.5 });
    const m = new THREE.Mesh(geo, mat);
    m.position.y = -0.24;
    m.receiveShadow = true;
    m.renderOrder = 1;
    this.group.add(m);
  }
  instanced(geo, mat, list, opts = {}) {
    if (!list.length) return null;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
    list.forEach((it, i) => {
      e.set(it.rx || 0, it.ry || 0, it.rz || 0); q.setFromEuler(e);
      s.set(it.s, it.sy ?? it.s, it.s); p.set(it.x, it.y, it.z);
      m.compose(p, q, s); im.setMatrixAt(i, m);
    });
    im.castShadow = !!opts.cast; im.receiveShadow = !!opts.receive;
    im.frustumCulled = false;
    this.group.add(im);
    return im;
  }
  buildWalls() {
    let seed = 99;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const trees = [], trees2 = [], rocks = [[], [], []], crystals = [], pinks = [], pillars = [];
    const pitArc = (w) => { const b = polyBounds(w); const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2; return Object.values(PITS).some((p) => Math.hypot(cx - p.p[0], cz - p.p[1]) < 9.5); };
    for (const w of WALLS) {
      const b = polyBounds(w);
      const isPit = pitArc(w);
      // edge rocks
      for (let i = 0; i < w.length; i++) {
        const [ax, az] = w[i], [bx, bz] = w[(i + 1) % w.length];
        const L = Math.hypot(bx - ax, bz - az);
        const steps = Math.max(1, Math.floor(L / (isPit ? 1.1 : 1.5)));
        for (let s = 0; s < steps; s++) {
          const t = (s + rnd() * 0.6) / steps;
          const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
          if (Math.abs(x) > 59 || Math.abs(z) > 59) continue;
          const sc = isPit ? 0.9 + rnd() * 0.6 : 0.7 + rnd() * 0.75;
          rocks[Math.floor(rnd() * 3)].push({ x, z, y: this.height(x, z) - 0.15, s: sc, sy: sc * (isPit ? 1.4 : 0.85 + rnd() * 0.5), ry: rnd() * 6.28 });
        }
      }
      if (isPit) {
        const c = w[Math.floor(w.length / 4)];
        pillars.push({ x: c[0], z: c[1], y: this.height(c[0], c[1]) - 0.2, s: 1.0 + rnd() * 0.3, sy: 1.3 + rnd() * 0.4, ry: rnd() * 6 });
        continue;
      }
      // interior trees
      for (let x = b.x0 + 0.5; x <= b.x1; x += 1.38) for (let z = b.z0 + 0.5; z <= b.z1; z += 1.38) {
        const jx = x + (rnd() - 0.5) * 0.9, jz = z + (rnd() - 0.5) * 0.9;
        if (!pointInPoly(jx, jz, w)) continue;
        if (Math.abs(jx) > PLAY + 3 || Math.abs(jz) > PLAY + 3) continue;
        const edge = distToPolyEdge(jx, jz, w);
        if (edge < 0.3) continue;
        const sc = 0.85 + rnd() * 0.45 + Math.min(0.45, edge * 0.12);
        (rnd() < 0.5 ? trees : trees2).push({ x: jx, z: jz, y: this.height(jx, jz) - 0.1, s: sc, sy: sc * (0.85 + rnd() * 0.35), ry: rnd() * 6.28 });
      }
      // crystals at a couple of edge points
      if (b.x1 - b.x0 + b.z1 - b.z0 > 5 && rnd() < 0.8) {
        const p = w[Math.floor(rnd() * w.length)];
        (rnd() < 0.72 ? crystals : pinks).push({ x: p[0], z: p[1], y: this.height(p[0], p[1]) - 0.1, s: 0.6 + rnd() * 0.5, ry: rnd() * 6.28 });
      }
    }
    // crystals around pits & river banks
    for (const p of Object.values(PITS)) for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      const x = p.p[0] + Math.cos(a) * 8.6, z = p.p[1] + Math.sin(a) * 8.6;
      crystals.push({ x, z, y: this.height(x, z) - 0.1, s: 0.7 + rnd() * 0.3, ry: rnd() * 6 });
    }
    this.treeGeo = treeGeometry(0);
    const treeMat = injectWorld(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, envMapIntensity: 0.5 }), { occlude: true });
    this.trees = this.instanced(this.treeGeo, treeMat, trees, { cast: true, receive: true });
    this.trees2 = this.instanced(treeGeometry(1), treeMat, trees2, { cast: true, receive: true });
    const rockMat = injectWorld(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true, envMapIntensity: 0.6 }), { occlude: true });
    rocks.forEach((list, i) => this.instanced(rockGeometry(i * 3.7), rockMat, list, { cast: true, receive: true }));
    const cg = crystalGeometry();
    const cmat = injectWorld(new THREE.MeshStandardMaterial({ vertexColors: true, color: 0xbfefff, emissive: 0x2fa6e0, emissiveIntensity: 1.25, roughness: 0.15, metalness: 0.2, envMapIntensity: 1.5 }), { fow: false });
    this.instanced(cg, cmat, crystals, { cast: false });
    const pmat = injectWorld(new THREE.MeshStandardMaterial({ vertexColors: true, color: 0xf3d6ff, emissive: 0xb35ee8, emissiveIntensity: 1.1, roughness: 0.15, metalness: 0.2, envMapIntensity: 1.5 }), { fow: false });
    this.instanced(cg, pmat, pinks, { cast: false });
    // pit pillars (ancient ice obelisks)
    const pg = new PartBuilder();
    pg.add(new THREE.CylinderGeometry(0.55, 0.75, 3.2, 6), 0xdfe9f7, mtx(0, 1.6, 0));
    pg.add(new THREE.ConeGeometry(0.55, 1.0, 6), 0xffffff, mtx(0, 3.7, 0));
    pg.add(new THREE.TorusGeometry(0.62, 0.08, 6, 12), 0xffd88a, mtx(0, 2.4, 0, Math.PI / 2));
    this.instanced(pg.geometry(), injectWorld(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.2 })), pillars, { cast: true });
  }
  buildGrass() {
    let seed = 5;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const list = [];
    BUSHES.forEach((b, id) => {
      const bb = polyBounds(b);
      for (let x = bb.x0; x <= bb.x1; x += 0.42) for (let z = bb.z0; z <= bb.z1; z += 0.42) {
        const jx = x + (rnd() - 0.5) * 0.4, jz = z + (rnd() - 0.5) * 0.4;
        if (!pointInPoly(jx, jz, b)) continue;
        const edge = distToPolyEdge(jx, jz, b);
        const sc = 0.75 + rnd() * 0.45 - (edge < 0.4 ? 0.2 : 0);
        list.push({ x: jx, z: jz, y: this.height(jx, jz) - 0.05, s: sc, sy: sc * (0.9 + rnd() * 0.4), ry: rnd() * 6.28, bush: id + 1 });
      }
    });
    const tex = grassTexture();
    const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8, envMapIntensity: 0.6 });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = U.uTime; sh.uniforms.uPlayer = U.uPlayer; sh.uniforms.uFow = U.uFow; sh.uniforms.uFowOn = U.uFowOn;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; uniform vec3 uPlayer; varying float vNear; varying vec3 vWorldP;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float sway = sin(uTime * 1.6 + ip.x * 0.7 + ip.z * 0.5) * 0.12 + sin(uTime * 3.1 + ip.x * 2.0) * 0.04;
          float hgt = position.y;
          transformed.x += sway * hgt * hgt * 0.5;
          vec2 dp = ip.xz - uPlayer.xz;
          float dd = length(dp);
          vNear = 1.0 - smoothstep(1.6, 2.8, dd);
          transformed.xz += (vNear * 0.0);
        `)
        .replace('#include <project_vertex>', `#include <project_vertex>
          vWorldP = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vNear; varying vec3 vWorldP; uniform sampler2D uFow; uniform float uFowOn;')
        .replace('#include <alphatest_fragment>', `#include <alphatest_fragment>
          if (vNear > 0.01) {
            vec2 sp = floor(gl_FragCoord.xy * 0.5);
            float dth = fract(sin(dot(sp, vec2(12.9898, 78.233))) * 43758.5453);
            if (dth < vNear * 0.7) discard;
          }`)
        .replace('#include <opaque_fragment>', `
          if (uFowOn > 0.5) { float vis = texture2D(uFow, (vWorldP.xz + 60.0) / 120.0).r; outgoingLight *= mix(0.66, 1.0, vis); }
          #include <opaque_fragment>`);
    };
    mat.customProgramCacheKey = () => 'grass';
    this.grass = this.instanced(grassGeometry(), mat, list, { cast: false, receive: true });
  }
  buildBases() {
    for (const b of BASES) {
      const tc = TEAM_COL[b.team];
      const g = new THREE.Group();
      const [fx, fz] = b.fountain;
      const y0 = this.height(fx, fz);
      const pb = new PartBuilder(), gb = new PartBuilder();
      pb.add(new THREE.CylinderGeometry(5.2, 5.6, 0.35, 32), 0xe6eef9, mtx(0, 0.17, 0));
      pb.add(new THREE.CylinderGeometry(4.6, 4.8, 0.12, 32), b.team ? 0xf6dfe6 : 0xdcecfb, mtx(0, 0.4, 0));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        pb.add(new THREE.CylinderGeometry(0.28, 0.36, 3.2, 6), 0xf2f7ff, mtx(Math.cos(a) * 4.9, 1.9, Math.sin(a) * 4.9));
        pb.add(new THREE.ConeGeometry(0.34, 0.7, 6), 0xffffff, mtx(Math.cos(a) * 4.9, 3.85, Math.sin(a) * 4.9));
        gb.add(new THREE.OctahedronGeometry(0.28), tc, mtx(Math.cos(a) * 4.9, 4.5, Math.sin(a) * 4.9, 0, 0, 0, 1, 1.6, 1));
      }
      const crystal = new THREE.OctahedronGeometry(0.9, 0);
      gb.add(crystal, tc, mtx(0, 3.2, 0, 0, 0, 0, 1, 2.0, 1));
      const m1 = pb.mesh(injectWorld(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.15, envMapIntensity: 1.2 })));
      m1.receiveShadow = true; m1.castShadow = true;
      g.add(m1);
      const gm = gb.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, emissive: tc, emissiveIntensity: 1.1, roughness: 0.2 }));
      g.add(gm);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.06, 8, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(tc).multiplyScalar(1.6) }));
      ring.position.y = 3.2; ring.rotation.x = Math.PI / 2;
      g.add(ring);
      this.anim.push((t) => { gm.children; ring.rotation.z = t * 0.8; ring.position.y = 3.2 + Math.sin(t * 1.3) * 0.25; });
      g.position.set(fx, y0, fz);
      this.group.add(g);
      // banners around the plaza
      const bannerMat = injectWorld(new THREE.MeshStandardMaterial({ color: tc, roughness: 0.7, side: THREE.DoubleSide }));
      const poleMat = injectWorld(new THREE.MeshStandardMaterial({ color: 0xe8eef8, roughness: 0.4, metalness: 0.3 }));
      for (let i = 0; i < 7; i++) {
        const a = (b.team ? Math.PI : 0) + (-0.15 + (i / 6) * 1.87) * -1 + Math.PI * 0.5 * (b.team ? 1 : 1);
        void a;
      }
      const corner = b.team === 0 ? [-1, 1] : [1, -1];
      for (let i = 0; i < 6; i++) {
        const t = (i + 0.5) / 6;
        const ang = Math.PI * 0.5 * t;
        // arc behind the core (toward the map corner)
        const x = b.core[0] + corner[0] * Math.cos(ang) * 11.5, z = b.core[1] + corner[1] * Math.sin(ang) * 11.5;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 4.2, 6), poleMat);
        pole.position.set(x, this.height(x, z) + 2.1, z);
        pole.castShadow = true;
        const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2.0, 1, 4), bannerMat);
        flag.position.set(x, this.height(x, z) + 2.9, z);
        flag.rotation.y = Math.atan2(-(b.core[0] - x), -(b.core[1] - z)) + Math.PI / 2;
        flag.castShadow = true;
        this.group.add(pole, flag);
      }
    }
  }
  buildLamps() {
    const posts = [], glows = [];
    let seed = 17;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (const pts of Object.values(LANES)) {
      let acc = 6;
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
        const L = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / L, nz = (bx - ax) / L;
        for (let s = acc; s < L; s += 16) {
          for (const side of [-1, 1]) {
            const x = ax + (bx - ax) * (s / L) + nx * side * (LANE_HALF_W + 0.6), z = az + (bz - az) * (s / L) + nz * side * (LANE_HALF_W + 0.6);
            if (this.nav.blocked(x, z) || Math.abs(riverU(x, z)) < RIVER_HALF_W + 1) continue;
            if (TOWERS.some((t) => Math.hypot(t.p[0] - x, t.p[1] - z) < 3)) continue;
            const y = this.height(x, z);
            posts.push({ x, y, z, s: 1, ry: rnd() * 6 });
            glows.push({ x, y: y + 2.05, z, s: 1, ry: rnd() * 6 });
          }
        }
        acc = 16 - ((L - acc) % 16);
      }
    }
    const pb = new PartBuilder();
    pb.add(new THREE.CylinderGeometry(0.07, 0.1, 1.9, 6), 0x4a5670, mtx(0, 0.95, 0));
    pb.add(new THREE.CylinderGeometry(0.2, 0.26, 0.12, 6), 0x4a5670, mtx(0, 0.06, 0));
    pb.add(new THREE.ConeGeometry(0.22, 0.24, 6), 0xf5f9ff, mtx(0, 2.38, 0));
    this.instanced(pb.geometry(), injectWorld(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.4 })), posts, { cast: true });
    const gb = new PartBuilder();
    gb.add(new THREE.OctahedronGeometry(0.17), 0xffe6b0, mtx(0, 0, 0, 0, 0, 0, 1, 1.4, 1));
    this.instanced(gb.geometry(), new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(2.6, 2.4, 2.0) }), glows);
  }
  buildBorder() {
    let seed = 31;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const trees = [], rocks = [], crys = [];
    for (let i = 0; i < 1100; i++) {
      const x = (rnd() * 2 - 1) * (EXT - 2), z = (rnd() * 2 - 1) * (EXT - 2);
      const e = Math.max(Math.abs(x), Math.abs(z)) - PLAY;
      if (e < 1.2) continue;
      if (Math.abs(riverU(x, z)) < RIVER_HALF_W + 1 && e < 20) continue;
      const y = this.height(x, z);
      const r = rnd();
      // keep the north/south strips (between the camera and the lanes) free of tall trees
      const camStrip = Math.abs(z) > PLAY && Math.abs(z) < PLAY + 24 && Math.abs(x) < EXT;
      if (camStrip) { if (r < 0.5) rocks.push({ x, y: y - 0.25, z, s: 0.8 + rnd() * 1.2, sy: 0.6 + rnd() * 0.6, ry: rnd() * 6 }); else if (r < 0.62) crys.push({ x, y: y - 0.1, z, s: 0.7 + rnd() * 0.6, ry: rnd() * 6 }); continue; }
      if (r < 0.78) trees.push({ x, y: y - 0.1, z, s: 0.9 + rnd() * 0.8, ry: rnd() * 6 });
      else if (r < 0.95) rocks.push({ x, y: y - 0.2, z, s: 1 + rnd() * 1.6, sy: 0.8 + rnd(), ry: rnd() * 6 });
      else crys.push({ x, y: y - 0.1, z, s: 0.9 + rnd() * 0.8, ry: rnd() * 6 });
    }
    const treeMat = injectWorld(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, envMapIntensity: 0.5 }), { fow: false });
    this.instanced(this.treeGeo, treeMat, trees, { cast: this.q >= 2, receive: false });
    this.instanced(rockGeometry(9.1), injectWorld(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }), { fow: false }), rocks, { cast: false });
    this.instanced(crystalGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, color: 0xbfefff, emissive: 0x2fa6e0, emissiveIntensity: 1.2, roughness: 0.15, metalness: 0.2 }), crys);
    // distant mountains
    const pb = new PartBuilder();
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * Math.PI * 2 + rnd() * 0.15;
      const R = 115 + rnd() * 45, H = 28 + rnd() * 40, W = 30 + rnd() * 22;
      const g = new THREE.ConeGeometry(W, H, 9, 4);
      const p = g.attributes.position;
      for (let k = 0; k < p.count; k++) {
        const x = p.getX(k), y = p.getY(k), z = p.getZ(k);
        const n = noise2(x * 0.08 + i * 3, z * 0.08 + y * 0.05) * 0.25;
        p.setXYZ(k, x * (1 + n), y, z * (1 + n));
      }
      g.computeVertexNormals();
      const snow = new THREE.Color(0xf4f8ff), rock = new THREE.Color(0x8798b8);
      pb.add(g, 0xffffff, mtx(Math.cos(a) * R, H / 2 - 4, Math.sin(a) * R, 0, rnd() * 6, 0), { colorFn: (x, y, z, nx, ny, nz, c) => ((y + H / 2) / H > 0.45 - ny * 0.3 + noise2(x * 0.2, z * 0.2) * 0.15 ? c.copy(snow) : c.copy(rock)) });
    }
    const mtn = pb.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true, envMapIntensity: 0.7 }));
    this.group.add(mtn);
  }
  buildSky() {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime },
      side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w; }`,
      fragmentShader: `
        uniform float uTime; varying vec3 vDir;
        float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n21(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
        float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a * n21(p); p *= 2.03; a *= 0.5; } return s; }
        void main(){
          vec3 d = normalize(vDir);
          float y = d.y;
          vec3 top = vec3(0.05, 0.08, 0.22), mid = vec3(0.22, 0.32, 0.62), hor = vec3(0.98, 0.72, 0.78);
          vec3 col = mix(hor, mid, smoothstep(-0.02, 0.22, y));
          col = mix(col, top, smoothstep(0.2, 0.85, y));
          // stars
          vec2 sp = d.xz / (d.y + 1.2) * 180.0;
          float st = step(0.996, h21(floor(sp))) * smoothstep(0.15, 0.5, y) * (0.6 + 0.4 * sin(uTime * 2.0 + h21(floor(sp)) * 50.0));
          col += vec3(st);
          // aurora ribbons
          vec2 ap = d.xz / max(0.12, d.y + 0.25);
          float t = uTime * 0.05;
          float band = 0.0;
          for (int k = 0; k < 3; k++) {
            float fk = float(k);
            float wv = sin(ap.x * (0.9 + fk * 0.35) + t * (2.0 + fk) + fbm(ap * 0.6 + t + fk) * 3.0) * 0.5;
            float dist = abs(ap.y * 0.7 + wv - 0.6 + fk * 0.5);
            band += smoothstep(0.55, 0.0, dist) * (0.55 + 0.45 * fbm(vec2(ap.x * 3.0 + t * 8.0, fk)));
          }
          float amask = smoothstep(0.08, 0.35, y) * (1.0 - smoothstep(0.75, 1.0, y));
          vec3 ac = mix(vec3(0.2, 1.0, 0.7), vec3(0.65, 0.4, 1.0), smoothstep(0.2, 0.9, y));
          col += ac * band * amask * 0.55;
          col = mix(col, vec3(0.92, 0.94, 1.0), smoothstep(0.04, -0.12, y));
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 18), mat);
    sky.frustumCulled = false;
    sky.renderOrder = -10;
    this.sky = sky;
    this.scene.add(sky);
  }
  buildSnow() {
    const n = this.q >= 2 ? 2400 : this.q >= 1 ? 1500 : 700;
    const geo = new THREE.BufferGeometry();
    const p = new Float32Array(n * 3), r = new Float32Array(n);
    for (let i = 0; i < n; i++) { p[i * 3] = (Math.random() - 0.5) * 70; p[i * 3 + 1] = Math.random() * 26; p[i * 3 + 2] = (Math.random() - 0.5) * 60; r[i] = Math.random(); }
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    geo.setAttribute('rnd', new THREE.BufferAttribute(r, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime, uCenter: { value: new THREE.Vector3() }, uTex: { value: particleAtlas() }, uScale: { value: 300 } },
      vertexShader: `uniform float uTime; uniform vec3 uCenter; uniform float uScale; attribute float rnd; varying float vA; varying float vR;
        void main(){
          vec3 p = position;
          float fall = uTime * (1.0 + rnd * 1.2);
          p.y = mod(p.y - fall, 26.0);
          p.x += sin(uTime * 0.7 + rnd * 20.0) * 0.8 + uTime * 0.6;
          p.z += cos(uTime * 0.5 + rnd * 13.0) * 0.6;
          p.x = mod(p.x - uCenter.x + 35.0, 70.0) - 35.0 + uCenter.x;
          p.z = mod(p.z - uCenter.z + 30.0, 60.0) - 30.0 + uCenter.z;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (0.08 + rnd * 0.1) * uScale / -mv.z;
          vA = 0.55 + rnd * 0.45; vR = rnd;
        }`,
      fragmentShader: `uniform sampler2D uTex; varying float vA; varying float vR;
        void main(){ vec2 uv = gl_PointCoord * 0.5; if (vR > 0.85) uv += vec2(0.0, 0.5); vec4 t = texture2D(uTex, uv); gl_FragColor = vec4(vec3(1.0, 1.0, 1.04), t.a * vA); }`,
      transparent: true, depthWrite: false,
    });
    this.snow = new THREE.Points(geo, mat);
    this.snow.frustumCulled = false;
    this.scene.add(this.snow);
  }
  buildMotes() {
    const n = this.q >= 1 ? 420 : 160;
    const geo = new THREE.BufferGeometry();
    const p = new Float32Array(n * 3), c = new Float32Array(n * 3), r = new Float32Array(n);
    const cols = [new THREE.Color(0x9ff3ff), new THREE.Color(0xd2a8ff), new THREE.Color(0xfff2b8), new THREE.Color(0xa6ffdf)];
    let i = 0, guard = 0;
    while (i < n && guard++ < 20000) {
      const x = (Math.random() * 2 - 1) * PLAY, z = (Math.random() * 2 - 1) * PLAY;
      if (this.nav.blocked(x, z) && Math.random() < 0.7) continue;
      p[i * 3] = x; p[i * 3 + 1] = this.height(x, z) + 0.4 + Math.random() * 2.5; p[i * 3 + 2] = z;
      const cc = cols[i % 4]; c[i * 3] = cc.r; c[i * 3 + 1] = cc.g; c[i * 3 + 2] = cc.b;
      r[i] = Math.random();
      i++;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
    geo.setAttribute('rnd', new THREE.BufferAttribute(r, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime, uTex: { value: particleAtlas() }, uScale: { value: 300 } },
      vertexShader: `uniform float uTime; uniform float uScale; attribute float rnd; attribute vec3 color; varying vec3 vC; varying float vA;
        void main(){ vec3 p = position; p.y += sin(uTime * 0.8 + rnd * 30.0) * 0.4; p.x += sin(uTime * 0.3 + rnd * 10.0) * 0.6;
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
          float tw = 0.5 + 0.5 * sin(uTime * (1.0 + rnd * 2.0) + rnd * 40.0);
          gl_PointSize = (0.22 + 0.25 * tw) * uScale / -mv.z; vC = color; vA = 0.35 + 0.65 * tw; }`,
      fragmentShader: `uniform sampler2D uTex; varying vec3 vC; varying float vA;
        void main(){ vec4 t = texture2D(uTex, gl_PointCoord * 0.5 + vec2(0.5, 0.0)); gl_FragColor = vec4(vC * 2.2, t.a * vA); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.motes = new THREE.Points(geo, mat);
    this.motes.frustumCulled = false;
    this.scene.add(this.motes);
  }
  update(t, camTarget, viewH) {
    for (const f of this.anim) f(t);
    if (this.snow) { this.snow.material.uniforms.uCenter.value.copy(camTarget); this.snow.material.uniforms.uScale.value = viewH * 0.9; }
    if (this.motes) this.motes.material.uniforms.uScale.value = viewH * 0.9;
  }
}
