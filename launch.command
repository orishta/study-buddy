#!/usr/bin/env bash
# StudyBuddy launcher — double-click this file in Finder to start the app.
#
# First time on macOS:
#   Right-click → Open → click "Open" in the dialog (Gatekeeper approval).
#   After that, just double-click normally.

set -e

# Always run from the directory that contains this script
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "========================================"
echo "  StudyBuddy — starting up"
echo "========================================"
echo ""
echo "Backend → http://localhost:8000"
echo "App     → http://localhost:3000"
echo ""
echo "Press Ctrl-C to stop everything."
echo ""

# Start both servers in the background
make dev &
MAKE_PID=$!

# Wait for Next.js to be ready, then open the browser
sleep 6
open "http://localhost:3000" 2>/dev/null || true

# Stay alive until the user hits Ctrl-C
wait $MAKE_PID
