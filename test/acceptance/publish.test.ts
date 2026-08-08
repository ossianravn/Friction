import assert from "node:assert/strict";
import {
  appendFile,
  chmod,
  mkdir,
  readFile,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { FrictionFailure } from "../../src/domain/failures.js";
import { applyPublishPlan } from "../../src/publish/apply.js";
import { buildPublishPlan } from "../../src/publish/service.js";
import {
  addObservation,
  envelope,
  eventNames,
  makeAcceptanceFixture,
} from "../support/acceptance.js";
import { runFriction, runGit } from "../support/process.js";

async function initializeRepository(repository: string): Promise<void> {
  await mkdir(repository, { recursive: true });
  await runGit(repository, ["init", "--quiet", "--initial-branch=main"]);
}

test("publish is preview-first, deterministic, scoped, merge-safe, and preimage-safe", async () => {
  const context = await makeAcceptanceFixture("friction-publish-");
  const repository = path.join(context.root, "repository");
  await initializeRepository(repository);
  const canary = "publish-secret-canary";
  const firstId = await addObservation(
    context.home,
    repository,
    `api_token=${canary} while a stale guide caused a retry.`,
  );
  const secondId = await addObservation(
    context.home,
    repository,
    "A misleading success result caused plausible false evidence.",
  );
  const privateEventsBefore = await eventNames(context.home);
  const target = path.join(repository, ".friction", "observations.jsonl");

  const previewResult = await runFriction({
    arguments: ["publish", firstId, secondId, "--json"],
    cwd: repository,
    home: context.home,
  });
  assert.equal(previewResult.code, 0);
  const preview = envelope(previewResult).data;
  assert.equal(preview["action"], "preview");
  assert.equal(preview["state"], "create");
  assert.equal(preview["target"], ".friction/observations.jsonl");
  assert.equal(previewResult.stdout.includes(canary), false);
  await assert.rejects(stat(path.dirname(target)));

  const applyResult = await runFriction({
    arguments: ["publish", firstId, secondId, "--apply", "--json"],
    cwd: repository,
    home: context.home,
  });
  assert.equal(applyResult.code, 0);
  const firstBytes = await readFile(target);
  assert.equal(firstBytes.includes(Buffer.from(canary)), false);
  assert.equal(firstBytes.at(-1), 10);
  if (process.platform !== "win32") {
    assert.equal((await stat(target)).mode & 0o777, 0o644);
  }
  const records = firstBytes
    .toString("utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as Record<string, unknown>);
  assert.equal(records.length, 2);
  assert.deepEqual(Object.keys(records[0]!), [
    "schemaVersion",
    "observationId",
    "createdAt",
    "status",
    "body",
    "source",
    "model",
    "area",
    "impacts",
    "repository",
    "resolution",
    "redactionCount",
  ]);
  assert.equal(firstBytes.includes(Buffer.from('"key"')), false);
  assert.equal(firstBytes.includes(Buffer.from('"head"')), false);
  assert.deepEqual(await eventNames(context.home), privateEventsBefore);

  const repeated = envelope(
    await runFriction({
      arguments: ["publish", firstId, secondId, "--apply", "--json"],
      cwd: repository,
      home: context.home,
    }),
  );
  assert.equal(repeated.data["state"], "noop");
  assert.equal((await readFile(target)).equals(firstBytes), true);

  if (process.platform !== "win32") {
    await chmod(target, 0o666);
  }
  const resolved = await runFriction({
    arguments: [
      "resolve",
      firstId,
      "--verification",
      "Rechecked the original path.",
      "--json",
    ],
    cwd: repository,
    home: context.home,
  });
  assert.equal(resolved.code, 0);
  const update = await runFriction({
    arguments: ["publish", firstId, "--apply", "--json"],
    cwd: repository,
    home: context.home,
  });
  assert.equal(update.code, 0);
  assert.equal(envelope(update).data["updates"], 1);
  const updatedLines = (await readFile(target, "utf8")).trim().split("\n");
  assert.equal(updatedLines.length, 2);
  assert.equal(
    updatedLines.map((line) => JSON.parse(line)).find((item) => item.observationId === firstId).status,
    "resolved",
  );
  if (process.platform !== "win32") {
    assert.equal((await stat(target)).mode & 0o777, 0o666);
  }

  const otherRepository = path.join(context.root, "other-repository");
  await initializeRepository(otherRepository);
  const otherId = await addObservation(
    context.home,
    otherRepository,
    "A different repository had unrelated friction.",
  );
  const mismatch = await runFriction({
    arguments: ["publish", otherId, "--json"],
    cwd: repository,
    home: context.home,
  });
  assert.equal(mismatch.code, 3);

  const outside = path.join(context.root, "outside");
  await mkdir(outside);
  await symlink(
    outside,
    path.join(repository, "linked-output"),
    process.platform === "win32" ? "junction" : "dir",
  );
  const escape = await runFriction({
    arguments: ["publish", secondId, "--output", "linked-output/data.jsonl", "--json"],
    cwd: repository,
    home: context.home,
  });
  assert.equal(escape.code, 4);
  await assert.rejects(stat(path.join(outside, "data.jsonl")));

  const priorHome = process.env["FRICTION_HOME"];
  process.env["FRICTION_HOME"] = context.home;

  try {
    const secondResolution = await runFriction({
      arguments: ["resolve", secondId, "--json"],
      cwd: repository,
      home: context.home,
    });
    assert.equal(secondResolution.code, 0);
    const plan = await buildPublishPlan({ ids: [secondId], allOpen: false, output: undefined }, repository);
    await appendFile(target, "\n");
    const changed = await readFile(target);
    await assert.rejects(
      applyPublishPlan(plan),
      (error) => error instanceof FrictionFailure && error.code === "publish_conflict",
    );
    assert.equal((await readFile(target)).equals(changed), true);
  } finally {
    if (priorHome === undefined) {
      delete process.env["FRICTION_HOME"];
    } else {
      process.env["FRICTION_HOME"] = priorHome;
    }
  }

  await writeFile(target, "{malformed\n");
  const malformed = await runFriction({
    arguments: ["publish", secondId, "--apply", "--json"],
    cwd: repository,
    home: context.home,
  });
  assert.equal(malformed.code, 4);
  assert.equal(await readFile(target, "utf8"), "{malformed\n");
});
