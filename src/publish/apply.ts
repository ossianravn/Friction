import { randomUUID } from "node:crypto";
import { link, lstat, mkdir, open, rename, unlink } from "node:fs/promises";
import path from "node:path";

import { FrictionFailure } from "../domain/failures.js";
import {
  inspectPublishTarget,
  rejectSymlinkedPublishParents,
  samePublishSnapshot,
} from "./target.js";
import type { PublishPlan } from "./types.js";

function isCode(error: unknown, code: string): boolean {
  return error !== null && typeof error === "object" && "code" in error && error.code === code;
}

async function ensureParent(root: string, targetPath: string): Promise<void> {
  const relative = path.relative(root, path.dirname(targetPath));
  const components = relative === "" ? [] : relative.split(path.sep);
  let current = root;

  for (const component of components) {
    current = path.join(current, component);

    try {
      await mkdir(current, { mode: 0o755 });
    } catch (error) {
      if (!isCode(error, "EEXIST")) {
        throw error;
      }
    }

    const status = await lstat(current);

    if (status.isSymbolicLink() || !status.isDirectory()) {
      throw new FrictionFailure("publish_conflict");
    }
  }
}

async function flushDirectory(directory: string): Promise<void> {
  let handle;

  try {
    handle = await open(directory, "r");
    await handle.sync();
  } catch {
    // Directory fsync is best-effort across supported local filesystems.
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

export async function applyPublishPlan(plan: PublishPlan): Promise<void> {
  if (plan.snapshot.bytes.equals(plan.desiredBytes)) {
    return;
  }

  const initial = await inspectPublishTarget(plan.root, plan.targetPath);

  if (!samePublishSnapshot(initial, plan.snapshot)) {
    throw new FrictionFailure("publish_conflict");
  }

  await ensureParent(plan.root, plan.targetPath);
  await rejectSymlinkedPublishParents(plan.root, plan.targetPath);
  const beforeStage = await inspectPublishTarget(plan.root, plan.targetPath);

  if (!samePublishSnapshot(beforeStage, plan.snapshot)) {
    throw new FrictionFailure("publish_conflict");
  }

  const directory = path.dirname(plan.targetPath);
  const temporaryPath = path.join(directory, `.friction-${randomUUID().replaceAll("-", "")}.tmp`);
  let handle;

  try {
    handle = await open(temporaryPath, "wx", plan.snapshot.mode ?? 0o644);
    await handle.chmod(plan.snapshot.mode ?? 0o644);
    await handle.writeFile(plan.desiredBytes);
    await handle.sync();
    await handle.close();
    handle = undefined;
    const beforeCommit = await inspectPublishTarget(plan.root, plan.targetPath);

    if (!samePublishSnapshot(beforeCommit, plan.snapshot)) {
      throw new FrictionFailure("publish_conflict");
    }

    if (plan.snapshot.exists) {
      await rename(temporaryPath, plan.targetPath);
    } else {
      try {
        await link(temporaryPath, plan.targetPath);
      } catch (error) {
        if (isCode(error, "EEXIST")) {
          throw new FrictionFailure("publish_conflict");
        }

        throw error;
      }
    }

    await flushDirectory(directory);
  } catch (error) {
    if (error instanceof FrictionFailure) {
      throw error;
    }

    throw new FrictionFailure("io_error");
  } finally {
    await handle?.close().catch(() => undefined);
    await unlink(temporaryPath).catch(() => undefined);
  }
}
