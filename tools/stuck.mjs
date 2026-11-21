import { World } from '../src/sim/world.js';
const comp = [['kael', 'exp'], ['nyra', 'jungle'], ['lumi', 'mid'], ['aria', 'gold'], ['brannoc', 'roam'], ['valka', 'exp'], ['sable', 'jungle'], ['pyra', 'mid'], ['gideon', 'gold'], ['mamu', 'roam']];
for (const seed of [3, 5]) {
  const players = comp.map(([id, role], i) => ({ team: i < 5 ? 0 : 1, heroId: id, bot: true, role, difficulty: 'normal' }));
  const w = new World({ players, seed });
  const stuck = new Map(); const spots = [];
  let minionStuck = 0, minionSamples = 0;
  while (!w.over && w.time < 30 * 60) {
    w.step(); w.events.length = 0;
    if (w.tickN % 30 !== 0) continue;
    for (const h of w.heroes) {
      if (!h.alive || h.recallT > 0) { h._p = null; continue; }
      const wants = Math.hypot(h.input.mx, h.input.mz) > 0.3 || (h.input.forceTarget && !w.inRange(h, h.input.forceTarget, h.st.range));
      if (h._p && wants && h.canMove() && Math.hypot(h.x - h._p[0], h.z - h._p[1]) < 0.4) {
        stuck.set(h.def.id, (stuck.get(h.def.id) || 0) + 1);
        if (spots.length < 40 && h.def.id === "nyra") spots.push(`${h.def.id}@${h.x.toFixed(1)},${h.z.toFixed(1)} ${h.brain.mode} t=${w.time.toFixed(0)}`);
      }
      h._p = [h.x, h.z];
    }
    for (const m of w.minions) {
      if (!m.alive || m.target) { m._p = null; continue; }
      minionSamples++;
      if (m._p && Math.hypot(m.x - m._p[0], m.z - m._p[1]) < 0.3) minionStuck++;
      m._p = [m.x, m.z];
    }
  }
  console.log('seed', seed, 'end', (w.time / 60).toFixed(1), 'winner', w.winner, 'stuck seconds', JSON.stringify(Object.fromEntries(stuck)), 'minion stuck', minionStuck, '/', minionSamples);
  console.log('  ' + spots.join('\n  '));
}
