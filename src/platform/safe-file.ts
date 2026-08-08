import { constants } from "node:fs";
import { lstat, open, type FileHandle } from "node:fs/promises";
import path from "node:path";

import { FrictionFailure } from "../domain/failures.js";
import { resolveRuntimePlatform } from "./runtime-platform.js";
import { assertPathInsideRoot } from "./safe-path.js";
import { inspectWindowsPathComponents } from "./windows/reparse.js";

export type SafeFileRead =
  | { exists: false }
  | { exists: true; bytes: Buffer | null; mode: number };

function isMissing(error: unknown): boolean {
  return error !== null &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "ENOENT";
}

async function inspectPosixPath(
  root: string,
  target: string,
): Promise<"file" | "missing"> {
  assertPathInsideRoot(root, target);
  const relative = path.posix.relative(root, target);
  const parts = relative === "" ? [] : relative.split(path.posix.sep);
  let current = root;

  for (let index = 0; index <= parts.length; index += 1) {
    if (index > 0) {
      current = path.posix.join(current, parts[index - 1]!);
    }

    try {
      const status = await lstat(current);
      const targetEntry = index === parts.length;

      if (status.isSymbolicLink() || (targetEntry ? !status.isFile() : !status.isDirectory())) {
        throw new FrictionFailure("safety_failure");
      }
    } catch (error) {
      if (isMissing(error)) {
        return "missing";
      }

      throw error;
    }
  }

  return "file";
}

function sameFile(
  left: Awaited<ReturnType<FileHandle["stat"]>>,
  right: Awaited<ReturnType<FileHandle["stat"]>>,
): boolean {
  return left.dev === right.dev &&
    left.ino === right.ino &&
    left.size === right.size &&
    left.mode === right.mode &&
    left.mtimeMs === right.mtimeMs &&
    left.ctimeMs === right.ctimeMs;
}

async function readBounded(handle: FileHandle, maximumBytes: number): Promise<Buffer> {
  const bytes = Buffer.alloc(maximumBytes + 1);
  let offset = 0;

  while (offset < bytes.length) {
    const result = await handle.read(bytes, offset, bytes.length - offset, null);

    if (result.bytesRead === 0) {
      break;
    }

    offset += result.bytesRead;
  }

  if (offset > maximumBytes) {
    throw new FrictionFailure("safety_failure");
  }

  return bytes.subarray(0, offset);
}

export async function readRegularFileSafely(
  rootValue: string,
  targetValue: string,
  maximumBytes: number,
): Promise<SafeFileRead> {
  const platform = resolveRuntimePlatform();
  const platformPath = platform === "win32" ? path.win32 : path.posix;
  const root = platformPath.resolve(rootValue);
  const target = platformPath.resolve(targetValue);
  assertPathInsideRoot(root, target, platform);
  const initial = platform === "win32"
    ? await inspectWindowsPathComponents(root, target, "file-or-missing")
    : await inspectPosixPath(root, target);

  if (
    initial === "missing" ||
    (typeof initial !== "string" && initial.kind === "missing")
  ) {
    return { exists: false };
  }

  const pathBefore = await lstat(target);

  if (!pathBefore.isFile()) {
    throw new FrictionFailure("safety_failure");
  }

  if (pathBefore.size > maximumBytes) {
    return { exists: true, bytes: null, mode: pathBefore.mode & 0o777 };
  }

  const flags = platform === "win32"
    ? constants.O_RDONLY
    : constants.O_RDONLY | constants.O_NOFOLLOW;
  const handle = await open(target, flags);

  try {
    const opened = await handle.stat();

    if (!opened.isFile() || opened.size > maximumBytes || !sameFile(pathBefore, opened)) {
      throw new FrictionFailure("safety_failure");
    }

    const bytes = await readBounded(handle, maximumBytes);
    const openedAfter = await handle.stat();

    if (!sameFile(opened, openedAfter)) {
      throw new FrictionFailure("safety_failure");
    }

    if (platform === "win32") {
      await inspectWindowsPathComponents(root, target, "file");
    } else if ((await inspectPosixPath(root, target)) !== "file") {
      throw new FrictionFailure("safety_failure");
    }

    const pathAfter = await lstat(target);

    if (!sameFile(opened, pathAfter)) {
      throw new FrictionFailure("safety_failure");
    }

    return { exists: true, bytes, mode: pathAfter.mode & 0o777 };
  } finally {
    await handle.close();
  }
}
