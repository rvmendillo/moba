// Headless full-match test: 10 bots play until a core falls.
import { World, DT } from '../src/sim/world.js';
import { HEROES } from '../src/data/heroes.js';
const diff = process.argv[2] || 'normal';
const seed = +(process.argv[3] || 7);
const roles = ['exp', 'jungle', 'mid', 'gold', 'roam'];
const pick = (role, used) => HEROES.find((h) => !used.has(h.id) && ({ exp: 'Fighter', jungle: 'Assassin', mid: 'Mage', gold: 'Marksman', roam: h.role === 'Support' ? 'Support' : 'Tank' }[role] === h.role));
const players = [];
for (const team of [0, 1]) {
  const used = new Set();
  for (const role of roles) {
    let h = pick(role, used) || HEROES.find((x) => !used.has(x.id));
    if (team === 1) { const alts = HEROES.filter((x) => x.role === h.role && x.id !== h.id && !used.has(x.id)); if (alts.length && role !== 'roam') h = alts[0]; }
    used.add(h.id);
    players.push({ team, heroId: h.id, bot: true, role, difficulty: diff, name: h.name });
  }
}
const w = new World({ players, seed });
const t0 = performance.now();
let lastMin = -1;
const towersDown = () => w.towers.filter((t) => !t.alive).length;
const anns = {};
let maxTick = 0;
while (!w.over && w.time < 40 * 60) {
  const a = performance.now();
  w.step();
  const snap = w.snapshot(w.tickN % 2 === 0);
  maxTick = Math.max(maxTick, performance.now() - a);
  for (const e of snap.e) if (e[0] === 'ann') anns[e[1]] = (anns[e[1]] || 0) + 1;
  const min = Math.floor(w.time / 60);
  if (min !== lastMin) {
    lastMin = min;
    if (min % 2 === 0) {
      const line = w.heroes.map((h) => `${h.def.name.slice(0, 5)}L${h.level}${h.alive ? '' : '†'} ${h.k}/${h.d}/${h.a} ${Math.round(h.gold)}g ${h.items.length}it`).join(' | ');
      console.log(`[${min}m] kills ${w.teamKills.join(':')} towers down ${towersDown()} minions ${w.minions.filter((m) => m.alive).length}\n  ${line}`);
    }
  }
  for (const u of w.units) if (!Number.isFinite(u.x) || !Number.isFinite(u.hp)) { console.log('NaN unit', u.kind, u.id, u.x, u.hp); process.exit(1); }
}
const ms = performance.now() - t0;
console.log('GAME OVER', w.over, 'winner', w.winner, 'time', (w.time / 60).toFixed(1) + 'min', 'kills', w.teamKills, 'towers down', towersDown());
console.log('sim speed', (w.tickN / (ms / 1000)).toFixed(0), 'ticks/s; max tick ms', maxTick.toFixed(2));
console.log('announcements', anns);
for (const h of w.heroes) console.log(h.team, h.def.name.padEnd(8), 'L' + h.level, `${h.k}/${h.d}/${h.a}`, 'cs', h.cs, 'gold', Math.round(h.goldEarned), 'items', h.items.join(','));
