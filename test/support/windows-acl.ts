import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";

const inspectScript = `
$ErrorActionPreference = "Stop"
$target = [Environment]::GetEnvironmentVariable("FRICTION_TEST_ACL_PATH")
$targetIsDirectory = [IO.Directory]::Exists($target)
$sections = [Security.AccessControl.AccessControlSections]::Access -bor [Security.AccessControl.AccessControlSections]::Owner
$acl = if ($targetIsDirectory) {
  [IO.Directory]::GetAccessControl($target, $sections)
} else {
  [IO.File]::GetAccessControl($target, $sections)
}
$expectedInheritance = if ($targetIsDirectory) {
  [System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [System.Security.AccessControl.InheritanceFlags]::ObjectInherit
} else { [System.Security.AccessControl.InheritanceFlags]::None }
$currentSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$expected = @($currentSid, "S-1-5-18")
$rules = @($acl.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier]))
$unexpectedCount = 0
foreach ($rule in $rules) {
  $identity = $expected -contains $rule.IdentityReference.Value
  $allow = $rule.AccessControlType -eq [System.Security.AccessControl.AccessControlType]::Allow
  $full = [int64]$rule.FileSystemRights -eq [int64][System.Security.AccessControl.FileSystemRights]::FullControl
  $inheritance = $rule.InheritanceFlags -eq $expectedInheritance
  if (-not ($identity -and $allow -and $full -and $inheritance)) { $unexpectedCount++ }
}
$missingCount = 0
foreach ($identity in $expected) {
  $matching = @($rules | Where-Object {
    $_.IdentityReference.Value -eq $identity -and
    $_.AccessControlType -eq [System.Security.AccessControl.AccessControlType]::Allow -and
    [int64]$_.FileSystemRights -eq [int64][System.Security.AccessControl.FileSystemRights]::FullControl -and
    $_.InheritanceFlags -eq $expectedInheritance
  })
  if ($matching.Count -eq 0) { $missingCount++ }
}
$owner = $acl.GetOwner([System.Security.Principal.SecurityIdentifier]).Value
[ordered]@{
  ok = ($owner -eq $currentSid -and $unexpectedCount -eq 0 -and $missingCount -eq 0)
  ownerMatches = ($owner -eq $currentSid)
  inheritanceProtected = [bool]$acl.AreAccessRulesProtected
  unexpectedAceCount = $unexpectedCount
  missingRuleCount = $missingCount
} | ConvertTo-Json -Compress
`;

const broadenScript = `
$ErrorActionPreference = "Stop"
$target = [Environment]::GetEnvironmentVariable("FRICTION_TEST_ACL_PATH")
$sections = [Security.AccessControl.AccessControlSections]::Access -bor [Security.AccessControl.AccessControlSections]::Owner
$acl = [IO.Directory]::GetAccessControl($target, $sections)
$identity = New-Object System.Security.Principal.SecurityIdentifier("S-1-5-32-545")
$rights = [System.Security.AccessControl.FileSystemRights]::FullControl
$inheritance = [System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [System.Security.AccessControl.InheritanceFlags]::ObjectInherit
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule -ArgumentList @($identity, $rights, $inheritance, [System.Security.AccessControl.PropagationFlags]::None, [System.Security.AccessControl.AccessControlType]::Allow)
$acl.AddAccessRule($rule)
[IO.Directory]::SetAccessControl($target, $acl)
"ok" | ConvertTo-Json -Compress
`;

export type AclFacts = {
  ok: boolean;
  ownerMatches: boolean;
  inheritanceProtected: boolean;
  unexpectedAceCount: number;
  missingRuleCount: number;
};

function environmentValue(name: string): string {
  const entry = Object.entries(process.env).find(
    ([key]) => key.toLowerCase() === name.toLowerCase(),
  );

  if (entry?.[1] === undefined || entry[1].length === 0) {
    throw new Error("required Windows environment is unavailable");
  }

  return entry[1];
}

async function runPowerShell(script: string, target: string): Promise<unknown> {
  const executable = path.win32.join(
    environmentValue("SystemRoot"),
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  const encoded = Buffer.from(script, "utf16le").toString("base64");

  return new Promise((resolve, reject) => {
    const child = spawn(
      executable,
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
      {
        env: { ...process.env, FRICTION_TEST_ACL_PATH: target },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    const stdout: Buffer[] = [];
    let bytes = 0;
    let settled = false;
    const finish = (error: Error | null, value?: unknown): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      error ? reject(error) : resolve(value);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(new Error("Windows security helper timed out."));
    }, 10_000);

    for (const stream of [child.stdout, child.stderr]) {
      stream.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > 64 * 1_024) {
          child.kill();
          finish(new Error("Windows security helper output exceeded its bound."));
        } else if (stream === child.stdout) {
          stdout.push(chunk);
        }
      });
    }
    child.on("error", () => finish(new Error("Windows security helper failed.")));
    child.on("close", (code) => {
      if (code !== 0) return finish(new Error("Windows security helper failed."));
      try {
        finish(null, JSON.parse(Buffer.concat(stdout).toString("utf8").trim()));
      } catch {
        finish(new Error("Windows security helper returned invalid facts."));
      }
    });
  });
}

export async function inspectAcl(target: string): Promise<AclFacts> {
  const value = await runPowerShell(inspectScript, target);
  assert.equal(typeof value, "object");
  assert.ok(value !== null && !Array.isArray(value));
  const facts = value as Record<string, unknown>;
  for (const key of ["ok", "ownerMatches", "inheritanceProtected"]) {
    assert.equal(typeof facts[key], "boolean");
  }
  for (const key of ["unexpectedAceCount", "missingRuleCount"]) {
    assert.equal(typeof facts[key], "number");
  }
  return facts as AclFacts;
}

export async function broadenAcl(target: string): Promise<void> {
  await runPowerShell(broadenScript, target);
}
