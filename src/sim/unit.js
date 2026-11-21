// Unit model: heroes, minions, towers, cores and monsters share this class.
export const KINDS = ['hero', 'minion', 'tower', 'core', 'monster'];
export const KIND_CODE = { hero: 0, minion: 1, tower: 2, core: 3, monster: 4 };
export const STAT_KEYS = ['maxHp', 'maxMana', 'atk', 'mag', 'armor', 'mr', 'as', 'range', 'ms', 'crit', 'critDmg', 'ls', 'sv', 'cdr', 'apen', 'apenP', 'mpen', 'mpenP', 'hpReg', 'mpReg', 'dmgRed', 'tenacity', 'dmgAmp', 'sight', 'magAmp'];

export function blankStats() {
  const s = {};
  for (const k of STAT_KEYS) s[k] = 0;
  s.critDmg = 2.0;
  return s;
}

export class Unit {
  constructor(w, kind, team, x, z) {
    this.w = w;
    this.id = w.nextId++;
    this.kind = kind;
    this.team = team; // 0 blue, 1 red, 2 neutral
    this.x = x; this.z = z;
    this.vx = 0; this.vz = 0;
    this.facing = team === 0 ? Math.PI * 0.75 : team === 1 ? -Math.PI * 0.25 : 0;
    this.radius = 0.6;
    this.alive = true;
    this.hp = 1; this.mana = 0;
    this.st = blankStats();
    this.baseSt = blankStats();
    this.buffs = [];
    this.shields = [];
    this.cc = { stun: 0, root: 0, silence: 0, air: 0, airDur: 0, sleep: 0 };
    this.ccImmuneT = 0;
    this.disp = null;   // forced displacement (knock/pull)
    this.dash = null;   // self dash
    this.castLock = 0;
    this.atkCd = 0;
    this.windup = 0; this.windTarget = null; this.windTotal = 0;
    this.target = null;
    this.anim = 'idle'; this.animT = 0;
    this.lastHurtT = -99;
    this.lastAtkT = -99;
    this.hurtBy = new Map(); // hero id -> time (assists)
    this.vis = [team === 0, team === 1];
    this.revealT = 0;
    this.bush = 0;
    this.pv = {};
    this.deathT = 0;
    this.typeIdx = 0;
    this.sight = 0;
    this.untarget = false;
    this.invis = false;
    this.rootedBuff = false;
    this.airH = 0;
    this.flagsExtra = 0;
  }
  get hpPct() { return this.hp / Math.max(1, this.st.maxHp); }
  shieldAmt() { let s = 0; for (const sh of this.shields) s += sh.amt; return s; }
  isHardCC() { return this.cc.stun > 0 || this.cc.air > 0 || !!this.disp; }
  canMove() { return this.alive && !this.isHardCC() && this.cc.root <= 0 && !this.dash && this.castLock <= 0 && !this.rootedBuff; }
  canAttack() { return this.alive && !this.isHardCC() && !this.dash && this.castLock <= 0 && !this.untarget; }
  canCast() { return this.alive && !this.isHardCC() && this.cc.silence <= 0 && !this.dash && !this.rootedBuff; }
  targetable() { return this.alive && !this.untarget; }
}
