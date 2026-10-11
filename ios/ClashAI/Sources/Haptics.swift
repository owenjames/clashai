import UIKit

// Maps the web game's haptic messages onto UIKit feedback. Unknown kinds are ignored.
enum Haptics {
    static func play(_ kind: String) {
        switch kind {
        case "light": impact(.light)
        case "medium": impact(.medium)
        case "heavy": impact(.heavy)
        case "success": notify(.success)
        case "error": notify(.error)
        default: break
        }
    }

    private static func impact(_ style: UIImpactFeedbackGenerator.FeedbackStyle) {
        UIImpactFeedbackGenerator(style: style).impactOccurred()
    }

    private static func notify(_ type: UINotificationFeedbackGenerator.FeedbackType) {
        UINotificationFeedbackGenerator().notificationOccurred(type)
    }
}
