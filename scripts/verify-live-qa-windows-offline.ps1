# NHS OS Windows QA runner: credential-free offline acceptance
# Run from the repository root: powershell -NoProfile -File .\scripts\verify-live-qa-windows-offline.ps1
# Every external operation in the live runner is mocked. No real account, API,
# Node package installation, browser, or production endpoint is contacted.
$ErrorActionPreference = 'Stop'
$runner = Join-Path (Get-Location).Path 'scripts/run-live-qa-windows.ps1'
$config = Join-Path (Get-Location).Path 'playwright.live-qa.private.config.mjs'
if (-not (Test-Path -LiteralPath $runner) -or -not (Test-Path '.\playwright.config.mjs')) {
  throw 'Run the offline verification from the NHS OS repository root.'
}

$tokens = $null
$parseErrors = $null
[System.Management.Automation.Language.Parser]::ParseFile($runner, [ref]$tokens, [ref]$parseErrors) | Out-Null
if ($parseErrors.Count -ne 0) { throw 'Windows PowerShell parser rejected the live QA runner.' }
if (Test-Path -LiteralPath $config) { throw 'Unexpected private Playwright config already exists. Do not overwrite it.' }

$keys = @(
  'E2E_ADMIN_EMAIL', 'E2E_ADMIN_PASSWORD',
  'E2E_CLIENT_A_EMAIL', 'E2E_CLIENT_A_PASSWORD',
  'E2E_CLIENT_B_EMAIL', 'E2E_CLIENT_B_PASSWORD'
)
foreach ($key in $keys) {
  if (-not [string]::IsNullOrEmpty([Environment]::GetEnvironmentVariable($key, 'Process'))) {
    throw 'Offline QA must run without any pre-existing E2E test credentials.'
  }
}
# GitHub Actions sets CI=true in the parent process. The offline harness
# isolates and restores these process variables so cleanup assertions compare
# against an intentionally empty starting state, not runner-supplied defaults.
$endpointKeys = @('E2E_BASE_URL','NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','CI')
$inheritedEndpoints = @{}
foreach ($key in $endpointKeys) {
  $inheritedEndpoints[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
  [Environment]::SetEnvironmentVariable($key, $null, 'Process')
}
$global:NhsQaEvents = New-Object 'System.Collections.Generic.List[string]'
$global:NhsQaInstallDone = $false
$global:NhsQaForceAuthError = $false

# Functions are intentionally injected into the PowerShell command-resolution
# scope of the script under test. This is NOT a simulated shell transcript.
function global:git {
  if ($args[0] -eq 'rev-parse') { return '4835f2eac86a13d1c10330a191700beca465a9c3' }
  if ($args[0] -eq 'merge-base') { $global:LASTEXITCODE = 0; return }
  if ($args[0] -eq 'diff') { return }
  if ($args[0] -eq 'status') { return }
  throw 'Unexpected git command during offline QA.'
}
function global:npm {
  $global:NhsQaEvents.Add('npm')
  $global:LASTEXITCODE = 0
}
function global:npx {
  if ($args -contains 'install') {
    $global:NhsQaInstallDone = $true
    $global:NhsQaEvents.Add('browser-install')
  }
  elseif ($args -contains 'test') {
    if (-not $global:NhsQaInstallDone) { throw 'Playwright ran before mock browser installation.' }
    if (-not (Test-Path -LiteralPath $config)) { throw 'Private Playwright config missing before test.' }
    $privateContent = [System.IO.File]::ReadAllText($config)
    foreach ($flag in @('trace: "off"', 'screenshot: "off"', 'video: "off"')) {
      if (-not $privateContent.Contains($flag)) { throw 'Privacy capture controls missing.' }
    }
    foreach ($flag in @('--no-install', '--retries=0', '--trace=off', '--reporter=line', '--config=playwright.live-qa.private.config.mjs')) {
      if ($args -notcontains $flag) { throw 'Required Playwright command safeguard missing.' }
    }
    foreach ($key in $keys) {
      if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($key, 'Process'))) {
        throw 'QA credential missing when tests launched.'
      }
    }
    $global:NhsQaEvents.Add('browser-test')
  }
  else { throw 'Unexpected npx command during offline QA.' }
  $global:LASTEXITCODE = 0
}
function global:node {
  if ($args[0] -eq '--version') { return 'v22.0.0' }
  if ($args[0] -eq '--input-type=module') {
    $global:NhsQaEvents.Add('auth-preflight')
    $global:LASTEXITCODE = if ($global:NhsQaForceAuthError) { 1 } else { 0 }
    return
  }
  throw 'Unexpected node invocation during offline QA.'
}
function global:Read-Host {
  param([string]$Prompt, [switch]$AsSecureString)
  if (-not $global:NhsQaInstallDone) { throw 'QA credentials prompted before package/browser installation.' }
  $global:NhsQaEvents.Add('prompt')
  if ($AsSecureString) { return (ConvertTo-SecureString -String 'synthetic-not-real' -AsPlainText -Force) }
  return 'synthetic@example.invalid'
}

function Assert-RunnerCleanup {
  if (Test-Path -LiteralPath $config) { throw 'Private browser config was not cleaned up.' }
  foreach ($key in $keys) {
    if (-not [string]::IsNullOrEmpty([Environment]::GetEnvironmentVariable($key, 'Process'))) {
      throw 'QA environment variables were not cleaned up.'
    }
  }
  foreach ($key in @('E2E_BASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'CI')) {
    if (-not [string]::IsNullOrEmpty([Environment]::GetEnvironmentVariable($key, 'Process'))) {
      throw 'QA endpoint environment variables were not cleaned up.'
    }
  }
}

try {
  # Pre-set credentials must be refused BEFORE any npm/browser installation.
  $global:NhsQaEvents.Clear()
  $env:E2E_CLIENT_A_PASSWORD = 'synthetic-only'
  $guarded = $false
  try { & $runner }
  catch { $guarded = $_.Exception.Message -like '*Clear pre-set E2E_*' }
  finally { [Environment]::SetEnvironmentVariable('E2E_CLIENT_A_PASSWORD', $null, 'Process') }
  if (-not $guarded -or $global:NhsQaEvents.Count -ne 0) {
    throw 'Pre-set credential guard failed or ran external commands.'
  }
  Assert-RunnerCleanup

  # Success path: install -> browser install -> private config -> prompt -> Auth -> test -> cleanup.
  $global:NhsQaEvents.Clear()
  $global:NhsQaInstallDone = $false
  & $runner
  $events = @($global:NhsQaEvents)
  if (($events | Where-Object { $_ -eq 'npm' }).Count -ne 2) { throw 'Package installation was not mocked exactly twice.' }
  if (($events | Where-Object { $_ -eq 'prompt' }).Count -ne 6) { throw 'Disposable credentials were not collected six times.' }
  if (($events | Where-Object { $_ -eq 'auth-preflight' }).Count -ne 1) { throw 'Authentication preflight did not run.' }
  if (($events | Where-Object { $_ -eq 'browser-test' }).Count -ne 1) { throw 'Read-only browser suite did not run.' }
  if ([array]::IndexOf($events, 'browser-install') -gt [array]::IndexOf($events, 'prompt')) {
    throw 'Browser installation occurred after a credential prompt.'
  }
  Assert-RunnerCleanup

  # Failed Auth: refuse browser execution and still scrub credentials/config.
  $global:NhsQaEvents.Clear()
  $global:NhsQaInstallDone = $false
  $global:NhsQaForceAuthError = $true
  $failedClosed = $false
  try { & $runner }
  catch { $failedClosed = $_.Exception.Message -like '*QA Auth preflight failed*' }
  if (-not $failedClosed -or @($global:NhsQaEvents | Where-Object { $_ -eq 'browser-test' }).Count -ne 0) {
    throw 'Failed Auth did not block browser acceptance.'
  }
  Assert-RunnerCleanup
  # The negative Auth test intentionally sets LASTEXITCODE=1; only clear it
  # after every assertion succeeds, so the CI shell does not inherit a false
  # failure from an expected fail-closed scenario.
  $global:LASTEXITCODE = 0
  Write-Host 'PASS: Windows PowerShell parsing, pre-set credential guard, mocked success, private capture config, fail-closed Auth, and cleanup.'
}
finally {
  foreach ($key in $keys) { [Environment]::SetEnvironmentVariable($key, $null, 'Process') }
  Remove-Item Function:\git, Function:\npm, Function:\npx, Function:\node, Function:\Read-Host -ErrorAction SilentlyContinue
  Remove-Variable NhsQaEvents, NhsQaInstallDone, NhsQaForceAuthError -Scope Global -ErrorAction SilentlyContinue
  foreach ($key in $endpointKeys) {
    [Environment]::SetEnvironmentVariable($key, $inheritedEndpoints[$key], 'Process')
  }
}
