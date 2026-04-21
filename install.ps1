# mythos-skill one-shot installer for Windows PowerShell.
# Installs the Rust compiler binary from crates.io and the Node runtime
# directly from the GitHub repo, then runs readiness.
$ErrorActionPreference = 'Stop'

function Require-Cmd($name, $hint) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        Write-Host "mythos-skill: missing required tool: $name" -ForegroundColor Red
        Write-Host "             install it from $hint, then re-run this script." -ForegroundColor Red
        exit 1
    }
}

Require-Cmd 'cargo' 'https://rustup.rs'
Require-Cmd 'node'  'https://nodejs.org'
Require-Cmd 'npm'   'comes with Node'

Write-Host 'mythos-skill: 1/3 installing Rust compiler (cargo install mythos-skill)...'
cargo install --quiet mythos-skill

Write-Host 'mythos-skill: 2/3 installing Node runtime from GitHub...'
npm install -g --silent github:inchwormz/mythos-skill

Write-Host 'mythos-skill: 3/3 running readiness...'
mythos-skill ready

Write-Host ''
Write-Host 'mythos-skill: ready. Try:'
Write-Host '  mythos-skill init my-run'
Write-Host '  mythos-skill compile --run-dir my-run'
