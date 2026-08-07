import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";

import { FrictionFailure } from "../domain/failures.js";
import type { FileSnapshot } from "./types.js";

const MAXIMUM_SETUP_FILE_BYTES = 1_048_576;

function isMissing(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function digest(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function assertWithinScope(scopeRoot: string, targetPath: string): void {
  const relative = path.relative(scopeRoot, targetPath);

  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new FrictionFailure("setup_conflict");
  }
}

async function rejectSymlinkedParents(
  scopeRoot: string,
  targetPath: string,
): Promise<void> {
  const relativeParent = path.relative(scopeRoot, path.dirname(targetPath));
  const components = relativeParent === "" ? [] : relativeParent.split(path.sep);
  let current = scopeRoot;

  for (const component of components) {
    current = path.join(current, component);

    try {
      const status = await lstat(current);

      if (status.isSymbolicLink() || !status.isDirectory()) {
        throw new FrictionFailure("setup_conflict");
      }
    } catch (error) {
      if (isMissing(error)) {
        return;
      }

      throw error;
    }
  }
}

export async function inspectSetupFile(
  scopeRoot: string,
  targetPath: string,
): Promise<FileSnapshot> {
  assertWithinScope(scopeRoot, targetPath);
  await rejectSymlinkedParents(scopeRoot, targetPath);

  try {
    const status = await lstat(targetPath);

    if (status.isSymbolicLink() || !status.isFile() || status.size > MAXIMUM_SETUP_FILE_BYTES) {
      throw new FrictionFailure("setup_conflict");
    }

    const bytes = await readFile(targetPath);
    return {
      exists: true,
      bytes,
      mode: status.mode & 0o777,
      digest: digest(bytes),
    };
  } catch (error) {
    if (isMissing(error)) {
      return { exists: false, bytes: Buffer.alloc(0), mode: null, digest: null };
    }

    throw error;
  }
}

export function sameSnapshot(left: FileSnapshot, right: FileSnapshot): boolean {
  return (
    left.exists === right.exists &&
    left.mode === right.mode &&
    left.digest === right.digest
  );
}
