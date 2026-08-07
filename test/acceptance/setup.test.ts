import assert from "node:assert/strict";
import { chmod, mkdir, readFile, readdir, stat, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { FrictionFailure } from "../../src/domain/failures.js";
import { applySetupPlan } from "../../src/setup/apply.js";
import { buildSetupPlan } from "../../src/setup/plan.js";
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
  const userHome = path.join(context.root, "user");
  const codexHome = path.join(userHome, ".codex");
  const agentsFile = path.join(codexHome, "AGENTS.md");
  const environment = {
    HOME: userHome,
    CODEX_HOME: codexHome,
    PATH: "/usr/bin:/bin",
  };
  const original = Buffer.from("# Existing\r\n\r\nKeep this byte-for-byte.", "utf8");
  await mkdir(codexHome, { recursive: true });
  await writeFile(agentsFile, original);
  await chmod(agentsFile, 0o666);
  const beforePreview = await treeBytes(userHome);

  const preview = await runFriction({
    arguments: ["setup", "codex", "--json"],
    cwd: context.work,
    home: context.home,
    environment,
  });
  assert.equal(preview.code, 0);
  assert.equal(envelope(preview).data["action"], "preview-apply");
  assert.deepEqual(await treeBytes(userHome), beforePreview);
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
  assert.equal((await stat(agentsFile)).mode & 0o777, 0o666);
  const reviewSkill = path.join(userHome, ".agents", "skills", "friction-review", "SKILL.md");
  assert.equal((await readFile(reviewSkill, "utf8")).includes("name: friction-review"), true);
  assert.equal((await stat(reviewSkill)).mode & 0o777, 0o600);

  const installedTree = await treeBytes(userHome);
  const repeated = envelope(
    await runFriction({
      arguments: ["setup", "codex", "--apply", "--json"],
      cwd: context.work,
      home: context.home,
      environment,
    }),
  );
  assert.equal(repeated.data["state"], "noop");
  assert.deepEqual(await treeBytes(userHome), installedTree);

  const overrideFile = path.join(codexHome, "AGENTS.override.md");
  const overrideBytes = Buffer.from("# A later user override\n", "utf8");
  await writeFile(overrideFile, overrideBytes);
  const precedenceTree = await treeBytes(userHome);

  const undoPreview = envelope(
    await runFriction({
      arguments: ["setup", "codex", "--undo", "--json"],
      cwd: context.work,
      home: context.home,
      environment,
    }),
  );
  assert.equal(undoPreview.data["action"], "preview-undo");
  assert.deepEqual(await treeBytes(userHome), precedenceTree);

  const undone = await runFriction({
    arguments: ["setup", "codex", "--undo", "--apply", "--json"],
    cwd: context.work,
    home: context.home,
    environment,
  });
  assert.equal(undone.code, 0);
  assert.equal((await readFile(agentsFile)).equals(original), true);
  assert.equal((await stat(agentsFile)).mode & 0o777, 0o666);
  assert.equal((await readFile(overrideFile)).equals(overrideBytes), true);
  await assert.rejects(readFile(reviewSkill));

  assert.equal(
    envelope(
      await runFriction({
        arguments: ["setup", "generic", "--json"],
        cwd: context.work,
        home: context.home,
        environment,
      }),
    ).data["snippet"] !== null,
    true,
  );

  const claudeApply = await runFriction({
    arguments: ["setup", "claude-code", "--apply", "--json"],
    cwd: context.work,
    home: context.home,
    environment,
  });
  assert.equal(claudeApply.code, 0);
  const rule = path.join(userHome, ".claude", "rules", "friction.md");
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

    const outside = path.join(context.root, "outside");
    await mkdir(outside);
    await symlink(outside, path.join(context.work, ".agents"));
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
