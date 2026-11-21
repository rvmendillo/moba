// Frostvale Legends - app entry: boot, screens, game loop, multiplayer flows.
import { RenderCore } from './render/core.js';
import { Showcase, renderPortraits } from './render/showcase.js';
import { HEROES, HERO_BY_ID } from './data/heroes.js';
import { loadProfile, saveProfile, level, availableItems, grantMatchXp } from './game/profile.js';
import { MatchSession, buildRoster } from './game/session.js';
import { World } from './sim/world.js';
import { audio } from './audio/audio.js';
import { h, $ } from './ui/dom.js';
import { showMenu, showHeroSelect, showLoading, showEnd, showLobby, showWifi, settingsRows } from './ui/screens.js';
import { RelayNet, NativeNet } from './net/net.js';

class App {
  constructor() {
    this.ui = $('#ui'); this.gl = $('#gl'); this.ov = $('#ov');
    this.profile = loadProfile();
    this.time = 0; this.fps = 60; this.last = performance.now();
    this.session = null; this.showcase = null; this.showcaseLayout = null;
    this.slowT = 0; this.fastT = 0;
    audio.setVolumes(this.profile.settings.music, this.profile.settings.sfx);
    audio.voice = this.profile.settings.voice;
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    this.splash();
    setTimeout(() => this.boot(), 40);
  }
  splash() {
    this.ui.innerHTML = '';
    this.splashBar = h('i');
    this.ui.append(h('div.screen.loading', {}, h('div.logo.title-font', { style: { textAlign: 'center', fontSize: '46px' } }, 'FROSTVALE LEGENDS'), h('div.lbar', {}, this.splashBar), h('div.tip', {}, 'Building the frozen valley…')));
  }
  boot() {
    try {
      this.core = new RenderCore(this.gl, this.profile.settings.quality);
    } catch (e) {
      this.ui.innerHTML = '';
      this.ui.append(h('div.screen.loading', {}, h('div.tip', { style: { fontSize: '16px' } }, 'WebGL could not start on this device: ' + e.message)));
      return;
    }
    this.splashBar.style.width = '60%';
    setTimeout(() => {
      this.portraits = renderPortraits(this.core.renderer, HEROES);
      this.showcase = new Showcase(this.core);
      this.splashBar.style.width = '100%';
      window.addEventListener('resize', () => { this.core.resize(); this.session && this.session.view.overlay.resize(); });
      showMenu(this);
      requestAnimationFrame((t) => this.loop(t));
    }, 30);
  }
  loop(now) {
    const dt = Math.min(0.1, Math.max(0.001, (now - this.last) / 1000));
    this.last = now;
    this.time += dt;
    this.fps = this.fps * 0.93 + (1 / dt) * 0.07;
    try {
      if (this.session && !this.session.ended) {
        this.session.frame(dt);
        if (this.session && !this.session.ended) this.session.render(dt);
      } else if (this.showcase && this.showcaseLayout) this.showcase.frame(dt, this.showcaseLayout);
    } catch (e) { console.error(e); }
    this.adaptResolution(dt);
    requestAnimationFrame((t) => this.loop(t));
  }
  adaptResolution(dt) {
    if (!this.core) return;
    const cur = this.core.dynScale || 1;
    if (this.fps < 42) { this.slowT += dt; this.fastT = 0; } else if (this.fps > 57) { this.fastT += dt; this.slowT = 0; } else { this.slowT = 0; this.fastT = 0; }
    if (this.slowT > 2.5 && cur > 0.6) { this.core.dynScale = Math.max(0.6, cur - 0.12); this.core.resize(); this.slowT = 0; }
    if (this.fastT > 6 && cur < 1) { this.core.dynScale = Math.min(1, cur + 0.08); this.core.resize(); this.fastT = 0; }
  }
  setShowcase(layout, look, pet) {
    this.showcaseLayout = layout;
    if (!this.showcase) return;
    this.showcase.group.visible = !!layout;
    if (layout && look && (this.showcase.look !== look || this.showcase.petId !== pet)) {
      if (this.showcase.look !== look) this.showcase.setHero(look, pet); else this.showcase.setPet(pet);
      this.showcase.look = look; this.showcase.petId = pet;
    }
  }
  saveProfile() { saveProfile(this.profile); }
  settingsRows(seg) { return settingsRows(this, seg); }
  toast(msg) {
    const t = h('div.toast', {}, msg);
    this.ui.append(t);
    setTimeout(() => t.remove(), 1600);
  }
  haptic(kind) {
    if (!this.profile.settings.haptics) return;
    try { if (window.webkit?.messageHandlers?.haptic) window.webkit.messageHandlers.haptic.postMessage(kind); else if (navigator.vibrate) navigator.vibrate(kind === 'heavy' ? 30 : 12); } catch { /* */ }
  }
  // ------------------------------------------------------------------ single player
  startSolo(pick) {
    const P = this.profile;
    const humans = [{ team: 0, heroId: pick.heroId, petId: pick.petId, spellId: pick.spellId, name: P.name }];
    const roster = buildRoster(humans, Math.random, P.settings.difficulty);
    const cfg = { mode: 'local', players: roster, seed: (Math.random() * 1e9) | 0, items: availableItems(P), difficulty: P.settings.difficulty, myIndex: roster.findIndex((r) => !r.bot), accountLevel: level(P) };
    roster.forEach((r) => { if (!r.bot) r.autoLevel = P.settings.autoLevel; });
    this.launch(roster, () => new MatchSession(this, cfg));
  }
  launch(roster, make, delay = 1700) {
    const prog = showLoading(this, roster);
    let k = 0;
    const iv = setInterval(() => { k = Math.min(1, k + 0.08); prog(k); }, delay / 14);
    audio.music(null);
    setTimeout(() => {
      clearInterval(iv); prog(1);
      this.ui.innerHTML = '';
      this.setShowcase(null);
      this.session = make();
    }, delay);
  }
  onMatchEnd(r) {
    this.session = null;
    let xp = null;
    if (!r.quit && r.me) xp = grantMatchXp(this.profile, r.winner === r.myTeam, r.me.k, r.me.a);
    this.profile.history = [{ t: Date.now(), win: r.winner === r.myTeam, hero: r.me ? HEROES[r.me.def].id : null, kda: r.me ? `${r.me.k}/${r.me.d}/${r.me.a}` : '' }, ...(this.profile.history || [])].slice(0, 20);
    this.saveProfile();
    showEnd(this, r, xp);
  }
  // ------------------------------------------------------------------ WiFi: host
  async hostRelay(addr, room) {
    const net = new RelayNet(`ws://${addr.replace(/^wss?:\/\//, '')}/`);
    try { await net.connect(room, this.profile.name, true); } catch (e) { this.toast('⚠️ ' + e.message); return; }
    this.hostLobby(net, `Room "${room}" on ${addr}`);
  }
  hostNative() {
    const net = new NativeNet();
    net.host(this.profile.name);
    this.hostLobby(net, 'Visible to nearby iPhones');
  }
  hostLobby(net, status) {
    const P = this.profile;
    const L = { host: true, me: 'host', status, players: [{ id: 'host', name: P.name, hero: P.hero, pet: P.pet, spell: P.spell, team: 0 }] };
    const sync = () => { net.broadcast({ t: 'lobby', players: L.players }); L.render && L.render(); };
    net.onPeer = (id, name, on) => {
      if (on && !L.players.find((p) => p.id === id)) {
        if (L.players.length >= 10) return;
        const blue = L.players.filter((p) => p.team === 0).length, red = L.players.filter((p) => p.team === 1).length;
        L.players.push({ id, name: name || 'Player', hero: 'kael', pet: 'fox', spell: null, team: blue > red ? 1 : 0 });
      } else if (!on) L.players = L.players.filter((p) => p.id !== id);
      sync();
    };
    net.onMessage = (from, m) => {
      const p = L.players.find((x) => x.id === from);
      if (m.t === 'hello') {
        if (!p) net.onPeer(from, m.name, true);
        const q = L.players.find((x) => x.id === from);
        if (q) Object.assign(q, { name: (m.name || 'Player').slice(0, 16), hero: HERO_BY_ID[m.hero] ? m.hero : q.hero, pet: m.pet || q.pet, spell: m.spell || null });
        net.send(from, { t: 'welcome', id: from });
        sync();
      } else if (m.t === 'pick' && p) { if (HERO_BY_ID[m.heroId]) p.hero = m.heroId; p.pet = m.petId || p.pet; p.spell = m.spellId || p.spell; sync(); }
      else if (m.t === 'bye') { L.players = L.players.filter((x) => x.id !== from); sync(); }
    };
    L.onTeam = (id) => { const p = L.players.find((x) => x.id === id); if (!p) return; const other = 1 - p.team; if (L.players.filter((x) => x.team === other).length >= 5) return; p.team = other; sync(); };
    L.onPick = () => showHeroSelect(this, 'mp', (pick) => { if (pick) { const me = L.players[0]; me.hero = pick.heroId; me.pet = pick.petId; me.spell = pick.spellId; } showLobby(this, L); sync(); });
    L.onLeave = () => { net.close(); showMenu(this); };
    L.onStart = () => this.startHostMatch(net, L.players);
    showLobby(this, L);
  }
  startHostMatch(net, players) {
    const P = this.profile;
    const humans = players.map((p) => ({ team: p.team, heroId: p.hero, petId: p.pet, spellId: p.spell || HERO_BY_ID[p.hero].spell, name: p.name, netId: p.id === 'host' ? null : p.id, autoLevel: true }));
    // keep humans on distinct heroes within a team
    const roster = buildRoster(humans, Math.random, P.settings.difficulty);
    const items = availableItems(P);
    const cfg = { mode: 'host', players: roster, seed: (Math.random() * 1e9) | 0, items, difficulty: P.settings.difficulty, myIndex: roster.findIndex((r) => !r.bot && !r.netId), accountLevel: level(P) };
    const probe = new World({ players: roster, seed: cfg.seed, items });
    const heroIds = {};
    probe.heroes.forEach((hh, i) => { if (roster[i].netId) heroIds[roster[i].netId] = hh.id; });
    net.broadcast({ t: 'start', roster, heroIds, items, level: cfg.accountLevel });
    net.onPeer = (id, name, on) => { if (!on && this.session && this.session.world) { const hh = this.session.heroByNet.get(id); if (hh) this.session.world.makeBot(hh); } };
    this.launch(roster, () => new MatchSession(this, cfg, net), 1500);
  }
  // ------------------------------------------------------------------ WiFi: join
  async joinRelay(addr, room) {
    const net = new RelayNet(`ws://${addr.replace(/^wss?:\/\//, '')}/`);
    try { await net.connect(room, this.profile.name, false); } catch (e) { this.toast('⚠️ ' + e.message); return; }
    this.clientLobby(net, `Connected to "${room}"`);
    this.hello(net);
  }
  joinNative() {
    const net = new NativeNet();
    const L = this.clientLobby(net, 'Searching for nearby hosts…');
    L.found = [];
    net.onFound = (id, name, on) => { L.found = L.found.filter((f) => f.id !== id); if (on) L.found.push({ id, name }); L.render(); };
    L.onJoin = (id) => { net.join(id); L.status = 'Joining…'; L.found = null; L.render(); };
    net.onPeer = (id, name, on) => { if (on) { L.status = `Connected to ${name}`; this.hello(net); } else { this.toast('Disconnected from host'); } L.render(); };
    net.browse(this.profile.name);
  }
  hello(net) { const P = this.profile; net.send('host', { t: 'hello', name: P.name, hero: P.hero, pet: P.pet, spell: P.spell }); }
  clientLobby(net, status) {
    const L = { host: false, me: net.id, status, players: [] };
    const buffered = [];
    net.onMessage = (from, m) => {
      if (m.t === 'welcome') L.me = m.id;
      else if (m.t === 'lobby') { L.players = m.players; L.render && L.render(); }
      else if (m.t === 'start') this.startClientMatch(net, m, L.me || net.id, buffered);
      else if (m.t === 'snap' || m.t === 'end') buffered.push([from, m]);
    };
    net.onClose = () => { if (!this.session) { this.toast('Connection closed'); showMenu(this); } };
    L.onPick = () => showHeroSelect(this, 'mp', (pick) => { if (pick) net.send('host', { t: 'pick', ...pick }); showLobby(this, L); });
    L.onLeave = () => { net.send('host', { t: 'bye' }); setTimeout(() => net.close(), 100); showMenu(this); };
    showLobby(this, L);
    return L;
  }
  startClientMatch(net, m, myNet, buffered) {
    const myId = m.heroIds[myNet];
    if (!myId) { this.toast('Could not find your hero in this match'); return; }
    const idx = Object.keys(m.heroIds).indexOf(myNet);
    const mine = m.roster.find((r) => r.netId === myNet) || m.roster[idx];
    const cfg = { mode: 'client', myId, myTeam: mine ? mine.team : 0, items: m.items, accountLevel: m.level };
    this.launch(m.roster, () => {
      const s = new MatchSession(this, cfg, net);
      for (const [from, msg] of buffered.splice(0)) s.onNet(from, msg);
      return s;
    }, 1400);
  }
}

window.addEventListener('load', () => { window.app = new App(); });
