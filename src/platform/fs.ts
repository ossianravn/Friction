import { randomUUID } from "node:crypto";
import { link, lstat, open, realpath, unlink } from "node:fs/promises";
import path from "node:path";

import { FrictionFailure } from "../domain/failures.js";
import {
  commitStagedFile,
  discardStagedFile,
  stageFileReplacement,
} from "./atomic-file.js";
import {
  readRegularFileSafely,
  type SafeFileRead,
} from "./safe-file.js";

const MAXIMUM_OUTPUT_BYTES = 16 * 1_024 * 1_024;

function sameSafeRead(left: SafeFileRead, right: SafeFileRead): boolean {
  if (!left.exists || !right.exists) {
    return left.exists === right.exists;
  }

  return left.bytes !== null &&
    right.bytes !== null &&
    left.mode === right.mode &&
    left.bytes.equals(right.bytes);
}

function isErrorCode(error: unknown, code: string): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    error.code === code
  );
}

async function flushDirectoryBestEffort(directory: string): Promise<void> {
  let handle;

  try {
    handle = await open(directory, "r");
    await handle.sync();
  } catch {
    // Directory fsync is best-effort because support differs by platform/filesystem.
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function canonicalizeOutputTarget(targetValue: string): Promise<string> {
  if (process.platform === "win32") {
    return path.win32.resolve(targetValue);
  }

  const target = path.posix.resolve(targetValue);
  const missingComponents = [path.posix.basename(target)];
  let ancestor = path.posix.dirname(target);

  while (true) {
    try {
      const canonicalAncestor = await realpath(ancestor);
      const status = await lstat(canonicalAncestor);

      if (!status.isDirectory()) {
        throw new FrictionFailure("safety_failure");
      }

      return path.posix.join(canonicalAncestor, ...missingComponents.reverse());
    } catch (error) {
      if (!isErrorCode(error, "ENOENT")) {
        throw error;
      }

      const parent = path.posix.dirname(ancestor);

      if (parent === ancestor) {
        throw new FrictionFailure("safety_failure");
      }

      missingComponents.push(path.posix.basename(ancestor));
      ancestor = parent;
    }
  }
}

async function removeInstalledPrivateFile(
  temporaryPath: string,
  finalPath: string,
): Promise<boolean> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    let temporaryStatus;

    try {
      temporaryStatus = await lstat(temporaryPath);
    } catch {
      return false;
    }

    let installedStatus;

    try {
      installedStatus = await lstat(finalPath);
    } catch (error) {
      if (isErrorCode(error, "ENOENT")) {
        return true;
      }

      if (attempt === 9) {
        return false;
      }

      await new Promise((resolve) => setTimeout(resolve, 20));
      continue;
    }

    if (
      temporaryStatus.dev !== installedStatus.dev ||
      temporaryStatus.ino !== installedStatus.ino
    ) {
      return false;
    }

    try {
      await unlink(finalPath);

      try {
        await lstat(finalPath);
        return false;
      } catch (error) {
        return isErrorCode(error, "ENOENT");
      }
    } catch (error) {
      if (isErrorCode(error, "ENOENT")) {
        return true;
      }

      if (attempt === 9) {
        return false;
      }

      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }

  return false;
}

export async function writeOutputFile(
  targetPath: string,
  bytes: Uint8Array,
  force: boolean,
): Promise<void> {
  const canonicalTarget = await canonicalizeOutputTarget(targetPath);
  const root = path.parse(canonicalTarget).root;
  const original = await readRegularFileSafely(
    root,
    canonicalTarget,
    MAXIMUM_OUTPUT_BYTES,
  );

  if (original.exists && (original.bytes === null || !force)) {
    throw new FrictionFailure("output_conflict");
  }

  const temporaryPath = await stageFileReplacement(
    canonicalTarget,
    bytes,
    original.exists ? original.mode : 0o600,
  );

  try {
    await commitStagedFile({
      temporaryPath,
      targetPath: canonicalTarget,
      targetExists: original.exists,
      conflictCode: "output_conflict",
      assertUnchanged: async () => {
        const current = await readRegularFileSafely(
          root,
          canonicalTarget,
          MAXIMUM_OUTPUT_BYTES,
        );
        if (!sameSafeRead(current, original)) {
          throw new FrictionFailure("output_conflict");
        }
      },
    });
  } finally {
    await discardStagedFile(temporaryPath);
  }
}

export async function installPrivateFileExclusively(
  temporaryDirectory: string,
  finalPath: string,
  bytes: Uint8Array,
  checks: {
    temporaryCreated(path: string): Promise<void>;
    installed(path: string): Promise<void>;
  } | undefined = undefined,
): Promise<"installed" | "exists"> {
  const temporaryPath = path.join(
    temporaryDirectory,
    `${randomUUID().replaceAll("-", "")}.tmp`,
  );
  let handle;
  let installed = false;

  try {
    handle = await open(temporaryPath, "wx", 0o600);
    await checks?.temporaryCreated(temporaryPath);
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = undefined;

    try {
      await link(temporaryPath, finalPath);
    } catch (error) {
      if (isErrorCode(error, "EEXIST")) {
        return "exists";
      }

      throw error;
    }

    installed = true;
    await checks?.installed(finalPath);
    await flushDirectoryBestEffort(path.dirname(finalPath));
    return "installed";
  } catch (error) {
    if (
      installed &&
      !(await removeInstalledPrivateFile(temporaryPath, finalPath))
    ) {
      throw new FrictionFailure("indeterminate_store");
    }

    throw error;
  } finally {
    await handle?.close().catch(() => undefined);
    await unlink(temporaryPath).catch(() => undefined);
  }
}
