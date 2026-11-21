// End-to-end UI flow test at iPhone 16 Plus landscape size.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const out = process.argv[2] || (await import('node:os')).tmpdir() + '/flow';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 932, height: 430 }, deviceScaleFactor: 1, hasTouch: true });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
await page.goto('file://' + process.cwd() + '/dist/index.html');
await page.waitForTimeout(9000);
await page.screenshot({ path: out + '_1menu.png' });
await page.getByText('Battle  ·  5v5 vs AI').click();
await page.waitForTimeout(4000);
await page.screenshot({ path: out + '_2select.png' });
await page.getByText('⚔️ Battle!').click();
await page.waitForTimeout(900);
await page.screenshot({ path: out + '_3loading.png' });
await page.waitForTimeout(12000);
await page.screenshot({ path: out + '_4match.png' });
// move with keyboard + attack, cast a skill
await page.keyboard.down('d'); await page.waitForTimeout(1500); await page.keyboard.up('d');
await page.evaluate(() => { const s = window.app.session; s.world.time += 0; });
await page.waitForTimeout(3000);
await page.screenshot({ path: out + '_5match.png' });
console.log(logs.slice(0, 30).join('\n') || 'no errors');
await browser.close();
