// LAN server: serves the web build (dist/) and relays multiplayer messages between devices on the same WiFi.
// Usage: node server/relay.js [port]   then open http://<this-computer-ip>:<port> on each phone, or use "LAN Server" in the iOS app.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const port = +(process.argv[2] || process.env.PORT || 8787);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(root, path.normalize(p));
  if (!f.startsWith(root)) { res.writeHead(403); res.end(); return; }
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });
const rooms = new Map(); // room -> { host: ws, peers: Map(id -> ws) }
let nextId = 1;
wss.on('connection', (ws) => {
  ws.id = 'p' + nextId++;
  ws.on('message', (buf) => {
    let m; try { m = JSON.parse(buf.toString()); } catch { return; }
    if (m.t === 'join') {
      const room = String(m.room || 'frostvale').slice(0, 32);
      let R = rooms.get(room);
      if (m.host) {
        if (R && R.host && R.host.readyState === 1) { ws.send(JSON.stringify({ t: 'error', msg: 'A host already exists for this room' })); return; }
        R = { host: ws, peers: new Map() };
        rooms.set(room, R);
      } else if (!R || !R.host || R.host.readyState !== 1) { ws.send(JSON.stringify({ t: 'error', msg: 'No host found. Ask a friend to host first.' })); return; }
      ws.room = room; ws.name = String(m.name || 'Player').slice(0, 20); ws.isHost = !!m.host;
      if (!m.host) { R.peers.set(ws.id, ws); R.host.send(JSON.stringify({ t: 'peer', id: ws.id, name: ws.name, on: true })); }
      ws.send(JSON.stringify({ t: 'joined', id: ws.id }));
      return;
    }
    if (m.t === 'to') {
      const R = rooms.get(ws.room);
      if (!R) return;
      const payload = JSON.stringify({ t: 'msg', from: ws.isHost ? 'host' : ws.id, d: m.d });
      if (ws.isHost) {
        if (m.to === 'all') { for (const p of R.peers.values()) if (p.readyState === 1) p.send(payload); }
        else { const p = R.peers.get(m.to); if (p && p.readyState === 1) p.send(payload); }
      } else if (R.host.readyState === 1) R.host.send(payload);
    }
  });
  ws.on('close', () => {
    const R = rooms.get(ws.room);
    if (!R) return;
    if (ws.isHost) { for (const p of R.peers.values()) p.close(); rooms.delete(ws.room); }
    else { R.peers.delete(ws.id); if (R.host.readyState === 1) R.host.send(JSON.stringify({ t: 'peer', id: ws.id, name: ws.name, on: false })); }
  });
});

server.listen(port, '0.0.0.0', () => {
  const ips = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
  console.log(`Frostvale LAN server running on port ${port}`);
  for (const ip of ips) console.log(`  Play in a browser:   http://${ip}:${port}\n  iOS app LAN address: ${ip}:${port}`);
  if (!fs.existsSync(root)) console.log('  (dist/ not found - run "npm run build" first to serve the game)');
});
