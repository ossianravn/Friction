import { FrictionFailure } from "../domain/failures.js";
import { inspectSetupFile, sameSnapshot } from "./files.js";
import type {
  FileSnapshot,
  FileSnapshotsPrecondition,
} from "./types.js";

export function firstNonemptyPath(
  files: readonly { path: string; snapshot: FileSnapshot }[],
  fallbackPath: string,
): string {
  return files.find(({ snapshot }) =>
    snapshot.exists && snapshot.bytes.toString("utf8").trim().length > 0
  )?.path ?? fallbackPath;
}

async function assertFileSnapshots(
  precondition: FileSnapshotsPrecondition,
): Promise<void> {
  for (const file of precondition.files) {
    const current = await inspectSetupFile(precondition.scopeRoot, file.path);

    if (!sameSnapshot(current, file.snapshot)) {
      throw new FrictionFailure("setup_conflict");
    }
  }
}

export async function assertSetupPreconditions(
  preconditions: readonly FileSnapshotsPrecondition[],
): Promise<void> {
  for (const precondition of preconditions) {
    await assertFileSnapshots(precondition);
  }
}
