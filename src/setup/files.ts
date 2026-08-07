import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
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

export function setupFileDigest(bytes: Buffer): string {
  return digest(bytes);
}

export async function canonicalizeSetupRoot(requestedRoot: string): Promise<string> {
  const absolute = path.resolve(requestedRoot);
  const parsed = path.parse(absolute);
  const components = absolute.slice(parsed.root.length).split(path.sep).filter(Boolean);
  let current = parsed.root;
  let nearestExisting = parsed.root;
  let missing = false;
  let existingCount = 0;

  for (const component of components) {
    current = path.join(current, component);

    if (missing) {
      continue;
    }

    try {
      const status = await lstat(current);

      if (status.isSymbolicLink() || !status.isDirectory()) {
        throw new FrictionFailure("setup_conflict");
      }

      nearestExisting = current;
      existingCount += 1;
    } catch (error) {
      if (!isMissing(error)) {
        throw error;
      }

      missing = true;
    }
  }

  const canonicalAncestor = await realpath(nearestExisting);
  return path.join(canonicalAncestor, ...components.slice(existingCount));
}

export async function assertSetupRoot(scopeRoot: string): Promise<void> {
  if ((await canonicalizeSetupRoot(scopeRoot)) !== scopeRoot) {
    throw new FrictionFailure("setup_conflict");
  }
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

export async function missingSetupDirectories(
  scopeRoot: string,
  targetPath: string,
): Promise<string[]> {
  assertWithinScope(scopeRoot, targetPath);
  const missing: string[] = [];
  let current = path.dirname(targetPath);

  while (true) {
    try {
      const status = await lstat(current);

      if (status.isSymbolicLink() || !status.isDirectory()) {
        throw new FrictionFailure("setup_conflict");
      }

      return missing.reverse();
    } catch (error) {
      if (!isMissing(error)) {
        throw error;
      }

      missing.push(current);

      if (current === scopeRoot) {
        return missing.reverse();
      }

      const parent = path.dirname(current);

      if (parent === current) {
        throw new FrictionFailure("setup_conflict");
      }

      current = parent;
    }
  }
}

export function sameSnapshot(left: FileSnapshot, right: FileSnapshot): boolean {
  return (
    left.exists === right.exists &&
    left.mode === right.mode &&
    left.digest === right.digest
  );
}
