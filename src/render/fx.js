// Visual effects: particles, shockwaves, pillars, slashes, beams, projectiles, zones and telegraphs.
import * as THREE from 'three';
import { particleAtlas, U } from './materials.js';
import { PROJ_KINDS, ZONE_KINDS } from '../sim/world.js';

const MAXP = 5000;
const tmpC = new THREE.Color();
const rnd = Math.random;

class Particles {
  constructor(scene) {
    this.n = 0;
    this.p = new Float32Array(MAXP * 3); this.v = new Float32Array(MAXP * 3);
    this.col = new Float32Array(MAXP * 3); this.life = new Float32Array(MAXP); this.max = new Float32Array(MAXP);
    this.size = new Float32Array(MAXP); this.shape = new Float32Array(MAXP); this.grav = new Float32Array(MAXP); this.drag = new Float32Array(MAXP); this.grow = new Float32Array(MAXP);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(new Float32Array(MAXP * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(new Float32Array(MAXP * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aSz = new THREE.BufferAttribute(new Float32Array(MAXP * 2), 2).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos); g.setAttribute('acol', this.aCol); g.setAttribute('asz', this.aSz);
    g.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: particleAtlas() }, uScale: { value: 400 } },
      vertexShader: `attribute vec4 acol; attribute vec2 asz; uniform float uScale; varying vec4 vC; varying float vS;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = asz.x * uScale / -mv.z; vC = acol; vS = asz.y; }`,
      fragmentShader: `uniform sampler2D uTex; varying vec4 vC; varying float vS;
        void main(){ vec2 uv = gl_PointCoord * 0.5; float s = floor(vS + 0.5); uv += vec2(mod(s, 2.0), floor(s / 2.0)) * 0.5; uv.y = 1.0 - uv.y; vec4 t = texture2D(uTex, uv); gl_FragColor = vec4(vC.rgb, t.a * vC.a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
    this.geo = g;
  }
  emit(x, y, z, vx, vy, vz, life, size, color, shape = 0, grav = 0, drag = 0, grow = 0) {
    if (this.n >= MAXP) return;
    const i = this.n++;
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
    this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    tmpC.set(color);
    this.col[i * 3] = tmpC.r; this.col[i * 3 + 1] = tmpC.g; this.col[i * 3 + 2] = tmpC.b;
    this.life[i] = life; this.max[i] = life; this.size[i] = size; this.shape[i] = shape; this.grav[i] = grav; this.drag[i] = drag; this.grow[i] = grow;
  }
  update(dt) {
    let n = this.n;
    const P = this.p, V = this.v;
    for (let i = 0; i < n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        n--;
        if (i !== n) {
          for (let k = 0; k < 3; k++) { P[i * 3 + k] = P[n * 3 + k]; V[i * 3 + k] = V[n * 3 + k]; this.col[i * 3 + k] = this.col[n * 3 + k]; }
          this.life[i] = this.life[n]; this.max[i] = this.max[n]; this.size[i] = this.size[n]; this.shape[i] = this.shape[n]; this.grav[i] = this.grav[n]; this.drag[i] = this.drag[n]; this.grow[i] = this.grow[n];
        }
        i--;
        continue;
      }
      const d = 1 - this.drag[i] * dt;
      V[i * 3] *= d; V[i * 3 + 1] = V[i * 3 + 1] * d - this.grav[i] * dt; V[i * 3 + 2] *= d;
      P[i * 3] += V[i * 3] * dt; P[i * 3 + 1] += V[i * 3 + 1] * dt; P[i * 3 + 2] += V[i * 3 + 2] * dt;
    }
    this.n = n;
    const ap = this.aPos.array, ac = this.aCol.array, as = this.aSz.array;
    for (let i = 0; i < n; i++) {
      const k = this.life[i] / this.max[i];
      ap[i * 3] = P[i * 3]; ap[i * 3 + 1] = P[i * 3 + 1]; ap[i * 3 + 2] = P[i * 3 + 2];
      const a = Math.min(1, k * 2.5) * Math.min(1, (1 - k) * 8 + 0.3);
      ac[i * 4] = this.col[i * 3] * 1.6; ac[i * 4 + 1] = this.col[i * 3 + 1] * 1.6; ac[i * 4 + 2] = this.col[i * 3 + 2] * 1.6; ac[i * 4 + 3] = a;
      as[i * 2] = this.size[i] * (1 + this.grow[i] * (1 - k)); as[i * 2 + 1] = this.shape[i];
    }
    this.aPos.needsUpdate = true; this.aCol.needsUpdate = true; this.aSz.needsUpdate = true;
    this.geo.setDrawRange(0, n);
  }
}

// ------------------------------------------------------------------ mesh effects
const ringGeo = new THREE.RingGeometry(0.82, 1, 64, 1).rotateX(-Math.PI / 2);
const discGeo = new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2);
const pillarGeo = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true).translate(0, 0.5, 0);
const coneGeo = (ang) => new THREE.CircleGeometry(1, 24, Math.PI / 2 - ang, ang * 2).rotateX(-Math.PI / 2);
const slashGeo = new THREE.RingGeometry(0.75, 1, 40, 1, 0, Math.PI * 1.1).rotateX(-Math.PI / 2);
const quadGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5);

function softMat(color, kind = 'ring') {
  const frag = {
    ring: `uniform vec3 uColor; uniform float uAlpha; varying vec2 vUv; void main(){ gl_FragColor = vec4(uColor * 2.2, uAlpha); }`,
    disc: `uniform vec3 uColor; uniform float uAlpha; uniform float uTime; varying vec2 vUv; void main(){ vec2 d = vUv - 0.5; float r = length(d) * 2.0; float edge = smoothstep(0.82, 0.97, r) * (1.0 - smoothstep(0.97, 1.0, r)); float fill = (1.0 - r) * 0.35 + 0.12; float rings = 0.5 + 0.5 * sin(r * 28.0 - uTime * 4.0); gl_FragColor = vec4(uColor * 1.6, (edge * 1.2 + fill * (0.6 + 0.4 * rings)) * uAlpha * step(r, 1.0)); }`,
    pillar: `uniform vec3 uColor; uniform float uAlpha; varying vec2 vUv; void main(){ float a = (1.0 - vUv.y) * (0.55 + 0.45 * sin(vUv.x * 50.0)) ; gl_FragColor = vec4(uColor * 2.0, a * uAlpha); }`,
    beam: `uniform vec3 uColor; uniform float uAlpha; varying vec2 vUv; void main(){ float a = 1.0 - abs(vUv.x - 0.5) * 2.0; gl_FragColor = vec4(uColor * 2.4, a * a * uAlpha); }`,
    slash: `uniform vec3 uColor; uniform float uAlpha; varying vec2 vUv; void main(){ float a = smoothstep(0.0, 0.6, vUv.x) * (1.0 - smoothstep(0.9, 1.0, vUv.x)); gl_FragColor = vec4(uColor * 2.4, a * uAlpha); }`,
  }[kind];
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uAlpha: { value: 1 }, uTime: U.uTime },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: frag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}

export class FX {
  constructor(scene, env) {
    this.scene = scene; this.env = env;
    this.parts = new Particles(scene);
    this.effects = [];
    this.projViews = new Map();
    this.zoneViews = new Map();
    this.t = 0;
    this.group = new THREE.Group();
    scene.add(this.group);
  }
  h(x, z) { return this.env.height(x, z); }
  add(mesh, dur, update) { this.group.add(mesh); this.effects.push({ mesh, t: 0, dur, update }); return mesh; }
  ring(x, z, r0, r1, color, dur = 0.5, y = 0.15, width = 1) {
    const m = new THREE.Mesh(ringGeo, softMat(color, 'ring'));
    m.position.set(x, this.h(x, z) + y, z);
    return this.add(m, dur, (p) => { const r = r0 + (r1 - r0) * (1 - (1 - p) * (1 - p)); m.scale.set(r, 1, r); m.material.uniforms.uAlpha.value = (1 - p) * 0.9 * width; });
  }
  disc(x, z, r, color, dur = 0.6, alpha = 0.6, y = 0.08) {
    const m = new THREE.Mesh(discGeo, softMat(color, 'disc'));
    m.position.set(x, this.h(x, z) + y, z); m.scale.set(r, 1, r);
    return this.add(m, dur, (p) => { m.material.uniforms.uAlpha.value = alpha * Math.min(1, p * 8) * (1 - p); });
  }
  pillar(x, z, r, hgt, color, dur = 0.8, alpha = 0.8) {
    const m = new THREE.Mesh(pillarGeo, softMat(color, 'pillar'));
    m.position.set(x, this.h(x, z), z);
    return this.add(m, dur, (p) => { m.scale.set(r * (1 - p * 0.5), hgt * (0.4 + p * 0.6), r * (1 - p * 0.5)); m.material.uniforms.uAlpha.value = alpha * Math.min(1, p * 6) * (1 - p); });
  }
  slash(x, z, r, color, ang, dur = 0.28, y = 1.0, tilt = 0) {
    const m = new THREE.Mesh(slashGeo, softMat(color, 'slash'));
    m.position.set(x, this.h(x, z) + y, z);
    m.rotation.set(tilt, ang, 0, 'YXZ');
    return this.add(m, dur, (p) => { m.scale.setScalar(r * (0.8 + p * 0.4)); m.rotation.y = ang + p * 1.2; m.material.uniforms.uAlpha.value = (1 - p) * 1.0; });
  }
  beam(x1, z1, x2, z2, color, dur = 0.3, w = 0.5, y = 1.0, y2) {
    const m = new THREE.Mesh(quadGeo, softMat(color, 'beam'));
    const dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz) || 0.01;
    m.position.set(x1, this.h(x1, z1) + y, z1);
    m.rotation.y = Math.atan2(dx, dz);
    if (y2 !== undefined) m.rotation.x = -Math.atan2((this.h(x2, z2) + y2) - (this.h(x1, z1) + y), L);
    m.scale.set(w, 1, L);
    return this.add(m, dur, (p) => { m.material.uniforms.uAlpha.value = (1 - p); m.scale.x = w * (1 - p * 0.5); });
  }
  cone(x, z, dx, dz, len, ang, color, dur = 0.35) {
    const m = new THREE.Mesh(coneGeo(ang), softMat(color, 'disc'));
    m.position.set(x, this.h(x, z) + 0.15, z);
    m.rotation.y = Math.atan2(dx, dz) + Math.PI;
    m.scale.set(len, 1, len);
    return this.add(m, dur, (p) => { m.material.uniforms.uAlpha.value = (1 - p) * 0.9; m.scale.set(len * (0.6 + p * 0.4), 1, len * (0.6 + p * 0.4)); });
  }
  burst(x, z, n, color, o = {}) {
    const y0 = this.h(x, z) + (o.y ?? 1.0);
    const sp = o.speed ?? 4, life = o.life ?? 0.6, size = o.size ?? 0.35, shape = o.shape ?? 0;
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, e = (rnd() - 0.2) * (o.up ?? 1.2);
      const s = sp * (0.4 + rnd() * 0.8);
      this.parts.emit(x + (rnd() - 0.5) * (o.spread ?? 0.4), y0 + (rnd() - 0.5) * (o.spreadY ?? 0.4), z + (rnd() - 0.5) * (o.spread ?? 0.4), Math.cos(a) * s, e * s + (o.vy ?? 0), Math.sin(a) * s, life * (0.6 + rnd() * 0.6), size * (0.6 + rnd() * 0.8), o.colors ? o.colors[i % o.colors.length] : color, shape, o.grav ?? 4, o.drag ?? 1.5, o.grow ?? 0);
    }
  }
  ringBurst(x, z, r, n, color, o = {}) {
    const y = this.h(x, z) + (o.y ?? 0.3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd() * 0.2;
      const rr = r * (o.inner ?? 0.9) + rnd() * r * 0.15;
      this.parts.emit(x + Math.cos(a) * rr, y, z + Math.sin(a) * rr, Math.cos(a) * (o.out ?? 1), (o.vy ?? 2.5) * (0.5 + rnd()), Math.sin(a) * (o.out ?? 1), (o.life ?? 0.8) * (0.7 + rnd() * 0.5), (o.size ?? 0.4) * (0.6 + rnd() * 0.7), color, o.shape ?? 0, o.grav ?? 1, 1.2);
    }
  }
  line(x1, z1, x2, z2, n, color, o = {}) {
    for (let i = 0; i < n; i++) {
      const t = rnd();
      const x = x1 + (x2 - x1) * t, z = z1 + (z2 - z1) * t;
      this.parts.emit(x + (rnd() - 0.5) * 0.5, this.h(x, z) + (o.y ?? 0.8) + rnd() * 0.6, z + (rnd() - 0.5) * 0.5, (rnd() - 0.5) * 0.8, rnd() * 1.5, (rnd() - 0.5) * 0.8, (o.life ?? 0.6) * (0.6 + rnd() * 0.6), (o.size ?? 0.35) * (0.6 + rnd()), color, o.shape ?? 0, o.grav ?? 0.5, 1);
    }
  }
  lightning(x1, z1, x2, z2, color, y = 1.2) {
    const segs = 7;
    let px = x1, pz = z1, py = this.h(x1, z1) + y;
    for (let i = 1; i <= segs; i++) {
      const t = i / segs;
      const nx = x1 + (x2 - x1) * t + (i < segs ? (rnd() - 0.5) * 0.8 : 0), nz = z1 + (z2 - z1) * t + (i < segs ? (rnd() - 0.5) * 0.8 : 0);
      const ny = this.h(nx, nz) + y + (i < segs ? (rnd() - 0.5) * 0.6 : 0);
      this.beam(px, pz, nx, nz, color, 0.22, 0.22, py - this.h(px, pz), ny - this.h(nx, nz));
      px = nx; pz = nz; py = ny;
    }
  }
  telegraph(x, z, r, dur, color) {
    const m = new THREE.Mesh(discGeo, softMat(color, 'disc'));
    m.position.set(x, this.h(x, z) + 0.1, z); m.scale.set(r, 1, r);
    this.add(m, dur, (p) => { m.material.uniforms.uAlpha.value = 0.55 + 0.35 * Math.sin(p * 30); });
    const ring = new THREE.Mesh(ringGeo, softMat(color, 'ring'));
    ring.position.copy(m.position); ring.position.y += 0.02;
    this.add(ring, dur, (p) => { const k = p; ring.scale.set(r * k, 1, r * k); ring.material.uniforms.uAlpha.value = 0.8; });
  }

  // ------------------------------------------------------------------ event dispatch
  event(e, ally) {
    const [, kind, x, z, r, color, a, b] = e;
    const C = color;
    switch (kind) {
      case 'impact': this.ring(x, z, 0.3, r * 1.4, C, 0.35); this.burst(x, z, 14, C, { speed: 5, size: 0.3, shape: 1 }); break;
      case 'nova': case 'frostNova':
        this.ring(x, z, 0.5, r * 1.1, C, 0.55); this.disc(x, z, r, C, 0.5, 0.5); this.ringBurst(x, z, r, 40, 0xffffff, { shape: 2, size: 0.35, vy: 3 });
        if (kind === 'frostNova') { this.pillar(x, z, r * 0.6, 4, C, 0.6); this.burst(x, z, 24, 0xbff6ff, { y: 0.3, up: 2.5, speed: 6, shape: 1, size: 0.4 }); }
        break;
      case 'iceTrail': case 'slashTrail': case 'snowTrail': case 'windTrail': case 'featherTrail':
        this.line(x, z, a, b, kind === 'windTrail' ? 22 : 30, kind === 'slashTrail' ? 0x9fe8ff : kind === 'featherTrail' ? 0xfff1c7 : 0xe8f6ff, { shape: kind === 'snowTrail' || kind === 'iceTrail' ? 2 : 1, size: 0.35 });
        break;
      case 'shatter': case 'skyCrash': case 'bigExplosion': case 'coreExplode': {
        const big = kind === 'coreExplode' ? 2 : 1;
        this.ring(x, z, 0.5, r * 1.5 * big, C, 0.7); this.ring(x, z, 0.2, r * 0.9 * big, 0xffffff, 0.45);
        this.disc(x, z, r * big, C, 0.6, 0.7);
        this.pillar(x, z, r * 0.5, 7 * big, C, 0.7);
        this.burst(x, z, 60 * big, C, { speed: 9, size: 0.5, up: 2, shape: kind === 'shatter' ? 2 : 0, life: 0.9, colors: kind === 'bigExplosion' ? [0xffb24a, 0xff6a2a, 0xffe08a] : undefined });
        this.burst(x, z, 30 * big, 0xffffff, { speed: 6, size: 0.3, shape: 1, life: 0.7 });
        break;
      }
      case 'snowBurst': this.burst(x, z, 30, 0xffffff, { speed: 5, size: 0.5, shape: 2, life: 0.8, up: 1.5 }); this.ring(x, z, 0.3, r, 0xe8f6ff, 0.4); break;
      case 'roar': this.ring(x, z, 0.5, r * 1.2, C, 0.6); this.ring(x, z, 0.5, r * 0.8, 0xffffff, 0.45); this.ringBurst(x, z, r * 0.5, 30, 0xffffff, { out: 8, shape: 2, size: 0.45 }); break;
      case 'slashHit': this.slash(x, z, 1.1, C, rnd() * 6.28, 0.22, 1.0, 0.6); this.burst(x, z, 8, C, { speed: 4, size: 0.25, shape: 1 }); break;
      case 'whirl': this.slash(x, z, r, C, rnd() * 6.28, 0.3, 0.9, 0); this.slash(x, z, r * 0.85, 0xffffff, rnd() * 6.28, 0.3, 1.0, 0); this.ringBurst(x, z, r, 20, C, { shape: 1, size: 0.3 }); break;
      case 'verdict': this.slash(x, z, r, C, 0.8, 0.35, 1.0, 1.2); this.slash(x, z, r, C, -0.8, 0.35, 1.0, 1.2); this.pillar(x, z, 1.2, 6, C, 0.6); this.burst(x, z, 30, C, { speed: 7, shape: 2, size: 0.4 }); break;
      case 'frostSpark': case 'iceShatter': case 'arrowHit': this.burst(x, z, 10, C, { speed: 4, size: 0.3, shape: kind === 'iceShatter' ? 2 : 1 }); break;
      case 'thrust': { const ex = x + a * r, ez = z + b * r; this.beam(x, z, ex, ez, C, 0.3, 0.9, 1.1); this.line(x, z, ex, ez, 16, C, { shape: 1 }); break; }
      case 'featherBurst': this.burst(x, z, 24, 0xfff6dd, { speed: 4, size: 0.4, shape: 0, life: 0.9, grav: 1 }); this.ring(x, z, 0.3, r, C, 0.4); break;
      case 'shadowPuff': case 'veil': this.burst(x, z, 26, C, { speed: 2.5, size: 0.7, life: 0.7, grav: -1, shape: 0 }); this.burst(x, z, 10, 0xffffff, { speed: 3, size: 0.25, shape: 1 }); break;
      case 'cutLine': this.beam(x - a * r * 0.5, z - b * r * 0.5, x + a * r * 0.5, z + b * r * 0.5, C, 0.2, 0.35, 1.1); this.burst(x, z, 6, C, { speed: 3, shape: 1, size: 0.25 }); break;
      case 'clawBurst': case 'clawRend':
        for (let i = -1; i <= 1; i++) { const ang = Math.atan2(a || 1, b || 0) + 0.6; const ox = Math.cos(ang) * i * 0.35, oz = -Math.sin(ang) * i * 0.35; this.beam(x - Math.sin(ang) * 0.9 + ox, z - Math.cos(ang) * 0.9 + oz, x + Math.sin(ang) * 0.9 + ox, z + Math.cos(ang) * 0.9 + oz, C, 0.25, 0.18, 1.0); }
        this.burst(x, z, 12, C, { speed: 4, shape: 1, size: 0.3 });
        break;
      case 'freeze': case 'bind': this.burst(x, z, 18, C, { speed: 2.5, size: 0.45, shape: 2, up: 0.6 }); this.ring(x, z, 1.2, 0.6, C, 0.5); this.pillar(x, z, 0.8, 2.2, C, 0.5, 0.6); break;
      case 'explosion': this.ring(x, z, 0.3, r * 1.2, C, 0.45); this.disc(x, z, r, C, 0.4, 0.5); this.burst(x, z, 40, C, { speed: 6, size: 0.5, up: 1.6, colors: [0xffb24a, 0xff6a2a, 0xffe08a], life: 0.7 }); break;
      case 'meteorFall': this.meteor(x, z, r, a || 1.2); break;
      case 'cone': this.cone(x, z, a, b, r, 0.5, C, 0.35); break;
      case 'aimLine': { const m = this.beam(x, z, x + a * r, z + b * r, C, a !== undefined ? 0.65 : 0.6, 0.12, 1.2); void m; break; }
      case 'lightBeam': this.pillar(x, z, r * 0.7, 8, C, 0.8); this.ring(x, z, 0.5, r, C, 0.6); this.ringBurst(x, z, r * 0.7, 30, C, { shape: 1, size: 0.35, vy: 4, grav: -1 }); break;
      case 'sanctuary': case 'anthem': this.ring(x, z, 1, r, C, 0.9); this.ring(x, z, 0.5, r * 0.7, 0xffffff, 0.7); this.disc(x, z, r, C, 0.8, 0.35); this.ringBurst(x, z, r * 0.4, 50, C, { shape: kind === 'anthem' ? 1 : 0, size: 0.45, vy: 4, grav: -0.5, out: 3 }); break;
      case 'notesBurst': this.burst(x, z, 18, C, { speed: 3, size: 0.5, shape: 1, grav: -1, life: 1 }); break;
      case 'lightning': this.lightning(x, z, a, b, C); break;
      case 'auroraShield': case 'aegisFx': this.burst(x, z, 24, C, { speed: 2, size: 0.4, shape: 1, y: 1.2 }); this.ring(x, z, 1.6, 0.8, C, 0.5, 1.0); break;
      case 'blinkFx': case 'purifyFx': this.burst(x, z, 20, C, { speed: 3.5, size: 0.35, shape: 1 }); this.ring(x, z, 0.2, r * 1.2, C, 0.35); break;
      case 'healFx': this.ringBurst(x, z, 0.9, 22, C, { shape: 1, size: 0.35, vy: 2.5, grav: -1.5, out: 0.2 }); this.ring(x, z, 0.4, 1.4, C, 0.5); break;
      case 'frostbite': this.burst(x, z, 26, C, { speed: 5, size: 0.45, shape: 2, up: 2 }); this.pillar(x, z, 0.9, 4, C, 0.5); this.ring(x, z, 0.3, 2, C, 0.4); break;
      case 'executeFx': this.slash(x, z, 1.6, C, 0.6, 0.3, 1, 1.0); this.burst(x, z, 20, C, { speed: 5, size: 0.35, shape: 1 }); break;
      case 'recallBurst': case 'respawnFx': this.pillar(x, z, 1.0, 7, C, 0.8); this.ring(x, z, 0.3, 2.2, C, 0.6); this.burst(x, z, 24, C, { speed: 2, shape: 1, size: 0.35, grav: -2, y: 0.5 }); break;
      case 'towerCollapse': this.burst(x, z, 60, 0xe8eef8, { speed: 5, size: 1.0, life: 1.4, grav: 0.5, shape: 0, y: 2.5, spread: 2 }); this.burst(x, z, 30, C, { speed: 8, size: 0.4, shape: 2, y: 5 }); this.ring(x, z, 1, 6, C, 0.8); break;
      case 'slam': this.ring(x, z, 0.3, r * 1.1, 0xe8f4ff, 0.45); this.burst(x, z, 16, 0xffffff, { speed: 4, size: 0.45, shape: 2, y: 0.2, up: 1.5 }); break;
      case 'fountainZap': this.lightning(x, z + 0.01, x + 0.01, z, C, 1.0); this.burst(x, z, 8, C, { shape: 1, speed: 3 }); break;
      default: this.burst(x, z, 12, C || 0xffffff, { speed: 3, shape: 1 });
    }
    void ally;
  }
  meteor(x, z, r, delay) {
    const geo = new THREE.SphereGeometry(0.9, 16, 12);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffa040).multiplyScalar(3) }));
    const gy = this.h(x, z);
    const sx = x - 6, sz = z + 6, sy = gy + 26;
    this.add(m, delay, (p) => {
      const q = p * p;
      m.position.set(sx + (x - sx) * q, sy + (gy - sy) * q, sz + (z - sz) * q);
      if (rnd() < 0.9) this.parts.emit(m.position.x, m.position.y, m.position.z, (rnd() - 0.5) * 2, 2, (rnd() - 0.5) * 2, 0.6, 1.2, rnd() < 0.5 ? 0xff8a3a : 0xffd27a, 0, -1, 1, 1);
    });
  }
  hit(x, z, kind, color) {
    this.burst(x, z, kind === 2 ? 12 : 6, color, { speed: kind === 2 ? 5 : 3, size: kind === 2 ? 0.4 : 0.28, shape: 1, life: 0.35, y: 1.0 });
  }

  // ------------------------------------------------------------------ projectiles
  projVisual(kind, team) {
    const K = PROJ_KINDS[kind];
    const col = {
      arrow: 0xbff7c9, bigArrow: 0xbff7c9, bolt: 0xffe7b0, auroraBolt: 0x9ffff0, emberBolt: 0xffa040, holyBolt: 0xfff2b0, note: 0xffc7f0,
      minionBolt: team ? 0xff7a90 : 0x7fd0ff, siegeShell: team ? 0xff9a6a : 0x9fe8ff, towerShot: team ? 0xff5a78 : 0x58c8ff, coreShot: team ? 0xff5a78 : 0x58c8ff,
      owlFeather: 0x9fe8ff, snowball: 0xffffff, iceLance: 0x8fe6ff, shuriken: 0xc3a8ff, fireball: 0xff8a3a, snipe: 0x9fe8ff, bindRune: 0xbfe9ff, chainBolt: 0xfff27a, dragonBreath: 0x8fe6ff,
    }[K] ?? 0xffffff;
    const g = new THREE.Group();
    let mesh;
    const glowM = new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(2.6) });
    switch (K) {
      case 'arrow': case 'bigArrow': case 'bolt': case 'snipe':
        mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, K === 'snipe' ? 2.4 : K === 'bigArrow' ? 1.5 : 0.9, 5).rotateX(Math.PI / 2), glowM); break;
      case 'snowball': mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 })); break;
      case 'iceLance': mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.25).scale(0.6, 0.6, 3.2), glowM); break;
      case 'shuriken': mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.3).scale(1, 0.15, 1), glowM); break;
      case 'fireball': mesh = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), glowM); break;
      case 'bindRune': mesh = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.06, 6, 20), glowM); break;
      case 'siegeShell': mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), glowM); break;
      case 'towerShot': case 'coreShot': mesh = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), glowM); break;
      case 'note': mesh = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8).scale(1, 1, 0.6), glowM); break;
      default: mesh = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), glowM);
    }
    g.add(mesh);
    return { g, mesh, col, K };
  }
  syncProjectiles(list, dt) {
    const seen = new Set();
    for (const p of list) {
      seen.add(p.id);
      let v = this.projViews.get(p.id);
      if (!v) { v = this.projVisual(p.kind, p.team); this.projViews.set(p.id, v); this.group.add(v.g); }
      const y = this.h(p.x, p.z) + p.y;
      v.g.position.set(p.x, y, p.z);
      v.g.rotation.y = p.ang;
      if (v.K === 'shuriken' || v.K === 'bindRune') v.mesh.rotation.y += dt * 18;
      if (v.K === 'snowball') v.mesh.rotation.x += dt * 8;
      const trail = v.K === 'fireball' ? 3 : v.K === 'towerShot' || v.K === 'coreShot' || v.K === 'iceLance' || v.K === 'snipe' ? 2 : 1;
      for (let i = 0; i < trail; i++) this.parts.emit(p.x + (rnd() - 0.5) * 0.2, y + (rnd() - 0.5) * 0.2, p.z + (rnd() - 0.5) * 0.2, 0, 0.3, 0, v.K === 'fireball' ? 0.5 : 0.3, v.K === 'fireball' ? 0.9 : v.K === 'snowball' ? 0.6 : 0.4, v.K === 'fireball' ? (rnd() < 0.5 ? 0xff8a3a : 0xffd27a) : v.col, v.K === 'snowball' ? 2 : 0, 0, 2);
    }
    for (const [id, v] of this.projViews) if (!seen.has(id)) {
      this.group.remove(v.g);
      v.mesh.geometry.dispose(); v.mesh.material.dispose();
      this.projViews.delete(id);
      if (v.K === 'towerShot' || v.K === 'coreShot') this.burst(v.g.position.x, v.g.position.z, 10, v.col, { y: v.g.position.y - this.h(v.g.position.x, v.g.position.z), speed: 4, shape: 1 });
    }
  }
  syncZones(list, myTeam) {
    const seen = new Set();
    for (const z of list) {
      seen.add(z.id);
      let v = this.zoneViews.get(z.id);
      const K = ZONE_KINDS[z.kind];
      const col = K === 'blizzard' ? 0xa6ffdf : K === 'fireRing' ? 0xff7a3a : 0xa7ffcf;
      if (!v) {
        const disc = new THREE.Mesh(discGeo, softMat(col, 'disc'));
        disc.position.set(z.x, this.h(z.x, z.z) + 0.1, z.z); disc.scale.set(z.r, 1, z.r);
        this.group.add(disc);
        v = { disc, K, col };
        this.zoneViews.set(z.id, v);
      }
      v.disc.material.uniforms.uAlpha.value = 0.5 + 0.1 * Math.sin(this.t * 6);
      // particles
      const n = K === 'blizzard' ? 8 : K === 'fireRing' ? 6 : 5;
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2, rr = K === 'fireRing' ? z.r * (0.9 + rnd() * 0.1) : Math.sqrt(rnd()) * z.r;
        const px = z.x + Math.cos(a) * rr, pz = z.z + Math.sin(a) * rr, gy = this.h(px, pz);
        if (K === 'blizzard') this.parts.emit(px, gy + 3 + rnd() * 2, pz, Math.sin(a + 1.6) * 3, -4, Math.cos(a + 1.6) * 3, 0.8, 0.45, rnd() < 0.5 ? 0xffffff : col, 2, 0, 0);
        else if (K === 'fireRing') this.parts.emit(px, gy + 0.2, pz, 0, 2 + rnd() * 2, 0, 0.6, 0.8, rnd() < 0.5 ? 0xff7a3a : 0xffcf6b, 0, -1, 1, 0.5);
        else this.parts.emit(px, gy + 6, pz, 0, -22, 0, 0.3, 0.35, col, 1, 0, 0);
      }
    }
    for (const [id, v] of this.zoneViews) if (!seen.has(id)) { this.group.remove(v.disc); v.disc.material.dispose(); this.zoneViews.delete(id); }
    void myTeam;
  }
  update(dt, viewH) {
    this.t += dt;
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.t += dt;
      const p = Math.min(1, e.t / e.dur);
      e.update(p);
      if (e.t >= e.dur) { this.group.remove(e.mesh); e.mesh.material.dispose(); this.effects.splice(i, 1); }
    }
    this.parts.mat.uniforms.uScale.value = viewH * 0.55;
    this.parts.update(dt);
  }
}
