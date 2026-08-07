import assert from "node:assert/strict";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  addObservation,
  envelope,
  eventNames,
  makeAcceptanceFixture,
} from "../support/acceptance.js";
import { runFriction, runGit } from "../support/process.js";

test("export writes screened projections safely and purge previews before deleting private history", async () => {
  const context = await makeAcceptanceFixture("friction-export-");
  const repository = path.join(context.work, "repo-<b>[x]");
  const nested = path.join(repository, "nested");
  await mkdir(nested, { recursive: true });
  await runGit(repository, ["init", "--initial-branch=main"]);
  await runGit(repository, ["config", "user.name", "Friction Test"]);
  await runGit(repository, ["config", "user.email", "friction@example.invalid"]);
  await writeFile(path.join(repository, "tracked.txt"), "tracked\n", "utf8");
  await runGit(repository, ["add", "tracked.txt"]);
  await runGit(repository, ["commit", "-m", "fixture"]);
  const body = "A ``` marker broke an earlier Markdown fence and caused a retry.";
  const observationId = await addObservation(context.home, nested, body);
  await runFriction({
    arguments: ["resolve", observationId, "--verification", "Rendered export inspected.", "--json"],
    cwd: nested,
    home: context.home,
  });

  const markdownResult = envelope(
    await runFriction({
      arguments: ["export", "--status", "all", "--json"],
      cwd: nested,
      home: context.home,
    }),
  );
  const markdown = markdownResult.data["markdown"] as string;
  assert.equal(markdown.includes(body), true);
  assert.equal(markdown.includes("````\n"), true);
  assert.equal(markdown.includes(repository), false);
  assert.equal(markdown.includes("Scope: `repo-<b>[x]`"), true);
  assert.equal(markdown.includes("Repository: `repo-<b>[x]:nested`"), true);
  assert.equal(markdown.includes("Scope: repo-<b>[x]"), false);

  const output = path.join(context.root, "private-export.jsonl");
  const fileResult = await runFriction({
    arguments: [
      "export",
      "--status",
      "all",
      "--format",
      "jsonl",
      "--output",
      output,
      "--json",
    ],
    cwd: nested,
    home: context.home,
  });
  assert.equal(fileResult.code, 0);
  assert.equal((await stat(output)).mode & 0o777, 0o600);
  const exportedBytes = await readFile(output, "utf8");
  assert.equal(exportedBytes.includes(body), true);

  const unrelatedId = await addObservation(
    context.home,
    nested,
    "An unrelated record remains available after targeted purge.",
  );
  const unrelatedFile = (
    await Promise.all(
      (await eventNames(context.home)).map(async (name) => ({
        name,
        event: JSON.parse(
          await readFile(path.join(context.home, "v1", "events", name), "utf8"),
        ) as Record<string, unknown>,
      })),
    )
  ).find((entry) => entry.event["observationId"] === unrelatedId)!;
  unrelatedFile.event["legacyExtra"] = true;
  await writeFile(
    path.join(context.home, "v1", "events", unrelatedFile.name),
    `${JSON.stringify(unrelatedFile.event, null, 2)}\n`,
  );

  const beforePreview = await Promise.all(
    (await eventNames(context.home)).sort().map(async (name) => ({
      name,
      bytes: await readFile(path.join(context.home, "v1", "events", name), "utf8"),
    })),
  );
  const preview = envelope(
    await runFriction({
      arguments: ["purge", observationId, "--json"],
      cwd: nested,
      home: context.home,
    }),
  );
  assert.equal(preview.data["applied"], false);
  assert.equal(preview.data["eventCount"], 2);
  assert.deepEqual(
    await Promise.all(
      (await eventNames(context.home)).sort().map(async (name) => ({
        name,
        bytes: await readFile(path.join(context.home, "v1", "events", name), "utf8"),
      })),
    ),
    beforePreview,
  );

  const applied = envelope(
    await runFriction({
      arguments: ["purge", observationId, "--apply", "--json"],
      cwd: nested,
      home: context.home,
    }),
  );
  assert.equal(applied.data["applied"], true);
  const remaining = await eventNames(context.home);
  assert.deepEqual(remaining, [unrelatedFile.name]);
  assert.equal(
    JSON.parse(
      await readFile(path.join(context.home, "v1", "events", remaining[0]!), "utf8"),
    ).observationId,
    unrelatedId,
  );
  assert.equal(await readFile(output, "utf8"), exportedBytes);
});
