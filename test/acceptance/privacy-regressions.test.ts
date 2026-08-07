import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  addObservation,
  envelope,
  eventNames,
  makeAcceptanceFixture,
} from "../support/acceptance.js";
import { runFriction, runGit } from "../support/process.js";

type EditableEvent = Record<string, unknown> & {
  eventType: string;
  body?: string;
  model?: string | null;
  repository?: Record<string, unknown> | null;
  note?: string | null;
  verification?: string | null;
  redaction?: { rulesetVersion: number; replacementCount: number };
};

test("loaded legacy event text is re-screened before every public view", async () => {
  const context = await makeAcceptanceFixture("friction-loaded-screening-");
  await runGit(context.work, ["init", "--quiet"]);
  const observationId = await addObservation(
    context.home,
    context.work,
    "A safe initial observation is later edited by a legacy writer.",
  );
  await runFriction({
    arguments: ["resolve", observationId, "--verification", "Initially safe.", "--json"],
    cwd: context.work,
    home: context.home,
  });
  const canaries = [
    "legacy-body-canary",
    "legacy-model-canary",
    "legacy-repository-canary",
    "xoxc-1234567890-legacybranchcanary",
    "legacy-cwd-canary",
    "legacy-note-canary",
    "legacy-private-key-canary",
  ];

  for (const name of await eventNames(context.home)) {
    const eventPath = path.join(context.home, "v1", "events", name);
    const event = JSON.parse(await readFile(eventPath, "utf8")) as EditableEvent;

    if (event["eventType"] === "observation") {
      const repository = event.repository;
      assert.ok(repository);
      event.body = `api_token=${canaries[0]}`;
      event.model = `MY_OPENAI_API_KEY=${canaries[1]}`;
      repository["name"] = `api_token=${canaries[2]}`;
      repository["branch"] = canaries[3];
      repository["cwdRelative"] = `password=${canaries[4]}`;
    } else {
      event.note = `Cookie: session=${canaries[5]}`;
      event.verification = [
        "-----BEGIN ENCRYPTED PRIVATE KEY-----",
        canaries[6],
        "-----END ENCRYPTED PRIVATE KEY-----",
      ].join("\n");
    }

    event.redaction = { rulesetVersion: 1, replacementCount: 0 };
    await writeFile(eventPath, `${JSON.stringify(event, null, 2)}\n`);
  }

  const commands = [
    ["list", "--status", "all", "--json"],
    ["stats", "--status", "all", "--json"],
    ["export", "--status", "all", "--format", "jsonl", "--json"],
    ["publish", observationId, "--json"],
    ["publish", observationId, "--apply", "--json"],
    ["doctor", "--json"],
  ];
  const outputs = [];

  for (const arguments_ of commands) {
    const result = await runFriction({
      arguments: arguments_,
      cwd: context.work,
      home: context.home,
    });
    assert.equal(result.code, 0);
    outputs.push(result.stdout, result.stderr);
  }

  const projection = await readFile(
    path.join(context.work, ".friction", "observations.jsonl"),
    "utf8",
  );
  const examined = `${outputs.join("\n")}\n${projection}`;

  for (const canary of canaries) {
    assert.equal(examined.includes(canary), false);
  }

  const list = envelope(
    await runFriction({
      arguments: ["list", "--status", "all", "--json"],
      cwd: context.work,
      home: context.home,
    }),
  ).data;
  const records = list["records"] as Array<Record<string, unknown>>;
  assert.equal(records.length, 1);
  const record = records[0];
  assert.ok(record);
  assert.equal(record["redactionCount"], 7);
  const stats = envelope(
    await runFriction({
      arguments: ["stats", "--status", "all", "--json"],
      cwd: context.work,
      home: context.home,
    }),
  ).data;
  assert.equal(stats["redactedRecordCount"], 1);
  assert.equal(stats["replacementCount"], 7);
});

test("redaction-sensitive local Git paths fail attribution instead of sharing a key", async () => {
  const context = await makeAcceptanceFixture("friction-local-identity-");
  const repositories = [
    path.join(context.root, "api_token=A", "repo"),
    path.join(context.root, "api_token=B", "repo"),
  ];

  for (const repository of repositories) {
    await mkdir(repository, { recursive: true });
    await runGit(repository, ["init", "--quiet"]);
    const result = await runFriction({
      arguments: ["add", "--stdin", "--json"],
      cwd: repository,
      home: context.home,
      stdin: "Local identity could not be retained safely.",
    });
    assert.equal(result.code, 0);
    assert.equal(envelope(result).warnings[0]?.["code"], "repository_unavailable");
  }

  const stored = await Promise.all(
    (await eventNames(context.home)).map(async (name) =>
      JSON.parse(
        await readFile(path.join(context.home, "v1", "events", name), "utf8"),
      ) as Record<string, unknown>,
    ),
  );
  assert.equal(stored.length, 2);
  assert.equal(stored.every((event) => event["repository"] === null), true);
  const bytes = JSON.stringify(stored);
  assert.equal(bytes.includes("api_token=A"), false);
  assert.equal(bytes.includes("api_token=B"), false);
});
