#!/usr/bin/env sh
# Install Mythos as a Codex skill at ~/.codex/skills/mythos/.
set -eu
TARGET="${CODEX_HOME:-$HOME/.codex}/skills/mythos"
mkdir -p "$TARGET"
curl -fsSL https://raw.githubusercontent.com/inchwormz/mythos-skill/main/skills/codex/SKILL.md -o "$TARGET/SKILL.md"
printf 'Codex skill installed at: %s\n' "$TARGET"
printf 'Next: ensure `mythos-skill` CLI is on PATH:\n'
printf '  cargo install mythos-skill\n'
printf '  npm install -g github:inchwormz/mythos-skill\n'
