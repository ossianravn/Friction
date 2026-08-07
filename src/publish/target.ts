import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import path from "node:path";

import { FrictionFailure } from "../domain/failures.js";
import { isPublishedObservation } from "./projection.js";
import type { PublishedObservation, PublishSnapshot } from "./types.js";

const MAXIMUM_PROJECTION_BYTES = 16 * 1_024 * 1_024;

function isMissing(error: unknown): boolean {
  return error !== null && typeof error === "object" && "code" in error && error.code === "ENOENT";
}

export function assertPublishPath(root: string, targetPath: string): void {
  const relative = path.relative(root, targetPath);

  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new FrictionFailure("publish_conflict");
  }
}

export async function rejectSymlinkedPublishParents(
  root: string,
  targetPath: string,
): Promise<void> {
  assertPublishPath(root, targetPath);
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
    const handle = await open(targetPath, constants.O_RDONLY | constants.O_NOFOLLOW);

    try {
      const status = await handle.stat();

      if (!status.isFile() || status.size > MAXIMUM_PROJECTION_BYTES) {
        throw new FrictionFailure("publish_conflict");
      }

      const bytes = await handle.readFile();
      const records = parseProjection(bytes);
      return {
        exists: true,
        digest: createHash("sha256").update(bytes).digest("hex"),
        mode: status.mode & 0o777,
        bytes,
        records,
      };
    } finally {
      await handle.close();
    }
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
