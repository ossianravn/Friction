import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { runFriction, runGit } from "../support/process.js";

async function makeFixture(prefix: string): Promise<{ root: string; home: string }> {
  const root = await mkdtemp(path.join(tmpdir(), prefix));
  return { root, home: path.join(root, "private-home") };
}

async function eventFiles(home: string): Promise<string[]> {
  const directory = path.join(home, "v1", "events");
  return (await readdir(directory)).map((name) => path.join(directory, name)).sort();
}

async function oneEvent(home: string): Promise<{
  bytes: string;
  value: Record<string, unknown>;
}> {
  const files = await eventFiles(home);
  assert.equal(files.length, 1);
  const bytes = await readFile(files[0]!, "utf8");
  return { bytes, value: JSON.parse(bytes) as Record<string, unknown> };
}

function parseEnvelope(stdout: string): Record<string, unknown> {
  assert.equal(stdout.endsWith("\n"), true);
  assert.equal(stdout.trim().split("\n").length, 1);
  return JSON.parse(stdout) as Record<string, unknown>;
}

test("stdin capture outside Git stores one private event without echoing its body", async () => {
  const fixture = await makeFixture("friction-capture-");
  const workingDirectory = path.join(fixture.root, "work");
  const body = "Updating a script required a retry because its working directory was undocumented.";
  await mkdir(workingDirectory);

  const result = await runFriction({
    arguments: ["add", "--stdin", "--source", "codex", "--impact", "retry", "--json"],
    cwd: workingDirectory,
    home: fixture.home,
    stdin: body,
  });

  assert.equal(result.code, 0);
  assert.equal(result.stderr, "");
  assert.equal(result.stdout.includes(body), false);
  const envelope = parseEnvelope(result.stdout);
  assert.equal(envelope["ok"], true);
  assert.equal(envelope["command"], "add");
  const event = await oneEvent(fixture.home);
  assert.equal(event.value["body"], body);
  assert.equal(event.value["source"], "codex");
  assert.equal(event.value["repository"], null);
  assert.equal((await stat(fixture.home)).mode & 0o777, 0o700);
  assert.equal((await stat((await eventFiles(fixture.home))[0]!)).mode & 0o777, 0o600);

  const invalid = await runFriction({
    arguments: ["add", "--stdin", "--json"],
    cwd: workingDirectory,
    home: fixture.home,
    stdin: "   ",
  });
  const errorEnvelope = parseEnvelope(invalid.stdout);
  assert.equal(invalid.code, 2);
  assert.equal(invalid.stderr, "");
  assert.equal(errorEnvelope["ok"], false);
  assert.equal((errorEnvelope["error"] as Record<string, unknown>)["code"], "invalid_input");
  assert.equal((await eventFiles(fixture.home)).length, 1);
});

test("capture from a Git subdirectory stores safe repository identity without dirtying it", async () => {
  const fixture = await makeFixture("friction-repository-");
  const repository = path.join(fixture.root, "repository");
  const nested = path.join(repository, "nested", "path");
  await mkdir(nested, { recursive: true });
  await runGit(repository, ["init", "--initial-branch=main"]);
  await runGit(repository, ["config", "user.name", "Friction Test"]);
  await runGit(repository, ["config", "user.email", "friction@example.invalid"]);
  await writeFile(path.join(repository, "tracked.txt"), "tracked\n", "utf8");
  await runGit(repository, ["add", "tracked.txt"]);
  await runGit(repository, ["commit", "-m", "fixture"]);
  await runGit(repository, [
    "remote",
    "add",
    "origin",
    "https://Example.COM/Owner/Repo.git",
  ]);
  const statusBefore = await runGit(repository, ["status", "--porcelain=v1"]);

  const result = await runFriction({
    arguments: ["add", "--stdin", "--area", "design", "--json"],
    cwd: nested,
    home: fixture.home,
    stdin: "A validation change required searching because ownership was split across layers.",
  });

  assert.equal(result.code, 0);
  assert.equal(result.stderr, "");
  assert.equal(await runGit(repository, ["status", "--porcelain=v1"]), statusBefore);
  const event = await oneEvent(fixture.home);
  const repositoryContext = event.value["repository"] as Record<string, unknown>;
  const expectedKey = createHash("sha256")
    .update("remote:example.com/Owner/Repo")
    .digest("hex");
  assert.deepEqual(repositoryContext, {
    key: expectedKey,
    name: "Repo",
    branch: "main",
    head: await runGit(repository, ["rev-parse", "HEAD"]),
    cwdRelative: "nested/path",
  });
  assert.equal(event.bytes.includes("https://Example.COM"), false);
  assert.equal(result.stdout.includes(expectedKey), false);
  assert.equal(result.stdout.includes(repository), false);
});

test("secret screening removes synthetic canaries from event and command output", async () => {
  const fixture = await makeFixture("friction-secrets-");
  const workingDirectory = path.join(fixture.root, "work");
  await mkdir(workingDirectory);
  await runGit(workingDirectory, ["init", "--quiet"]);
  const canaries = [
    "private-key-canary",
    "authorization-canary",
    "cookie-canary",
    "url-credential-canary",
    "assignment-canary",
    "ghp_abcdefghijklmnopqrstuvwxyz123456",
    "sk-abcdefghijklmnopqrstuvwxyz123456",
    "xoxb-1234567890-abcdefghijklmnop",
    "model-canary",
    "encrypted-private-key-canary",
    "openai-assignment-canary",
    "xoxc-1234567890-abcdefghijklmnop",
  ];
  const body = [
    "-----BEGIN PRIVATE KEY-----",
    canaries[0],
    "-----END PRIVATE KEY-----",
    `Authorization: Bearer ${canaries[1]}`,
    `Cookie: session=${canaries[2]}`,
    `URL https://alice:${canaries[3]}@example.invalid/path`,
    `api_token=${canaries[4]}`,
    canaries[5],
    canaries[6],
    canaries[7],
    "-----BEGIN ENCRYPTED PRIVATE KEY-----",
    canaries[9],
    "-----END ENCRYPTED PRIVATE KEY-----",
    `MY_OPENAI_API_KEY=${canaries[10]}`,
    canaries[11],
    "The monkey wrench was ordinary prose and should remain readable.",
  ].join("\n");

  const result = await runFriction({
    arguments: ["add", "--stdin", "--model", `api_token=${canaries[8]}`, "--json"],
    cwd: workingDirectory,
    home: fixture.home,
    stdin: body,
  });
  const event = await oneEvent(fixture.home);
  const observationId = event.value["observationId"] as string;
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
    outputs.push(
      await runFriction({ arguments: arguments_, cwd: workingDirectory, home: fixture.home }),
    );
  }
  assert.equal(outputs.every((output) => output.code === 0), true);
  const projection = await readFile(
    path.join(workingDirectory, ".friction", "observations.jsonl"),
  );
  const examined = [
    event.bytes,
    result.stdout,
    result.stderr,
    projection.toString("utf8"),
    ...outputs.flatMap((output) => [output.stdout, output.stderr]),
  ].join("\n");

  assert.equal(result.code, 0);
  for (const canary of canaries) {
    assert.equal(examined.includes(canary!), false);
  }
  for (const marker of [
    "[REDACTED:PRIVATE_KEY]",
    "[REDACTED:AUTHORIZATION]",
    "[REDACTED:COOKIE]",
    "[REDACTED:URL_CREDENTIAL]",
    "[REDACTED:SECRET]",
    "[REDACTED:CREDENTIAL]",
  ]) {
    assert.equal(event.bytes.includes(marker), true);
  }
  assert.equal(event.bytes.includes("monkey wrench"), true);
});

test("eight concurrent processes create eight intact observations", async () => {
  const fixture = await makeFixture("friction-concurrent-");
  const workingDirectory = path.join(fixture.root, "work");
  await mkdir(workingDirectory);
  const bodies = Array.from(
    { length: 8 },
    (_, index) => `Concurrent observation ${index} found a repeated workaround.`,
  );
  const results = await Promise.all(
    bodies.map((body) =>
      runFriction({
        arguments: ["add", "--stdin", "--source", "generic", "--json"],
        cwd: workingDirectory,
        home: fixture.home,
        stdin: body,
      }),
    ),
  );

  assert.equal(results.every((result) => result.code === 0), true);
  assert.equal(results.every((result) => result.stderr === ""), true);
  const files = await eventFiles(fixture.home);
  assert.equal(files.length, 8);
  const storedBodies = await Promise.all(
    files.map(async (file) => {
      const event = JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>;
      return event["body"];
    }),
  );
  assert.deepEqual(storedBodies.sort(), bodies.sort());
  assert.deepEqual(await readdir(path.join(fixture.home, "v1", "tmp")), []);
});
