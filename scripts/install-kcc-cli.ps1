# install-kcc-cli.ps1 — Windows (PowerShell)
# Uso:
#   irm https://raw.githubusercontent.com/navywakura/knightscomputerclub/main/scripts/install-kcc-cli.ps1 | iex
#   $env:VER="1.3.1"; .\install-kcc-cli.ps1

$ErrorActionPreference = "Stop"
$RepoOwner = "navywakura"
$RepoName = "knightscomputerclub"
$GhRel = "https://github.com/$RepoOwner/$RepoName/releases"

function Die($msg) { Write-Error $msg; exit 1 }

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Die "necesitás Node.js ≥ 18 — https://nodejs.org"
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Die "necesitás npm (viene con Node)"
}

$nodeMajor = [int](node -p "process.versions.node.split('.')[0]")
if ($nodeMajor -lt 18) {
  Die "Node $nodeMajor es viejo. Instalá Node ≥ 18"
}

$Ver = $env:VER
if (-not $Ver) {
  Write-Host "→ detectando último release…"
  try {
    $rel = Invoke-RestMethod -Uri "https://api.github.com/repos/$RepoOwner/$RepoName/releases/latest"
    $Ver = $rel.tag_name.TrimStart("v")
  } catch {
    Die "no pude leer releases. Pasá `$env:VER='1.3.1' a mano"
  }
}
$Ver = $Ver.TrimStart("v")
if ($Ver -notmatch '^\d+\.\d+\.\d+$') {
  Die "versión rara: $Ver"
}

$Tgz = "kcc-cli-$Ver.tgz"
$Url = "$GhRel/download/v$Ver/$Tgz"
$Out = Join-Path $env:TEMP $Tgz

Write-Host "→ versión: $Ver"
Write-Host "→ bajando: $Url"
try {
  Invoke-WebRequest -Uri $Url -OutFile $Out -UseBasicParsing
} catch {
  Die "no se pudo bajar (¿existe v$Ver?). $Url"
}

if (-not (Test-Path $Out) -or (Get-Item $Out).Length -lt 100) {
  Die "archivo vacío o ausente: $Out"
}

Write-Host "→ npm i -g $Out"
npm i -g $Out
if ($LASTEXITCODE -ne 0) { Die "npm install falló" }

Write-Host ""
Write-Host "✓ instalado. Comando: kcc-cli"
Write-Host "  kcc-cli --version"
Write-Host "  kcc-cli login <usuario> <pass>"
Write-Host ""
Write-Host "Si no encuentra el comando, agregá el npm global al PATH:"
Write-Host "  npm config get prefix"
Write-Host "  (…)\bin debe estar en PATH de usuario"
