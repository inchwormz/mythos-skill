#!/usr/bin/env sh
# mythos-skill one-shot installer for macOS / Linux.
# Installs the Rust compiler binary from crates.io and the Node runtime
# directly from the GitHub repo, then runs readiness.
set -eu

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'mythos-skill: missing required tool: %s\n' "$1" >&2
    printf '             install it from %s, then re-run this script.\n' "$2" >&2
    exit 1
  fi
}

need cargo "https://rustup.rs"
need node  "https://nodejs.org"
need npm   "comes with Node"

printf 'mythos-skill: 1/3 installing Rust compiler (cargo install mythos-skill)...\n'
cargo install --quiet mythos-skill

printf 'mythos-skill: 2/3 installing Node runtime from GitHub...\n'
npm install -g --silent github:inchwormz/mythos-skill

printf 'mythos-skill: 3/3 running readiness...\n'
mythos-skill ready

printf '\nmythos-skill: ready. Try:\n  mythos-skill init my-run\n  mythos-skill compile --run-dir my-run\n'
