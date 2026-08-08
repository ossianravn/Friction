import { createHash } from "node:crypto";
import { open, unlink } from "node:fs/promises";
import path from "node:path";

import { FrictionFailure } from "../domain/failures.js";
import {
  commitStagedFile,
  discardStagedFile,
  stageFileReplacement,
} from "../platform/atomic-file.js";
import { redact } from "../security/redact.js";
import { resolveFrictionPaths } from "../storage/paths.js";
import {
  ensureSetupLockStore,
  verifyPrivateStoreFile,
} from "../storage/private-store.js";
import {
  compareSetupPaths,
  createSetupDirectories,
  plannedSetupDirectories,
  removeSetupDirectories,
} from "./directories.js";
import {
  assertSetupRoot,
  inspectSetupFile,
  sameSnapshot,
} from "./files.js";
import { assertSetupPreconditions } from "./preconditions.js";
import type { SetupPlan, SetupTarget } from "./types.js";

type StagedTarget = {
  target: SetupTarget;
  temporaryPath: string | null;
};

function isCode(error: unknown, code: string): boolean {
  return error !== null && typeof error === "object" && "code" in error && error.code === code;
}

async function acquireLock(plan: SetupPlan): Promise<{
  release(): Promise<void>;
}> {
  const paths = resolveFrictionPaths();
  const lockRoot = paths.setupLocks;
  await ensureSetupLockStore(paths);
  const lockIdentity = JSON.stringify({
    harness: plan.harness,
    scope: plan.scope,
    roots: [...new Set(plan.lockRoots)].sort().map((root) => redact(root).text),
  });
  const key = createHash("sha256").update(lockIdentity).digest("hex");
  const lockPath = path.join(lockRoot, `${key}.lock`);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const handle = await open(lockPath, "wx", 0o600);

      try {
        await verifyPrivateStoreFile(lockPath);
      } catch (error) {
        await handle.close().catch(() => undefined);
        await unlink(lockPath).catch(() => undefined);
        throw error;
      }

      return {
        release: async () => {
          await handle.close().catch(() => undefined);
          await unlink(lockPath).catch(() => undefined);
        },
      };
    } catch (error) {
      if (error instanceof FrictionFailure) {
        throw error;
      }

      if (!isCode(error, "EEXIST")) {
        throw new FrictionFailure("io_error");
      }

      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  throw new FrictionFailure("io_error");
}

async function assertCurrent(plan: SetupPlan): Promise<void> {
  for (const root of plan.lockRoots) {
    await assertSetupRoot(root);
  }

  for (const target of plan.targets) {
    const current = await inspectSetupFile(target.scopeRoot, target.path);

    if (!sameSnapshot(current, target.snapshot)) {
      throw new FrictionFailure("setup_conflict");
    }
  }

  await assertSetupPreconditions(plan.preconditions);
}

async function stageTarget(
  plan: SetupPlan,
  target: SetupTarget,
): Promise<StagedTarget> {
  if (target.state === "noop" || target.desiredBytes === null) {
    return { target, temporaryPath: null };
  }

  await assertSetupRoot(target.scopeRoot);
  const current = await inspectSetupFile(target.scopeRoot, target.path);

  if (!sameSnapshot(current, target.snapshot)) {
    throw new FrictionFailure("setup_conflict");
  }

  const mode = target.snapshot.mode ?? (plan.scope === "user" ? 0o600 : 0o644);
  const temporaryPath = await stageFileReplacement(
    target.path,
    target.desiredBytes,
    mode,
  );

  return { target, temporaryPath };
}

async function commitTarget(plan: SetupPlan, staged: StagedTarget): Promise<void> {
  const { target, temporaryPath } = staged;

  if (target.state === "noop") {
    return;
  }

  await assertSetupRoot(target.scopeRoot);
  const current = await inspectSetupFile(target.scopeRoot, target.path);

  if (!sameSnapshot(current, target.snapshot)) {
    throw new FrictionFailure("setup_conflict");
  }

  if (target.desiredBytes === null) {
    await unlink(target.path);
    return;
  }

  if (temporaryPath === null) {
    throw new FrictionFailure("internal_error");
  }

  await commitStagedFile({
    temporaryPath,
    targetPath: target.path,
    targetExists: target.snapshot.exists,
    conflictCode: "setup_conflict",
    assertUnchanged: async () => {
      await assertSetupRoot(target.scopeRoot);
      const latest = await inspectSetupFile(target.scopeRoot, target.path);

      if (!sameSnapshot(latest, target.snapshot)) {
        throw new FrictionFailure("setup_conflict");
      }
    },
  });
}

export async function applySetupPlan(plan: SetupPlan): Promise<void> {
  if (plan.targets.some((target) => target.state === "conflict")) {
    throw new FrictionFailure("setup_conflict");
  }

  const lock = await acquireLock(plan);
  const staged: StagedTarget[] = [];
  const createdDirectories: string[] = [];
  let committedCount = 0;
  let instructionPreconditionsChecked = false;

  try {
    await assertCurrent(plan);
    const directories = await plannedSetupDirectories(plan);
    await assertCurrent(plan);
    await createSetupDirectories(
      directories,
      plan.scope === "user" ? 0o700 : 0o755,
      createdDirectories,
    );

    const orderedTargets = [...plan.targets].sort((left, right) => {
      const leftOrder = left.kind === "managed-block" ? 0 : 1;
      const rightOrder = right.kind === "managed-block" ? 0 : 1;
      return leftOrder - rightOrder || compareSetupPaths(left.path, right.path);
    });

    for (const target of orderedTargets) {
      staged.push(await stageTarget(plan, target));
    }

    await assertCurrent(plan);

    for (const target of staged) {
      if (
        target.target.state !== "noop" &&
        !instructionPreconditionsChecked
      ) {
        await assertSetupPreconditions(plan.preconditions);
        instructionPreconditionsChecked = true;
      }

      await commitTarget(plan, target);

      if (target.target.state !== "noop") {
        committedCount += 1;
      }
    }
  } catch (error) {
    if (error instanceof FrictionFailure) {
      throw error;
    }

    throw new FrictionFailure("io_error");
  } finally {
    for (const target of staged) {
      if (target.temporaryPath !== null) {
        await discardStagedFile(target.temporaryPath);
      }
    }

    if (committedCount === 0) {
      await removeSetupDirectories(createdDirectories);
    }

    await lock.release();
  }
}
