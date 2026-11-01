#!/bin/sh
# Start the Kavach hub:  ./start-linux.sh   (needs Node.js 18 or newer)
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Kavach needs Node.js 18 or newer. Install it from https://nodejs.org (or your package manager), then run this again."
  exit 1
fi
if ! node -e "process.exit(+process.versions.node.split('.')[0]>=18?0:1)"; then
  echo "Node.js $(node -v) is too old. Kavach needs 18 or newer."
  exit 1
fi
exec node hub.mjs --open
