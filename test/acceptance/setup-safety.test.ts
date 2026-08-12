import assert from "node:assert/strict";
import {
  mkdir,
  readFile,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { FrictionFailure } from "../../src/domain/failures.js";
import { applySetupPlan } from "../../src/setup/apply.js";
import { buildSetupPlan } from "../../src/setup/plan.js";
import { envelope, makeAcceptanceFixture } from "../support/acceptance.js";
import { runFriction, runGit } from "../support/process.js";
import { treeBytes } from "../support/setup.js";

test("standard setup is preview-first, idempotent, reversible, and conflict-safe", async () => {
  const context = await makeAcceptanceFixture("friction-setup-safe-");
  await runGit(context.work, ["init", "--quiet"]);
  const agentsPath = path.join(context.work, "AGENTS.md");
  const original = Buffer.from("# Existing\r\n\r\nKeep this byte-for-byte.", "utf8");
  await writeFile(agentsPath, original);
  const before = await treeBytes(context.work);

  const preview = envelope(await runFriction({
    arguments: ["setup", "standard", "--json"],
    cwd: context.work,
    home: context.home,
  }));
  assert.equal(preview.data["action"], "preview-apply");
  assert.deepEqual(await treeBytes(context.work), before);

  const applied = envelope(await runFriction({
    arguments: ["setup", "standard", "--apply", "--json"],
    cwd: context.work,
    home: context.home,
  }));
  assert.equal(applied.data["integration"], "standard");
  const installed = await readFile(agentsPath);
  assert.equal(installed.subarray(0, original.length).equals(original), true);
  assert.equal(
    installed.includes(Buffer.from("friction add --stdin --source generic")),
    true,
  );
  assert.equal(installed.includes(Buffer.from("## Capture agent friction")), true);
  assert.equal(
    installed.includes(Buffer.from("Use the form for the current shell")),
    true,
  );
  const skill = path.join(
    context.work,
    ".agents",
    "skills",
    "friction-review",
    "SKILL.md",
  );
  assert.equal((await readFile(skill, "utf8")).includes("license: MIT"), true);

  const installedTree = await treeBytes(context.work);
  const repeated = envelope(await runFriction({
    arguments: ["setup", "standard", "--apply", "--json"],
    cwd: context.work,
    home: context.home,
  }));
  assert.equal(repeated.data["state"], "noop");
  assert.deepEqual(await treeBytes(context.work), installedTree);

  const undone = await runFriction({
    arguments: ["setup", "standard", "--undo", "--apply", "--json"],
    cwd: context.work,
    home: context.home,
  });
  assert.equal(undone.code, 0);
  assert.equal((await readFile(agentsPath)).equals(original), true);
  await assert.rejects(readFile(skill));

  await runFriction({
    arguments: ["setup", "standard", "--apply", "--json"],
    cwd: context.work,
    home: context.home,
  });
  await writeFile(skill, "user changed this managed file\n");
  const beforeConflict = await treeBytes(context.work);
  const conflict = await runFriction({
    arguments: ["setup", "standard", "--undo", "--apply", "--json"],
    cwd: context.work,
    home: context.home,
  });
  assert.equal(conflict.code, 4);
  assert.equal(JSON.parse(conflict.stdout).error.code, "setup_conflict");
  assert.deepEqual(await treeBytes(context.work), beforeConflict);
});

test("setup rechecks preimages and rejects escaped skill roots", async () => {
  const context = await makeAcceptanceFixture("friction-setup-race-");
  await runGit(context.work, ["init", "--quiet"]);
  const priorHome = process.env["FRICTION_HOME"];
  process.env["FRICTION_HOME"] = context.home;

  try {
    const plan = await buildSetupPlan({
      integration: "standard",
      scope: "repo",
      undo: false,
      cwd: context.work,
      workspace: undefined,
      source: undefined,
      transport: undefined,
    });
    await writeFile(path.join(context.work, "AGENTS.md"), "changed after planning\n");
    await assert.rejects(
      applySetupPlan(plan),
      (error) =>
        error instanceof FrictionFailure && error.code === "setup_conflict",
    );
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
        integration: "standard",
        scope: "repo",
        undo: false,
        cwd: context.work,
        workspace: undefined,
        source: undefined,
        transport: undefined,
      }),
      (error) =>
        error instanceof FrictionFailure && error.code === "setup_conflict",
    );
  } finally {
    if (priorHome === undefined) {
      delete process.env["FRICTION_HOME"];
    } else {
      process.env["FRICTION_HOME"] = priorHome;
    }
  }
});
