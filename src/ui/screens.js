// Menu screens: main menu, hero select, loading, end, profile, settings, WiFi lobby.
import { h, fmtTime } from './dom.js';
import { HEROES, HERO_BY_ID, ROLES, skillText } from '../data/heroes.js';
import { PETS, PET_BY_ID, SPELLS, SPELL_BY_ID, ITEM_BY_ID, ACCOUNT_MAX } from '../data/items.js';
import { skillIcon, spellIcon, itemIcon, icon, PET_EMOJI } from './icons.js';
import { level, levelProgress, unlocksAt } from '../game/profile.js';
import { audio } from '../audio/audio.js';
import { hasNative } from '../net/net.js';

const ROLE_ICON = { Tank: '🛡️', Fighter: '⚔️', Assassin: '🗡️', Mage: '🔮', Marksman: '🏹', Support: '✨' };
const LANE_NAME = { gold: 'Gold Lane', exp: 'EXP Lane', mid: 'Mid Lane', jungle: 'Jungle', roam: 'Roam' };

function screen(app, cls, ...kids) {
  app.ui.innerHTML = '';
  const el = h(`div.screen.fade-in.${cls}`, {}, ...kids);
  app.ui.append(el);
  return el;
}
function acctChip(app) {
  const p = levelProgress(app.profile);
  return h('div.acct.glass', { onclick: () => { audio.play('click'); showProfile(app); } }, h('div.lvl-badge', {}, p.L), h('div', {}, h('div', { style: { fontWeight: 800, fontSize: '13px' } }, app.profile.name), h('div', { style: { fontSize: '10px', color: 'var(--dim)', margin: '2px 0' } }, p.L >= ACCOUNT_MAX ? 'MAX LEVEL' : `Account Lv ${p.L} · ${p.cur}/${p.need} XP`), h('div.xpbar', {}, h('i', { style: { width: (p.k * 100).toFixed(1) + '%' } }))));
}

export function showMenu(app) {
  app.setShowcase('menu', HERO_BY_ID[app.profile.hero].look, app.profile.pet);
  audio.music('menu');
  const def = HERO_BY_ID[app.profile.hero];
  const b = (icon, label, fn, cls = '') => h(`button.btn${cls}`, { onclick: () => { audio.unlock(); audio.play('click'); fn(); } }, h('span.i', {}, icon), label);
  screen(app, 'menu',
    h('div.left', {},
      h('div.logo.title-font', {}, 'FROSTVALE', h('br'), 'LEGENDS', h('small', {}, '5 V 5 · ARENA OF ICE')),
      h('div.btns', {},
        b('⚔️', 'Battle  ·  5v5 vs AI', () => showHeroSelect(app, 'solo'), '.gold'),
        b('📶', 'WiFi Battle', () => showWifi(app)),
        b('🧝', 'Heroes & Pets', () => showHeroSelect(app, 'browse')),
        b('🏆', 'Profile & Rewards', () => showProfile(app)),
        b('⚙️', 'Settings', () => showSettings(app, () => showMenu(app)), '.ghost'))),
    acctChip(app),
    h('div.showcase-name', {}, h('span', {}, `${def.role} · ${def.title}`), h('b', {}, def.name)));
}

export function showHeroSelect(app, mode, onPick) {
  let role = 'All';
  let sel = HERO_BY_ID[app.profile.hero] ? app.profile.hero : HEROES[0].id;
  let pet = app.profile.pet, spell = app.profile.spell || HERO_BY_ID[sel].spell;
  const L = level(app.profile);
  app.setShowcase('select', HERO_BY_ID[sel].look, pet);
  const root = screen(app, 'hs');
  const render = () => {
    const def = HERO_BY_ID[sel];
    root.innerHTML = '';
    const tabs = h('div.tabs', {}, ...['All', ...ROLES].map((r) => h(`button.tab${role === r ? '.on' : ''}`, { onclick: () => { role = r; audio.play('click'); render(); } }, r === 'All' ? 'All' : ROLE_ICON[r])));
    const grid = h('div.grid', {}, ...HEROES.filter((x) => role === 'All' || x.role === role).map((x) => h(`div.pcard${x.id === sel ? '.on' : ''}`, { style: { backgroundImage: `url(${app.portraits[x.id]})` }, onclick: () => { sel = x.id; spell = app.profile.spell && SPELL_BY_ID[app.profile.spell] ? app.profile.spell : x.spell; app.setShowcase('select', x.look, pet); audio.play('click'); render(); } }, h('span.r', {}, ROLE_ICON[x.role]))));
    const stats = def.stats;
    const bar = (label, v) => [h('span', {}, label), h('i', { style: { width: Math.max(8, Math.min(100, v)) + '%' } })];
    const info = h('div.info.glass', {},
      h('div', {}, h('div.sub', {}, def.title.toUpperCase()), h('h2', {}, def.name)),
      h('div', {}, h('span.role-chip', {}, `${ROLE_ICON[def.role]} ${def.role}`), h('span.role-chip', {}, LANE_NAME[def.lane]), h('span.role-chip', {}, '★'.repeat(def.difficulty) + '☆'.repeat(3 - def.difficulty))),
      h('div.statbar', {}, ...bar('Durability', (stats.hp - 1900) / 12 + stats.armor), ...bar('Offense', (stats.atk - 80) * 1.6 + (def.role === 'Mage' ? 45 : 0)), ...bar('Skill Effects', def.role === 'Mage' || def.role === 'Support' ? 85 : def.role === 'Tank' ? 70 : 55), ...bar('Mobility', (stats.ms - 5.6) * 90)),
      h('div.skill-row', {}, h('img', { src: icon(def.passive.icon, '#9aa8c8') }), h('div.t', {}, h('b', {}, def.passive.name), ' (Passive) — ', def.passive.desc)),
      ...def.skills.map((s) => h('div.skill-row', {}, h('img', { src: skillIcon(s) }), h('div.t', {}, h('b', {}, s.name), s.ult ? ' (Ultimate)' : '', ' — ', skillText(s, 0), h('span', { style: { color: 'var(--dim)' } }, ` CD ${s.cd[0]}s`)))),
      h('div', { style: { fontSize: '11px', color: 'var(--dim)', fontStyle: 'italic' } }, def.lore));
    const petRow = h('div.picks', {}, ...PETS.map((p) => {
      const locked = p.unlock > L && !app.profile.settings.unlockAll;
      return h(`div.pick${p.id === pet ? '.on' : ''}${locked ? '.locked' : ''}`, { title: p.name, onclick: () => { if (locked) { app.toast(`${p.name} unlocks at Account Lv ${p.unlock}`); audio.play('error'); return; } pet = p.id; app.showcase.setPet(pet); audio.play('click'); render(); } }, PET_EMOJI[p.id], locked ? h('span.lock', {}, `Lv${p.unlock}`) : null);
    }));
    const petInfo = PET_BY_ID[pet];
    const spellRow = h('div.picks', {}, ...SPELLS.map((s) => h(`div.pick${s.id === spell ? '.on' : ''}`, { title: s.name, onclick: () => { spell = s.id; audio.play('click'); render(); }, style: { backgroundImage: `url(${spellIcon(s)})`, backgroundSize: 'cover', fontSize: 0 } })));
    const sp = SPELL_BY_ID[spell];
    const center = h('div.center', {},
      h('div', { style: { position: 'absolute', left: 0, right: 0, bottom: '62px', textAlign: 'center', fontSize: '11px', color: '#e8f4ff', textShadow: '0 1px 4px #000' } }, `🐾 ${petInfo.name}: ${petInfo.perk}`, h('br'), `✨ ${sp.name}: ${sp.desc}`),
      mode === 'browse'
        ? h('button.btn.gold.go', { onclick: () => { save(); audio.play('click'); showMenu(app); } }, 'Done')
        : h('button.btn.gold.go', { onclick: () => { save(); audio.play('click'); (onPick || ((p) => app.startSolo(p)))({ heroId: sel, petId: pet, spellId: spell }); } }, mode === 'mp' ? 'Lock In' : '⚔️ Battle!'),
      h('button.btn.ghost', { style: { position: 'absolute', top: 0, left: 0 }, onclick: () => { audio.play('click'); mode === 'mp' && onPick ? onPick(null) : showMenu(app); } }, '‹ Back'));
    const save = () => { app.profile.hero = sel; app.profile.pet = pet; app.profile.spell = spell; app.saveProfile(); };
    root.append(h('div.roster.glass', {}, tabs, grid, h('div', { style: { fontSize: '10px', color: 'var(--dim)', fontWeight: 800 } }, 'PET'), petRow, h('div', { style: { fontSize: '10px', color: 'var(--dim)', fontWeight: 800 } }, 'BATTLE SPELL'), spellRow), center, info);
  };
  render();
}

export function showLoading(app, roster, portraitsReady) {
  app.setShowcase(null);
  const card = (p) => {
    const def = HERO_BY_ID[p.heroId];
    const sp = SPELL_BY_ID[p.spellId] || SPELL_BY_ID[def.spell];
    return h(`div.lcard.${p.team === 0 ? 'blue' : 'red'}`, { style: { backgroundImage: `url(${app.portraits[def.id]})` } },
      h('img', { src: spellIcon(sp), style: { position: 'absolute', top: '5px', right: '5px', width: '24px', borderRadius: '50%' } }),
      h('div', { style: { position: 'absolute', top: '4px', left: '6px', fontSize: '18px' } }, PET_EMOJI[p.petId] || ''),
      h('div.n', {}, p.name, h('small', {}, `${def.name} · ${LANE_NAME[p.role] || ''}`)));
  };
  const bar = h('i');
  const tips = ['Drag a skill button to aim, or tap it to auto-aim at the nearest enemy.', 'Bushes hide you from enemies - and hide enemies from you!', 'The Crystal Tortoise grants gold, EXP and a shield to the whole team.', 'Slaying the Frost Titan summons a Titan Avatar that pushes a lane for your team.', 'Recall (🏠) to return to base and heal. You can shop from anywhere.', 'Junglers should take the Frostbite battle spell.', 'Your pet grants a small bonus - try them all!'];
  screen(app, 'loading',
    h('div.title-font', { style: { textAlign: 'center', fontSize: '22px', letterSpacing: '4px', color: '#bfe9ff' } }, 'FROSTVALE · 5 V 5'),
    h('div.lrow', {}, ...roster.filter((p) => p.team === 0).map(card)),
    h('div.lrow', {}, ...roster.filter((p) => p.team === 1).map(card)),
    h('div.lbar', {}, bar),
    h('div.tip', {}, '💡 ' + tips[Math.floor(Math.random() * tips.length)]));
  return (k) => { bar.style.width = Math.round(k * 100) + '%'; };
  void portraitsReady;
}

export function showEnd(app, r, xp) {
  app.setShowcase('menu', HERO_BY_ID[app.profile.hero].look, app.profile.pet);
  const won = r.winner === r.myTeam;
  audio.music(null);
  audio.play(won ? 'victory' : 'defeat');
  if (app.profile.settings.voice) audio.speak(won ? 'Victory' : 'Defeat');
  const score = (s) => s.k * 3 + s.a * 1.6 - s.d * 1.2 + s.dmgDealt / 1800 + s.goldEarned / 2500 + s.healDone / 2000;
  const mvp = [...r.stats].sort((a, b) => score(b) - score(a))[0];
  const me = r.stats.find((s) => s.id === r.me?.id) || r.me;
  const p = levelProgress(app.profile);
  const rows = (team) => r.stats.filter((s) => s.team === team).map((s) => h(`tr${s.id === me?.id ? '.me' : ''}`, {},
    h('td', {}, h('img.p', { src: app.portraits[HEROES[s.def].id] })), h('td', {}, h('b', {}, s.name), s.id === mvp.id ? ' 👑' : ''), h('td', { style: { fontWeight: 800 } }, `${s.k}/${s.d}/${s.a}`), h('td', { style: { color: 'var(--gold)' } }, s.goldEarned), h('td', {}, ...s.items.map((id) => h('img.i', { src: itemIcon(ITEM_BY_ID[id]) })))));
  screen(app, 'end',
    r.quit ? h('h1.lose', {}, 'MATCH LEFT') : h(`h1.${won ? 'win' : 'lose'}`, {}, won ? 'VICTORY' : 'DEFEAT'),
    h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', width: '92%' } },
      h('div.glass', { style: { padding: '6px' } }, h('table.sb-table', {}, h('tbody', {}, ...rows(0)))),
      h('div.glass', { style: { padding: '6px' } }, h('table.sb-table', {}, h('tbody', {}, ...rows(1))))),
    xp ? h('div.glass', { style: { padding: '8px 14px', display: 'flex', gap: '12px', alignItems: 'center' } },
      h('div.lvl-badge', {}, p.L), h('div', {}, h('div', { style: { fontWeight: 800 } }, `+${xp.gain} Account XP` + (xp.after > xp.before ? `  ·  LEVEL UP! ${xp.before} → ${xp.after}` : '')), h('div.xpbar', { style: { width: '260px', marginTop: '4px' } }, h('i', { style: { width: (p.k * 100) + '%' } })),
        xp.unlocked.length ? h('div', { style: { fontSize: '12px', color: 'var(--gold)', marginTop: '4px' } }, '🎁 Unlocked: ' + xp.unlocked.flatMap((u) => [...u.items.map((i) => i.name), ...u.boots.map((i) => i.name), ...u.pets.map((x) => x.name)]).join(', ')) : null)) : null,
    h('div', { style: { display: 'flex', gap: '10px' } }, h('button.btn.gold', { onclick: () => { audio.play('click'); showHeroSelect(app, 'solo'); } }, 'Play Again'), h('button.btn.ghost', { onclick: () => { audio.play('click'); showMenu(app); } }, 'Main Menu')));
}

export function showProfile(app) {
  const p = levelProgress(app.profile);
  const P = app.profile;
  const track = [];
  for (let L = 1; L <= ACCOUNT_MAX; L++) {
    const u = unlocksAt(L);
    const names = [...u.items.map((i) => '🗡 ' + i.name), ...u.boots.map((i) => '👢 ' + i.name), ...u.pets.map((x) => PET_EMOJI[x.id] + ' ' + x.name)];
    if (L === 1) names.unshift('All basic items, starter boots & legendary staples');
    track.push(h('div.slotrow', { style: { opacity: L <= p.L ? 1 : 0.55 } }, h('div.lvl-badge', { style: { width: '30px', height: '30px', fontSize: '13px', filter: L <= p.L ? 'none' : 'grayscale(1)' } }, L), h('div', { style: { flex: 1, fontSize: '12px' } }, names.join(' · ') || '—'), L <= p.L ? '✅' : '🔒'));
  }
  screen(app, '',
    h('div', { style: { display: 'grid', gridTemplateColumns: '250px 1fr', gap: '10px', height: '100%' } },
      h('div.glass', { style: { padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' } },
        h('button.btn.ghost', { onclick: () => { audio.play('click'); showMenu(app); } }, '‹ Back'),
        h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center' } }, h('div.lvl-badge', { style: { width: '54px', height: '54px', fontSize: '24px' } }, p.L), h('div', {}, h('b', { style: { fontSize: '18px' } }, P.name), h('div', { style: { color: 'var(--dim)', fontSize: '12px' } }, p.L >= ACCOUNT_MAX ? 'Max level reached!' : `${p.cur} / ${p.need} XP to Lv ${p.L + 1}`))),
        h('div.xpbar', { style: { width: '100%' } }, h('i', { style: { width: (p.k * 100) + '%' } })),
        h('input.field', { value: P.name, maxlength: 16, oninput: (e) => { P.name = e.target.value.slice(0, 16) || 'Player'; app.saveProfile(); } }),
        h('div', { style: { fontSize: '13px', lineHeight: 1.8 } }, `🏆 Wins: ${P.wins}`, h('br'), `💔 Losses: ${P.losses}`, h('br'), `⚔️ Matches: ${P.matches}`, h('br'), `💀 Total kills: ${P.kills}`),
        h('div', { style: { fontSize: '11px', color: 'var(--dim)' } }, 'Win matches to earn Account XP. Levels 1 → 15 unlock new legendary items, boots and pets.')),
      h('div.glass', { style: { padding: '10px', display: 'flex', flexDirection: 'column', gap: '5px', overflowY: 'auto' } }, h('b', { style: { fontSize: '16px' } }, '🎁 Level Rewards (1 – 15)'), ...track)));
}

export function settingsRows(app, seg) {
  const S = app.profile.settings;
  const slider = (key, onIn) => h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: S[key], oninput: (e) => { S[key] = +e.target.value; onIn && onIn(); app.saveProfile(); } });
  const vol = () => audio.setVolumes(S.music, S.sfx);
  return [
    h('div.row', {}, 'Graphics quality', seg('quality', [[0, 'Low'], [1, 'Medium'], [2, 'High'], [3, 'Ultra']], (q) => app.core.setQuality(q))),
    h('div.row', {}, 'Music volume', slider('music', vol)),
    h('div.row', {}, 'Sound effects', slider('sfx', vol)),
    h('div.row', {}, 'Announcer voice', seg('voice', [[true, 'On'], [false, 'Off']], (v) => { audio.voice = v; })),
    h('div.row', {}, 'Camera distance', seg('zoom', [[0.85, 'Near'], [1, 'Normal'], [1.15, 'Far']], (z) => { if (app.session) app.session.view.zoom = z; })),
    h('div.row', {}, 'Auto-upgrade skills', seg('autoLevel', [[true, 'On'], [false, 'Off']], (v) => { if (app.session) app.session.command({ c: 'autolvl', on: v }); })),
    h('div.row', {}, 'Haptic feedback', seg('haptics', [[true, 'On'], [false, 'Off']])),
    h('div.row', {}, 'Show FPS', seg('fps', [[false, 'Off'], [true, 'On']])),
    h('div.row', {}, 'Bot difficulty', seg('difficulty', [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']])),
    h('div.row', {}, 'Unlock all items & pets (sandbox)', seg('unlockAll', [[false, 'Off'], [true, 'On']])),
  ];
}

export function showSettings(app, back) {
  const S = app.profile.settings;
  const seg = (key, opts, onChange) => h('div.seg', {}, ...opts.map(([v, label]) => h(`button${S[key] === v ? '.on' : ''}`, { onclick: () => { S[key] = v; onChange && onChange(v); app.saveProfile(); audio.play('click'); showSettings(app, back); } }, label)));
  screen(app, '', h('div.settings.glass', { style: { padding: '12px', maxHeight: '100%' } },
    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, h('b', { style: { fontSize: '20px' } }, '⚙️ Settings'), h('button.btn', { onclick: () => { audio.play('click'); back(); } }, 'Done')),
    ...settingsRows(app, seg),
    h('div', { style: { fontSize: '11px', color: 'var(--dim)', marginTop: '8px' } }, 'Frostvale Legends — an original fan-made MOBA. Controls: left thumb moves, right thumb attacks & casts. Drag skills to aim, release over CANCEL to cancel.')));
}

// ---------------------------------------------------------------- WiFi multiplayer
export function showWifi(app) {
  const P = app.profile;
  const native = hasNative();
  const defHost = location.protocol.startsWith('http') && location.host ? location.host : (P.lanAddr || '192.168.1.10:8787');
  let addr = P.lanAddr || defHost, room = P.room || 'frostvale';
  const field = (val, set, ph) => h('input.field', { value: val, placeholder: ph, oninput: (e) => set(e.target.value.trim()) });
  screen(app, '',
    h('div', { style: { display: 'grid', gridTemplateColumns: native ? '1fr 1fr' : '1fr', gap: '10px', maxWidth: '760px', margin: '0 auto', height: '100%' } },
      native ? h('div.glass', { style: { padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' } },
        h('b', { style: { fontSize: '17px' } }, '📱 Nearby iPhones'),
        h('div', { style: { fontSize: '12px', color: 'var(--dim)' } }, 'Play with friends on the same WiFi (or nearby) - no server needed. One player hosts, the others join. Up to 8 players; bots fill the rest.'),
        h('button.btn.gold', { onclick: () => app.hostNative() }, 'Host a match'),
        h('button.btn', { onclick: () => app.joinNative() }, 'Find & join a match')) : null,
      h('div.glass', { style: { padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' } },
        h('b', { style: { fontSize: '17px' } }, '💻 LAN Server'),
        h('div', { style: { fontSize: '12px', color: 'var(--dim)' } }, 'Run "node server/relay.js" on a computer on the same WiFi, then enter its address. Phones can also open that address in Safari to play.'),
        field(addr, (v) => { addr = v; P.lanAddr = v; app.saveProfile(); }, 'Server address e.g. 192.168.1.10:8787'),
        field(room, (v) => { room = v || 'frostvale'; P.room = room; app.saveProfile(); }, 'Room name'),
        h('div', { style: { display: 'flex', gap: '8px' } }, h('button.btn.gold', { style: { flex: 1 }, onclick: () => app.hostRelay(addr, room) }, 'Host'), h('button.btn', { style: { flex: 1 }, onclick: () => app.joinRelay(addr, room) }, 'Join'))),
      h('button.btn.ghost', { style: { gridColumn: '1 / -1', justifySelf: 'start' }, onclick: () => { audio.play('click'); showMenu(app); } }, '‹ Back')));
}

export function showLobby(app, L) {
  // L: { host: bool, players: [...], me: id, onStart, onTeam, onPick, onLeave, status, found: [...] (client browsing) }
  const root = screen(app, 'lobby');
  const render = () => {
    root.innerHTML = '';
    const col = (team) => h('div.glass', { style: { padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' } },
      h('b', { style: { color: team === 0 ? '#6cc4ff' : '#ff7083' } }, team === 0 ? '🔷 Blue Team' : '🔶 Red Team'),
      ...L.players.filter((p) => p.team === team).map((p) => h('div.slotrow', { onclick: () => L.host && p.id !== 'host' && L.onTeam && L.onTeam(p.id) },
        h('img', { src: app.portraits[p.hero] || '' }), h('div', { style: { flex: 1 } }, h('b', {}, p.name + (p.id === L.me ? ' (you)' : '')), h('div', { style: { fontSize: '11px', color: 'var(--dim)' } }, HERO_BY_ID[p.hero]?.name || '...')), p.id === 'host' ? '👑' : L.host ? '⇄' : '')),
      h('div', { style: { fontSize: '11px', color: 'var(--dim)' } }, `${5 - L.players.filter((p) => p.team === team).length} bot(s) will join`));
    const found = L.found ? h('div.glass', { style: { gridColumn: '1 / -1', padding: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' } }, h('b', {}, 'Matches nearby:'), ...(L.found.length ? L.found.map((f) => h('button.btn', { onclick: () => L.onJoin(f.id) }, `Join ${f.name}`)) : [h('span', { style: { color: 'var(--dim)' } }, 'Searching…')])) : null;
    root.append(
      h('div', { style: { gridColumn: '1 / -1', display: 'flex', gap: '10px', alignItems: 'center' } },
        h('button.btn.ghost', { onclick: () => L.onLeave() }, '‹ Leave'),
        h('b', { style: { fontSize: '18px' } }, L.host ? '👑 Hosting WiFi Match' : '📶 WiFi Lobby'),
        h('span', { style: { color: 'var(--dim)', fontSize: '12px' } }, L.status || ''),
        h('div', { style: { flex: 1 } }),
        h('button.btn', { onclick: () => L.onPick() }, 'Choose Hero'),
        L.host ? h('button.btn.gold', { onclick: () => L.onStart() }, '▶ Start Match') : null),
      found, col(0), col(1));
  };
  L.render = render;
  render();
  return L;
}
export { LANE_NAME, fmtTime };
