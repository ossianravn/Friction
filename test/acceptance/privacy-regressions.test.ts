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
  const unsafeBody = "Local identity could not be retained safely.";
  const safeBody = "A separate repository observation must not leak into default reads.";
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
      stdin: unsafeBody,
    });
    assert.equal(result.code, 0);
    assert.equal(envelope(result).warnings[0]?.["code"], "repository_unavailable");
  }

  const safeRepository = path.join(context.root, "safe-repository");
  await mkdir(safeRepository);
  await runGit(safeRepository, ["init", "--quiet"]);
  await addObservation(context.home, safeRepository, safeBody);

  const stored = await Promise.all(
    (await eventNames(context.home)).map(async (name) =>
      JSON.parse(
        await readFile(path.join(context.home, "v1", "events", name), "utf8"),
      ) as Record<string, unknown>,
    ),
  );
  assert.equal(stored.length, 3);
  assert.equal(
    stored.filter((event) => event["repository"] === null).length,
    2,
  );
  const bytes = JSON.stringify(stored);
  assert.equal(bytes.includes("api_token=A"), false);
  assert.equal(bytes.includes("api_token=B"), false);

  const implicitReads = [
    ["list", "--status", "all", "--json"],
    ["stats", "--status", "all", "--json"],
    ["export", "--status", "all", "--format", "jsonl", "--json"],
  ];

  for (const arguments_ of implicitReads) {
    const result = await runFriction({
      arguments: arguments_,
      cwd: repositories[0]!,
      home: context.home,
    });
    assert.equal(result.code, 3);
    assert.equal(`${result.stdout}${result.stderr}`.includes(safeBody), false);
    assert.equal(`${result.stdout}${result.stderr}`.includes(unsafeBody), false);
  }

  const failedGitBody = "Capture remains safe when Git command setup is invalid.";
  const failedGitEnvironment = {
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "broken",
    GIT_CONFIG_VALUE_0: "value",
  };

  for (const arguments_ of implicitReads) {
    const result = await runFriction({
      arguments: arguments_,
      cwd: safeRepository,
      environment: failedGitEnvironment,
      home: context.home,
    });
    assert.equal(result.code, 3);
    assert.equal(`${result.stdout}${result.stderr}`.includes(safeBody), false);
    assert.equal(`${result.stdout}${result.stderr}`.includes(unsafeBody), false);
  }

  const failedGitCapture = await runFriction({
    arguments: ["add", "--stdin", "--json"],
    cwd: safeRepository,
    environment: failedGitEnvironment,
    home: context.home,
    stdin: failedGitBody,
  });
  assert.equal(failedGitCapture.code, 0);
  assert.equal(
    envelope(failedGitCapture).warnings[0]?.["code"],
    "repository_unavailable",
  );

  const failedRemoteBody = "A failed remote lookup must not change repository identity.";
  const failedRemoteRepository = path.join(context.root, "failed-remote");
  await mkdir(failedRemoteRepository);
  await runGit(failedRemoteRepository, ["init", "--quiet"]);
  await runGit(failedRemoteRepository, [
    "remote",
    "add",
    "origin",
    "https://example.com/owner/repository.git",
  ]);
  const originalPath = process.env["PATH"];
  assert.ok(originalPath);
  const fakeGitDirectory = path.join(context.root, "fake-git");
  await mkdir(fakeGitDirectory);
  await writeFile(
    path.join(fakeGitDirectory, "git"),
    [
      "#!/bin/sh",
      'if [ "$1" = "remote" ] && [ "$2" = "get-url" ]; then',
      "  exit 1",
      "fi",
      'PATH="$FRICTION_TEST_REAL_PATH" exec git "$@"',
      "",
    ].join("\n"),
    { mode: 0o700 },
  );
  const failedRemoteEnvironment = {
    FRICTION_TEST_REAL_PATH: originalPath,
    PATH: `${fakeGitDirectory}${path.delimiter}${originalPath}`,
  };
  const failedRemoteCapture = await runFriction({
    arguments: ["add", "--stdin", "--json"],
    cwd: failedRemoteRepository,
    environment: failedRemoteEnvironment,
    home: context.home,
    stdin: failedRemoteBody,
  });
  assert.equal(failedRemoteCapture.code, 0);
  assert.equal(
    envelope(failedRemoteCapture).warnings[0]?.["code"],
    "repository_unavailable",
  );

  const failedRemoteRead = await runFriction({
    arguments: ["list", "--status", "all", "--json"],
    cwd: failedRemoteRepository,
    environment: failedRemoteEnvironment,
    home: context.home,
  });
  assert.equal(failedRemoteRead.code, 3);
  assert.equal(failedRemoteRead.stdout.includes(safeBody), false);

  const updatedStored = await Promise.all(
    (await eventNames(context.home)).map(async (name) =>
      JSON.parse(
        await readFile(path.join(context.home, "v1", "events", name), "utf8"),
      ) as Record<string, unknown>,
    ),
  );
  assert.equal(updatedStored.length, 5);
  assert.equal(
    updatedStored
      .filter((event) =>
        [failedGitBody, failedRemoteBody].includes(event["body"] as string),
      )
      .every((event) => event["repository"] === null),
    true,
  );

  const explicitAll = await runFriction({
    arguments: ["list", "--repo", "all", "--status", "all", "--json"],
    cwd: repositories[0]!,
    home: context.home,
  });
  assert.equal(explicitAll.code, 0);
  const allRecords = envelope(explicitAll).data["records"] as Array<
    Record<string, unknown>
  >;
  assert.equal(allRecords.length, 5);
  assert.equal(allRecords.some((record) => record["body"] === safeBody), true);
});
