import { FrictionFailure } from "../domain/failures.js";
import { inspectSetupFile } from "./files.js";
import { applyManagedBlock, removeManagedBlock } from "./managed-block.js";
import type { SetupTarget } from "./types.js";

function equal(left: Buffer, right: Buffer): boolean {
  return left.equals(right);
}

export async function planOwnedFile(
  scopeRoot: string,
  targetPath: string,
  desired: Buffer,
  undo: boolean,
): Promise<SetupTarget> {
  const snapshot = await inspectSetupFile(scopeRoot, targetPath);

  if (undo) {
    if (!snapshot.exists) {
      return { path: targetPath, kind: "owned-file", snapshot, desiredBytes: null, state: "noop" };
    }

    if (!equal(snapshot.bytes, desired)) {
      return { path: targetPath, kind: "owned-file", snapshot, desiredBytes: null, state: "conflict" };
    }

    return { path: targetPath, kind: "owned-file", snapshot, desiredBytes: null, state: "remove" };
  }

  if (!snapshot.exists) {
    return { path: targetPath, kind: "owned-file", snapshot, desiredBytes: desired, state: "create" };
  }

  return {
    path: targetPath,
    kind: "owned-file",
    snapshot,
    desiredBytes: desired,
    state: equal(snapshot.bytes, desired) ? "noop" : "conflict",
  };
}

export async function planManagedBlock(
  scopeRoot: string,
  targetPath: string,
  content: Buffer,
  undo: boolean,
): Promise<SetupTarget> {
  const snapshot = await inspectSetupFile(scopeRoot, targetPath);

  try {
    if (undo) {
      const desired = removeManagedBlock(snapshot.bytes);

      if (desired === null) {
        return { path: targetPath, kind: "managed-block", snapshot, desiredBytes: null, state: "noop" };
      }

      return {
        path: targetPath,
        kind: "managed-block",
        snapshot,
        desiredBytes: desired.length === 0 ? null : desired,
        state: desired.length === 0 ? "remove" : "update",
      };
    }

    const desired = applyManagedBlock(snapshot.bytes, content);
    return {
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
      return { path: targetPath, kind: "managed-block", snapshot, desiredBytes: null, state: "conflict" };
    }

    throw error;
  }
}
