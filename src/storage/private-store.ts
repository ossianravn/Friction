import { lstat, mkdir, readdir } from "node:fs/promises";
import path from "node:path";

import { FrictionFailure } from "../domain/failures.js";
import {
  allFileCapabilitiesAvailable,
  probeFileCapabilities,
} from "../platform/file-capabilities.js";
import { resolveRuntimePlatform } from "../platform/runtime-platform.js";
import {
  securePrivateDirectory,
  securePrivateFile,
  verifyPrivateDirectory,
  verifyPrivateFile,
  type WindowsAclResult,
} from "../platform/windows/acl.js";
import { inspectWindowsPathComponents } from "../platform/windows/reparse.js";
import {
  rejectSymlinkedHome,
  rejectUnsafeStoreDirectory,
  type FrictionPaths,
} from "./paths.js";

function isCode(error: unknown, code: string): boolean {
  return error !== null &&
    typeof error === "object" &&
    "code" in error &&
    error.code === code;
}

async function existsDirectory(directory: string): Promise<boolean> {
  try {
    const status = await lstat(directory);

    if (status.isSymbolicLink() || !status.isDirectory()) {
      throw new FrictionFailure("safety_failure");
    }

    return true;
  } catch (error) {
    if (isCode(error, "ENOENT")) {
      return false;
    }

    throw error;
  }
}

function requireSafeAcl(result: WindowsAclResult): void {
  if (!result.ok) {
    throw new FrictionFailure("safety_failure");
  }
}

async function waitForPrivateDirectory(directory: string): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      requireSafeAcl(await verifyPrivateDirectory(directory));
      return;
    } catch (error) {
      if (attempt === 9 || !(error instanceof FrictionFailure)) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
}

async function ensureWindowsDirectory(directory: string): Promise<void> {
  const volumeRoot = path.win32.parse(directory).root;
  await inspectWindowsPathComponents(
    volumeRoot,
    directory,
    "directory-or-missing",
  );

  if (await existsDirectory(directory)) {
    await waitForPrivateDirectory(directory);
    return;
  }

  try {
    await mkdir(directory);
  } catch (error) {
    if (isCode(error, "EEXIST")) {
      await waitForPrivateDirectory(directory);
      return;
    }

    throw error;
  }

  await inspectWindowsPathComponents(volumeRoot, directory, "directory");
  await securePrivateDirectory(directory);
  requireSafeAcl(await verifyPrivateDirectory(directory));
}

async function assertKnownWindowsLayout(paths: FrictionPaths): Promise<void> {
  const rootEntries = await readdir(paths.home);
  const normalizedRootEntries = rootEntries.map((entry) => entry.toLowerCase());

  if (
    new Set(normalizedRootEntries).size !== normalizedRootEntries.length ||
    normalizedRootEntries.some((entry) => entry !== "v1")
  ) {
    throw new FrictionFailure("safety_failure");
  }

  const versionRoot = path.win32.dirname(paths.events);

  if (!(await existsDirectory(versionRoot))) {
    return;
  }

  const versionEntries = await readdir(versionRoot);
  const known = new Set(["events", "tmp", "setup-locks"]);
  const normalizedVersionEntries = versionEntries.map((entry) => entry.toLowerCase());

  if (
    new Set(normalizedVersionEntries).size !== normalizedVersionEntries.length ||
    normalizedVersionEntries.some((entry) => !known.has(entry))
  ) {
    throw new FrictionFailure("safety_failure");
  }
}

async function ensureWindowsStore(
  paths: FrictionPaths,
  childDirectories: readonly string[],
): Promise<void> {
  await inspectWindowsPathComponents(
    path.win32.parse(paths.home).root,
    paths.home,
    "directory-or-missing",
  );
  const existingHome = await existsDirectory(paths.home);

  if (existingHome) {
    await waitForPrivateDirectory(paths.home);
    await assertKnownWindowsLayout(paths);
  } else {
    const parent = path.win32.dirname(paths.home);

    if (!(await existsDirectory(parent))) {
      throw new FrictionFailure("configuration_error");
    }

    await ensureWindowsDirectory(paths.home);
  }

  const versionRoot = path.win32.dirname(paths.events);
  await ensureWindowsDirectory(versionRoot);

  for (const directory of childDirectories) {
    await ensureWindowsDirectory(directory);
  }
}

async function ensurePosixStore(
  paths: FrictionPaths,
  childDirectories: readonly string[],
): Promise<void> {
  await rejectSymlinkedHome(paths.home);
  await mkdir(paths.home, { recursive: true, mode: 0o700 });
  await rejectSymlinkedHome(paths.home);
  const versionRoot = path.dirname(paths.events);
  await rejectUnsafeStoreDirectory(versionRoot);
  await mkdir(versionRoot, { recursive: true, mode: 0o700 });
  await rejectUnsafeStoreDirectory(versionRoot);

  for (const directory of childDirectories) {
    await rejectUnsafeStoreDirectory(directory);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await rejectUnsafeStoreDirectory(directory);
  }
}

export async function ensureEventStore(paths: FrictionPaths): Promise<void> {
  const directories = [paths.events, paths.temporary];

  if (resolveRuntimePlatform() === "win32") {
    await ensureWindowsStore(paths, directories);

    if (!allFileCapabilitiesAvailable(await probeFileCapabilities(paths.temporary))) {
      throw new FrictionFailure("capability_unavailable");
    }
  } else {
    await ensurePosixStore(paths, directories);
  }
}

export async function ensureSetupLockStore(paths: FrictionPaths): Promise<void> {
  if (resolveRuntimePlatform() === "win32") {
    await ensureWindowsStore(paths, [paths.setupLocks]);
  } else {
    await ensurePosixStore(paths, [paths.setupLocks]);
  }
}

export async function verifyEventStoreForRead(
  paths: FrictionPaths,
): Promise<boolean> {
  if (resolveRuntimePlatform() !== "win32") {
    await rejectSymlinkedHome(paths.home);
    await rejectUnsafeStoreDirectory(paths.events);
    return existsDirectory(paths.events);
  }

  if (!(await existsDirectory(paths.home))) {
    return false;
  }

  await inspectWindowsPathComponents(
    path.win32.parse(paths.home).root,
    paths.events,
    "directory-or-missing",
  );
  requireSafeAcl(await verifyPrivateDirectory(paths.home));
  await assertKnownWindowsLayout(paths);
  const versionRoot = path.win32.dirname(paths.events);

  if (!(await existsDirectory(versionRoot))) {
    return false;
  }

  requireSafeAcl(await verifyPrivateDirectory(versionRoot));

  if (!(await existsDirectory(paths.events))) {
    return false;
  }

  requireSafeAcl(await verifyPrivateDirectory(paths.events));
  return true;
}

export async function verifyPrivateStoreFile(filePath: string): Promise<void> {
  if (resolveRuntimePlatform() === "win32") {
    await inspectWindowsPathComponents(
      path.win32.parse(filePath).root,
      filePath,
      "file",
    );
    requireSafeAcl(await verifyPrivateFile(filePath));
  }
}

export async function securePrivateStoreFile(filePath: string): Promise<void> {
  if (resolveRuntimePlatform() === "win32") {
    await inspectWindowsPathComponents(
      path.win32.parse(filePath).root,
      filePath,
      "file",
    );
    requireSafeAcl(await securePrivateFile(filePath));
  }
}
