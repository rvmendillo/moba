// Frostvale map definition: 3 lanes, river, jungle walls, bushes, bases, towers, camps, objective pits.
// World coords: x = east, z = south. Blue base is south-west (-x,+z); Red base is north-east (+x,-z).
// The map is point-symmetric (R) between teams and mirror-symmetric (M) across the mid lane.
import { pointInPoly, distToPolyEdge, polyBounds, distToSeg } from './rng.js';

export const HALF = 60;
export const PLAY = 56.5;
export const RES = 0.5;
export const N = Math.round((HALF * 2) / RES); // fine grid (collision)
export const CRES = 1.0;
export const CN = Math.round((HALF * 2) / CRES); // coarse grid (pathfinding)

export const R = ([x, z]) => [-x, -z];
export const M = ([x, z]) => [-z, -x];
const RM = (p) => R(M(p));
const mapPoly = (poly, f) => poly.map(f);

export const BASES = [
  { team: 0, core: [-45, 45], fountain: [-52.5, 52.5] },
  { team: 1, core: [45, -45], fountain: [52.5, -52.5] },
];
export const FOUNTAIN_R = 6.5;

// ---- Lanes (Blue -> Red order) ----
const TOP = [[-47.5, 37], [-50.5, 26], [-51, 10], [-51, -8], [-50.6, -26], [-49.6, -38], [-46.6, -46.6], [-38, -49.6], [-26, -50.6], [-8, -51], [10, -51], [26, -50.5], [37, -47.5]];
const MID = [[-38, 38], [-26, 26], [-13, 13], [0, 0], [13, -13], [26, -26], [38, -38]];
const BOT = TOP.map(R).reverse();
export const LANES = { top: TOP, mid: MID, bot: BOT };
export const LANE_HALF_W = 4.6;
export const LANE_LEN = Object.fromEntries(Object.entries(LANES).map(([k, pts]) => [k, pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0)]));
export const LANE_SPAWN = {
  0: { top: [-47.5, 41], mid: [-41.5, 41.5], bot: [-41, 47.5] },
  1: { top: [41, -47.5], mid: [41.5, -41.5], bot: [47.5, -41] },
};
// path a minion of `team` follows in `lane`
export function lanePath(team, lane) {
  const pts = LANES[lane].map((p) => [p[0], p[1]]);
  const spawn = LANE_SPAWN[team][lane];
  const enemyCore = BASES[1 - team].core;
  if (team === 0) return [spawn, ...pts, enemyCore];
  return [spawn, ...pts.reverse(), enemyCore];
}

// ---- River ----
export const RIVER_HALF_W = 5.0; // in u units (perpendicular to river line x = z)
export const riverU = (x, z) => (x - z) / Math.SQRT2; // signed distance from river centerline
export const midV = (x, z) => (x + z) / Math.SQRT2; // signed distance from mid lane centerline
export function inRiver(x, z) { return Math.abs(riverU(x, z)) < RIVER_HALF_W; }

// ---- Towers ----
const BLUE_TOWERS = [
  { lane: 'top', tier: 0, p: [-53.6, -20] },
  { lane: 'top', tier: 1, p: [-53.6, 3] },
  { lane: 'top', tier: 2, p: [-53.0, 28] },
  { lane: 'mid', tier: 0, p: [-11.9, 15.1] },
  { lane: 'mid', tier: 1, p: [-22.9, 26.1] },
  { lane: 'mid', tier: 2, p: [-32.6, 35.8] },
];
for (const t of BLUE_TOWERS.slice(0, 3)) BLUE_TOWERS.push({ lane: 'bot', tier: t.tier, p: M(t.p) });
export const TOWERS = [
  ...BLUE_TOWERS.map((t) => ({ ...t, team: 0 })),
  ...BLUE_TOWERS.map((t) => ({ ...t, p: R(t.p), team: 1 })),
];

// ---- Objective pits ----
export const PITS = {
  titan: { p: [-23, -23], r: 6.2 },
  tortoise: { p: [23, 23], r: 6.2 },
};

// ---- Jungle camps ----
// West triangle (Blue top jungle) authored by hand; others derived by symmetry.
const WEST_CAMPS = [
  { kind: 'azure', p: [-31, 4] },
  { kind: 'wolves', p: [-37.5, -15] },
  { kind: 'beetles', p: [-21, -6.5] },
];
export const CAMPS = [];
{
  let id = 0;
  for (const c of WEST_CAMPS) CAMPS.push({ id: id++, kind: c.kind, p: c.p, side: 0 });
  for (const c of WEST_CAMPS) CAMPS.push({ id: id++, kind: c.kind === 'azure' ? 'ember' : c.kind, p: M(c.p), side: 0 });
  for (const c of WEST_CAMPS) CAMPS.push({ id: id++, kind: c.kind, p: R(c.p), side: 1 });
  for (const c of WEST_CAMPS) CAMPS.push({ id: id++, kind: c.kind === 'azure' ? 'ember' : c.kind, p: RM(c.p), side: 1 });
}

// ---- Walls ----
function blob(cx, cz, rx, rz, rot = 0, n = 9, seed = 1) {
  const pts = [];
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 0.82 + rnd() * 0.3;
    const lx = Math.cos(a) * rx * k, lz = Math.sin(a) * rz * k;
    const c = Math.cos(rot), sn = Math.sin(rot);
    pts.push([cx + lx * c - lz * sn, cz + lx * sn + lz * c]);
  }
  return pts;
}
function arc(cx, cz, r0, r1, a0, a1, steps = 6) {
  const pts = [];
  for (let i = 0; i <= steps; i++) { const a = a0 + ((a1 - a0) * i) / steps; pts.push([cx + Math.cos(a) * r1, cz + Math.sin(a) * r1]); }
  for (let i = steps; i >= 0; i--) { const a = a0 + ((a1 - a0) * i) / steps; pts.push([cx + Math.cos(a) * r0, cz + Math.sin(a) * r0]); }
  return pts;
}

const WEST_WALLS = [
  // base wall between top & mid exits
  [[-46.4, 33.5], [-46.4, 22.5], [-42.5, 18.5], [-36.5, 21.5], [-36.2, 27.2], [-40.5, 32.5]],
  // top-lane side walls (with jungle entrances between them)
  [[-46.4, 15.5], [-46.4, 7.5], [-42.0, 6.0], [-39.0, 9.5], [-41.5, 14.5]],
  [[-46.4, -4.5], [-46.4, -10.5], [-42.6, -11.0], [-40.6, -7.0], [-43.0, -4.0]],
  [[-46.4, -25.5], [-46.4, -33.5], [-43.2, -34.0], [-41.2, -28.5], [-43.5, -25.0]],
  // inner jungle
  blob(-30.0, -3.5, 3.6, 2.4, 0.5, 9, 3),   // between owl and beetles
  blob(-25.5, 14.0, 4.0, 2.3, -0.6, 9, 5),  // between owl and mid lane
  blob(-33.5, -22.5, 2.6, 2.0, 0.9, 8, 7),  // near river
  blob(-13.6, -0.6, 2.4, 1.7, 0.8, 8, 11),  // apex near mid / river
  blob(-36.5, 18.0, 2.0, 1.6, 0.2, 8, 13),  // near base
  blob(-28.0, -12.5, 1.8, 1.5, 0.0, 7, 17), // beetle cover
];
export const WALLS = [];
for (const w of WEST_WALLS) {
  WALLS.push(w, mapPoly(w, M), mapPoly(w, R), mapPoly(w, RM));
}
// corner fillers (outside the side lane bends)
{
  const nw = [[-60, -60], [-60, -43], [-56.6, -43], [-54.2, -48.4], [-48.4, -54.2], [-43, -56.6], [-43, -60]];
  WALLS.push(nw, mapPoly(nw, R));
  // base back corners (behind fountains)
  const sw = [[-60, 60], [-60, 57.6], [-57.6, 60]];
  WALLS.push(sw, mapPoly(sw, R));
}
// objective pit stones: 4 arcs leaving openings along the river and toward both jungles
for (const key of ['titan', 'tortoise']) {
  const { p } = PITS[key];
  for (let k = 0; k < 4; k++) {
    const c = (k * Math.PI) / 2; // arcs centered on +x, +z, -x, -z directions
    WALLS.push(arc(p[0], p[1], 6.4, 8.4, c - 0.42, c + 0.42, 6));
  }
}

// ---- Bushes (tall frost grass) ----
const WEST_BUSHES = [
  blob(-44.2, -38.5, 1.6, 3.2, 0.0, 9, 21), // top lane near river crossing
  blob(-43.8, -1.0, 1.6, 2.6, 0.0, 9, 22),  // top lane mid entrance
  blob(-25.6, 6.6, 2.6, 1.6, 0.4, 9, 23),   // owl side
  blob(-15.8, 7.6, 2.4, 1.5, -0.8, 9, 24),  // mid lane side
  blob(-27.4, -17.6, 2.4, 1.6, 0.8, 9, 25), // river bank
  blob(-41.0, 21.0, 2.0, 1.5, 0.4, 9, 26),  // base side
  blob(-35.0, -8.0, 1.8, 1.5, 0.3, 9, 27),  // wolves side
];
export const BUSHES = [];
for (const b of WEST_BUSHES) BUSHES.push(b, mapPoly(b, M), mapPoly(b, R), mapPoly(b, RM));
// river bushes
{
  const rb = [blob(-11.5, -11.5, 2.6, 1.6, Math.PI / 4, 9, 31), blob(-35.5, -35.5, 2.6, 1.6, Math.PI / 4, 9, 32)];
  for (const b of rb) BUSHES.push(b, mapPoly(b, R));
}

// ---- Nav grid ----
export const WALL_MARGIN = 0.55;
export class NavGrid {
  constructor() {
    this.block = new Uint8Array(N * N);   // static walls / out of bounds
    this.struct = new Uint8Array(N * N);  // structures (towers/cores), removable
    this.bush = new Uint8Array(N * N);    // bush id + 1
    this.coarse = new Uint8Array(CN * CN);
    this._build();
  }
  _build() {
    const { block, bush } = this;
    for (let j = 0; j < N; j++) {
      const z = -HALF + (j + 0.5) * RES;
      for (let i = 0; i < N; i++) {
        const x = -HALF + (i + 0.5) * RES;
        if (Math.abs(x) > PLAY || Math.abs(z) > PLAY) block[j * N + i] = 1;
      }
    }
    for (const poly of WALLS) this._raster(poly, WALL_MARGIN, (k) => { block[k] = 1; });
    BUSHES.forEach((poly, id) => this._raster(poly, 0, (k) => { bush[k] = id + 1; }));
    this.rebuildCoarse();
  }
  _raster(poly, margin, fn) {
    const b = polyBounds(poly);
    const i0 = Math.max(0, this.cell(b.x0 - margin - 1)), i1 = Math.min(N - 1, this.cell(b.x1 + margin + 1));
    const j0 = Math.max(0, this.cell(b.z0 - margin - 1)), j1 = Math.min(N - 1, this.cell(b.z1 + margin + 1));
    for (let j = j0; j <= j1; j++) {
      const z = -HALF + (j + 0.5) * RES;
      for (let i = i0; i <= i1; i++) {
        const x = -HALF + (i + 0.5) * RES;
        if (pointInPoly(x, z, poly) || (margin > 0 && distToPolyEdge(x, z, poly) < margin)) fn(j * N + i);
      }
    }
  }
  setStructure(x, z, r, on) {
    const i0 = Math.max(0, this.cell(x - r - 1)), i1 = Math.min(N - 1, this.cell(x + r + 1));
    const j0 = Math.max(0, this.cell(z - r - 1)), j1 = Math.min(N - 1, this.cell(z + r + 1));
    for (let j = j0; j <= j1; j++) {
      const cz = -HALF + (j + 0.5) * RES;
      for (let i = i0; i <= i1; i++) {
        const cx = -HALF + (i + 0.5) * RES;
        if ((cx - x) * (cx - x) + (cz - z) * (cz - z) <= r * r) this.struct[j * N + i] = on ? 1 : 0;
      }
    }
    this.rebuildCoarse(x - r - 2, z - r - 2, x + r + 2, z + r + 2);
  }
  rebuildCoarse(x0 = -HALF, z0 = -HALF, x1 = HALF, z1 = HALF) {
    const f = CRES / RES; // fine cells per coarse cell (2)
    const ci0 = Math.max(0, Math.floor((x0 + HALF) / CRES)), ci1 = Math.min(CN - 1, Math.floor((x1 + HALF) / CRES));
    const cj0 = Math.max(0, Math.floor((z0 + HALF) / CRES)), cj1 = Math.min(CN - 1, Math.floor((z1 + HALF) / CRES));
    for (let cj = cj0; cj <= cj1; cj++) {
      for (let ci = ci0; ci <= ci1; ci++) {
        let bl = 0, tot = 0;
        for (let dj = 0; dj < f; dj++) for (let di = 0; di < f; di++) {
          const k = (cj * f + dj) * N + (ci * f + di);
          tot++;
          if (this.block[k] || this.struct[k]) bl++;
        }
        this.coarse[cj * CN + ci] = bl * 2 >= tot ? 1 : 0;
      }
    }
  }
  cell(v) { return Math.floor((v + HALF) / RES); }
  blocked(x, z) {
    const i = Math.floor((x + HALF) / RES), j = Math.floor((z + HALF) / RES);
    if (i < 0 || j < 0 || i >= N || j >= N) return true;
    const k = j * N + i;
    return this.block[k] !== 0 || this.struct[k] !== 0;
  }
  wallAt(x, z) {
    const i = Math.floor((x + HALF) / RES), j = Math.floor((z + HALF) / RES);
    if (i < 0 || j < 0 || i >= N || j >= N) return true;
    return this.block[j * N + i] !== 0;
  }
  bushAt(x, z) {
    const i = Math.floor((x + HALF) / RES), j = Math.floor((z + HALF) / RES);
    if (i < 0 || j < 0 || i >= N || j >= N) return 0;
    return this.bush[j * N + i];
  }
  // straight-line walkability check (fine grid)
  lineClear(x0, z0, x1, z1, ignoreStruct = false) {
    const dx = x1 - x0, dz = z1 - z0;
    const len = Math.sqrt(dx * dx + dz * dz);
    const steps = Math.ceil(len / (RES * 0.5));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const x = x0 + dx * t, z = z0 + dz * t;
      if (ignoreStruct ? this.wallAt(x, z) : this.blocked(x, z)) return false;
    }
    return true;
  }
  // furthest free point along a segment (used by dashes / blinks)
  sweep(x0, z0, x1, z1) {
    const dx = x1 - x0, dz = z1 - z0;
    const len = Math.sqrt(dx * dx + dz * dz);
    const steps = Math.max(1, Math.ceil(len / (RES * 0.5)));
    let lx = x0, lz = z0;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const x = x0 + dx * t, z = z0 + dz * t;
      if (this.blocked(x, z)) return [lx, lz];
      lx = x; lz = z;
    }
    return [lx, lz];
  }
  // landing point for blink / leap: target if free, otherwise nearest free cell around it
  nearestFree(x, z, maxR = 6) {
    if (!this.blocked(x, z)) return [x, z];
    for (let r = RES; r <= maxR; r += RES) {
      const n = Math.max(8, Math.ceil((r * Math.PI * 2) / RES));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        if (!this.blocked(px, pz)) return [px, pz];
      }
    }
    return [x, z];
  }
  // A* on coarse grid; returns array of [x,z] waypoints (smoothed) or null
  findPath(x0, z0, x1, z1) {
    const ci = (v) => Math.max(0, Math.min(CN - 1, Math.floor((v + HALF) / CRES)));
    let s = ci(z0) * CN + ci(x0);
    let g = ci(z1) * CN + ci(x1);
    const C = this.coarse;
    if (C[g]) { const f = this._nearestOpenCoarse(g); if (f < 0) return null; g = f; }
    if (C[s]) { const f = this._nearestOpenCoarse(s); if (f < 0) return null; s = f; }
    if (s === g) return [[x1, z1]];
    if (!this._as) {
      this._as = { gs: new Float32Array(CN * CN), par: new Int32Array(CN * CN), stamp: new Uint32Array(CN * CN), closed: new Uint32Array(CN * CN), id: 0, heap: new Int32Array(CN * CN * 4), hf: new Float32Array(CN * CN * 4) };
    }
    const A = this._as;
    A.id++;
    const id = A.id;
    const gx = g % CN, gz = (g / CN) | 0;
    const H = (k) => { const dx = Math.abs((k % CN) - gx), dz = Math.abs(((k / CN) | 0) - gz); return dx + dz + (Math.SQRT2 - 2) * Math.min(dx, dz); };
    let hn = 0;
    const heap = A.heap, hf = A.hf;
    const push = (k, f) => {
      let i = hn++; heap[i] = k; hf[i] = f;
      while (i > 0) { const p = (i - 1) >> 1; if (hf[p] <= hf[i]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; [hf[p], hf[i]] = [hf[i], hf[p]]; i = p; }
    };
    const pop = () => {
      const top = heap[0]; hn--;
      if (hn > 0) {
        heap[0] = heap[hn]; hf[0] = hf[hn];
        let i = 0;
        for (;;) {
          const l = i * 2 + 1, r = l + 1; let m = i;
          if (l < hn && hf[l] < hf[m]) m = l;
          if (r < hn && hf[r] < hf[m]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]]; [hf[m], hf[i]] = [hf[i], hf[m]]; i = m;
        }
      }
      return top;
    };
    A.stamp[s] = id; A.gs[s] = 0; A.par[s] = -1;
    push(s, H(s));
    const DX = [1, -1, 0, 0, 1, 1, -1, -1], DZ = [0, 0, 1, -1, 1, -1, 1, -1];
    let found = false, iter = 0;
    while (hn > 0 && iter++ < 20000) {
      if (hn > heap.length - 16) break;
      const cur = pop();
      if (A.closed[cur] === id) continue;
      A.closed[cur] = id;
      if (cur === g) { found = true; break; }
      const cx = cur % CN, cz = (cur / CN) | 0;
      for (let d = 0; d < 8; d++) {
        const nx = cx + DX[d], nz = cz + DZ[d];
        if (nx < 0 || nz < 0 || nx >= CN || nz >= CN) continue;
        const nk = nz * CN + nx;
        if (C[nk]) continue;
        if (d >= 4 && (C[cz * CN + nx] || C[nz * CN + cx])) continue; // no corner cutting
        if (A.closed[nk] === id) continue;
        const ng = A.gs[cur] + (d >= 4 ? Math.SQRT2 : 1);
        if (A.stamp[nk] !== id || ng < A.gs[nk]) {
          A.stamp[nk] = id; A.gs[nk] = ng; A.par[nk] = cur;
          push(nk, ng + H(nk) * 1.001);
        }
      }
    }
    if (!found) return null;
    const raw = [];
    for (let k = g; k !== -1; k = A.par[k]) raw.push([-HALF + ((k % CN) + 0.5) * CRES, -HALF + (((k / CN) | 0) + 0.5) * CRES]);
    raw.reverse();
    raw[raw.length - 1] = this.blocked(x1, z1) ? raw[raw.length - 1] : [x1, z1];
    // string pulling
    const out = [];
    let ax = x0, az = z0, i = 0;
    while (i < raw.length) {
      let j = raw.length - 1;
      while (j > i && !this.lineClear(ax, az, raw[j][0], raw[j][1])) j--;
      out.push(raw[j]);
      ax = raw[j][0]; az = raw[j][1];
      i = j + 1;
    }
    return out;
  }
  _nearestOpenCoarse(k) {
    const cx = k % CN, cz = (k / CN) | 0;
    for (let r = 1; r < 12; r++) {
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const nx = cx + dx, nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= CN || nz >= CN) continue;
        if (!this.coarse[nz * CN + nx]) return nz * CN + nx;
      }
    }
    return -1;
  }
}

// distance from a point to the closest lane polyline (used for map art and AI)
export function laneDistance(x, z) {
  let best = Infinity, lane = null;
  for (const [name, pts] of Object.entries(LANES)) {
    for (let i = 0; i < pts.length - 1; i++) {
      const d = distToSeg(x, z, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
      if (d < best) { best = d; lane = name; }
    }
  }
  return { d: best, lane };
}

// progress (0..1, from Blue to Red) of a point projected onto a lane
export function laneProgress(lane, x, z) {
  const pts = LANES[lane];
  let total = 0;
  const segs = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    segs.push(l); total += l;
  }
  let best = Infinity, bestAt = 0, acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const abx = bx - ax, abz = bz - az, l2 = abx * abx + abz * abz;
    let t = ((x - ax) * abx + (z - az) * abz) / l2;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + abx * t, cz = az + abz * t;
    const d = (x - cx) ** 2 + (z - cz) ** 2;
    if (d < best) { best = d; bestAt = acc + segs[i] * t; }
    acc += segs[i];
  }
  return bestAt / total;
}
// point on a lane at progress t (0..1, Blue->Red)
export function lanePoint(lane, t) {
  const pts = LANES[lane];
  let total = 0;
  const segs = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    segs.push(l); total += l;
  }
  let d = Math.max(0, Math.min(1, t)) * total;
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i] || i === segs.length - 1) {
      const k = segs[i] > 0 ? Math.min(1, d / segs[i]) : 0;
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k];
    }
    d -= segs[i];
  }
  return pts[pts.length - 1];
}
