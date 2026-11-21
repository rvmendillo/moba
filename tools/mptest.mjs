// Two-device WiFi test through the LAN relay: host + client, start a match, verify the client sees snapshots.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const args = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const b1 = await chromium.launch({ args }), b2 = await chromium.launch({ args });
const mk = async (b, tag) => {
  const p = await b.newPage({ viewport: { width: 932, height: 430 } });
  p.on('pageerror', (e) => console.log(tag, 'PAGEERROR', e.message, (e.stack || '').split('\n').slice(0, 3).join(' | ')));
  p.on('console', (m) => { if (m.type() === 'error') console.log(tag, 'console.error', m.text()); });
  await p.goto('http://localhost:8787/');
  await p.waitForTimeout(8000);
  return p;
};
const host = await mk(b1, 'HOST'), client = await mk(b2, 'CLIENT');
await host.evaluate(() => { window.app.profile.name = 'HostPlayer'; });
await client.evaluate(() => { window.app.profile.name = 'ClientPlayer'; window.app.profile.hero = 'aria'; });
await host.getByText('WiFi Battle').click(); await host.waitForTimeout(500);
await host.getByRole('button', { name: 'Host', exact: true }).click(); await host.waitForTimeout(1500);
await client.getByText('WiFi Battle').click(); await client.waitForTimeout(500);
await client.getByRole('button', { name: 'Join', exact: true }).click(); await client.waitForTimeout(2500);
await host.screenshot({ path: (await import('node:os')).tmpdir() + '/mp_lobby_host.png' });
await client.screenshot({ path: (await import('node:os')).tmpdir() + '/mp_lobby_client.png' });
await host.getByText('▶ Start Match').click();
await host.waitForTimeout(16000);
await host.screenshot({ path: (await import('node:os')).tmpdir() + '/mp_host.png' });
await client.screenshot({ path: (await import('node:os')).tmpdir() + '/mp_client.png' });
const info = await client.evaluate(() => { const s = window.app.session; if (!s) return 'no session'; return { mode: s.mode, myId: s.myId, myTeam: s.myTeam, snaps: s.state.snaps.length, latestT: s.state.latestT, heroes: s.state.heroList.map((h) => h.name + ':' + h.id) }; });
console.log('CLIENT', JSON.stringify(info));
const hinfo = await host.evaluate(() => { const s = window.app.session; if (!s) return 'no session'; return { mode: s.mode, t: s.world.time.toFixed(1), clientHero: [...s.heroByNet.entries()].map(([k, h]) => k + '->' + h.name + ':' + h.def.id) }; });
console.log('HOST', JSON.stringify(hinfo));
// client moves: hold 'd' for 2s and check the hero moved on the host
const before = await host.evaluate(() => { const s = window.app.session; const h = [...s.heroByNet.values()][0]; return [h.x, h.z]; });
await client.keyboard.down('d'); await client.waitForTimeout(2500); await client.keyboard.up('d');
const after = await host.evaluate(() => { const s = window.app.session; const h = [...s.heroByNet.values()][0]; return [h.x, h.z]; });
console.log('client hero moved on host from', before.map((v) => v.toFixed(1)), 'to', after.map((v) => v.toFixed(1)));
await client.screenshot({ path: (await import('node:os')).tmpdir() + '/mp_client2.png' });
await b1.close(); await b2.close();
