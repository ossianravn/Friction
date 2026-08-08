import assert from "node:assert/strict";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { FrictionFailure } from "../../src/domain/failures.js";
import {
  commitStagedFile,
  discardStagedFile,
  stageFileReplacement,
} from "../../src/platform/atomic-file.js";
import { broadenAcl, inspectAcl } from "../support/windows-acl.js";
import { runFriction } from "../support/process.js";

async function treeBytes(root: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};

  async function visit(directory: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error !== null && typeof error === "object" && "code" in error && error.code === "ENOENT") return;
      throw error;
    }

    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute);
      if (entry.isDirectory()) {
        result[`${relative}/`] = "directory";
        await visit(absolute);
      } else if (entry.isSymbolicLink()) {
        result[relative] = "symlink";
      } else {
        result[relative] = (await readFile(absolute)).toString("base64");
      }
    }
  }

  await visit(root);
  return result;
}

test("native Windows private-store security boundary", {
  skip: process.platform === "win32" ? false : "requires native Windows ACL behavior",
}, async () => {
  const root = await mkdtemp(path.join(tmpdir(), "friction-win-security-"));
  const body = "W2 private bytes must never cross an unverified ACL gate.";

  try {
    const work = path.join(root, "work");
    const safeHome = path.join(root, "safe-home");
    await mkdir(work);
    const capture = await runFriction({
      arguments: ["add", "--stdin", "--source", "codex", "--json"],
      cwd: work,
      home: safeHome,
      stdin: body,
    });
    assert.equal(capture.code, 0);
    assert.equal(`${capture.stdout}${capture.stderr}`.includes(body), false);

    const versionRoot = path.join(safeHome, "v1");
    const events = path.join(versionRoot, "events");
    const temporary = path.join(versionRoot, "tmp");
    const eventNames = await readdir(events);
    assert.equal(eventNames.length, 1);
    const eventPath = path.join(events, eventNames[0]!);
    const aclTargets = [safeHome, versionRoot, events, temporary, eventPath];
    const aclFacts = await Promise.all(aclTargets.map(inspectAcl));
    assert.equal(aclFacts.every((facts) => facts.ok), true);
    assert.equal(aclFacts.every((facts) => facts.ownerMatches), true);
    assert.equal(aclFacts.every((facts) => facts.unexpectedAceCount === 0), true);
    assert.equal(aclFacts.every((facts) => facts.missingRuleCount === 0), true);
    assert.equal(aclFacts.slice(0, 4).every((facts) => facts.inheritanceProtected), true);

    const broadHome = path.join(root, "broad-home");
    await mkdir(broadHome);
    await broadenAcl(broadHome);
    const unsafeBefore = await inspectAcl(broadHome);
    assert.equal(unsafeBefore.ok, false);
    const broadTree = await treeBytes(broadHome);
    const refused = await runFriction({
      arguments: ["add", "--stdin", "--source", "codex", "--json"],
      cwd: work,
      home: broadHome,
      stdin: body,
    });
    assert.equal(refused.code, 6);
    assert.equal(JSON.parse(refused.stdout).error.code, "safety_failure");
    assert.equal(`${refused.stdout}${refused.stderr}`.includes(body), false);
    assert.deepEqual(await treeBytes(broadHome), broadTree);
    assert.deepEqual(await inspectAcl(broadHome), unsafeBefore);

    const junctionTarget = path.join(root, "junction-target");
    const junction = path.join(root, "junction");
    await mkdir(junctionTarget);
    await symlink(junctionTarget, junction, "junction");
    const junctionRefusal = await runFriction({
      arguments: ["add", "--stdin", "--source", "codex", "--json"],
      cwd: work,
      home: path.join(junction, "private"),
      stdin: body,
    });
    assert.equal(junctionRefusal.code, 6);
    assert.equal(JSON.parse(junctionRefusal.stdout).error.code, "safety_failure");
    await assert.rejects(lstat(path.join(junctionTarget, "private")));

    const atomicDirectory = path.join(root, "atomic");
    const atomicTarget = path.join(atomicDirectory, "target.txt");
    await mkdir(atomicDirectory);
    await writeFile(atomicTarget, "before");
    const staged = await stageFileReplacement(
      atomicTarget,
      Buffer.from("desired"),
      0o600,
    );
    await writeFile(atomicTarget, "changed");
    try {
      await assert.rejects(
        commitStagedFile({
          temporaryPath: staged,
          targetPath: atomicTarget,
          targetExists: true,
          conflictCode: "output_conflict",
          assertUnchanged: async () => {
            if ((await readFile(atomicTarget, "utf8")) !== "before") {
              throw new FrictionFailure("output_conflict");
            }
          },
        }),
        (error) => error instanceof FrictionFailure && error.code === "output_conflict",
      );
    } finally {
      await discardStagedFile(staged);
    }
    assert.equal(await readFile(atomicTarget, "utf8"), "changed");

    const userHome = path.join(root, "user");
    const codexHome = path.join(root, "codex");
    const previewHome = path.join(root, "preview-home");
    await mkdir(userHome);
    await mkdir(codexHome);
    await writeFile(path.join(codexHome, "AGENTS.md"), "# Existing\r\n", "utf8");
    const beforePreview = await treeBytes(root);
    const preview = await runFriction({
      arguments: ["setup", "codex", "--json"],
      cwd: work,
      home: previewHome,
      environment: {
        HOME: userHome,
        USERPROFILE: userHome,
        CODEX_HOME: codexHome,
        LOCALAPPDATA: path.join(root, "local-app-data"),
      },
    });
    assert.equal(preview.code, 0);
    assert.deepEqual(await treeBytes(root), beforePreview);
    await assert.rejects(lstat(previewHome));

    const driveRelativePreview = await runFriction({
      arguments: ["setup", "codex", "--json"],
      cwd: work,
      home: previewHome,
      environment: {
        HOME: userHome,
        USERPROFILE: userHome,
        CODEX_HOME: "C:relative",
        LOCALAPPDATA: path.join(root, "local-app-data"),
      },
    });
    assert.equal(driveRelativePreview.code, 2);
    assert.equal(JSON.parse(driveRelativePreview.stdout).error.code, "invalid_input");
    assert.deepEqual(await treeBytes(root), beforePreview);

    const doctor = await runFriction({
      arguments: ["doctor", "--json"],
      cwd: work,
      home: safeHome,
      environment: { HOME: userHome, USERPROFILE: userHome, CODEX_HOME: codexHome },
    });
    assert.equal(doctor.code, 0);
    assert.equal(doctor.stderr, "");
    const doctorText = doctor.stdout;
    for (const forbidden of [body, safeHome, "S-1-5-18", "O:S-", "D:PAI"]) {
      assert.equal(doctorText.includes(forbidden), false);
    }
    const envelope = JSON.parse(doctorText) as { data: { checks: Array<Record<string, unknown>> } };
    assert.equal(envelope.data.checks.some(
      (check) => /acl/i.test(String(check["name"])) && check["status"] === "ok",
    ), true);
    assert.equal(envelope.data.checks.some(
      (check) => /filesystem-capabilities/i.test(String(check["name"])) && check["status"] === "ok",
    ), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
