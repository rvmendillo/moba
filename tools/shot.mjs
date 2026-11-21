// Screenshot helper: node tools/shot.mjs <html-file-or-url> <out.png> [waitMs] [width] [height] [evalScript]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [, , target, out = '/tmp/shot.png', wait = '4000', w = '932', h = '430', evalJs = ''] = process.argv;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => logs.push(m.type() + ': ' + m.text()));
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '')));
const url = target.startsWith('http') ? target : 'file://' + target;
await page.goto(url);
await page.waitForTimeout(+wait);
if (evalJs) { try { const r = await page.evaluate(evalJs); if (r !== undefined) logs.push('EVAL: ' + JSON.stringify(r).slice(0, 2000)); } catch (e) { logs.push('EVALERR ' + e.message); } await page.waitForTimeout(1500); }
await page.screenshot({ path: out });
console.log(logs.slice(-40).join('\n'));
await browser.close();
