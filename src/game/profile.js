// Player profile, settings and account progression (stored on device).
import { ACCOUNT_XP, ACCOUNT_MAX, accountLevelFromXp, ITEMS, PETS } from '../data/items.js';

const KEY = 'frostvale.profile.v1';
const DEFAULTS = {
  name: 'Player', xp: 0, wins: 0, losses: 0, matches: 0, kills: 0,
  hero: 'kael', pet: 'fox', spell: null, history: [],
  settings: { quality: 2, music: 0.55, sfx: 0.85, voice: true, fps: false, zoom: 1, autoLevel: true, difficulty: 'normal', unlockAll: false, haptics: true },
};
export function loadProfile() {
  let p = null;
  try { p = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { p = null; }
  p = { ...DEFAULTS, ...(p || {}) };
  p.settings = { ...DEFAULTS.settings, ...(p.settings || {}) };
  return p;
}
export function saveProfile(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage unavailable */ } }
export function level(p) { return accountLevelFromXp(p.xp); }
export function levelProgress(p) {
  const L = level(p);
  if (L >= ACCOUNT_MAX) return { L, cur: 1, need: 1, k: 1 };
  const base = ACCOUNT_XP[L], next = ACCOUNT_XP[L + 1];
  return { L, cur: p.xp - base, need: next - base, k: (p.xp - base) / (next - base) };
}
export function unlocksAt(L) {
  return { items: ITEMS.filter((i) => i.tier === 3 && i.unlock === L), boots: ITEMS.filter((i) => i.cat === 'move' && i.unlock === L && i.tier === 2), pets: PETS.filter((p) => p.unlock === L) };
}
export function availableItems(p) {
  const L = level(p);
  return ITEMS.filter((i) => p.settings.unlockAll || (i.unlock || 1) <= L).map((i) => i.id);
}
export function grantMatchXp(p, won, kills, assists) {
  const before = level(p);
  const gain = (won ? 320 : 170) + kills * 12 + assists * 6;
  p.xp += gain; p.matches++; if (won) p.wins++; else p.losses++; p.kills += kills;
  const after = level(p);
  const unlocked = [];
  for (let L = before + 1; L <= after; L++) unlocked.push({ L, ...unlocksAt(L) });
  return { gain, before, after, unlocked };
}
