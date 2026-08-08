export const windowsReparseScript = String.raw`
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2

$json = [Environment]::GetEnvironmentVariable(
  'FRICTION_WINDOWS_PATH_COMPONENTS',
  'Process'
)

if ([String]::IsNullOrWhiteSpace($json)) {
  throw 'missing-input'
}

$decoded = $json | ConvertFrom-Json
$components = @()
foreach ($component in $decoded) {
  $components += [string]$component
}
$results = @()

foreach ($component in $components) {
  try {
    $item = Get-Item -LiteralPath $component -Force
    $attributes = [IO.FileAttributes]$item.Attributes
    $reparse = ($attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0
    $kind = if ($item.PSIsContainer) {
      'directory'
    } elseif (($attributes -band [IO.FileAttributes]::Directory) -eq 0) {
      'file'
    } else {
      'other'
    }
    $results += [ordered]@{
      exists = $true
      kind = $kind
      reparsePoint = [bool]$reparse
    }
  } catch {
    if ($_.CategoryInfo.Category -ne [Management.Automation.ErrorCategory]::ObjectNotFound) {
      throw
    }

    $results += [ordered]@{
      exists = $false
      kind = 'missing'
      reparsePoint = $false
    }
  }
}

[ordered]@{ items = @($results) } | ConvertTo-Json -Compress -Depth 3
`;
