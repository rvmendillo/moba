// Original hero roster for Frostvale Legends. Two heroes per class.
// Skill cast signature: cast(w, h, aim, L) where L is the skill rank (1-based).
// Damage types: 'p' physical, 'm' magic, 't' true.

const lv = (arr, L) => arr[Math.max(0, Math.min(arr.length - 1, L - 1))];
const six = (a, step) => [0, 1, 2, 3, 4, 5].map((i) => +(a + step * i).toFixed(2));
const three = (a, step) => [0, 1, 2].map((i) => +(a + step * i).toFixed(2));

export const ROLES = ['Tank', 'Fighter', 'Assassin', 'Mage', 'Marksman', 'Support'];
export const ROLE_LANE = { Tank: 'roam', Support: 'roam', Fighter: 'exp', Assassin: 'jungle', Mage: 'mid', Marksman: 'gold' };

export const HEROES = [
  // ------------------------------------------------------------------ TANKS
  {
    id: 'brannoc', name: 'Brannoc', title: 'Glacier Warden', role: 'Tank', lane: 'roam', difficulty: 1,
    lore: 'Sworn shield of the Frostvale gates, Brannoc has never let a friend fall while he still stands.',
    stats: { hp: 2850, hpG: 165, mana: 450, manaG: 28, atk: 112, atkG: 6.5, armor: 24, armorG: 2.4, mr: 18, mrG: 1.4, as: 0.85, asG: 0.012, range: 1.9, ms: 6.1, hpReg: 10, hpRegG: 0.6, mpReg: 4, mpRegG: 0.25 },
    attack: { style: 'mace', proj: null },
    passive: { name: 'Frost Bulwark', icon: 'shield', desc: 'Every 10 seconds Brannoc gains a shield equal to 6% of his max HP.' },
    skills: [
      {
        name: 'Shield Rush', icon: 'shieldDash', color: '#8fd8ff', aim: 'dir', range: 7, width: 1.6,
        cd: six(12, -0.6), mana: 60, v: { dmg: six(140, 40) },
        desc: 'Charges forward with his tower shield, dealing {dmg} (+6% Max HP) physical damage to enemies in the path. The first enemy hero hit is stunned for 1s.',
        ai: { type: 'engage', range: 6.5 },
        cast(w, h, a, L) {
          const tx = h.x + a.dx * 7, tz = h.z + a.dz * 7;
          w.sfx('dash', h.x, h.z);
          w.dash(h, tx, tz, { speed: 18, hitR: 1.4, anim: 'rush', stopOnHero: true, fx: 'iceTrail',
            onHit: (t) => { w.dmg(h, t, lv(this.v.dmg, L) + 0.06 * h.st.maxHp, 'p', { skill: 1 }); if (t.kind === 'hero') { w.cc(t, 'stun', 1, h); w.fx('impact', t.x, t.z, 1.4, 0x9fe4ff); return 'stop'; } } });
          return true;
        },
      },
      {
        name: 'Frost Bastion', icon: 'quake', color: '#a7c8ff', aim: 'self', radius: 4,
        cd: six(11, -0.5), mana: 70, v: { dmg: six(120, 40) },
        desc: 'Slams the ground, dealing {dmg} (+4% Max HP) magic damage to nearby enemies and slowing them by 40% for 2s. Gains 25% damage reduction for 3s.',
        ai: { type: 'cc', range: 3.6 },
        cast(w, h, a, L) {
          w.fx('nova', h.x, h.z, 4, 0x9ad6ff); w.sfx('quake', h.x, h.z);
          for (const t of w.enemies(h, h.x, h.z, 4)) { w.dmg(h, t, lv(this.v.dmg, L) + 0.04 * h.st.maxHp, 'm', { skill: 2 }); w.cc(t, 'slow', 2, h, 0.4); }
          w.buff(h, { id: 'bastion', dur: 3, mods: { dmgRed: 0.25 }, fx: 'iceArmor' });
          return true;
        },
      },
      {
        name: 'Glacial Prison', icon: 'leap', color: '#6fe9ff', aim: 'point', range: 8, radius: 3.5, ult: true,
        cd: three(50, -5), mana: 120, v: { dmg: three(300, 150) },
        desc: 'Leaps to the target area. On landing, enemies within range take {dmg} (+8% Max HP) physical damage and are knocked airborne for 1.2s.',
        ai: { type: 'engage', range: 8, minHeroes: 1 },
        cast(w, h, a, L) {
          w.tele(a.x, a.z, 3.5, 0.55, 'ult', h.team);
          w.dash(h, a.x, a.z, { speed: 15, arc: 4, untarget: true, anim: 'leap', ignoreWalls: true,
            onEnd: () => {
              w.fx('shatter', h.x, h.z, 3.5, 0x7fe9ff); w.sfx('bigImpact', h.x, h.z); w.shake(0.5);
              for (const t of w.enemies(h, h.x, h.z, 3.5)) { w.dmg(h, t, lv(this.v.dmg, L) + 0.08 * h.st.maxHp, 'p', { skill: 3 }); w.cc(t, 'air', 1.2, h); }
            } });
          return true;
        },
      },
    ],
    onTick(w, h, dt) {
      h.pv.bulwark = (h.pv.bulwark || 0) - dt;
      if (h.pv.bulwark <= 0) { h.pv.bulwark = 10; w.shield(h, 0.06 * h.st.maxHp, 10, h, 'bulwark'); }
    },
    build: ['b_iron', 'd_aegis', 'd_cloak', 'd_rime', 'd_guard', 'd_bulwark'],
    skillOrder: [0, 1],
    spell: 'blink',
    look: {
      body: 'human', height: 1.12, bulk: 1.35, skin: '#e9c3a6', eyes: '#68c8ff',
      hair: { style: 'short', color: '#d9e4f2' }, beard: '#d9e4f2',
      colors: { main: '#3c6fb4', second: '#c9d7ea', accent: '#ffd479', dark: '#22324f', glow: '#7fe8ff' },
      outfit: 'heavy', head: 'horned_helm', cape: '#2a5aa0', weapon: 'mace_shield',
    },
  },
  {
    id: 'mamu', name: 'Mamu', title: 'Yeti of the Peaks', role: 'Tank', lane: 'roam', difficulty: 1,
    lore: 'A gentle giant who adopted every lost traveller on the mountain. Do not wake him from his nap.',
    stats: { hp: 3000, hpG: 170, mana: 420, manaG: 25, atk: 115, atkG: 7, armor: 22, armorG: 2.2, mr: 20, mrG: 1.5, as: 0.85, asG: 0.012, range: 2.0, ms: 6.0, hpReg: 9, hpRegG: 0.6, mpReg: 4, mpRegG: 0.25 },
    attack: { style: 'fists', proj: null },
    passive: { name: 'Thick Fur', icon: 'heart', desc: 'After not taking damage for 6s, Mamu regenerates 1.5% of his max HP per second.' },
    skills: [
      {
        name: 'Big Snowball', icon: 'snowball', color: '#e8f6ff', aim: 'dir', range: 10, width: 1.4,
        cd: six(10, -0.5), mana: 65, v: { dmg: six(160, 50) },
        desc: 'Hurls a giant snowball that stuns the first enemy hit for 1s and deals {dmg} (+5% Max HP) magic damage.',
        ai: { type: 'cc', range: 9.5, skillshot: 16 },
        cast(w, h, a, L) {
          w.sfx('throw', h.x, h.z);
          w.proj(h, { dx: a.dx, dz: a.dz, speed: 16, range: 10, width: 1.4, kind: 'snowball', y: 1.6,
            onHit: (t) => { w.dmg(h, t, lv(this.v.dmg, L) + 0.05 * h.st.maxHp, 'm', { skill: 1 }); w.cc(t, 'stun', 1, h); w.fx('snowBurst', t.x, t.z, 2, 0xffffff); w.sfx('snowHit', t.x, t.z); return 'stop'; } });
          return true;
        },
      },
      {
        name: 'Belly Flop', icon: 'leap', color: '#cfe8ff', aim: 'dir', range: 5.5, radius: 2.8,
        cd: six(12, -0.5), mana: 60, v: { dmg: six(120, 40) },
        desc: 'Bounces forward and flops down, dealing {dmg} (+60% Physical Attack) physical damage around the landing spot and knocking enemies airborne for 0.6s.',
        ai: { type: 'engage', range: 6.5 },
        cast(w, h, a, L) {
          const tx = h.x + a.dx * 5.5, tz = h.z + a.dz * 5.5;
          w.dash(h, tx, tz, { speed: 13, arc: 2.2, anim: 'leap',
            onEnd: () => {
              w.fx('snowBurst', h.x, h.z, 2.8, 0xffffff); w.sfx('quake', h.x, h.z); w.shake(0.3);
              for (const t of w.enemies(h, h.x, h.z, 2.8)) { w.dmg(h, t, lv(this.v.dmg, L) + 0.6 * h.st.atk, 'p', { skill: 2 }); w.cc(t, 'air', 0.6, h); }
            } });
          return true;
        },
      },
      {
        name: 'Avalanche Roar', icon: 'roar', color: '#9fe0ff', aim: 'self', radius: 5.5, ult: true,
        cd: three(55, -5), mana: 130, v: { dmg: three(250, 125) },
        desc: 'Lets out a mighty roar that drags nearby enemies toward Mamu, stunning them for 1.2s and dealing {dmg} (+6% Max HP) magic damage.',
        ai: { type: 'engage', range: 4.8, minHeroes: 1 },
        cast(w, h, a, L) {
          w.fx('roar', h.x, h.z, 5.5, 0xbfefff); w.sfx('roar', h.x, h.z); w.shake(0.4);
          for (const t of w.enemies(h, h.x, h.z, 5.5)) {
            w.cc(t, 'pull', 0.25, h, { x: h.x, z: h.z, dist: Math.max(0, Math.hypot(t.x - h.x, t.z - h.z) - 1.6) });
            w.cc(t, 'stun', 1.2, h);
            w.dmg(h, t, lv(this.v.dmg, L) + 0.06 * h.st.maxHp, 'm', { skill: 3 });
          }
          return true;
        },
      },
    ],
    onTick(w, h, dt) {
      if (w.time - h.lastHurtT > 6 && h.hp < h.st.maxHp) h.hp = Math.min(h.st.maxHp, h.hp + h.st.maxHp * 0.015 * dt);
    },
    build: ['b_myst', 'd_cloak', 'd_aegis', 'd_guard', 'd_thorn', 'd_helm'],
    skillOrder: [0, 1],
    spell: 'aegis',
    look: {
      body: 'yeti', height: 1.2, bulk: 1.6, skin: '#f3f7ff', eyes: '#46b6ff',
      hair: { style: 'none', color: '#ffffff' },
      colors: { main: '#f4f8ff', second: '#a9cdf0', accent: '#5fa8e8', dark: '#6b7fa3', glow: '#8fe6ff' },
      outfit: 'fur', head: 'yeti_horns', weapon: 'fists', scarf: '#e9546b',
    },
  },
  // ------------------------------------------------------------------ FIGHTERS
  {
    id: 'kael', name: 'Kael', title: 'the Frostblade', role: 'Fighter', lane: 'exp', difficulty: 2,
    lore: 'A wandering swordsman whose blade was forged from a falling star frozen in the northern lake.',
    stats: { hp: 2650, hpG: 150, mana: 400, manaG: 25, atk: 125, atkG: 8.5, armor: 20, armorG: 2.1, mr: 15, mrG: 1.2, as: 0.95, asG: 0.016, range: 2.0, ms: 6.3, hpReg: 8, hpRegG: 0.5, mpReg: 4, mpRegG: 0.25 },
    attack: { style: 'sword', proj: null },
    passive: { name: 'Frost Edge', icon: 'sword', desc: 'Every 3rd basic attack deals 60% bonus damage and slows the target by 30% for 1s.' },
    skills: [
      {
        name: 'Crescent Dash', icon: 'slashDash', color: '#9fe8ff', aim: 'dir', range: 6, width: 1.6,
        cd: six(8, -0.5), mana: 45, v: { dmg: six(150, 50) },
        desc: 'Dashes forward, slashing enemies in the path for {dmg} (+70% Physical Attack) physical damage.',
        ai: { type: 'engage', range: 6, alsoEscape: true },
        cast(w, h, a, L) {
          w.sfx('slash', h.x, h.z);
          w.dash(h, h.x + a.dx * 6, h.z + a.dz * 6, { speed: 24, hitR: 1.5, anim: 'dashSlash', fx: 'slashTrail',
            onHit: (t) => { w.dmg(h, t, lv(this.v.dmg, L) + 0.7 * h.st.atk, 'p', { skill: 1 }); w.fx('slashHit', t.x, t.z, 1, 0x9fe8ff); } });
          return true;
        },
      },
      {
        name: 'Whirling Blades', icon: 'whirl', color: '#c7f3ff', aim: 'self', radius: 3.2,
        cd: six(9, -0.5), mana: 55, v: { dmg: six(90, 30) },
        desc: 'Spins twice, each spin dealing {dmg} (+45% Physical Attack) physical damage to nearby enemies. Heals for 35% of the damage dealt to heroes.',
        ai: { type: 'damage', range: 3, wave: true },
        cast(w, h, a, L) {
          const spin = () => {
            if (!h.alive) return;
            w.fx('whirl', h.x, h.z, 3.2, 0xbff2ff); w.sfx('whirl', h.x, h.z);
            for (const t of w.enemies(h, h.x, h.z, 3.2)) {
              const d = w.dmg(h, t, lv(this.v.dmg, L) + 0.45 * h.st.atk, 'p', { skill: 2 });
              if (t.kind === 'hero') w.heal(h, h, d * 0.35);
            }
          };
          h.anim = 'spin'; h.animT = w.time;
          spin(); w.after(0.3, spin);
          return true;
        },
      },
      {
        name: "Winter's Verdict", icon: 'execute', color: '#7fd0ff', aim: 'unit', range: 6.5, ult: true, heroOnly: true,
        cd: three(40, -5), mana: 100, v: { dmg: three(280, 140) },
        desc: 'Leaps onto an enemy hero and strikes, dealing {dmg} (+120% Physical Attack) plus 15% of their missing HP as physical damage. Kills refund half the cooldown.',
        ai: { type: 'execute', range: 6.5, hpBelow: 0.55 },
        cast(w, h, a, L) {
          const t = a.target;
          w.dash(h, t.x, t.z, { speed: 26, arc: 1.5, anim: 'leap', untarget: true, stopDist: 1.2, targetId: t.id,
            onEnd: () => {
              if (!t.alive) return;
              w.fx('verdict', t.x, t.z, 2.4, 0x8fe0ff); w.sfx('bigSlash', t.x, t.z); w.shake(0.35);
              w.dmg(h, t, lv(this.v.dmg, L) + 1.2 * h.st.atk + 0.15 * (t.st.maxHp - t.hp), 'p', { skill: 3 });
              if (!t.alive) h.skills[2].cd *= 0.5;
            } });
          return true;
        },
      },
    ],
    onAttackHit(w, h, t, dmg) {
      h.pv.edge = (h.pv.edge || 0) + 1;
      if (h.pv.edge >= 3) { h.pv.edge = 0; w.dmg(h, t, dmg * 0.6, 'p', { passive: 1 }); w.cc(t, 'slow', 1, h, 0.3); w.fx('frostSpark', t.x, t.z, 1, 0x9fe8ff); }
    },
    build: ['b_iron', 'a_cleaver', 'a_blade', 'd_rime', 'a_reaper', 'd_guard'],
    skillOrder: [0, 1],
    spell: 'execute',
    look: {
      body: 'human', height: 1.04, bulk: 1.0, skin: '#f2d3bd', eyes: '#55c7ff',
      hair: { style: 'spiky', color: '#eef4ff', color2: '#9cc9ff' },
      colors: { main: '#25467e', second: '#e9f1ff', accent: '#8fd6ff', dark: '#141f38', glow: '#8fe6ff' },
      outfit: 'coat', head: null, scarf: '#9fd8ff', weapon: 'sword',
    },
  },
  {
    id: 'valka', name: 'Valka', title: 'Skyspear Valkyrie', role: 'Fighter', lane: 'exp', difficulty: 2,
    lore: 'Descended from the storm-riders of the high fjords, Valka answers every challenge from above.',
    stats: { hp: 2600, hpG: 150, mana: 420, manaG: 26, atk: 122, atkG: 8, armor: 21, armorG: 2.1, mr: 16, mrG: 1.3, as: 0.92, asG: 0.015, range: 2.5, ms: 6.3, hpReg: 8, hpRegG: 0.5, mpReg: 4, mpRegG: 0.25 },
    attack: { style: 'spear', proj: null },
    passive: { name: 'Wings of Valor', icon: 'wing', desc: 'After casting a skill, Valka gains 20% movement speed for 2s.' },
    skills: [
      {
        name: 'Piercing Thrust', icon: 'spear', color: '#ffe39a', aim: 'dir', range: 6, width: 1.8,
        cd: six(7, -0.5), mana: 45, v: { dmg: six(160, 50) },
        desc: 'Thrusts her spear, dealing {dmg} (+80% Physical Attack) physical damage to enemies in a line and slowing them by 30% for 1.5s.',
        ai: { type: 'damage', range: 5.8, wave: true },
        cast(w, h, a, L) {
          w.fx('thrust', h.x, h.z, 6, 0xffe6a0, a.dx, a.dz); w.sfx('thrust', h.x, h.z);
          h.anim = 'thrust'; h.animT = w.time;
          for (const t of w.lineHits(h, h.x, h.z, a.dx, a.dz, 6, 1.8)) { w.dmg(h, t, lv(this.v.dmg, L) + 0.8 * h.st.atk, 'p', { skill: 1 }); w.cc(t, 'slow', 1.5, h, 0.3); }
          return true;
        },
      },
      {
        name: 'Aegis Wing', icon: 'wing', color: '#fff1c7', aim: 'dir', range: 5, radius: 2,
        cd: six(12, -0.5), mana: 60, v: { sh: six(180, 50), dmg: six(100, 30) },
        desc: 'Glides forward and gains a {sh} (+60% Physical Attack) shield for 3s. Enemies near the landing spot take {dmg} (+40% Physical Attack) physical damage.',
        ai: { type: 'engage', range: 5.5, alsoEscape: true },
        cast(w, h, a, L) {
          w.shield(h, lv(this.v.sh, L) + 0.6 * h.st.atk, 3, h);
          w.sfx('wing', h.x, h.z);
          w.dash(h, h.x + a.dx * 5, h.z + a.dz * 5, { speed: 18, arc: 0.8, anim: 'glide', fx: 'featherTrail',
            onEnd: () => { w.fx('featherBurst', h.x, h.z, 2, 0xfff1c7); for (const t of w.enemies(h, h.x, h.z, 2)) w.dmg(h, t, lv(this.v.dmg, L) + 0.4 * h.st.atk, 'p', { skill: 2 }); } });
          return true;
        },
      },
      {
        name: 'Valkyrie Descent', icon: 'meteor', color: '#ffd36b', aim: 'point', range: 12, radius: 3.5, ult: true,
        cd: three(45, -5), mana: 110, v: { dmg: three(300, 150) },
        desc: 'Soars into the sky and crashes down on the target area, dealing {dmg} (+120% Physical Attack) physical damage and knocking enemies airborne for 0.8s.',
        ai: { type: 'engage', range: 11, minHeroes: 1 },
        cast(w, h, a, L) {
          w.tele(a.x, a.z, 3.5, 0.6, 'ult', h.team);
          w.dash(h, a.x, a.z, { speed: 20, arc: 7, untarget: true, anim: 'leap', ignoreWalls: true,
            onEnd: () => {
              w.fx('skyCrash', h.x, h.z, 3.5, 0xffe08a); w.sfx('bigImpact', h.x, h.z); w.shake(0.5);
              for (const t of w.enemies(h, h.x, h.z, 3.5)) { w.dmg(h, t, lv(this.v.dmg, L) + 1.2 * h.st.atk, 'p', { skill: 3 }); w.cc(t, 'air', 0.8, h); }
            } });
          return true;
        },
      },
    ],
    onCast(w, h) { w.buff(h, { id: 'valor', dur: 2, mods: { msP: 0.2 } }); },
    build: ['b_iron', 'a_cleaver', 'a_tempest', 'd_aegis', 'a_fang', 'd_guard'],
    skillOrder: [0, 1],
    spell: 'blink',
    look: {
      body: 'human', height: 1.02, bulk: 0.95, skin: '#f5dccb', eyes: '#ffcf5c', female: true,
      hair: { style: 'longbraid', color: '#fff3c4', color2: '#f3d98a' },
      colors: { main: '#e9eef8', second: '#3f6db3', accent: '#ffd36b', dark: '#28385a', glow: '#ffe7a3' },
      outfit: 'armor_light', head: 'winged_helm', cape: '#4f7fd0', weapon: 'spear',
    },
  },
  // ------------------------------------------------------------------ ASSASSINS
  {
    id: 'nyra', name: 'Nyra', title: 'Moonfrost Shadow', role: 'Assassin', lane: 'jungle', difficulty: 3,
    lore: 'Trained by the silent order beneath the frozen moon. Nobody hears her coming; few see her leave.',
    stats: { hp: 2350, hpG: 130, mana: 380, manaG: 24, atk: 128, atkG: 9, armor: 17, armorG: 1.8, mr: 14, mrG: 1.1, as: 1.0, asG: 0.018, range: 2.0, ms: 6.5, hpReg: 7, hpRegG: 0.45, mpReg: 4, mpRegG: 0.25 },
    attack: { style: 'daggers', proj: null },
    passive: { name: 'Ambush', icon: 'eye', desc: 'Basic attacks deal bonus physical damage equal to 8% of the target\'s missing HP.' },
    skills: [
      {
        name: 'Shadow Step', icon: 'blinkStrike', color: '#c3a8ff', aim: 'unit', range: 6.5,
        cd: six(9, -0.5), mana: 50, v: { dmg: six(150, 50) },
        desc: 'Blinks behind an enemy, dealing {dmg} (+80% Physical Attack) physical damage. If an enemy hero dies within 3s, the cooldown is reset.',
        ai: { type: 'engage', range: 6.5 },
        cast(w, h, a, L) {
          const t = a.target;
          const bx = t.x + Math.sin(t.facing) * -1.2, bz = t.z + Math.cos(t.facing) * -1.2;
          w.fx('shadowPuff', h.x, h.z, 1.2, 0x8f6bff); w.blink(h, bx, bz); w.fx('shadowPuff', h.x, h.z, 1.2, 0x8f6bff);
          h.facing = Math.atan2(t.x - h.x, t.z - h.z);
          w.sfx('blink', h.x, h.z);
          w.dmg(h, t, lv(this.v.dmg, L) + 0.8 * h.st.atk, 'p', { skill: 1 });
          if (t.kind === 'hero') h.pv.markId = t.id, h.pv.markT = w.time + 3;
          h.anim = 'stab'; h.animT = w.time;
          return true;
        },
      },
      {
        name: 'Frost Shuriken', icon: 'shuriken', color: '#b6d8ff', aim: 'dir', range: 8, width: 0.9,
        cd: six(7, -0.5), mana: 45, v: { dmg: six(120, 40) },
        desc: 'Throws three crystal shuriken in a fan, each dealing {dmg} (+50% Physical Attack) physical damage and slowing by 25%. Extra shuriken on the same target deal half damage.',
        ai: { type: 'damage', range: 7.5, skillshot: 22, wave: true },
        cast(w, h, a, L) {
          const hitT = new Map();
          w.sfx('shuriken', h.x, h.z);
          for (const off of [-0.38, 0, 0.38]) {
            const ang = Math.atan2(a.dx, a.dz) + off;
            w.proj(h, { dx: Math.sin(ang), dz: Math.cos(ang), speed: 22, range: 8, width: 0.9, kind: 'shuriken',
              onHit: (t) => { const n = hitT.get(t.id) || 0; hitT.set(t.id, n + 1); w.dmg(h, t, (lv(this.v.dmg, L) + 0.5 * h.st.atk) * (n ? 0.5 : 1), 'p', { skill: 2 }); w.cc(t, 'slow', 1, h, 0.25); return 'stop'; } });
          }
          return true;
        },
      },
      {
        name: 'Thousand Cuts', icon: 'cuts', color: '#a98bff', aim: 'self', radius: 4.5, ult: true,
        cd: three(40, -6), mana: 100, v: { dmg: three(90, 40) },
        desc: 'Vanishes and becomes untargetable for 1.2s, striking nearby enemies 6 times for {dmg} (+40% Physical Attack) physical damage each. Heroes are prioritized.',
        ai: { type: 'engage', range: 4, minHeroes: 1 },
        cast(w, h, a, L) {
          w.buff(h, { id: 'cuts', dur: 1.25, untarget: true, rooted: true });
          w.sfx('cuts', h.x, h.z);
          for (let i = 0; i < 6; i++) {
            w.after(0.05 + i * 0.2, () => {
              if (!h.alive) return;
              const list = w.enemies(h, h.x, h.z, 4.5);
              if (!list.length) return;
              const heroes = list.filter((u) => u.kind === 'hero');
              const pool = heroes.length ? heroes : list;
              const t = pool[i % pool.length];
              const ang = w.rng() * Math.PI * 2;
              w.fx('cutLine', t.x, t.z, 2.2, 0xb79bff, Math.sin(ang), Math.cos(ang));
              w.dmg(h, t, lv(this.v.dmg, L) + 0.4 * h.st.atk, 'p', { skill: 3 });
              w.sfx('cutHit', t.x, t.z);
            });
          }
          w.fx('shadowPuff', h.x, h.z, 4.5, 0x7a5cff);
          return true;
        },
      },
    ],
    onAttackHit(w, h, t) { w.dmg(h, t, 0.08 * (t.st.maxHp - t.hp) * (t.kind === 'hero' ? 1 : 0.5), 'p', { passive: 1, noProc: true }); },
    onKill(w, h, victim) { if (victim.kind === 'hero' && h.pv.markId === victim.id && w.time <= h.pv.markT) h.skills[0].cd = 0; },
    build: ['j_talisman', 'b_wind', 'a_fang', 'a_blade', 'a_great', 'a_reaper'],
    skillOrder: [1, 0],
    spell: 'frostbite',
    look: {
      body: 'human', height: 0.98, bulk: 0.88, skin: '#f4dcd0', eyes: '#c08bff', female: true,
      hair: { style: 'ponytail', color: '#f1f0ff', color2: '#b9a6ff' },
      colors: { main: '#2f2552', second: '#5b4a9a', accent: '#b9a6ff', dark: '#161228', glow: '#b49cff' },
      outfit: 'ninja', head: 'hood_mask', scarf: '#6c58c9', weapon: 'daggers',
    },
  },
  {
    id: 'sable', name: 'Sable', title: 'Snow Leopard Huntress', role: 'Assassin', lane: 'jungle', difficulty: 2,
    lore: 'Raised among the snow leopards of the white cliffs, Sable hunts by scent, silence and patience.',
    stats: { hp: 2400, hpG: 135, mana: 380, manaG: 24, atk: 125, atkG: 8.8, armor: 18, armorG: 1.9, mr: 14, mrG: 1.1, as: 1.0, asG: 0.018, range: 2.0, ms: 6.6, hpReg: 7, hpRegG: 0.45, mpReg: 4, mpRegG: 0.25 },
    attack: { style: 'claws', proj: null },
    passive: { name: 'Predator', icon: 'claw', desc: 'After casting a skill, Sable gains 30% attack speed for 3s.' },
    skills: [
      {
        name: 'Pounce', icon: 'pounce', color: '#ffe0a8', aim: 'point', range: 6, radius: 2.2,
        cd: six(8, -0.5), mana: 45, v: { dmg: six(140, 50) },
        desc: 'Pounces to the target location, dealing {dmg} (+75% Physical Attack) physical damage to nearby enemies and slowing them by 35% for 1.5s.',
        ai: { type: 'engage', range: 6, alsoEscape: true, wave: true },
        cast(w, h, a, L) {
          w.sfx('pounce', h.x, h.z);
          w.dash(h, a.x, a.z, { speed: 18, arc: 1.6, anim: 'leap',
            onEnd: () => { w.fx('clawBurst', h.x, h.z, 2.2, 0xffd9a0); w.sfx('claw', h.x, h.z); for (const t of w.enemies(h, h.x, h.z, 2.2)) { w.dmg(h, t, lv(this.v.dmg, L) + 0.75 * h.st.atk, 'p', { skill: 1 }); w.cc(t, 'slow', 1.5, h, 0.35); } } });
          return true;
        },
      },
      {
        name: 'Snow Veil', icon: 'veil', color: '#e8f2ff', aim: 'self',
        cd: six(16, -1), mana: 60, v: { dmg: six(100, 50) },
        desc: 'Fades into the snow, becoming invisible for 3s and gaining 30% movement speed. Her next basic attack within 4s deals {dmg} bonus physical damage and stuns for 0.6s.',
        ai: { type: 'buff', range: 9 },
        cast(w, h, a, L) {
          w.fx('veil', h.x, h.z, 1.5, 0xe8f2ff); w.sfx('veil', h.x, h.z);
          w.buff(h, { id: 'veil', dur: 3, invis: true, mods: { msP: 0.3 } });
          h.pv.veilHit = lv(this.v.dmg, L); h.pv.veilT = w.time + 4;
          return true;
        },
      },
      {
        name: 'Rending Hunt', icon: 'claw', color: '#ffb36b', aim: 'unit', range: 7, ult: true, heroOnly: true,
        cd: three(42, -6), mana: 100, v: { dmg: three(100, 50) },
        desc: 'Dashes to an enemy hero and rends them three times, each hit dealing {dmg} (+50% Physical Attack) plus 7% of their missing HP as physical damage.',
        ai: { type: 'execute', range: 7, hpBelow: 0.6 },
        cast(w, h, a, L) {
          const t = a.target;
          w.dash(h, t.x, t.z, { speed: 26, anim: 'dashSlash', stopDist: 1.1, targetId: t.id, untarget: true,
            onEnd: () => {
              for (let i = 0; i < 3; i++) w.after(i * 0.16, () => {
                if (!t.alive || !h.alive) return;
                w.fx('clawRend', t.x, t.z, 1.6, 0xffa95a, Math.sin(i * 2.1), Math.cos(i * 2.1)); w.sfx('claw', t.x, t.z);
                w.dmg(h, t, lv(this.v.dmg, L) + 0.5 * h.st.atk + 0.07 * (t.st.maxHp - t.hp), 'p', { skill: 3 });
              });
              h.anim = 'rend'; h.animT = w.time;
            } });
          return true;
        },
      },
    ],
    onCast(w, h) { w.buff(h, { id: 'predator', dur: 3, mods: { asP: 0.3 } }); },
    onAttackHit(w, h, t) {
      if (h.pv.veilHit && w.time <= h.pv.veilT) { w.dmg(h, t, h.pv.veilHit, 'p', { passive: 1, noProc: true }); w.cc(t, 'stun', 0.6, h); h.pv.veilHit = 0; w.fx('clawBurst', t.x, t.z, 1.2, 0xffffff); }
    },
    build: ['j_talisman', 'b_wind', 'a_talon', 'a_fang', 'a_great', 'd_guard'],
    skillOrder: [0, 1],
    spell: 'frostbite',
    look: {
      body: 'human', height: 0.98, bulk: 0.9, skin: '#f0d2bf', eyes: '#7ee08f', female: true,
      hair: { style: 'wild', color: '#f3f1ea', color2: '#7c7a74' },
      colors: { main: '#e9e6df', second: '#5d6b80', accent: '#ffb36b', dark: '#2d3442', glow: '#ffd27a' },
      outfit: 'leopard', head: null, ears: 'cat', tail: 'leopard', weapon: 'claws',
    },
  },
  // ------------------------------------------------------------------ MAGES
  {
    id: 'lumi', name: 'Lumi', title: 'Aurora Sorceress', role: 'Mage', lane: 'mid', difficulty: 2,
    lore: 'Lumi learned magic by reading the colours of the northern lights. The sky still answers when she sings.',
    stats: { hp: 2150, hpG: 120, mana: 560, manaG: 40, atk: 105, atkG: 5, armor: 15, armorG: 1.6, mr: 16, mrG: 1.2, as: 0.85, asG: 0.01, range: 6.0, ms: 6.1, hpReg: 6, hpRegG: 0.4, mpReg: 6, mpRegG: 0.35 },
    attack: { style: 'staff', proj: 'auroraBolt' },
    passive: { name: 'Chill', icon: 'snowflake', desc: 'Skill hits apply Chill. At 3 stacks the target is frozen for 0.8s (5s immunity afterwards).' },
    skills: [
      {
        name: 'Ice Lance', icon: 'iceLance', color: '#8fe6ff', aim: 'dir', range: 10, width: 0.9,
        cd: six(6, -0.3), mana: [55, 60, 65, 70, 75, 80], v: { dmg: six(220, 60) },
        desc: 'Fires a lance of ice that deals {dmg} (+80% Magic Power) magic damage to the first enemy hit and slows it by 30% for 1.5s.',
        ai: { type: 'damage', range: 9.5, skillshot: 24 },
        cast(w, h, a, L) {
          w.sfx('iceCast', h.x, h.z);
          w.proj(h, { dx: a.dx, dz: a.dz, speed: 24, range: 10, width: 0.9, kind: 'iceLance', y: 1.4,
            onHit: (t) => { w.dmg(h, t, lv(this.v.dmg, L) + 0.8 * h.st.mag, 'm', { skill: 1 }); w.cc(t, 'slow', 1.5, h, 0.3); w.fx('iceShatter', t.x, t.z, 1.2, 0x9fefff); w.sfx('iceHit', t.x, t.z); return 'stop'; } });
          return true;
        },
      },
      {
        name: 'Frost Nova', icon: 'nova', color: '#b9f2ff', aim: 'point', range: 8.5, radius: 2.6,
        cd: six(11, -0.5), mana: 75, v: { dmg: six(200, 50) },
        desc: 'Marks an area that erupts after 0.55s, dealing {dmg} (+70% Magic Power) magic damage and rooting enemies for 1.2s.',
        ai: { type: 'cc', range: 8, delay: 0.55, wave: true },
        cast(w, h, a, L) {
          w.tele(a.x, a.z, 2.6, 0.55, 'ice', h.team); w.sfx('charge', a.x, a.z);
          w.after(0.55, () => {
            w.fx('frostNova', a.x, a.z, 2.6, 0xaef3ff); w.sfx('iceBurst', a.x, a.z);
            for (const t of w.enemies(h, a.x, a.z, 2.6)) { w.dmg(h, t, lv(this.v.dmg, L) + 0.7 * h.st.mag, 'm', { skill: 2 }); w.cc(t, 'root', 1.2, h); }
          });
          return true;
        },
      },
      {
        name: 'Aurora Blizzard', icon: 'blizzard', color: '#a6ffdf', aim: 'point', range: 9, radius: 4.5, ult: true,
        cd: three(50, -5), mana: 150, v: { dmg: three(60, 30) },
        desc: 'Summons a shimmering blizzard for 4s. Every 0.5s enemies inside take {dmg} (+15% Magic Power) magic damage and are slowed by 40%.',
        ai: { type: 'damage', range: 9, minHeroes: 1 },
        cast(w, h, a, L) {
          w.sfx('blizzard', a.x, a.z);
          w.zone(h, { x: a.x, z: a.z, r: 4.5, dur: 4, interval: 0.5, kind: 'blizzard',
            onTick: () => { for (const t of w.enemies(h, a.x, a.z, 4.5)) { w.dmg(h, t, lv(this.v.dmg, L) + 0.15 * h.st.mag, 'm', { skill: 3, aoe: 1, dot: 1 }); w.cc(t, 'slow', 0.6, h, 0.4); } } });
          return true;
        },
      },
    ],
    onSkillHit(w, h, t, opts) {
      if (opts.dot || t.kind === 'tower' || t.kind === 'core') return;
      if ((t.pv.chillImmuneT || 0) > w.time) return;
      t.pv.chill = (t.pv.chill || 0) + 1;
      t.pv.chillT = w.time + 4;
      if (t.pv.chill >= 3) { t.pv.chill = 0; t.pv.chillImmuneT = w.time + 5.8; w.cc(t, 'stun', 0.8, h); w.fx('freeze', t.x, t.z, 1.2, 0xbff6ff); w.sfx('freeze', t.x, t.z); }
    },
    build: ['b_rune', 'm_staff', 'm_prism', 'm_orb', 'm_glass', 'd_veil'],
    skillOrder: [0, 1],
    spell: 'blink',
    look: {
      body: 'human', height: 0.96, bulk: 0.85, skin: '#f8e1d6', eyes: '#7af0d8', female: true,
      hair: { style: 'twinbuns', color: '#e6dcff', color2: '#9be8ff' },
      colors: { main: '#5a3fa8', second: '#e4f6ff', accent: '#7af0d8', dark: '#271c4a', glow: '#9ffff0' },
      outfit: 'dress', head: 'circlet', cape: '#47c2c7', weapon: 'staff_star',
    },
  },
  {
    id: 'pyra', name: 'Pyra', title: 'Ember Witch', role: 'Mage', lane: 'mid', difficulty: 2,
    lore: 'The only fire that never goes out in Frostvale burns in Pyra\'s lantern - and in her temper.',
    stats: { hp: 2100, hpG: 118, mana: 540, manaG: 38, atk: 100, atkG: 5, armor: 14, armorG: 1.6, mr: 16, mrG: 1.2, as: 0.85, asG: 0.01, range: 6.0, ms: 6.1, hpReg: 6, hpRegG: 0.4, mpReg: 6, mpRegG: 0.35 },
    attack: { style: 'wand', proj: 'emberBolt' },
    passive: { name: 'Kindling', icon: 'flame', desc: 'Skills set enemies ablaze, dealing 2% of their max HP as magic damage per second for 3s.' },
    skills: [
      {
        name: 'Fireball', icon: 'fireball', color: '#ff9a4a', aim: 'dir', range: 9, width: 1.0, radius: 2.2,
        cd: six(7, -0.4), mana: 60, v: { dmg: six(240, 60) },
        desc: 'Launches a fireball that explodes on the first enemy hit or at max range, dealing {dmg} (+85% Magic Power) magic damage in an area.',
        ai: { type: 'damage', range: 9, skillshot: 20, wave: true },
        cast(w, h, a, L) {
          w.sfx('fireCast', h.x, h.z);
          const boom = (x, z) => { w.fx('explosion', x, z, 2.2, 0xff8a3a); w.sfx('explosion', x, z); for (const t of w.enemies(h, x, z, 2.2)) w.dmg(h, t, lv(this.v.dmg, L) + 0.85 * h.st.mag, 'm', { skill: 1 }); };
          w.proj(h, { dx: a.dx, dz: a.dz, speed: 20, range: 9, width: 1.0, kind: 'fireball', y: 1.4,
            onHit: (t, p) => { boom(p.x, p.z); return 'stop'; }, onEnd: (p) => boom(p.x, p.z) });
          return true;
        },
      },
      {
        name: 'Ring of Fire', icon: 'ring', color: '#ff7a3a', aim: 'point', range: 7.5, radius: 3,
        cd: six(12, -0.5), mana: 80, v: { dmg: six(50, 15) },
        desc: 'Ignites a ring of flames for 3.5s. Enemies inside take {dmg} (+12% Magic Power) magic damage every 0.5s and are slowed by 20%.',
        ai: { type: 'damage', range: 7, wave: true },
        cast(w, h, a, L) {
          w.sfx('fireCast', a.x, a.z);
          w.zone(h, { x: a.x, z: a.z, r: 3, dur: 3.5, interval: 0.5, kind: 'fireRing',
            onTick: () => { for (const t of w.enemies(h, a.x, a.z, 3)) { w.dmg(h, t, lv(this.v.dmg, L) + 0.12 * h.st.mag, 'm', { skill: 2, aoe: 1, dot: 1 }); w.cc(t, 'slow', 0.6, h, 0.2); } } });
          return true;
        },
      },
      {
        name: 'Meteor', icon: 'meteor', color: '#ffb24a', aim: 'point', range: 14, radius: 4, ult: true,
        cd: three(55, -5), mana: 150, v: { dmg: three(500, 250) },
        desc: 'Calls down a meteor that lands after 1.2s, dealing {dmg} (+150% Magic Power) magic damage and stunning enemies for 1s.',
        ai: { type: 'damage', range: 13, delay: 1.2, minHeroes: 1 },
        cast(w, h, a, L) {
          w.tele(a.x, a.z, 4, 1.2, 'fire', h.team); w.fx('meteorFall', a.x, a.z, 4, 0xff9a3a, 1.2); w.sfx('meteorFall', a.x, a.z);
          w.after(1.2, () => {
            w.fx('bigExplosion', a.x, a.z, 4, 0xff8a2a); w.sfx('bigExplosion', a.x, a.z); w.shake(0.7);
            for (const t of w.enemies(h, a.x, a.z, 4)) { w.dmg(h, t, lv(this.v.dmg, L) + 1.5 * h.st.mag, 'm', { skill: 3 }); w.cc(t, 'stun', 1, h); }
          });
          return true;
        },
      },
    ],
    onSkillHit(w, h, t, opts) {
      if (opts.dot || t.kind === 'tower' || t.kind === 'core') return;
      w.buff(t, { id: 'burn_' + h.id, dur: 3, src: h, dot: { dmg: 0.02 * t.st.maxHp * 0.5, type: 'm', interval: 0.5 }, fx: 'burning' });
    },
    build: ['b_rune', 'm_scepter', 'm_flame', 'm_prism', 'm_orb', 'd_guard'],
    skillOrder: [0, 1],
    spell: 'execute',
    look: {
      body: 'human', height: 0.97, bulk: 0.86, skin: '#f6d9c8', eyes: '#ffb347', female: true,
      hair: { style: 'long', color: '#ff6b3d', color2: '#ffb347' },
      colors: { main: '#2a1d2e', second: '#8a2b2b', accent: '#ffb347', dark: '#120b14', glow: '#ffa040' },
      outfit: 'robe', head: 'witch_hat', cape: null, weapon: 'lantern',
    },
  },
  // ------------------------------------------------------------------ MARKSMEN
  {
    id: 'aria', name: 'Aria', title: 'Windarrow Ranger', role: 'Marksman', lane: 'gold', difficulty: 1,
    lore: 'An elven scout of the silver pines. Her arrows sing on the wind long before they land.',
    stats: { hp: 2200, hpG: 120, mana: 420, manaG: 26, atk: 118, atkG: 9.5, armor: 15, armorG: 1.7, mr: 14, mrG: 1.1, as: 1.0, asG: 0.022, range: 6.6, ms: 6.2, hpReg: 6, hpRegG: 0.4, mpReg: 4, mpRegG: 0.25 },
    attack: { style: 'bow', proj: 'arrow' },
    passive: { name: 'Quickdraw', icon: 'arrows', desc: 'Every 4th basic attack fires 2 extra arrows at nearby enemies, each dealing 50% damage.' },
    skills: [
      {
        name: 'Piercing Arrow', icon: 'arrow', color: '#bff7c9', aim: 'dir', range: 12, width: 0.9,
        cd: six(8, -0.5), mana: 55, v: { dmg: six(180, 50) },
        desc: 'Fires a piercing arrow dealing {dmg} (+100% Physical Attack) physical damage to every enemy in a line. Damage drops by 15% per enemy hit (minimum 55%).',
        ai: { type: 'damage', range: 11.5, skillshot: 30, wave: true },
        cast(w, h, a, L) {
          let n = 0;
          w.sfx('bowHeavy', h.x, h.z);
          w.proj(h, { dx: a.dx, dz: a.dz, speed: 30, range: 12, width: 0.9, kind: 'bigArrow', pierce: true, y: 1.3,
            onHit: (t) => { w.dmg(h, t, (lv(this.v.dmg, L) + 1.0 * h.st.atk) * Math.max(0.55, 1 - 0.15 * n++), 'p', { skill: 1 }); w.fx('arrowHit', t.x, t.z, 1, 0xbff7c9); } });
          return true;
        },
      },
      {
        name: 'Wind Step', icon: 'windStep', color: '#d9fff0', aim: 'dir', range: 4.5,
        cd: six(10, -0.5), mana: 40, v: { dmg: six(40, 20) },
        desc: 'Dashes on the wind and gains 20% attack speed for 3s. The next basic attack deals {dmg} (+50% Physical Attack) bonus damage and slows by 40%.',
        ai: { type: 'escape', range: 6, alsoKite: true },
        cast(w, h, a, L) {
          w.sfx('wind', h.x, h.z);
          w.dash(h, h.x + a.dx * 4.5, h.z + a.dz * 4.5, { speed: 20, anim: 'roll', fx: 'windTrail' });
          w.buff(h, { id: 'windstep', dur: 3, mods: { asP: 0.2 } });
          h.pv.empower = lv(this.v.dmg, L) + 0.5 * h.st.atk; h.pv.empowerT = w.time + 3; h.pv.empowerSlow = 0.4;
          return true;
        },
      },
      {
        name: 'Arrow Storm', icon: 'arrowRain', color: '#a7ffcf', aim: 'point', range: 10, radius: 4, ult: true,
        cd: three(45, -5), mana: 120, v: { dmg: three(60, 25) },
        desc: 'Rains arrows on an area for 2.4s. Every 0.3s enemies inside take {dmg} (+30% Physical Attack) physical damage and are slowed by 25%.',
        ai: { type: 'damage', range: 10, minHeroes: 1 },
        cast(w, h, a, L) {
          w.sfx('arrowRain', a.x, a.z);
          w.zone(h, { x: a.x, z: a.z, r: 4, dur: 2.4, interval: 0.3, kind: 'arrowRain',
            onTick: () => { for (const t of w.enemies(h, a.x, a.z, 4)) { w.dmg(h, t, lv(this.v.dmg, L) + 0.3 * h.st.atk, 'p', { skill: 3, aoe: 1, dot: 1 }); w.cc(t, 'slow', 0.4, h, 0.25); } } });
          return true;
        },
      },
    ],
    onAttackHit(w, h, t, dmg) {
      h.pv.qd = (h.pv.qd || 0) + 1;
      if (h.pv.qd >= 4) {
        h.pv.qd = 0;
        const extra = w.enemies(h, t.x, t.z, 6).filter((u) => u !== t).slice(0, 2);
        for (const e of extra) w.homing(h, e, { speed: 26, kind: 'arrow', onHit: (u) => w.dmg(h, u, dmg * 0.5, 'p', { passive: 1, noProc: true }) });
      }
    },
    build: ['b_wind', 'a_bow', 'a_great', 'a_blade', 'a_fang', 'd_guard'],
    skillOrder: [0, 1],
    spell: 'blink',
    look: {
      body: 'human', height: 1.0, bulk: 0.86, skin: '#f7e2d2', eyes: '#6fe39a', female: true,
      hair: { style: 'long', color: '#e8f5e6', color2: '#a8d9b4' },
      colors: { main: '#2f6b4f', second: '#e9f2e6', accent: '#c9f27a', dark: '#1a3328', glow: '#b6ffcf' },
      outfit: 'ranger', head: 'circlet', ears: 'elf', cape: '#3e8a62', weapon: 'bow',
    },
  },
  {
    id: 'gideon', name: 'Gideon', title: 'Frost Rifleman', role: 'Marksman', lane: 'gold', difficulty: 2,
    lore: 'A mountain hunter with a repeating crossbow of his own design. Never misses twice.',
    stats: { hp: 2250, hpG: 122, mana: 400, manaG: 25, atk: 120, atkG: 9, armor: 16, armorG: 1.7, mr: 14, mrG: 1.1, as: 0.95, asG: 0.02, range: 6.4, ms: 6.2, hpReg: 6, hpRegG: 0.4, mpReg: 4, mpRegG: 0.25 },
    attack: { style: 'crossbow', proj: 'bolt' },
    passive: { name: 'Steady Aim', icon: 'target', desc: 'Consecutive attacks on the same target grant 7% attack speed, stacking up to 5 times.' },
    skills: [
      {
        name: 'Scatter Bolts', icon: 'scatter', color: '#ffd9a0', aim: 'dir', range: 6.5,
        cd: six(9, -0.5), mana: 55, v: { dmg: six(160, 50) },
        desc: 'Fires a spread of bolts, dealing {dmg} (+90% Physical Attack) physical damage to enemies in a cone and knocking them back slightly.',
        ai: { type: 'damage', range: 6, wave: true },
        cast(w, h, a, L) {
          w.fx('cone', h.x, h.z, 6.5, 0xffd9a0, a.dx, a.dz); w.sfx('scatter', h.x, h.z);
          h.anim = 'shoot'; h.animT = w.time;
          for (const t of w.coneHits(h, h.x, h.z, a.dx, a.dz, 6.5, 0.45)) { w.dmg(h, t, lv(this.v.dmg, L) + 0.9 * h.st.atk, 'p', { skill: 1 }); w.cc(t, 'knock', 0.15, h, { x: h.x, z: h.z, dist: 1.5 }); }
          return true;
        },
      },
      {
        name: 'Tumble', icon: 'roll', color: '#fff0c4', aim: 'dir', range: 4.5,
        cd: six(9, -0.5), mana: 35, v: { amp: six(0.3, 0.04) },
        desc: 'Rolls in a direction and reloads; the next 2 basic attacks within 4s deal {amp} bonus damage (as a fraction of the attack).',
        ai: { type: 'escape', range: 6, alsoKite: true },
        cast(w, h, a, L) {
          w.sfx('roll', h.x, h.z);
          w.dash(h, h.x + a.dx * 4.5, h.z + a.dz * 4.5, { speed: 22, anim: 'roll', fx: 'snowTrail' });
          h.pv.tumble = 2; h.pv.tumbleAmp = lv(this.v.amp, L); h.pv.tumbleT = w.time + 4;
          return true;
        },
      },
      {
        name: 'Longshot', icon: 'sniper', color: '#9fe8ff', aim: 'dir', range: 28, width: 1.1, ult: true,
        cd: three(50, -5), mana: 120, v: { dmg: three(450, 250) },
        desc: 'Takes aim for 0.6s, then fires a bolt across the map dealing {dmg} (+180% Physical Attack) physical damage to the first hero hit. Minions in the way take 40%.',
        ai: { type: 'damage', range: 22, skillshot: 45, minHeroes: 1, hpBelow: 0.5 },
        cast(w, h, a, L) {
          w.buff(h, { id: 'aim', dur: 0.6, rooted: true });
          h.anim = 'aim'; h.animT = w.time; h.facing = Math.atan2(a.dx, a.dz);
          w.fx('aimLine', h.x, h.z, 28, 0x9fe8ff, a.dx, a.dz); w.sfx('charge', h.x, h.z);
          w.after(0.6, () => {
            if (!h.alive || h.cc.stun > 0) return;
            w.sfx('sniper', h.x, h.z); w.shake(0.2);
            w.proj(h, { dx: a.dx, dz: a.dz, speed: 45, range: 28, width: 1.1, kind: 'snipe', pierce: true, y: 1.3,
              onHit: (t) => { const hero = t.kind === 'hero'; w.dmg(h, t, (lv(this.v.dmg, L) + 1.8 * h.st.atk) * (hero ? 1 : 0.4), 'p', { skill: 3 }); w.fx('impact', t.x, t.z, 1.4, 0x9fe8ff); if (hero) return 'stop'; } });
          });
          return true;
        },
      },
    ],
    onAttackHit(w, h, t) {
      if (h.pv.aimTarget === t.id) h.pv.aimStacks = Math.min(5, (h.pv.aimStacks || 0) + 1); else { h.pv.aimTarget = t.id; h.pv.aimStacks = 1; }
      w.buff(h, { id: 'steady', dur: 3, mods: { asP: 0.07 * h.pv.aimStacks } });
    },
    attackAmp(w, h) {
      if (h.pv.tumble > 0 && w.time <= h.pv.tumbleT) { h.pv.tumble--; return 1 + h.pv.tumbleAmp; }
      return 1;
    },
    build: ['b_wind', 'a_talon', 'a_bow', 'a_great', 'a_fang', 'd_rime'],
    skillOrder: [0, 1],
    spell: 'purify',
    look: {
      body: 'human', height: 1.0, bulk: 1.0, skin: '#e8c2a4', eyes: '#58b8ff',
      hair: { style: 'short', color: '#8a5a3a' },
      colors: { main: '#7a4f2e', second: '#e2d2bc', accent: '#ffcf6b', dark: '#3a2818', glow: '#9fe8ff' },
      outfit: 'hunter', head: 'fur_hat', scarf: '#c94a3a', weapon: 'crossbow',
    },
  },
  // ------------------------------------------------------------------ SUPPORTS
  {
    id: 'elara', name: 'Elara', title: 'Snow Priestess', role: 'Support', lane: 'roam', difficulty: 1,
    lore: 'Keeper of the Moonbell shrine. When the bell rings, wounds close and frightened hearts grow brave.',
    stats: { hp: 2300, hpG: 135, mana: 520, manaG: 35, atk: 100, atkG: 5, armor: 18, armorG: 1.9, mr: 18, mrG: 1.3, as: 0.85, asG: 0.01, range: 5.8, ms: 6.2, hpReg: 7, hpRegG: 0.45, mpReg: 6, mpRegG: 0.35 },
    attack: { style: 'staff', proj: 'holyBolt' },
    passive: { name: 'Blessed Snow', icon: 'heart', desc: 'Elara\'s heals also grant 20% movement speed for 1.5s.' },
    skills: [
      {
        name: 'Healing Light', icon: 'heal', color: '#fff6c8', aim: 'point', range: 8, radius: 3,
        cd: six(9, -0.5), mana: 70, v: { heal: six(120, 40), dmg: six(100, 40) },
        desc: 'Calls down a beam of light. Allies inside heal {heal} (+60% Magic Power, +4% of their Max HP); enemies take {dmg} (+60% Magic Power) magic damage.',
        ai: { type: 'heal', range: 8 },
        cast(w, h, a, L) {
          w.fx('lightBeam', a.x, a.z, 3, 0xfff6c8); w.sfx('heal', a.x, a.z);
          for (const u of w.allies(h, a.x, a.z, 3, { heroes: true })) { w.heal(h, u, lv(this.v.heal, L) + 0.6 * h.st.mag + 0.04 * u.st.maxHp); w.buff(u, { id: 'blessed', dur: 1.5, mods: { msP: 0.2 } }); }
          for (const t of w.enemies(h, a.x, a.z, 3)) w.dmg(h, t, lv(this.v.dmg, L) + 0.6 * h.st.mag, 'm', { skill: 1 });
          return true;
        },
      },
      {
        name: 'Frost Bind', icon: 'chain', color: '#bfe9ff', aim: 'dir', range: 9.5, width: 0.9,
        cd: six(12, -0.5), mana: 70, v: { dmg: six(150, 50), dur: six(1.4, 0.1) },
        desc: 'Throws a binding rune that roots the first enemy hit for {dur}s and deals {dmg} (+70% Magic Power) magic damage.',
        ai: { type: 'cc', range: 9, skillshot: 20 },
        cast(w, h, a, L) {
          w.sfx('iceCast', h.x, h.z);
          w.proj(h, { dx: a.dx, dz: a.dz, speed: 20, range: 9.5, width: 0.9, kind: 'bindRune', y: 1.3,
            onHit: (t) => { w.dmg(h, t, lv(this.v.dmg, L) + 0.7 * h.st.mag, 'm', { skill: 2 }); w.cc(t, 'root', lv(this.v.dur, L), h); w.fx('bind', t.x, t.z, 1.2, 0xbfe9ff); w.sfx('freeze', t.x, t.z); return 'stop'; } });
          return true;
        },
      },
      {
        name: 'Sanctuary', icon: 'sanctuary', color: '#fff2b0', aim: 'self', radius: 8, ult: true,
        cd: three(60, -5), mana: 140, v: { sh: three(300, 150), hot: three(30, 15) },
        desc: 'Rings the Moonbell: allies within range are cleansed, gain a {sh} (+80% Magic Power) shield for 4s and regenerate {hot} (+8% Magic Power) HP per second.',
        ai: { type: 'save', range: 7 },
        cast(w, h, a, L) {
          w.fx('sanctuary', h.x, h.z, 8, 0xfff2b0); w.sfx('bell', h.x, h.z);
          for (const u of w.allies(h, h.x, h.z, 8, { heroes: true })) {
            w.cleanse(u);
            w.shield(u, lv(this.v.sh, L) + 0.8 * h.st.mag, 4, h);
            w.buff(u, { id: 'sanct', dur: 4, src: h, hot: { amt: lv(this.v.hot, L) + 0.08 * h.st.mag, interval: 0.5 }, fx: 'holyGlow' });
          }
          return true;
        },
      },
    ],
    build: ['b_mind', 'm_staff', 'd_cloak', 'm_glass', 'd_guard', 'd_bulwark'],
    skillOrder: [0, 1],
    spell: 'mend',
    look: {
      body: 'human', height: 0.97, bulk: 0.86, skin: '#f9e6dc', eyes: '#8ad1ff', female: true,
      hair: { style: 'long', color: '#ffffff', color2: '#cfe6ff' },
      colors: { main: '#f4f6ff', second: '#8fb7e6', accent: '#ffd88a', dark: '#5873a3', glow: '#fff2b0' },
      outfit: 'priestess', head: 'hood', cape: null, weapon: 'staff_bell',
    },
  },
  {
    id: 'lyra', name: 'Lyra', title: 'the Songweaver', role: 'Support', lane: 'roam', difficulty: 2,
    lore: 'A travelling bard whose crystal harp can lull a blizzard to sleep - or whip one into a frenzy.',
    stats: { hp: 2350, hpG: 135, mana: 500, manaG: 34, atk: 102, atkG: 5, armor: 18, armorG: 1.9, mr: 18, mrG: 1.3, as: 0.85, asG: 0.01, range: 5.8, ms: 6.3, hpReg: 7, hpRegG: 0.45, mpReg: 6, mpRegG: 0.35 },
    attack: { style: 'harp', proj: 'note' },
    passive: { name: 'Rhythm', icon: 'note', desc: 'Allied heroes within 7m of Lyra gain 8% movement speed.' },
    skills: [
      {
        name: 'Note of Haste', icon: 'note', color: '#ffc7f0', aim: 'dir', range: 9, width: 1.2,
        cd: six(8, -0.5), mana: 55, v: { dmg: six(140, 50) },
        desc: 'Sends out a piercing musical note. Enemies hit take {dmg} (+70% Magic Power) magic damage; allies it passes gain 30% movement speed for 2s.',
        ai: { type: 'damage', range: 8.5, skillshot: 18, wave: true },
        cast(w, h, a, L) {
          w.sfx('note', h.x, h.z);
          const helped = new Set();
          w.proj(h, { dx: a.dx, dz: a.dz, speed: 18, range: 9, width: 1.2, kind: 'note', pierce: true, y: 1.4,
            onHit: (t) => w.dmg(h, t, lv(this.v.dmg, L) + 0.7 * h.st.mag, 'm', { skill: 1 }),
            onMove: (p) => { for (const u of w.allies(h, p.x, p.z, 1.6, { heroes: true })) if (!helped.has(u.id)) { helped.add(u.id); w.buff(u, { id: 'haste', dur: 2, mods: { msP: 0.3 }, fx: 'notes' }); } } });
          return true;
        },
      },
      {
        name: 'Lullaby', icon: 'sleep', color: '#d7b8ff', aim: 'dir', range: 5.5,
        cd: six(13, -0.5), mana: 75, v: { dmg: six(100, 40), dur: six(1.0, 0.1) },
        desc: 'Plays a soothing melody in a cone, dealing {dmg} (+50% Magic Power) magic damage and putting enemies to sleep (stun) for {dur}s.',
        ai: { type: 'cc', range: 5 },
        cast(w, h, a, L) {
          w.fx('cone', h.x, h.z, 5.5, 0xd7b8ff, a.dx, a.dz); w.fx('notesBurst', h.x + a.dx * 3, h.z + a.dz * 3, 2.5, 0xd7b8ff); w.sfx('lullaby', h.x, h.z);
          h.anim = 'strum'; h.animT = w.time;
          for (const t of w.coneHits(h, h.x, h.z, a.dx, a.dz, 5.5, 0.56)) { w.dmg(h, t, lv(this.v.dmg, L) + 0.5 * h.st.mag, 'm', { skill: 2 }); w.cc(t, 'stun', lv(this.v.dur, L), h, null, 'sleep'); }
          return true;
        },
      },
      {
        name: 'Anthem of Winter', icon: 'anthem', color: '#ffe1f6', aim: 'self', radius: 10, ult: true,
        cd: three(60, -5), mana: 140, v: { heal: three(250, 125) },
        desc: 'Plays a rousing anthem: allies within range heal {heal} (+80% Magic Power) and gain 25% attack speed and 20% movement speed for 4s. Enemies in range are slowed by 35% for 2s.',
        ai: { type: 'save', range: 9 },
        cast(w, h, a, L) {
          w.fx('anthem', h.x, h.z, 10, 0xffd1f0); w.sfx('anthem', h.x, h.z);
          h.anim = 'strum'; h.animT = w.time;
          for (const u of w.allies(h, h.x, h.z, 10, { heroes: true })) { w.heal(h, u, lv(this.v.heal, L) + 0.8 * h.st.mag); w.buff(u, { id: 'anthem', dur: 4, mods: { asP: 0.25, msP: 0.2 }, fx: 'notes' }); }
          for (const t of w.enemies(h, h.x, h.z, 10)) w.cc(t, 'slow', 2, h, 0.35);
          return true;
        },
      },
    ],
    aura(w, h) {
      for (const u of w.allies(h, h.x, h.z, 7, { heroes: true })) w.buff(u, { id: 'rhythm', dur: 0.6, mods: { msP: 0.08 } });
    },
    build: ['b_mind', 'm_tome', 'd_cloak', 'm_glass', 'd_aegis', 'd_veil'],
    skillOrder: [1, 0],
    spell: 'aegis',
    look: {
      body: 'human', height: 0.97, bulk: 0.88, skin: '#f2cdb8', eyes: '#ff8fd4', female: true,
      hair: { style: 'bob', color: '#ff9ccf', color2: '#ffd2ea' },
      colors: { main: '#7a3f9c', second: '#fff0f8', accent: '#ffd36b', dark: '#3b1d4d', glow: '#ffc7f0' },
      outfit: 'bard', head: 'feather_hat', cape: '#c95fa8', weapon: 'harp',
    },
  },
];

export const HERO_BY_ID = Object.fromEntries(HEROES.map((h, i) => [h.id, { ...h, index: i }]));
HEROES.forEach((h, i) => { h.index = i; });

// Render skill description with numbers for a given rank (0 = show all ranks)
export function skillText(skill, rank) {
  return skill.desc.replace(/\{(\w+)\}/g, (_, k) => {
    const arr = skill.v && skill.v[k];
    if (!arr) return k;
    const fmt = (v) => (v < 1 && v > 0 && k !== 'dur' ? Math.round(v * 100) + '%' : Math.round(v * 10) / 10);
    if (rank > 0) return fmt(arr[Math.min(arr.length - 1, rank - 1)]);
    return arr.map(fmt).join('/');
  });
}
