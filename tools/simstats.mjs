import { World } from '../src/sim/world.js';
import { HEROES } from '../src/data/heroes.js';
const runs = [['easy', 1], ['normal', 2], ['hard', 3], ['normal', 4], ['hard', 5]];
const roles = ['exp', 'jungle', 'mid', 'gold', 'roam'];
const byRole = { exp: 'Fighter', jungle: 'Assassin', mid: 'Mage', gold: 'Marksman' };
for (const [diff, seed] of runs) {
  const players = [];
  let r = seed * 7;
  for (const team of [0, 1]) {
    const used = new Set();
    for (const role of roles) {
      const pool = HEROES.filter((h) => !used.has(h.id) && (role === 'roam' ? (h.role === 'Tank' || h.role === 'Support') : h.role === byRole[role]));
      const h = pool[(r++) % pool.length];
      used.add(h.id);
      players.push({ team, heroId: h.id, bot: true, role, difficulty: diff });
    }
  }
  const w = new World({ players, seed });
  const casts = {}, spells = {}; let recalls = 0, titanKills = 0;
  while (!w.over && w.time < 40 * 60) {
    w.step();
    for (const e of w.takeEvents()) {
      if (e[0] === 'cast') { const h = w.heroes.find((x) => x.id === e[1]); casts[h.def.id] = (casts[h.def.id] || 0) + 1; }
      if (e[0] === 'spell') spells[e[2]] = (spells[e[2]] || 0) + 1;
      if (e[0] === 'recall') recalls++;
      if (e[0] === 'ann' && e[1] === 'titan') titanKills++;
    }
  }
  console.log(`${diff} seed${seed}: winner ${w.winner} at ${(w.time / 60).toFixed(1)}m kills ${w.teamKills} towers ${w.towers.filter((t) => !t.alive).length} recalls ${recalls} titan ${titanKills}`);
  console.log('  casts', JSON.stringify(casts));
  console.log('  spells', JSON.stringify(spells));
  console.log('  ' + w.heroes.map((h) => `${h.def.id}:L${h.level} ${h.k}/${h.d}/${h.a} cs${h.cs}`).join('  '));
}
