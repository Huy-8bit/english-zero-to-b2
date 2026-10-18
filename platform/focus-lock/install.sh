#!/usr/bin/env bash
# Install English Focus Lock for the current user: app in ~/Applications, config, LaunchAgent (starts at login).
# Usage: ./install.sh [server-url] [access-token]   (default server http://127.0.0.1:8080 = Docker Compose)
set -euo pipefail
cd "$(dirname "$0")"
SERVER="${1:-http://127.0.0.1:8080}"
TOKEN="${2:-}"
./build.sh
mkdir -p "$HOME/Applications" "$HOME/.english-focus-lock" "$HOME/Library/LaunchAgents"
rm -rf "$HOME/Applications/EnglishFocusLock.app"
cp -R build/EnglishFocusLock.app "$HOME/Applications/"
python3 -c 'import json,sys; json.dump({"server": sys.argv[1], "token": sys.argv[2]}, open(sys.argv[3], "w"))' "$SERVER" "$TOKEN" "$HOME/.english-focus-lock/config.json"
chmod 600 "$HOME/.english-focus-lock/config.json"
PLIST="$HOME/Library/LaunchAgents/com.englishmastery.focuslock.plist"
cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.englishmastery.focuslock</string>
  <key>ProgramArguments</key><array><string>$HOME/Applications/EnglishFocusLock.app/Contents/MacOS/EnglishFocusLock</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ProcessType</key><string>Interactive</string>
  <key>StandardErrorPath</key><string>$HOME/.english-focus-lock/agent.log</string>
</dict></plist>
PL
launchctl bootout "gui/$(id -u)/com.englishmastery.focuslock" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
"$HOME/Applications/EnglishFocusLock.app/Contents/MacOS/EnglishFocusLock" --check
echo "Installed. Start a session at $SERVER/focus. Uninstall: $(pwd)/uninstall.sh"
