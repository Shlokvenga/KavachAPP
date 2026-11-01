#!/bin/bash
# Double-click to start the Kavach hub. First time: right-click > Open (macOS asks once).
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  for p in /opt/homebrew/bin /usr/local/bin; do [ -x "$p/node" ] && export PATH="$p:$PATH"; done
fi
if ! command -v node >/dev/null 2>&1; then
  echo
  echo "  Kavach needs Node.js (version 18 or newer) on this Mac."
  echo "  The download page will open now. Install the LTS version, then double-click this file again."
  echo
  open "https://nodejs.org/en/download"
  read -r -p "Press Enter to close"
  exit 1
fi
if ! node -e "process.exit(+process.versions.node.split('.')[0]>=18?0:1)"; then
  echo "  Node.js $(node -v) is too old. Kavach needs 18 or newer."
  open "https://nodejs.org/en/download"
  read -r -p "Press Enter to close"
  exit 1
fi
node hub.mjs --open
read -r -p "The Kavach hub has stopped. Press Enter to close"
