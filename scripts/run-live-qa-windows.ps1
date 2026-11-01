# NHS OS live QA on Windows (local, read-only)
# Run from the repository root in PowerShell: .\scripts\run-live-qa-windows.ps1
# Uses only dedicated disposable QA identities. Does NOT bypass Cloudflare,
# disable security, deploy, migrate, scan leads, or write customer records.
$ErrorActionPreference = 'Stop'
$expected = 'cf58845a61f4eb6c0d46e67cd10fefbd0e0a54bd'
if (-not (Test-Path '.\playwright.config.mjs')) { throw 'Run this script from the NHS OS repository root.' }
$head = (git rev-parse HEAD).Trim()
if ($head -ne $expected) { throw "Unreviewed checkout $head. Required live release QA commit: $expected. Do not reset or change branches automatically." }
if ((git status --porcelain).Length -gt 0) { throw 'Working tree must be clean. This prevents accidental QA against modified source.' }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Install Node.js 22 first.' }
$major = [int]((node --version).TrimStart('v').Split('.')[0])
if ($major -ne 22) { throw "Use Node.js 22 for parity with CI. Found Node major $major." }

function Read-Secret([string]$name) {
  $secure = Read-Host -Prompt "Enter disposable QA $name" -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

$keys = @('E2E_ADMIN_EMAIL','E2E_ADMIN_PASSWORD','E2E_CLIENT_A_EMAIL','E2E_CLIENT_A_PASSWORD','E2E_CLIENT_B_EMAIL','E2E_CLIENT_B_PASSWORD')
try {
  foreach ($key in $keys) {
    if (-not [Environment]::GetEnvironmentVariable($key, 'Process')) {
      $value = if ($key.EndsWith('_PASSWORD')) { Read-Secret $key } else { Read-Host -Prompt "Enter disposable QA $key" }
      if ([string]::IsNullOrWhiteSpace($value)) { throw "Missing required QA identity: $key" }
      [Environment]::SetEnvironmentVariable($key, $value, 'Process')
      $value = $null
    }
  }
  $env:E2E_BASE_URL = 'https://app.ninthheartstudios.com'
  $env:NEXT_PUBLIC_SUPABASE_URL = 'https://rquscwgdrqkzwjukiqtk.supabase.co'
  $env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_7N1_IhU0_mvs6q0ppgyssA_0O6xj-L2'
  $env:CI = 'true'
  Write-Host 'Installing locked dependencies and isolated Playwright runner (no deployment)...'
  npm ci; if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }
  npm install --no-save --package-lock=false '@playwright/test@1.56.1'
  if ($LASTEXITCODE -ne 0) { throw 'Playwright install failed' }
  npx playwright install chromium
  if ($LASTEXITCODE -ne 0) { throw 'Chromium install failed' }
  Write-Host 'Testing live public pages, admin, both clients, and direct API isolation (read-only).'
  npx playwright test tests/e2e/navigation.spec.mjs tests/e2e/phase3-access.spec.mjs --retries=0
  if ($LASTEXITCODE -ne 0) { throw 'Live acceptance failed. Review test-results/ and playwright-report/. Do not deploy.' }
  Write-Host 'Live local QA passed. This does not authorize a production deployment.'
}
finally {
  foreach ($key in $keys) { [Environment]::SetEnvironmentVariable($key, $null, 'Process') }
  foreach ($key in @('E2E_BASE_URL','NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','CI')) {
    [Environment]::SetEnvironmentVariable($key, $null, 'Process')
  }
}
