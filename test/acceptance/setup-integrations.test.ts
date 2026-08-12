import assert from "node:assert/strict";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { envelope, makeAcceptanceFixture } from "../support/acceptance.js";
import { runFriction, runGit } from "../support/process.js";

test("local adapters honor native precedence, partial setup, and shared-skill ownership", async () => {
  const context = await makeAcceptanceFixture("friction-integrations-");
  await runGit(context.work, ["init", "--quiet"]);
  const userHome = path.join(context.root, "user");
  const codexHome = path.join(context.root, "codex-home");
  await mkdir(userHome);
  await mkdir(codexHome);
  const environment = {
    HOME: userHome,
    USERPROFILE: userHome,
    CODEX_HOME: codexHome,
    PATH: process.platform === "win32"
      ? "C:\\Windows\\System32"
      : "/usr/bin:/bin",
  };

  const codexApply = envelope(await runFriction({
    arguments: ["setup", "codex", "--apply", "--json"],
    cwd: context.work,
    home: context.home,
    environment,
  }));
  assert.equal(codexApply.data["ready"], false);
  assert.match(
    await readFile(path.join(codexHome, "AGENTS.md"), "utf8"),
    /--source codex/,
  );
  const sharedSkill = path.join(
    userHome,
    ".agents",
    "skills",
    "friction-review",
    "SKILL.md",
  );
  await stat(sharedSkill);

  const codexUndo = envelope(await runFriction({
    arguments: ["setup", "codex", "--undo", "--apply", "--json"],
    cwd: context.work,
    home: context.home,
    environment,
  }));
  assert.equal(
    codexUndo.warnings.some(
      (warning) => warning["code"] === "shared_skills_retained",
    ),
    true,
  );
  await stat(sharedSkill);

  const skillsUndo = await runFriction({
    arguments: ["setup", "skills", "--undo", "--apply", "--json"],
    cwd: context.work,
    home: context.home,
    environment,
  });
  assert.equal(skillsUndo.code, 0);
  await assert.rejects(stat(sharedSkill));

  const claude = await runFriction({
    arguments: ["setup", "claude-code", "--apply", "--json"],
    cwd: context.work,
    home: context.home,
    environment,
  });
  assert.equal(claude.code, 0);
  assert.match(
    await readFile(
      path.join(userHome, ".claude", "rules", "friction.md"),
      "utf8",
    ),
    /--source claude-code/,
  );

  const fallbackPath = path.join(userHome, ".claude", "CLAUDE.md");
  await writeFile(fallbackPath, "# Existing OpenCode fallback\n");
  const openCode = envelope(await runFriction({
    arguments: ["setup", "opencode", "--apply", "--json"],
    cwd: context.work,
    home: context.home,
    environment,
  }));
  assert.equal(openCode.data["ready"], false);
  assert.equal(
    (openCode.data["coverage"] as Record<string, unknown>)["capture"],
    "manual",
  );
  assert.equal((openCode.data["manualSteps"] as unknown[]).length, 1);
  await assert.rejects(
    stat(path.join(userHome, ".config", "opencode", "AGENTS.md")),
  );
  assert.equal(
    await readFile(fallbackPath, "utf8"),
    "# Existing OpenCode fallback\n",
  );
  await stat(sharedSkill);

  const override = path.join(context.work, "AGENTS.override.md");
  await writeFile(override, "# Existing Pi override\n");
  const pi = await runFriction({
    arguments: ["setup", "pi", "--scope", "repo", "--apply", "--json"],
    cwd: context.work,
    home: context.home,
    environment,
  });
  assert.equal(pi.code, 0);
  assert.equal(await readFile(override, "utf8"), "# Existing Pi override\n");
  assert.match(
    await readFile(path.join(context.work, "AGENTS.md"), "utf8"),
    /--source generic/,
  );

  const warp = envelope(await runFriction({
    arguments: ["setup", "warp", "--json"],
    cwd: context.work,
    home: context.home,
    environment,
  }));
  assert.equal(warp.data["ready"], false);
  assert.equal(
    (warp.data["coverage"] as Record<string, unknown>)["capture"],
    "manual",
  );
  assert.match(
    (warp.data["manualSteps"] as string[])[0]!,
    /Settings > AI > Knowledge > Manage Rules/,
  );
});
