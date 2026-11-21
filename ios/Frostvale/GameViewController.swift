import UIKit
import WebKit

/// Hosts the WebGL game in a full-screen WKWebView and bridges native features
/// (haptics and Multipeer WiFi play) to JavaScript.
final class GameViewController: UIViewController, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate {
    private var webView: WKWebView!
    private var bridge: MultipeerBridge?
    private let lightHaptic = UIImpactFeedbackGenerator(style: .light)
    private let mediumHaptic = UIImpactFeedbackGenerator(style: .medium)
    private let heavyHaptic = UIImpactFeedbackGenerator(style: .heavy)

    override func loadView() {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        let content = WKUserContentController()
        content.add(WeakScriptHandler(self), name: "mp")
        content.add(WeakScriptHandler(self), name: "haptic")
        config.userContentController = content
        if #available(iOS 14.0, *) {
            config.defaultWebpagePreferences.allowsContentJavaScript = true
        }
        let web = WKWebView(frame: .zero, configuration: config)
        web.scrollView.isScrollEnabled = false
        web.scrollView.bounces = false
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.scrollView.pinchGestureRecognizer?.isEnabled = false
        web.isOpaque = false
        web.backgroundColor = UIColor(red: 0.04, green: 0.08, blue: 0.19, alpha: 1)
        web.allowsLinkPreview = false
        web.navigationDelegate = self
        web.uiDelegate = self
        if #available(iOS 16.4, *) {
            web.isInspectable = true
        }
        webView = web
        view = web
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        if let index = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "www") {
            webView.loadFileURL(index, allowingReadAccessTo: index.deletingLastPathComponent())
        }
        lightHaptic.prepare()
    }

    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge { .all }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .landscape }

    // MARK: - JavaScript bridge

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        switch message.name {
        case "haptic":
            let kind = message.body as? String ?? "light"
            switch kind {
            case "heavy": heavyHaptic.impactOccurred()
            case "medium": mediumHaptic.impactOccurred()
            default: lightHaptic.impactOccurred()
            }
        case "mp":
            guard let body = message.body as? [String: Any], let cmd = body["cmd"] as? String else { return }
            handleMultipeer(cmd: cmd, body: body)
        default:
            break
        }
    }

    private func handleMultipeer(cmd: String, body: [String: Any]) {
        switch cmd {
        case "host":
            bridge?.stop()
            let b = makeBridge(name: body["name"] as? String ?? UIDevice.current.name)
            b.startHosting()
        case "browse":
            bridge?.stop()
            let b = makeBridge(name: body["name"] as? String ?? UIDevice.current.name)
            b.startBrowsing()
        case "join":
            if let id = body["id"] as? String { bridge?.join(id) }
        case "send":
            if let to = body["to"] as? String, let data = body["data"] as? String { bridge?.send(to: to, text: data) }
        case "stop":
            bridge?.stop()
            bridge = nil
        default:
            break
        }
    }

    private func makeBridge(name: String) -> MultipeerBridge {
        let b = MultipeerBridge(displayName: name)
        b.emit = { [weak self] event in
            guard let data = try? JSONSerialization.data(withJSONObject: event, options: []),
                  let json = String(data: data, encoding: .utf8) else { return }
            DispatchQueue.main.async {
                self?.webView.evaluateJavaScript("window.__mp && window.__mp(\(json));", completionHandler: nil)
            }
        }
        bridge = b
        return b
    }

    // MARK: - Navigation (keep everything inside the app bundle)

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let url = navigationAction.request.url, url.isFileURL || url.scheme == "about" {
            decisionHandler(.allow)
        } else {
            decisionHandler(.cancel)
        }
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        // Reload if iOS reclaimed the web content process (e.g. under memory pressure).
        webView.reload()
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        present(alert, animated: true)
    }
}

/// Avoids a retain cycle between WKUserContentController and the view controller.
final class WeakScriptHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(userContentController, didReceive: message)
    }
}
