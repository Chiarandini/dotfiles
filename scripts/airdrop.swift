import Cocoa

final class ShareDelegate: NSObject, NSSharingServiceDelegate {
    func sharingService(_ sharingService: NSSharingService, didShareItems items: [Any]) {
        NSApp.terminate(nil)
    }

    func sharingService(
        _ sharingService: NSSharingService,
        didFailToShareItems items: [Any],
        error: Error
    ) {
        NSApp.terminate(nil)
    }
}

let paths = Array(CommandLine.arguments.dropFirst())
guard !paths.isEmpty else {
    FileHandle.standardError.write("Usage: airdrop FILE [FILE ...]\n".data(using: .utf8)!)
    exit(1)
}

let urls = paths.map { URL(fileURLWithPath: $0) }

guard let svc = NSSharingService(named: .sendViaAirDrop) else {
    FileHandle.standardError.write("AirDrop sharing service unavailable\n".data(using: .utf8)!)
    exit(1)
}

// Running as a proper accessory NSApplication so AppKit owns the UI lifecycle.
// Without this, the share picker's window/view hierarchy is orphaned and gets
// torn down prematurely when the user clicks a recipient.
let app = NSApplication.shared
app.setActivationPolicy(.accessory)

let delegate = ShareDelegate()
svc.delegate = delegate

// Safety timeout: terminate 10 minutes in regardless of delegate state.
DispatchQueue.main.asyncAfter(deadline: .now() + 600) {
    NSApp.terminate(nil)
}

// Kick off the share on the next main-loop tick, after app.run() is pumping.
DispatchQueue.main.async {
    svc.perform(withItems: urls)
}

app.run()
