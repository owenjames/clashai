import SwiftUI

@main
struct ClashAIApp: App {
    var body: some Scene {
        WindowGroup {
            GameView()
                .ignoresSafeArea()
                .background(Color(GameView.background))
                .statusBarHidden(true)
        }
    }
}
