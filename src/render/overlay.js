// 2D overlay canvas: health bars, names, levels, damage numbers, gold pops.
import * as THREE from 'three';

const _v = new THREE.Vector3();
export class Overlay {
  constructor(canvas) {
    this.c = canvas;
    this.g = canvas.getContext('2d');
    this.nums = [];
    this.pr = Math.min(2, window.devicePixelRatio || 1);
    this.resize();
  }
  resize() {
    const w = this.c.clientWidth || window.innerWidth, h = this.c.clientHeight || window.innerHeight;
    this.w = w; this.h = h;
    this.c.width = Math.round(w * this.pr); this.c.height = Math.round(h * this.pr);
  }
  project(cam, x, y, z) {
    _v.set(x, y, z).project(cam);
    return [(_v.x * 0.5 + 0.5) * this.w, (-_v.y * 0.5 + 0.5) * this.h, _v.z < 1];
  }
  number(x, y, z, text, color, size = 16, kind = 0) {
    this.nums.push({ x, y, z, text, color, size, t: 0, dur: kind === 2 ? 1.1 : 0.9, vx: (Math.random() - 0.5) * 30, kind });
    if (this.nums.length > 60) this.nums.shift();
  }
  draw(cam, units, myId, myTeam, dt, heroNames) {
    const g = this.g;
    g.setTransform(this.pr, 0, 0, this.pr, 0, 0);
    g.clearRect(0, 0, this.w, this.h);
    g.textAlign = 'center';
    for (const u of units) {
      if (!u.alive || !u.visible) continue;
      const [sx, sy, ok] = this.project(cam, u.x, u.y + u.barH, u.z);
      if (!ok || sx < -80 || sx > this.w + 80 || sy < -40 || sy > this.h + 40) continue;
      const self = u.id === myId, ally = u.team === myTeam;
      if (u.kind === 0) {
        const w = 66, h = 8, x = sx - w / 2 + 8, y = sy;
        const hpK = Math.max(0, u.hp / u.maxHp), shK = Math.min(1 - hpK, u.shield / u.maxHp);
        g.fillStyle = 'rgba(8,14,30,0.82)'; roundRect(g, x - 1.5, y - 1.5, w + 3, h + (ally ? 6 : 3), 3); g.fill();
        g.fillStyle = self ? '#5ff08a' : ally ? '#43b4ff' : '#ff4d63';
        g.fillRect(x, y, w * hpK, h);
        if (shK > 0) { g.fillStyle = 'rgba(255,255,255,0.92)'; g.fillRect(x + w * hpK, y, w * shK, h); }
        g.fillStyle = 'rgba(8,14,30,0.55)';
        const step = 1000 / u.maxHp * w;
        if (step > 4) for (let s = step; s < w * hpK; s += step) g.fillRect(x + s, y + 1, 1, h - 2);
        g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x, y, w * hpK, 2);
        if (ally && u.maxMana > 0) { g.fillStyle = '#4a8cff'; g.fillRect(x, y + h + 1, w * Math.max(0, u.mana / u.maxMana), 2.5); }
        // level badge
        g.fillStyle = self ? '#2c8f52' : ally ? '#1f5f9c' : '#9c2236';
        g.beginPath(); g.arc(x - 9, y + 4, 9, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 1.2; g.stroke();
        g.fillStyle = '#fff'; g.font = 'bold 10px ui-rounded, -apple-system, system-ui, sans-serif'; g.fillText(u.level, x - 9, y + 7.5);
        // name
        g.font = '600 11px ui-rounded, -apple-system, system-ui, sans-serif';
        g.lineWidth = 3; g.strokeStyle = 'rgba(5,10,25,0.85)';
        const name = heroNames.get(u.id) || '';
        g.strokeText(name, sx + 8, y - 5); g.fillStyle = self ? '#d6ffe0' : ally ? '#d8eeff' : '#ffd6dc'; g.fillText(name, sx + 8, y - 5);
        if (u.recall > 0) {
          const k = 1 - u.recall / 5.5;
          g.fillStyle = 'rgba(8,14,30,0.8)'; roundRect(g, sx - 30, y + 14, 60, 6, 3); g.fill();
          g.fillStyle = '#9fe8ff'; g.fillRect(sx - 29, y + 15, 58 * k, 4);
        }
      } else if (u.kind === 1) {
        const w = 34, h = 4;
        g.fillStyle = 'rgba(8,14,30,0.75)'; g.fillRect(sx - w / 2 - 1, sy - 1, w + 2, h + 2);
        g.fillStyle = ally ? '#5cc0ff' : '#ff5b6e'; g.fillRect(sx - w / 2, sy, w * Math.max(0, u.hp / u.maxHp), h);
      } else if (u.kind === 4) {
        const boss = u.boss;
        const w = boss ? 96 : 48, h = boss ? 8 : 5;
        g.fillStyle = 'rgba(8,14,30,0.75)'; g.fillRect(sx - w / 2 - 1, sy - 1, w + 2, h + 2);
        g.fillStyle = boss ? '#c88cff' : '#ffc04d'; g.fillRect(sx - w / 2, sy, w * Math.max(0, u.hp / u.maxHp), h);
        if (boss) { g.font = '700 11px ui-rounded, -apple-system, system-ui, sans-serif'; g.lineWidth = 3; g.strokeStyle = 'rgba(5,10,25,0.85)'; g.strokeText(u.label, sx, sy - 5); g.fillStyle = '#f2e6ff'; g.fillText(u.label, sx, sy - 5); }
      } else {
        const w = u.kind === 3 ? 110 : 84, h = 8;
        g.fillStyle = 'rgba(8,14,30,0.8)'; roundRect(g, sx - w / 2 - 2, sy - 2, w + 4, h + 4, 3); g.fill();
        g.fillStyle = ally ? '#43b4ff' : '#ff4d63'; g.fillRect(sx - w / 2, sy, w * Math.max(0, u.hp / u.maxHp), h);
        if (u.invuln) { g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(sx - w / 2, sy, w, h); }
      }
    }
    // floating numbers
    g.textAlign = 'center';
    for (let i = this.nums.length - 1; i >= 0; i--) {
      const n = this.nums[i];
      n.t += dt;
      if (n.t > n.dur) { this.nums.splice(i, 1); continue; }
      const [sx, sy, ok] = this.project(cam, n.x, n.y, n.z);
      if (!ok) continue;
      const p = n.t / n.dur;
      const pop = p < 0.15 ? 1 + (0.15 - p) * 4 : 1;
      g.globalAlpha = p > 0.7 ? (1 - p) / 0.3 : 1;
      g.font = `800 ${Math.round(n.size * pop)}px ui-rounded, -apple-system, system-ui, sans-serif`;
      const y = sy - p * 42;
      g.lineWidth = 4; g.strokeStyle = 'rgba(10,10,30,0.85)';
      g.strokeText(n.text, sx + n.vx * p, y);
      g.fillStyle = n.color; g.fillText(n.text, sx + n.vx * p, y);
      g.globalAlpha = 1;
    }
  }
}
export function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
