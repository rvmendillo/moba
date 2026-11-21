import Foundation
import MultipeerConnectivity

/// iPhone-to-iPhone WiFi multiplayer using Apple's Multipeer Connectivity.
/// The host advertises; clients browse, invite the host and then exchange JSON text messages.
final class MultipeerBridge: NSObject, MCSessionDelegate, MCNearbyServiceAdvertiserDelegate, MCNearbyServiceBrowserDelegate {
    static let serviceType = "frostvale-moba" // must match NSBonjourServices in Info.plist

    var emit: (([String: Any]) -> Void)?

    private let myPeer: MCPeerID
    private let session: MCSession
    private var advertiser: MCNearbyServiceAdvertiser?
    private var browser: MCNearbyServiceBrowser?
    private var discovered: [String: MCPeerID] = [:]
    private var connected: [String: MCPeerID] = [:]
    private var hostPeer: MCPeerID?
    private var isHost = false
    private let lock = NSLock()

    init(displayName: String) {
        let name = String(displayName.prefix(30)).isEmpty ? "Player" : String(displayName.prefix(30))
        myPeer = MCPeerID(displayName: name)
        session = MCSession(peer: myPeer, securityIdentity: nil, encryptionPreference: .none)
        super.init()
        session.delegate = self
    }

    private func key(_ peer: MCPeerID) -> String { "\(peer.displayName)#\(peer.hash)" }

    func startHosting() {
        isHost = true
        let adv = MCNearbyServiceAdvertiser(peer: myPeer, discoveryInfo: ["game": "frostvale", "v": "1"], serviceType: Self.serviceType)
        adv.delegate = self
        adv.startAdvertisingPeer()
        advertiser = adv
    }

    func startBrowsing() {
        isHost = false
        let br = MCNearbyServiceBrowser(peer: myPeer, serviceType: Self.serviceType)
        br.delegate = self
        br.startBrowsingForPeers()
        browser = br
    }

    func join(_ id: String) {
        lock.lock(); let peer = discovered[id]; lock.unlock()
        guard let peer = peer else { return }
        hostPeer = peer
        browser?.invitePeer(peer, to: session, withContext: nil, timeout: 20)
    }

    func send(to: String, text: String) {
        guard let data = text.data(using: .utf8) else { return }
        var targets: [MCPeerID] = []
        lock.lock()
        if to == "all" {
            targets = session.connectedPeers
        } else if to == "host" {
            if let h = hostPeer { targets = [h] }
        } else if let p = connected[to] {
            targets = [p]
        }
        lock.unlock()
        if targets.isEmpty { return }
        try? session.send(data, toPeers: targets, with: .reliable)
    }

    func stop() {
        advertiser?.stopAdvertisingPeer()
        browser?.stopBrowsingForPeers()
        session.disconnect()
        advertiser = nil
        browser = nil
    }

    // MARK: MCNearbyServiceAdvertiserDelegate

    func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didReceiveInvitationFromPeer peerID: MCPeerID, withContext context: Data?, invitationHandler: @escaping (Bool, MCSession?) -> Void) {
        // MCSession supports up to 8 peers in total (host + 7 friends); bots fill the remaining slots.
        invitationHandler(session.connectedPeers.count < 7, session)
    }

    func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didNotStartAdvertisingPeer error: Error) {
        emit?(["type": "error", "message": error.localizedDescription])
    }

    // MARK: MCNearbyServiceBrowserDelegate

    func browser(_ browser: MCNearbyServiceBrowser, foundPeer peerID: MCPeerID, withDiscoveryInfo info: [String: String]?) {
        let id = key(peerID)
        lock.lock(); discovered[id] = peerID; lock.unlock()
        emit?(["type": "found", "id": id, "name": peerID.displayName])
    }

    func browser(_ browser: MCNearbyServiceBrowser, lostPeer peerID: MCPeerID) {
        let id = key(peerID)
        lock.lock(); discovered.removeValue(forKey: id); lock.unlock()
        emit?(["type": "lost", "id": id, "name": peerID.displayName])
    }

    func browser(_ browser: MCNearbyServiceBrowser, didNotStartBrowsingForPeers error: Error) {
        emit?(["type": "error", "message": error.localizedDescription])
    }

    // MARK: MCSessionDelegate

    func session(_ session: MCSession, peer peerID: MCPeerID, didChange state: MCSessionState) {
        let id = key(peerID)
        switch state {
        case .connected:
            lock.lock(); connected[id] = peerID; lock.unlock()
            if isHost || peerID == hostPeer {
                if !isHost { browser?.stopBrowsingForPeers() }
                emit?(["type": "peer", "id": id, "name": peerID.displayName, "state": "connected"])
            }
        case .notConnected:
            lock.lock(); connected.removeValue(forKey: id); lock.unlock()
            if isHost || peerID == hostPeer {
                emit?(["type": "peer", "id": id, "name": peerID.displayName, "state": "disconnected"])
            }
        default:
            break
        }
    }

    func session(_ session: MCSession, didReceive data: Data, fromPeer peerID: MCPeerID) {
        guard let text = String(data: data, encoding: .utf8) else { return }
        emit?(["type": "msg", "from": key(peerID), "data": text])
    }

    func session(_ session: MCSession, didReceive stream: InputStream, withName streamName: String, fromPeer peerID: MCPeerID) {}
    func session(_ session: MCSession, didStartReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, with progress: Progress) {}
    func session(_ session: MCSession, didFinishReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, at localURL: URL?, withError error: Error?) {}
}
