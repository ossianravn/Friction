export const windowsAclScript = String.raw`
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2

$target = [Environment]::GetEnvironmentVariable('FRICTION_WINDOWS_ACL_TARGET', 'Process')
$action = [Environment]::GetEnvironmentVariable('FRICTION_WINDOWS_ACL_ACTION', 'Process')

if ([String]::IsNullOrWhiteSpace($target) -or [String]::IsNullOrWhiteSpace($action)) {
  throw 'missing-input'
}

$current = [Security.Principal.WindowsIdentity]::GetCurrent().User
$system = [Security.Principal.SecurityIdentifier]::new('S-1-5-18')
$fullControl = [Security.AccessControl.FileSystemRights]::FullControl
$allow = [Security.AccessControl.AccessControlType]::Allow
$none = [Security.AccessControl.PropagationFlags]::None

function Add-PrivateRule($security, $identity, $inheritance) {
  $rule = [Security.AccessControl.FileSystemAccessRule]::new(
    $identity,
    $fullControl,
    $inheritance,
    $none,
    $allow
  )
  [void]$security.AddAccessRule($rule)
}

if ($action -eq 'secure-directory') {
  if (-not (Test-Path -LiteralPath $target -PathType Container)) {
    throw 'wrong-kind'
  }

  $security = [Security.AccessControl.DirectorySecurity]::new()
  $security.SetOwner($current)
  $security.SetAccessRuleProtection($true, $false)
  $inheritance = [Security.AccessControl.InheritanceFlags]::ContainerInherit -bor
    [Security.AccessControl.InheritanceFlags]::ObjectInherit
  Add-PrivateRule $security $current $inheritance
  Add-PrivateRule $security $system $inheritance
  Set-Acl -LiteralPath $target -AclObject $security
  $action = 'verify-directory'
}

$directory = $action -eq 'verify-directory'
$file = $action -eq 'verify-file'

if (-not $directory -and -not $file) {
  throw 'invalid-action'
}

if ($directory -and -not (Test-Path -LiteralPath $target -PathType Container)) {
  throw 'wrong-kind'
}

if ($file -and -not (Test-Path -LiteralPath $target -PathType Leaf)) {
  throw 'wrong-kind'
}

$acl = Get-Acl -LiteralPath $target
$owner = $acl.GetOwner([Security.Principal.SecurityIdentifier])
$ownerMatches = $owner.Value -eq $current.Value
$inheritanceProtected = $acl.AreAccessRulesProtected
$rules = $acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])
$expectedInheritance = if ($directory) {
  [Security.AccessControl.InheritanceFlags]::ContainerInherit -bor
    [Security.AccessControl.InheritanceFlags]::ObjectInherit
} else {
  [Security.AccessControl.InheritanceFlags]::None
}
$seenCurrent = $false
$seenSystem = $false
$unexpected = 0

foreach ($rule in $rules) {
  $identityExpected = $rule.IdentityReference.Value -eq $current.Value -or
    $rule.IdentityReference.Value -eq $system.Value
  $rightsExpected = $rule.FileSystemRights -eq $fullControl
  $inheritanceExpected = $rule.InheritanceFlags -eq $expectedInheritance
  $ruleExpected = $identityExpected -and
    $rule.AccessControlType -eq $allow -and
    $rightsExpected -and
    $inheritanceExpected -and
    $rule.PropagationFlags -eq $none

  if (-not $ruleExpected) {
    $unexpected += 1
    continue
  }

  if ($rule.IdentityReference.Value -eq $current.Value) { $seenCurrent = $true }
  if ($rule.IdentityReference.Value -eq $system.Value) { $seenSystem = $true }
}

$missing = 0
if (-not $seenCurrent) { $missing += 1 }
if (-not $seenSystem) { $missing += 1 }
$ok = $ownerMatches -and $unexpected -eq 0 -and $missing -eq 0 -and
  (-not $directory -or $inheritanceProtected)

[ordered]@{
  ok = [bool]$ok
  ownerMatches = [bool]$ownerMatches
  inheritanceProtected = [bool]$inheritanceProtected
  unexpectedAceCount = [int]$unexpected
  missingRuleCount = [int]$missing
} | ConvertTo-Json -Compress
`;
