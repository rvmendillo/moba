// In-match HUD: touch controls, skills with drag-to-aim, minimap, scoreboard, shop, settings, feed.
import { h, fmtTime } from './dom.js';
import { HEROES, skillText } from '../data/heroes.js';
import { ITEMS, ITEM_BY_ID, ITEM_CATS, SPELLS, effectiveBuild } from '../data/items.js';
import { F } from '../sim/world.js';
import { skillIcon, itemIcon, spellIcon, icon } from './icons.js';
import { Minimap } from './minimap.js';
import { AimIndicator } from '../render/aim.js';
import { audio } from '../audio/audio.js';

const ANN = {
  firstblood: ['FIRST BLOOD!', 'First blood!'], double: ['DOUBLE KILL!', 'Double kill!'], triple: ['TRIPLE KILL!', 'Triple kill!'], ultra: ['ULTRA KILL!', 'Ultra kill!'], avalanche: ['AVALANCHE!', 'Avalanche!'],
  spree: ['KILLING SPREE!', 'Killing spree!'], dominating: ['DOMINATING!', 'Dominating!'], unstoppable: ['UNSTOPPABLE!', 'Unstoppable!'], legendary: ['LEGENDARY!', 'Legendary!'], shutdown: ['SHUTDOWN!', 'Shutdown!'],
};
const STAT_NAMES = { hp: 'HP', mana: 'Mana', atk: 'Physical Attack', mag: 'Magic Power', armor: 'Physical Defense', mr: 'Magic Defense', as: 'Attack Speed', crit: 'Crit Chance', critDmg: 'Crit Damage', ls: 'Lifesteal', sv: 'Spell Vamp', cdr: 'Cooldown Reduction', ms: 'Movement Speed', apen: 'Physical Pen', apenP: 'Physical Pen', mpen: 'Magic Pen', mpenP: 'Magic Pen', hpReg: 'HP Regen', mpReg: 'Mana Regen' };
export function statLine(k, v) {
  const pct = ['as', 'crit', 'critDmg', 'ls', 'sv', 'cdr', 'apenP', 'mpenP'].includes(k);
  const val = k === 'ms' ? Math.round(v * 40) : pct ? Math.round(v * 100) + '%' : v;
  return `+${val} ${STAT_NAMES[k] || k}`;
}

export class Hud {
  constructor(app, session) {
    this.app = app; this.s = session;
    this.state = session.state; this.view = session.view;
    this.myId = session.myId; this.myTeam = session.myTeam;
    this.yaw = this.myTeam === 1 ? Math.PI : 0;
    this.input = { mx: 0, mz: 0, atk: false, mode: 'auto' };
    this.aimInd = new AimIndicator(this.view.scene, this.view.env);
    this.portraits = app.portraits;
    this.t = 0; this.uiT = 0; this.mmT = 0;
    this.panel = null;
    this.build();
  }
  // ---------------------------------------------------------------- DOM
  build() {
    const R = this.root = h('div.hud.fade-in');
    // minimap
    this.mmEl = h('div.minimap');
    R.append(this.mmEl);
    this.minimap = new Minimap(this.mmEl, this.myTeam, this.portraits);
    this.bindMinimap();
    // top bar
    this.tb = { blue: h('div', { style: { display: 'flex', gap: '3px' } }), red: h('div', { style: { display: 'flex', gap: '3px' } }) };
    this.scoreB = h('span.b', {}, '0'); this.scoreR = h('span.r', {}, '0'); this.clock = h('span.clock', {}, '0:00');
    R.append(h('div.topbar', {}, this.myTeam === 0 ? this.tb.blue : this.tb.red, h('div.score', {}, this.myTeam === 0 ? this.scoreB : this.scoreR, this.clock, this.myTeam === 0 ? this.scoreR : this.scoreB), this.myTeam === 0 ? this.tb.red : this.tb.blue));
    this.tbHeroes = new Map();
    // top right
    this.kda = h('div.chip', {}, '0/0/0');
    this.goldChip = h('div.chip', { style: { color: 'var(--gold)' } }, '0');
    R.append(h('div.topright', {}, this.kda, h('button.ibtn', { onclick: () => this.openScoreboard() }, '📊'), h('button.ibtn', { onclick: () => this.openPause() }, '⚙️')));
    this.fpsEl = h('div.fps');
    R.append(this.fpsEl);
    // shop
    this.shopGold = h('div.g', {}, '0');
    R.append(h('button.shopbtn', { onclick: () => this.openShop() }, h('div.e', {}, '🛍️'), this.shopGold));
    this.qbImg = h('img'); this.qbCost = h('div');
    this.qb = h('button.quickbuy', { onclick: () => this.quickBuy(), style: { background: 'none' } }, this.qbImg, this.qbCost);
    R.append(this.qb);
    // joystick
    this.joyZone = h('div.joyzone');
    this.joy = h('div.joy', {}, this.knob = h('div.knob'));
    this.joy.style.opacity = '0.45';
    R.prepend(this.joyZone); // keep the joystick zone beneath every button
    R.append(this.joy);
    this.bindJoystick();
    // skill buttons
    const def = this.s.heroDef || HEROES[this.myHero()?.def ?? 0];
    this.def = def;
    this.btns = [];
    def.skills.forEach((sk, i) => {
      const b = h(`div.sk.s${i}`, { style: { backgroundImage: `url(${skillIcon(sk)})` } }, h('div.cd'), h('div.lv'));
      const plus = h('div.plus', { style: { display: 'none' } }, '+');
      R.append(b, plus);
      this.btns.push({ el: b, cd: b.querySelector('.cd'), lv: b.querySelector('.lv'), plus, skill: sk });
      this.bindSkill(b, i);
      plus.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.s.command({ c: 'lvl', slot: i }); audio.play('levelUp'); plus.style.display = 'none'; });
    });
    this.atkBtn = h('div.sk.atk');
    R.append(this.atkBtn);
    this.bindHold(this.atkBtn, 'auto');
    const tmin = h('div.sk.tmin', {}, '🐺'), ttow = h('div.sk.ttow', {}, '🏰');
    R.append(tmin, ttow);
    this.bindHold(tmin, 'minion'); this.bindHold(ttow, 'tower');
    const hero = this.myHero();
    const sp = SPELLS[this.s.spellIdx >= 0 ? this.s.spellIdx : hero ? hero.spell : 0] || SPELLS[0];
    this.spellBtn = h('div.sk.spell', { style: { backgroundImage: `url(${spellIcon(sp)})` } }, h('div.cd'));
    R.append(this.spellBtn);
    this.bindSkill(this.spellBtn, 'spell');
    this.recallBtn = h('div.sk.small.recall', {}, '🏠');
    this.regenBtn = h('div.sk.small.regen', {}, '💚', h('div.cd'));
    R.append(this.recallBtn, this.regenBtn);
    this.recallBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.s.command({ c: 'recall' }); audio.play('click'); });
    this.regenBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.s.command({ c: 'regen' }); audio.play('click'); });
    this.cancelEl = h('div.cancel', {}, 'CANCEL');
    R.append(this.cancelEl);
    // feed / announcements / death
    this.feed = h('div.feed'); this.ann = h('div.announce'); this.death = h('div.deathmsg', { style: { display: 'none' } });
    R.append(this.feed, this.ann, this.death);
    this.app.ui.append(R);
    this.layoutPluses();
  }
  layoutPluses() {
    for (const b of this.btns) {
      const r = b.el.getBoundingClientRect();
      b.plus.style.left = (r.left + r.width / 2 - 14) + 'px';
      b.plus.style.top = (r.top - 30) + 'px';
    }
  }
  myHero() { return this.state.hero(this.myId); }
  toast(msg) {
    if (this.toastEl) this.toastEl.remove();
    this.toastEl = h('div.toast', {}, msg);
    this.root.append(this.toastEl);
    clearTimeout(this.toastTO);
    this.toastTO = setTimeout(() => this.toastEl && this.toastEl.remove(), 1400);
  }
  // ---------------------------------------------------------------- input
  screenToWorld(dx, dy) { const c = Math.cos(this.yaw); return [dx * c, dy * c]; }
  bindJoystick() {
    let id = null, ox = 0, oy = 0;
    const R = 58;
    const z = this.joyZone;
    const rest = () => { const r = z.getBoundingClientRect(); this.joy.style.left = (r.left + 110) + 'px'; this.joy.style.top = (r.bottom - 100) + 'px'; this.knob.style.transform = ''; this.joy.style.opacity = '0.45'; };
    requestAnimationFrame(rest);
    z.addEventListener('pointerdown', (e) => {
      if (id !== null) return;
      id = e.pointerId; z.setPointerCapture(id);
      ox = e.clientX; oy = e.clientY;
      this.joy.style.left = ox + 'px'; this.joy.style.top = oy + 'px'; this.joy.style.opacity = '1';
      audio.unlock();
    });
    z.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      let dx = e.clientX - ox, dy = e.clientY - oy;
      const l = Math.hypot(dx, dy);
      if (l > R) { ox += (dx / l) * (l - R); oy += (dy / l) * (l - R); this.joy.style.left = ox + 'px'; this.joy.style.top = oy + 'px'; dx = (dx / l) * R; dy = (dy / l) * R; }
      this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const k = Math.min(1, l / R);
      const n = l > 4 ? k / Math.max(1e-3, Math.min(l, R)) : 0;
      const [wx, wz] = this.screenToWorld(dx * n, dy * n);
      this.input.mx = wx; this.input.mz = wz;
    });
    const end = (e) => { if (e.pointerId !== id) return; id = null; this.input.mx = 0; this.input.mz = 0; rest(); };
    z.addEventListener('pointerup', end); z.addEventListener('pointercancel', end);
    window.addEventListener('resize', () => setTimeout(() => { rest(); this.layoutPluses(); }, 200));
    // keyboard support for desktop testing
    const keys = new Set();
    const upd = () => { let x = 0, y = 0; if (keys.has('w')) y -= 1; if (keys.has('s')) y += 1; if (keys.has('a')) x -= 1; if (keys.has('d')) x += 1; const l = Math.hypot(x, y) || 1; const [wx, wz] = this.screenToWorld(x / l, y / l); this.input.mx = x || y ? wx : 0; this.input.mz = x || y ? wz : 0; };
    this.onKey = (e) => {
      const k = e.key.toLowerCase();
      if (e.type === 'keydown') {
        if ('wasd'.includes(k) && k.length === 1) { keys.add(k); upd(); }
        else if (k === ' ' || k === 'j') this.input.atk = true;
        else if (k === '1' || k === '2' || k === '3') this.s.command({ c: 'cast', slot: +k - 1, aim: null });
        else if (k === 'f') this.s.command({ c: 'spell', aim: null });
        else if (k === 'b') this.s.command({ c: 'recall' });
        else if (k === 'p') this.openShop();
      } else {
        if ('wasd'.includes(k) && k.length === 1) { keys.delete(k); upd(); }
        else if (k === ' ' || k === 'j') this.input.atk = false;
      }
    };
    window.addEventListener('keydown', this.onKey); window.addEventListener('keyup', this.onKey);
  }
  bindHold(el, mode) {
    let id = null;
    el.addEventListener('pointerdown', (e) => { e.stopPropagation(); id = e.pointerId; el.setPointerCapture(id); this.input.atk = true; this.input.mode = mode; el.style.transform = 'scale(0.92)'; audio.unlock(); });
    const end = (e) => { if (e.pointerId !== id) return; id = null; this.input.atk = false; this.input.mode = 'auto'; el.style.transform = ''; };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }
  bindSkill(el, slot) {
    let A = null;
    const isSpell = slot === 'spell';
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (A) return;
      const hero = this.myHero(); if (!hero) return;
      const sk = isSpell ? null : this.def.skills[slot];
      const sp = SPELLS[hero.spell];
      if (!isSpell && hero.ranks[slot] === 0) { this.toast('Skill not learned yet'); audio.play('error'); return; }
      const cd = isSpell ? hero.spellCd : hero.cds[slot];
      if (cd > 0) { this.toast('On cooldown'); audio.play('error'); return; }
      const r = el.getBoundingClientRect();
      A = { id: e.pointerId, cx: r.left + r.width / 2, cy: r.top + r.height / 2, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, sk, sp, aim: null, cancel: false };
      el.setPointerCapture(e.pointerId);
      el.style.transform = 'scale(0.92)';
      this.cancelEl.classList.add('show');
      this.updateAim(A);
    });
    el.addEventListener('pointermove', (e) => {
      if (!A || e.pointerId !== A.id) return;
      A.dx = e.clientX - A.x0; A.dy = e.clientY - A.y0;
      const cr = this.cancelEl.getBoundingClientRect();
      A.cancel = e.clientX > cr.left - 6 && e.clientX < cr.right + 6 && e.clientY > cr.top - 6 && e.clientY < cr.bottom + 6;
      this.cancelEl.classList.toggle('hot', A.cancel);
      this.updateAim(A);
    });
    const end = (e) => {
      if (!A || e.pointerId !== A.id) return;
      el.style.transform = '';
      this.cancelEl.classList.remove('show', 'hot');
      this.aimInd.hide();
      const drag = Math.hypot(A.dx, A.dy);
      if (!A.cancel && e.type !== 'pointercancel') {
        const aim = drag > 14 ? A.aim : null;
        if (isSpell) this.s.command({ c: 'spell', aim });
        else this.s.command({ c: 'cast', slot, aim });
        if (this.app.profile.settings.haptics) this.app.haptic('light');
      }
      A = null;
    };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }
  updateAim(A) {
    const me = this.view.me;
    if (!me) return;
    const drag = Math.hypot(A.dx, A.dy);
    const maxDrag = 95;
    const [wx, wz] = this.screenToWorld(A.dx, A.dy);
    const l = Math.hypot(wx, wz) || 1;
    const dx = wx / l, dz = wz / l;
    const k = Math.min(1, drag / maxDrag);
    const o = { hx: me.x, hz: me.z, cancel: A.cancel };
    if (A.sk) {
      const s = A.sk;
      o.range = s.range || s.radius;
      if (s.aim === 'dir') {
        let ddx = dx, ddz = dz;
        if (drag < 14) { const t = this.nearestEnemy(me, s.range); if (t) { const L = Math.hypot(t.x - me.x, t.z - me.z) || 1; ddx = (t.x - me.x) / L; ddz = (t.z - me.z) / L; } else { ddx = Math.sin(me.facing); ddz = Math.cos(me.facing); } }
        Object.assign(o, { type: 'dir', dx: ddx, dz: ddz, len: s.range, width: s.width || 1.2, cone: ['scatter', 'sleep'].includes(s.icon) });
        A.aim = { dx: ddx, dz: ddz };
      } else if (s.aim === 'point') {
        let x = me.x + dx * s.range * k, z = me.z + dz * s.range * k;
        if (drag < 14) { const t = this.nearestEnemy(me, s.range); if (t) { x = t.x; z = t.z; } }
        Object.assign(o, { type: 'point', x, z, radius: s.radius || 1.5 });
        A.aim = { x, z };
      } else if (s.aim === 'unit') {
        const px = me.x + dx * s.range * k, pz = me.z + dz * s.range * k;
        const t = this.nearestEnemy({ x: drag < 14 ? me.x : px, z: drag < 14 ? me.z : pz }, s.range + 2, me, s.range + 0.5, s.heroOnly);
        if (t) { Object.assign(o, { type: 'unit', x: t.x, z: t.z, radius: 0.9 }); A.aim = { targetId: t.id }; }
        else { o.type = null; A.aim = null; }
      } else { Object.assign(o, { type: 'self', radius: s.radius || 1.2 }); A.aim = {}; }
    } else if (A.sp) {
      if (A.sp.aim === 'dir') { o.range = A.sp.range; Object.assign(o, { type: 'dir', dx, dz, len: A.sp.range, width: 1 }); A.aim = drag > 14 ? { dx, dz } : null; }
      else { o.range = A.sp.range || 0; Object.assign(o, { type: 'self', radius: A.sp.range || 1.5 }); A.aim = {}; }
    }
    this.aimInd.show(o);
  }
  nearestEnemy(p, r, from, maxR, heroOnly) {
    let best = null, bd = r;
    const snap = this.view.lastSample;
    if (!snap) return null;
    for (const u of snap.units) {
      if (u.team === this.myTeam || !(u.flags & F.alive) || u.kind === 2 || u.kind === 3) continue;
      if (!this.state.visibleTo(u, this.myTeam)) continue;
      if (heroOnly && u.kind !== 0) continue;
      if (from && Math.hypot(u.x - from.x, u.z - from.z) > maxR) continue;
      const d = Math.hypot(u.x - p.x, u.z - p.z) - (u.kind === 0 ? 1.5 : 0);
      if (d < bd) { bd = d; best = u; }
    }
    return best;
  }
  bindMinimap() {
    let id = null;
    const at = (e) => { const r = this.mmEl.getBoundingClientRect(); const [x, z] = this.minimap.m2w(e.clientX - r.left, e.clientY - r.top); this.view.camOverride = { x, z }; };
    this.mmEl.addEventListener('pointerdown', (e) => { e.stopPropagation(); id = e.pointerId; this.mmEl.setPointerCapture(id); at(e); });
    this.mmEl.addEventListener('pointermove', (e) => { if (e.pointerId === id) at(e); });
    const end = (e) => { if (e.pointerId !== id) return; id = null; this.view.camOverride = null; };
    this.mmEl.addEventListener('pointerup', end); this.mmEl.addEventListener('pointercancel', end);
  }
  // ---------------------------------------------------------------- per frame
  frame(dt, fps) {
    this.t += dt;
    const hero = this.myHero();
    this.mmT -= dt;
    if (this.mmT <= 0 && this.view.lastSample) {
      this.mmT = 1 / 12;
      const units = this.view.lastSample.units;
      for (const u of units) u.isMe = u.id === this.myId;
      this.minimap.draw(units, this.state, this.view.core.camera);
    }
    this.uiT -= dt;
    if (this.uiT > 0 || !hero) return;
    this.uiT = 1 / 15;
    // top bar
    this.scoreB.textContent = this.state.kills[0]; this.scoreR.textContent = this.state.kills[1];
    this.clock.textContent = fmtTime(this.state.time);
    for (const hd of this.state.heroList) {
      let el = this.tbHeroes.get(hd.id);
      if (!el) { el = h(`div.tb-hero.${hd.team === 0 ? 'blue' : 'red'}`, { style: { backgroundImage: `url(${this.portraits[HEROES[hd.def].id]})` } }, h('div.rt')); (hd.team === 0 ? this.tb.blue : this.tb.red).append(el); this.tbHeroes.set(hd.id, el); }
      const dead = hd.respawn > 0;
      el.classList.toggle('dead', dead);
      el.firstChild.textContent = dead ? Math.ceil(hd.respawn) : '';
    }
    this.kda.textContent = `⚔️ ${hero.k}/${hero.d}/${hero.a}`;
    this.shopGold.textContent = hero.gold;
    this.fpsEl.textContent = this.app.profile.settings.fps ? `${fps | 0} fps · ${this.view.core.stats?.calls || 0} dc` : '';
    // skills
    const me = this.view.me;
    const mana = hero.mana;
    this.btns.forEach((b, i) => {
      const r = hero.ranks[i], cd = hero.cds[i], max = hero.cdMax[i] || 1;
      const s = b.skill;
      const cost = Array.isArray(s.mana) ? s.mana[Math.max(0, r - 1)] : s.mana;
      b.el.classList.toggle('off', r === 0 || cd > 0);
      b.el.classList.toggle('nomana', r > 0 && cd <= 0 && mana < cost);
      b.cd.style.background = cd > 0 ? `conic-gradient(rgba(5,10,30,0.72) ${(cd / max) * 360}deg, transparent 0)` : 'none';
      b.cd.textContent = cd > 0 ? (cd < 1 ? cd.toFixed(1) : Math.ceil(cd)) : '';
      const n = s.ult ? 3 : 6;
      if (b.lv.childElementCount !== n) { b.lv.innerHTML = ''; for (let k = 0; k < n; k++) b.lv.append(h('i')); }
      [...b.lv.children].forEach((d, k) => d.classList.toggle('on', k < r));
      b.plus.style.display = hero.canLevel[i] && !this.app.profile.settings.autoLevel ? 'grid' : 'none';
    });
    const scd = hero.spellCd;
    this.spellBtn.classList.toggle('off', scd > 0);
    this.spellBtn.firstChild.textContent = scd > 0 ? Math.ceil(scd) : '';
    this.regenBtn.classList.toggle('off', hero.regenCd > 0);
    this.regenBtn.lastChild.textContent = hero.regenCd > 0 ? Math.ceil(hero.regenCd) : '';
    // quick buy
    const next = this.nextBuild(hero);
    if (next) {
      const it = ITEM_BY_ID[next.id];
      this.qbImg.src = itemIcon(it); this.qbCost.textContent = next.cost;
      this.qb.style.display = 'block';
      this.qb.classList.toggle('ready', hero.gold >= next.cost);
      this.qbNext = next;
    } else this.qb.style.display = 'none';
    // death
    if (hero.respawn > 0) { this.death.style.display = 'block'; this.death.innerHTML = `Respawning in<b>${Math.ceil(hero.respawn)}</b>`; } else this.death.style.display = 'none';
    void me;
  }
  // next affordable step of the recommended build
  nextBuild(hero) {
    if (!this.build) this.build = effectiveBuild(HEROES[hero.def].build, this.s.itemAvail);
    const build = this.build;
    for (const id of build) {
      if (hero.items.includes(id)) continue;
      const it = ITEM_BY_ID[id];
      const full = this.costFor(hero, id);
      if (it.from) for (const c of it.from) { const need = it.from.filter((x) => x === c).length, have = hero.items.filter((x) => x === c).length; if (have < need && full > hero.gold) return { id: c, cost: this.costFor(hero, c) }; }
      return { id, cost: full };
    }
    return null;
  }
  costFor(hero, id) {
    const it = ITEM_BY_ID[id];
    let cost = it.cost;
    if (it.from) { const inv = [...hero.items]; for (const c of it.from) { const i = inv.indexOf(c); if (i >= 0) { cost -= ITEM_BY_ID[c].cost; inv.splice(i, 1); } } }
    return cost;
  }
  quickBuy() {
    const hero = this.myHero();
    if (!hero || !this.qbNext) return;
    if (hero.gold < this.qbNext.cost) { this.toast(`Need ${this.qbNext.cost - hero.gold} more gold`); audio.play('error'); return; }
    this.s.command({ c: 'buy', item: this.qbNext.id });
    audio.play('buy');
  }
  // ---------------------------------------------------------------- events
  onEvent(e) {
    switch (e[0]) {
      case 'kill': {
        const [, killerId, victimId, assists] = e;
        const k = this.state.hero(killerId), v = this.state.hero(victimId);
        if (!v) break;
        const kp = k ? this.portraits[HEROES[k.def].id] : null, vp = this.portraits[HEROES[v.def].id];
        const team = k ? k.team : 1 - v.team;
        const row = h(`div.kf.${team === this.myTeam ? 'blue' : 'red'}`, {}, kp ? h('img', { src: kp }) : h('span', {}, '🏰'), h('span', {}, '⚔️'), h('img', { src: vp }), assists && assists.length ? h('span', { style: { color: 'var(--dim)' } }, `+${assists.length}`) : null);
        this.feed.prepend(row);
        while (this.feed.childElementCount > 4) this.feed.lastChild.remove();
        setTimeout(() => row.remove(), 6000);
        if (victimId === this.myId) { this.app.haptic('heavy'); audio.play('heroDeath'); }
        else if (killerId === this.myId) { this.banner('ENEMY SLAIN', 'blue'); audio.play('kill'); this.app.haptic('medium'); }
        else if (!e.shownAnn && v.team === this.myTeam) { this.say('An ally has been slain'); }
        break;
      }
      case 'ann': {
        const [, code, team, a] = e;
        const ally = team === this.myTeam;
        const hd = this.state.hero(a);
        const who = hd ? hd.name : '';
        if (ANN[code]) { this.banner(ANN[code][0], ally ? 'blue' : 'red', who); this.say(ANN[code][1]); audio.play('announce'); }
        else if (code === 'tower') { const msg = ally ? 'Enemy turret destroyed!' : 'Our turret has been destroyed!'; this.banner(ally ? 'TURRET DESTROYED' : 'TURRET LOST', ally ? 'blue' : 'red'); this.say(msg); }
        else if (code === 'tortoise') { this.banner(ally ? 'TORTOISE SLAIN' : 'ENEMY SLEW THE TORTOISE', ally ? 'gold' : 'red', ally ? 'Your team gains gold, EXP and a shield' : ''); this.say(ally ? 'Your team has slain the Crystal Tortoise' : 'The enemy has slain the Crystal Tortoise'); }
        else if (code === 'titan') { this.banner(ally ? 'FROST TITAN DEFEATED' : 'ENEMY DEFEATED THE TITAN', ally ? 'gold' : 'red', ally ? 'The Titan Avatar marches with your minions' : 'Defend your base!'); this.say(ally ? 'The Frost Titan fights for your team' : 'The Frost Titan fights for the enemy'); }
        else if (code === 'tortoiseSpawn') { this.banner('CRYSTAL TORTOISE APPEARED', 'gold'); this.say('The Crystal Tortoise has appeared'); }
        else if (code === 'titanSpawn') { this.banner('THE FROST TITAN AWAKENS', 'gold'); this.say('The Frost Titan awakens'); }
        else if ((code === 'azureBuff' || code === 'emberBuff') && a === this.myId) this.toast(code === 'azureBuff' ? '💙 Azure blessing: faster cooldowns & mana' : '🔥 Ember blessing: attacks burn & slow');
        break;
      }
      case 'lvl': if (e[1] === this.myId) { audio.play('levelUp'); if (e[2] === 4 || e[2] === 8 || e[2] === 12) this.toast('Ultimate can be upgraded!'); } break;
      case 'buy': if (e[1] === this.myId) audio.play('buy'); break;
      case 'respawn': if (e[1] === this.myId) audio.play('respawn'); break;
    }
  }
  banner(text, color = 'blue', sub = '') {
    this.ann.innerHTML = '';
    this.ann.append(h(`div.big.${color}`, {}, text), sub ? h('div.sub', {}, sub) : null);
    clearTimeout(this.annTO);
    this.annTO = setTimeout(() => { this.ann.innerHTML = ''; }, 2600);
  }
  say(text) { if (this.app.profile.settings.voice) audio.speak(text); }
  // ---------------------------------------------------------------- panels
  closePanel() { if (this.panel) { this.panel.remove(); this.panel = null; } }
  openPanel(el) { this.closePanel(); this.panel = el; this.root.append(el); audio.play('open'); }
  openScoreboard() {
    const mk = () => {
      const rows = (team) => this.state.heroList.filter((x) => x.team === team).map((hd) => h(`tr${hd.id === this.myId ? '.me' : ''}`, {},
        h('td', {}, h('img.p', { src: this.portraits[HEROES[hd.def].id] })),
        h('td', {}, h('b', {}, hd.name), h('div', { style: { fontSize: '10px', color: 'var(--dim)' } }, `Lv ${hd.level} · ${HEROES[hd.def].name}`)),
        h('td', { style: { fontWeight: 800 } }, `${hd.k}/${hd.d}/${hd.a}`),
        h('td', { style: { color: 'var(--gold)' } }, '💰' + hd.goldEarned),
        h('td', {}, ...hd.items.map((id) => h('img.i', { src: itemIcon(ITEM_BY_ID[id]) }))),
        h('td', { style: { color: 'var(--dim)' } }, hd.respawn > 0 ? `☠ ${Math.ceil(hd.respawn)}s` : '')));
      return h('div.panel.glass.fade-in', {},
        h('button.btn.ghost.x', { onclick: () => this.closePanel() }, '✕'),
        h('div', { style: { display: 'flex', gap: '14px', alignItems: 'center' } }, h('b', { style: { fontSize: '18px' } }, 'Scoreboard'), h('span', { style: { color: '#6cc4ff', fontWeight: 900 } }, `Blue ${this.state.kills[0]}`), h('span', { style: { color: '#ff7083', fontWeight: 900 } }, `Red ${this.state.kills[1]}`), h('span', { style: { color: 'var(--dim)' } }, fmtTime(this.state.time))),
        h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', overflow: 'auto' } },
          h('table.sb-table', {}, h('tbody', {}, ...rows(0))), h('table.sb-table', {}, h('tbody', {}, ...rows(1)))));
    };
    this.openPanel(mk());
  }
  openShop() {
    const hero = this.myHero(); if (!hero) return;
    let cat = 'rec', sel = null;
    const avail = this.s.itemAvail;
    const L = this.s.accountLevel;
    const P = h('div.panel.glass.fade-in.shop');
    const render = () => {
      const hero = this.myHero();
      P.innerHTML = '';
      const tabs = h('div.tabs', {}, ...[['rec', '⭐ Recommended'], ...ITEM_CATS.map((c) => [c.id, c.name])].map(([id, name]) => h(`button.tab${cat === id ? '.on' : ''}`, { onclick: () => { cat = id; render(); } }, name)));
      const list = cat === 'rec' ? effectiveBuild(HEROES[hero.def].build, avail).flatMap((id) => [...(ITEM_BY_ID[id].from || []), id]).filter((v, i, a) => a.indexOf(v) === i).map((id) => ITEM_BY_ID[id]) : ITEMS.filter((i) => i.cat === cat);
      const grid = h('div.items', {}, ...list.map((it) => {
        const locked = !avail.has(it.id);
        const cost = this.costFor(hero, it.id);
        const el = h(`div.it${sel === it.id ? '.on' : ''}${locked ? '.lock' : ''}${!locked && cost > hero.gold ? '.cant' : ''}`, { onclick: () => { sel = it.id; render(); } }, h('img', { src: itemIcon(it) }), locked ? `Lv ${it.unlock}` : cost);
        return el;
      }));
      const inv = h('div.inv', {}, ...[0, 1, 2, 3, 4, 5].map((i) => { const id = hero.items[i]; return h(`div.slot${sel === 'slot' + i ? '.on' : ''}`, { style: id ? { backgroundImage: `url(${itemIcon(ITEM_BY_ID[id])})` } : {}, onclick: () => { if (id) { sel = 'slot' + i; render(); } } }); }));
      let detail;
      if (sel && sel.startsWith('slot')) {
        const i = +sel.slice(4), id = hero.items[i];
        const it = ITEM_BY_ID[id];
        detail = it ? h('div.detail', {}, h('h3', {}, it.name), ...Object.entries(it.stats).map(([k, v]) => h('div.st', {}, statLine(k, v))), it.pdesc ? h('div.ps', {}, it.pdesc) : null, h('button.btn.red', { onclick: () => { this.s.command({ c: 'sell', slot: i }); sel = null; audio.play('coin'); setTimeout(render, 120); } }, `Sell for ${Math.floor(it.cost * 0.6)}`)) : h('div');
      } else if (sel) {
        const it = ITEM_BY_ID[sel];
        const locked = !avail.has(it.id);
        const cost = this.costFor(hero, it.id);
        detail = h('div.detail', {},
          h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, h('img', { src: itemIcon(it), style: { width: '44px', borderRadius: '10px' } }), h('div', {}, h('h3', {}, it.name), h('div', { style: { color: 'var(--gold)', fontWeight: 800 } }, `💰 ${cost}` + (cost !== it.cost ? ` (of ${it.cost})` : '')))),
          ...Object.entries(it.stats).map(([k, v]) => h('div.st', {}, statLine(k, v))),
          it.pdesc ? h('div.ps', {}, (it.passive ? 'Passive: ' : '') + it.pdesc) : null,
          it.from ? h('div', { style: { color: 'var(--dim)' } }, 'Built from: ' + it.from.map((c) => ITEM_BY_ID[c].name).join(' + ')) : null,
          locked ? h('div', { style: { color: '#ffb0b0', fontWeight: 800 } }, `🔒 Unlocks at Account Level ${it.unlock} (you are Lv ${L})`) :
            h('button.btn.gold', { onclick: () => { if (hero.gold < cost) { this.toast('Not enough gold'); audio.play('error'); return; } this.s.command({ c: 'buy', item: it.id }); audio.play('buy'); setTimeout(render, 120); } }, 'Buy'));
      } else detail = h('div.detail', {}, h('div', { style: { color: 'var(--dim)' } }, 'Tap an item to see details. Items can be bought anywhere on the map.'));
      P.append(
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 } }, h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center' } }, h('b', { style: { fontSize: '18px' } }, '🛍️ Shop'), h('span', { style: { color: 'var(--gold)', fontWeight: 900 } }, `💰 ${hero.gold}`)), tabs, grid),
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 } }, h('button.btn.ghost', { onclick: () => this.closePanel(), style: { alignSelf: 'flex-end' } }, 'Close ✕'), h('div', { style: { fontSize: '11px', color: 'var(--dim)' } }, 'Inventory'), inv, detail));
    };
    render();
    this.openPanel(P);
    this.shopRender = render;
  }
  openPause() {
    const S = this.app.profile.settings;
    const seg = (key, opts, onChange) => h('div.seg', {}, ...opts.map(([v, label]) => h(`button${S[key] === v ? '.on' : ''}`, { onclick: () => { S[key] = v; onChange && onChange(v); this.app.saveProfile(); this.openPause(); } }, label)));
    const P = h('div.panel.glass.fade-in', {},
      h('div.settings', {},
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' } }, h('b', { style: { fontSize: '20px' } }, '⚙️ Settings'), h('button.btn', { onclick: () => this.closePanel() }, 'Resume')),
        this.app.settingsRows(seg),
        h('div', { style: { display: 'flex', gap: '10px', marginTop: '12px', justifyContent: 'center' } },
          h('button.btn.red', { onclick: () => { this.closePanel(); this.s.surrender(); } }, '🏳️ Surrender'),
          h('button.btn.ghost', { onclick: () => { this.closePanel(); this.s.quit(); } }, 'Quit to menu'))));
    this.openPanel(P);
  }
  dispose() { window.removeEventListener('keydown', this.onKey); window.removeEventListener('keyup', this.onKey); this.aimInd.g.parent && this.aimInd.g.parent.remove(this.aimInd.g); this.root.remove(); }
}
