import { randomUUID } from "node:crypto";
import { link, open, rename, unlink } from "node:fs/promises";
import path from "node:path";

import { FrictionFailure, type FailureCode } from "../domain/failures.js";
import { resolveRuntimePlatform } from "./runtime-platform.js";

const retryDelays = [10, 25, 50, 100] as const;

function isCode(error: unknown, codes: readonly string[]): boolean {
  return error !== null &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string" &&
    codes.includes(error.code);
}

async function flushDirectoryBestEffort(directory: string): Promise<void> {
  let handle;

  try {
    handle = await open(directory, "r");
    await handle.sync();
  } catch {
    // Directory flushing is best-effort across supported local filesystems.
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

export async function stageFileReplacement(
  targetPath: string,
  bytes: Uint8Array,
  mode: number,
): Promise<string> {
  const temporaryPath = path.join(
    path.dirname(targetPath),
    `.friction-${randomUUID().replaceAll("-", "")}.tmp`,
  );
  const handle = await open(temporaryPath, "wx", mode);

  try {
    await handle.chmod(mode);
    await handle.writeFile(bytes);
    await handle.sync();
    return temporaryPath;
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  } finally {
    await handle.close();
  }
}

export async function discardStagedFile(temporaryPath: string): Promise<void> {
  await unlink(temporaryPath).catch(() => undefined);
}

export async function commitStagedFile(input: {
  temporaryPath: string;
  targetPath: string;
  targetExists: boolean;
  conflictCode: FailureCode;
  assertUnchanged(): Promise<void>;
}): Promise<void> {
  await input.assertUnchanged();

  if (!input.targetExists) {
    try {
      await link(input.temporaryPath, input.targetPath);
    } catch (error) {
      if (isCode(error, ["EEXIST"])) {
        throw new FrictionFailure(input.conflictCode);
      }

      throw error;
    }

    await flushDirectoryBestEffort(path.dirname(input.targetPath));
    return;
  }

  for (let attempt = 0; ; attempt += 1) {
    await input.assertUnchanged();

    try {
      await rename(input.temporaryPath, input.targetPath);
      await flushDirectoryBestEffort(path.dirname(input.targetPath));
      return;
    } catch (error) {
      const retry = resolveRuntimePlatform() === "win32" &&
        isCode(error, ["EPERM", "EBUSY", "EACCES"]) &&
        attempt < retryDelays.length;

      if (!retry) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt]));
    }
  }
}
