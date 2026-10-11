import SwiftUI
import UIKit
import WebKit

// Full-screen web view that runs the bundled single-file game. The page handles safe-area insets itself.
struct GameView: UIViewRepresentable {
    // Matches the body background in index.html.
    static let background = UIColor(red: 11 / 255, green: 26 / 255, blue: 58 / 255, alpha: 1)

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        // Lets the WebAudio synth start on the first tap without a media gesture gate.
        config.mediaTypesRequiringUserActionForPlayback = []
        // The default store keeps localStorage (profile and deck) across launches.
        config.websiteDataStore = .default()
        // Weak proxy: the configuration retains its handlers, so a direct reference would leak the coordinator.
        config.userContentController.add(WeakScriptHandler(context.coordinator), name: "haptic")

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.allowsLinkPreview = false
        webView.allowsBackForwardNavigationGestures = false
        webView.isOpaque = false
        webView.backgroundColor = GameView.background
        webView.scrollView.backgroundColor = GameView.background
        webView.scrollView.delegate = context.coordinator
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.bounces = false
        webView.scrollView.bouncesZoom = false
        webView.scrollView.minimumZoomScale = 1
        webView.scrollView.maximumZoomScale = 1
        webView.scrollView.pinchGestureRecognizer?.isEnabled = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        #if DEBUG
        webView.isInspectable = true
        #endif

        if let webDir = Bundle.main.resourceURL?.appendingPathComponent("Web", isDirectory: true) {
            webView.loadFileURL(webDir.appendingPathComponent("index.html"), allowingReadAccessTo: webDir)
        } else {
            assertionFailure("Web folder missing from app bundle")
        }
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, UIScrollViewDelegate, WKScriptMessageHandler {
        // Keeps the game on its own pages: only local file loads are allowed.
        func webView(_ webView: WKWebView,
                     decidePolicyFor action: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            let scheme = action.request.url?.scheme ?? ""
            decisionHandler(scheme == "file" || scheme == "about" ? .allow : .cancel)
        }

        // No pinch zoom.
        func viewForZooming(in scrollView: UIScrollView) -> UIView? {
            nil
        }

        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "haptic", let kind = message.body as? String else { return }
            Haptics.play(kind)
        }
    }
}

private final class WeakScriptHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?

    init(_ target: WKScriptMessageHandler) {
        self.target = target
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(controller, didReceive: message)
    }
}
