# ============================================
# Xiuixian - GitHub Pages deploy script (api.github.com only, no github.com needed)
# Usage: powershell -ExecutionPolicy Bypass -File scripts\deploy-github-pages.ps1 [-Pat <token>] [-DistDir dist/client]
# Token can also be provided via GITHUB_PAT env var.
# ============================================
param(
  [string]$Pat,
  [string]$DistDir = "dist/client",
  [string]$Repo = "mazhenzhou1996/xiuixian-app",
  [string]$Branch = "gh-pages"
)

if (-not $Pat) { $Pat = $env:GITHUB_PAT }
if (-not $Pat) { throw "No token. Pass -Pat or set GITHUB_PAT env var." }

$ErrorActionPreference = "Stop"
$headers = @{
  "User-Agent"    = "autoclaw-deploy"
  "Authorization" = "Bearer $Pat"
  "Accept"        = "application/vnd.github+json"
}
$api = "https://api.github.com/repos/$Repo"

if (-not (Test-Path $DistDir)) { throw "dist dir not found: $DistDir" }

Write-Host "==> [1/5] Collecting files..."
$files = Get-ChildItem $DistDir -Recurse -File
Write-Host "    Total files: $($files.Count)"
$rootLen = (Resolve-Path $DistDir).Path.Length + 1

Write-Host "==> [2/5] Uploading blobs..."
$tree = @()
foreach ($f in $files) {
  $rel = $f.FullName.Substring($rootLen) -replace '\\', '/'
  $b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($f.FullName))
  $blob = Invoke-RestMethod -Uri "$api/git/blobs" -Method Post -Headers $headers -Body (@{ content = $b64; encoding = "base64" } | ConvertTo-Json)
  $tree += @{ path = $rel; mode = "100644"; type = "blob"; sha = $blob.sha }
  Write-Host "    blob: $rel ($([math]::Round($f.Length/1024,1)) KB)"
}

Write-Host "==> [3/5] Creating tree + commit..."
$treeObj = Invoke-RestMethod -Uri "$api/git/trees" -Method Post -Headers $headers -Body (@{ tree = $tree } | ConvertTo-Json -Depth 5)
$parentSha = $null
try {
  $ref = Invoke-RestMethod -Uri "$api/git/ref/heads/$Branch" -Headers $headers -TimeoutSec 15
  $parentSha = $ref.object.sha
} catch { $parentSha = $null }

$commitBody = @{
  message = "deploy: xiuixian production build $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
  tree    = $treeObj.sha
}
if ($parentSha) { $commitBody.parents = @($parentSha) }
$commit = Invoke-RestMethod -Uri "$api/git/commits" -Method Post -Headers $headers -Body ($commitBody | ConvertTo-Json -Depth 3)

Write-Host "==> [4/5] Updating branch $Branch ..."
if ($parentSha) {
  Invoke-RestMethod -Uri "$api/git/refs/heads/$Branch" -Method Patch -Headers $headers -Body (@{ sha = $commit.sha; force = $true } | ConvertTo-Json) | Out-Null
} else {
  Invoke-RestMethod -Uri "$api/git/refs" -Method Post -Headers $headers -Body (@{ ref = "refs/heads/$Branch"; sha = $commit.sha } | ConvertTo-Json) | Out-Null
}

Write-Host "==> [5/5] Enabling GitHub Pages (source=$Branch) ..."
$pagesBody = @{ source = @{ branch = $Branch; path = "/" } }
try {
  Invoke-RestMethod -Uri "$api/pages" -Method Post -Headers $headers -Body ($pagesBody | ConvertTo-Json -Depth 3) | Out-Null
} catch {
  Invoke-RestMethod -Uri "$api/pages" -Method Put -Headers $headers -Body ($pagesBody | ConvertTo-Json -Depth 3) | Out-Null
}

Write-Host ""
Write-Host "Deploy done! Site: https://mazhenzhou1996.github.io/xiuixian-app/"
Write-Host "First Pages build may take 1-3 minutes."
