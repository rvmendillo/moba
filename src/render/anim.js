// Procedural animation for humanoid rigs.
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const seg = (p, a, b) => ease((p - a) / (b - a));

export const ACTION_DUR = { atk: 0.45, atk2: 0.45, cast0: 0.5, cast1: 0.5, cast2: 0.6, spin: 0.62, thrust: 0.42, stab: 0.35, rend: 0.7, shoot: 0.42, aim: 0.7, strum: 0.7, spell: 0.4 };
const MELEE = new Set(['sword', 'mace_shield', 'spear', 'daggers', 'claws', 'fists']);

export function poseHumanoid(M, st, time) {
  const B = M.bones;
  const style = M.style;
  const P = {
    bodyY: 0, bodyRX: 0, bodyRY: 0, bodyRZ: 0, spineRX: 0, spineRY: 0, chestRX: 0, chestRY: 0, headRX: 0, headRY: 0, headRZ: 0,
    aLx: 0.05, aLy: 0, aLz: 0.14, fLx: -0.18, aRx: 0.05, aRy: 0, aRz: -0.14, fRx: -0.18,
    lLx: 0, lLz: 0.02, sLx: 0, lRx: 0, lRz: -0.02, sRx: 0, ftL: 0, ftR: 0, wRx: 0, wLx: 0, capeRX: 0.08,
  };
  const yeti = M.yeti;
  if (yeti) { P.aLz = 0.28; P.aRz = -0.28; }
  // ---- weapon idle hold
  switch (style) {
    case 'sword': P.aRx = -0.35; P.fRx = -0.5; P.aRz = -0.22; break;
    case 'mace_shield': P.aRx = -0.3; P.fRx = -0.6; P.aLx = -0.55; P.fLx = -0.9; P.aLz = 0.3; break;
    case 'spear': P.aRx = -0.25; P.fRx = -0.75; P.aRz = -0.25; P.wRx = -1.15; break;
    case 'daggers': case 'claws': P.aRx = -0.3; P.fRx = -0.9; P.aLx = -0.3; P.fLx = -0.9; P.aRz = -0.3; P.aLz = 0.3; break;
    case 'bow': P.aLx = -0.3; P.fLx = -0.5; P.aLz = 0.25; break;
    case 'crossbow': P.aRx = -0.6; P.fRx = -0.9; P.aLx = -0.7; P.fLx = -1.1; P.aLz = -0.25; P.aRz = 0.05; break;
    case 'staff_star': case 'staff_bell': case 'lantern': P.aRx = -0.25; P.fRx = -0.55; P.aRz = -0.2; break;
    case 'harp': P.aLx = -0.7; P.fLx = -1.2; P.aLz = -0.1; P.aRx = -0.5; P.fRx = -0.9; break;
  }
  // ---- idle breathing
  const br = Math.sin(time * 2.1 + (M.seed || 0));
  P.chestRX += br * 0.025; P.bodyY += br * 0.008; P.headRX += Math.sin(time * 1.3 + 1) * 0.03;
  P.aLz += br * 0.02; P.aRz -= br * 0.02;
  // ---- locomotion
  const run = Math.min(1, (st.speed || 0) / 4.5);
  if (run > 0.02) {
    const s = Math.sin(st.phase), c = Math.cos(st.phase);
    const k = run;
    P.lLx = lerp(P.lLx, -s * 0.85, k); P.lRx = lerp(P.lRx, s * 0.85, k);
    P.sLx = lerp(P.sLx, Math.max(0, s) * 1.25 + 0.15, k); P.sRx = lerp(P.sRx, Math.max(0, -s) * 1.25 + 0.15, k);
    P.ftL = lerp(0, -Math.max(0, s) * 0.4, k); P.ftR = lerp(0, -Math.max(0, -s) * 0.4, k);
    P.bodyY += Math.abs(c) * 0.07 * k - 0.03 * k;
    P.spineRX += 0.16 * k; P.headRX -= 0.1 * k;
    P.bodyRY += s * 0.08 * k; P.chestRY -= s * 0.14 * k;
    P.capeRX += 0.55 * k + Math.abs(c) * 0.1;
    const freeL = !['mace_shield', 'daggers', 'claws', 'crossbow', 'harp'].includes(style);
    const freeR = !['crossbow', 'harp', 'daggers', 'claws'].includes(style);
    if (freeL) P.aLx = lerp(P.aLx, s * 0.75, k);
    else P.aLx += s * 0.2 * k;
    if (freeR) P.aRx = lerp(P.aRx, -s * 0.6 + (style === 'sword' || style === 'spear' ? -0.3 : 0), k);
    else P.aRx += -s * 0.2 * k;
    if (style === 'daggers' || style === 'claws') { P.aLx = lerp(P.aLx, 0.6, k * 0.8); P.aRx = lerp(P.aRx, 0.6, k * 0.8); P.fLx = -0.4; P.fRx = -0.4; P.spineRX += 0.15 * k; }
  }
  // ---- actions
  const a = st.anim, age = st.age;
  const dur = ACTION_DUR[a];
  if (st.dash) dash(P, st, style, time);
  else if (dur && age < dur) {
    const p = age / dur;
    const w = Math.min(1, age / 0.06) * (p > 0.82 ? 1 - seg(p, 0.82, 1) : 1);
    const Q = { ...P };
    action(Q, a, p, style, M);
    for (const k in P) P[k] = lerp(P[k], Q[k], w);
  }
  if (st.recall) { P.aLx = -0.9; P.aRx = -0.9; P.aLz = -0.35; P.aRz = 0.35; P.fLx = -0.9; P.fRx = -0.9; P.headRX = 0.25; P.lLx = -0.2; P.sLx = 0.4; P.lRx = 0.5; P.sRx = 1.4; P.bodyY -= 0.12; }
  if (st.stun) { P.headRZ += Math.sin(time * 6) * 0.25; P.headRX += 0.2; P.aLz += 0.2; P.aRz -= 0.2; P.aLx = 0.1; P.aRx = 0.1; P.bodyRZ += Math.sin(time * 3) * 0.08; P.spineRX += 0.2; }
  if (st.air) { P.bodyRX += Math.sin(time * 9) * 0.25; P.aLz = 1.2 + Math.sin(time * 14) * 0.4; P.aRz = -1.2 - Math.sin(time * 14) * 0.4; P.lLx = -0.6; P.sLx = 1.2; P.lRx = 0.3; P.sRx = 0.9; }
  if (st.dead) {
    const d = ease(Math.min(1, st.deadAge / 0.55));
    P.bodyRX = lerp(P.bodyRX, -1.42, d); P.bodyY = lerp(P.bodyY, -M.hipY * 0.72, d);
    P.aLz = lerp(P.aLz, 1.3, d); P.aRz = lerp(P.aRz, -1.3, d); P.aLx = lerp(P.aLx, -0.2, d); P.aRx = lerp(P.aRx, -0.2, d);
    P.lLx = lerp(P.lLx, -0.15, d); P.lRx = lerp(P.lRx, 0.1, d); P.sLx = lerp(P.sLx, 0.2, d); P.sRx = lerp(P.sRx, 0.5, d); P.headRX = lerp(P.headRX, -0.3, d); P.headRY = lerp(P.headRY, 0.6, d);
  }
  apply(B, P, M);
}

function action(P, a, p, style, M) {
  const melee = MELEE.has(style);
  switch (a) {
    case 'atk': case 'atk2': {
      const alt = a === 'atk2';
      if (style === 'sword' || style === 'mace_shield') {
        if (!alt || style === 'mace_shield') {
          const up = seg(p, 0, 0.38), down = seg(p, 0.38, 0.58);
          P.aRx = lerp(lerp(P.aRx, -2.7, up), 0.5, down); P.aRz = lerp(-0.4, -0.15, down); P.fRx = lerp(-0.4, -0.1, down);
          P.chestRY = lerp(0.35 * up, -0.35, down); P.spineRX = lerp(-0.12 * up, 0.28, down);
        } else {
          const back = seg(p, 0, 0.35), sw = seg(p, 0.35, 0.58);
          P.aRx = -1.35; P.aRy = lerp(1.1 * back, -1.25, sw); P.aRz = -0.2; P.fRx = -0.25;
          P.chestRY = lerp(0.45 * back, -0.55, sw);
        }
      } else if (style === 'spear') {
        const back = seg(p, 0, 0.35), th = seg(p, 0.35, 0.55);
        P.aRx = lerp(-1.0, -1.55, th); P.fRx = lerp(-1.4 * back, -0.05, th); P.wRx = lerp(-1.45, -1.57, th);
        P.chestRY = lerp(0.4 * back, -0.25, th); P.spineRX = lerp(-0.1, 0.3, th); P.bodyY -= 0.05 * th;
        P.aLx = -0.9; P.fLx = -0.8;
      } else if (style === 'daggers' || style === 'claws' || style === 'fists') {
        const back = seg(p, 0, 0.3), sw = seg(p, 0.3, 0.52);
        const side = alt ? 'L' : 'R', sg = alt ? 1 : -1;
        const ax = lerp(-0.4 - 0.5 * back, -1.55, sw);
        const az = lerp(sg * (1.0 * back), sg * -0.25, sw);
        if (style === 'fists') { P['a' + side + 'x'] = lerp(-0.9, -1.6, sw); P['f' + side + 'x'] = lerp(-1.9 * back - 0.4, 0, sw); }
        else { P['a' + side + 'x'] = ax; P['a' + side + 'z'] = az; P['f' + side + 'x'] = lerp(-1.2, -0.2, sw); }
        P.chestRY = sg * lerp(-0.35 * back, 0.4, sw); P.spineRX += 0.15;
      } else if (style === 'bow') {
        const draw = seg(p, 0, 0.45), rel = seg(p, 0.5, 0.62);
        P.aLx = -1.55; P.aLz = 0.0; P.fLx = 0; P.aLy = 0.0;
        P.aRx = -1.5; P.aRz = lerp(0.2, 0.6, rel); P.fRx = lerp(-1.0, -2.3, draw) * (1 - rel * 0.6);
        P.chestRY = 0.55; P.headRY = -0.45;
      } else if (style === 'crossbow') {
        const rec = seg(p, 0.45, 0.55) * (1 - seg(p, 0.6, 1));
        P.aRx = -1.45; P.fRx = -0.35; P.aLx = -1.35; P.fLx = -0.75; P.aLz = -0.4;
        P.chestRX = -0.15 * rec; P.spineRX = -0.08 * rec; P.headRX = 0.05;
      } else if (style === 'harp') {
        const s = Math.sin(p * Math.PI * 3);
        P.aRx = -0.9; P.aRy = s * 0.5; P.fRx = -1.1; P.chestRY = 0.15;
      } else {
        // staffs / lantern: point and flick
        const up = seg(p, 0, 0.35), fw = seg(p, 0.35, 0.55);
        P.aRx = lerp(-1.4 * up - 0.3, -1.2, fw); P.fRx = lerp(-0.6, -0.15, fw); P.wRx = lerp(0, -1.0, fw);
        P.aLx = lerp(0, -0.9, fw); P.aLz = 0.35; P.chestRY = lerp(0.2, -0.2, fw);
      }
      break;
    }
    case 'cast0': case 'cast1': case 'cast2': {
      const big = a === 'cast2';
      if (melee && style !== 'fists') {
        const up = seg(p, 0, 0.35), sw = seg(p, 0.35, 0.6);
        P.aRx = lerp(lerp(P.aRx, -2.8, up), 0.2, sw); P.aRz = lerp(-0.9 * up, 0.2, sw); P.chestRY = lerp(0.5 * up, -0.6, sw);
        P.aLx = lerp(0, -1.0, up); P.aLz = 0.6; P.spineRX = lerp(-0.15, 0.35, sw);
      } else if (style === 'bow' || style === 'crossbow') {
        const up = seg(p, 0, 0.4);
        P.aLx = -1.6; P.aRx = -1.6; P.fRx = lerp(-1.8, -0.6, seg(p, 0.45, 0.6)); P.fLx = -0.2; P.chestRY = 0.4; P.spineRX = -0.1 * up;
      } else {
        const up = seg(p, 0, 0.35), fw = seg(p, 0.35, 0.6);
        P.aRx = lerp(-2.6 * up, -1.3, fw); P.aLx = lerp(-2.4 * up, -1.4, fw); P.aLz = lerp(0.6, 0.3, fw); P.aRz = lerp(-0.6, -0.3, fw);
        P.fLx = -0.3; P.fRx = -0.3; P.wRx = -0.6 * fw; P.headRX = lerp(-0.3 * up, 0.1, fw); P.spineRX = lerp(-0.2 * up, 0.15, fw);
        if (big) { P.bodyY += 0.12 * Math.sin(p * Math.PI); }
      }
      break;
    }
    case 'spin': P.bodyRY = p * Math.PI * 4; P.aLz = 1.45; P.aRz = -1.45; P.aRx = -0.3; P.aLx = -0.2; P.spineRX = 0.15; break;
    case 'thrust': { const th = seg(p, 0.15, 0.4); P.aRx = -1.55; P.fRx = lerp(-1.5, 0, th); P.wRx = -1.57; P.spineRX = 0.35 * th; P.chestRY = -0.3 * th; P.lLx = -0.6 * th; P.lRx = 0.5 * th; P.sRx = 0.3; break; }
    case 'stab': { const th = seg(p, 0.1, 0.35); P.aLx = lerp(-0.5, -1.6, th); P.aRx = lerp(-0.5, -1.6, th); P.fLx = lerp(-1.4, 0, th); P.fRx = lerp(-1.4, 0, th); P.spineRX = 0.35; P.lLx = -0.6; P.sLx = 0.8; break; }
    case 'rend': { const s = Math.sin(p * Math.PI * 5); P.aRx = -1.2 + s * 0.6; P.aLx = -1.2 - s * 0.6; P.aRz = -0.4 + s * 0.6; P.aLz = 0.4 + s * 0.6; P.chestRY = s * 0.45; P.spineRX = 0.3; break; }
    case 'shoot': { const rec = seg(p, 0.15, 0.3) * (1 - seg(p, 0.4, 1)); P.aRx = -1.5; P.aLx = -1.35; P.fLx = -0.7; P.aLz = -0.4; P.chestRX = -0.3 * rec; P.bodyY -= 0.05 * rec; break; }
    case 'aim': P.aRx = -1.5; P.fRx = -0.2; P.aLx = -1.4; P.fLx = -0.7; P.aLz = -0.42; P.lLx = -0.5; P.sLx = 0.7; P.lRx = 0.35; P.sRx = 0.9; P.bodyY -= 0.12; P.headRX = 0.15; break;
    case 'strum': { const s = Math.sin(p * Math.PI * 4); P.aRx = -0.9 + s * 0.2; P.aRy = s * 0.7; P.fRx = -1.2; P.chestRY = s * 0.2; P.headRZ = s * 0.15; P.bodyY += 0.05 * Math.abs(s); break; }
    case 'spell': { const s = Math.sin(p * Math.PI); P.aLx = -1.8 * s; P.aRx = -1.8 * s; P.aLz = 0.5; P.aRz = -0.5; break; }
  }
}

function dash(P, st, style, time) {
  const a = st.anim;
  const p = st.dashP || 0;
  switch (a) {
    case 'leap': case 'glide':
      if (a === 'glide') { P.aLz = 1.35; P.aRz = -1.35; P.aLx = 0.3; P.aRx = 0.3; P.lLx = 0.4; P.lRx = 0.5; P.spineRX = 0.35; P.capeRX = 1.0; }
      else { const up = p < 0.5; P.aRx = up ? -2.9 : lerp(-2.9, 0.4, (p - 0.5) * 2); P.aLx = up ? -2.6 : -1.2; P.lLx = -1.1; P.sLx = 1.7; P.lRx = -0.7; P.sRx = 1.9; P.spineRX = up ? -0.25 : 0.4; P.capeRX = 1.2; }
      break;
    case 'roll': P.bodyRX = p * Math.PI * 2; P.lLx = -1.3; P.sLx = 2.0; P.lRx = -1.3; P.sRx = 2.0; P.aLx = -1.2; P.aRx = -1.2; P.bodyY -= 0.3; break;
    case 'rush': P.spineRX = 0.55; P.aLx = -1.45; P.fLx = -0.3; P.aRx = 0.6; P.lLx = -0.8; P.sLx = 0.6; P.lRx = 0.7; P.sRx = 0.4; P.capeRX = 1.3; break;
    case 'dashSlash': P.spineRX = 0.5; P.aRx = 0.9; P.aRz = -0.6; P.aLx = 0.5; P.lLx = -0.9; P.sLx = 0.5; P.lRx = 0.8; P.sRx = 0.6; P.capeRX = 1.3; P.chestRY = 0.4; break;
    default: P.spineRX = 0.45; P.aLx = 0.6; P.aRx = 0.6; P.lLx = -0.7; P.lRx = 0.6; P.capeRX = 1.2;
  }
  void time; void style;
}

function apply(B, P, M) {
  B.body.position.y = M.hipY + P.bodyY;
  B.body.rotation.set(P.bodyRX, P.bodyRY, P.bodyRZ);
  B.spine.rotation.set(P.spineRX, P.spineRY, 0);
  B.chest.rotation.set(P.chestRX, P.chestRY, 0);
  B.head.rotation.set(P.headRX, P.headRY, P.headRZ);
  B.armL.rotation.set(P.aLx, P.aLy, P.aLz);
  B.armR.rotation.set(P.aRx, P.aRy, P.aRz);
  B.foreArmL.rotation.set(P.fLx, 0, 0);
  B.foreArmR.rotation.set(P.fRx, 0, 0);
  B.legL.rotation.set(P.lLx, 0, P.lLz);
  B.legR.rotation.set(P.lRx, 0, P.lRz);
  B.shinL.rotation.set(P.sLx, 0, 0);
  B.shinR.rotation.set(P.sRx, 0, 0);
  B.footL.rotation.set(P.ftL, 0, 0);
  B.footR.rotation.set(P.ftR, 0, 0);
  if (B.weaponR && M.style === 'spear') B.weaponR.rotation.x = Math.PI / 2 + P.wRx + 1.15;
  else if (B.weaponR && (M.style === 'staff_star' || M.style === 'staff_bell' || M.style === 'lantern')) B.weaponR.rotation.x = P.wRx * 0.8;
  if (B.cape) B.cape.rotation.x = P.capeRX;
  if (B.scarfTail) B.scarfTail.rotation.x = 0.3 + P.capeRX * 0.6;
  if (B.tail) B.tail.rotation.x = -0.4 + Math.sin(M.t * 2) * 0.15;
  if (B.star) { B.star.rotation.y = M.t * 2; B.star.position.y = 1.32 + Math.sin(M.t * 3) * 0.05; }
}
