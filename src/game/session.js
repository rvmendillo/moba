// A running match: local single-player (or WiFi host) simulation, or a WiFi client view.
import { World, DT } from '../sim/world.js';
import { ClientState } from './state.js';
import { GameView } from '../render/gameview.js';
import { Hud } from '../ui/hud.js';
import { HEROES, HERO_BY_ID, ROLE_LANE } from '../data/heroes.js';
import { ITEMS, PETS, SPELLS } from '../data/items.js';
import { audio } from '../audio/audio.js';

const BOT_NAMES = ['Snowpaw', 'Rimeheart', 'Glacia', 'Frostbyte', 'Iceberg', 'Aurora', 'Blizzard', 'Hailstorm', 'Sleet', 'Tundra', 'Flurry', 'Icicle', 'Northwind', 'Shiver', 'Crystal', 'Polaris'];
const ROLE_CLASS = { gold: ['Marksman'], exp: ['Fighter', 'Tank'], mid: ['Mage'], jungle: ['Assassin', 'Fighter'], roam: ['Support', 'Tank'] };
const ROLES = ['exp', 'jungle', 'mid', 'gold', 'roam'];

// Build a 5v5 roster: humans keep their picks, bots fill the remaining roles.
export function buildRoster(humans, rng = Math.random, difficulty = 'normal') {
  const players = [];
  const names = [...BOT_NAMES].sort(() => rng() - 0.5);
  for (const team of [0, 1]) {
    const mine = humans.filter((p) => p.team === team);
    const used = new Set(mine.map((p) => p.heroId));
    const taken = new Set();
    for (const p of mine) {
      let role = ROLE_LANE[HERO_BY_ID[p.heroId].role];
      if (taken.has(role)) role = ROLES.find((r) => !taken.has(r)) || role;
      taken.add(role);
      players.push({ ...p, role, bot: false });
    }
    for (const role of ROLES) {
      if (taken.has(role) || players.filter((p) => p.team === team).length >= 5) continue;
      taken.add(role);
      const pool = HEROES.filter((h) => ROLE_CLASS[role].includes(h.role) && !used.has(h.id));
      const hero = pool.length ? pool[Math.floor(rng() * pool.length)] : HEROES.find((h) => !used.has(h.id));
      used.add(hero.id);
      players.push({ team, heroId: hero.id, role, bot: true, difficulty, name: names.pop() || hero.name, petId: PETS[Math.floor(rng() * PETS.length)].id, spellId: hero.spell });
    }
  }
  return players;
}

export class MatchSession {
  // mode: 'local' | 'host' | 'client'
  constructor(app, cfg, net = null) {
    this.app = app; this.cfg = cfg; this.net = net;
    this.mode = cfg.mode || 'local';
    this.ended = false;
    this.itemAvail = new Set(cfg.items || ITEMS.map((i) => i.id));
    this.accountLevel = cfg.accountLevel || 1;
    this.netAcc = 0; this.netEvents = []; this.inT = 0; this.lastIn = '';
    if (this.mode !== 'client') {
      this.world = new World({ players: cfg.players, seed: cfg.seed, items: cfg.items, difficulty: cfg.difficulty });
      const me = this.world.heroes[cfg.myIndex ?? 0];
      this.myHero = me;
      this.myId = me.id; this.myTeam = me.team;
      this.heroDef = me.def;
      this.spellIdx = SPELLS.findIndex((s) => s.id === me.spell);
      this.state = new ClientState(1 / 30);
      this.heroByNet = new Map();
      for (const h of this.world.heroes) if (h.netId) this.heroByNet.set(h.netId, h);
    } else {
      this.myId = cfg.myId; this.myTeam = cfg.myTeam;
      this.heroDef = HERO_BY_ID[cfg.heroId] || null;
      this.spellIdx = SPELLS.findIndex((s) => s.id === cfg.spellId);
      this.state = new ClientState(0.12);
    }
    this.view = new GameView(app.core, this.state, { myId: this.myId, myTeam: this.myTeam, overlayCanvas: app.ov, onEvent: (e) => this.onEvent(e) });
    this.view.zoom = app.profile.settings.zoom;
    if (this.world) { this.state.push(this.world.snapshot(true)); this.state.renderT = this.state.latestT; }
    this.hud = new Hud(app, this);
    audio.music('battle');
    if (this.mode === 'host' && net) net.onMessage = (from, msg) => this.onNet(from, msg);
    if (this.mode === 'client' && net) net.onMessage = (from, msg) => this.onNet(from, msg);
    this.acc = 0;
  }
  command(c) {
    if (this.mode === 'client') { this.net.send('host', { t: 'cmd', c }); return; }
    this.world.command(this.myHero, c);
  }
  onNet(from, msg) {
    if (this.mode === 'host') {
      const h = this.heroByNet.get(from);
      if (!h) return;
      if (msg.t === 'in') this.world.setInput(h, { mx: msg.mx, mz: msg.mz, atk: !!msg.atk, mode: msg.mode || 'auto' });
      else if (msg.t === 'cmd') this.world.command(h, msg.c);
      else if (msg.t === 'bye') { h.isBot = true; }
    } else if (this.mode === 'client') {
      if (msg.t === 'snap') {
        this.state.push(msg.s);
        if (this.state.renderT === 0) this.state.renderT = this.state.latestT - 0.12;
      } else if (msg.t === 'end') this.finish(msg.winner);
    }
  }
  onEvent(e) { this.hud.onEvent(e); this.sound(e); }
  sound(e) {
    const me = this.view.me;
    if (me) audio.listener(me.x, me.z, this.view.camYaw);
    switch (e[0]) {
      case 'sfx': audio.play(e[1], e[2], e[3]); break;
      case 'atk': { const p = this.view.unitPos(e[1]); if (p) audio.play(e[3] ? (p.kind === 2 || p.kind === 3 ? 'towerShot' : 'magic') : 'swing', p.x, p.z, p.kind === 1 ? 0.35 : 0.8); break; }
      case 'hit': { const p = this.view.unitPos(e[1]); if (p) audio.play(e[2] === 2 ? 'hitMetal' : 'hit', p.x, p.z, 0.5); break; }
      case 'gold': if (e[1] === this.myId) audio.play('coin', null, null, 0.4); break;
    }
  }
  frame(dt) {
    if (this.mode !== 'client') {
      const inp = this.hud.input;
      this.world.setInput(this.myHero, { mx: inp.mx, mz: inp.mz, atk: inp.atk, mode: inp.mode });
      this.acc += Math.min(dt, 0.25);
      let n = 0;
      while (this.acc >= DT && n < 6) {
        this.world.step();
        const snap = this.world.snapshot(true);
        this.state.push(snap);
        if (this.mode === 'host' && this.net) {
          this.netEvents.push(...snap.e);
          this.netAcc++;
          if (this.netAcc % 2 === 0) {
            const out = { ...snap, e: this.netEvents };
            if (this.netAcc % 4 !== 0) delete out.h;
            this.net.broadcast({ t: 'snap', s: out });
            this.netEvents = [];
          }
        }
        this.acc -= DT; n++;
      }
      if (this.world.over && !this.ended && !this.endT) { this.endT = this.app.time + 3.2; if (this.net) this.net.broadcast({ t: 'end', winner: this.world.winner }); }
      if (this.endT && this.app.time >= this.endT) this.finish(this.world.winner);
    } else {
      this.inT -= dt;
      const inp = this.hud.input;
      const key = `${inp.mx.toFixed(2)},${inp.mz.toFixed(2)},${inp.atk ? 1 : 0},${inp.mode}`;
      if (this.inT <= 0 || key !== this.lastIn) {
        this.inT = 0.1; this.lastIn = key;
        this.net.send('host', { t: 'in', mx: +inp.mx.toFixed(3), mz: +inp.mz.toFixed(3), atk: inp.atk ? 1 : 0, mode: inp.mode });
      }
      if (this.state.over >= 0 && !this.endT) this.endT = this.app.time + 3.2;
      if (this.endT && this.app.time >= this.endT) this.finish(this.state.over);
    }
    this.view.frame(dt);
    this.hud.frame(dt, this.app.fps);
  }
  render(dt) { this.view.render(dt); }
  surrender() {
    if (this.mode === 'client') { this.quit(); return; }
    this.world.over = true; this.world.winner = 1 - this.myTeam;
  }
  quit() { this.finish(-2); }
  finish(winner) {
    if (this.ended) return;
    this.ended = true;
    const me = this.state.hero(this.myId);
    const stats = this.state.heroList.map((h) => ({ ...h }));
    this.dispose();
    this.app.onMatchEnd({ winner, myTeam: this.myTeam, me, stats, quit: winner === -2 });
  }
  dispose() {
    this.hud.dispose();
    this.view.dispose();
    if (this.net && this.mode !== 'client') this.net.close?.();
  }
}
export { ROLES, PETS, SPELLS };
