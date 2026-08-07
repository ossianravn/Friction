import { createHash, randomUUID } from "node:crypto";
import { link, mkdir, open, rename, unlink } from "node:fs/promises";
import path from "node:path";

import { FrictionFailure } from "../domain/failures.js";
import { redact } from "../security/redact.js";
import {
  rejectUnsafeStoreDirectory,
  resolveFrictionPaths,
} from "../storage/paths.js";
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
  const versionRoot = path.join(paths.home, "v1");
  const lockRoot = path.join(versionRoot, "setup-locks");
  await rejectUnsafeStoreDirectory(paths.home);
  await mkdir(paths.home, { recursive: true, mode: 0o700 });
  await rejectUnsafeStoreDirectory(paths.home);
  await rejectUnsafeStoreDirectory(versionRoot);
  await mkdir(versionRoot, { recursive: true, mode: 0o700 });
  await rejectUnsafeStoreDirectory(versionRoot);
  await rejectUnsafeStoreDirectory(lockRoot);
  await mkdir(lockRoot, { recursive: true, mode: 0o700 });
  await rejectUnsafeStoreDirectory(lockRoot);
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
      return {
        release: async () => {
          await handle.close().catch(() => undefined);
          await unlink(lockPath).catch(() => undefined);
        },
      };
    } catch (error) {
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

  const parent = path.dirname(target.path);
  await assertSetupRoot(target.scopeRoot);
  const current = await inspectSetupFile(target.scopeRoot, target.path);

  if (!sameSnapshot(current, target.snapshot)) {
    throw new FrictionFailure("setup_conflict");
  }

  const temporaryPath = path.join(parent, `.friction-${randomUUID().replaceAll("-", "")}.tmp`);
  const mode = target.snapshot.mode ?? (plan.scope === "user" ? 0o600 : 0o644);
  const handle = await open(temporaryPath, "wx", mode);

  try {
    await handle.chmod(mode);
    await handle.writeFile(target.desiredBytes);
    await handle.sync();
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  } finally {
    await handle.close();
  }

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

  if (!target.snapshot.exists) {
    try {
      await link(temporaryPath, target.path);
    } catch (error) {
      if (isCode(error, "EEXIST")) {
        throw new FrictionFailure("setup_conflict");
      }

      throw error;
    }
  } else {
    await rename(temporaryPath, target.path);
  }
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

    const orderedTargets = [...plan.targets].sort((left, right) =>
      compareSetupPaths(left.path, right.path),
    );

    for (const target of orderedTargets) {
      staged.push(await stageTarget(plan, target));
    }

    await assertCurrent(plan);

    for (const target of staged) {
      if (
        target.target.kind === "managed-block" &&
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
        await unlink(target.temporaryPath).catch(() => undefined);
      }
    }

    if (committedCount === 0) {
      await removeSetupDirectories(createdDirectories);
    }

    await lock.release();
  }
}
