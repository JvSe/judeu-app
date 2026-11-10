import ExpoModulesCore
import MultipeerConnectivity

// Modo Apresentação: liga o iPhone e o iPad direto (Wi-Fi ponto a ponto, o mesmo
// mecanismo do AirDrop), sem internet, roteador ou servidor. O JS manda e recebe
// mensagens JSON curtas; a conexão se refaz sozinha se cair.
public class DemoPeerModule: Module {
  private var session: DemoPeerSession?

  public func definition() -> ModuleDefinition {
    Name("DemoPeer")

    Events("onPeerState", "onMessage")

    Function("start") { (displayName: String) in
      self.session?.stop()
      let next = DemoPeerSession(displayName: displayName) { [weak self] name, body in
        self?.sendEvent(name, body)
      }
      self.session = next
      next.start()
    }

    Function("stop") {
      self.session?.stop()
      self.session = nil
    }

    Function("send") { (json: String) -> Bool in
      return self.session?.send(json) ?? false
    }

    Function("connectedCount") { () -> Int in
      return self.session?.connectedCount() ?? 0
    }

    OnDestroy {
      self.session?.stop()
      self.session = nil
    }
  }
}

final class DemoPeerSession: NSObject, MCSessionDelegate, MCNearbyServiceAdvertiserDelegate,
  MCNearbyServiceBrowserDelegate
{
  // Máx. 15 caracteres: letras minúsculas, números e hífen (bate com NSBonjourServices).
  private static let serviceType = "ajuda-demo"

  private let myPeer: MCPeerID
  private let mcSession: MCSession
  private let advertiser: MCNearbyServiceAdvertiser
  private let browser: MCNearbyServiceBrowser
  private let emit: (String, [String: Any]) -> Void
  private var invited = Set<String>()
  private var running = false

  init(displayName: String, emit: @escaping (String, [String: Any]) -> Void) {
    self.myPeer = MCPeerID(displayName: String(displayName.prefix(60)))
    self.mcSession = MCSession(peer: myPeer, securityIdentity: nil, encryptionPreference: .none)
    self.advertiser = MCNearbyServiceAdvertiser(
      peer: myPeer, discoveryInfo: nil, serviceType: DemoPeerSession.serviceType)
    self.browser = MCNearbyServiceBrowser(peer: myPeer, serviceType: DemoPeerSession.serviceType)
    self.emit = emit
    super.init()
    mcSession.delegate = self
    advertiser.delegate = self
    browser.delegate = self
  }

  func start() {
    running = true
    advertiser.startAdvertisingPeer()
    browser.startBrowsingForPeers()
    emitState("searching", peer: nil)
  }

  func stop() {
    running = false
    advertiser.stopAdvertisingPeer()
    browser.stopBrowsingForPeers()
    mcSession.disconnect()
  }

  func connectedCount() -> Int {
    return mcSession.connectedPeers.count
  }

  func send(_ json: String) -> Bool {
    let peers = mcSession.connectedPeers
    guard !peers.isEmpty, let data = json.data(using: .utf8) else { return false }
    do {
      try mcSession.send(data, toPeers: peers, with: .reliable)
      return true
    } catch {
      return false
    }
  }

  private func emitState(_ state: String, peer: MCPeerID?) {
    emit("onPeerState", [
      "state": state,
      "peer": peer?.displayName ?? "",
      "connected": mcSession.connectedPeers.count,
    ])
  }

  // Força o browser a "achar" o par de novo (convite perdido / conexão caiu).
  private func restartBrowsing() {
    guard running else { return }
    browser.stopBrowsingForPeers()
    DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
      guard let self = self, self.running else { return }
      self.browser.startBrowsingForPeers()
    }
  }

  // MARK: MCNearbyServiceBrowserDelegate

  func browser(
    _ browser: MCNearbyServiceBrowser, foundPeer peerID: MCPeerID,
    withDiscoveryInfo info: [String: String]?
  ) {
    DispatchQueue.main.async {
      guard self.running, peerID.displayName != self.myPeer.displayName else { return }
      if self.mcSession.connectedPeers.contains(peerID) { return }
      // Só um dos lados convida (o de nome menor), para não haver convite cruzado.
      guard self.myPeer.displayName < peerID.displayName else { return }
      if self.invited.contains(peerID.displayName) { return }
      self.invited.insert(peerID.displayName)
      browser.invitePeer(peerID, to: self.mcSession, withContext: nil, timeout: 10)
    }
  }

  func browser(_ browser: MCNearbyServiceBrowser, lostPeer peerID: MCPeerID) {
    DispatchQueue.main.async {
      self.invited.remove(peerID.displayName)
    }
  }

  func browser(_ browser: MCNearbyServiceBrowser, didNotStartBrowsingForPeers error: Error) {
    emit("onPeerState", ["state": "error", "peer": "", "connected": 0, "message": error.localizedDescription])
  }

  // MARK: MCNearbyServiceAdvertiserDelegate

  func advertiser(
    _ advertiser: MCNearbyServiceAdvertiser, didReceiveInvitationFromPeer peerID: MCPeerID,
    withContext context: Data?, invitationHandler: @escaping (Bool, MCSession?) -> Void
  ) {
    invitationHandler(running, running ? mcSession : nil)
  }

  func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didNotStartAdvertisingPeer error: Error) {
    emit("onPeerState", ["state": "error", "peer": "", "connected": 0, "message": error.localizedDescription])
  }

  // MARK: MCSessionDelegate

  func session(_ session: MCSession, peer peerID: MCPeerID, didChange state: MCSessionState) {
    DispatchQueue.main.async {
      switch state {
      case .connected:
        self.emitState("connected", peer: peerID)
      case .connecting:
        self.emitState("connecting", peer: peerID)
      case .notConnected:
        self.invited.remove(peerID.displayName)
        self.emitState("disconnected", peer: peerID)
        self.restartBrowsing()
      @unknown default:
        break
      }
    }
  }

  func session(_ session: MCSession, didReceive data: Data, fromPeer peerID: MCPeerID) {
    guard let json = String(data: data, encoding: .utf8) else { return }
    emit("onMessage", ["json": json, "peer": peerID.displayName])
  }

  func session(
    _ session: MCSession, didReceive stream: InputStream, withName streamName: String,
    fromPeer peerID: MCPeerID
  ) {}

  func session(
    _ session: MCSession, didStartReceivingResourceWithName resourceName: String,
    fromPeer peerID: MCPeerID, with progress: Progress
  ) {}

  func session(
    _ session: MCSession, didFinishReceivingResourceWithName resourceName: String,
    fromPeer peerID: MCPeerID, at localURL: URL?, withError error: Error?
  ) {}
}
