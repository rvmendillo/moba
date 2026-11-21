import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const O = '/tmp/claude-0/qa';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 932, height: 430 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message, (e.stack || '').split('\n').slice(0, 3).join(' | ')));
page.on('console', (m) => { if (m.type() === 'error') console.log('console.error', m.text()); });
await page.goto('http://localhost:8787/');
await page.waitForTimeout(8000);
await page.evaluate(() => { window.app.profile.settings.unlockAll = true; window.app.profile.hero = 'pyra'; });
await page.getByText('Battle  ·  5v5 vs AI').click(); await page.waitForTimeout(2500);
await page.getByText('⚔️ Battle!').click(); await page.waitForTimeout(3000);
// autopilot + fast forward 7 minutes of game time
const ff = async (sec) => page.evaluate((sec) => { const s = window.app.session; s.world.makeBot(s.myHero); const target = s.world.time + sec; while (s.world.time < target) { s.world.step(); s.state.push(s.world.snapshot(true)); } s.state.renderT = s.state.latestT - 0.03; return s.world.time; }, sec);
console.log('time', await ff(420));
await page.waitForTimeout(2500);
await page.screenshot({ path: O + '_mid.png' });
// find a fight: move camera to the hero closest to an enemy hero
const fight = await page.evaluate(() => { const s = window.app.session; const w = s.world; let best = null, bd = 1e9; for (const a of w.heroes) for (const b of w.heroes) if (a.alive && b.alive && a.team !== b.team) { const d = Math.hypot(a.x - b.x, a.z - b.z); if (d < bd) { bd = d; best = a; } } return best ? { x: best.x, z: best.z, d: bd } : null; });
console.log('closest enemies distance', fight);
// aim drag on skill 1 (bottom right area) and release (cast)
const sk = await page.locator('.sk.s0').boundingBox();
await page.mouse.move(sk.x + sk.width / 2, sk.y + sk.height / 2);
await page.mouse.down(); await page.mouse.move(sk.x - 60, sk.y - 40, { steps: 6 }); await page.waitForTimeout(400);
await page.screenshot({ path: O + '_aim.png' });
await page.mouse.up();
await page.waitForTimeout(600);
await page.screenshot({ path: O + '_cast.png' });
// shop + scoreboard
await page.locator('.shopbtn').click(); await page.waitForTimeout(800);
await page.locator('.it').nth(3).click(); await page.waitForTimeout(400);
await page.screenshot({ path: O + '_shop.png' });
await page.getByText('Close ✕').click(); await page.waitForTimeout(300);
await page.locator('.topright .ibtn').first().click(); await page.waitForTimeout(600);
await page.screenshot({ path: O + '_score.png' });
await page.locator('.panel .x').click();
// force win
await page.evaluate(() => { const s = window.app.session; const c = s.world.cores.find((c) => c.team !== s.myTeam); c.invuln = false; s.world.dmg(null, c, 1e7, 't', { force: 1 }); });
await page.waitForTimeout(6500);
await page.screenshot({ path: O + '_end.png' });
console.log('profile xp', await page.evaluate(() => JSON.stringify({ xp: window.app.profile.xp, wins: window.app.profile.wins })));
await browser.close();
