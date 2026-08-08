import { lstat, mkdir } from "node:fs/promises";
import path from "node:path";

import { FrictionFailure } from "../domain/failures.js";
import {
  commitStagedFile,
  discardStagedFile,
  stageFileReplacement,
} from "../platform/atomic-file.js";
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

  const temporaryPath = await stageFileReplacement(
    plan.targetPath,
    plan.desiredBytes,
    plan.snapshot.mode ?? 0o644,
  );

  try {
    await commitStagedFile({
      temporaryPath,
      targetPath: plan.targetPath,
      targetExists: plan.snapshot.exists,
      conflictCode: "publish_conflict",
      assertUnchanged: async () => {
        await rejectSymlinkedPublishParents(plan.root, plan.targetPath);
        const current = await inspectPublishTarget(plan.root, plan.targetPath);

        if (!samePublishSnapshot(current, plan.snapshot)) {
          throw new FrictionFailure("publish_conflict");
        }
      },
    });
  } catch (error) {
    if (error instanceof FrictionFailure) {
      throw error;
    }

    throw new FrictionFailure("io_error");
  } finally {
    await discardStagedFile(temporaryPath);
  }
}
