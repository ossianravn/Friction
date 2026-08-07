import { lstat, mkdir, rmdir } from "node:fs/promises";
import path from "node:path";

import { FrictionFailure } from "../domain/failures.js";
import { missingSetupDirectories } from "./files.js";
import type { SetupPlan } from "./types.js";

function isCode(error: unknown, code: string): boolean {
  return error !== null &&
    typeof error === "object" &&
    "code" in error &&
    error.code === code;
}

export function compareSetupPaths(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export async function plannedSetupDirectories(plan: SetupPlan): Promise<string[]> {
  const directories = new Set<string>();

  for (const target of plan.targets) {
    if (target.state === "noop" || target.desiredBytes === null) {
      continue;
    }

    for (const directory of await missingSetupDirectories(
      target.scopeRoot,
      target.path,
    )) {
      directories.add(directory);
    }
  }

  return [...directories].sort(
    (left, right) =>
      left.split(path.sep).length - right.split(path.sep).length ||
      compareSetupPaths(left, right),
  );
}

export async function createSetupDirectories(
  directories: readonly string[],
  mode: number,
  created: string[],
): Promise<void> {
  for (const directory of directories) {
    try {
      await mkdir(directory, { mode });
      created.push(directory);
    } catch (error) {
      if (isCode(error, "EEXIST")) {
        throw new FrictionFailure("setup_conflict");
      }

      throw error;
    }

    const status = await lstat(directory);

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
