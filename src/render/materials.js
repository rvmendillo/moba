// Shared materials, shader injections and procedural textures.
import * as THREE from 'three';

export const U = {
  uTime: { value: 0 },
  uFow: { value: null },
  uFowOn: { value: 0 },
  uPlayer: { value: new THREE.Vector3(9999, 0, 9999) },
  uPlayerBush: { value: 0 },
};

// ---------------------------------------------------------------- noise
const P = new Uint8Array(512);
{
  const p = [];
  let s = 1337;
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) P[i] = p[i & 255];
}
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
function grad(h, x, y) { const g = h & 7; const u = g < 4 ? x : y, v = g < 4 ? y : x; return ((g & 1) ? -u : u) + ((g & 2) ? -2 * v : 2 * v); }
export function noise2(x, y) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
  x -= Math.floor(x); y -= Math.floor(y);
  const u = fade(x), v = fade(y);
  const a = P[X] + Y, b = P[X + 1] + Y;
  return 0.25 * (THREE.MathUtils.lerp(THREE.MathUtils.lerp(grad(P[a], x, y), grad(P[b], x - 1, y), u), THREE.MathUtils.lerp(grad(P[a + 1], x, y - 1), grad(P[b + 1], x - 1, y - 1), u), v));
}
export function fbm(x, y, oct = 4) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * noise2(x * f, y * f); f *= 2.03; a *= 0.5; }
  return s;
}
export function hash2(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }

// ---------------------------------------------------------------- textures
export function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  if (opts.nearest) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; }
  t.userData.canvas = c;
  return t;
}
let gradMap = null;
export function gradientMap() {
  if (gradMap) return gradMap;
  const data = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 236, 236, 236, 255, 255, 255, 255, 255]);
  gradMap = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  gradMap.minFilter = gradMap.magFilter = THREE.NearestFilter;
  gradMap.generateMipmaps = false;
  gradMap.needsUpdate = true;
  return gradMap;
}
// particle atlas: 0 soft dot, 1 sparkle star, 2 snowflake, 3 ring
let atlas = null;
export function particleAtlas() {
  if (atlas) return atlas;
  atlas = canvasTex(256, 256, (g) => {
    const cell = 128;
    // soft dot
    let gr = g.createRadialGradient(64, 64, 0, 64, 64, 62);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, cell, cell);
    // sparkle star
    g.save(); g.translate(cell + 64, 64);
    gr = g.createRadialGradient(0, 0, 0, 0, 0, 30); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 30, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.95)';
    for (let k = 0; k < 4; k++) { g.rotate(Math.PI / 2); g.beginPath(); g.moveTo(-5, 0); g.lineTo(0, -60); g.lineTo(5, 0); g.fill(); }
    g.restore();
    // snowflake
    g.save(); g.translate(64, cell + 64); g.strokeStyle = 'rgba(255,255,255,1)'; g.lineWidth = 6; g.lineCap = 'round';
    for (let k = 0; k < 6; k++) { g.rotate(Math.PI / 3); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -52); g.moveTo(0, -30); g.lineTo(-14, -44); g.moveTo(0, -30); g.lineTo(14, -44); g.stroke(); }
    g.restore();
    // ring
    g.save(); g.translate(cell + 64, cell + 64);
    gr = g.createRadialGradient(0, 0, 36, 0, 0, 60); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 60, 0, Math.PI * 2); g.fill();
    g.restore();
  });
  return atlas;
}

// ---------------------------------------------------------------- shader injections
// adds world position varying + fog-of-war darkening (+ optional snow sparkle)
export function injectWorld(mat, opts = {}) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.uniforms.uTime = U.uTime;
    sh.uniforms.uFow = U.uFow;
    sh.uniforms.uFowOn = U.uFowOn;
    sh.uniforms.uPlayer = U.uPlayer;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldP;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 wpI = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wpI = instanceMatrix * wpI;
        #endif
        vWorldP = (modelMatrix * wpI).xyz;`);
    let frag = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWorldP;
      uniform float uTime; uniform sampler2D uFow; uniform float uFowOn; uniform vec3 uPlayer;
      float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }`);
    let extra = '';
    if (opts.sparkle) extra += `
      {
        vec2 cell = floor(vWorldP.xz * 5.0);
        float h = hash12(cell);
        vec2 f = fract(vWorldP.xz * 5.0) - 0.5;
        float d = length(f);
        float tw = 0.5 + 0.5 * sin(uTime * (1.5 + h * 3.0) + h * 40.0);
        float sp = step(0.965, h) * smoothstep(0.22, 0.0, d) * tw * tw;
        vec3 vdir = normalize(cameraPosition - vWorldP);
        sp *= 0.4 + 0.6 * pow(max(dot(normal, normalize(vdir + vec3(-0.4, 0.8, 0.45))), 0.0), 6.0);
        outgoingLight += vec3(1.0, 0.97, 0.92) * sp * ${opts.sparkle.toFixed(2)};
      }`;
    if (opts.fow !== false) extra += `
      if (uFowOn > 0.5) {
        float vis = texture2D(uFow, (vWorldP.xz + 60.0) / 120.0).r;
        outgoingLight *= mix(0.66, 1.0, vis);
        outgoingLight = mix(outgoingLight, outgoingLight * vec3(0.86, 0.9, 1.04), (1.0 - vis) * 0.5);
      }`;
    frag = frag.replace('#include <opaque_fragment>', extra + '\n#include <opaque_fragment>');
    sh.fragmentShader = frag;
  };
  mat.customProgramCacheKey = () => 'world' + (opts.sparkle || 0) + (opts.fow === false ? 'nf' : 'f') + (mat.type);
  return mat;
}

// toon material with rim light (anime look)
export function toonMat(opts = {}) {
  const m = new THREE.MeshToonMaterial({ color: opts.color ?? 0xd6d6d6, vertexColors: opts.vertexColors !== false, gradientMap: gradientMap(), map: opts.map || null, transparent: !!opts.transparent });
  const rim = new THREE.Color(opts.rim ?? 0xcfe8ff).lerp(new THREE.Color(0xffffff), 0.45);
  const rimK = opts.rimK ?? 0.22;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = { value: rim };
    sh.uniforms.uRimK = { value: rimK };
    sh.uniforms.uFlash = opts.flash || { value: 0 };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRim; uniform float uRimK; uniform float uFlash;')
      .replace('#include <opaque_fragment>', `
        {
          vec3 vd = normalize(vViewPosition);
          float rimF = pow(1.0 - clamp(dot(normal, -vd), 0.0, 1.0), 3.5);
          float up = clamp(normal.y * 0.5 + 0.5, 0.0, 1.0);
          outgoingLight += uRim * rimF * uRimK * (0.55 + 0.45 * up);
          outgoingLight = mix(outgoingLight, vec3(1.0, 0.95, 0.9) * 1.6, uFlash);
        }
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'toonrim';
  return m;
}
export function glowMat(intensity = 2.2, opts = {}) {
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: true, transparent: !!opts.transparent, opacity: opts.opacity ?? 1, depthWrite: !opts.transparent });
  m.color.setScalar(intensity);
  return m;
}
export function outlineMat(thick = 0.02, color = 0x10141f) {
  return new THREE.ShaderMaterial({
    uniforms: { uThick: { value: thick }, uColor: { value: new THREE.Color(color) } },
    vertexShader: `uniform float uThick; void main(){ vec3 p = position + normal * uThick; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform vec3 uColor; void main(){ gl_FragColor = vec4(uColor, 1.0); }`,
    side: THREE.BackSide,
  });
}
// soft additive material for FX meshes (uses vertex alpha via uv.y gradient)
export function fxMat(color, opts = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uAlpha: { value: 1 }, uTime: U.uTime, uK: { value: opts.k ?? 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: opts.frag || `uniform vec3 uColor; uniform float uAlpha; varying vec2 vUv; void main(){ float a = uAlpha * (1.0 - vUv.y) * smoothstep(0.0, 0.15, vUv.y + 0.05); gl_FragColor = vec4(uColor * 2.0, a); }`,
    transparent: true, depthWrite: false, blending: opts.normal ? THREE.NormalBlending : THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}

// ---------------------------------------------------------------- geometry merge helper
const _c = new THREE.Color();
export class PartBuilder {
  constructor() { this.parts = []; }
  add(geo, color, matrix, opts = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (matrix) g.applyMatrix4(matrix);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    _c.set(color);
    if (opts.colorFn) {
      const pos = g.attributes.position, nor = g.attributes.normal;
      for (let i = 0; i < n; i++) {
        const c = opts.colorFn(pos.getX(i), pos.getY(i), pos.getZ(i), nor.getX(i), nor.getY(i), nor.getZ(i), _c);
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
    } else for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    this.parts.push(g);
    return this;
  }
  get empty() { return this.parts.length === 0; }
  geometry() {
    if (!this.parts.length) return null;
    let total = 0;
    for (const g of this.parts) total += g.attributes.position.count;
    const out = new THREE.BufferGeometry();
    for (const [name, size] of [['position', 3], ['normal', 3], ['uv', 2], ['color', 3]]) {
      const arr = new Float32Array(total * size);
      let off = 0;
      for (const g of this.parts) { arr.set(g.attributes[name].array, off); off += g.attributes[name].array.length; }
      out.setAttribute(name, new THREE.BufferAttribute(arr, size));
    }
    out.computeBoundingSphere();
    return out;
  }
  mesh(material) { const g = this.geometry(); return g ? new THREE.Mesh(g, material) : null; }
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
export function mtx(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  _e.set(rx, ry, rz); _q.setFromEuler(_e); _v.set(x, y, z); _s.set(sx, sy, sz);
  return new THREE.Matrix4().compose(_v, _q, _s);
}
void _m;
