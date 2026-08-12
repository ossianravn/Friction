import { lstat, mkdir, rmdir } from "node:fs/promises";
import path from "node:path";

import { FrictionFailure } from "../domain/failures.js";
import { missingSetupDirectories } from "./files.js";
import type { SetupPlan, SetupTarget } from "./types.js";

function isCode(error: unknown, code: string): boolean {
  return error !== null &&
    typeof error === "object" &&
    "code" in error &&
    error.code === code;
}

export type PlannedSetupDirectory = {
  path: string;
  permissions: SetupTarget["permissions"];
};

export function compareSetupPaths(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export async function plannedSetupDirectories(
  plan: SetupPlan,
): Promise<PlannedSetupDirectory[]> {
  const directories = new Map<string, SetupTarget["permissions"]>();

  for (const target of plan.targets) {
    if (target.state === "noop" || target.desiredBytes === null) {
      continue;
    }

    for (const directory of await missingSetupDirectories(
      target.scopeRoot,
      target.path,
    )) {
      const existing = directories.get(directory);

      if (existing !== undefined && existing !== target.permissions) {
        throw new FrictionFailure("internal_error");
      }

      directories.set(directory, target.permissions);
    }
  }

  return [...directories].map(([directory, permissions]) => ({
    path: directory,
    permissions,
  })).sort(
    (left, right) =>
      left.path.split(path.sep).length - right.path.split(path.sep).length ||
      compareSetupPaths(left.path, right.path),
  );
}

export async function createSetupDirectories(
  directories: readonly PlannedSetupDirectory[],
  created: string[],
): Promise<void> {
  for (const directory of directories) {
    try {
      await mkdir(directory.path, {
        mode: directory.permissions === "private" ? 0o700 : 0o755,
      });
      created.push(directory.path);
    } catch (error) {
      if (isCode(error, "EEXIST")) {
        throw new FrictionFailure("setup_conflict");
      }

      throw error;
    }

    const status = await lstat(directory.path);

    if (status.isSymbolicLink() || !status.isDirectory()) {
      throw new FrictionFailure("setup_conflict");
    }
  }
}

export async function removeSetupDirectories(
  directories: readonly string[],
): Promise<void> {
  for (const directory of [...directories].reverse()) {
    await rmdir(directory).catch(() => undefined);
  }
}
