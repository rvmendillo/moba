import { NavGrid, N, RES, HALF, LANES, TOWERS, CAMPS, PITS, BASES, inRiver, WALLS, BUSHES } from '../src/sim/map.js';
import { writePNG } from './png.mjs';
const S = 4; // px per fine cell
const W = N * S;
const img = new Uint8Array(W * W * 4);
const nav = new NavGrid();
const set = (px, py, r, g, b) => { if (px < 0 || py < 0 || px >= W || py >= W) return; const k = (py * W + px) * 4; img[k] = r; img[k + 1] = g; img[k + 2] = b; img[k + 3] = 255; };
const toPx = (x) => Math.round((x + HALF) / RES * S);
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const x = -HALF + (i + 0.5) * RES, z = -HALF + (j + 0.5) * RES;
  let c = [225, 232, 240];
  if (inRiver(x, z)) c = [150, 200, 240];
  if (nav.bush[j * N + i]) c = [90, 170, 110];
  if (nav.block[j * N + i]) c = [60, 64, 80];
  for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) set(i * S + dx, j * S + dy, ...c);
}
const line = (x0, z0, x1, z1, col) => { const n = 400; for (let k = 0; k <= n; k++) { const t = k / n; set(toPx(x0 + (x1 - x0) * t), toPx(z0 + (z1 - z0) * t), ...col); } };
const disc = (x, z, r, col) => { const pr = r / RES * S; const cx = toPx(x), cy = toPx(z); for (let dy = -pr; dy <= pr; dy++) for (let dx = -pr; dx <= pr; dx++) if (dx * dx + dy * dy <= pr * pr) set(Math.round(cx + dx), Math.round(cy + dy), ...col); };
for (const pts of Object.values(LANES)) for (let i = 0; i < pts.length - 1; i++) line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], [200, 120, 40]);
for (const t of TOWERS) disc(t.p[0], t.p[1], 1.4, t.team ? [220, 50, 50] : [50, 90, 230]);
for (const b of BASES) { disc(b.core[0], b.core[1], 2.4, b.team ? [255, 120, 120] : [120, 170, 255]); disc(b.fountain[0], b.fountain[1], 1.2, [255, 255, 0]); }
for (const c of CAMPS) disc(c.p[0], c.p[1], c.kind === 'azure' ? 1.4 : c.kind === 'ember' ? 1.4 : 0.9, c.kind === 'azure' ? [0, 200, 255] : c.kind === 'ember' ? [255, 120, 0] : [150, 60, 200]);
for (const p of Object.values(PITS)) disc(p.p[0], p.p[1], 1.8, [255, 0, 255]);
writePNG(process.argv[2] || '/tmp/map.png', W, W, img);
// connectivity check: paths between key points
const pts = { blueF: BASES[0].fountain, redF: BASES[1].fountain, ...Object.fromEntries(CAMPS.map((c) => ['camp' + c.id + c.kind, c.p])), titan: PITS.titan.p, tort: PITS.tortoise.p };
let bad = 0;
for (const [k, p] of Object.entries(pts)) {
  const t0 = performance.now();
  const path = nav.findPath(BASES[0].fountain[0], BASES[0].fountain[1], p[0], p[1]);
  const ms = performance.now() - t0;
  if (!path) { console.log('NO PATH to', k); bad++; } else console.log(k, 'ok', path.length, 'wps', ms.toFixed(2) + 'ms');
}
// camps must not be inside walls
for (const c of CAMPS) if (nav.blocked(c.p[0], c.p[1])) console.log('camp blocked', c);
for (const t of TOWERS) if (nav.blocked(t.p[0], t.p[1])) console.log('tower blocked', t);
console.log('walls', WALLS.length, 'bushes', BUSHES.length, 'bad', bad);
