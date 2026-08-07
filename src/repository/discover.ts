import { createHash } from "node:crypto";
import { realpath } from "node:fs/promises";
import path from "node:path";

import type { RepositoryContext } from "../domain/events.js";
import { FrictionFailure } from "../domain/failures.js";
import { runGit, type GitCommandResult } from "../platform/git.js";
import { redact } from "../security/redact.js";
import { normalizeRemote, type NormalizedRemote } from "./remote.js";

const NAME_MAX_BYTES = 255;
const BRANCH_MAX_BYTES = 512;
const RELATIVE_PATH_MAX_BYTES = 2_048;
const LOCAL_IDENTITY_MAX_BYTES = 4_096;

export type RepositoryDiscovery = {
  context: RepositoryContext | null;
  replacementCount: number;
  warning: boolean;
};

function text(result: GitCommandResult): string | null {
  return result.status === "ok" ? result.stdout.trim() : null;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function fits(value: string, maximumBytes: number): boolean {
  return Buffer.byteLength(value, "utf8") <= maximumBytes;
}

function screen(value: string): ReturnType<typeof redact> {
  try {
    return redact(value);
  } catch {
    throw new FrictionFailure("safety_failure");
  }
}

async function selectedRemote(cwd: string): Promise<NormalizedRemote | null> {
  const namesResult = await runGit(["remote"], cwd);
  const names = text(namesResult)
    ?.split("\n")
    .map((name) => name.trim())
    .filter((name) => name.length > 0);

  if (names === undefined) {
    return null;
  }

  const selectedName = names.includes("origin")
    ? "origin"
    : names.length === 1
      ? names[0]
      : undefined;

  if (selectedName === undefined) {
    return null;
  }

  const url = text(await runGit(["remote", "get-url", selectedName], cwd));
  return url === null ? null : normalizeRemote(url);
}

async function localIdentity(
  commonDirectory: string,
): Promise<{ key: string; replacementCount: number } | null> {
  if (!fits(commonDirectory, LOCAL_IDENTITY_MAX_BYTES)) {
    return null;
  }

  const screened = screen(commonDirectory);

  if (screened.replacementCount > 0) {
    return null;
  }

  return {
    key: sha256(`local:${screened.text}`),
    replacementCount: screened.replacementCount,
  };
}

export async function discoverRepository(cwd: string): Promise<RepositoryDiscovery> {
  const topLevelResult = await runGit(["rev-parse", "--show-toplevel"], cwd);

  if (topLevelResult.status === "failed") {
    return { context: null, replacementCount: 0, warning: false };
  }

  if (topLevelResult.status === "unavailable") {
    return { context: null, replacementCount: 0, warning: true };
  }

  const commonResult = await runGit(
    ["rev-parse", "--path-format=absolute", "--git-common-dir"],
    cwd,
  );

  if (commonResult.status !== "ok") {
    return { context: null, replacementCount: 0, warning: true };
  }

  try {
    const worktree = await realpath(topLevelResult.stdout.trim());
    const commonDirectory = await realpath(commonResult.stdout.trim());
    const actualCwd = await realpath(cwd);
    const relative = path.relative(worktree, actualCwd);
    const cwdRelative = relative.length === 0 ? "." : relative.split(path.sep).join("/");

    if (
      path.isAbsolute(relative) ||
      relative === ".." ||
      relative.startsWith(`..${path.sep}`) ||
      !fits(cwdRelative, RELATIVE_PATH_MAX_BYTES)
    ) {
      return { context: null, replacementCount: 0, warning: true };
    }

    const remote = await selectedRemote(cwd);
    let replacementCount = 0;
    let key: string;
    let displayName: string;

    if (remote !== null) {
      const screenedRemote = screen(remote.identity);
      replacementCount += screenedRemote.replacementCount;

      if (screenedRemote.replacementCount === 0) {
        key = sha256(`remote:${screenedRemote.text}`);
        displayName = remote.name;
      } else {
        const local = await localIdentity(commonDirectory);

        if (local === null) {
          return { context: null, replacementCount, warning: true };
        }

        key = local.key;
        replacementCount += local.replacementCount;
        displayName = path.basename(worktree);
      }
    } else {
      const local = await localIdentity(commonDirectory);

      if (local === null) {
        return { context: null, replacementCount, warning: true };
      }

      key = local.key;
      replacementCount += local.replacementCount;
      displayName = path.basename(worktree);
    }

    const branchValue = text(
      await runGit(["symbolic-ref", "--quiet", "--short", "HEAD"], cwd),
    );
    const headValue = text(await runGit(["rev-parse", "--verify", "HEAD"], cwd));

    if (
      !fits(displayName, NAME_MAX_BYTES) ||
      (branchValue !== null && !fits(branchValue, BRANCH_MAX_BYTES))
    ) {
      return { context: null, replacementCount, warning: true };
    }

    const name = screen(displayName);
    const branch = branchValue === null ? null : screen(branchValue);
    const screenedCwd = screen(cwdRelative);
    replacementCount +=
      name.replacementCount +
      (branch?.replacementCount ?? 0) +
      screenedCwd.replacementCount;

    return {
      context: {
        key,
        name: name.text,
        branch: branch?.text ?? null,
        head:
          headValue !== null && /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(headValue)
            ? headValue
            : null,
        cwdRelative: screenedCwd.text,
      },
      replacementCount,
      warning: false,
    };
  } catch (error) {
    if (error instanceof FrictionFailure) {
      throw error;
    }

    return { context: null, replacementCount: 0, warning: true };
  }
}
