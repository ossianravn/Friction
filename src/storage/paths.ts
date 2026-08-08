import { lstat } from "node:fs/promises";
import path from "node:path";

import { FrictionFailure } from "../domain/failures.js";
import {
  resolvePrivateHome,
  type PrivateHomeOptions,
} from "../platform/safe-path.js";
import { resolveRuntimePlatform } from "../platform/runtime-platform.js";

export type FrictionPaths = {
  home: string;
  events: string;
  temporary: string;
  setupLocks: string;
};

export function resolveFrictionPaths(
  options: PrivateHomeOptions = {},
): FrictionPaths {
  const platform = options.platform ?? resolveRuntimePlatform();
  const home = resolvePrivateHome({ ...options, platform });
  const platformPath = platform === "win32" ? path.win32 : path.posix;
  const versionRoot = platformPath.join(home, "v1");

  return {
    home,
    events: platformPath.join(versionRoot, "events"),
    temporary: platformPath.join(versionRoot, "tmp"),
    setupLocks: platformPath.join(versionRoot, "setup-locks"),
  };
}

export async function rejectUnsafeStoreDirectory(directory: string): Promise<void> {
  try {
    const status = await lstat(directory);

    if (status.isSymbolicLink() || !status.isDirectory()) {
      throw new FrictionFailure("safety_failure");
    }
  } catch (error) {
    if (
      error !== null &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return;
    }

    throw error;
  }
}

export const rejectSymlinkedHome = rejectUnsafeStoreDirectory;
