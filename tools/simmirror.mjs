import { World } from '../src/sim/world.js';
const comp = [['kael', 'exp'], ['sable', 'jungle'], ['lumi', 'mid'], ['aria', 'gold'], ['brannoc', 'roam']];
let wins = [0, 0];
const n = +(process.argv[2] || 8);
for (let seed = 1; seed <= n; seed++) {
  const players = [];
  for (const team of [0, 1]) for (const [id, role] of comp) players.push({ team, heroId: id, bot: true, role, difficulty: 'normal' });
  const w = new World({ players, seed: seed * 101 });
  while (!w.over && w.time < 40 * 60) { w.step(); w.events.length = 0; }
  wins[w.winner]++;
  console.log('seed', seed, 'winner', w.winner, (w.time / 60).toFixed(1) + 'm', 'kills', w.teamKills.join(':'), 'towers blue/red lost', w.towers.filter((t) => !t.alive && t.team === 0).length, w.towers.filter((t) => !t.alive && t.team === 1).length);
}
console.log('wins', wins);
