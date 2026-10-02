# Ensures a Node.js runtime for 扫片 (Windows portable launcher).
# Order: bundled runtime → PATH → LocalAppData cache → download from nodejs.org + SHA256.

param(
  [Parameter(Mandatory = $true)][string]$BundleNode,
  [Parameter(Mandatory = $true)][string]$CacheNode,
  [Parameter(Mandatory = $true)][string]$CacheRoot,
  [Parameter(Mandatory = $true)][string]$NodeVersion,
  [Parameter(Mandatory = $true)][int]$NodeMajorMin,
  [Parameter(Mandatory = $true)][string]$Archive,
  [Parameter(Mandatory = $true)][string]$NodeUrl,
  [Parameter(Mandatory = $true)][string]$ShasumUrl
)

$ErrorActionPreference = "Stop"

function Test-NodeOk([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return $false }
  try {
    $major = & $Path -p "process.versions.node.split('.')[0]" 2>$null
    if (-not $major) { return $false }
    return ([int]$major -ge $NodeMajorMin)
  } catch {
    return $false
  }
}

if (Test-NodeOk $BundleNode) {
  Write-Output $BundleNode
  exit 0
}

$paths = @()
try {
  $paths = @(Get-Command node -ErrorAction SilentlyContinue | ForEach-Object { $_.Source })
} catch {}
foreach ($candidate in $paths) {
  if (Test-NodeOk $candidate) {
    Write-Output $candidate
    exit 0
  }
}

if (Test-NodeOk $CacheNode) {
  Write-Output $CacheNode
  exit 0
}

Write-Host "未检测到可用的 Node（需要 $NodeMajorMin+）。"
Write-Host "正在从 nodejs.org 下载运行时（约 30–50MB，仅首次）…"

New-Item -ItemType Directory -Force -Path $CacheRoot | Out-Null
$tmp = Join-Path $env:TEMP ("saopian-node-" + [guid]::NewGuid().ToString())
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
try {
  $zip = Join-Path $tmp $Archive
  Invoke-WebRequest -Uri $NodeUrl -OutFile $zip
  $sums = Invoke-WebRequest -Uri $ShasumUrl
  $line = ($sums.Content -split "`n" | Where-Object { $_ -match [regex]::Escape($Archive) } | Select-Object -First 1)
  if (-not $line) { throw "无法在 SHASUMS256.txt 中找到 $Archive" }
  $expected = ($line -split "\s+")[0].Trim().ToLowerInvariant()
  $actual = (Get-FileHash -Algorithm SHA256 -Path $zip).Hash.ToLowerInvariant()
  if ($expected -ne $actual) { throw "校验失败（checksum mismatch）" }
  Expand-Archive -LiteralPath $zip -DestinationPath $CacheRoot -Force
} finally {
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}

if (-not (Test-NodeOk $CacheNode)) {
  throw "运行时安装后仍不可用：$CacheNode"
}

Write-Host "运行时已就绪。"
Write-Output $CacheNode
