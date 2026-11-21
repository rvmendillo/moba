// Ground indicators shown while dragging a skill button (range circle + area / direction).
import * as THREE from 'three';

const mk = (geo, color, op) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.4), transparent: true, opacity: op, depthWrite: false })); m.renderOrder = 3; m.visible = false; return m; };
export class AimIndicator {
  constructor(scene, env) {
    this.env = env;
    this.g = new THREE.Group();
    scene.add(this.g);
    this.range = mk(new THREE.RingGeometry(0.97, 1, 96).rotateX(-Math.PI / 2), 0xbfe9ff, 0.7);
    this.rangeFill = mk(new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2), 0x6fb8ff, 0.08);
    this.area = mk(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), 0x8fe6ff, 0.35);
    this.areaRing = mk(new THREE.RingGeometry(0.92, 1, 48).rotateX(-Math.PI / 2), 0xffffff, 0.8);
    this.line = mk(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5), 0x8fe6ff, 0.38);
    this.cone = mk(new THREE.CircleGeometry(1, 24, Math.PI / 2 - 0.45, 0.9).rotateX(-Math.PI / 2), 0x8fe6ff, 0.3);
    this.g.add(this.range, this.rangeFill, this.area, this.areaRing, this.line, this.cone);
  }
  hide() { for (const c of this.g.children) c.visible = false; }
  show(o) {
    this.hide();
    if (!o) return;
    const y = this.env.height(o.hx, o.hz) + 0.12;
    const col = o.cancel ? 0xff5a6e : 0x8fe6ff;
    if (o.range) { this.range.visible = this.rangeFill.visible = true; this.range.position.set(o.hx, y, o.hz); this.rangeFill.position.set(o.hx, y - 0.01, o.hz); this.range.scale.set(o.range, 1, o.range); this.rangeFill.scale.set(o.range, 1, o.range); }
    for (const m of [this.area, this.line, this.cone]) m.material.color.set(col).multiplyScalar(1.4);
    if (o.type === 'dir') {
      if (o.cone) { this.cone.visible = true; this.cone.position.set(o.hx, y + 0.01, o.hz); this.cone.rotation.y = Math.atan2(o.dx, o.dz) + Math.PI; this.cone.scale.set(o.len, 1, o.len); }
      else { this.line.visible = true; this.line.position.set(o.hx, y + 0.01, o.hz); this.line.rotation.y = Math.atan2(o.dx, o.dz); this.line.scale.set(o.width || 1, 1, o.len); }
    } else if (o.type === 'point' || o.type === 'self' || o.type === 'unit') {
      const r = o.radius || 1.2;
      const x = o.type === 'self' ? o.hx : o.x, z = o.type === 'self' ? o.hz : o.z;
      this.area.visible = this.areaRing.visible = true;
      const yy = this.env.height(x, z) + 0.14;
      this.area.position.set(x, yy, z); this.areaRing.position.set(x, yy + 0.01, z);
      this.area.scale.set(r, 1, r); this.areaRing.scale.set(r, 1, r);
      if (o.type === 'unit') { this.line.visible = true; this.line.position.set(o.hx, y + 0.01, o.hz); const dx = x - o.hx, dz = z - o.hz; this.line.rotation.y = Math.atan2(dx, dz); this.line.scale.set(0.25, 1, Math.hypot(dx, dz)); }
    }
  }
}
