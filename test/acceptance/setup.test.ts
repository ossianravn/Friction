import assert from "node:assert/strict";
import { chmod, mkdir, readFile, readdir, stat, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { FrictionFailure } from "../../src/domain/failures.js";
import { applySetupPlan } from "../../src/setup/apply.js";
import { buildSetupPlan } from "../../src/setup/plan.js";
import { ownedFileState } from "../../src/setup/target-plan.js";
import { envelope, makeAcceptanceFixture } from "../support/acceptance.js";
import { runFriction, runGit } from "../support/process.js";

async function treeBytes(root: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};

  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute);

      if (entry.isDirectory()) {
        result[`${relative}/`] = "directory";
        await visit(absolute);
      } else {
        const mode = (await stat(absolute)).mode & 0o777;
        result[relative] = `${mode}:${(await readFile(absolute)).toString("base64")}`;
      }
    }
  }

  await visit(root);
  return result;
}

test("setup previews without writes and supports safe apply, repeat, undo, and conflicts", async () => {
  const context = await makeAcceptanceFixture("friction-setup-");
  let setupRoot = context.root;

  if (process.platform !== "win32") {
    const canonicalRoot = path.join(context.root, "canonical-setup-root");
    const linkedRoot = path.join(context.root, "linked-setup-root");
    await mkdir(canonicalRoot);
    await symlink(canonicalRoot, linkedRoot, "dir");
    setupRoot = linkedRoot;
  }

  const userHome = path.join(setupRoot, "user");
  const codexHome = path.join(setupRoot, "custom-codex-home");
  const agentsFile = path.join(codexHome, "AGENTS.md");
  const environment = {
    HOME: userHome,
    USERPROFILE: userHome,
    LOCALAPPDATA: path.join(context.root, "local-app-data"),
    CODEX_HOME: codexHome,
    PATH: process.platform === "win32" ? "C:\\Windows\\System32" : "/usr/bin:/bin",
  };
  const original = Buffer.from("# Existing\r\n\r\nKeep this byte-for-byte.", "utf8");
  await mkdir(userHome);
  await mkdir(codexHome);
  await writeFile(agentsFile, original);
  if (process.platform !== "win32") {
    await chmod(agentsFile, 0o666);
  }
  const beforeUserPreview = await treeBytes(userHome);
  const beforeCodexPreview = await treeBytes(codexHome);

  const preview = await runFriction({
    arguments: ["setup", "codex", "--json"],
    cwd: context.work,
    home: context.home,
    environment,
  });
  assert.equal(preview.code, 0);
  assert.equal(envelope(preview).data["action"], "preview-apply");
  assert.deepEqual(await treeBytes(userHome), beforeUserPreview);
  assert.deepEqual(await treeBytes(codexHome), beforeCodexPreview);
  await assert.rejects(stat(context.home));

  const applied = await runFriction({
    arguments: ["setup", "codex", "--apply", "--json"],
    cwd: context.work,
    home: context.home,
    environment,
  });
  assert.equal(applied.code, 0);
  assert.equal(envelope(applied).warnings[0]?.["code"], "path_unavailable");
  const installed = await readFile(agentsFile);
  assert.equal(installed.includes(Buffer.from("friction add --stdin --source codex")), true);
  assert.equal(installed.subarray(installed.length - original.length).equals(original), true);
  if (process.platform === "win32") {
    const installedText = installed.toString("utf8");
    assert.equal(installedText.includes("$OutputEncoding = $utf8NoBom"), true);
    assert.equal(installedText.includes("printf '%s"), false);
    assert.equal(installedText.replaceAll("\r\n", "").includes("\n"), false);
  } else {
    assert.equal((await stat(agentsFile)).mode & 0o777, 0o666);
  }
  const reviewSkill = path.join(userHome, ".agents", "skills", "friction-review", "SKILL.md");
  assert.equal((await readFile(reviewSkill, "utf8")).includes("name: friction-review"), true);
  if (process.platform !== "win32") {
    assert.equal((await stat(reviewSkill)).mode & 0o777, 0o600);
  }

  const installedUserTree = await treeBytes(userHome);
  const installedCodexTree = await treeBytes(codexHome);
  const repeated = envelope(
    await runFriction({
      arguments: ["setup", "codex", "--apply", "--json"],
      cwd: context.work,
      home: context.home,
      environment,
    }),
  );
  assert.equal(repeated.data["state"], "noop");
  assert.deepEqual(await treeBytes(userHome), installedUserTree);
  assert.deepEqual(await treeBytes(codexHome), installedCodexTree);

  const overrideFile = path.join(codexHome, "AGENTS.override.md");
  const overrideBytes = Buffer.from("# A later user override\n", "utf8");
  await writeFile(overrideFile, overrideBytes);
  const precedenceUserTree = await treeBytes(userHome);
  const precedenceCodexTree = await treeBytes(codexHome);

  const undoPreview = envelope(
    await runFriction({
      arguments: ["setup", "codex", "--undo", "--json"],
      cwd: context.work,
      home: context.home,
      environment,
    }),
  );
  assert.equal(undoPreview.data["action"], "preview-undo");
  assert.deepEqual(await treeBytes(userHome), precedenceUserTree);
  assert.deepEqual(await treeBytes(codexHome), precedenceCodexTree);

  const undone = await runFriction({
    arguments: ["setup", "codex", "--undo", "--apply", "--json"],
    cwd: context.work,
    home: context.home,
    environment,
  });
  assert.equal(undone.code, 0);
  assert.equal((await readFile(agentsFile)).equals(original), true);
  if (process.platform !== "win32") {
    assert.equal((await stat(agentsFile)).mode & 0o777, 0o666);
  }
  assert.equal((await readFile(overrideFile)).equals(overrideBytes), true);
  await assert.rejects(readFile(reviewSkill));

  const genericSnippet = envelope(
    await runFriction({
      arguments: ["setup", "generic", "--json"],
      cwd: context.work,
      home: context.home,
      environment,
    }),
  ).data["snippet"] as string;
  assert.equal(genericSnippet.length > 0, true);
  if (process.platform === "win32") {
    assert.equal(genericSnippet.includes("PowerShell:"), true);
    assert.equal(genericSnippet.includes("Git Bash:"), true);
  }

  assert.equal(
    ownedFileState("known-prior", "current", ["known-prior", "current"], false),
    "update",
  );
  assert.equal(
    ownedFileState("known-prior", "current", ["known-prior", "current"], true),
    "remove",
  );

  const claudeApply = await runFriction({
    arguments: ["setup", "claude-code", "--apply", "--json"],
    cwd: context.work,
    home: context.home,
    environment,
  });
  assert.equal(claudeApply.code, 0);
  const rule = path.join(userHome, ".claude", "rules", "friction.md");
  const ruleText = await readFile(rule, "utf8");
  assert.equal(ruleText.includes("friction add --stdin --source claude-code"), true);
  if (process.platform === "win32") {
    assert.equal(ruleText.includes("printf '%s\\n'"), true);
    assert.equal(ruleText.includes("$OutputEncoding"), false);
  }
  await writeFile(rule, "user changed this managed file\n");
  const beforeConflict = await treeBytes(userHome);
  const conflict = await runFriction({
    arguments: ["setup", "claude-code", "--undo", "--apply", "--json"],
    cwd: context.work,
    home: context.home,
    environment,
  });
  assert.equal(conflict.code, 4);
  assert.equal(JSON.parse(conflict.stdout).error.code, "setup_conflict");
  assert.deepEqual(await treeBytes(userHome), beforeConflict);
});

test("setup rechecks preimages before mutating repository targets", async () => {
  const context = await makeAcceptanceFixture("friction-setup-race-");
  await runGit(context.work, ["init", "--quiet"]);
  const priorHome = process.env["FRICTION_HOME"];
  process.env["FRICTION_HOME"] = context.home;

  try {
    const plan = await buildSetupPlan({
      harness: "codex",
      scope: "repo",
      undo: false,
      cwd: context.work,
    });
    await writeFile(path.join(context.work, "AGENTS.md"), "changed after planning\n");
    await assert.rejects(
      applySetupPlan(plan),
      (error) => error instanceof FrictionFailure && error.code === "setup_conflict",
    );
    assert.equal(
      await readFile(path.join(context.work, "AGENTS.md"), "utf8"),
      "changed after planning\n",
    );
    await assert.rejects(stat(path.join(context.work, ".agents")));

    const precedencePlan = await buildSetupPlan({
      harness: "codex",
      scope: "repo",
      undo: false,
      cwd: context.work,
    });
    const overridePath = path.join(context.work, "AGENTS.override.md");
    const overrideBytes = "created after planning\n";
    const agentsBytes = await readFile(path.join(context.work, "AGENTS.md"));
    await writeFile(overridePath, overrideBytes);
    await assert.rejects(
      applySetupPlan(precedencePlan),
      (error) => error instanceof FrictionFailure && error.code === "setup_conflict",
    );
    assert.equal(
      (await readFile(path.join(context.work, "AGENTS.md"))).equals(agentsBytes),
      true,
    );
    assert.equal(await readFile(overridePath, "utf8"), overrideBytes);
    await assert.rejects(stat(path.join(context.work, ".agents")));

    const outside = path.join(context.root, "outside");
    await mkdir(outside);
    await symlink(
      outside,
      path.join(context.work, ".agents"),
      process.platform === "win32" ? "junction" : "dir",
    );
    await assert.rejects(
      buildSetupPlan({
        harness: "codex",
        scope: "repo",
        undo: false,
        cwd: context.work,
      }),
      (error) => error instanceof FrictionFailure && error.code === "setup_conflict",
    );
  } finally {
    if (priorHome === undefined) {
      delete process.env["FRICTION_HOME"];
    } else {
      process.env["FRICTION_HOME"] = priorHome;
    }
  }
});
