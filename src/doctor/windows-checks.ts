import { lstat } from "node:fs/promises";
import path from "node:path";

import {
  allFileCapabilitiesAvailable,
  probeFileCapabilities,
} from "../platform/file-capabilities.js";
import {
  verifyPrivateDirectory,
  windowsAclBridgeAvailable,
} from "../platform/windows/acl.js";
import type { FrictionPaths } from "../storage/paths.js";
import type { DoctorCheck } from "./checks.js";

function isMissing(error: unknown): boolean {
  return error !== null &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "ENOENT";
}

async function aclDirectoryCheck(
  name: string,
  target: string,
): Promise<DoctorCheck> {
  try {
    const status = await lstat(target);

    if (status.isSymbolicLink()) {
      return { name, status: "error", message: `${name} is an unsupported reparse path.` };
    }

    if (!status.isDirectory()) {
      return { name, status: "error", message: `${name} is not a directory.` };
    }

    const acl = await verifyPrivateDirectory(target);

    if (!acl.ok) {
      return {
        name,
        status: "error",
        message: `${name} does not match the private Windows ACL policy.`,
      };
    }

    return { name, status: "ok", message: `${name} Windows ACL is private.` };
  } catch (error) {
    return isMissing(error)
      ? { name, status: "ok", message: `${name} does not exist yet.` }
      : { name, status: "error", message: `${name} ACL is not verifiable.` };
  }
}

export async function windowsPrivateStoreChecks(
  paths: FrictionPaths,
): Promise<{ checks: DoctorCheck[]; safeToRead: boolean }> {
  const bridgeAvailable = await windowsAclBridgeAvailable();
  const checks: DoctorCheck[] = [
    {
      name: "windows-acl-bridge",
      status: bridgeAvailable ? "ok" : "error",
      message: bridgeAvailable
        ? "Windows ACL inspection is available."
        : "Windows ACL inspection is unavailable.",
    },
  ];

  if (!bridgeAvailable) {
    return { checks, safeToRead: false };
  }

  const versionRoot = path.dirname(paths.events);
  const targets = [
    ["home", paths.home],
    ["version-directory", versionRoot],
    ["events-directory", paths.events],
    ["temporary-directory", paths.temporary],
    ["setup-locks-directory", paths.setupLocks],
  ] as const;

  for (const [name, target] of targets) {
    checks.push(await aclDirectoryCheck(name, target));
  }

  const safeToRead = !checks.some((check) => check.status === "error");

  if (safeToRead) {
    try {
      const temporary = await lstat(paths.temporary);

      if (temporary.isDirectory()) {
        const capabilities = await probeFileCapabilities(paths.temporary);
        const available = allFileCapabilitiesAvailable(capabilities);
        checks.push({
          name: "windows-filesystem-capabilities",
          status: available ? "ok" : "error",
          message: available
            ? "Required Windows filesystem primitives are available."
            : "Required Windows filesystem primitives are unavailable.",
        });
      }
    } catch (error) {
      if (!isMissing(error)) {
        checks.push({
          name: "windows-filesystem-capabilities",
          status: "error",
          message: "Windows filesystem capabilities are not verifiable.",
        });
      }
    }
  }

  return {
    checks,
    safeToRead: !checks.some((check) => check.status === "error"),
  };
}
