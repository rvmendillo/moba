// Client-side view of the match: decodes snapshots and interpolates between them.
import { ANIMS, F } from '../sim/world.js';

export function decodeUnit(a) {
  return { id: a[0], kind: a[1], type: a[2], team: a[3], x: a[4] / 100, z: a[5] / 100, facing: a[6] / 100, hp: a[7], maxHp: a[8], mana: a[9], maxMana: a[10], level: a[11], flags: a[12], anim: ANIMS[a[13]] || 'idle', animAge: a[14] / 100, shield: a[15], airH: a[16] / 100, recall: a[17] / 10 };
}
export function decodeHero(a) {
  return {
    id: a[0], def: a[1], team: a[2], slot: a[3], name: a[4], level: a[5], xp: a[6], xpNext: a[7], gold: a[8], k: a[9], d: a[10], a: a[11], items: a[12],
    ranks: a[13], cds: a[14].map((v) => v / 10), cdMax: a[15].map((v) => v / 10), points: a[16], spell: a[17], spellCd: a[18] / 10, respawn: a[19] / 10, pet: a[20],
    goldEarned: a[21], dmgDealt: a[22], regenCd: a[23] / 10, cs: a[24], stats: a[25], netId: a[26], bot: a[27], dmgTaken: a[28], healDone: a[29], canLevel: a[30], mana: a[31],
  };
}
const angLerp = (a, b, t) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * t; };

export class ClientState {
  constructor(delay = 1 / 30) {
    this.snaps = [];
    this.delay = delay;
    this.heroes = new Map();
    this.heroList = [];
    this.pending = [];
    this.kills = [0, 0];
    this.obj = [0, 0];
    this.camps = [];
    this.over = -1;
    this.latestT = 0;
    this.renderT = 0;
    this.time = 0;
  }
  push(snap) {
    const units = new Map();
    for (const a of snap.u) { const u = decodeUnit(a); units.set(u.id, u); }
    const projs = new Map();
    for (const a of snap.p) projs.set(a[0], { id: a[0], kind: a[1], x: a[2] / 100, z: a[3] / 100, y: a[4] / 100, team: a[5], ang: a[6] / 100 });
    const zones = snap.z.map((a) => ({ id: a[0], kind: a[1], x: a[2] / 100, z: a[3] / 100, r: a[4] / 100, team: a[5], t: a[6] / 100, dur: a[7] / 100 }));
    this.snaps.push({ t: snap.t, units, projs, zones });
    if (this.snaps.length > 8) this.snaps.shift();
    if (snap.e && snap.e.length) this.pending.push({ t: snap.t, e: snap.e });
    if (snap.h) {
      this.heroList = snap.h.map(decodeHero);
      for (const h of this.heroList) this.heroes.set(h.id, h);
    }
    this.kills = snap.k; this.obj = snap.o; this.camps = snap.cp || this.camps;
    if (snap.over !== undefined) this.over = snap.over;
    this.latestT = snap.t;
    this.time = snap.t;
  }
  // advance the render clock smoothly toward (latest - delay)
  tick(dt) {
    const want = this.latestT - this.delay;
    this.renderT += dt;
    const err = want - this.renderT;
    if (Math.abs(err) > 0.3) this.renderT = want;
    else this.renderT += err * Math.min(1, dt * 4);
    return this.renderT;
  }
  takeEvents() {
    const out = [];
    while (this.pending.length && this.pending[0].t <= this.renderT + 0.0001) out.push(...this.pending.shift().e);
    return out;
  }
  sample() {
    const T = this.renderT;
    const S = this.snaps;
    if (!S.length) return null;
    let a = S[0], b = S[S.length - 1];
    for (let i = 0; i < S.length - 1; i++) if (S[i].t <= T && S[i + 1].t >= T) { a = S[i]; b = S[i + 1]; break; }
    if (T >= b.t) a = b;
    const span = b.t - a.t;
    const k = span > 0 ? Math.max(0, Math.min(1, (T - a.t) / span)) : 1;
    const units = [];
    for (const [id, ub] of b.units) {
      const ua = a.units.get(id);
      if (!ua || ua === ub) { units.push({ ...ub, animAge: ub.animAge + Math.max(0, T - b.t), vx: 0, vz: 0 }); continue; }
      const dx = ub.x - ua.x, dz = ub.z - ua.z;
      const teleport = dx * dx + dz * dz > 36;
      units.push({
        ...ub,
        x: teleport ? ub.x : ua.x + dx * k, z: teleport ? ub.z : ua.z + dz * k,
        facing: angLerp(ua.facing, ub.facing, k), airH: ua.airH + (ub.airH - ua.airH) * k,
        animAge: ub.anim === ua.anim && ub.animAge >= ua.animAge ? ua.animAge + (ub.animAge - ua.animAge) * k : ub.animAge - (1 - k) * span,
        vx: span > 0 && !teleport ? dx / span : 0, vz: span > 0 && !teleport ? dz / span : 0,
      });
    }
    const projs = [];
    for (const [id, pb] of b.projs) {
      const pa = a.projs.get(id);
      projs.push(pa ? { ...pb, x: pa.x + (pb.x - pa.x) * k, z: pa.z + (pb.z - pa.z) * k } : pb);
    }
    return { t: T, units, projs, zones: b.zones };
  }
  hero(id) { return this.heroes.get(id); }
  visibleTo(u, team) { return u.team === team || u.team === 2 || (team === 0 ? u.flags & F.vis0 : u.flags & F.vis1); }
}
