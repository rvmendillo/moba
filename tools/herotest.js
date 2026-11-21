import * as THREE from 'three';
import { RenderCore } from '../src/render/core.js';
import { buildHumanoid } from '../src/render/models.js';
import { poseHumanoid } from '../src/render/anim.js';
import { HEROES } from '../src/data/heroes.js';
const canvas = document.createElement('canvas');
canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%';
document.body.style.margin = '0';
document.body.appendChild(canvas);
const params = new URLSearchParams(location.search);
const core = new RenderCore(canvas, 2);
const zoom = +(params.get('zoom') || 0.42);
const anim = params.get('anim') || 'idle';
const cx = +(params.get('x') || -12), cz = +(params.get('z') || 50.5);
const models = HEROES.map((h, i) => {
  const m = buildHumanoid(h.look, { outline: true, flash: { value: 0 } });
  const row = Math.floor(i / 6), col = i % 6;
  m.root.position.set(cx - 7.5 + col * 3.0, 0, cz - 1.8 + row * 3.0);
  m.root.position.y = core.env.height(m.root.position.x, m.root.position.z);
  m.root.rotation.y = 0.35;
  m.seed = i;
  core.scene.add(m.root);
  return m;
});
const target = new THREE.Vector3(cx, core.env.height(cx, cz), cz);
core.camTarget.copy(target);
let t = 0;
function frame() {
  t += 1 / 30;
  models.forEach((m, i) => {
    m.t = t;
    const st = { speed: anim === 'run' ? 6 : 0, phase: t * 10, anim: anim === 'attack' ? (Math.floor(t / 0.6) % 2 ? 'atk2' : 'atk') : anim === 'cast' ? 'cast0' : 'idle', age: anim === 'attack' ? (t % 0.6) : anim === 'cast' ? (t % 0.8) : 0 };
    poseHumanoid(m, st, t);
  });
  core.updateCamera(1 / 30, target, 0, zoom);
  core.render(1 / 30, t);
  requestAnimationFrame(frame);
}
frame();
window.__ok = true;
