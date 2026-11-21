import { RenderCore } from '../src/render/core.js';
import { GameView } from '../src/render/gameview.js';
import { ClientState } from '../src/game/state.js';
import { World, DT } from '../src/sim/world.js';
const P = new URLSearchParams(location.search);
document.body.style.cssText = 'margin:0;overflow:hidden;background:#000';
const canvas = document.createElement('canvas'); canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%';
const ov = document.createElement('canvas'); ov.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none';
document.body.append(canvas, ov);
const comp = [['kael', 'exp'], ['nyra', 'jungle'], ['lumi', 'mid'], ['aria', 'gold'], ['brannoc', 'roam'], ['valka', 'exp'], ['sable', 'jungle'], ['pyra', 'mid'], ['gideon', 'gold'], ['mamu', 'roam']];
const players = comp.map(([id, role], i) => ({ team: i < 5 ? 0 : 1, heroId: id, bot: true, role, difficulty: 'normal', name: id[0].toUpperCase() + id.slice(1) }));
const w = new World({ players, seed: +(P.get('seed') || 5) });
const ff = +(P.get('t') || 60);
while (w.time < ff) { w.step(); w.events.length = 0; }
const follow = +(P.get('follow') || 3);
const me = w.heroes[follow];
const core = new RenderCore(canvas, +(P.get('q') || 2));
const state = new ClientState(1 / 30);
const view = new GameView(core, state, { myId: me.id, myTeam: me.team, overlayCanvas: ov });
view.zoom = +(P.get('zoom') || 1);
state.push(w.snapshot(true));
state.renderT = state.latestT;
let acc = 0, last = performance.now();
window.__stats = { frames: 0 };
function loop() {
  const now = performance.now();
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  acc += dt;
  let steps = 0;
  while (acc >= DT && steps < 4) { w.step(); state.push(w.snapshot(true)); acc -= DT; steps++; }
  view.frame(dt);
  view.render(dt);
  window.__stats.frames++;
  window.__stats.info = core.stats;
  requestAnimationFrame(loop);
}
loop();
