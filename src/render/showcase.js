// Menu / hero-select showcase stage and hero portrait rendering.
import * as THREE from 'three';
import { buildHumanoid } from './models.js';
import { poseHumanoid } from './anim.js';
import { buildPet, animatePet } from './creatures.js';
import { U, PartBuilder, mtx, glowMat, toonMat } from './materials.js';

const ROLE_BG = { Tank: ['#3a6fd8', '#132552'], Fighter: ['#d87a3a', '#3a1a10'], Assassin: ['#8a5cff', '#1e1240'], Mage: ['#3ad8c8', '#0e2e3a'], Marksman: ['#7ad83a', '#14300e'], Support: ['#ffd36b', '#3a2a10'] };

export function renderPortraits(renderer, heroes, size = 160) {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x8a7aa8, 1.4));
  const key = new THREE.DirectionalLight(0xfff0e0, 2.2); key.position.set(1.5, 2.5, 3); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fe8ff, 1.6); rim.position.set(-2, 1.5, -2); scene.add(rim);
  const cam = new THREE.PerspectiveCamera(24, 1, 0.1, 20);
  const rt = new THREE.WebGLRenderTarget(size, size, { samples: 4 });
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  const buf = new Uint8Array(size * size * 4);
  const out = {};
  const prevClear = renderer.getClearColor(new THREE.Color()), prevAlpha = renderer.getClearAlpha();
  const prevTM = renderer.toneMapping;
  renderer.setClearColor(0x000000, 0);
  for (const h of heroes) {
    const m = buildHumanoid(h.look, { outline: true, flash: { value: 0 } });
    m.t = 0.5;
    poseHumanoid(m, { speed: 0, phase: 0, anim: 'idle', age: 0 }, 0.5);
    m.root.rotation.y = 0.35;
    scene.add(m.root);
    const H = h.look.height || 1;
    const yeti = h.look.body === 'yeti';
    const headY = (yeti ? 1.55 : 1.62) * H;
    cam.position.set(0.55, headY + 0.25, 2.3 * (yeti ? 1.25 : 1));
    cam.lookAt(0, headY - 0.05, 0);
    m.root.updateMatrixWorld(true);
    renderer.setRenderTarget(rt);
    renderer.clear();
    renderer.render(scene, cam);
    renderer.readRenderTargetPixels(rt, 0, 0, size, size, buf);
    renderer.setRenderTarget(null);
    scene.remove(m.root);
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d');
    const [c1, c2] = ROLE_BG[h.role] || ['#4f86ff', '#101830'];
    const gr = g.createRadialGradient(size * 0.5, size * 0.35, 4, size * 0.5, size * 0.5, size * 0.75);
    gr.addColorStop(0, c1); gr.addColorStop(1, c2);
    g.fillStyle = gr; g.fillRect(0, 0, size, size);
    g.globalAlpha = 0.25;
    for (let i = 0; i < 14; i++) { g.fillStyle = '#fff'; g.beginPath(); g.arc((i * 47) % size, (i * 89) % size, 1 + (i % 3), 0, Math.PI * 2); g.fill(); }
    g.globalAlpha = 1;
    const img = g.createImageData(size, size);
    for (let y = 0; y < size; y++) img.data.set(buf.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
    const tmp = document.createElement('canvas'); tmp.width = tmp.height = size; tmp.getContext('2d').putImageData(img, 0, 0);
    g.drawImage(tmp, 0, 0);
    out[h.id] = c.toDataURL('image/png');
  }
  renderer.setClearColor(prevClear, prevAlpha);
  renderer.toneMapping = prevTM;
  rt.dispose();
  return out;
}

export class Showcase {
  constructor(core) {
    this.core = core;
    this.group = new THREE.Group();
    this.pos = new THREE.Vector3(-40.5, 0, 40.5);
    this.pos.y = core.env.height(this.pos.x, this.pos.z);
    this.group.position.copy(this.pos);
    // ice pedestal
    const pb = new PartBuilder();
    pb.add(new THREE.CylinderGeometry(1.5, 1.75, 0.35, 8), 0xdff0ff, mtx(0, 0.17, 0));
    pb.add(new THREE.CylinderGeometry(1.2, 1.35, 0.14, 8), 0xffffff, mtx(0, 0.41, 0));
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; pb.add(new THREE.OctahedronGeometry(0.16), 0xbff6ff, mtx(Math.cos(a) * 1.62, 0.42, Math.sin(a) * 1.62, 0, 0, 0, 1, 1.8, 1)); }
    const ped = pb.mesh(toonMat({ rim: 0xbff6ff }));
    ped.receiveShadow = true; ped.castShadow = true;
    this.group.add(ped);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.03, 6, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x9fefff).multiplyScalar(2.6) }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.36;
    this.group.add(ring);
    this.ring = ring;
    // crystals around the stage
    const cr = new PartBuilder();
    for (let i = 0; i < 5; i++) { const a = -0.6 + i * 0.55 + Math.PI * 0.75; const r = 3.6 + (i % 2) * 0.8; cr.add(new THREE.OctahedronGeometry(0.35 + (i % 3) * 0.15), i % 2 ? 0xc9a8ff : 0x8fe6ff, mtx(Math.cos(a) * r, 0.6 + (i % 2) * 0.3, Math.sin(a) * r, 0.3 * i, 0, 0.2, 1, 2.2, 1)); }
    this.crystals = cr.mesh(glowMat(1.9));
    this.group.add(this.crystals);
    core.scene.add(this.group);
    this.model = null; this.pet = null;
    this.spin = 0.4; this.t = 0;
    this.anim = 'idle'; this.animT = 0;
  }
  setHero(look, petId) {
    if (this.model) this.group.remove(this.model.root);
    if (this.pet) this.group.remove(this.pet.root);
    this.model = buildHumanoid(look, { outline: true, flash: { value: 0 } });
    this.model.root.position.y = 0.48;
    this.group.add(this.model.root);
    if (petId) { this.pet = buildPet(petId); this.pet.root.position.set(1.0, 0.48, 0.6); this.pet.root.scale.setScalar(1.5); this.group.add(this.pet.root); }
    this.anim = 'cast2'; this.animT = 0;
  }
  setPet(petId) {
    if (this.pet) this.group.remove(this.pet.root);
    this.pet = null;
    if (petId) { this.pet = buildPet(petId); this.pet.root.position.set(1.0, 0.48, 0.6); this.pet.root.scale.setScalar(1.5); this.group.add(this.pet.root); }
  }
  frame(dt, layout = 'menu') {
    this.t += dt; this.animT += dt;
    const core = this.core;
    U.uFowOn.value = 0;
    if (this.model) {
      this.model.t = this.t;
      this.model.root.rotation.y = Math.PI * 0.75 + Math.sin(this.t * 0.35) * 0.35;
      poseHumanoid(this.model, { speed: 0, phase: 0, anim: this.anim, age: this.animT }, this.t);
    }
    if (this.pet) { animatePet(this.pet, { speed: 0 }, this.t); this.pet.root.rotation.y = Math.PI * 0.75; if (this.pet.flying) this.pet.root.position.y = 0.48 + 0.6; }
    this.ring.material.color.setScalar(2 + Math.sin(this.t * 2) * 0.6);
    this.crystals.rotation.y = Math.sin(this.t * 0.2) * 0.05;
    // camera: low angle, hero framed on the right (menu) or center (hero select)
    const p = this.pos;
    const yaw = Math.PI * 0.75 + (layout === 'menu' ? 0.28 : 0.05);
    const dist = layout === 'menu' ? 5.6 : 5.0;
    const cx = p.x + Math.sin(yaw) * dist, cz = p.z + Math.cos(yaw) * dist;
    core.camera.position.set(cx, p.y + 1.7, cz);
    const side = layout === 'menu' ? -1.6 : 0;
    core.camera.lookAt(p.x + Math.sin(yaw + Math.PI / 2) * side, p.y + 2.0, p.z + Math.cos(yaw + Math.PI / 2) * side);
    core.camTarget.set(p.x, p.y, p.z);
    U.uCamT.value.set(9999, 9999, 0, 1);
    core.sun.target.position.set(p.x, p.y, p.z);
    core.sun.position.set(p.x - 22, p.y + 42, p.z + 26);
    core.render(dt, this.t);
  }
  dispose() { this.core.scene.remove(this.group); }
}
