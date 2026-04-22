# Install Mythos as a Codex skill at $env:USERPROFILE\.codex\skills\mythos\.
$ErrorActionPreference = 'Stop'
$codexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }
$target = Join-Path $codexHome 'skills\mythos'
New-Item -ItemType Directory -Force -Path $target | Out-Null
Invoke-WebRequest -UseBasicParsing `
    -Uri 'https://raw.githubusercontent.com/inchwormz/mythos-skill/main/skills/codex/SKILL.md' `
    -OutFile (Join-Path $target 'SKILL.md')
Write-Host "Codex skill installed at: $target"
Write-Host 'Next: ensure mythos-skill CLI is on PATH:'
Write-Host '  cargo install mythos-skill'
Write-Host '  npm install -g github:inchwormz/mythos-skill'
