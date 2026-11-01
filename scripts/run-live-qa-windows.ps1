# NHS OS live QA on Windows (local, read-only)
# Run from the repository root in PowerShell: .\scripts\run-live-qa-windows.ps1
# Uses only dedicated disposable QA identities. Does NOT bypass Cloudflare,
# disable security, deploy, migrate, scan leads, or write customer records.
$ErrorActionPreference = 'Stop'
$expected = 'cf58845a61f4eb6c0d46e67cd10fefbd0e0a54bd'
if (-not (Test-Path '.\playwright.config.mjs')) { throw 'Run this script from the NHS OS repository root.' }
$head = (git rev-parse HEAD).Trim()
# This source-only branch adds this runner to the exact reviewed main snapshot.
git merge-base --is-ancestor $expected HEAD
if ($LASTEXITCODE -ne 0) { throw "Checkout $head does not descend from reviewed release $expected." }
$changed = @(git diff --name-only $expected HEAD)
if (@($changed | Where-Object { $_ -ne 'scripts/run-live-qa-windows.ps1' }).Count -gt 0) {
  throw 'Checkout differs from reviewed release in application or test files. Do not run live QA.'
}
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
  # Stop before installing browsers or running 18 tests when a disposable QA
  # identity cannot authenticate. This signs in via the publishable Auth API only.
  # Never print account identifiers, passwords, tokens, or raw provider errors.
  Write-Host 'Checking disposable Admin, Client A and Client B Auth credentials...'
  $authPreflight = @'
import { createClient } from '@supabase/supabase-js';

const required = [
  ['Admin', 'E2E_ADMIN_EMAIL', 'E2E_ADMIN_PASSWORD'],
  ['Client A', 'E2E_CLIENT_A_EMAIL', 'E2E_CLIENT_A_PASSWORD'],
  ['Client B', 'E2E_CLIENT_B_EMAIL', 'E2E_CLIENT_B_PASSWORD'],
];

let failed = false;
for (const [label, emailKey, passwordKey] of required) {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: process.env[emailKey],
      password: process.env[passwordKey],
    });
    if (error || !data?.user?.id || !data?.session?.access_token) {
      failed = true;
      console.error('[QA preflight] ' + label + ': authentication failed; verify the disposable QA credentials privately.');
      continue;
    }
    console.log('[QA preflight] ' + label + ': authentication passed.');
  } catch {
    failed = true;
    console.error('[QA preflight] ' + label + ': Auth request failed; check service availability and disposable QA credentials.');
  }
}
if (failed) process.exitCode = 1;
'@
  $authPreflight | node --input-type=module
  if ($LASTEXITCODE -ne 0) {
    throw 'QA Auth preflight failed. Fix the dedicated test credentials or Auth availability before running browser acceptance. Do not reset accounts or deploy as a workaround.'
  }
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
