// Bot AI: per-hero brain + per-team coordinator.
import { BASES, LANES, PITS, LANE_LEN, laneProgress, lanePoint } from './map.js';
import { ITEM_BY_ID, effectiveBuild } from '../data/items.js';

const DIFF = {
  easy: { react: 0.6, aimErr: 0.3, lead: 0.3, retreat: 0.2, aggr: 0.8, skillChance: 0.5, kite: 0, dodge: 0, think: 0.4 },
  normal: { react: 0.32, aimErr: 0.13, lead: 0.7, retreat: 0.3, aggr: 1.0, skillChance: 0.85, kite: 0.5, dodge: 0.25, think: 0.25 },
  hard: { react: 0.16, aimErr: 0.05, lead: 0.95, retreat: 0.33, aggr: 1.12, skillChance: 1, kite: 0.9, dodge: 0.6, think: 0.18 },
};

export function laneOf(team, role) {
  if (role === 'mid') return 'mid';
  if (role === 'gold' || role === 'roam') return team === 0 ? 'bot' : 'top';
  if (role === 'exp') return team === 0 ? 'top' : 'bot';
  return null;
}
export function heroPower(u) {
  if (!u || !u.alive) return 0;
  const ehp = u.hp * (1 + (u.st.armor + u.st.mr) / 240) + u.shieldAmt();
  const dps = u.st.atk * u.st.as * (1 + u.st.crit) + u.st.mag * 0.9 + u.level * 30 + 60;
  return Math.sqrt(ehp * dps);
}

export class BotBrain {
  constructor(w, h, role, difficulty) {
    this.w = w; this.h = h; this.role = role;
    this.lane = laneOf(h.team, role);
    this.D = DIFF[difficulty] || DIFF.normal;
    this.mode = 'lane'; this.goal = null; this.fightT = null;
    this.thinkT = w.rng() * 0.3;
    this.path = null; this.pathGoal = null; this.pathT = 0;
    this.pending = null; // delayed cast
    this.stuckT = 0; this.lastPos = [h.x, h.z];
    this.order = null;
    this.kiteT = 0;
    this.campTarget = null;
    this.idleOffset = (w.rng() - 0.5) * 2;
  }
  onRespawn() { this.mode = 'lane'; this.path = null; this.campTarget = null; this.pending = null; }
  get ranged() { return this.h.st.range > 3; }

  // ---------------------------------------------------------- per tick
  tick(dt) {
    const w = this.w, h = this.h;
    this.thinkT -= dt;
    if (this.thinkT <= 0) { this.thinkT = this.D.think * (0.8 + w.rng() * 0.4); this.think(); }
    if (this.pending && w.time >= this.pending.at) {
      const p = this.pending; this.pending = null;
      if (p.kind === 'spell') w.useSpell(h, p.aim);
      else w.castSkill(h, p.slot, this.refreshAim(p));
    }
    this.act(dt);
  }
  act(dt) {
    const w = this.w, h = this.h, inp = h.input;
    inp.atk = false; inp.mx = 0; inp.mz = 0; inp.forceTarget = null;
    if (h.recallT > 0) return;
    if (this.mode === 'recall') { if (w.startRecall(h)) return; }
    const t = this.fightT;
    if ((this.mode === 'fight' || this.mode === 'farm' || this.mode === 'tower' || this.mode === 'camp') && t && t.alive) {
      // kite: ranged heroes step back between attacks vs melee threats
      if (this.mode === 'fight' && this.ranged && this.D.kite > 0 && h.atkCd > 0.22 && h.windup <= 0) {
        const threat = this.nearestThreat(3.6);
        if (threat && this.kiteT <= 0 && this.w.rng() < this.D.kite) this.kiteT = 0.35;
        if (this.kiteT > 0) {
          this.kiteT -= dt;
          if (threat) {
            const dx = h.x - threat.x, dz = h.z - threat.z, l = Math.hypot(dx, dz) || 1;
            const home = BASES[h.team].fountain;
            const hx = home[0] - h.x, hz = home[1] - h.z, hl = Math.hypot(hx, hz) || 1;
            inp.mx = dx / l * 0.7 + hx / hl * 0.3; inp.mz = dz / l * 0.7 + hz / hl * 0.3;
            return;
          }
        }
      }
      inp.forceTarget = t;
      return;
    }
    if (this.goal) {
      const d = Math.hypot(this.goal[0] - h.x, this.goal[1] - h.z);
      if (d > (this.goalTol || 1.2)) {
        const [dx, dz] = this.steerDir(this.goal[0], this.goal[1]);
        inp.mx = dx; inp.mz = dz;
        // dodge incoming skillshots
        if (this.D.dodge > 0) this.dodge(inp);
      }
    }
    // stuck detection
    this.stuckT += dt;
    if (this.stuckT > 1.5) {
      const moved = Math.hypot(h.x - this.lastPos[0], h.z - this.lastPos[1]);
      if (moved < 0.5 && (inp.mx || inp.mz)) { this.path = null; this.pathT = 0; this.forcePath = w.time + 2.5; const a = w.rng() * Math.PI * 2; inp.mx = Math.cos(a); inp.mz = Math.sin(a); }
      this.lastPos = [h.x, h.z]; this.stuckT = 0;
    }
  }
  dodge(inp) {
    const w = this.w, h = this.h;
    for (const p of w.projs) {
      if (p.homing || p.team === h.team) continue;
      const rx = h.x - p.x, rz = h.z - p.z;
      const along = rx * p.dx + rz * p.dz;
      if (along < 0 || along > 7) continue;
      const perp = rx * p.dz - rz * p.dx;
      if (Math.abs(perp) > p.width * 0.5 + h.radius + 0.4) continue;
      if (w.rng() > this.D.dodge) continue;
      const s = perp >= 0 ? 1 : -1;
      inp.mx = p.dz * s; inp.mz = -p.dx * s;
      return;
    }
  }
  steerDir(x, z) {
    const w = this.w, h = this.h;
    let tx = x, tz = z;
    if (this.forcePath > w.time || !w.nav.lineClear(h.x, h.z, x, z, false, w.nav.blocked(x, z) ? 3.2 : 0)) {
      if (!this.path || !this.pathGoal || Math.hypot(this.pathGoal[0] - x, this.pathGoal[1] - z) > 2.5 || w.time > this.pathT) {
        this.path = w.nav.findPath(h.x, h.z, x, z) || [[x, z]];
        this.pathGoal = [x, z]; this.pathT = w.time + 1.5;
      }
      const P = this.path;
      while (P.length > 1 && Math.hypot(P[0][0] - h.x, P[0][1] - h.z) < 0.4) P.shift();
      if (P.length > 1 && w.nav.lineClear(h.x, h.z, P[1][0], P[1][1])) P.shift();
      tx = P[0][0]; tz = P[0][1];
    } else this.path = null;
    const dx = tx - h.x, dz = tz - h.z, l = Math.hypot(dx, dz) || 1;
    return [dx / l, dz / l];
  }
  nearestThreat(r) {
    const w = this.w, h = this.h;
    let best = null, bd = r;
    for (const e of w.heroes) {
      if (!e.alive || e.team === h.team || !w.visibleTo(e, h.team)) continue;
      if (e.st.range > 3) continue;
      const d = w.dist(e, h);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  // ---------------------------------------------------------- decisions
  think() {
    const w = this.w, h = this.h;
    if (!h.alive) return;
    this.shop();
    this.useSpellLogic();
    const hpP = h.hp / h.st.maxHp;
    const fountain = BASES[h.team].fountain;
    const dFount = Math.hypot(h.x - fountain[0], h.z - fountain[1]);
    const enemies = w.enemies(h, h.x, h.z, 13, { heroes: true, visible: true });
    const allies = w.allies(h, h.x, h.z, 13, { heroes: true });
    let myP = 0, enP = 0;
    for (const a of allies) myP += heroPower(a);
    for (const e of enemies) enP += heroPower(e);
    // enemy tower influence
    const eTower = this.nearestEnemyStructure(h.x, h.z, 13);
    if (eTower && Math.hypot(eTower.x - h.x, eTower.z - h.z) < eTower.st.range + 3) enP += 700 + w.time * 0.3;
    const aTower = this.nearestAllyStructure(h.x, h.z, 11);
    if (aTower) myP += 500;
    this.myP = myP; this.enP = enP;

    // heal at fountain
    if (dFount < 6 && (hpP < 0.92 || h.mana < h.st.maxMana * 0.6) && !enemies.length) { this.setGoal(fountain[0], fountain[1], 'heal'); this.fightT = null; return; }
    // retreat / recall
    const lowMana = h.st.maxMana > 0 && h.mana < h.st.maxMana * 0.12 && (h.def.role === 'Mage' || h.def.role === 'Support');
    if (hpP < this.D.retreat || (hpP < 0.5 && enP > myP * 1.6) || (hpP < 0.42 && eTower && w.inRange(eTower, h, eTower.st.range + 0.5))) {
      if (enemies.length || (eTower && w.inRange(eTower, h, eTower.st.range + 1))) { this.retreat(enemies, hpP); return; }
      if (dFount > 25) { this.mode = 'recall'; this.fightT = null; this.goal = null; return; }
      this.setGoal(fountain[0], fountain[1], 'heal'); this.fightT = null; return;
    }
    if ((lowMana || hpP < 0.4) && !enemies.length && dFount > 25) { this.mode = 'recall'; this.fightT = null; this.goal = null; return; }
    if (this.mode === 'recall' && h.recallT <= 0 && enemies.length) this.mode = 'lane';
    if (this.mode === 'recall') return;

    // fight decision
    const target = this.chooseTarget(enemies);
    if (target) {
      const adv = myP / Math.max(1, enP);
      const burst = this.burstEstimate(target);
      const killable = burst > target.hp + target.shieldAmt();
      const tTower = this.nearestAllyStructureOf(target, target.x, target.z, 10.5);
      let engage = adv * this.D.aggr > 1.05 || (killable && adv > 0.55) || (adv > 0.85 && hpP > 0.6);
      if (tTower && !killable) {
        const diving = w.inRange(tTower, h, tTower.st.range + 1.5);
        const tanked = tTower.target && tTower.target.kind !== 'hero';
        if (!tanked || adv < 1.6) engage = engage && !diving && w.dist(target, tTower) > tTower.st.range;
      }
      if (this.order && this.order.type === 'obj' && target && w.dist(h, target) > 7) engage = engage && adv > 1.3;
      if (engage) {
        this.mode = 'fight'; this.fightT = target; this.goal = null;
        this.combo(target);
        return;
      }
      if (adv < 0.7 && w.dist(h, target) < 9) { this.retreat(enemies, hpP); return; }
    }
    this.fightT = null;

    // team orders
    const ord = this.w.teamBrains[h.team].orderFor(h);
    this.order = ord;
    if (ord) {
      if (ord.type === 'obj') { if (this.doObjective(ord)) return; }
      else if (ord.type === 'defend' || ord.type === 'group' || ord.type === 'push') { if (this.doPush(ord)) return; }
    }
    // role defaults
    if (this.role === 'jungle') { if (this.doJungle()) return; }
    if (this.role === 'roam') { if (this.doRoam()) return; }
    this.doLane(this.lane || 'mid');
  }
  setGoal(x, z, mode, tol = 1.2) { this.goal = [x, z]; this.mode = mode; this.goalTol = tol; }
  retreat(enemies, hpP) {
    const w = this.w, h = this.h;
    this.mode = 'retreat'; this.fightT = null;
    // nearest allied tower further back, else fountain
    const f = BASES[h.team].fountain;
    let best = null, bd = Infinity;
    for (const t of [...w.towers, ...w.cores]) {
      if (!t.alive || t.team !== h.team) continue;
      const dMe = Math.hypot(t.x - h.x, t.z - h.z);
      const dHome = Math.hypot(t.x - f[0], t.z - f[1]);
      const myHome = Math.hypot(h.x - f[0], h.z - f[1]);
      if (dHome > myHome + 2) continue;
      if (dMe < bd && dMe > 3) { bd = dMe; best = t; }
    }
    const g = best && hpP > 0.15 ? [best.x + (f[0] - best.x) * 0.15, best.z + (f[1] - best.z) * 0.15] : f;
    this.setGoal(g[0], g[1], 'retreat');
    // escape skills
    for (let i = 0; i < 3; i++) {
      const s = h.def.skills[i];
      if (!s.ai || h.skills[i].rank === 0 || h.skills[i].cd > 0 || h.mana < w.skillCost(h, i)) continue;
      const near = enemies.some((e) => w.dist(e, h) < 6);
      if (!near) continue;
      if (s.ai.type === 'escape' || s.ai.alsoEscape) {
        if (s.aim === 'unit') continue;
        const [dx, dz] = this.steerDir(g[0], g[1]);
        if (s.aim === 'dir') this.queueCast(i, { dx, dz });
        else if (s.aim === 'point') this.queueCast(i, { x: h.x + dx * s.range, z: h.z + dz * s.range });
        else this.queueCast(i, {});
        return;
      }
      if (s.ai.type === 'cc' && enemies[0] && w.dist(enemies[0], h) < (s.range || s.radius || 4)) { this.queueCast(i, this.aimAt(s, enemies[0])); return; }
      if (s.ai.type === 'save' || (s.ai.type === 'buff' && s.icon === 'veil')) { this.queueCast(i, {}); return; }
    }
  }
  chooseTarget(enemies) {
    const w = this.w, h = this.h;
    let best = null, bs = Infinity;
    for (const e of enemies) {
      if (!e.alive || e.untarget) continue;
      const d = w.dist(e, h);
      let s = d * 0.6 + (e.hp / e.st.maxHp) * 8 - (e.def.role === 'Marksman' || e.def.role === 'Mage' ? 1.5 : 0);
      if (this.fightT === e) s -= 2.5; // stickiness
      if (s < bs) { bs = s; best = e; }
    }
    return best;
  }
  burstEstimate(t) {
    const w = this.w, h = this.h;
    let dmg = h.st.atk * h.st.as * 3 * (1 + h.st.crit);
    h.skills.forEach((s, i) => { if (s.rank > 0 && s.cd <= 0) dmg += (i === 2 ? 450 : 220) + s.rank * 70 + h.st.mag * 0.9 + h.st.atk * 0.6; });
    const def = (t.st.armor + t.st.mr) / 2;
    return dmg * (120 / (120 + def));
  }
  nearestEnemyStructure(x, z, r) {
    let best = null, bd = r;
    for (const t of [...this.w.towers, ...this.w.cores]) {
      if (!t.alive || t.team === this.h.team) continue;
      const d = Math.hypot(t.x - x, t.z - z);
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }
  nearestAllyStructure(x, z, r) { return this.nearestAllyStructureOf(this.h, x, z, r); }
  nearestAllyStructureOf(u, x, z, r) {
    let best = null, bd = r;
    for (const t of [...this.w.towers, ...this.w.cores]) {
      if (!t.alive || t.team !== u.team) continue;
      const d = Math.hypot(t.x - x, t.z - z);
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }

  // ---------------------------------------------------------- skills
  queueCast(slot, aim, target) {
    if (this.pending) return;
    this.pending = { slot, aim, target, at: this.w.time + this.D.react * (0.6 + this.w.rng() * 0.8) };
  }
  refreshAim(p) {
    // re-aim at cast time if we had a target (bots don't see the future perfectly)
    if (p.target && p.target.alive) return this.aimAt(this.h.def.skills[p.slot], p.target);
    return p.aim;
  }
  aimAt(s, t) {
    const w = this.w, h = this.h;
    if (s.aim === 'unit') return { targetId: t.id };
    if (s.aim === 'self') return {};
    const d = Math.hypot(t.x - h.x, t.z - h.z);
    const speed = (s.ai && s.ai.skillshot) || 0;
    const delay = (s.ai && s.ai.delay) || 0;
    const lt = (speed ? d / speed : 0) + delay;
    const lead = this.D.lead;
    let px = t.x + t.vx * lt * lead, pz = t.z + t.vz * lt * lead;
    if (s.aim === 'dir') {
      let ang = Math.atan2(px - h.x, pz - h.z) + (w.rng() - 0.5) * 2 * this.D.aimErr;
      return { dx: Math.sin(ang), dz: Math.cos(ang) };
    }
    const err = this.D.aimErr * 2.5;
    return { x: px + (w.rng() - 0.5) * err, z: pz + (w.rng() - 0.5) * err };
  }
  ready(i) {
    const h = this.h, s = h.def.skills[i];
    return h.skills[i].rank > 0 && h.skills[i].cd <= 0 && h.mana >= this.w.skillCost(h, i) && h.canCast();
  }
  combo(t) {
    const w = this.w, h = this.h;
    if (this.pending || w.rng() > this.D.skillChance) return;
    const d = w.dist(h, t);
    const hpP = h.hp / h.st.maxHp;
    for (const i of [2, 0, 1]) {
      if (!this.ready(i)) continue;
      const s = h.def.skills[i], ai = s.ai || {};
      const range = (ai.range || s.range || s.radius || 4) + (s.aim === 'self' ? 0 : t.radius);
      if (ai.minHeroes) {
        const r = s.radius || 3;
        const cx = s.aim === 'self' ? h.x : t.x, cz = s.aim === 'self' ? h.z : t.z;
        const cnt = w.enemies(h, cx, cz, r + 0.5, { heroes: true, visible: true }).length;
        if (cnt < ai.minHeroes) continue;
      }
      switch (ai.type) {
        case 'damage': case 'cc':
          if (d <= range) { this.queueCast(i, this.aimAt(s, t), t); return; }
          break;
        case 'engage':
          if (d <= range && (this.myP / Math.max(1, this.enP) > 0.9 || t.hp / t.st.maxHp < 0.5)) { this.queueCast(i, this.aimAt(s, t), t); return; }
          break;
        case 'execute':
          if (d <= range && (t.hp / t.st.maxHp < (ai.hpBelow || 0.5) || this.burstEstimate(t) > t.hp)) { this.queueCast(i, { targetId: t.id }, t); return; }
          break;
        case 'buff':
          if (d < 9 && d > 2.5) { this.queueCast(i, {}); return; }
          break;
        case 'escape':
          if (ai.alsoKite && d < 3 && t.st.range < 3) {
            const dx = h.x - t.x, dz = h.z - t.z, l = Math.hypot(dx, dz) || 1;
            this.queueCast(i, { dx: dx / l, dz: dz / l }); return;
          }
          if (ai.alsoKite && d > h.st.range + 1 && d < h.st.range + 4.5 && t.hp / t.st.maxHp < 0.35) {
            this.queueCast(i, { dx: (t.x - h.x) / d, dz: (t.z - h.z) / d }); return;
          }
          break;
        case 'heal': {
          const al = w.allies(h, h.x, h.z, s.range + 1, { heroes: true }).sort((a, b) => a.hpPct - b.hpPct)[0];
          if (al && al.hpPct < 0.7) { this.queueCast(i, { x: al.x, z: al.z }); return; }
          if (d <= range) { this.queueCast(i, this.aimAt(s, t), t); return; }
          break;
        }
        case 'save': {
          const hurt = w.allies(h, h.x, h.z, s.radius || 7, { heroes: true }).filter((a) => a.hpPct < 0.45);
          if (hurt.length || (hpP < 0.4)) { this.queueCast(i, {}); return; }
          break;
        }
      }
    }
  }
  farmSkills(targets) {
    // use wave-clear skills on clustered minions / monsters
    const w = this.w, h = this.h;
    if (this.pending || !targets.length) return;
    if (h.st.maxMana > 0 && h.mana < h.st.maxMana * 0.45 && this.role !== 'jungle') return;
    for (const i of [0, 1]) {
      if (!this.ready(i)) continue;
      const s = h.def.skills[i];
      if (!s.ai || !(s.ai.wave || this.role === 'jungle')) continue;
      if (s.ai.type === 'heal' || s.ai.type === 'buff' || s.ai.type === 'escape' || s.ai.type === 'save') continue;
      if (s.aim === 'unit' && this.role !== 'jungle') continue;
      const t = targets[0];
      const d = w.dist(h, t);
      const range = s.range || s.radius || 3;
      if (d > range + 0.5) continue;
      if (targets.length < 2 && t.kind !== 'monster') continue;
      this.queueCast(i, this.aimAt(s, t));
      return;
    }
  }
  useSpellLogic() {
    const w = this.w, h = this.h;
    if (h.spellCd > 0 || this.pending) return;
    const hpP = h.hp / h.st.maxHp;
    const sp = h.spell;
    if (sp === 'frostbite') {
      let best = null;
      w.query(h.x, h.z, 6, (u) => {
        if (!u.alive || u.kind !== 'monster') return;
        const dmg = (520 + 80 * h.level) * 1.15;
        const important = u.boss || u.mtype === 'owl' || u.mtype === 'stag' || u.mtype === 'wolfBig' || u.mtype === 'beetleBig';
        if (important && u.hp <= dmg * (120 / 120)) best = u;
      });
      if (best) this.pending = { kind: 'spell', aim: {}, at: w.time + this.D.react * 0.5 };
      return;
    }
    const enemies = w.enemies(h, h.x, h.z, 8, { heroes: true, visible: true });
    if (!enemies.length) return;
    const closest = enemies.reduce((a, b) => (w.dist(a, h) < w.dist(b, h) ? a : b));
    if (sp === 'execute') {
      const t = enemies.find((e) => w.dist(e, h) < 5.5 && e.hp < 100 + 10 * h.level + 0.13 * (e.st.maxHp - e.hp));
      if (t) this.pending = { kind: 'spell', aim: {}, at: w.time + this.D.react };
    } else if (sp === 'blink') {
      if (hpP < 0.22 && w.dist(closest, h) < 5) {
        const f = BASES[h.team].fountain; const [dx, dz] = this.steerDir(f[0], f[1]);
        this.pending = { kind: 'spell', aim: { dx, dz }, at: w.time + this.D.react };
      } else if (this.fightT && this.fightT.hp / this.fightT.st.maxHp < 0.15 && w.dist(this.fightT, h) > h.st.range + 1 && w.dist(this.fightT, h) < h.st.range + 4.5) {
        const t = this.fightT; this.pending = { kind: 'spell', aim: { dx: t.x - h.x, dz: t.z - h.z }, at: w.time + this.D.react };
      }
    } else if ((sp === 'mend' || sp === 'aegis') && hpP < 0.3) this.pending = { kind: 'spell', aim: {}, at: w.time + this.D.react };
    else if (sp === 'purify' && (h.cc.stun > 0.4 || h.cc.root > 0.6) && hpP < 0.7) this.pending = { kind: 'spell', aim: {}, at: w.time + this.D.react * 0.5 };
    else if (sp === 'sprint' && hpP < 0.25) this.pending = { kind: 'spell', aim: {}, at: w.time + this.D.react };
  }

  // ---------------------------------------------------------- economy
  shop() {
    const w = this.w, h = this.h;
    if (!this.build) this.build = effectiveBuild(h.def.build, w.itemAvail);
    const build = this.build;
    // fill missing from available catalog
    for (const id of build) {
      if (h.items.includes(id)) continue;
      const it = ITEM_BY_ID[id];
      // buy components first if the whole item is too expensive
      if (w.canBuy(h, id)) { w.buy(h, id); return; }
      if (it.from) {
        for (const c of it.from) {
          const have = h.items.filter((x) => x === c).length;
          const need = it.from.filter((x) => x === c).length;
          if (have < need && w.canBuy(h, c) && h.items.length < 6) { w.buy(h, c); return; }
        }
      }
      return; // wait for gold for this item
    }
    // full build done: nothing
  }

  // ---------------------------------------------------------- macro behaviours
  laneFront(lane) {
    // progress of the most advanced allied minion (team-relative 0..1)
    const w = this.w, h = this.h;
    let best = -1, bestEnemy = 2;
    for (const m of w.minions) {
      if (!m.alive || m.lane !== lane) continue;
      let p = laneProgress(lane, m.x, m.z);
      if (h.team === 1) p = 1 - p;
      if (m.team === h.team) { if (p > best) best = p; } else if (p < bestEnemy) bestEnemy = p;
    }
    return { mine: best, enemy: bestEnemy };
  }
  towerLimit(lane) {
    // progress where the first alive enemy tower's range starts (team-relative)
    const w = this.w, h = this.h;
    let lim = 1;
    for (const t of w.towers) {
      if (!t.alive || t.team === h.team || t.lane !== lane) continue;
      let p = laneProgress(lane, t.x, t.z);
      if (h.team === 1) p = 1 - p;
      lim = Math.min(lim, p - (t.st.range + 2.2) / LANE_LEN[lane]);
    }
    return lim;
  }
  ownTowerP(lane) {
    const w = this.w, h = this.h;
    let best = 0.05;
    for (const t of w.towers) {
      if (!t.alive || t.team !== h.team || t.lane !== lane) continue;
      let p = laneProgress(lane, t.x, t.z);
      if (h.team === 1) p = 1 - p;
      best = Math.max(best, p);
    }
    return best;
  }
  lanePos(lane, p) { return lanePoint(lane, this.h.team === 1 ? 1 - p : p); }
  doLane(lane) {
    const w = this.w, h = this.h;
    const { mine } = this.laneFront(lane);
    const lim = this.towerLimit(lane);
    const back = this.ranged ? 0.035 : 0.018;
    let p;
    if (mine >= 0) {
      p = mine - back;
      const towerTanked = this.enemyTowerTanked(lane);
      if (!towerTanked) p = Math.min(p, lim);
    } else p = Math.min(this.ownTowerP(lane) + 0.02, lim);
    const [gx, gz] = this.lanePos(lane, p);
    // targets around
    const targets = this.farmTargets(h.st.range + 3.5);
    if (targets.length) {
      const t = targets[0];
      if (t.kind === 'tower' || t.kind === 'core') { this.mode = 'tower'; this.fightT = t; return; }
      this.mode = 'farm'; this.fightT = t; this.farmSkills(targets);
      return;
    }
    this.setGoal(gx + this.idleOffset, gz - this.idleOffset * 0.5, 'lane', 1.8);
  }
  enemyTowerTanked(lane) {
    const w = this.w, h = this.h;
    for (const t of [...w.towers, ...w.cores]) {
      if (!t.alive || t.team === h.team) continue;
      if (t.kind === 'tower' && t.lane !== lane) continue;
      if (Math.hypot(t.x - h.x, t.z - h.z) > 18) continue;
      if (t.target && t.target.alive && t.target.kind === 'minion' && t.target.team === h.team) {
        let cnt = 0;
        w.query(t.x, t.z, t.st.range, (u) => { if (u.alive && u.kind === 'minion' && u.team === h.team) cnt++; });
        return cnt >= 2 || (t.target.minionType === 'titan');
      }
    }
    return false;
  }
  farmTargets(r) {
    const w = this.w, h = this.h;
    const out = [];
    w.query(h.x, h.z, r + 1, (u) => {
      if (!u.alive || u.team === h.team || u.untarget || !w.visibleTo(u, h.team)) return;
      if (u.kind === 'monster') return;
      if (u.kind === 'hero') return;
      if (Math.hypot(u.x - h.x, u.z - h.z) > r + u.radius) return;
      if (u.kind === 'tower' || u.kind === 'core') {
        if (u.invuln) return;
        if (!this.enemyTowerTanked(u.lane || 'mid') && !(u.kind === 'core' && this.enemyTowerTanked('mid'))) return;
      } else {
        // don't walk into enemy tower range for minions unless tanked
        const t = this.nearestEnemyStructure(u.x, u.z, 12);
        if (t && w.inRange(t, u, t.st.range - 0.5) && !this.enemyTowerTanked(t.lane || 'mid')) return;
      }
      out.push(u);
    });
    out.sort((a, b) => {
      const sa = (a.kind === 'tower' || a.kind === 'core') ? 1e5 : a.hp;
      const sb = (b.kind === 'tower' || b.kind === 'core') ? 1e5 : b.hp;
      return sa - sb;
    });
    // prefer minions over structures but attack structures when no minions
    const mins = out.filter((u) => u.kind === 'minion');
    if (mins.length) return mins;
    return out;
  }
  doJungle() {
    const w = this.w, h = this.h;
    // stay in jungle; clear the camp we are at
    if (this.campTarget) {
      const c = this.campTarget;
      const alive = c.units.filter((u) => u.alive);
      if (!c.up || !alive.length) this.campTarget = null;
      else {
        const d = Math.hypot(c.p[0] - h.x, c.p[1] - h.z);
        if (d < 9) {
          alive.sort((a, b) => a.hp - b.hp);
          const t = alive.find((u) => u.target === h) || alive[0];
          this.mode = 'camp'; this.fightT = t;
          this.farmSkills(alive);
          return true;
        }
        this.setGoal(c.p[0], c.p[1], 'jungle', 2);
        return true;
      }
    }
    // pick next camp
    let best = null, bs = Infinity;
    for (const c of w.camps) {
      const own = c.side === h.team;
      if (!own && w.time < 300) continue;
      if (!c.up) continue;
      const d = Math.hypot(c.p[0] - h.x, c.p[1] - h.z);
      let s = d + (own ? 0 : 25) + (c.kind === 'azure' || c.kind === 'ember' ? -10 : 0);
      if (s < bs) { bs = s; best = c; }
    }
    // gank opportunity
    const gank = this.findGank();
    if (gank && (!best || bs > 20 || h.level >= 4)) { this.setGoal(gank.x, gank.z, 'gank', 2); return true; }
    if (best) { this.campTarget = best; this.setGoal(best.p[0], best.p[1], 'jungle', 2); return true; }
    if (gank) { this.setGoal(gank.x, gank.z, 'gank', 2); return true; }
    return false; // fall back to laning
  }
  findGank() {
    const w = this.w, h = this.h;
    if (h.level < 3) return null;
    let best = null, bs = Infinity;
    for (const e of w.heroes) {
      if (!e.alive || e.team === h.team || !w.visibleTo(e, h.team)) continue;
      const d = w.dist(e, h);
      if (d > 45) continue;
      const allyNear = w.heroes.some((a) => a.alive && a.team === h.team && a !== h && w.dist(a, e) < 10);
      const tTower = this.nearestAllyStructureOf(e, e.x, e.z, 9);
      if (tTower) continue;
      const s = d * 0.6 + (e.hp / e.st.maxHp) * 30 - (allyNear ? 12 : 0);
      if (s < bs) { bs = s; best = e; }
    }
    return best && bs < 40 ? best : null;
  }
  doRoam() {
    const w = this.w, h = this.h;
    // follow the gold laner early, then whoever is fighting
    const allies = w.heroes.filter((a) => a.alive && a.team === h.team && a !== h);
    let follow = null;
    if (w.time < 420) follow = allies.find((a) => a.brain ? a.brain.role === 'gold' : a.role === 'gold');
    if (!follow || w.dist(follow, h) > 60) {
      let bs = Infinity;
      for (const a of allies) {
        const engaged = a.brain && a.brain.mode === 'fight' ? -20 : 0;
        const s = w.dist(a, h) + engaged + (a.role === 'jungle' ? 10 : 0);
        if (s < bs) { bs = s; follow = a; }
      }
    }
    if (!follow) return false;
    const targets = this.farmTargets(h.st.range + 1.5).filter((t) => t.kind !== 'minion' || t.hp < h.st.atk * 1.2);
    if (targets.length && w.dist(follow, h) < 9) { this.mode = targets[0].kind === 'tower' ? 'tower' : 'farm'; this.fightT = targets[0]; return true; }
    const f = BASES[h.team].fountain;
    const dx = f[0] - follow.x, dz = f[1] - follow.z, l = Math.hypot(dx, dz) || 1;
    this.setGoal(follow.x + (dx / l) * 2.5 + this.idleOffset, follow.z + (dz / l) * 2.5, 'roam', 2.2);
    return true;
  }
  doObjective(ord) {
    const w = this.w, h = this.h;
    const boss = ord.boss;
    if (!boss || !boss.alive) return false;
    const d = w.dist(boss, h);
    if (d < h.st.range + boss.radius + 2) {
      this.mode = 'camp'; this.fightT = boss;
      this.farmSkills([boss]);
      return true;
    }
    this.setGoal(boss.x, boss.z, 'obj', boss.radius + h.st.range);
    return true;
  }
  doPush(ord) {
    const w = this.w, h = this.h;
    if (ord.type === 'push' && ord.lane) {
      const lane = ord.lane;
      const targets = this.farmTargets(h.st.range + 4);
      if (targets.length) { const t = targets[0]; this.mode = t.kind === 'tower' || t.kind === 'core' ? 'tower' : 'farm'; this.fightT = t; this.farmSkills(targets); return true; }
      const { mine } = this.laneFront(lane);
      const lim = this.towerLimit(lane);
      const tanked = this.enemyTowerTanked(lane);
      let p = mine >= 0 ? mine - 0.02 : this.ownTowerP(lane);
      if (!tanked && !ord.dive) p = Math.min(p, lim);
      if (ord.dive) {
        const t = this.nearestEnemyStructure(h.x, h.z, 30);
        if (t && !t.invuln) { this.mode = 'tower'; this.fightT = t; return true; }
        p = Math.max(p, lim + 0.06);
      }
      const [gx, gz] = this.lanePos(lane, p);
      this.setGoal(gx + this.idleOffset, gz, 'push', 2);
      return true;
    }
    if (ord.x !== undefined) {
      const targets = this.farmTargets(h.st.range + 2);
      if (targets.length && w.dist(h, { x: ord.x, z: ord.z }) < 14) { this.mode = 'farm'; this.fightT = targets[0]; return true; }
      this.setGoal(ord.x + this.idleOffset * 2, ord.z - this.idleOffset, ord.type, 2.5);
      return true;
    }
    return false;
  }
}

export class TeamBrain {
  constructor(w, team) { this.w = w; this.team = team; this.orders = new Map(); this.pushLane = null; this.pushUntil = 0; }
  orderFor(h) { return this.orders.get(h.id) || this.orders.get('all') || null; }
  think() {
    const w = this.w, T = this.team;
    this.orders.clear();
    const mine = w.heroes.filter((h) => h.team === T);
    const theirs = w.heroes.filter((h) => h.team !== T);
    const myAlive = mine.filter((h) => h.alive);
    const enAlive = theirs.filter((h) => h.alive);
    const bots = myAlive.filter((h) => h.brain);
    if (!bots.length) return;
    const goldLead = mine.reduce((s, h) => s + h.goldEarned, 0) - theirs.reduce((s, h) => s + h.goldEarned, 0);
    const enemiesNear = (x, z, r) => enAlive.filter((e) => w.visibleTo(e, T) && Math.hypot(e.x - x, e.z - z) < r).length;

    // defend base structures under siege
    for (const t of w.towers.concat(w.cores)) {
      if (!t.alive || t.team !== T) continue;
      const threat = enemiesNear(t.x, t.z, 12);
      if (threat >= 2 || (t.tier === 2 && threat >= 1) || t.kind === 'core' && threat >= 1) {
        const defenders = bots.filter((h) => Math.hypot(h.x - t.x, h.z - t.z) < 45 && h.hp > h.st.maxHp * 0.35);
        for (const h of defenders) this.orders.set(h.id, { type: 'defend', x: t.x, z: t.z });
        if (defenders.length) return;
      }
    }
    // titan: commit when enemies are down or we are far ahead
    const titan = w.bosses.titan.unit;
    if (titan && titan.alive) {
      const contest = enemiesNear(titan.x, titan.z, 18);
      if ((enAlive.length <= 2 && myAlive.length >= 3) || (myAlive.length >= 4 && goldLead > 3500 && contest === 0) || (titan.hp < titan.st.maxHp * 0.6 && myAlive.length >= enAlive.length)) {
        for (const h of bots) this.orders.set(h.id, { type: 'obj', boss: titan });
        return;
      }
    }
    // tortoise: jungler + roamer (+ the closest laner later)
    const tort = w.bosses.tortoise.unit;
    if (tort && tort.alive) {
      const contest = enemiesNear(tort.x, tort.z, 16);
      const jg = bots.find((h) => h.brain.role === 'jungle');
      if (jg && contest === 0 && jg.level >= 3 && myAlive.length >= enAlive.length - 1) {
        const team = bots.filter((h) => h.brain.role === 'jungle' || h.brain.role === 'roam' || (Math.hypot(h.x - tort.x, h.z - tort.z) < 25 && w.time > 360));
        for (const h of team) this.orders.set(h.id, { type: 'obj', boss: tort });
      }
    }
    // push after winning fights / late game grouping
    const late = w.time > 720;
    if (enAlive.length <= myAlive.length - 2 || (late && myAlive.length >= enAlive.length)) {
      if (!this.pushLane || w.time > this.pushUntil || !this.laneHasTargets(this.pushLane)) {
        this.pushLane = this.chooseLane();
        this.pushUntil = w.time + 25;
      }
      const dive = enAlive.length <= 1 || (enAlive.length <= 2 && myAlive.length >= 4);
      for (const h of bots) if (!this.orders.has(h.id) && (late || h.brain.role !== 'jungle' || w.time > 500)) this.orders.set(h.id, { type: 'push', lane: this.pushLane, dive });
      return;
    }
    // mid game: support the titan avatar if alive
    const avatar = w.minions.find((m) => m.alive && m.minionType === 'titan' && m.team === T);
    if (avatar) for (const h of bots) if (!this.orders.has(h.id)) this.orders.set(h.id, { type: 'push', lane: avatar.lane, dive: false });
  }
  laneHasTargets(lane) {
    return this.w.towers.some((t) => t.alive && t.team !== this.team && t.lane === lane) || this.w.cores.some((c) => c.alive && c.team !== this.team && !c.invuln);
  }
  chooseLane() {
    const w = this.w;
    let best = 'mid', bs = Infinity;
    for (const lane of ['top', 'mid', 'bot']) {
      const ts = w.towers.filter((t) => t.alive && t.team !== this.team && t.lane === lane);
      if (!ts.length) { if (bs > 50) { best = lane; bs = 50; } continue; }
      const front = ts.reduce((a, b) => (a.tier < b.tier ? a : b));
      const s = front.tier * 30 + front.hp / 200 + (lane === 'mid' ? -5 : 0);
      if (s < bs) { bs = s; best = lane; }
    }
    return best;
  }
}
