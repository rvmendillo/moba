import { World } from '../src/sim/world.js';
const comp = [['kael', 'exp'], ['sable', 'jungle'], ['lumi', 'mid'], ['aria', 'gold'], ['brannoc', 'roam']];
const mode = process.argv[2] || 'redFirst';
let wins = [0, 0];
const stats = { tortoise: [0, 0], titan: [0, 0], fb: [0, 0], towerFirst: [0, 0] };
for (let seed = +(process.argv[3]||1); seed <= +(process.argv[4]||8); seed++) {
  const players = [];
  const order = mode === 'redFirst' ? [1, 0] : [0, 1];
  for (const team of order) for (const [id, role] of comp) players.push({ team, heroId: id, bot: true, role, difficulty: 'normal' });
  const w = new World({ players, seed: seed * 101 });
  let firstTower = -1;
  while (!w.over && w.time < 40 * 60) {
    w.step();
    for (const e of w.takeEvents()) if (e[0] === 'ann') {
      if (e[1] === 'tortoise') stats.tortoise[e[2]]++;
      if (e[1] === 'titan') stats.titan[e[2]]++;
      if (e[1] === 'firstblood') stats.fb[e[2]]++;
      if (e[1] === 'tower' && firstTower < 0) { firstTower = e[2]; stats.towerFirst[e[2]]++; }
    }
  }
  wins[w.winner]++;
}
console.log(mode, 'wins', wins, JSON.stringify(stats));
