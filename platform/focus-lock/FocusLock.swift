// English Focus Lock — keeps this Mac locked to the learning app while a focus session (started in the web app) runs.
//
// Runs in the background (LaunchAgent) and polls GET <server>/api/focus/status every 3 s.
// While `locked`: one window per screen above everything else; the main screen shows the learning web app (so you study
// inside the lock); Dock/menu bar hidden; Cmd+Tab, Force Quit, Hide and log-out/shut-down requests disabled.
//
// Safety (never trap the user):
//  - fail-open: if the server cannot be reached for ~30 s the screen unlocks;
//  - the server ends every session after its maximum duration and offers emergency unlock (60 s wait + PIN/phrase);
//  - offline escape key: Ctrl+Option+Cmd+Shift+U → 10-second confirmation → unlocks this session (reported to the server).
//
// Flags: --check (poll once, print the decision, exit)   --selftest (decision-logic tests)
import AppKit
import WebKit

// MARK: - configuration

struct Config {
    var server: URL
    var token: String?

    static func load() -> Config {
        var server = ProcessInfo.processInfo.environment["FOCUS_SERVER"] ?? "http://127.0.0.1:8080"
        var token: String? = ProcessInfo.processInfo.environment["FOCUS_TOKEN"]
        let path = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".english-focus-lock/config.json")
        if let data = try? Data(contentsOf: path), let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            if let s = obj["server"] as? String, !s.isEmpty { server = s }
            if let t = obj["token"] as? String, !t.isEmpty { token = t }
        }
        return Config(server: URL(string: server) ?? URL(string: "http://127.0.0.1:8080")!, token: token)
    }
}

// MARK: - pure decision logic (unit-tested with --selftest)

struct Decision: Equatable {
    var lock: Bool
    var reason: String
}

/// `status` is nil when the request failed. `failures` counts consecutive failures (one poll every 3 s).
func decide(locked: Bool?, sessionId: String?, releasedSession: String?, failures: Int, currentlyLocked: Bool) -> Decision {
    guard let locked = locked else {
        if failures >= 10 { return Decision(lock: false, reason: "server unreachable — fail open") }
        return Decision(lock: currentlyLocked, reason: "server unreachable — keep state briefly")
    }
    if !locked { return Decision(lock: false, reason: "no active session") }
    if let s = sessionId, s == releasedSession { return Decision(lock: false, reason: "released with escape key") }
    return Decision(lock: true, reason: "active focus session")
}

// MARK: - status client

struct Status { let locked: Bool; let sessionId: String? }

func fetchStatus(_ cfg: Config, completion: @escaping (Status?) -> Void) {
    var req = URLRequest(url: cfg.server.appendingPathComponent("api/focus/status"), timeoutInterval: 4)
    if let t = cfg.token { req.setValue("Bearer \(t)", forHTTPHeaderField: "Authorization") }
    URLSession.shared.dataTask(with: req) { data, resp, _ in
        guard let data = data, (resp as? HTTPURLResponse)?.statusCode == 200,
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let locked = obj["locked"] as? Bool else { completion(nil); return }
        let session = obj["session"] as? [String: Any]
        completion(Status(locked: locked, sessionId: session?["id"] as? String))
    }.resume()
}

func reportEscape(_ cfg: Config, sessionId: String) {
    var req = URLRequest(url: cfg.server.appendingPathComponent("api/focus/emergency/native"), timeoutInterval: 4)
    req.httpMethod = "POST"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    if let t = cfg.token { req.setValue("Bearer \(t)", forHTTPHeaderField: "Authorization") }
    req.httpBody = try? JSONSerialization.data(withJSONObject: ["session_id": sessionId])
    URLSession.shared.dataTask(with: req).resume()
}

// MARK: - lock windows

final class LockWindow: NSWindow {
    override var canBecomeKey: Bool { true }   // borderless windows must accept typing (answers, vocabulary)
    override var canBecomeMain: Bool { true }
}

final class Controller: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate {
    let cfg = Config.load()
    var windows: [LockWindow] = []
    var web: WKWebView?
    var isLocked = false
    var sessionId: String?
    var releasedSession: String?
    var failures = 0
    var timer: Timer?
    var keyMonitor: Any?
    var escapeView: NSView?
    var escapeTimer: Timer?

    func applicationDidFinishLaunching(_ n: Notification) {
        NSApp.setActivationPolicy(.accessory)
        installEditMenu()
        NSWorkspace.shared.notificationCenter.addObserver(self, selector: #selector(otherAppActivated(_:)),
                                                          name: NSWorkspace.didActivateApplicationNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(screensChanged),
                                               name: NSApplication.didChangeScreenParametersNotification, object: nil)
        timer = Timer.scheduledTimer(withTimeInterval: 3, repeats: true) { [weak self] _ in self?.poll() }
        poll()
    }

    func poll() {
        fetchStatus(cfg) { [weak self] st in
            DispatchQueue.main.async {
                guard let self = self else { return }
                self.failures = st == nil ? self.failures + 1 : 0
                if let st = st { self.sessionId = st.sessionId }
                let d = decide(locked: st?.locked, sessionId: st?.sessionId, releasedSession: self.releasedSession,
                               failures: self.failures, currentlyLocked: self.isLocked)
                if d.lock && !self.isLocked { self.lock() }
                if !d.lock && self.isLocked { self.unlock() }
            }
        }
    }

    // Copy/paste/undo shortcuts inside the web app (the menu bar itself stays hidden while locked).
    func installEditMenu() {
        let main = NSMenu()
        let appItem = NSMenuItem(); main.addItem(appItem); appItem.submenu = NSMenu()
        let editItem = NSMenuItem(); main.addItem(editItem)
        let edit = NSMenu(title: "Edit")
        edit.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        edit.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "Z")
        edit.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        edit.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        edit.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        edit.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editItem.submenu = edit
        NSApp.mainMenu = main
    }

    func lock() {
        isLocked = true
        NSApp.setActivationPolicy(.regular)
        buildWindows()
        NSApp.activate(ignoringOtherApps: true)
        NSApp.presentationOptions = [.hideDock, .hideMenuBar, .disableProcessSwitching, .disableForceQuit,
                                     .disableSessionTermination, .disableHideApplication, .disableAppleMenu]
        keyMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] e in
            let mods: NSEvent.ModifierFlags = [.control, .option, .command, .shift]
            if e.modifierFlags.intersection(.deviceIndependentFlagsMask).isSuperset(of: mods) && e.charactersIgnoringModifiers?.lowercased() == "u" {
                self?.showEscape()
                return nil
            }
            return e
        }
    }

    func unlock() {
        isLocked = false
        NSApp.presentationOptions = []
        if let m = keyMonitor { NSEvent.removeMonitor(m); keyMonitor = nil }
        escapeTimer?.invalidate(); escapeView?.removeFromSuperview(); escapeView = nil
        windows.forEach { $0.orderOut(nil) }
        windows.removeAll()
        web = nil
        NSApp.setActivationPolicy(.accessory)
    }

    func buildWindows() {
        windows.forEach { $0.orderOut(nil) }
        windows.removeAll()
        for (i, screen) in NSScreen.screens.enumerated() {
            let w = LockWindow(contentRect: screen.frame, styleMask: [.borderless], backing: .buffered, defer: false, screen: screen)
            w.level = NSWindow.Level(rawValue: NSWindow.Level.mainMenu.rawValue + 2)
            w.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary, .ignoresCycle]
            w.isReleasedWhenClosed = false
            w.backgroundColor = .black
            w.setFrame(screen.frame, display: true)
            if i == 0 {
                let conf = WKWebViewConfiguration()
                conf.mediaTypesRequiringUserActionForPlayback = []
                let v = WKWebView(frame: NSRect(origin: .zero, size: screen.frame.size), configuration: conf)
                v.autoresizingMask = [.width, .height]
                v.customUserAgent = nil
                v.navigationDelegate = self
                v.uiDelegate = self
                v.evaluateJavaScript("navigator.userAgent") { ua, _ in
                    v.customUserAgent = "\((ua as? String) ?? "Mozilla/5.0") EnglishFocusLock/1.0"
                    v.load(URLRequest(url: self.cfg.server.appendingPathComponent("focus")))
                }
                w.contentView = v
                web = v
            } else {
                let label = NSTextField(labelWithString: "Đang học tập trung — hãy dùng màn hình chính")
                label.textColor = .white
                label.font = .systemFont(ofSize: 22, weight: .medium)
                label.sizeToFit()
                let c = NSView(frame: NSRect(origin: .zero, size: screen.frame.size))
                label.frame.origin = NSPoint(x: (c.frame.width - label.frame.width) / 2, y: c.frame.height / 2)
                c.addSubview(label)
                w.contentView = c
            }
            w.makeKeyAndOrderFront(nil)
            w.orderFrontRegardless()
            windows.append(w)
        }
        windows.first?.makeKey()
    }

    @objc func otherAppActivated(_ n: Notification) {
        guard isLocked else { return }
        let app = n.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication
        if app?.processIdentifier != ProcessInfo.processInfo.processIdentifier {
            NSApp.activate(ignoringOtherApps: true)
            windows.forEach { $0.orderFrontRegardless() }
            windows.first?.makeKey()
        }
    }

    @objc func screensChanged() { if isLocked { buildWindows() } }

    // Only the learning app may load inside the lock window.
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        let ok = action.request.url?.host == cfg.server.host && action.request.url?.port == cfg.server.port
        decisionHandler(ok || action.request.url?.scheme == "about" || action.request.url?.scheme == "blob" ? .allow : .cancel)
    }

    func webView(_ webView: WKWebView, createWebViewWith c: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url, url.host == cfg.server.host { webView.load(URLRequest(url: url)) }
        return nil
    }

    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo,
                 type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(origin.host == cfg.server.host ? .prompt : .deny)
    }

    // MARK: offline escape (10-second confirmation inside the lock window)
    func showEscape() {
        guard escapeView == nil, let host = windows.first?.contentView else { return }
        let box = NSView(frame: NSRect(x: (host.frame.width - 520) / 2, y: (host.frame.height - 200) / 2, width: 520, height: 200))
        box.wantsLayer = true
        box.layer?.backgroundColor = NSColor.windowBackgroundColor.cgColor
        box.layer?.cornerRadius = 16
        let text = NSTextField(wrappingLabelWithString: "Mở khóa khẩn cấp (không cần máy chủ).\nNút mở khóa sẽ bật sau 10 giây. Lần mở khóa này được ghi lại.")
        text.frame = NSRect(x: 24, y: 96, width: 472, height: 80)
        let back = NSButton(title: "Quay lại học", target: self, action: #selector(cancelEscape))
        back.frame = NSRect(x: 24, y: 24, width: 200, height: 40)
        let go = NSButton(title: "Mở khóa (10)", target: self, action: #selector(confirmEscape))
        go.frame = NSRect(x: 296, y: 24, width: 200, height: 40)
        go.isEnabled = false
        [text, back, go].forEach(box.addSubview)
        host.addSubview(box)
        escapeView = box
        var left = 10
        escapeTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { t in
            left -= 1
            go.title = left > 0 ? "Mở khóa (\(left))" : "Mở khóa"
            if left <= 0 { go.isEnabled = true; t.invalidate() }
        }
    }

    @objc func cancelEscape() {
        escapeTimer?.invalidate(); escapeView?.removeFromSuperview(); escapeView = nil
    }

    @objc func confirmEscape() {
        releasedSession = sessionId
        if let s = sessionId { reportEscape(cfg, sessionId: s) }
        unlock()
    }
}

// MARK: - entry point

func selftest() -> Int32 {
    var fails = 0
    func expect(_ d: Decision, _ lock: Bool, _ name: String) { if d.lock != lock { print("FAIL \(name): \(d)"); fails += 1 } }
    expect(decide(locked: true, sessionId: "a", releasedSession: nil, failures: 0, currentlyLocked: false), true, "active locks")
    expect(decide(locked: false, sessionId: "a", releasedSession: nil, failures: 0, currentlyLocked: true), false, "finished unlocks")
    expect(decide(locked: true, sessionId: "a", releasedSession: "a", failures: 0, currentlyLocked: true), false, "escape releases")
    expect(decide(locked: true, sessionId: "b", releasedSession: "a", failures: 0, currentlyLocked: false), true, "new session locks again")
    expect(decide(locked: nil, sessionId: nil, releasedSession: nil, failures: 3, currentlyLocked: true), true, "brief outage keeps lock")
    expect(decide(locked: nil, sessionId: nil, releasedSession: nil, failures: 10, currentlyLocked: true), false, "long outage fails open")
    expect(decide(locked: nil, sessionId: nil, releasedSession: nil, failures: 1, currentlyLocked: false), false, "outage never starts a lock")
    print(fails == 0 ? "selftest OK (7 cases)" : "selftest FAILED (\(fails))")
    return fails == 0 ? 0 : 1
}

let args = CommandLine.arguments
if args.contains("--selftest") { exit(selftest()) }
if args.contains("--check") {
    let cfg = Config.load()
    let sem = DispatchSemaphore(value: 0)
    fetchStatus(cfg) { st in
        let d = decide(locked: st?.locked, sessionId: st?.sessionId, releasedSession: nil, failures: st == nil ? 10 : 0, currentlyLocked: false)
        print("server=\(cfg.server.absoluteString) reachable=\(st != nil) locked=\(st?.locked.description ?? "-") would_lock=\(d.lock) (\(d.reason))")
        sem.signal()
    }
    sem.wait()
    exit(0)
}
let app = NSApplication.shared
let controller = Controller()
app.delegate = controller
app.run()
