import assert from "node:assert/strict";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { buildSetupPlan, setupData } from "../../src/setup/plan.js";
import { envelope, makeAcceptanceFixture } from "../support/acceptance.js";
import { runFriction } from "../support/process.js";

test("catalog, generic output, and explicit workspace adapters expose truthful coverage", async () => {
  const context = await makeAcceptanceFixture("friction-workspace-");
  const userHome = path.join(context.root, "user");
  const openClaw = path.join(context.root, "openclaw-workspace");
  const hermes = path.join(context.root, "hermes-workspace");
  const hermesHome = path.join(context.root, "hermes-home");
  await Promise.all([
    mkdir(userHome),
    mkdir(openClaw),
    mkdir(hermes),
    mkdir(hermesHome),
  ]);
  const environment = {
    HOME: userHome,
    USERPROFILE: userHome,
    HERMES_HOME: hermesHome,
  };

  const catalog = envelope(await runFriction({
    arguments: ["setup", "--list", "--json"],
    cwd: context.work,
    home: context.home,
    environment,
  }));
  const integrations = catalog.data["integrations"] as Array<Record<string, unknown>>;
  assert.deepEqual(
    integrations.map((entry) => entry["id"]),
    [
      "standard",
      "skills",
      "codex",
      "claude-code",
      "opencode",
      "pi",
      "warp",
      "openclaw",
      "hermes",
      "generic",
    ],
  );
  const schema = envelope(await runFriction({
    arguments: ["schema"],
    cwd: context.work,
    home: context.home,
    environment,
  }));
  assert.deepEqual(schema.data["integrations"], integrations);

  const generic = envelope(await runFriction({
    arguments: [
      "setup",
      "generic",
      "--source",
      "my-agent",
      "--shell",
      "posix",
      "--json",
    ],
    cwd: context.work,
    home: context.home,
    environment,
  }));
  assert.match(generic.data["snippet"] as string, /--source my-agent/);
  assert.match(generic.data["snippet"] as string, /## Capture agent friction/);
  assert.match(generic.data["snippet"] as string, /Proactively record concrete/);
  assert.equal(generic.data["ready"], false);

  const credentialSource = `sk-${"c".repeat(20)}`;
  const unsafeGeneric = await runFriction({
    arguments: ["setup", "generic", "--source", credentialSource, "--json"],
    cwd: context.work,
    home: context.home,
    environment,
  });
  assert.equal(unsafeGeneric.code, 2);
  assert.equal(unsafeGeneric.stdout.includes(credentialSource), false);

  const skillsPlan = await buildSetupPlan({
    integration: "skills",
    scope: "workspace",
    undo: false,
    cwd: context.work,
    workspace: openClaw,
    source: undefined,
    transport: undefined,
  });
  assert.equal(setupData(skillsPlan, true).ready, false);

  const openClawApply = await runFriction({
    arguments: [
      "setup",
      "openclaw",
      "--workspace",
      openClaw,
      "--apply",
      "--json",
    ],
    cwd: context.work,
    home: context.home,
    environment,
  });
  assert.equal(openClawApply.code, 0);
  assert.match(
    await readFile(path.join(openClaw, "AGENTS.md"), "utf8"),
    /--source openclaw/,
  );
  const openClawSkill = path.join(
    openClaw,
    "skills",
    "friction-review",
    "SKILL.md",
  );
  await stat(openClawSkill);
  if (process.platform !== "win32") {
    assert.equal((await stat(openClawSkill)).mode & 0o777, 0o644);
  }

  const hermesFallback = path.join(hermes, "CLAUDE.md");
  await writeFile(hermesFallback, "# Existing Hermes fallback\n");
  const hermesApply = envelope(await runFriction({
    arguments: [
      "setup",
      "hermes",
      "--workspace",
      hermes,
      "--apply",
      "--json",
    ],
    cwd: context.work,
    home: context.home,
    environment,
  }));
  assert.equal(hermesApply.data["ready"], false);
  assert.equal(
    (hermesApply.data["coverage"] as Record<string, unknown>)["capture"],
    "manual",
  );
  assert.equal((hermesApply.data["manualSteps"] as unknown[]).length, 1);
  await assert.rejects(stat(path.join(hermes, "AGENTS.md")));
  const hermesSkill = path.join(
    hermesHome,
    "skills",
    "friction-fix",
    "SKILL.md",
  );
  await stat(hermesSkill);
  if (process.platform !== "win32") {
    assert.equal((await stat(hermesSkill)).mode & 0o777, 0o600);
  }
  assert.equal(
    await readFile(hermesFallback, "utf8"),
    "# Existing Hermes fallback\n",
  );
});
