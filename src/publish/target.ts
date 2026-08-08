import { createHash } from "node:crypto";
import { lstat } from "node:fs/promises";
import path from "node:path";

import { FrictionFailure } from "../domain/failures.js";
import { resolveRuntimePlatform } from "../platform/runtime-platform.js";
import { readRegularFileSafely } from "../platform/safe-file.js";
import { assertPathInsideRoot } from "../platform/safe-path.js";
import { inspectWindowsPathComponents } from "../platform/windows/reparse.js";
import { isPublishedObservation } from "./projection.js";
import type { PublishedObservation, PublishSnapshot } from "./types.js";

const MAXIMUM_PROJECTION_BYTES = 16 * 1_024 * 1_024;

function isMissing(error: unknown): boolean {
  return error !== null && typeof error === "object" && "code" in error && error.code === "ENOENT";
}

export function assertPublishPath(root: string, targetPath: string): void {
  try {
    assertPathInsideRoot(root, targetPath);
  } catch {
    throw new FrictionFailure("publish_conflict");
  }
}

export async function rejectSymlinkedPublishParents(
  root: string,
  targetPath: string,
): Promise<void> {
  assertPublishPath(root, targetPath);

  if (resolveRuntimePlatform() === "win32") {
    try {
      await inspectWindowsPathComponents(root, targetPath, "file-or-missing");
      return;
    } catch {
      throw new FrictionFailure("publish_conflict");
    }
  }

  const relative = path.relative(root, path.dirname(targetPath));
  const components = relative === "" ? [] : relative.split(path.sep);
  let current = root;

  for (const component of components) {
    current = path.join(current, component);

    try {
      const status = await lstat(current);

      if (status.isSymbolicLink() || !status.isDirectory()) {
        throw new FrictionFailure("publish_conflict");
      }
    } catch (error) {
      if (isMissing(error)) {
        return;
      }

      throw error;
    }
  }
}

function parseProjection(bytes: Buffer): PublishedObservation[] {
  const records = new Map<string, PublishedObservation>();

  function normalized(value: PublishedObservation): PublishedObservation {
    return {
      schemaVersion: 1,
      observationId: value.observationId,
      createdAt: value.createdAt,
      status: value.status,
      body: value.body,
      source: value.source,
      model: value.model,
      area: value.area,
      impacts: [...value.impacts],
      repository: { ...value.repository },
      resolution: value.resolution === null ? null : { ...value.resolution },
      redactionCount: value.redactionCount,
    };
  }

  for (const line of bytes.toString("utf8").split("\n")) {
    if (line.trim().length === 0) {
      continue;
    }

    let value: unknown;

    try {
      value = JSON.parse(line);
    } catch {
      throw new FrictionFailure("publish_conflict");
    }

    if (!isPublishedObservation(value)) {
      throw new FrictionFailure("publish_conflict");
    }

    const current = normalized(value);
    const existing = records.get(current.observationId);

    if (existing !== undefined && JSON.stringify(existing) !== JSON.stringify(current)) {
      throw new FrictionFailure("publish_conflict");
    }

    records.set(current.observationId, current);
  }

  return [...records.values()];
}

export async function inspectPublishTarget(
  root: string,
  targetPath: string,
): Promise<PublishSnapshot> {
  await rejectSymlinkedPublishParents(root, targetPath);

  try {
    const read = await readRegularFileSafely(
      root,
      targetPath,
      MAXIMUM_PROJECTION_BYTES,
    );

    if (!read.exists) {
      return { exists: false, digest: null, mode: null, bytes: Buffer.alloc(0), records: [] };
    }

    if (read.bytes === null) {
      throw new FrictionFailure("publish_conflict");
    }

    const records = parseProjection(read.bytes);
    return {
      exists: true,
      digest: createHash("sha256").update(read.bytes).digest("hex"),
      mode: read.mode,
      bytes: read.bytes,
      records,
    };
  } catch (error) {
    if (isMissing(error)) {
      return { exists: false, digest: null, mode: null, bytes: Buffer.alloc(0), records: [] };
    }

    if (error instanceof FrictionFailure) {
      throw error;
    }

    throw new FrictionFailure("publish_conflict");
  }
}

export function samePublishSnapshot(left: PublishSnapshot, right: PublishSnapshot): boolean {
  return left.exists === right.exists && left.digest === right.digest && left.mode === right.mode;
}
