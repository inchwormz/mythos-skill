#!/usr/bin/env sh
# Install Mythos as a Claude Code skill at ~/.claude/skills/mythos/.
set -eu
TARGET="${CLAUDE_HOME:-$HOME/.claude}/skills/mythos"
mkdir -p "$TARGET"
curl -fsSL https://raw.githubusercontent.com/inchwormz/mythos-skill/main/skills/claude/SKILL.md -o "$TARGET/SKILL.md"
printf 'Claude Code skill installed at: %s\n' "$TARGET"
printf 'Next: ensure `mythos-skill` CLI is on PATH:\n'
printf '  cargo install mythos-skill\n'
printf '  npm install -g github:inchwormz/mythos-skill\n'
