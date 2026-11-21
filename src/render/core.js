// Renderer core: WebGL renderer, scene, camera rig, lights, reflections and post-processing.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { Environment } from './env.js';
import { U } from './materials.js';

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uVig: { value: 0.6 }, uSat: { value: 1.2 }, uGray: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uVig; uniform float uSat; uniform float uGray; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = mix(c.rgb, c.rgb * vec3(0.9, 0.96, 1.1), (1.0 - l) * 0.4);
      c.rgb = mix(c.rgb, c.rgb * vec3(1.04, 1.0, 0.97), l * 0.25);
      c.rgb = mix(vec3(l), c.rgb, uSat * (1.0 - uGray));
      c.rgb = clamp((c.rgb - 0.5) * 1.06 + 0.5, 0.0, 1.0);
      vec2 d = vUv - 0.5;
      c.rgb *= 1.0 - dot(d, d) * uVig;
      gl_FragColor = c;
    }`,
};

export const QUALITY = [
  { name: 'Low', pr: 1.0, bloom: false, shadows: false, msaa: 0 },
  { name: 'Medium', pr: 1.5, bloom: true, shadows: false, msaa: 0 },
  { name: 'High', pr: 2.0, bloom: true, shadows: true, msaa: 4 },
  { name: 'Ultra', pr: 2.6, bloom: true, shadows: true, msaa: 4 },
];

export class RenderCore {
  constructor(canvas, quality = 2) {
    this.canvas = canvas;
    this.q = quality;
    const r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, alpha: false });
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.enabled = QUALITY[quality].shadows;
    r.shadowMap.type = THREE.PCFShadowMap;
    this.renderer = r;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xcfe0f5);
    this.scene.fog = new THREE.Fog(0xd2e2f6, 60, 170);
    this.camera = new THREE.PerspectiveCamera(38, 2, 0.5, 900);
    this.camTarget = new THREE.Vector3();
    this.camYaw = 0; // 0 = looking north (blue view), PI = red view
    this.camDist = 1;
    this.shake = 0;
    // lights
    const hemi = new THREE.HemisphereLight(0x86a8ff, 0xdcd4ff, 0.85);
    this.hemi = hemi;
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffd9b8, 2.1);
    sun.castShadow = QUALITY[quality].shadows;
    sun.shadow.mapSize.set(quality >= 3 ? 4096 : 2048, quality >= 3 ? 4096 : 2048);
    const sc = sun.shadow.camera;
    sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.near = 1; sc.far = 120;
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
    this.scene.add(sun, sun.target);
    this.sun = sun;
    const fill = new THREE.DirectionalLight(0x9cb8ff, 0.3);
    fill.position.set(30, 25, -20);
    this.scene.add(fill);
    // environment
    this.env = new Environment(this.scene, quality);
    // reflections from the sky
    const pm = new THREE.PMREMGenerator(r);
    const envScene = new THREE.Scene();
    envScene.add(this.env.sky.clone());
    const ground = new THREE.Mesh(new THREE.CircleGeometry(300, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xe8f0ff }));
    ground.position.y = -2;
    envScene.add(ground);
    this.scene.environment = pm.fromScene(envScene, 0.035).texture;
    pm.dispose();
    this.setupComposer();
    this.resize();
  }
  setupComposer() {
    const Q = QUALITY[this.q];
    const r = this.renderer;
    if (this.composer) this.composer.dispose?.();
    const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: Q.msaa });
    this.composer = new EffectComposer(r, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.42, 0.4, 1.2);
    this.bloom.enabled = Q.bloom;
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
  }
  setQuality(q) {
    if (q === this.q) return;
    this.q = q;
    const Q = QUALITY[q];
    this.renderer.shadowMap.enabled = Q.shadows;
    this.sun.castShadow = Q.shadows;
    this.scene.traverse((o) => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => (m.needsUpdate = true)); } });
    this.setupComposer();
    this.resize();
  }
  resize() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, QUALITY[this.q].pr) * (this.dynScale || 1);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w * pr * 0.5, h * pr * 0.5);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.viewH = h * pr;
  }
  // in-match camera rig: fixed pitch looking down at target
  updateCamera(dt, target, yaw, zoom = 1) {
    this.camTarget.lerp(target, Math.min(1, dt * 9));
    const t = this.camTarget;
    const dist = 23 * zoom, pitch = 0.87;
    const back = Math.cos(pitch) * dist, up = Math.sin(pitch) * dist;
    const sx = Math.sin(yaw), sz = Math.cos(yaw);
    let ox = 0, oz = 0;
    if (this.shake > 0) { this.shake = Math.max(0, this.shake - dt * 2.2); const s = this.shake * 0.35; ox = (Math.random() - 0.5) * s; oz = (Math.random() - 0.5) * s; }
    this.camera.position.set(t.x + sx * back + ox, t.y + up, t.z + sz * back + oz);
    this.camera.lookAt(t.x - sx * 2.6 + ox, t.y, t.z - sz * 2.6 + oz);
    U.uCamT.value.set(t.x, t.z, sx, sz);
    // shadow camera follows (snapped to texels)
    const snap = 60 / this.sun.shadow.mapSize.x;
    const cx = Math.round((t.x - sx * 4) / snap) * snap, cz = Math.round((t.z - sz * 4) / snap) * snap;
    this.sun.target.position.set(cx, 0, cz);
    this.sun.position.set(cx - 22, 42, cz + 26);
  }
  render(dt, time) {
    U.uTime.value = time;
    this.env.update(time, this.camTarget, this.viewH);
    const info = this.renderer.info;
    info.autoReset = false;
    info.reset();
    this.composer.render(dt);
    this.stats = { calls: info.render.calls, tris: info.render.triangles };
  }
}
