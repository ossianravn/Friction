import { FrictionFailure } from "../domain/failures.js";
import { inspectSetupFile, setupFileDigest } from "./files.js";
import { knownManagedDigests } from "./managed-assets.js";
import { applyManagedBlock, removeManagedBlock } from "./managed-block.js";
import type { FileSnapshot, MutationState, SetupTarget } from "./types.js";

function equal(left: Buffer, right: Buffer): boolean {
  return left.equals(right);
}

export async function planOwnedFile(
  assetId: string,
  scopeRoot: string,
  targetPath: string,
  desired: Buffer,
  undo: boolean,
): Promise<SetupTarget> {
  const snapshot = await inspectSetupFile(scopeRoot, targetPath);
  const desiredDigest = setupFileDigest(desired);
  const knownDigests = knownManagedDigests(assetId);

  if (!knownDigests.includes(desiredDigest)) {
    throw new FrictionFailure("internal_error");
  }

  return {
    scopeRoot,
    path: targetPath,
    kind: "owned-file",
    snapshot,
    desiredBytes: undo ? null : desired,
    state: ownedFileState(snapshot.digest, desiredDigest, knownDigests, undo),
  };
}

export function ownedFileState(
  existingDigest: string | null,
  desiredDigest: string,
  knownDigests: readonly string[],
  undo: boolean,
): MutationState {
  if (existingDigest === null) {
    return undo ? "noop" : "create";
  }

  if (existingDigest === desiredDigest) {
    return undo ? "remove" : "noop";
  }

  if (!knownDigests.includes(existingDigest)) {
    return "conflict";
  }

  return undo ? "remove" : "update";
}

export async function planManagedBlock(
  scopeRoot: string,
  targetPath: string,
  content: Buffer,
  undo: boolean,
  knownSnapshot?: FileSnapshot,
): Promise<SetupTarget> {
  const snapshot = knownSnapshot ?? await inspectSetupFile(scopeRoot, targetPath);

  try {
    if (undo) {
      const desired = removeManagedBlock(snapshot.bytes);

      if (desired === null) {
        return { scopeRoot, path: targetPath, kind: "managed-block", snapshot, desiredBytes: null, state: "noop" };
      }

      return {
        scopeRoot,
        path: targetPath,
        kind: "managed-block",
        snapshot,
        desiredBytes: desired.length === 0 ? null : desired,
        state: desired.length === 0 ? "remove" : "update",
      };
    }

    const desired = applyManagedBlock(snapshot.bytes, content);
    return {
      scopeRoot,
      path: targetPath,
      kind: "managed-block",
      snapshot,
      desiredBytes: desired,
      state: !snapshot.exists
        ? "create"
        : equal(snapshot.bytes, desired)
          ? "noop"
          : "update",
    };
  } catch (error) {
    if (error instanceof FrictionFailure) {
      return { scopeRoot, path: targetPath, kind: "managed-block", snapshot, desiredBytes: null, state: "conflict" };
    }

    throw error;
  }
}
