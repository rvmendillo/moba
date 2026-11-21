// Icons rendered on glossy procedural frames (emoji glyphs; Apple Color Emoji on iPhone).
const GLYPH = {
  // skills
  shieldDash: '🛡️', quake: '🧊', leap: '💥', snowball: '⛄', roar: '🏔️', slashDash: '🌙', whirl: '🌀', execute: '🗡️', spear: '🔱', wing: '🕊️', meteor: '☄️',
  blinkStrike: '🌑', shuriken: '💠', cuts: '🗡️', pounce: '🐾', veil: '🌫️', claw: '🐆', iceLance: '❄️', nova: '💫', blizzard: '🌌', fireball: '🔥', ring: '⭕',
  arrow: '🏹', windStep: '🍃', arrowRain: '🌧️', scatter: '💢', roll: '🌪️', sniper: '🎯', heal: '✨', chain: '⛓️', sanctuary: '🔔', note: '🎵', sleep: '💤', anthem: '🎶',
  // passives
  shield: '🛡️', heart: '❤️', sword: '🗡️', eye: '👁️', snowflake: '❄️', flame: '🔥', arrows: '🏹', target: '🎯',
  // items
  dagger: '🗡️', axe: '🪓', glove: '🧤', clover: '🍀', fang: '🦷', rune: '🔮', orb: '🔵', wand: '🪄', hourglass: '⏳', belt: '🎗️', plate: '🛡️', mantle: '🧣', leaf: '🌿',
  boot: '👢', cleaver: '🔪', bow: '🏹', fangBlade: '🗡️', talon: '🦅', greatsword: '⚔️', scythe: '🌙', staff: '🪄', scepter: '🔱', book: '📘', prism: '💎', star: '⭐',
  lantern: '🏮', cloak: '🧥', armor: '🦺', thorn: '🌵', aurora: '🌌', helm: '⛑️', bulwark: '🏰', talisman: '🧿', charm: '📿',
  // spells
  blink: '💨', frostbite: '🥶', sprint: '👟', purify: '🕊️', executeSpell: '💀',
  // pets
  fox: '🦊', penguin: '🐧', bunny: '🐰', owl: '🦉', sprite: '🧚', seal: '🦭', dragon: '🐉', phoenix: '🐦',
};
export const PET_EMOJI = { fox: '🦊', penguin: '🐧', bunny: '🐰', owl: '🦉', sprite: '🧚', seal: '🦭', dragon: '🐉', phoenix: '🐦' };
const cache = new Map();
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (k < 0) { r *= 1 + k; g *= 1 + k; b *= 1 + k; } else { r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
export function icon(key, color = '#6fb8ff', opts = {}) {
  const ck = key + color + (opts.square ? 's' : '') + (opts.gold ? 'g' : '');
  if (cache.has(ck)) return cache.get(ck);
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const shapePath = () => {
    g.beginPath();
    if (opts.square) { const r = 26; g.moveTo(r, 4); g.arcTo(S - 4, 4, S - 4, S - 4, r); g.arcTo(S - 4, S - 4, 4, S - 4, r); g.arcTo(4, S - 4, 4, 4, r); g.arcTo(4, 4, S - 4, 4, r); g.closePath(); }
    else g.arc(S / 2, S / 2, S / 2 - 4, 0, Math.PI * 2);
  };
  shapePath();
  const gr = g.createRadialGradient(S * 0.38, S * 0.3, 4, S / 2, S / 2, S * 0.62);
  gr.addColorStop(0, shade(color, 0.55)); gr.addColorStop(0.55, color); gr.addColorStop(1, shade(color, -0.55));
  g.fillStyle = gr; g.fill();
  g.save(); shapePath(); g.clip();
  // inner sparkle pattern
  g.globalAlpha = 0.18;
  for (let i = 0; i < 6; i++) { g.fillStyle = '#fff'; g.beginPath(); g.arc((i * 37) % S, (i * 53) % S, 3 + (i % 3), 0, Math.PI * 2); g.fill(); }
  g.globalAlpha = 1;
  g.font = `${opts.square ? 66 : 64}px "Apple Color Emoji","Noto Color Emoji","Segoe UI Emoji",sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,30,0.55)'; g.shadowBlur = 8; g.shadowOffsetY = 3;
  g.fillText(GLYPH[key] || key || '✦', S / 2, S / 2 + 5);
  g.shadowColor = 'transparent';
  const hl = g.createLinearGradient(0, 0, 0, S * 0.5);
  hl.addColorStop(0, 'rgba(255,255,255,0.45)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = hl; g.beginPath(); g.ellipse(S / 2, S * 0.2, S * 0.38, S * 0.2, 0, 0, Math.PI * 2); g.fill();
  g.restore();
  shapePath();
  g.lineWidth = opts.gold ? 7 : 5;
  const rg = g.createLinearGradient(0, 0, S, S);
  if (opts.gold) { rg.addColorStop(0, '#fff2b8'); rg.addColorStop(0.5, '#ffc04a'); rg.addColorStop(1, '#b86a1e'); }
  else { rg.addColorStop(0, 'rgba(255,255,255,0.95)'); rg.addColorStop(1, 'rgba(170,210,255,0.6)'); }
  g.strokeStyle = rg; g.stroke();
  const url = c.toDataURL();
  cache.set(ck, url);
  return url;
}
export function skillIcon(skill) { return icon(skill.icon, skill.color || '#6fb8ff', { gold: !!skill.ult }); }
export function itemIcon(it) { return icon(it.icon[0], it.icon[1], { square: true, gold: it.tier === 3 }); }
export function spellIcon(sp) { return icon(sp.id === 'execute' ? 'executeSpell' : sp.icon[0], sp.icon[1]); }
export function petIcon(p) { return icon(p.id, p.accent || '#9fe8ff'); }
