# ClashAI iOS

Native wrapper around the web game. Runs offline from `ios/ClashAI/Web`, which `tools/build.js` regenerates on every build.

## Install on iPhone (free Apple ID)

1. Xcode > Settings > Accounts: add your Apple ID.
2. Open `ios/ClashAI.xcodeproj`.
3. Select the ClashAI target > Signing & Capabilities: pick your Personal Team. If the bundle id `com.owenjames.clashai` is taken, change it.
4. On the iPhone: Settings > Privacy & Security > Developer Mode, turn on and restart.
5. Plug in the iPhone, or pair it over Wi-Fi in Xcode > Window > Devices and Simulators.
6. Select the iPhone as the run destination and press Run.
7. On first launch, trust the developer: Settings > General > VPN & Device Management > your Apple ID > Trust.

Free provisioning expires after 7 days. Press Run in Xcode again to renew.

## Build from the terminal

```bash
cd ios && xcodegen generate
xcodebuild -project ClashAI.xcodeproj -scheme ClashAI -sdk iphonesimulator -configuration Debug -destination 'generic/platform=iOS Simulator' build CODE_SIGNING_ALLOWED=NO
```

Edit `ios/project.yml` and rerun `xcodegen generate` when targets, files or settings change.
