import assert from "node:assert/strict";
import { lstat, mkdir, mkdtemp, rm, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { FrictionFailure } from "../../src/domain/failures.js";
import { installPrivateFileExclusively } from "../../src/platform/fs.js";

function isMissing(error: unknown): boolean {
  return error !== null &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "ENOENT";
}

test("failed private-file verification confirms rollback or reports indeterminate state", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "friction-private-install-"));
  const temporary = path.join(root, "tmp");
  const events = path.join(root, "events");
  await mkdir(temporary);
  await mkdir(events);

  try {
    const removedPath = path.join(events, "removed.json");
    await assert.rejects(
      installPrivateFileExclusively(
        temporary,
        removedPath,
        Buffer.from("private bytes"),
        {
          temporaryCreated: async () => undefined,
          installed: async () => {
            throw new Error("verification failed");
          },
        },
      ),
      /verification failed/,
    );
    await assert.rejects(lstat(removedPath), isMissing);

    const changedPath = path.join(events, "changed.json");
    await assert.rejects(
      installPrivateFileExclusively(
        temporary,
        changedPath,
        Buffer.from("private bytes"),
        {
          temporaryCreated: async () => undefined,
          installed: async (installedPath) => {
            await unlink(installedPath);
            await mkdir(installedPath);
            throw new Error("verification failed");
          },
        },
      ),
      (error) =>
        error instanceof FrictionFailure &&
        error.code === "indeterminate_store",
    );
    assert.equal((await lstat(changedPath)).isDirectory(), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
