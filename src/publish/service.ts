import path from "node:path";

import { FrictionFailure } from "../domain/failures.js";
import { compareText } from "../domain/sort.js";
import { foldEvents } from "../lifecycle/fold.js";
import { discoverRepository } from "../repository/discover.js";
import { requireWorktreeRoot } from "../repository/worktree.js";
import { loadEvents } from "../storage/load-events.js";
import { resolveFrictionPaths } from "../storage/paths.js";
import { toPublishedObservation } from "./projection.js";
import { inspectPublishTarget } from "./target.js";
import type { PublishedObservation, PublishPlan } from "./types.js";

export type PublishInput = {
  ids: string[];
  allOpen: boolean;
  output: string | undefined;
};

export type PublishData = {
  action: "preview" | "apply";
  state: "create" | "update" | "noop";
  target: string;
  selectedIds: string[];
  selected: Array<{
    observationId: string;
    createdAt: string;
    status: "open" | "resolved";
    summary: string;
  }>;
  creates: number;
  updates: number;
  unchanged: number;
  recordCount: number;
};

function validateSelection(input: PublishInput): void {
  if (input.allOpen === (input.ids.length > 0)) {
    throw new FrictionFailure("invalid_input");
  }

  if (
    input.ids.some((id) => !/^fr_[0-9a-f]{32}$/.test(id)) ||
    new Set(input.ids).size !== input.ids.length
  ) {
    throw new FrictionFailure("invalid_input");
  }
}

function render(records: readonly PublishedObservation[]): Buffer {
  const sorted = [...records].sort(
    (left, right) =>
      compareText(left.createdAt, right.createdAt) ||
      compareText(left.observationId, right.observationId),
  );
  return Buffer.from(
    sorted.length === 0
      ? ""
      : `${sorted.map((record) => JSON.stringify(record)).join("\n")}\n`,
    "utf8",
  );
}

function equal(left: PublishedObservation, right: PublishedObservation): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function summary(body: string): string {
  const oneLine = body.replaceAll(/\s+/g, " ").trim();
  const characters = Array.from(oneLine);
  return characters.length <= 120 ? oneLine : `${characters.slice(0, 117).join("")}...`;
}

export async function buildPublishPlan(
  input: PublishInput,
  cwd: string = process.cwd(),
): Promise<PublishPlan> {
  validateSelection(input);
  const root = await requireWorktreeRoot(cwd);
  const repository = await discoverRepository(cwd);

  if (repository.state !== "repository") {
    throw new FrictionFailure("not_found");
  }

  const loaded = await loadEvents(resolveFrictionPaths());
  const folded = foldEvents(loaded.events.map((entry) => entry.event));

  if (loaded.findings.length > 0 || folded.findings.length > 0) {
    throw new FrictionFailure("corrupt_store");
  }

  const matching = folded.records.filter(
    (record) => record.observation.repository?.key === repository.context.key,
  );
  const byId = new Map(matching.map((record) => [record.observation.observationId, record]));
  const selectedRecords = input.allOpen
    ? matching.filter((record) => record.status === "open")
    : input.ids.map((id) => {
        const record = byId.get(id);

        if (record === undefined) {
          throw new FrictionFailure("not_found");
        }

        return record;
      });
  const selected = selectedRecords.map(toPublishedObservation);
  const targetPath = path.resolve(root, input.output ?? ".friction/observations.jsonl");
  const snapshot = await inspectPublishTarget(root, targetPath);
  const merged = new Map(snapshot.records.map((record) => [record.observationId, record]));
  let creates = 0;
  let updates = 0;
  let unchanged = 0;

  for (const record of selected) {
    const existing = merged.get(record.observationId);

    if (existing === undefined) {
      creates += 1;
    } else if (equal(existing, record)) {
      unchanged += 1;
    } else {
      updates += 1;
    }

    merged.set(record.observationId, record);
  }

  return {
    root,
    targetPath,
    snapshot,
    desiredBytes: render([...merged.values()]),
    selected,
    creates,
    updates,
    unchanged,
  };
}

export function publishData(plan: PublishPlan, applied: boolean): PublishData {
  return {
    action: applied ? "apply" : "preview",
    state: plan.snapshot.bytes.equals(plan.desiredBytes)
      ? "noop"
      : plan.snapshot.exists
        ? "update"
        : "create",
    target: path.relative(plan.root, plan.targetPath).split(path.sep).join("/"),
    selectedIds: plan.selected.map((record) => record.observationId),
    selected: plan.selected.map((record) => ({
      observationId: record.observationId,
      createdAt: record.createdAt,
      status: record.status,
      summary: summary(record.body),
    })),
    creates: plan.creates,
    updates: plan.updates,
    unchanged: plan.unchanged,
    recordCount: new Set([
      ...plan.snapshot.records.map((record) => record.observationId),
      ...plan.selected.map((record) => record.observationId),
    ]).size,
  };
}
