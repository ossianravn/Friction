import { randomUUID } from "node:crypto";
import { link, lstat, open, readFile, rename, unlink } from "node:fs/promises";
import path from "node:path";

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

export async function writeOutputFile(
  targetPath: string,
  bytes: Uint8Array,
  force: boolean,
): Promise<void> {
  let original: Buffer | null = null;

  try {
    const status = await lstat(targetPath);

    if (status.isSymbolicLink() || !status.isFile() || !force) {
      throw new Error("output-conflict");
    }

    original = await readFile(targetPath);
  } catch (error) {
    if (!isErrorCode(error, "ENOENT")) {
      throw error;
    }
  }

  const directory = path.dirname(targetPath);
  const temporaryPath = path.join(
    directory,
    `.friction-${randomUUID().replaceAll("-", "")}.tmp`,
  );
  let handle;

  try {
    handle = await open(temporaryPath, "wx", 0o600);
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = undefined;

    if (original === null) {
      try {
        await link(temporaryPath, targetPath);
      } catch (error) {
        if (isErrorCode(error, "EEXIST")) {
          throw new Error("output-conflict");
        }

        throw error;
      }
    } else {
      const status = await lstat(targetPath);
      const current = await readFile(targetPath);

      if (status.isSymbolicLink() || !status.isFile() || !current.equals(original)) {
        throw new Error("output-conflict");
      }

      await rename(temporaryPath, targetPath);
    }

    await flushDirectoryBestEffort(directory);
  } finally {
    await handle?.close().catch(() => undefined);
    await unlink(temporaryPath).catch(() => undefined);
  }
}

export async function installPrivateFileExclusively(
  temporaryDirectory: string,
  finalPath: string,
  bytes: Uint8Array,
): Promise<"installed" | "exists"> {
  const temporaryPath = path.join(
    temporaryDirectory,
    `${randomUUID().replaceAll("-", "")}.tmp`,
  );
  let handle;

  try {
    handle = await open(temporaryPath, "wx", 0o600);
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

    await flushDirectoryBestEffort(path.dirname(finalPath));
    return "installed";
  } finally {
    await handle?.close().catch(() => undefined);
    await unlink(temporaryPath).catch(() => undefined);
  }
}
