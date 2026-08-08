import { createHash } from "node:crypto";
import { lstat, realpath } from "node:fs/promises";
import path from "node:path";

import { FrictionFailure } from "../domain/failures.js";
import { resolveRuntimePlatform } from "../platform/runtime-platform.js";
import { readRegularFileSafely } from "../platform/safe-file.js";
import { assertPathInsideRoot } from "../platform/safe-path.js";
import { assertSafeWindowsPrivateHome } from "../platform/windows/path-policy.js";
import { inspectWindowsPathComponents } from "../platform/windows/reparse.js";
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
  const platform = resolveRuntimePlatform();
  const absolute = platform === "win32"
    ? assertSafeWindowsPrivateHome(path.win32.resolve(requestedRoot))
    : path.resolve(requestedRoot);
  const parsed = path.parse(absolute);

  if (platform === "win32") {
    await inspectWindowsPathComponents(parsed.root, absolute, "directory-or-missing");
  }

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
  const canonical = await canonicalizeSetupRoot(scopeRoot);
  const matches = resolveRuntimePlatform() === "win32"
    ? canonical.toLowerCase() === scopeRoot.toLowerCase()
    : canonical === scopeRoot;

  if (!matches) {
    throw new FrictionFailure("setup_conflict");
  }
}

export function assertWithinScope(scopeRoot: string, targetPath: string): void {
  try {
    assertPathInsideRoot(scopeRoot, targetPath);
  } catch {
    throw new FrictionFailure("setup_conflict");
  }
}

async function rejectSymlinkedParents(
  scopeRoot: string,
  targetPath: string,
): Promise<void> {
  if (resolveRuntimePlatform() === "win32") {
    try {
      await inspectWindowsPathComponents(scopeRoot, targetPath, "file-or-missing");
      return;
    } catch {
      throw new FrictionFailure("setup_conflict");
    }
  }

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
    const read = await readRegularFileSafely(
      scopeRoot,
      targetPath,
      MAXIMUM_SETUP_FILE_BYTES,
    );

    if (!read.exists) {
      return { exists: false, bytes: Buffer.alloc(0), mode: null, digest: null };
    }

    if (read.bytes === null) {
      throw new FrictionFailure("setup_conflict");
    }

    return {
      exists: true,
      bytes: read.bytes,
      mode: read.mode,
      digest: digest(read.bytes),
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

  if (resolveRuntimePlatform() === "win32") {
    try {
      await inspectWindowsPathComponents(
        scopeRoot,
        path.dirname(targetPath),
        "directory-or-missing",
      );
    } catch {
      throw new FrictionFailure("setup_conflict");
    }
  }
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
