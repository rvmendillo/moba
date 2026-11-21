// Authoritative MOBA simulation. Runs at a fixed 30 Hz tick on the host (or single player).
import { mulberry32, clamp } from './rng.js';
import { NavGrid, BASES, TOWERS, CAMPS, PITS, lanePath, FOUNTAIN_R, LANES } from './map.js';
import { Unit, KIND_CODE, blankStats } from './unit.js';
import { HEROES, HERO_BY_ID } from '../data/heroes.js';
import { ITEM_BY_ID, SPELL_BY_ID, PET_BY_ID, ITEMS, SPELLS, PETS } from '../data/items.js';
import { MINION_TYPES, MINION_TYPE_LIST, TOWER_STATS, CORE_STATS, TOWER_ATK, MONSTERS, MONSTER_LIST, CAMP_SPAWNS, CAMP_RESPAWN, CAMP_FIRST, TIMINGS, XP_TO_NEXT, MAX_LEVEL } from '../data/units.js';
import { BotBrain, TeamBrain } from './ai.js';

export const DT = 1 / 30;
export const ANIMS = ['idle', 'atk', 'cast0', 'cast1', 'cast2', 'spin', 'thrust', 'leap', 'rush', 'dashSlash', 'glide', 'roll', 'stab', 'rend', 'shoot', 'aim', 'strum', 'recall', 'spell', 'dead', 'atk2'];
const ANIM_CODE = Object.fromEntries(ANIMS.map((a, i) => [a, i]));
export const PROJ_KINDS = ['arrow', 'auroraBolt', 'emberBolt', 'holyBolt', 'note', 'bolt', 'minionBolt', 'siegeShell', 'towerShot', 'owlFeather', 'snowball', 'iceLance', 'shuriken', 'fireball', 'bigArrow', 'snipe', 'bindRune', 'chainBolt', 'dragonBreath', 'coreShot'];
const PROJ_CODE = Object.fromEntries(PROJ_KINDS.map((a, i) => [a, i]));
export const ZONE_KINDS = ['blizzard', 'fireRing', 'arrowRain'];
const ZONE_CODE = Object.fromEntries(ZONE_KINDS.map((a, i) => [a, i]));
export const F = { alive: 1, vis0: 2, vis1: 4, stun: 8, root: 16, slow: 32, silence: 64, air: 128, invis: 256, untarget: 512, recall: 1024, bush: 2048, shield: 4096, regen: 8192, sleep: 16384, burn: 32768, haste: 65536, ember: 131072, azure: 262144, invuln: 524288, dash: 1048576 };
const SHARE_R = 10;

export class World {
  constructor(opts) {
    this.opts = opts;
    this.rng = mulberry32(opts.seed || 12345);
    this.nav = new NavGrid();
    this.time = 0; this.tickN = 0; this.nextId = 1;
    this.units = []; this.heroes = []; this.towers = []; this.cores = []; this.monsters = []; this.minions = [];
    this.projs = []; this.zones = []; this.timers = []; this.events = [];
    this.over = false; this.winner = -1;
    this.teamKills = [0, 0]; this.firstBlood = false;
    this.itemAvail = new Set(opts.items || ITEMS.map((i) => i.id));
    this.difficulty = opts.difficulty || 'normal';
    this.hash = new Map();
    this.shakeAmt = 0;
    for (const t of TOWERS) this.addTower(t);
    for (const b of BASES) this.addCore(b);
    this.updateTowerVulnerability();
    this.camps = CAMPS.map((c) => ({ ...c, units: [], respawnAt: CAMP_FIRST[c.kind], up: false }));
    this.bosses = {
      tortoise: { unit: null, respawnAt: TIMINGS.tortoiseFirst, announced: false },
      titan: { unit: null, respawnAt: TIMINGS.titanFirst, announced: false },
    };
    this.nextWave = TIMINGS.firstWave; this.waveN = 0;
    (opts.players || []).forEach((p, i) => this.addHero(p, i));
    this.teamBrains = [new TeamBrain(this, 0), new TeamBrain(this, 1)];
    this.computeVision();
  }

  // ------------------------------------------------------------ setup
  addUnit(u) { this.units.push(u); return u; }
  addTower(t) {
    const s = TOWER_STATS[t.tier];
    const u = new Unit(this, 'tower', t.team, t.p[0], t.p[1]);
    u.lane = t.lane; u.tier = t.tier; u.typeIdx = t.tier + (t.lane === 'top' ? 0 : t.lane === 'mid' ? 3 : 6);
    u.radius = TOWER_ATK.radius;
    u.baseSt = { ...blankStats(), maxHp: s.hp, armor: s.armor, mr: s.mr, atk: TOWER_ATK.atk, as: TOWER_ATK.as, range: TOWER_ATK.range, sight: 10.5 };
    u.st = { ...u.baseSt }; u.hp = s.hp; u.sight = 10.5;
    this.nav.setStructure(u.x, u.z, u.radius, true);
    this.towers.push(u); return this.addUnit(u);
  }
  addCore(b) {
    const u = new Unit(this, 'core', b.team, b.core[0], b.core[1]);
    u.radius = 2.4; u.typeIdx = 0;
    u.baseSt = { ...blankStats(), maxHp: CORE_STATS.hp, armor: CORE_STATS.armor, mr: CORE_STATS.mr, atk: TOWER_ATK.atk * 1.1, as: 0.9, range: 8.5, sight: 11 };
    u.st = { ...u.baseSt }; u.hp = CORE_STATS.hp; u.sight = 11;
    this.nav.setStructure(u.x, u.z, 2.2, true);
    this.cores.push(u); return this.addUnit(u);
  }
  addHero(p, slot) {
    const def = HERO_BY_ID[p.heroId] || HEROES[0];
    const f = BASES[p.team].fountain;
    const k = slot % 5;
    const ang = (k / 5) * Math.PI * 2 + 0.3;
    const h = new Unit(this, 'hero', p.team, f[0] + Math.cos(ang) * 2.2, f[1] + Math.sin(ang) * 2.2);
    h.def = def; h.typeIdx = def.index; h.slot = slot; h.name = p.name || def.name; h.isBot = !!p.bot; h.netId = p.netId || null;
    h.role = p.role || def.lane;
    h.level = 1; h.xp = 0; h.gold = 300; h.items = []; h.skillPoints = 1;
    h.skills = def.skills.map(() => ({ rank: 0, cd: 0 }));
    h.spell = SPELL_BY_ID[p.spellId] ? p.spellId : def.spell; h.spellCd = 0;
    h.petId = PET_BY_ID[p.petId] ? p.petId : 'fox';
    h.k = 0; h.d = 0; h.a = 0; h.streak = 0; h.multi = { n: 0, t: -99 }; h.deathStreak = 0; h.cs = 0;
    h.goldEarned = 0; h.dmgDealt = 0; h.dmgTaken = 0; h.healDone = 0;
    h.respawnAt = 0; h.recallT = 0; h.regenT = 0; h.regenCd = 0;
    h.input = { mx: 0, mz: 0, atk: false, mode: 'auto' };
    h.radius = 0.62;
    h.sight = 11 + (h.petId === 'owl' ? 2.5 : 0);
    h.passives = new Set();
    h.auroraCd = 0; h.chainN = 0; h.petT = 3;
    h.autoLevel = p.autoLevel !== false;
    this.recalcHero(h, true);
    h.hp = h.st.maxHp; h.mana = h.st.maxMana;
    if (p.bot) h.brain = new BotBrain(this, h, h.role, p.difficulty || this.difficulty);
    if (p.bot || h.autoLevel) this.autoSkill(h);
    this.heroes.push(h);
    return this.addUnit(h);
  }

  // ------------------------------------------------------------ stats
  recalcHero(h, first = false) {
    const d = h.def.stats, L = h.level - 1;
    const s = blankStats();
    s.maxHp = d.hp + d.hpG * L; s.maxMana = d.mana + d.manaG * L; s.atk = d.atk + d.atkG * L;
    s.armor = d.armor + d.armorG * L; s.mr = d.mr + d.mrG * L;
    s.range = d.range; s.ms = d.ms; s.hpReg = d.hpReg + d.hpRegG * L; s.mpReg = d.mpReg + d.mpRegG * L; s.sight = h.sight;
    let asB = d.asG * L;
    h.passives.clear();
    for (const id of h.items) {
      const it = ITEM_BY_ID[id]; if (!it) continue;
      for (const k in it.stats) {
        const v = it.stats[k];
        if (k === 'as') asB += v; else if (k === 'hp') s.maxHp += v; else if (k === 'mana') s.maxMana += v; else s[k] += v;
      }
      if (it.passive) h.passives.add(it.passive);
    }
    if (h.passives.has('amp')) s.magAmp += 0.2;
    if (h.passives.has('tenacity')) s.tenacity += 0.25;
    const pet = h.petId;
    if (pet === 'sprite') { s.hpReg += 4; s.mpReg += 2; }
    if (pet === 'seal') s.dmgRed += 0.04;
    if (pet === 'phoenix') s.dmgAmp += 0.03;
    this.applyBuffMods(h, s, asB, d.as);
    const oldMax = h.st.maxHp, oldMana = h.st.maxMana;
    h.st = s;
    if (!first) {
      if (s.maxHp > oldMax && h.alive) h.hp += s.maxHp - oldMax;
      if (s.maxMana > oldMana) h.mana += s.maxMana - oldMana;
      h.hp = Math.min(h.hp, s.maxHp); h.mana = Math.min(h.mana, s.maxMana);
    }
    h.dirty = false;
  }
  applyBuffMods(u, s, asB, baseAs) {
    let msP = 0, slow = 0, atkP = 0;
    let untarget = false, invis = false, rooted = false;
    for (const b of u.buffs) {
      if (b.untarget) untarget = true;
      if (b.invis) invis = true;
      if (b.rooted) rooted = true;
      const m = b.mods; if (!m) continue;
      const f = b.decay ? Math.max(0, b.t / b.dur) : 1;
      if (m.msP) msP += m.msP * f;
      if (m.slow) slow = Math.max(slow, m.slow);
      if (m.asP) asB += m.asP * f;
      if (m.atkF) s.atk += m.atkF; if (m.atkP) atkP += m.atkP;
      if (m.armorF) s.armor += m.armorF; if (m.mrF) s.mr += m.mrF;
      if (m.dmgRed) s.dmgRed += m.dmgRed;
      if (m.cdrF) s.cdr += m.cdrF;
      if (m.hpRegF) s.hpReg += m.hpRegF; if (m.mpRegF) s.mpReg += m.mpRegF;
      if (m.magF) s.mag += m.magF;
      if (m.dmgAmp) s.dmgAmp += m.dmgAmp;
    }
    if (u.kind === 'hero' && u.petId === 'fox') msP += 0.04;
    if (u.kind === 'hero' && u.petId === 'phoenix') msP += 0.03;
    s.as = Math.min(2.5, (baseAs || s.as) * (1 + asB));
    s.ms = Math.max(1.6, s.ms * (1 + msP) * (1 - slow));
    s.atk *= 1 + atkP;
    s.mag *= 1 + s.magAmp;
    s.cdr = Math.min(0.4, s.cdr);
    s.dmgRed = Math.min(0.7, s.dmgRed);
    s.crit = Math.min(1, s.crit);
    s.tenacity = Math.min(0.6, s.tenacity);
    u.untarget = untarget || !!(u.dash && u.dash.opts.untarget);
    u.invis = invis;
    u.rootedBuff = rooted;
    u.slowed = slow > 0;
  }
  recalc(u) {
    if (u.kind === 'hero') return this.recalcHero(u);
    const s = { ...u.baseSt };
    this.applyBuffMods(u, s, 0, u.baseSt.as);
    u.st = s;
    u.dirty = false;
  }

  // ------------------------------------------------------------ events
  ev(...a) { this.events.push(a); }
  fx(kind, x, z, r = 1, color = 0xffffff, a = 0, b = 0) { this.ev('fx', kind, +x.toFixed(2), +z.toFixed(2), +(+r).toFixed(2), color, +(+a).toFixed(3), +(+b).toFixed(3)); }
  sfx(name, x, z) { this.ev('sfx', name, +x.toFixed(1), +z.toFixed(1)); }
  tele(x, z, r, dur, kind, team) { this.ev('tele', +x.toFixed(2), +z.toFixed(2), r, dur, kind, team); }
  shake(a) { this.ev('shake', a); }
  ann(code, team, a = 0, b = 0) { this.ev('ann', code, team, a, b); }
  after(delay, fn) { this.timers.push({ at: this.time + delay, fn }); }
  takeEvents() { const e = this.events; this.events = []; return e; }

  // ------------------------------------------------------------ spatial queries
  rebuildHash() {
    for (const arr of this.hash.values()) arr.length = 0;
    for (const u of this.units) {
      if (!u.alive) continue;
      const key = ((Math.floor((u.x + 64) / 8)) << 5) | Math.floor((u.z + 64) / 8);
      let arr = this.hash.get(key);
      if (!arr) { arr = []; this.hash.set(key, arr); }
      arr.push(u);
    }
  }
  query(x, z, r, fn) {
    const i0 = Math.floor((x - r + 64) / 8), i1 = Math.floor((x + r + 64) / 8);
    const j0 = Math.floor((z - r + 64) / 8), j1 = Math.floor((z + r + 64) / 8);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const arr = this.hash.get((i << 5) | j);
      if (!arr) continue;
      for (let k = 0; k < arr.length; k++) {
        const u = arr[k];
        const dx = u.x - x, dz = u.z - z, rr = r + u.radius;
        if (dx * dx + dz * dz <= rr * rr) fn(u);
      }
    }
  }
  isEnemy(a, b) { return a.team !== b.team; }
  enemies(src, x, z, r, opts = {}) {
    const out = [];
    this.query(x, z, r, (u) => {
      if (!u.alive || u.untarget || u.team === src.team) return;
      if (u.kind === 'tower' || u.kind === 'core') { if (!opts.structures) return; }
      if (opts.heroes && u.kind !== 'hero') return;
      if (opts.visible && !this.visibleTo(u, src.team)) return;
      out.push(u);
    });
    return out;
  }
  allies(src, x, z, r, opts = {}) {
    const out = [];
    this.query(x, z, r, (u) => {
      if (!u.alive || u.team !== src.team) return;
      if (opts.heroes && u.kind !== 'hero') return;
      if (opts.self === false && u === src) return;
      out.push(u);
    });
    return out;
  }
  lineHits(src, x, z, dx, dz, len, width, opts = {}) {
    const out = [];
    const cx = x + dx * len * 0.5, cz = z + dz * len * 0.5;
    this.query(cx, cz, len * 0.5 + width, (u) => {
      if (!u.alive || u.untarget || u.team === src.team || u.kind === 'tower' || u.kind === 'core') return;
      if (opts.heroes && u.kind !== 'hero') return;
      const px = u.x - x, pz = u.z - z;
      const t = px * dx + pz * dz;
      if (t < -u.radius || t > len + u.radius) return;
      const perp = Math.abs(px * dz - pz * dx);
      if (perp <= width * 0.5 + u.radius) out.push(u);
    });
    return out;
  }
  coneHits(src, x, z, dx, dz, len, halfAng, opts = {}) {
    const out = [];
    const cosA = Math.cos(halfAng);
    this.query(x, z, len, (u) => {
      if (!u.alive || u.untarget || u.team === src.team || u.kind === 'tower' || u.kind === 'core') return;
      if (opts.heroes && u.kind !== 'hero') return;
      const px = u.x - x, pz = u.z - z;
      const d = Math.hypot(px, pz);
      if (d < u.radius + 0.5) { out.push(u); return; }
      if ((px * dx + pz * dz) / d >= cosA) out.push(u);
    });
    return out;
  }
  visibleTo(u, team) { return u.team === team || u.vis[team]; }
  dist(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
  inRange(a, b, r) { const d = r + b.radius + a.radius * 0.3; const dx = a.x - b.x, dz = a.z - b.z; return dx * dx + dz * dz <= d * d; }

  // ------------------------------------------------------------ status helpers used by skills
  buff(u, spec) {
    if (!u.alive) return;
    const existing = u.buffs.find((b) => b.id === spec.id);
    if (existing) {
      existing.t = Math.max(existing.t, spec.dur); existing.dur = spec.dur;
      if (spec.mods) existing.mods = spec.mods;
      if (spec.dot) existing.dot = spec.dot;
      if (spec.hot) existing.hot = spec.hot;
      u.dirty = true;
      return existing;
    }
    const b = { ...spec, t: spec.dur, next: 0 };
    u.buffs.push(b);
    u.dirty = true;
    return b;
  }
  removeBuff(u, id) {
    const i = u.buffs.findIndex((b) => b.id === id);
    if (i >= 0) { const b = u.buffs[i]; u.buffs.splice(i, 1); u.dirty = true; if (b.onEnd) b.onEnd(); }
  }
  hasBuff(u, id) { return u.buffs.some((b) => b.id === id); }
  shield(u, amt, dur, src, id) {
    if (!u.alive || amt <= 0) return;
    if (id) { const s = u.shields.find((x) => x.id === id); if (s) { s.amt = Math.max(s.amt, amt); s.t = dur; return; } }
    u.shields.push({ amt, t: dur, id });
    if (src && src.kind === 'hero' && src !== u) src.healDone += amt * 0.5;
  }
  heal(src, u, amt) {
    if (!u.alive || amt <= 0) return 0;
    const before = u.hp;
    u.hp = Math.min(u.st.maxHp, u.hp + amt);
    const done = u.hp - before;
    if (done > 1 && u.kind === 'hero') this.ev('dmg', u.id, Math.round(done), 3, 0, src ? src.id : 0);
    if (src && src.kind === 'hero' && src !== u) src.healDone += done;
    return done;
  }
  cleanse(u) {
    u.cc.stun = 0; u.cc.root = 0; u.cc.silence = 0; u.cc.sleep = 0;
    u.buffs = u.buffs.filter((b) => !(b.mods && b.mods.slow) && !b.dot);
    u.dirty = true;
  }
  cc(t, kind, dur, src, opt, variant) {
    if (!t.alive || t.kind === 'tower' || t.kind === 'core') return;
    if (t.kind === 'monster' && t.boss) return;
    if (t.ccImmuneT > this.time) return;
    if (t.untarget && kind !== 'slow') return;
    const ten = t.st.tenacity || 0;
    if (src && src.kind === 'hero' && t.kind === 'hero') t.hurtBy.set(src.id, this.time);
    switch (kind) {
      case 'stun': t.cc.stun = Math.max(t.cc.stun, dur * (1 - ten)); if (variant === 'sleep') t.cc.sleep = t.cc.stun; this.interrupt(t); break;
      case 'root': t.cc.root = Math.max(t.cc.root, dur * (1 - ten)); this.cancelRecall(t); break;
      case 'silence': t.cc.silence = Math.max(t.cc.silence, dur * (1 - ten)); break;
      case 'slow': this.buff(t, { id: 'slow' + (src ? src.id : 0), dur: dur * (1 - ten * 0.5), mods: { slow: opt } }); break;
      case 'air': if (t.dash) break; t.cc.air = Math.max(t.cc.air, dur); t.cc.airDur = Math.max(t.cc.airDur, dur); this.interrupt(t); break;
      case 'knock': case 'pull': {
        if (t.dash) break;
        let dx = t.x - opt.x, dz = t.z - opt.z;
        const d = Math.hypot(dx, dz) || 1;
        dx /= d; dz /= d;
        const sgn = kind === 'knock' ? 1 : -1;
        const dd = Math.min(opt.dist, kind === 'pull' ? d : opt.dist);
        t.disp = { vx: (dx * sgn * dd) / dur, vz: (dz * sgn * dd) / dur, t: dur };
        this.interrupt(t);
        break;
      }
    }
  }
  interrupt(u) {
    u.windup = 0; u.windTarget = null;
    this.cancelRecall(u);
    if (u.kind === 'hero') u.regenT = 0;
  }
  cancelRecall(u) { if (u.kind === 'hero' && u.recallT > 0) { u.recallT = 0; } }
  breakStealth(u) {
    if (u.invis) { u.buffs = u.buffs.filter((b) => !b.invis); u.dirty = true; }
    if (u.bush) u.revealT = this.time + 1.0;
  }
  dash(u, tx, tz, opts = {}) {
    let ex = tx, ez = tz;
    if (!opts.ignoreWalls && !opts.targetId) [ex, ez] = this.nav.sweep(u.x, u.z, tx, tz);
    if (opts.ignoreWalls) [ex, ez] = this.nav.nearestFree(tx, tz);
    const total = Math.hypot(ex - u.x, ez - u.z);
    u.dash = { tx: ex, tz: ez, speed: opts.speed || 18, opts, hit: new Set(), total: Math.max(0.01, total), done: 0 };
    u.windup = 0; u.windTarget = null; this.cancelRecall(u);
    if (total > 0.05) u.facing = Math.atan2(ex - u.x, ez - u.z);
    u.anim = opts.anim || 'rush'; u.animT = this.time;
    u.dirty = true;
    if (opts.fx) this.fx(opts.fx, u.x, u.z, total, 0xffffff, ex, ez);
  }
  blink(u, tx, tz) {
    const [x, z] = this.nav.nearestFree(tx, tz, 8);
    u.x = x; u.z = z;
    u.dash = null; u.disp = null;
  }
  proj(src, spec) {
    const p = { id: this.nextId++, src, team: src.team, x: spec.x ?? src.x, z: spec.z ?? src.z, y: spec.y ?? 1.2, dx: spec.dx, dz: spec.dz, speed: spec.speed, range: spec.range, traveled: 0, width: spec.width || 0.8, pierce: !!spec.pierce, hit: new Set(), onHit: spec.onHit, onEnd: spec.onEnd, onMove: spec.onMove, kind: spec.kind || 'arrow', heroes: !!spec.heroes };
    this.projs.push(p);
    return p;
  }
  homing(src, target, spec) {
    const p = { id: this.nextId++, src, team: src.team, x: spec.x ?? src.x, z: spec.z ?? src.z, y: spec.y ?? 1.3, homing: target, speed: spec.speed || 20, onHit: spec.onHit, kind: spec.kind || 'arrow', dx: 0, dz: 1 };
    this.projs.push(p);
    return p;
  }
  zone(src, spec) {
    const z = { id: this.nextId++, src, team: src.team, x: spec.x, z: spec.z, r: spec.r, t: spec.dur, dur: spec.dur, interval: spec.interval || 0.5, next: this.time + 0.05, kind: spec.kind, onTick: spec.onTick, onEnd: spec.onEnd };
    this.zones.push(z);
    return z;
  }

  // ------------------------------------------------------------ damage
  dmg(src, t, amount, type, opts = {}) {
    if (!t || !t.alive || amount <= 0) return 0;
    if (t.untarget && !opts.force) return 0;
    if (t.kind === 'tower' || t.kind === 'core') {
      if (t.invuln) return 0;
      if (src && (src.kind === 'hero' || src.kind === 'monster')) {
        // backdoor protection: heroes deal reduced damage when no enemy minions are nearby
        let minionNear = false;
        this.query(t.x, t.z, 10, (u) => { if (u.kind === 'minion' && u.team !== t.team && u.alive) minionNear = true; });
        if (!minionNear) amount *= 0.4;
      }
      if (src && src.kind === 'minion' && src.towerMult) amount *= src.towerMult;
    }
    let a = amount;
    const ss = src && src.st ? src.st : null;
    if (ss) {
      a *= 1 + (ss.dmgAmp || 0);
      if (src.passives) {
        if (src.passives.has('execute') && t.hp < t.st.maxHp * 0.4) a *= 1.2;
        if (src.passives.has('jungle') && t.kind === 'monster') a *= 1.25;
      }
      if (src.kind === 'hero' && t.kind === 'monster' && src.spell === 'frostbite') a *= 1.15;
    }
    if (type === 'p' || type === 'm') {
      let def = type === 'p' ? t.st.armor : t.st.mr;
      if (ss) def = type === 'p' ? def * (1 - (ss.apenP || 0)) - (ss.apen || 0) : def * (1 - (ss.mpenP || 0)) - (ss.mpen || 0);
      a *= def >= 0 ? 120 / (120 + def) : 2 - 120 / (120 - def);
    }
    a *= 1 - (t.st.dmgRed || 0);
    if (t.kind === 'hero' && src && src.kind === 'minion' && src.minionType !== 'titan') a *= 0.85;
    // shields
    let rem = a;
    if (t.shields.length) {
      t.shields.sort((p, q) => p.t - q.t);
      for (const s of t.shields) { const used = Math.min(s.amt, rem); s.amt -= used; rem -= used; if (rem <= 0) break; }
      t.shields = t.shields.filter((s) => s.amt > 0.5);
    }
    t.hp -= rem;
    t.lastHurtT = this.time;
    if (src) t.lastHurtBy = src;
    const hero = src && src.kind === 'hero' ? src : null;
    if (hero) {
      if (t.kind === 'hero') { t.hurtBy.set(hero.id, this.time); hero.dmgDealt += a; }
      if (opts.basic && ss.ls) this.heal(null, hero, a * ss.ls);
      if (opts.skill && ss.sv) this.heal(null, hero, a * ss.sv * (opts.aoe ? 0.5 : 1));
      if (opts.skill && !opts.passive) {
        if (hero.def.onSkillHit) hero.def.onSkillHit(this, hero, t, opts);
        if (hero.passives.has('skillslow') && t.alive) this.cc(t, 'slow', 1, hero, 0.2);
        if (hero.passives.has('pyre') && t.kind === 'hero' && (t.pv['pyre' + hero.id] || 0) < this.time) {
          t.pv['pyre' + hero.id] = this.time + 3;
          this.buff(t, { id: 'pyre' + hero.id, dur: 3, src: hero, dot: { dmg: t.st.maxHp * 0.005, type: 'm', interval: 0.5 }, fx: 'burning' });
        }
      }
      if (t.kind === 'hero' && hero.isPlayerFocus !== undefined) hero.lastHitHeroT = this.time;
    }
    if (t.kind === 'hero') {
      t.dmgTaken += a;
      if (t.recallT > 0) t.recallT = 0;
      t.regenT = 0;
      if (t.passives && t.passives.has('aurora') && t.auroraCd <= this.time && t.hp > 0 && t.hp < t.st.maxHp * 0.3) {
        t.auroraCd = this.time + 60; this.shield(t, t.st.maxHp * 0.25, 3, t, 'aurora'); this.fx('auroraShield', t.x, t.z, 1.6, 0xa6ffdf);
      }
      // tower/minion call for help: enemy hero hurting a hero
      if (hero && hero.team !== t.team) this.callForHelp(t, hero);
    }
    if (t.kind === 'monster' && src && t.alive) this.monsterAggro(t, src);
    if (a >= 1 && (t.kind === 'hero' || hero)) this.ev('dmg', t.id, Math.round(a), type === 'p' ? 0 : type === 'm' ? 1 : 2, opts.crit ? 1 : 0, src ? src.id : 0);
    if (t.hp <= 0) this.kill(t, src);
    return a;
  }
  callForHelp(victim, attacker) {
    this.query(victim.x, victim.z, 9, (u) => {
      if (!u.alive || u.team !== victim.team) return;
      if (u.kind === 'tower' || u.kind === 'core') { if (this.inRange(u, attacker, u.st.range)) { u.aggroHero = attacker; u.aggroT = this.time + 2.5; } }
      else if (u.kind === 'minion') { u.helpTarget = attacker; u.helpT = this.time + 2.5; }
    });
  }

  // ------------------------------------------------------------ deaths & rewards
  creditHero(src) {
    if (!src) return null;
    if (src.kind === 'hero') return src;
    if (src.owner && src.owner.kind === 'hero') return src.owner;
    return null;
  }
  kill(u, src) {
    if (!u.alive) return;
    u.alive = false; u.hp = 0; u.deathT = this.time;
    u.dash = null; u.disp = null; u.windup = 0; u.target = null;
    u.anim = 'dead'; u.animT = this.time;
    u.buffs = []; u.shields = [];
    const killer = this.creditHero(src);
    switch (u.kind) {
      case 'hero': this.onHeroDeath(u, src, killer); break;
      case 'minion': this.onMinionDeath(u, src, killer); break;
      case 'monster': this.onMonsterDeath(u, src, killer); break;
      case 'tower': this.onTowerDeath(u, src, killer); break;
      case 'core': this.onCoreDeath(u, src); break;
    }
    if (killer && killer.def.onKill) killer.def.onKill(this, killer, u);
  }
  giveGold(h, amt, x, z, show = true) {
    if (amt <= 0) return;
    h.gold += amt; h.goldEarned += amt;
    if (show) this.ev('gold', h.id, Math.round(amt), +(x ?? h.x).toFixed(1), +(z ?? h.z).toFixed(1));
  }
  giveXp(h, amt) {
    if (!h.alive && amt <= 0) return;
    if (h.level >= MAX_LEVEL) return;
    let mult = 1;
    if (h.petId === 'bunny') mult += 0.06;
    if (h.petId === 'phoenix') mult += 0.03;
    h.xp += amt * mult;
    while (h.level < MAX_LEVEL && h.xp >= XP_TO_NEXT[h.level]) {
      h.xp -= XP_TO_NEXT[h.level];
      h.level++;
      h.skillPoints++;
      const oldHp = h.st.maxHp, oldMp = h.st.maxMana;
      this.recalcHero(h);
      if (h.alive) { h.hp += 0; }
      this.ev('lvl', h.id, h.level);
      if (h.brain || h.autoLevel) this.autoSkill(h);
      void oldHp; void oldMp;
    }
    if (h.level >= MAX_LEVEL) h.xp = 0;
  }
  onHeroDeath(v, src, killer) {
    v.d++;
    v.deathStreak++;
    const respawn = 5 + v.level * 2.4 + Math.max(0, (this.time - 900) / 60);
    v.respawnAt = this.time + respawn;
    v.recallT = 0; v.regenT = 0;
    const assists = [];
    for (const [hid, t] of v.hurtBy) {
      if (this.time - t > 10) continue;
      const h = this.heroes.find((x) => x.id === hid);
      if (h && h !== killer && h.team !== v.team) assists.push(h);
    }
    v.hurtBy.clear();
    // transfer jungle buffs to the killer
    if (killer) for (const id of ['ember', 'azure']) {
      const b = v.buffs.find((x) => x.id === id); if (b) this.buff(killer, { ...b, dur: b.t });
    }
    const team = killer ? killer.team : 1 - v.team;
    this.teamKills[team]++;
    let gold = 240 + Math.min(300, 60 * Math.max(0, v.streak - 2));
    if (v.deathStreak >= 3) gold *= 0.6;
    if (!this.firstBlood && killer) { this.firstBlood = true; gold += 100; this.ann('firstblood', team, killer.id, v.id); }
    const xp = 60 + 38 * v.level;
    if (v.streak >= 3 && killer) this.ann('shutdown', team, killer.id, v.id);
    v.streak = 0;
    if (killer) {
      killer.k++; killer.streak++; killer.deathStreak = 0;
      this.giveGold(killer, gold, v.x, v.z);
      this.giveXp(killer, xp * (assists.length ? 0.6 : 1));
      if (this.time - killer.multi.t <= 10) killer.multi.n++; else killer.multi.n = 1;
      killer.multi.t = this.time;
      const mk = ['', '', 'double', 'triple', 'ultra', 'avalanche'][Math.min(5, killer.multi.n)];
      if (mk) this.ann(mk, team, killer.id, v.id);
      else if (killer.streak >= 3) this.ann(['', '', '', 'spree', 'dominating', 'unstoppable'][Math.min(5, killer.streak)] || 'legendary', team, killer.id, v.id);
      if (killer.passives.has('rampage')) this.buff(killer, { id: 'rampage', dur: 3, mods: { msP: 0.3 } });
    }
    for (const h of assists) {
      h.a++;
      this.giveGold(h, Math.max(40, (gold * 0.5) / assists.length), v.x, v.z);
      this.giveXp(h, (xp * 0.4) / assists.length + 20);
      if (h.passives.has('rampage')) this.buff(h, { id: 'rampage', dur: 3, mods: { msP: 0.3 } });
    }
    this.ev('kill', killer ? killer.id : (src ? src.id : 0), v.id, assists.map((h) => h.id), src ? KIND_CODE[src.kind] ?? 0 : 0);
    this.sfx('heroDeath', v.x, v.z);
  }
  onMinionDeath(m, src, killer) {
    const t = MINION_TYPES[m.minionType];
    const near = this.heroes.filter((h) => h.alive && h.team !== m.team && Math.hypot(h.x - m.x, h.z - m.z) < SHARE_R);
    const xpEach = near.length ? (t.xp * (near.length > 1 ? 1.25 : 1)) / near.length : 0;
    for (const h of near) this.giveXp(h, xpEach);
    let gold = t.gold;
    if (killer && killer.team !== m.team) {
      killer.cs++;
      const g = gold * (killer.petId === 'penguin' ? 1.06 : 1);
      this.giveGold(killer, g, m.x, m.z);
      this.roamShare(killer, g);
      for (const h of near) if (h !== killer) this.giveGold(h, gold * 0.25, m.x, m.z, false);
    } else {
      for (const h of near) { this.giveGold(h, (gold * 0.5) / near.length, m.x, m.z, false); this.roamShare(h, (gold * 0.5) / near.length); }
    }
  }
  roamShare(h, g) {
    for (const o of this.heroes) if (o !== h && o.alive && o.team === h.team && o.passives.has('roam') && Math.hypot(o.x - h.x, o.z - h.z) < 12) this.giveGold(o, g * 0.35, o.x, o.z, false);
  }
  onMonsterDeath(m, src, killer) {
    const t = MONSTERS[m.mtype];
    if (m.boss) {
      const team = killer ? killer.team : src ? src.team : -1;
      if (team === 0 || team === 1) {
        for (const h of this.heroes) if (h.team === team) { this.giveGold(h, t.gold, h.x, h.z); this.giveXp(h, t.xp); }
        if (killer) this.giveGold(killer, 100, m.x, m.z);
        if (m.mtype === 'tortoise') {
          for (const h of this.heroes) if (h.team === team && h.alive) { this.shield(h, 300 + h.st.maxHp * 0.1, 40, null, 'tortoise'); }
          this.ann('tortoise', team, killer ? killer.id : 0);
        } else {
          this.ann('titan', team, killer ? killer.id : 0);
          this.after(1.5, () => this.spawnTitanAvatar(team));
        }
      }
      this.bosses[m.mtype].unit = null;
      this.bosses[m.mtype].respawnAt = this.time + (m.mtype === 'tortoise' ? TIMINGS.tortoiseRespawn : TIMINGS.titanRespawn);
      this.bosses[m.mtype].announced = false;
      return;
    }
    if (killer && killer.team !== 2) {
      let gold = t.gold, xp = t.xp;
      if (killer.passives.has('jungle')) { gold *= 1.2; xp *= 1.2; }
      if (killer.petId === 'penguin') gold *= 1.06;
      this.giveGold(killer, gold, m.x, m.z);
      this.giveXp(killer, xp);
      if (t.buff) {
        this.buff(killer, { id: t.buff, dur: 70, mods: t.buff === 'azure' ? { cdrF: 0.12, mpRegF: 12 } : {}, fx: t.buff });
        this.ann(t.buff === 'azure' ? 'azureBuff' : 'emberBuff', killer.team, killer.id);
      }
    }
  }
  onTowerDeath(tw, src, killer) {
    this.nav.setStructure(tw.x, tw.z, tw.radius, false);
    const team = 1 - tw.team;
    for (const h of this.heroes) if (h.team === team) this.giveGold(h, 120, h.x, h.z, h === killer);
    if (killer) this.giveGold(killer, 100, tw.x, tw.z);
    this.ann('tower', team, tw.id, killer ? killer.id : 0);
    this.fx('towerCollapse', tw.x, tw.z, 3, tw.team ? 0xff6a6a : 0x6ab8ff);
    this.sfx('towerDown', tw.x, tw.z);
    this.shake(0.5);
    this.updateTowerVulnerability();
  }
  onCoreDeath(c, src) {
    this.over = true;
    this.winner = 1 - c.team;
    this.fx('coreExplode', c.x, c.z, 6, c.team ? 0xff6a6a : 0x6ab8ff);
    this.sfx('coreDown', c.x, c.z);
    this.ann('victory', this.winner);
    this.shake(1);
  }
  updateTowerVulnerability() {
    for (const t of this.towers) {
      if (!t.alive) continue;
      const prev = this.towers.find((o) => o.team === t.team && o.lane === t.lane && o.tier === t.tier - 1);
      t.invuln = !!(prev && prev.alive);
    }
    for (const c of this.cores) {
      const baseDown = this.towers.some((t) => t.team === c.team && t.tier === 2 && !t.alive);
      c.invuln = !baseDown;
    }
  }

  // ------------------------------------------------------------ spawning
  spawnWave() {
    this.waveN++;
    const minutes = this.time / 60;
    const comp = ['melee', 'melee', 'melee', 'ranged', 'ranged'];
    if (minutes > 12) comp.splice(0, 0, 'melee');
    if (this.waveN % TIMINGS.superWaveEvery === 0) comp.push('siege');
    for (const team of [0, 1]) {
      // stronger waves when the enemy lost its base tower in that lane
      for (const lane of ['top', 'mid', 'bot']) {
        const path = lanePath(team, lane);
        comp.forEach((type, i) => {
          this.after(i * 0.55, () => this.spawnMinion(team, lane, type, path));
        });
      }
    }
  }
  spawnMinion(team, lane, type, path, startIdx = 0) {
    const T = MINION_TYPES[type];
    const p = path[startIdx];
    const m = new Unit(this, 'minion', team, p[0] + (this.rng() - 0.5), p[1] + (this.rng() - 0.5));
    const minutes = this.time / 60;
    m.minionType = type; m.typeIdx = MINION_TYPE_LIST.indexOf(type);
    m.lane = lane; m.lanePath = path; m.wpi = startIdx + 1;
    m.radius = T.radius; m.towerMult = T.towerMult || 0; m.aoe = T.aoe || 0;
    m.proj = T.proj;
    m.baseSt = { ...blankStats(), maxHp: T.hp + T.hpT * minutes, atk: T.atk + T.atkT * minutes, armor: T.armor, mr: T.mr, range: T.range, as: T.as, ms: T.ms, sight: 7 };
    m.st = { ...m.baseSt }; m.hp = m.st.maxHp; m.sight = 7;
    m.thinkT = this.rng() * 0.25;
    this.minions.push(m);
    return this.addUnit(m);
  }
  spawnTitanAvatar(team) {
    // join the lane whose enemy towers are most intact on the titan side (top or mid)
    const alive = (lane) => this.towers.filter((t) => t.team !== team && t.lane === lane && t.alive).length;
    const lane = alive('top') >= alive('mid') ? 'top' : 'mid';
    const path = lanePath(team, lane);
    // find the waypoint closest to the pit, start from there
    const pit = PITS.titan.p;
    let best = 0, bd = Infinity;
    path.forEach((p, i) => { const d = Math.hypot(p[0] - pit[0], p[1] - pit[1]); if (d < bd) { bd = d; best = i; } });
    const full = [[pit[0], pit[1]], ...path.slice(best)];
    const m = this.spawnMinion(team, lane, 'titan', full, 0);
    m.st.maxHp = m.baseSt.maxHp; m.hp = m.st.maxHp;
    this.ann('avatar', team);
  }
  spawnCamp(c) {
    c.units = [];
    for (const [type, ox, oz] of CAMP_SPAWNS[c.kind]) c.units.push(this.spawnMonster(type, c.p[0] + ox, c.p[1] + oz, c));
    c.up = true;
  }
  spawnMonster(type, x, z, camp) {
    const T = MONSTERS[type];
    const m = new Unit(this, 'monster', 2, x, z);
    const minutes = this.time / 60;
    m.mtype = type; m.typeIdx = MONSTER_LIST.indexOf(type); m.camp = camp; m.boss = !!T.boss;
    m.home = [x, z]; m.radius = T.radius; m.aoe = T.aoe || 0; m.proj = T.proj || null;
    const growth = T.hpT ? T.hpT * Math.max(0, minutes - 2) : T.hp * 0.05 * minutes;
    m.baseSt = { ...blankStats(), maxHp: T.hp + growth, atk: T.atk * (1 + 0.05 * minutes), armor: T.armor, mr: T.mr, range: T.range, as: T.as, ms: T.ms, sight: 0 };
    m.st = { ...m.baseSt }; m.hp = m.st.maxHp;
    m.facing = Math.atan2(-x, -z);
    m.homeFacing = m.facing;
    this.monsters.push(m);
    return this.addUnit(m);
  }
  updateSchedules() {
    if (this.time >= this.nextWave) { this.spawnWave(); this.nextWave += TIMINGS.waveInterval; }
    for (const c of this.camps) {
      if (c.up) {
        if (c.units.every((u) => !u.alive)) { c.up = false; c.respawnAt = this.time + CAMP_RESPAWN[c.kind]; }
      } else if (this.time >= c.respawnAt) this.spawnCamp(c);
    }
    for (const key of ['tortoise', 'titan']) {
      const b = this.bosses[key];
      if (b.unit) continue;
      if (key === 'tortoise' && this.time > TIMINGS.tortoiseEnd) continue;
      if (this.time >= b.respawnAt) {
        const p = PITS[key].p;
        b.unit = this.spawnMonster(key, p[0], p[1], null);
        b.unit.facing = key === 'titan' ? Math.PI * 0.25 : -Math.PI * 0.75;
        b.unit.homeFacing = b.unit.facing;
        this.ann(key + 'Spawn', -1);
      }
    }
  }

  // ------------------------------------------------------------ hero actions
  skillCost(h, slot) { const s = h.def.skills[slot]; const r = h.skills[slot].rank; return Array.isArray(s.mana) ? s.mana[Math.max(0, r - 1)] : s.mana; }
  canLevelSkill(h, slot) {
    if (h.skillPoints <= 0) return false;
    const s = h.def.skills[slot], r = h.skills[slot].rank;
    if (s.ult) return r < 3 && h.level >= 4 + r * 4;
    return r < 6 && h.level >= r * 2 + 1;
  }
  levelSkill(h, slot) {
    if (!this.canLevelSkill(h, slot)) return false;
    h.skills[slot].rank++; h.skillPoints--;
    return true;
  }
  autoSkill(h) {
    let guard = 0;
    while (h.skillPoints > 0 && guard++ < 10) {
      if (this.canLevelSkill(h, 2)) { this.levelSkill(h, 2); continue; }
      const order = h.def.skillOrder || [0, 1];
      // keep both basic skills learned first, then max preferred
      const a = order[0], b = order[1];
      if (h.skills[a].rank === 0 && this.canLevelSkill(h, a)) { this.levelSkill(h, a); continue; }
      if (h.skills[b].rank === 0 && this.canLevelSkill(h, b)) { this.levelSkill(h, b); continue; }
      if (this.canLevelSkill(h, a)) { this.levelSkill(h, a); continue; }
      if (this.canLevelSkill(h, b)) { this.levelSkill(h, b); continue; }
      break;
    }
  }
  autoAim(h, skill) {
    const r = (skill.range || skill.radius || 6) + 0.5;
    const enemies = this.enemies(h, h.x, h.z, r, { visible: true });
    const heroes = enemies.filter((u) => u.kind === 'hero');
    const pool = heroes.length ? heroes : skill.heroOnly ? [] : enemies;
    if (!pool.length) return null;
    pool.sort((a, b) => (a.hp / a.st.maxHp) - (b.hp / b.st.maxHp) || this.dist(h, a) - this.dist(h, b));
    return pool[0];
  }
  castSkill(h, slot, aim) {
    const s = h.def.skills[slot];
    const st = h.skills[slot];
    if (!s || !h.alive || st.rank <= 0 || st.cd > 0 || !h.canCast()) return false;
    const cost = this.skillCost(h, slot);
    if (h.mana < cost) return false;
    const a = {};
    let target = null;
    if (aim && aim.targetId) target = this.units.find((u) => u.id === aim.targetId);
    if (s.aim === 'unit') {
      if (!target || !target.alive || target.team === h.team || !this.visibleTo(target, h.team) || target.untarget || (s.heroOnly && target.kind !== 'hero') || target.kind === 'tower' || target.kind === 'core' || Math.hypot(target.x - h.x, target.z - h.z) > s.range + target.radius + 1) target = this.autoAim(h, s);
      if (!target) return false;
      a.target = target;
    } else if (s.aim === 'dir') {
      let dx = aim && aim.dx, dz = aim && aim.dz;
      if (dx === undefined || (Math.abs(dx) < 1e-4 && Math.abs(dz) < 1e-4)) {
        const t = target || this.autoAim(h, s);
        if (t) { dx = t.x - h.x; dz = t.z - h.z; } else { dx = Math.sin(h.facing); dz = Math.cos(h.facing); }
      }
      const l = Math.hypot(dx, dz) || 1;
      a.dx = dx / l; a.dz = dz / l;
    } else if (s.aim === 'point') {
      let x = aim && aim.x, z = aim && aim.z;
      if (x === undefined) {
        const t = target || this.autoAim(h, s);
        if (t) { x = t.x; z = t.z; } else { x = h.x + Math.sin(h.facing) * s.range * 0.6; z = h.z + Math.cos(h.facing) * s.range * 0.6; }
      }
      const dx = x - h.x, dz = z - h.z, l = Math.hypot(dx, dz);
      if (l > s.range) { x = h.x + (dx / l) * s.range; z = h.z + (dz / l) * s.range; }
      a.x = x; a.z = z;
    }
    this.cancelRecall(h); h.regenT = 0;
    h.windup = 0; h.windTarget = null;
    if (s.icon !== 'veil') this.breakStealth(h);
    const ok = s.cast(this, h, a, st.rank);
    if (ok === false) return false;
    st.cd = s.cd[Math.min(s.cd.length - 1, st.rank - 1)] * (1 - h.st.cdr);
    st.cdMax = st.cd;
    h.mana -= cost;
    if (a.dx !== undefined) h.facing = Math.atan2(a.dx, a.dz);
    else if (a.x !== undefined && (Math.abs(a.x - h.x) + Math.abs(a.z - h.z)) > 0.1 && !h.dash) h.facing = Math.atan2(a.x - h.x, a.z - h.z);
    else if (a.target && !h.dash) h.facing = Math.atan2(a.target.x - h.x, a.target.z - h.z);
    if (!h.dash && !['spin', 'thrust', 'stab', 'rend', 'shoot', 'aim', 'strum'].includes(h.anim) || this.time - h.animT > 0.05) {
      if (!h.dash) { h.anim = 'cast' + slot; h.animT = this.time; }
    }
    if (!h.dash) h.castLock = 0.18;
    if (h.def.onCast) h.def.onCast(this, h, slot);
    this.ev('cast', h.id, slot);
    return true;
  }
  useSpell(h, aim) {
    if (!h.alive || h.spellCd > 0) return false;
    const sp = h.spell;
    if (sp !== 'purify' && h.isHardCC()) return false;
    let ok = true;
    switch (sp) {
      case 'blink': {
        let dx = aim && aim.dx, dz = aim && aim.dz;
        if (dx === undefined || (Math.abs(dx) + Math.abs(dz)) < 1e-4) { dx = Math.sin(h.facing); dz = Math.cos(h.facing); }
        const l = Math.hypot(dx, dz) || 1;
        this.fx('blinkFx', h.x, h.z, 1.2, 0x9fe8ff);
        this.blink(h, h.x + (dx / l) * 4.5, h.z + (dz / l) * 4.5);
        h.facing = Math.atan2(dx, dz);
        this.fx('blinkFx', h.x, h.z, 1.2, 0x9fe8ff); this.sfx('blink', h.x, h.z);
        break;
      }
      case 'mend': {
        this.heal(h, h, h.st.maxHp * 0.15);
        const al = this.allies(h, h.x, h.z, 8, { heroes: true, self: false }).sort((a, b) => a.hpPct - b.hpPct)[0];
        if (al) { this.heal(h, al, al.st.maxHp * 0.1); this.fx('healFx', al.x, al.z, 1.4, 0xa6ffbf); }
        this.fx('healFx', h.x, h.z, 1.6, 0xa6ffbf); this.sfx('heal', h.x, h.z);
        break;
      }
      case 'frostbite': {
        let best = null, bd = 6.0;
        this.query(h.x, h.z, 6, (u) => {
          if (!u.alive || u.team === h.team || (u.kind !== 'monster' && u.kind !== 'minion')) return;
          const d = Math.hypot(u.x - h.x, u.z - h.z) - u.radius;
          const score = d - (u.kind === 'monster' ? (u.boss ? 4 : 2) : 0);
          if (score < bd) { bd = score; best = u; }
        });
        if (!best) return false;
        const dmg = (520 + 80 * h.level) * (best.kind === 'minion' ? 0.8 : 1);
        this.fx('frostbite', best.x, best.z, 1.5, 0x7fd8ff); this.sfx('freeze', best.x, best.z);
        this.dmg(h, best, dmg, 't', { spell: 1 });
        this.heal(h, h, h.st.maxHp * 0.05);
        break;
      }
      case 'sprint': this.buff(h, { id: 'sprint', dur: 6, decay: true, mods: { msP: 0.6 }, fx: 'sprint' }); this.sfx('wind', h.x, h.z); break;
      case 'purify': this.cleanse(h); h.disp = null; h.cc.air = 0; h.ccImmuneT = this.time + 1.2; this.buff(h, { id: 'purify', dur: 1.5, mods: { msP: 0.15 } }); this.fx('purifyFx', h.x, h.z, 1.5, 0xffffff); this.sfx('purify', h.x, h.z); break;
      case 'execute': {
        const t = this.enemies(h, h.x, h.z, 5.5, { heroes: true, visible: true }).sort((a, b) => a.hp - b.hp)[0];
        if (!t) return false;
        this.fx('executeFx', t.x, t.z, 1.6, 0xff6a6a); this.sfx('execute', t.x, t.z);
        this.dmg(h, t, 100 + 10 * h.level + 0.13 * (t.st.maxHp - t.hp), 't', { spell: 1 });
        break;
      }
      case 'aegis': this.shield(h, 500 + 60 * h.level, 3, h, 'aegis'); this.fx('aegisFx', h.x, h.z, 1.6, 0xffd88a); this.sfx('shield', h.x, h.z); break;
      default: ok = false;
    }
    if (!ok) return false;
    h.spellCd = SPELL_BY_ID[sp].cd;
    this.cancelRecall(h);
    this.ev('spell', h.id, sp);
    return true;
  }
  itemCost(h, id) {
    const it = ITEM_BY_ID[id];
    if (!it) return Infinity;
    let cost = it.cost;
    if (it.from) {
      const inv = [...h.items];
      for (const c of it.from) { const i = inv.indexOf(c); if (i >= 0) { cost -= ITEM_BY_ID[c].cost; inv.splice(i, 1); } }
    }
    return cost;
  }
  canBuy(h, id) {
    const it = ITEM_BY_ID[id];
    if (!it || !this.itemAvail.has(id)) return false;
    if (h.gold < this.itemCost(h, id)) return false;
    let slots = h.items.length;
    if (it.from) { const inv = [...h.items]; for (const c of it.from) { const i = inv.indexOf(c); if (i >= 0) { inv.splice(i, 1); slots--; } } }
    if (slots >= 6) return false;
    if (it.cat === 'move') {
      const hasBoots = h.items.some((x) => ITEM_BY_ID[x].cat === 'move');
      if (hasBoots && !(it.from && it.from.includes('boots') && h.items.includes('boots'))) return false;
    }
    if (it.cat === 'jg' && h.items.some((x) => ITEM_BY_ID[x].cat === 'jg')) return false;
    return true;
  }
  buy(h, id) {
    if (!this.canBuy(h, id)) return false;
    const it = ITEM_BY_ID[id];
    h.gold -= this.itemCost(h, id);
    if (it.from) for (const c of it.from) { const i = h.items.indexOf(c); if (i >= 0) h.items.splice(i, 1); }
    h.items.push(id);
    this.recalcHero(h);
    this.ev('buy', h.id, id);
    return true;
  }
  sell(h, slot) {
    const id = h.items[slot];
    if (!id) return false;
    h.items.splice(slot, 1);
    h.gold += Math.floor(ITEM_BY_ID[id].cost * 0.6);
    this.recalcHero(h);
    return true;
  }
  startRecall(h) {
    if (!h.alive || h.recallT > 0 || h.isHardCC()) return false;
    h.recallT = TIMINGS.recall;
    h.windup = 0; h.target = null;
    h.anim = 'recall'; h.animT = this.time;
    this.sfx('recallStart', h.x, h.z);
    return true;
  }
  startRegen(h) {
    if (!h.alive || h.regenCd > 0 || h.isHardCC()) return false;
    h.regenT = TIMINGS.regen; h.regenCd = TIMINGS.regenCd;
    this.sfx('heal', h.x, h.z);
    return true;
  }
  // apply a command from a player/network
  command(h, c) {
    if (!h) return;
    switch (c.c) {
      case 'cast': this.castSkill(h, c.slot, c.aim); break;
      case 'spell': this.useSpell(h, c.aim); break;
      case 'buy': this.buy(h, c.item); break;
      case 'sell': this.sell(h, c.slot); break;
      case 'lvl': this.levelSkill(h, c.slot); break;
      case 'recall': this.startRecall(h); break;
      case 'regen': this.startRegen(h); break;
      case 'autolvl': h.autoLevel = !!c.on; if (h.autoLevel) this.autoSkill(h); break;
    }
  }
  setInput(h, inp) { if (h && !h.brain) Object.assign(h.input, inp); }
  makeBot(h) { if (h && !h.brain) { h.isBot = true; h.brain = new BotBrain(this, h, h.role, this.difficulty); this.autoSkill(h); } }

  // ------------------------------------------------------------ targeting
  pickAttackTarget(h, mode) {
    const range = h.st.range;
    const cur = h.target;
    if (cur && cur.alive && !cur.untarget && this.visibleTo(cur, h.team) && cur.team !== h.team && this.inRange(h, cur, range + 0.8)) {
      if (mode === 'auto' && cur.kind !== 'hero') {
        // switch to a hero if one is in range
      } else return cur;
    }
    const acq = range + 3.2;
    let bestH = null, bestHs = Infinity, bestM = null, bestMs = Infinity, bestS = null, bestSs = Infinity;
    this.query(h.x, h.z, acq + 1, (u) => {
      if (!u.alive || u.untarget || u.team === h.team || !this.visibleTo(u, h.team)) return;
      const d = Math.hypot(u.x - h.x, u.z - h.z) - u.radius;
      if (d > acq) return;
      if (u.kind === 'hero') { const s = u.hpPct * 4 + d * 0.15; if (s < bestHs) { bestHs = s; bestH = u; } }
      else if (u.kind === 'tower' || u.kind === 'core') { if (u.invuln) return; if (d < bestSs) { bestSs = d; bestS = u; } }
      else { const s = mode === 'minion' ? u.hp * 0.01 + d : d; if (s < bestMs) { bestMs = s; bestM = u; } }
    });
    if (mode === 'tower') return bestS || bestM || bestH;
    if (mode === 'minion') return bestM || bestH || bestS;
    if (bestH && cur && cur.kind !== 'hero' && cur.alive && this.inRange(h, cur, range + 0.5) && !this.inRange(h, bestH, range + 0.3)) return cur;
    return bestH || bestM || bestS;
  }

  // ------------------------------------------------------------ main tick
  step() {
    if (this.over) { this.time += DT; this.tickN++; return; }
    const dt = DT;
    this.time += dt; this.tickN++;
    this.updateSchedules();
    this.rebuildHash();
    // timers
    if (this.timers.length) {
      const due = this.timers.filter((t) => t.at <= this.time);
      if (due.length) { this.timers = this.timers.filter((t) => t.at > this.time); for (const t of due) t.fn(); }
    }
    // team + bot brains
    if (this.tickN % 15 === 0) { this.teamBrains[0].think(); this.teamBrains[1].think(); }
    // alternate processing order every tick so neither team gets a systematic first-move advantage
    const fwd = (this.tickN & 1) === 0;
    const heroes = fwd ? this.heroes : this.heroes.slice().reverse();
    for (const h of heroes) this.updateHeroControl(h, dt);
    for (const m of this.minions) if (m.alive) this.updateMinion(m, dt);
    for (const t of this.towers) if (t.alive) this.updateTower(t, dt);
    for (const c of this.cores) if (c.alive) this.updateTower(c, dt);
    for (const m of this.monsters) if (m.alive) this.updateMonster(m, dt);
    const order = fwd ? this.units : this.units.slice().reverse();
    for (const u of order) if (u.alive) this.updateUnit(u, dt);
    this.separate();
    // attacks resolve after everyone has moved (same positions for both sides)
    for (const u of order) if (u.alive) this.updateAttack(u, dt, (u.vx || u.vz) !== 0);
    this.updateProjectiles(dt);
    this.updateZones(dt);
    this.updateFountains(dt);
    if (this.tickN % 6 === 0) this.computeVision();
    if (this.tickN % 30 === 0) this.passiveIncome();
    if (this.tickN % 45 === 0) this.cleanup();
  }
  passiveIncome() {
    if (this.time < 15) return;
    for (const h of this.heroes) {
      h.gold += 3.2; h.goldEarned += 3.2;
      if (h.alive) this.giveXp(h, 1.2);
    }
  }
  cleanup() {
    const t = this.time;
    const keep = (u) => u.alive || u.kind === 'hero' || u.kind === 'tower' || u.kind === 'core' || t - u.deathT < 2.5;
    if (this.units.some((u) => !keep(u))) {
      this.units = this.units.filter(keep);
      this.minions = this.minions.filter(keep);
      this.monsters = this.monsters.filter(keep);
    }
  }
  updateHeroControl(h, dt) {
    if (!h.alive) {
      if (this.time >= h.respawnAt) this.respawn(h);
      return;
    }
    if (h.brain) h.brain.tick(dt);
    const inp = h.input;
    h.mvx = 0; h.mvz = 0;
    if (h.recallT > 0) {
      h.recallT -= dt;
      if (Math.hypot(inp.mx, inp.mz) > 0.12 || inp.atk) { h.recallT = 0; }
      else if (h.recallT <= 0) {
        const f = BASES[h.team].fountain;
        h.recallT = 0;
        this.fx('recallBurst', h.x, h.z, 1.5, h.team ? 0xff8a8a : 0x8ad8ff);
        h.x = f[0] + (this.rng() - 0.5) * 2; h.z = f[1] + (this.rng() - 0.5) * 2;
        this.fx('recallBurst', h.x, h.z, 1.5, h.team ? 0xff8a8a : 0x8ad8ff);
        this.ev('recall', h.id); this.sfx('recallEnd', h.x, h.z);
        return;
      } else return;
    }
    const mag = Math.hypot(inp.mx, inp.mz);
    if (mag > 0.12 && !inp.forceTarget) {
      h.target = null;
      if (h.windup > 0 && h.windup < h.windTotal * 0.5) { /* let swing land */ } else { h.windup = 0; h.windTarget = null; }
      const k = Math.min(1, mag) / mag;
      h.mvx = inp.mx * k; h.mvz = inp.mz * k;
      if (h.canMove()) h.facing = Math.atan2(h.mvx, h.mvz);
      return;
    }
    if (inp.atk || inp.forceTarget) {
      const t = inp.forceTarget && inp.forceTarget.alive && this.visibleTo(inp.forceTarget, h.team) && !inp.forceTarget.untarget ? inp.forceTarget : this.pickAttackTarget(h, inp.mode || 'auto');
      h.target = t;
      if (t && !this.inRange(h, t, h.st.range)) this.steer(h, t.x, t.z, dt);
      else if (mag > 0.12) { const k = Math.min(1, mag) / mag; h.mvx = inp.mx * k; h.mvz = inp.mz * k; }
    } else if (h.windup <= 0) {
      h.target = null;
    }
  }
  // move toward a point, using A* when a wall is in the way
  steer(u, x, z, dt, speedK = 1) {
    let tx = x, tz = z;
    if (!this.nav.lineClear(u.x, u.z, x, z, false, this.nav.blocked(x, z) ? 3.2 : 0)) {
      if (!u.path || !u.pathGoal || Math.hypot(u.pathGoal[0] - x, u.pathGoal[1] - z) > 2 || this.time > u.pathT) {
        u.path = this.nav.findPath(u.x, u.z, x, z) || [[x, z]];
        u.pathGoal = [x, z]; u.pathT = this.time + 1.2;
      }
      while (u.path.length > 1 && Math.hypot(u.path[0][0] - u.x, u.path[0][1] - u.z) < 0.4) u.path.shift();
      if (u.path.length > 1 && this.nav.lineClear(u.x, u.z, u.path[1][0], u.path[1][1])) u.path.shift();
      tx = u.path[0][0]; tz = u.path[0][1];
    } else u.path = null;
    const dx = tx - u.x, dz = tz - u.z, l = Math.hypot(dx, dz);
    if (l < 0.05) return;
    u.mvx = (dx / l) * speedK; u.mvz = (dz / l) * speedK;
    if (u.canMove()) u.facing = Math.atan2(dx, dz);
  }
  respawn(h) {
    const f = BASES[h.team].fountain;
    const ang = (h.slot % 5) / 5 * Math.PI * 2 + 0.3;
    h.x = f[0] + Math.cos(ang) * 2.2; h.z = f[1] + Math.sin(ang) * 2.2;
    h.alive = true; h.recalc = 0;
    h.buffs = []; h.shields = []; h.cc = { stun: 0, root: 0, silence: 0, air: 0, airDur: 0, sleep: 0 };
    h.dash = null; h.disp = null; h.target = null; h.windup = 0;
    this.recalcHero(h);
    h.hp = h.st.maxHp; h.mana = h.st.maxMana;
    h.anim = 'idle'; h.animT = this.time;
    h.path = null;
    if (h.brain) h.brain.onRespawn();
    this.ev('respawn', h.id);
    this.fx('respawnFx', h.x, h.z, 1.5, h.team ? 0xff9a9a : 0x9fd8ff);
  }
  updateMinion(m, dt) {
    m.mvx = 0; m.mvz = 0;
    m.thinkT -= dt;
    if (m.thinkT <= 0) {
      m.thinkT = 0.25;
      const t = m.target;
      if (t && (!t.alive || t.untarget || t.invis || Math.hypot(t.x - m.x, t.z - m.z) > 9 || (t.kind === 'hero' && !this.visibleTo(t, m.team) && Math.hypot(t.x - m.x, t.z - m.z) > 3))) m.target = null;
      if (m.helpTarget && this.time < m.helpT && m.helpTarget.alive && !m.helpTarget.untarget && Math.hypot(m.helpTarget.x - m.x, m.helpTarget.z - m.z) < 7) {
        if (!m.target || m.target.kind !== 'hero') m.target = m.helpTarget;
      }
      if (!m.target || (m.target.kind !== 'minion' && m.target.kind !== 'hero')) {
        const nt = this.findMinionTarget(m);
        if (nt) m.target = nt;
      }
    }
    const t = m.target;
    if (t) {
      if (!this.inRange(m, t, m.st.range)) this.steer(m, t.x, t.z, dt);
      return;
    }
    // follow lane
    const LP = m.lanePath;
    let wp = LP[Math.min(m.wpi, LP.length - 1)];
    if (Math.hypot(wp[0] - m.x, wp[1] - m.z) < 2.5 && m.wpi < LP.length - 1) { m.wpi++; wp = LP[m.wpi]; }
    this.steer(m, wp[0], wp[1], dt);
  }
  findMinionTarget(m) {
    let best = null, bs = Infinity;
    const aggro = m.minionType === 'titan' ? 7 : 6.5;
    this.query(m.x, m.z, aggro + 2, (u) => {
      if (!u.alive || u.team === m.team || u.untarget || u.invis || u.team === 2) return;
      const d = Math.hypot(u.x - m.x, u.z - m.z) - u.radius;
      if (d > aggro) return;
      let s = d;
      if (u.kind === 'minion') s += 0;
      else if (u.kind === 'hero') { if (!this.visibleTo(u, m.team)) return; s += 6; }
      else if (u.kind === 'tower' || u.kind === 'core') { if (u.invuln) return; s += 10; }
      else return;
      if (s < bs) { bs = s; best = u; }
    });
    return best;
  }
  updateTower(t, dt) {
    t.mvx = 0; t.mvz = 0;
    const valid = (u) => u && u.alive && !u.untarget && u.team !== t.team && u.team !== 2 && this.inRange(t, u, t.st.range);
    if (t.aggroHero && this.time < t.aggroT && valid(t.aggroHero) && (!t.target || t.target.kind !== 'hero')) t.target = t.aggroHero;
    if (!valid(t.target)) {
      t.target = null;
      let best = null, bs = Infinity;
      this.query(t.x, t.z, t.st.range + 2, (u) => {
        if (!valid(u)) return;
        const d = Math.hypot(u.x - t.x, u.z - t.z);
        const s = d + (u.kind === 'hero' ? 20 : 0);
        if (s < bs) { bs = s; best = u; }
      });
      t.target = best;
    }
  }
  monsterAggro(m, src) {
    if (!src || src.team === 2) return;
    const attacker = src.owner || src;
    const group = m.camp ? m.camp.units : [m];
    for (const u of group) if (u.alive && !u.returning) { if (!u.target || !u.target.alive) u.target = attacker; u.aggroT = this.time; }
  }
  updateMonster(m, dt) {
    m.mvx = 0; m.mvz = 0;
    const leash = m.boss ? 7.5 : 8.5;
    const dHome = Math.hypot(m.x - m.home[0], m.z - m.home[1]);
    if (m.returning) {
      this.steer(m, m.home[0], m.home[1], dt, 1.4);
      m.hp = Math.min(m.st.maxHp, m.hp + m.st.maxHp * 0.25 * dt);
      if (dHome < 0.6) { m.returning = false; m.hp = m.st.maxHp; m.facing = m.homeFacing; }
      return;
    }
    const t = m.target;
    if (t) {
      const tHome = Math.hypot(t.x - m.home[0], t.z - m.home[1]);
      if (!t.alive || t.untarget || tHome > leash + 3 || dHome > leash || (this.time - m.lastHurtT > 5 && !this.inRange(m, t, m.st.range + 1))) {
        // retarget to someone else attacking the camp, or reset
        m.target = null; m.returning = true; m.windup = 0;
        return;
      }
      if (!this.inRange(m, t, m.st.range)) this.steer(m, t.x, t.z, dt);
    } else if (dHome > 0.8) {
      this.steer(m, m.home[0], m.home[1], dt);
    } else {
      m.hp = Math.min(m.st.maxHp, m.hp + m.st.maxHp * 0.02 * dt);
    }
  }

  updateUnit(u, dt) {
    // timers
    const cc = u.cc;
    if (cc.stun > 0) cc.stun -= dt;
    if (cc.sleep > 0) cc.sleep -= dt;
    if (cc.root > 0) cc.root -= dt;
    if (cc.silence > 0) cc.silence -= dt;
    if (cc.air > 0) { cc.air -= dt; if (cc.air <= 0) cc.airDur = 0; }
    if (u.castLock > 0) u.castLock -= dt;
    if (u.atkCd > 0) u.atkCd -= dt;
    // buffs
    if (u.buffs.length) {
      let removed = false;
      for (const b of u.buffs) {
        b.t -= dt;
        if (b.dot || b.hot) {
          b.next -= dt;
          if (b.next <= 0) {
            const iv = (b.dot || b.hot).interval || 0.5;
            b.next += iv;
            if (b.dot) this.dmg(b.src || null, u, b.dot.dmg, b.dot.type || 'm', { dot: 1, passive: 1 });
            if (b.hot) this.heal(b.src, u, b.hot.amt * iv);
          }
        }
        if (b.decay) u.dirty = true;
        if (b.t <= 0) removed = true;
      }
      if (removed) {
        const keep = [];
        for (const b of u.buffs) { if (b.t > 0) keep.push(b); else if (b.onEnd) b.onEnd(); }
        u.buffs = keep; u.dirty = true;
      }
      if (!u.alive) return;
    }
    if (u.shields.length) { for (const s of u.shields) s.t -= dt; if (u.shields.some((s) => s.t <= 0)) u.shields = u.shields.filter((s) => s.t > 0); }
    if (u.dirty) this.recalc(u);
    // heroes: regen, skills cooldown, passives
    if (u.kind === 'hero') {
      for (const s of u.skills) if (s.cd > 0) s.cd -= dt;
      if (u.spellCd > 0) u.spellCd -= dt;
      if (u.regenCd > 0) u.regenCd -= dt;
      u.hp = Math.min(u.st.maxHp, u.hp + u.st.hpReg * dt);
      u.mana = Math.min(u.st.maxMana, u.mana + u.st.mpReg * dt);
      if (u.regenT > 0) {
        u.regenT -= dt;
        u.hp = Math.min(u.st.maxHp, u.hp + u.st.maxHp * 0.04 * dt);
        u.mana = Math.min(u.st.maxMana, u.mana + u.st.maxMana * 0.04 * dt);
      }
      if (u.def.onTick) u.def.onTick(this, u, dt);
      if (u.def.aura && this.tickN % 9 === u.slot % 9) u.def.aura(this, u);
      if (u.petId === 'dragon') this.updateDragonPet(u, dt);
      if (u.pv.chill && u.pv.chillT < this.time) u.pv.chill = 0;
      u.bush = this.nav.bushAt(u.x, u.z);
    } else if (u.kind === 'minion' || u.kind === 'monster') {
      if (this.tickN % 6 === 0) u.bush = this.nav.bushAt(u.x, u.z);
    }
    // movement
    let moved = false;
    const ox = u.x, oz = u.z;
    if (u.disp) {
      const d = u.disp;
      const nx = u.x + d.vx * dt, nz = u.z + d.vz * dt;
      if (!this.nav.blocked(nx, nz)) { u.x = nx; u.z = nz; }
      d.t -= dt;
      if (d.t <= 0) u.disp = null;
      moved = true;
    } else if (u.dash) {
      this.updateDash(u, dt);
      moved = true;
    } else if ((u.mvx || u.mvz) && u.canMove()) {
      const sp = u.st.ms * dt;
      this.moveSlide(u, u.mvx * sp, u.mvz * sp);
      moved = true;
      if (u.windup > 0 && u.kind === 'hero') { /* moving cancels attack windup */ u.windup = 0; u.windTarget = null; }
    }
    u.vx = (u.x - ox) / dt; u.vz = (u.z - oz) / dt;
    if (u.cc.air > 0) { const p = 1 - u.cc.air / Math.max(0.01, u.cc.airDur); u.airH = Math.sin(p * Math.PI) * 1.8; }
    else if (!u.dash) u.airH = 0;
    void moved;
  }
  moveSlide(u, dx, dz) {
    const nx = u.x + dx, nz = u.z + dz;
    if (!this.nav.blocked(nx, nz)) { u.x = nx; u.z = nz; return; }
    if (!this.nav.blocked(nx, u.z)) { u.x = nx; return; }
    if (!this.nav.blocked(u.x, nz)) { u.z = nz; return; }
    // try diagonal slide
    const l = Math.hypot(dx, dz);
    for (const a of [0.7, -0.7, 1.3, -1.3]) {
      const c = Math.cos(a), s = Math.sin(a);
      const rx = (dx * c - dz * s), rz = (dx * s + dz * c);
      if (!this.nav.blocked(u.x + rx, u.z + rz)) { u.x += rx * 0.7; u.z += rz * 0.7; return; }
    }
    void l;
  }
  updateDash(u, dt) {
    const d = u.dash;
    const o = d.opts;
    if (o.targetId) {
      const t = this.units.find((x) => x.id === o.targetId);
      if (t && t.alive) { d.tx = t.x; d.tz = t.z; }
    }
    const dx = d.tx - u.x, dz = d.tz - u.z;
    const rem = Math.hypot(dx, dz);
    const step = d.speed * dt;
    const stopDist = o.stopDist || 0;
    let arrived = false;
    if (rem - stopDist <= step) {
      const k = rem > 0 ? Math.max(0, rem - stopDist) / rem : 0;
      const nx = u.x + dx * k, nz = u.z + dz * k;
      if (o.ignoreWalls || !this.nav.blocked(nx, nz)) { u.x = nx; u.z = nz; }
      arrived = true;
    } else {
      const nx = u.x + (dx / rem) * step, nz = u.z + (dz / rem) * step;
      if (!o.ignoreWalls && this.nav.blocked(nx, nz)) arrived = true;
      else { u.x = nx; u.z = nz; }
      if (rem > 0.01) u.facing = Math.atan2(dx, dz);
    }
    d.done += step;
    if (o.arc) { const p = Math.min(1, d.done / d.total); u.airH = o.arc * 4 * p * (1 - p); }
    if (o.hitR && o.onHit) {
      let stop = false;
      this.query(u.x, u.z, o.hitR, (t) => {
        if (stop || !t.alive || t.untarget || t.team === u.team || d.hit.has(t.id) || t.kind === 'tower' || t.kind === 'core') return;
        d.hit.add(t.id);
        if (o.onHit(t) === 'stop') stop = true;
      });
      if (stop) arrived = true;
    }
    if (arrived || d.done > d.total + 8) {
      u.dash = null; u.airH = 0;
      if (this.nav.blocked(u.x, u.z)) { const [x, z] = this.nav.nearestFree(u.x, u.z); u.x = x; u.z = z; }
      u.dirty = true;
      if (o.onEnd) o.onEnd();
    }
  }
  separate() {
    for (const u of this.units) {
      if (!u.alive || u.kind === 'tower' || u.kind === 'core' || u.dash || u.cc.air > 0) continue;
      this.query(u.x, u.z, u.radius + 1.6, (o) => {
        if (o === u || !o.alive || o.id < u.id || o.kind === 'tower' || o.kind === 'core' || o.dash || o.cc.air > 0) return;
        const dx = o.x - u.x, dz = o.z - u.z;
        const d = Math.hypot(dx, dz);
        const min = (u.radius + o.radius) * 0.85;
        if (d >= min || d < 1e-4) return;
        const push = (min - d) * 0.35;
        const nx = dx / d, nz = dz / d;
        const wu = o.radius / (u.radius + o.radius), wo = 1 - wu;
        const ux = u.x - nx * push * wu, uz = u.z - nz * push * wu;
        const ox = o.x + nx * push * wo, oz = o.z + nz * push * wo;
        if (!this.nav.blocked(ux, uz)) { u.x = ux; u.z = uz; }
        if (!this.nav.blocked(ox, oz)) { o.x = ox; o.z = oz; }
      });
    }
  }
  updateAttack(u, dt, moved) {
    if (u.windup > 0) {
      const t = u.windTarget;
      if (!t || !t.alive || t.untarget || !u.canAttack() || (u.kind !== 'tower' && u.kind !== 'core' && !this.inRange(u, t, u.st.range + 1.2))) { u.windup = 0; u.windTarget = null; return; }
      u.windup -= dt;
      if (u.windup <= 0) this.fireAttack(u, t);
      return;
    }
    const t = u.target;
    if (!t || !t.alive || u.atkCd > 0 || !u.canAttack()) return;
    if (t.team === u.team || t.untarget) return;
    if (!this.inRange(u, t, u.st.range)) return;
    if (u.kind === 'hero' && (u.mvx || u.mvz) && !u.input.atk && !u.input.forceTarget) return;
    const period = 1 / Math.max(0.1, u.st.as);
    const wind = u.kind === 'tower' || u.kind === 'core' ? 0.2 : Math.min(0.32, period * 0.33);
    u.windup = wind; u.windTotal = wind; u.windTarget = t;
    u.atkCd = period;
    u.facing = Math.atan2(t.x - u.x, t.z - u.z);
    u.anim = u.pv.atkAlt ? 'atk2' : 'atk'; u.animT = this.time; u.pv.atkAlt = !u.pv.atkAlt;
    u.lastAtkT = this.time;
  }
  fireAttack(u, t) {
    u.windTarget = null;
    if (u.kind === 'hero') { this.breakStealth(u); this.cancelRecall(u); }
    const projKind = u.kind === 'hero' ? u.def.attack.proj : (u.kind === 'tower' ? 'towerShot' : u.kind === 'core' ? 'coreShot' : u.proj);
    const doHit = () => this.attackHit(u, t);
    if (projKind) {
      const sp = projKind === 'towerShot' || projKind === 'coreShot' ? 22 : projKind === 'siegeShell' ? 14 : 24;
      const y = u.kind === 'tower' ? 6.2 : u.kind === 'core' ? 5 : 1.3;
      this.homing(u, t, { speed: sp, kind: projKind, y, onHit: doHit });
      this.ev('atk', u.id, t.id, 1);
    } else {
      this.ev('atk', u.id, t.id, 0);
      doHit();
    }
  }
  attackHit(u, t) {
    if (!t.alive || !u) return;
    if (u.kind === 'tower' || u.kind === 'core') {
      let dmg = u.st.atk + TOWER_ATK.atkT * (this.time / 60);
      if (t.kind === 'hero') {
        if (u.rampId === t.id) u.rampN = Math.min(4, (u.rampN || 0) + 1); else { u.rampId = t.id; u.rampN = 0; }
        dmg *= 1 + 0.3 * u.rampN;
      } else if (t.kind === 'minion') {
        dmg = t.minionType === 'siege' ? t.st.maxHp * 0.16 : t.minionType === 'titan' ? dmg : t.st.maxHp * 0.36;
      }
      this.dmg(u, t, dmg, t.kind === 'minion' ? 't' : 'p', { basic: 1 });
      this.ev('hit', t.id, 1);
      return;
    }
    if (u.kind === 'minion' || u.kind === 'monster') {
      if (u.aoe) {
        this.fx('slam', t.x, t.z, u.aoe, u.kind === 'monster' ? 0xbfefff : 0xffffff);
        this.sfx('slam', t.x, t.z);
        const victims = [];
        this.query(t.x, t.z, u.aoe, (o) => { if (o.alive && o.team !== u.team && !o.untarget && o.kind !== 'tower' && o.kind !== 'core') victims.push(o); });
        if (t.kind === 'tower' || t.kind === 'core') victims.push(t);
        for (const o of victims) this.dmg(u, o, u.st.atk, 'p', { basic: 1 });
      } else this.dmg(u, t, u.st.atk, 'p', { basic: 1 });
      this.ev('hit', t.id, 0);
      return;
    }
    // hero basic attack
    const h = u;
    let dmg = h.st.atk;
    let crit = false;
    if (h.st.crit > 0 && this.rng() < h.st.crit) { crit = true; dmg *= h.st.critDmg; }
    if (h.def.attackAmp) dmg *= h.def.attackAmp(this, h, t);
    if (h.pv.empower && this.time <= h.pv.empowerT) {
      this.dmg(h, t, h.pv.empower, 'p', { passive: 1, noProc: true });
      if (h.pv.empowerSlow) this.cc(t, 'slow', 1, h, h.pv.empowerSlow);
      h.pv.empower = 0;
    }
    const dealt = this.dmg(h, t, dmg, 'p', { basic: 1, crit });
    this.ev('hit', t.id, crit ? 2 : 0);
    if (!t.alive && t.kind !== 'hero') { /* last hit */ }
    if (h.def.onAttackHit && t.alive) h.def.onAttackHit(this, h, t, dmg);
    // item passives
    const P = h.passives;
    if (t.alive) {
      if (P.has('frostbite')) this.cc(t, 'slow', 1, h, 0.15);
      if (P.has('hpburn')) this.dmg(h, t, Math.min(t.kind === 'monster' ? 120 : 1e9, t.hp * 0.025), 'p', { passive: 1 });
      if (P.has('chain')) {
        h.chainN = (h.chainN + 1) % 3;
        if (h.chainN === 0) {
          const near = this.enemies(h, t.x, t.z, 5).filter((e) => e !== t).slice(0, 2);
          for (const e of near) { this.fx('lightning', t.x, t.z, 1, 0xfff27a, e.x, e.z); this.dmg(h, e, 60 + 0.3 * h.st.atk, 'm', { passive: 1 }); }
        }
      }
      if (this.hasBuff(h, 'ember')) {
        this.buff(t, { id: 'emberburn' + h.id, dur: 3, src: h, dot: { dmg: (20 + 3 * h.level) * 0.5, type: 't', interval: 0.5 }, mods: { slow: 0.15 }, fx: 'burning' });
      }
    }
    if (t.kind === 'hero' && t.passives) {
      if (t.passives.has('thorns')) this.dmg(t, h, dealt * 0.25, 'm', { passive: 1 });
      if (t.passives.has('cold')) this.buff(h, { id: 'cold', dur: 2, mods: { asP: -0.2 } });
    }
    void dealt;
  }
  updateDragonPet(h, dt) {
    h.petT -= dt;
    if (h.petT > 0) return;
    const t = h.target && h.target.alive && h.target.team !== h.team ? h.target : null;
    if (!t || !this.inRange(h, t, Math.max(h.st.range, 5))) return;
    h.petT = 6;
    this.homing(h, t, { speed: 16, kind: 'dragonBreath', y: 2.2, onHit: () => this.dmg(h, t, 30 + 6 * h.level, 'm', { passive: 1 }) });
  }
  updateProjectiles(dt) {
    const keep = [];
    for (const p of this.projs) {
      if (p.homing) {
        const t = p.homing;
        if (!t.alive || (t.untarget && t.kind !== 'tower')) continue;
        const dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz);
        const step = p.speed * dt;
        if (d <= step + t.radius * 0.6) { if (p.onHit) p.onHit(t, p); continue; }
        p.x += (dx / d) * step; p.z += (dz / d) * step; p.dx = dx / d; p.dz = dz / d;
        keep.push(p);
        continue;
      }
      const step = p.speed * dt;
      const sub = Math.max(1, Math.ceil(step / 0.6));
      let dead = false;
      for (let s = 0; s < sub && !dead; s++) {
        p.x += (p.dx * step) / sub; p.z += (p.dz * step) / sub;
        p.traveled += step / sub;
        if (p.onMove) p.onMove(p);
        this.query(p.x, p.z, p.width * 0.5 + 0.2, (u) => {
          if (dead || !u.alive || u.untarget || u.team === p.team || p.hit.has(u.id) || u.kind === 'tower' || u.kind === 'core') return;
          if (p.heroes && u.kind !== 'hero') return;
          p.hit.add(u.id);
          const r = p.onHit ? p.onHit(u, p) : null;
          if (r === 'stop' || !p.pierce) dead = true;
        });
        if (p.traveled >= p.range) { if (!dead && p.onEnd) p.onEnd(p); dead = true; }
      }
      if (!dead) keep.push(p);
    }
    this.projs = keep;
  }
  updateZones(dt) {
    if (!this.zones.length) return;
    const keep = [];
    for (const z of this.zones) {
      z.t -= dt;
      if (this.time >= z.next && z.t > -0.01) { z.next += z.interval; if (z.onTick) z.onTick(z); }
      if (z.t > 0) keep.push(z); else if (z.onEnd) z.onEnd(z);
    }
    this.zones = keep;
  }
  updateFountains(dt) {
    for (const b of BASES) {
      this.query(b.fountain[0], b.fountain[1], FOUNTAIN_R, (u) => {
        if (!u.alive || u.kind !== 'hero') return;
        if (u.team === b.team) {
          u.hp = Math.min(u.st.maxHp, u.hp + u.st.maxHp * 0.18 * dt);
          u.mana = Math.min(u.st.maxMana, u.mana + u.st.maxMana * 0.18 * dt);
        } else if (this.tickN % 6 === 0) {
          this.dmg(null, u, 1500 * 0.2, 't', { force: 1 });
          this.fx('fountainZap', u.x, u.z, 1, b.team ? 0xff6a6a : 0x6ab8ff);
        }
      });
    }
  }

  // ------------------------------------------------------------ vision
  computeVision() {
    const srcs = [[], []];
    for (const u of this.units) {
      if (!u.alive || u.team > 1) continue;
      const s = u.kind === 'hero' ? u.sight : u.sight || 0;
      if (s > 0) srcs[u.team].push(u);
    }
    for (const u of this.units) {
      if (!u.alive) { u.vis[0] = u.vis[1] = u.team === 2 || u.kind === 'tower' || u.kind === 'core'; continue; }
      if (u.team === 2 || u.kind === 'tower' || u.kind === 'core') { u.vis[0] = u.vis[1] = true; continue; }
      const other = 1 - u.team;
      u.vis[u.team] = true;
      u.vis[other] = this.seenBy(u, srcs[other]);
    }
    this.visSources = srcs;
  }
  seenBy(u, srcs) {
    const revealed = u.revealT > this.time;
    for (const s of srcs) {
      const dx = s.x - u.x, dz = s.z - u.z, d2 = dx * dx + dz * dz;
      const sight = s.sight;
      if (d2 > sight * sight) continue;
      const structure = s.kind === 'tower' || s.kind === 'core';
      if (structure && d2 <= (s.st.range + 0.5) ** 2) return true; // true sight
      if (d2 < 2.6 * 2.6) return true;
      if (u.invis) continue;
      if (u.bush && !revealed && s.bush !== u.bush) continue;
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------ snapshot for renderer / network
  snapshot(includeHeroes = true) {
    const T = this.time;
    const us = [];
    for (const u of this.units) {
      let f = 0;
      if (u.alive) f |= F.alive;
      if (u.vis[0]) f |= F.vis0;
      if (u.vis[1]) f |= F.vis1;
      if (u.cc.stun > 0) f |= F.stun;
      if (u.cc.sleep > 0) f |= F.sleep;
      if (u.cc.root > 0 || u.rootedBuff) f |= F.root;
      if (u.slowed) f |= F.slow;
      if (u.cc.silence > 0) f |= F.silence;
      if (u.cc.air > 0) f |= F.air;
      if (u.invis) f |= F.invis;
      if (u.untarget) f |= F.untarget;
      if (u.recallT > 0) f |= F.recall;
      if (u.bush) f |= F.bush;
      if (u.shields.length) f |= F.shield;
      if (u.regenT > 0) f |= F.regen;
      if (u.dash) f |= F.dash;
      if (u.invuln) f |= F.invuln;
      if (u.buffs.length) {
        for (const b of u.buffs) {
          if (b.fx === 'burning') f |= F.burn;
          else if (b.id === 'ember') f |= F.ember;
          else if (b.id === 'azure') f |= F.azure;
          else if (b.mods && b.mods.msP > 0.15) f |= F.haste;
        }
      }
      us.push([
        u.id, KIND_CODE[u.kind], u.typeIdx, u.team,
        Math.round(u.x * 100), Math.round(u.z * 100), Math.round(u.facing * 100),
        Math.ceil(u.hp), Math.round(u.st.maxHp), Math.round(u.mana || 0), Math.round(u.st.maxMana || 0),
        u.level || 0, f, ANIM_CODE[u.anim] || 0, Math.min(999, Math.round((T - u.animT) * 100)),
        Math.round(u.shieldAmt()), Math.round(u.airH * 100), u.kind === 'hero' ? Math.round(u.recallT * 10) : 0,
        u.kind === 'hero' && u.target && u.target.alive ? u.target.id : 0,
      ]);
    }
    const ps = this.projs.map((p) => [p.id, PROJ_CODE[p.kind] ?? 0, Math.round(p.x * 100), Math.round(p.z * 100), Math.round(p.y * 100), p.team, Math.round(Math.atan2(p.dx, p.dz) * 100)]);
    const zs = this.zones.map((z) => [z.id, ZONE_CODE[z.kind] ?? 0, Math.round(z.x * 100), Math.round(z.z * 100), Math.round(z.r * 100), z.team, Math.round(z.t * 100), Math.round(z.dur * 100)]);
    const snap = { t: Math.round(T * 1000) / 1000, u: us, p: ps, z: zs, k: [...this.teamKills], e: this.takeEvents() };
    snap.o = [
      this.bosses.tortoise.unit ? -1 : Math.max(0, Math.round(this.bosses.tortoise.respawnAt - T)),
      this.bosses.titan.unit ? -1 : Math.max(0, Math.round(this.bosses.titan.respawnAt - T)),
    ];
    snap.cp = this.camps.map((c) => (c.up ? -1 : Math.max(0, Math.round(c.respawnAt - T))));
    if (includeHeroes) snap.h = this.heroes.map((h) => this.heroDetail(h));
    if (this.over) snap.over = this.winner;
    return snap;
  }
  heroDetail(h) {
    return [
      h.id, h.def.index, h.team, h.slot, h.name, h.level, Math.round(h.xp), XP_TO_NEXT[h.level] || 0, Math.floor(h.gold),
      h.k, h.d, h.a, h.items.slice(),
      h.skills.map((s) => s.rank), h.skills.map((s) => Math.max(0, Math.round(s.cd * 10))), h.skills.map((s) => Math.round((s.cdMax || 1) * 10)),
      h.skillPoints, SPELLS.findIndex((s) => s.id === h.spell), Math.max(0, Math.round(h.spellCd * 10)),
      h.alive ? 0 : Math.max(0, Math.round((h.respawnAt - this.time) * 10)), PETS.findIndex((p) => p.id === h.petId),
      Math.round(h.goldEarned), Math.round(h.dmgDealt), Math.max(0, Math.round(h.regenCd * 10)), h.cs,
      [Math.round(h.st.atk), Math.round(h.st.mag), Math.round(h.st.armor), Math.round(h.st.mr), +h.st.as.toFixed(2), +h.st.ms.toFixed(2), Math.round(h.st.crit * 100), Math.round(h.st.cdr * 100), Math.round(h.st.ls * 100), Math.round(h.st.sv * 100)],
      h.netId || '', h.isBot ? 1 : 0, Math.round(h.dmgTaken), Math.round(h.healDone), h.skills.map((_, i) => (this.canLevelSkill(h, i) ? 1 : 0)), Math.round(h.mana),
    ];
  }
}
