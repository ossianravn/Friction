import { FrictionFailure } from "../domain/failures.js";
import { inspectSetupFile, sameSnapshot } from "./files.js";
import type {
  CodexInstructionPrecondition,
  FileSnapshot,
  SetupPrecondition,
} from "./types.js";

export function activeCodexInstructionPath(
  overridePath: string,
  overrideSnapshot: FileSnapshot,
  agentsPath: string,
): string {
  return overrideSnapshot.exists &&
    overrideSnapshot.bytes.toString("utf8").trim().length > 0
    ? overridePath
    : agentsPath;
}

async function assertCodexInstructionPrecondition(
  precondition: CodexInstructionPrecondition,
): Promise<void> {
  const overrideSnapshot = await inspectSetupFile(
    precondition.scopeRoot,
    precondition.overridePath,
  );
  const agentsSnapshot = await inspectSetupFile(
    precondition.scopeRoot,
    precondition.agentsPath,
  );

  if (
    !sameSnapshot(overrideSnapshot, precondition.overrideSnapshot) ||
    !sameSnapshot(agentsSnapshot, precondition.agentsSnapshot) ||
    activeCodexInstructionPath(
      precondition.overridePath,
      overrideSnapshot,
      precondition.agentsPath,
    ) !== precondition.selectedPath
  ) {
    throw new FrictionFailure("setup_conflict");
  }
}

export async function assertSetupPreconditions(
  preconditions: readonly SetupPrecondition[],
): Promise<void> {
  for (const precondition of preconditions) {
    await assertCodexInstructionPrecondition(precondition);
  }
}
