#!/usr/bin/env bash
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"
echo "StudyBuddy — Starting..."
make dev &
sleep 5
xdg-open "http://localhost:3000" 2>/dev/null || open "http://localhost:3000"
wait
