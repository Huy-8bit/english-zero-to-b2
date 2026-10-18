#!/usr/bin/env bash
# Remove English Focus Lock (also an emergency way out from another terminal / SSH session).
set -uo pipefail
launchctl bootout "gui/$(id -u)/com.englishmastery.focuslock" 2>/dev/null
pkill -f EnglishFocusLock.app/Contents/MacOS/EnglishFocusLock 2>/dev/null
rm -f "$HOME/Library/LaunchAgents/com.englishmastery.focuslock.plist"
rm -rf "$HOME/Applications/EnglishFocusLock.app"
echo "English Focus Lock removed (config kept in ~/.english-focus-lock)."
