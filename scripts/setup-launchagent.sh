#!/usr/bin/env bash
# Setup LaunchAgent for auto-starting rowbound watch on login.
#
# Usage:
#   bash scripts/setup-launchagent.sh YOUR_SHEET_ID
#
# This will:
# 1. Find the rowbound binary
# 2. Create a LaunchAgent plist in ~/Library/LaunchAgents/
# 3. Load it with launchctl

set -euo pipefail

SHEET_ID="${1:-}"
LABEL="com.clay.rowbound-watch"
PLIST_NAME="${LABEL}.plist"
PLIST_DIR="$HOME/Library/LaunchAgents"
PLIST_PATH="${PLIST_DIR}/${PLIST_NAME}"
TEMPLATE_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMPLATE="${TEMPLATE_DIR}/${PLIST_NAME}"

if [ -z "$SHEET_ID" ]; then
  echo "Usage: bash scripts/setup-launchagent.sh YOUR_SHEET_ID"
  echo ""
  echo "  YOUR_SHEET_ID: The Google Sheet spreadsheet ID"
  echo "                 (from the URL: docs.google.com/spreadsheets/d/THIS_PART/)"
  exit 1
fi

# Find rowbound binary
ROWBOUND_BIN=$(which rowbound 2>/dev/null || echo "")
if [ -z "$ROWBOUND_BIN" ]; then
  # Try npx path
  ROWBOUND_BIN=$(npm root -g 2>/dev/null)/rowbound/dist/cli/index.js
  if [ ! -f "$ROWBOUND_BIN" ]; then
    echo "Error: rowbound not found. Install it with: npm install -g rowbound"
    exit 1
  fi
  # Use node to run it
  ROWBOUND_BIN="$(which node) $ROWBOUND_BIN"
fi

echo "Setting up LaunchAgent for rowbound watch..."
echo "  Sheet ID: $SHEET_ID"
echo "  Binary:   $ROWBOUND_BIN"
echo "  Plist:    $PLIST_PATH"

# Unload existing if present
if launchctl list | grep -q "$LABEL" 2>/dev/null; then
  echo "Unloading existing LaunchAgent..."
  launchctl unload "$PLIST_PATH" 2>/dev/null || true
fi

# Create plist from template
mkdir -p "$PLIST_DIR"
sed -e "s|SHEET_ID|${SHEET_ID}|g" \
    -e "s|ROWBOUND_BIN|${ROWBOUND_BIN}|g" \
    "$TEMPLATE" > "$PLIST_PATH"

# Load
launchctl load "$PLIST_PATH"

# Verify
sleep 1
if launchctl list | grep -q "$LABEL"; then
  echo ""
  echo "✓ LaunchAgent loaded successfully!"
  echo "  Rowbound watch will auto-start on login."
  echo ""
  echo "  Logs: /tmp/rowbound-watch.log"
  echo "  Errors: /tmp/rowbound-watch-error.log"
  echo ""
  echo "  To stop:   launchctl unload $PLIST_PATH"
  echo "  To restart: launchctl unload $PLIST_PATH && launchctl load $PLIST_PATH"
else
  echo ""
  echo "Warning: LaunchAgent may not have loaded correctly."
  echo "Check: launchctl list | grep rowbound"
fi
