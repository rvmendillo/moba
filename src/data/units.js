// Stats for minions, towers, cores and jungle monsters.
export const MINION_TYPES = {
  melee: { hp: 560, hpT: 18, atk: 40, atkT: 1.6, armor: 8, mr: 8, range: 1.7, as: 0.8, ms: 4.9, radius: 0.5, gold: 30, xp: 38, proj: null },
  ranged: { hp: 390, hpT: 12, atk: 54, atkT: 2.0, armor: 3, mr: 3, range: 5.5, as: 0.75, ms: 4.9, radius: 0.45, gold: 26, xp: 30, proj: 'minionBolt' },
  siege: { hp: 1300, hpT: 40, atk: 105, atkT: 4.0, armor: 25, mr: 25, range: 6.2, as: 0.5, ms: 4.6, radius: 0.85, gold: 60, xp: 80, proj: 'siegeShell', towerMult: 2 },
  titan: { hp: 13000, hpT: 0, atk: 320, atkT: 0, armor: 70, mr: 70, range: 4.5, as: 0.6, ms: 4.6, radius: 1.6, gold: 0, xp: 0, proj: null, towerMult: 1.8, aoe: 2.4 },
};
export const MINION_TYPE_LIST = ['melee', 'ranged', 'siege', 'titan'];

export const TOWER_STATS = [
  { hp: 5200, armor: 40, mr: 40 },
  { hp: 6000, armor: 45, mr: 45 },
  { hp: 7000, armor: 50, mr: 50 },
];
export const CORE_STATS = { hp: 9000, armor: 55, mr: 55 };
export const TOWER_ATK = { atk: 270, atkT: 10, as: 0.85, range: 8.6, radius: 1.45 };

export const MONSTERS = {
  wolfBig: { name: 'Frost Wolf Alpha', hp: 1300, atk: 55, armor: 15, mr: 10, range: 1.9, as: 0.8, ms: 6, radius: 0.8, gold: 75, xp: 72, scale: 1.25 },
  wolf: { name: 'Frost Wolf', hp: 600, atk: 30, armor: 10, mr: 8, range: 1.7, as: 0.9, ms: 6, radius: 0.6, gold: 32, xp: 34, scale: 0.9 },
  beetleBig: { name: 'Crystal Beetle', hp: 1450, atk: 50, armor: 26, mr: 15, range: 1.9, as: 0.7, ms: 5, radius: 0.9, gold: 80, xp: 76, scale: 1.2 },
  beetle: { name: 'Shardling', hp: 700, atk: 30, armor: 18, mr: 10, range: 1.7, as: 0.8, ms: 5, radius: 0.6, gold: 38, xp: 38, scale: 0.85 },
  owl: { name: 'Azure Owl', hp: 2600, atk: 75, armor: 20, mr: 22, range: 4.0, as: 0.75, ms: 5.5, radius: 1.1, gold: 140, xp: 140, buff: 'azure', proj: 'owlFeather', scale: 1.3 },
  stag: { name: 'Ember Stag', hp: 2700, atk: 85, armor: 24, mr: 18, range: 2.2, as: 0.75, ms: 5.5, radius: 1.1, gold: 140, xp: 140, buff: 'ember', scale: 1.3 },
  tortoise: { name: 'Crystal Tortoise', hp: 8000, hpT: 450, atk: 150, armor: 40, mr: 40, range: 3.6, as: 0.6, ms: 3, radius: 2.4, gold: 160, xp: 280, aoe: 3.2, boss: true, scale: 1.0 },
  titan: { name: 'Frost Titan', hp: 16000, hpT: 650, atk: 250, armor: 60, mr: 60, range: 4.8, as: 0.55, ms: 3, radius: 2.8, gold: 220, xp: 420, aoe: 3.6, boss: true, scale: 1.0 },
};
export const MONSTER_LIST = Object.keys(MONSTERS);
export const CAMP_SPAWNS = {
  azure: [['owl', 0, 0]],
  ember: [['stag', 0, 0]],
  wolves: [['wolfBig', 0, 0], ['wolf', 1.7, 1.2], ['wolf', -1.7, 1.2]],
  beetles: [['beetleBig', 0, 0], ['beetle', 1.6, -1.0]],
};
export const CAMP_RESPAWN = { azure: 100, ember: 100, wolves: 80, beetles: 80 };
export const CAMP_FIRST = { azure: 30, ember: 30, wolves: 25, beetles: 25 };

export const TIMINGS = {
  firstWave: 12, waveInterval: 30, superWaveEvery: 3,
  tortoiseFirst: 120, tortoiseRespawn: 150, tortoiseEnd: 900,
  titanFirst: 480, titanRespawn: 180,
  recall: 5.5, regen: 4, regenCd: 25,
};

export const XP_TO_NEXT = [0, 160, 220, 280, 340, 400, 460, 520, 580, 640, 700, 760, 820, 880, 940, 0];
export const MAX_LEVEL = 15;
