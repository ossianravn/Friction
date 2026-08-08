import { FrictionFailure } from "../../domain/failures.js";
import { assertSafeWindowsPrivateHome } from "./path-policy.js";
import { windowsAclScript } from "./acl-script.js";
import {
  runEncodedWindowsPowerShell,
  windowsPowerShellAvailable,
} from "./powershell.js";

const bridgeProbeScript = String.raw`
$ErrorActionPreference = 'Stop'
[ordered]@{ ok = $true } | ConvertTo-Json -Compress
`;

export type WindowsAclResult = {
  ok: boolean;
  ownerMatches: boolean;
  inheritanceProtected: boolean;
  unexpectedAceCount: number;
  missingRuleCount: number;
};

function isResult(value: unknown): value is WindowsAclResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();

  return (
    JSON.stringify(keys) ===
      JSON.stringify([
        "inheritanceProtected",
        "missingRuleCount",
        "ok",
        "ownerMatches",
        "unexpectedAceCount",
      ]) &&
    typeof record["ok"] === "boolean" &&
    typeof record["ownerMatches"] === "boolean" &&
    typeof record["inheritanceProtected"] === "boolean" &&
    Number.isSafeInteger(record["unexpectedAceCount"]) &&
    (record["unexpectedAceCount"] as number) >= 0 &&
    Number.isSafeInteger(record["missingRuleCount"]) &&
    (record["missingRuleCount"] as number) >= 0
  );
}

async function runAcl(
  action: "secure-directory" | "secure-file" | "verify-directory" | "verify-file",
  target: string,
): Promise<WindowsAclResult> {
  const safeTarget = assertSafeWindowsPrivateHome(target);
  const stdout = await runEncodedWindowsPowerShell(windowsAclScript, {
    FRICTION_WINDOWS_ACL_ACTION: action,
    FRICTION_WINDOWS_ACL_TARGET: safeTarget,
  });
  let value: unknown;

  try {
    value = JSON.parse(stdout.trim());
  } catch {
    throw new FrictionFailure("safety_failure");
  }

  if (!isResult(value)) {
    throw new FrictionFailure("safety_failure");
  }

  return value;
}

export async function securePrivateDirectory(
  target: string,
): Promise<WindowsAclResult> {
  const result = await runAcl("secure-directory", target);

  if (!result.ok) {
    throw new FrictionFailure("safety_failure");
  }

  return result;
}

export function verifyPrivateDirectory(target: string): Promise<WindowsAclResult> {
  return runAcl("verify-directory", target);
}

export function verifyPrivateFile(target: string): Promise<WindowsAclResult> {
  return runAcl("verify-file", target);
}

export async function securePrivateFile(target: string): Promise<WindowsAclResult> {
  const result = await runAcl("secure-file", target);

  if (!result.ok) {
    throw new FrictionFailure("safety_failure");
  }

  return result;
}

export async function windowsAclBridgeAvailable(): Promise<boolean> {
  if (!(await windowsPowerShellAvailable())) {
    return false;
  }

  try {
    const output = await runEncodedWindowsPowerShell(bridgeProbeScript, {});
    const value: unknown = JSON.parse(output.trim());
    return typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      Object.keys(value).length === 1 &&
      (value as Record<string, unknown>)["ok"] === true;
  } catch {
    return false;
  }
}
