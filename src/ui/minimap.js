// Translucent minimap (top-left): terrain, lanes, structures, heroes, objectives, camera view.
import * as THREE from 'three';
import { WALLS, BUSHES, LANES, BASES, PITS, CAMPS, RIVER_HALF_W, PLAY } from '../sim/map.js';
import { F } from '../sim/world.js';
import { HEROES } from '../data/heroes.js';
import { MONSTER_LIST } from '../data/units.js';

export class Minimap {
  constructor(el, myTeam, portraits) {
    this.el = el; this.myTeam = myTeam; this.portraits = portraits;
    this.c = document.createElement('canvas');
    el.appendChild(this.c);
    this.pr = Math.min(3, window.devicePixelRatio || 1);
    this.size = el.clientWidth || 136;
    this.c.width = this.c.height = Math.round(this.size * this.pr);
    this.g = this.c.getContext('2d');
    this.base = this.drawBase();
    this.imgs = new Map();
    for (const h of HEROES) { const im = new Image(); im.src = portraits[h.id] || ''; this.imgs.set(h.index, im); }
    this.flip = myTeam === 1;
  }
  w2m(x, z) { const S = this.c.width; let u = (x + 60) / 120, v = (z + 60) / 120; if (this.flip) { u = 1 - u; v = 1 - v; } return [u * S, v * S]; }
  m2w(px, py) { let u = px / this.size, v = py / this.size; if (this.flip) { u = 1 - u; v = 1 - v; } return [u * 120 - 60, v * 120 - 60]; }
  drawBase() {
    const S = this.c.width;
    const c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d');
    const P = (x, z) => this.w2m(x, z);
    const poly = (pts) => { g.beginPath(); pts.forEach(([x, z], i) => { const [a, b] = P(x, z); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.closePath(); };
    g.fillStyle = 'rgba(210,225,245,0.30)'; g.fillRect(0, 0, S, S);
    // outside playable
    g.fillStyle = 'rgba(30,55,80,0.55)';
    const k = S / 120;
    g.fillRect(0, 0, S, (60 - PLAY) * k); g.fillRect(0, S - (60 - PLAY) * k, S, (60 - PLAY) * k); g.fillRect(0, 0, (60 - PLAY) * k, S); g.fillRect(S - (60 - PLAY) * k, 0, (60 - PLAY) * k, S);
    // river
    g.save(); const [cx, cy] = P(0, 0); g.translate(cx, cy); g.rotate(this.flip ? Math.PI / 4 : Math.PI / 4); g.fillStyle = 'rgba(90,170,225,0.65)'; g.fillRect(-S, -RIVER_HALF_W * k, S * 2, RIVER_HALF_W * 2 * k); g.restore();
    // lanes
    g.strokeStyle = 'rgba(235,242,252,0.85)'; g.lineWidth = 6.5 * k; g.lineCap = 'round'; g.lineJoin = 'round';
    for (const pts of Object.values(LANES)) { g.beginPath(); pts.forEach(([x, z], i) => { const [a, b] = P(x, z); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.stroke(); }
    // walls & bushes
    g.fillStyle = 'rgba(34,78,92,0.85)'; for (const w of WALLS) { poly(w); g.fill(); }
    g.fillStyle = 'rgba(60,150,130,0.75)'; for (const b of BUSHES) { poly(b); g.fill(); }
    // bases
    for (const b of BASES) { const [x, y] = P(b.core[0], b.core[1]); const gr = g.createRadialGradient(x, y, 0, x, y, 15 * k); gr.addColorStop(0, b.team === this.myTeam ? 'rgba(80,180,255,0.6)' : 'rgba(255,80,110,0.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, 15 * k, 0, Math.PI * 2); g.fill(); }
    for (const p of Object.values(PITS)) { const [x, y] = P(p.p[0], p.p[1]); g.fillStyle = 'rgba(150,120,220,0.45)'; g.beginPath(); g.arc(x, y, 5 * k, 0, Math.PI * 2); g.fill(); }
    return c;
  }
  draw(units, state, camera) {
    const g = this.g, S = this.c.width, k = S / 120;
    g.clearRect(0, 0, S, S);
    g.drawImage(this.base, 0, 0);
    const myTeam = this.myTeam;
    // camps
    CAMPS.forEach((c, i) => {
      const up = state.camps && state.camps[i] === -1;
      if (!up) return;
      const [x, y] = this.w2m(c.p[0], c.p[1]);
      g.fillStyle = c.kind === 'azure' ? '#58c8ff' : c.kind === 'ember' ? '#ff9a3a' : '#ffd36b';
      g.beginPath(); g.arc(x, y, (c.kind === 'azure' || c.kind === 'ember' ? 3.2 : 2.2) * this.pr, 0, Math.PI * 2); g.fill();
    });
    // objectives
    const obj = state.obj || [0, 0];
    [['tortoise', obj[0], '🐢'], ['titan', obj[1], '👑']].forEach(([key, t, em]) => {
      const p = PITS[key].p; const [x, y] = this.w2m(p[0], p[1]);
      g.font = `${Math.round(9 * this.pr)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      if (t === -1) { g.font = `${Math.round(11 * this.pr)}px "Apple Color Emoji","Noto Color Emoji",sans-serif`; g.fillText(em, x, y); }
      else if (t > 0 && t < 400) { g.fillStyle = 'rgba(255,255,255,0.85)'; g.font = `bold ${Math.round(8 * this.pr)}px sans-serif`; g.fillText(Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'), x, y); }
    });
    // units
    const heroes = [];
    for (const u of units) {
      const alive = (u.flags & F.alive) !== 0;
      const vis = state.visibleTo(u, myTeam);
      const [x, y] = this.w2m(u.x, u.z);
      const ally = u.team === myTeam;
      if (u.kind === 2 || u.kind === 3) {
        if (!alive) { g.fillStyle = 'rgba(80,90,110,0.7)'; g.fillRect(x - 2 * this.pr, y - 2 * this.pr, 4 * this.pr, 4 * this.pr); continue; }
        g.fillStyle = ally ? '#3fa9ff' : '#ff4d63'; g.strokeStyle = '#fff'; g.lineWidth = this.pr;
        const r = (u.kind === 3 ? 4.5 : 3.2) * this.pr;
        g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath(); g.fill(); g.stroke();
      } else if (u.kind === 1) {
        if (!alive || !vis) continue;
        g.fillStyle = ally ? '#8fd4ff' : '#ff8a99'; g.beginPath(); g.arc(x, y, 1.4 * this.pr, 0, Math.PI * 2); g.fill();
      } else if (u.kind === 4) {
        const t = MONSTER_LIST[u.type];
        if (!alive || t === 'tortoise' || t === 'titan') continue;
      } else if (u.kind === 0) {
        if (!alive || !vis) continue;
        heroes.push({ u, x, y, ally });
      }
    }
    // camera view polygon
    if (camera) {
      const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => {
        const v = new THREE.Vector3(sx, sy, 0.5).unproject(camera);
        const dir = v.sub(camera.position).normalize();
        const t = -camera.position.y / Math.min(-0.05, dir.y);
        return this.w2m(camera.position.x + dir.x * t, camera.position.z + dir.z * t);
      });
      g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 1.2 * this.pr;
      g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.stroke();
    }
    // heroes on top (portraits)
    heroes.sort((a, b) => (a.ally === b.ally ? 0 : a.ally ? 1 : -1));
    for (const { u, x, y, ally } of heroes) {
      const r = 6.5 * this.pr;
      g.save();
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.closePath();
      g.fillStyle = ally ? '#1f5f9c' : '#9c2236'; g.fill();
      g.clip();
      const im = this.imgs.get(u.type);
      if (im && im.complete && im.naturalWidth) g.drawImage(im, x - r, y - r, r * 2, r * 2);
      g.restore();
      g.lineWidth = 1.8 * this.pr; g.strokeStyle = u.isMe ? '#ffffff' : ally ? '#46b2ff' : '#ff4d63';
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
    }
  }
}
