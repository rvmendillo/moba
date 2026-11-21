import * as THREE from 'three';
import { RenderCore } from '../src/render/core.js';
const canvas = document.createElement('canvas');
canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%';
document.body.style.margin = '0';
document.body.appendChild(canvas);
const q = +(new URLSearchParams(location.search).get('q') ?? 2);
const core = new RenderCore(canvas, q);
window.core = core;
const pos = (location.hash.slice(1) || '-40,40').split(',').map(Number);
const target = new THREE.Vector3(pos[0], 0, pos[1]);
target.y = core.env.height(target.x, target.z);
let t = 0;
core.camTarget.copy(target);
function frame() {
  t += 1 / 30;
  core.updateCamera(1 / 30, target, pos[2] ? Math.PI : 0, pos[3] || 1);
  core.render(1 / 30, t);
  window.__frames = (window.__frames || 0) + 1;
  requestAnimationFrame(frame);
}
frame();
