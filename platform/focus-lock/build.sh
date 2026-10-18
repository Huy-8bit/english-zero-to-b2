#!/usr/bin/env bash
# Build English Focus Lock.app into ./build (ad-hoc signed; no Apple developer account needed).
set -euo pipefail
cd "$(dirname "$0")"
APP=build/EnglishFocusLock.app
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS"
xcrun swiftc -O -swift-version 5 -o "$APP/Contents/MacOS/EnglishFocusLock" FocusLock.swift -framework AppKit -framework WebKit
cp Info.plist "$APP/Contents/Info.plist"
codesign --force --sign - "$APP" >/dev/null
"$APP/Contents/MacOS/EnglishFocusLock" --selftest
echo "Built $APP"
