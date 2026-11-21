// Item catalog. Stats: hp, mana, atk, mag, armor, mr, as (fraction), crit, critDmg, ls, sv, cdr, ms (m/s), apen, apenP, mpen, mpenP, hpReg, mpReg
// `from` = components (consumed when buying). `unlock` = account level required.
export const ITEM_CATS = [
  { id: 'atk', name: 'Attack' },
  { id: 'mag', name: 'Magic' },
  { id: 'def', name: 'Defense' },
  { id: 'move', name: 'Movement' },
  { id: 'jg', name: 'Jungle & Roam' },
];

export const ITEMS = [
  // ---- basic components ----
  { id: 't_dagger', name: 'Frost Dagger', cat: 'atk', cost: 250, stats: { atk: 15 }, tier: 1, icon: ['dagger', '#9fd8ff'] },
  { id: 't_axe', name: 'Iron Hatchet', cat: 'atk', cost: 400, stats: { atk: 25 }, tier: 1, icon: ['axe', '#c9d2dd'] },
  { id: 't_gloves', name: 'Swift Gloves', cat: 'atk', cost: 300, stats: { as: 0.12 }, tier: 1, icon: ['glove', '#ffd08a'] },
  { id: 't_charm', name: 'Lucky Charm', cat: 'atk', cost: 300, stats: { crit: 0.08 }, tier: 1, icon: ['clover', '#9ff0b0'] },
  { id: 't_fang', name: 'Wolfbite Fang', cat: 'atk', cost: 350, stats: { ls: 0.06 }, tier: 1, icon: ['fang', '#ff8f8f'] },
  { id: 't_shard', name: 'Rune Shard', cat: 'mag', cost: 250, stats: { mag: 20 }, tier: 1, icon: ['rune', '#c8a8ff'] },
  { id: 't_orb', name: 'Mana Orb', cat: 'mag', cost: 300, stats: { mana: 300, mpReg: 2 }, tier: 1, icon: ['orb', '#7fb8ff'] },
  { id: 't_wand', name: 'Ember Wand', cat: 'mag', cost: 450, stats: { mag: 35 }, tier: 1, icon: ['wand', '#ff9a5a'] },
  { id: 't_glass', name: 'Snow Hourglass', cat: 'mag', cost: 400, stats: { cdr: 0.05, mag: 10 }, tier: 1, icon: ['hourglass', '#d8f0ff'] },
  { id: 't_belt', name: 'Leather Wrap', cat: 'def', cost: 300, stats: { hp: 230 }, tier: 1, icon: ['belt', '#e0b48a'] },
  { id: 't_plate', name: 'Iron Plate', cat: 'def', cost: 250, stats: { armor: 15 }, tier: 1, icon: ['plate', '#b8c4d4'] },
  { id: 't_mantle', name: 'Silk Mantle', cat: 'def', cost: 250, stats: { mr: 15 }, tier: 1, icon: ['mantle', '#b8a8ff'] },
  { id: 't_moss', name: 'Healing Moss', cat: 'def', cost: 300, stats: { hpReg: 6 }, tier: 1, icon: ['leaf', '#8ff0a0'] },
  { id: 'boots', name: 'Fur Boots', cat: 'move', cost: 300, stats: { ms: 0.8 }, tier: 1, icon: ['boot', '#d8b890'] },
  // ---- attack ----
  { id: 'a_cleaver', name: 'Glacier Cleaver', cat: 'atk', cost: 2050, from: ['t_axe', 't_dagger'], stats: { atk: 60, cdr: 0.1 }, passive: 'frostbite', pdesc: 'Basic attacks slow the target by 15% for 1s.', unlock: 1, tier: 3, icon: ['cleaver', '#9fe8ff'] },
  { id: 'a_blade', name: 'Bloodfrost Blade', cat: 'atk', cost: 1900, from: ['t_fang', 't_dagger'], stats: { atk: 45, ls: 0.15 }, unlock: 1, tier: 3, icon: ['sword', '#ff7f9a'] },
  { id: 'a_bow', name: 'Stormstring Bow', cat: 'atk', cost: 2000, from: ['t_gloves', 't_charm'], stats: { as: 0.35, crit: 0.2 }, passive: 'chain', pdesc: 'Every 3rd basic attack chains lightning to 2 nearby enemies for 60 (+30% Physical Attack) magic damage.', unlock: 1, tier: 3, icon: ['bow', '#ffe57a'] },
  { id: 'a_fang', name: "Winter's Fang", cat: 'atk', cost: 2150, from: ['t_axe', 't_dagger'], stats: { atk: 70, apenP: 0.25 }, pdesc: '+25% Physical Penetration.', unlock: 2, tier: 3, icon: ['fangBlade', '#bfe9ff'] },
  { id: 'a_talon', name: 'Ember Talon', cat: 'atk', cost: 2100, from: ['t_gloves', 't_dagger'], stats: { as: 0.25, atk: 30 }, passive: 'hpburn', pdesc: 'Basic attacks deal bonus physical damage equal to 2.5% of the target\'s current HP.', unlock: 4, tier: 3, icon: ['talon', '#ff9a4a'] },
  { id: 'a_great', name: 'Avalanche Greatsword', cat: 'atk', cost: 2350, from: ['t_axe', 't_charm'], stats: { atk: 85, crit: 0.15, critDmg: 0.4 }, pdesc: '+40% Critical Damage.', unlock: 6, tier: 3, icon: ['greatsword', '#d8f3ff'] },
  { id: 'a_reaper', name: "Executioner's Rime", cat: 'atk', cost: 2050, from: ['t_axe', 't_belt'], stats: { atk: 55, hp: 300 }, passive: 'execute', pdesc: 'Deal 20% more damage to enemies below 40% HP.', unlock: 8, tier: 3, icon: ['scythe', '#a8b8ff'] },
  { id: 'a_tempest', name: 'Tempest Spear', cat: 'atk', cost: 2050, from: ['t_gloves', 't_fang'], stats: { atk: 40, as: 0.2, ls: 0.08 }, passive: 'rampage', pdesc: 'Kills and assists grant 30% movement speed for 3s.', unlock: 11, tier: 3, icon: ['spear', '#c4f0ff'] },
  // ---- magic ----
  { id: 'm_staff', name: 'Aurora Staff', cat: 'mag', cost: 2000, from: ['t_shard', 't_glass'], stats: { mag: 75, cdr: 0.1, mana: 200 }, unlock: 1, tier: 3, icon: ['staff', '#a6ffdf'] },
  { id: 'm_scepter', name: 'Glacial Scepter', cat: 'mag', cost: 2100, from: ['t_wand', 't_belt'], stats: { mag: 65, hp: 450 }, passive: 'skillslow', pdesc: 'Skill damage slows enemies by 20% for 1s.', unlock: 1, tier: 3, icon: ['scepter', '#9fe6ff'] },
  { id: 'm_tome', name: 'Soulfrost Tome', cat: 'mag', cost: 1900, from: ['t_shard', 't_orb'], stats: { mag: 65, sv: 0.15, mana: 300 }, unlock: 1, tier: 3, icon: ['book', '#c9a8ff'] },
  { id: 'm_prism', name: 'Void Prism', cat: 'mag', cost: 2050, from: ['t_wand', 't_shard'], stats: { mag: 70, mpenP: 0.3 }, pdesc: '+30% Magic Penetration.', unlock: 2, tier: 3, icon: ['prism', '#b28aff'] },
  { id: 'm_orb', name: 'Starfall Orb', cat: 'mag', cost: 2300, from: ['t_wand', 't_wand'], stats: { mag: 110 }, passive: 'amp', pdesc: 'Increases total Magic Power by 20%.', unlock: 7, tier: 3, icon: ['star', '#fff0a0'] },
  { id: 'm_glass', name: 'Crystal Hourglass', cat: 'mag', cost: 2000, from: ['t_glass', 't_orb'], stats: { mag: 55, cdr: 0.2, mpReg: 4 }, unlock: 9, tier: 3, icon: ['hourglass', '#9fe8ff'] },
  { id: 'm_flame', name: 'Pyre Lantern', cat: 'mag', cost: 2250, from: ['t_wand', 't_glass'], stats: { mag: 80, cdr: 0.05 }, passive: 'pyre', pdesc: 'Damaging an enemy hero with a skill burns them for 3% of their max HP over 3s.', unlock: 12, tier: 3, icon: ['lantern', '#ffb24a'] },
  // ---- defense ----
  { id: 'd_aegis', name: 'Icewall Aegis', cat: 'def', cost: 1850, from: ['t_belt', 't_plate'], stats: { hp: 900, armor: 35 }, unlock: 1, tier: 3, icon: ['shield', '#9fd0ff'] },
  { id: 'd_cloak', name: 'Northern Cloak', cat: 'def', cost: 1850, from: ['t_belt', 't_mantle'], stats: { hp: 800, mr: 40, hpReg: 8 }, unlock: 1, tier: 3, icon: ['cloak', '#a8b8ff'] },
  { id: 'd_rime', name: 'Rimebound Plate', cat: 'def', cost: 1800, from: ['t_plate', 't_plate'], stats: { armor: 65 }, passive: 'cold', pdesc: 'Enemies who basic-attack you lose 20% attack speed for 2s.', unlock: 1, tier: 3, icon: ['armor', '#c8e8ff'] },
  { id: 'd_thorn', name: 'Thornfrost Mail', cat: 'def', cost: 1850, from: ['t_plate', 't_belt'], stats: { armor: 50, hp: 400 }, passive: 'thorns', pdesc: 'Reflects 25% of basic attack damage taken as magic damage.', unlock: 3, tier: 3, icon: ['thorn', '#9ff0d0'] },
  { id: 'd_guard', name: 'Guardian Aurora', cat: 'def', cost: 2200, from: ['t_belt', 't_moss'], stats: { hp: 1000, hpReg: 10 }, passive: 'aurora', pdesc: 'When HP drops below 30%, gain a shield of 25% Max HP for 3s (60s cooldown).', unlock: 5, tier: 3, icon: ['aurora', '#a6ffdf'] },
  { id: 'd_helm', name: 'Frostbound Helm', cat: 'def', cost: 2000, from: ['t_belt', 't_belt'], stats: { hp: 1500, hpReg: 15 }, unlock: 10, tier: 3, icon: ['helm', '#d8e8ff'] },
  { id: 'd_veil', name: 'Moonsilk Veil', cat: 'def', cost: 1900, from: ['t_mantle', 't_mantle'], stats: { mr: 60, cdr: 0.1 }, unlock: 13, tier: 3, icon: ['veil', '#d0c0ff'] },
  { id: 'd_bulwark', name: "Titan's Bulwark", cat: 'def', cost: 2300, from: ['t_plate', 't_mantle'], stats: { armor: 30, mr: 30, hp: 700 }, passive: 'tenacity', pdesc: 'Reduces the duration of crowd control on you by 25%.', unlock: 14, tier: 3, icon: ['bulwark', '#ffd88a'] },
  // ---- boots ----
  { id: 'b_wind', name: 'Windstep Boots', cat: 'move', cost: 750, from: ['boots'], stats: { ms: 0.9, as: 0.15 }, unlock: 1, tier: 2, icon: ['boot', '#bff7c9'] },
  { id: 'b_rune', name: 'Runic Boots', cat: 'move', cost: 750, from: ['boots'], stats: { ms: 0.9, mpen: 10 }, unlock: 1, tier: 2, icon: ['boot', '#c8a8ff'] },
  { id: 'b_iron', name: 'Ironclad Boots', cat: 'move', cost: 750, from: ['boots'], stats: { ms: 0.9, armor: 22 }, unlock: 1, tier: 2, icon: ['boot', '#c9d2dd'] },
  { id: 'b_myst', name: 'Mystic Treads', cat: 'move', cost: 750, from: ['boots'], stats: { ms: 0.9, mr: 22 }, unlock: 1, tier: 2, icon: ['boot', '#9fb8ff'] },
  { id: 'b_mind', name: 'Swiftmind Boots', cat: 'move', cost: 750, from: ['boots'], stats: { ms: 0.9, cdr: 0.1 }, unlock: 3, tier: 2, icon: ['boot', '#fff0a0'] },
  // ---- jungle / roam ----
  { id: 'j_talisman', name: "Hunter's Talisman", cat: 'jg', cost: 300, stats: { atk: 8 }, passive: 'jungle', pdesc: 'Deal 25% more damage to monsters and gain 20% more gold and EXP from them.', unlock: 1, tier: 1, icon: ['talisman', '#ffb36b'] },
  { id: 'j_charm', name: 'Guardian Charm', cat: 'jg', cost: 300, stats: { hpReg: 4 }, passive: 'roam', pdesc: 'Gain gold whenever a nearby allied hero gets gold from minions.', unlock: 1, tier: 1, icon: ['charm', '#fff2b0'] },
];
export const ITEM_BY_ID = Object.fromEntries(ITEMS.map((it) => [it.id, it]));
// A hero's build with locked items swapped for unlocked items of the same category.
export function effectiveBuild(build, avail) {
  const out = [];
  for (const id of build) {
    if (avail.has(id)) { if (!out.includes(id)) out.push(id); continue; }
    const it = ITEM_BY_ID[id];
    const alt = ITEMS.find((x) => x.cat === it.cat && x.tier === it.tier && avail.has(x.id) && !out.includes(x.id) && !build.includes(x.id));
    if (alt) out.push(alt.id);
  }
  // fill the remaining slots with unlocked legendaries (defense first, then the build's main category)
  const main = ITEM_BY_ID[build[2]]?.cat || 'def';
  const extras = ITEMS.filter((x) => x.tier === 3 && avail.has(x.id) && !out.includes(x.id)).sort((a, b) => (a.cat === 'def' ? 0 : a.cat === main ? 1 : 2) - (b.cat === 'def' ? 0 : b.cat === main ? 1 : 2));
  for (const x of extras) { if (out.length >= 6) break; out.push(x.id); }
  return out.slice(0, 6);
}
for (const it of ITEMS) if (!it.unlock) it.unlock = 1;

// Account level rewards (1..15)
export const ACCOUNT_MAX = 15;
export const ACCOUNT_XP = [0, 0, 200, 450, 750, 1100, 1500, 1950, 2450, 3000, 3600, 4250, 4950, 5700, 6500, 7400]; // total xp to reach level index
export function accountLevelFromXp(xp) {
  let l = 1;
  for (let i = 2; i <= ACCOUNT_MAX; i++) if (xp >= ACCOUNT_XP[i]) l = i;
  return l;
}
export function itemUnlocked(it, accountLevel, unlockAll) {
  return unlockAll || (it.unlock || 1) <= accountLevel;
}

export const SPELLS = [
  { id: 'blink', name: 'Blink', cd: 120, icon: ['blink', '#9fe8ff'], desc: 'Teleport a short distance in the aimed direction.', aim: 'dir', range: 4.5 },
  { id: 'mend', name: 'Mend', cd: 90, icon: ['heal', '#a6ffbf'], desc: 'Restore 15% of your max HP and 10% for the nearby ally with the lowest HP.', aim: 'self' },
  { id: 'frostbite', name: 'Frostbite', cd: 35, icon: ['frostbite', '#7fd8ff'], desc: 'Deal heavy true damage to a nearby monster or minion (gains bonus gold in the jungle). Required for junglers.', aim: 'self', range: 5.5 },
  { id: 'sprint', name: 'Sprint', cd: 100, icon: ['sprint', '#fff0a0'], desc: 'Gain 60% movement speed decaying over 6s.', aim: 'self' },
  { id: 'purify', name: 'Purify', cd: 90, icon: ['purify', '#ffffff'], desc: 'Remove all crowd control effects and become immune to them for 1.2s.', aim: 'self' },
  { id: 'execute', name: 'Execute', cd: 90, icon: ['execute', '#ff9a9a'], desc: 'Deal true damage to a nearby enemy hero, increased by their missing HP.', aim: 'self', range: 5.5 },
  { id: 'aegis', name: 'Aegis', cd: 90, icon: ['shield', '#ffd88a'], desc: 'Gain a large shield for 3s.', aim: 'self' },
];
export const SPELL_BY_ID = Object.fromEntries(SPELLS.map((s) => [s.id, s]));

export const PETS = [
  { id: 'fox', name: 'Kit the Snow Fox', short: 'Kit', unlock: 1, perk: '+4% movement speed', color: '#ffffff', accent: '#ffb36b' },
  { id: 'penguin', name: 'Pebble the Penguin', short: 'Pebble', unlock: 1, perk: '+6% gold from minions and monsters', color: '#2b3550', accent: '#ffc24a' },
  { id: 'bunny', name: 'Mochi the Frost Bunny', short: 'Mochi', unlock: 3, perk: '+6% EXP gained', color: '#fff6fb', accent: '#ff9ccf' },
  { id: 'owl', name: 'Hoot the Snowy Owl', short: 'Hoot', unlock: 5, perk: '+2.5m vision range', color: '#f4f8ff', accent: '#ffcf5c' },
  { id: 'sprite', name: 'Glimmer the Ice Sprite', short: 'Glimmer', unlock: 7, perk: '+4 HP and +2 mana regen per second', color: '#bff6ff', accent: '#ffffff' },
  { id: 'seal', name: 'Puff the Snow Seal', short: 'Puff', unlock: 9, perk: '+4% damage reduction', color: '#e6eef8', accent: '#8fb7e6' },
  { id: 'dragon', name: 'Ember the Wyrmling', short: 'Ember', unlock: 12, perk: 'Breathes frostfire on your target every 6s', color: '#6fc8ff', accent: '#ffe08a' },
  { id: 'phoenix', name: 'Aurora Chick', short: 'Aurora', unlock: 15, perk: '+3% movement speed, damage and EXP', color: '#a6ffdf', accent: '#ff9ccf' },
];
export const PET_BY_ID = Object.fromEntries(PETS.map((p) => [p.id, p]));
