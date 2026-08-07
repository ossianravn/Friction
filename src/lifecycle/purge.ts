import { lstat, readFile, unlink } from "node:fs/promises";
import path from "node:path";

import { FrictionFailure } from "../domain/failures.js";
import {
  loadEvents,
  type LoadedEvent,
  type LoadEventsResult,
} from "../storage/load-events.js";
import { resolveFrictionPaths } from "../storage/paths.js";
import { foldEvents, type FoldResult } from "./fold.js";

export type PurgeReceipt = {
  observationId: string;
  eventCount: number;
  applied: boolean;
};

function matchingEvents(
  events: readonly LoadedEvent[],
  observationId: string,
): LoadedEvent[] {
  return events.filter((entry) => entry.event.observationId === observationId);
}

function hasMatchingFinding(
  loaded: LoadEventsResult,
  folded: FoldResult,
  observationId: string,
  matches: readonly LoadedEvent[],
): boolean {
  const matchingFiles = new Set(matches.map((entry) => entry.fileName));
  return (
    loaded.findings.some(
      (finding) =>
        finding.observationId === observationId || matchingFiles.has(finding.fileName),
    ) ||
    folded.findings.some((finding) => finding.observationId === observationId)
  );
}

async function assertUnchanged(
  eventsDirectory: string,
  expected: readonly LoadedEvent[],
): Promise<void> {
  for (const entry of expected) {
    const eventPath = path.join(eventsDirectory, entry.fileName);
    let status;
    let bytes;

    try {
      status = await lstat(eventPath);
      bytes = await readFile(eventPath);
    } catch {
      throw new FrictionFailure("output_conflict");
    }

    if (
      status.isSymbolicLink() ||
      !status.isFile() ||
      !bytes.equals(entry.bytes)
    ) {
      throw new FrictionFailure("output_conflict");
    }
  }
}

export async function purgeObservation(
  observationId: string,
  apply: boolean,
): Promise<PurgeReceipt> {
  if (!/^fr_[0-9a-f]{32}$/.test(observationId)) {
    throw new FrictionFailure("invalid_input");
  }

  const paths = resolveFrictionPaths();
  const loaded = await loadEvents(paths);
  const folded = foldEvents(loaded.events.map((entry) => entry.event));
  const matches = matchingEvents(loaded.events, observationId);

  if (hasMatchingFinding(loaded, folded, observationId, matches)) {
    throw new FrictionFailure("corrupt_store");
  }

  const record = folded.records.find(
    (candidate) => candidate.observation.observationId === observationId,
  );

  if (record === undefined) {
    throw new FrictionFailure("not_found");
  }

  if (apply) {
    const current = await loadEvents(paths);
    const currentFolded = foldEvents(current.events.map((entry) => entry.event));
    const currentMatches = matchingEvents(current.events, observationId);

    if (
      hasMatchingFinding(current, currentFolded, observationId, currentMatches) ||
      currentMatches.length !== matches.length ||
      currentMatches.some((entry, index) => {
        const expected = matches[index];
        return expected === undefined ||
          entry.fileName !== expected.fileName ||
          !entry.bytes.equals(expected.bytes);
      })
    ) {
      throw new FrictionFailure("output_conflict");
    }

    await assertUnchanged(paths.events, currentMatches);

    try {
      for (const entry of currentMatches) {
        await unlink(path.join(paths.events, entry.fileName));
      }
    } catch {
      throw new FrictionFailure("io_error");
    }
  }

  return {
    observationId,
    eventCount: matches.length,
    applied: apply,
  };
}
