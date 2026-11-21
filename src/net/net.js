// WiFi multiplayer transports. Host-authoritative star topology: clients talk to 'host', host broadcasts.
// 1) RelayNet: WebSocket relay on a computer in the same WiFi (node server/relay.js)
// 2) NativeNet: iPhone-to-iPhone over Apple Multipeer Connectivity (only inside the iOS app)

export function hasNative() { return !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.mp); }

class BaseNet {
  constructor() { this.onMessage = () => {}; this.onPeer = () => {}; this.onFound = () => {}; this.onClose = () => {}; this.isHost = false; this.id = null; this.peers = new Map(); }
}

export class RelayNet extends BaseNet {
  constructor(url) { super(); this.url = url; this.ws = null; }
  connect(room, name, asHost) {
    this.isHost = asHost;
    return new Promise((resolve, reject) => {
      let done = false;
      try { this.ws = new WebSocket(this.url); } catch (e) { reject(e); return; }
      const to = setTimeout(() => { if (!done) { done = true; reject(new Error('Connection timed out')); try { this.ws.close(); } catch { /* */ } } }, 6000);
      this.ws.onopen = () => this.ws.send(JSON.stringify({ t: 'join', room, name, host: asHost }));
      this.ws.onmessage = (ev) => {
        let m; try { m = JSON.parse(ev.data); } catch { return; }
        if (m.t === 'joined') { this.id = m.id; if (!done) { done = true; clearTimeout(to); resolve(m); } }
        else if (m.t === 'error') { if (!done) { done = true; clearTimeout(to); reject(new Error(m.msg)); } }
        else if (m.t === 'peer') { if (m.on) this.peers.set(m.id, m.name); else this.peers.delete(m.id); this.onPeer(m.id, m.name, m.on); }
        else if (m.t === 'msg') this.onMessage(m.from, m.d);
      };
      this.ws.onerror = () => { if (!done) { done = true; clearTimeout(to); reject(new Error('Could not reach the LAN server')); } };
      this.ws.onclose = () => this.onClose();
    });
  }
  send(to, d) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify({ t: 'to', to, d })); }
  broadcast(d) { this.send('all', d); }
  close() { try { this.ws && this.ws.close(); } catch { /* */ } }
}

export class NativeNet extends BaseNet {
  constructor() {
    super();
    window.__mp = (e) => this.event(typeof e === 'string' ? JSON.parse(e) : e);
  }
  post(o) { window.webkit.messageHandlers.mp.postMessage(o); }
  host(name) { this.isHost = true; this.post({ cmd: 'host', name }); }
  browse(name) { this.isHost = false; this.post({ cmd: 'browse', name }); }
  join(id) { this.post({ cmd: 'join', id }); }
  event(e) {
    switch (e.type) {
      case 'found': this.onFound(e.id, e.name, true); break;
      case 'lost': this.onFound(e.id, e.name, false); break;
      case 'peer': if (e.state === 'connected') this.peers.set(e.id, e.name); else this.peers.delete(e.id); this.onPeer(e.id, e.name, e.state === 'connected'); break;
      case 'msg': { let d = e.data; if (typeof d === 'string') { try { d = JSON.parse(d); } catch { return; } } this.onMessage(this.isHost ? e.from : 'host', d); break; }
    }
  }
  send(to, d) { this.post({ cmd: 'send', to, data: JSON.stringify(d) }); }
  broadcast(d) { this.send('all', d); }
  close() { this.post({ cmd: 'stop' }); }
}
