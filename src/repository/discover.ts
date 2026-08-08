import { createHash } from "node:crypto";
import { lstat, readdir, realpath } from "node:fs/promises";
import path from "node:path";

import type { RepositoryContext } from "../domain/events.js";
import { FrictionFailure } from "../domain/failures.js";
import { getEnvironmentValue } from "../platform/environment.js";
import {
  BRANCH_MAX_BYTES,
  CWD_RELATIVE_MAX_BYTES,
  fitsUtf8,
  REPOSITORY_IDENTITY_MAX_BYTES,
  REPOSITORY_NAME_MAX_BYTES,
} from "../domain/limits.js";
import { runGit, type GitCommandResult } from "../platform/git.js";
import { redact } from "../security/redact.js";
import { normalizeRemote, type NormalizedRemote } from "./remote.js";

export type RepositoryDiscovery =
  | { state: "not-repository"; replacementCount: 0 }
  | {
      state: "repository";
      context: RepositoryContext;
      replacementCount: number;
    }
  | { state: "repository-unavailable"; replacementCount: number };

type RemoteDiscovery =
  | { state: "available"; remote: NormalizedRemote | null }
  | { state: "unavailable" };

function text(result: GitCommandResult): string | null {
  return result.status === "ok" ? result.stdout.trim() : null;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function screen(value: string): ReturnType<typeof redact> {
  try {
    return redact(value);
  } catch {
    throw new FrictionFailure("safety_failure");
  }
}

function isMissing(error: unknown): boolean {
  return error !== null &&
    typeof error === "object" &&
    "code" in error &&
    (error.code === "ENOENT" || error.code === "ENOTDIR");
}

async function repositoryMarkerPresent(cwd: string): Promise<boolean> {
  if (
    getEnvironmentValue("GIT_DIR") ||
    getEnvironmentValue("GIT_WORK_TREE")
  ) {
    return true;
  }

  let directory: string;
  try {
    directory = await realpath(cwd);
  } catch {
    return true;
  }

  while (true) {
    try {
      const marker = path.join(directory, ".git");
      const status = await lstat(marker);

      if (status.isFile()) {
        if (status.size > 0) {
          return true;
        }
      } else if (status.isDirectory()) {
        if ((await readdir(marker)).length > 0) {
          return true;
        }
      } else {
        return true;
      }
    } catch (error) {
      if (!isMissing(error)) {
        return true;
      }
    }

    const parent = path.dirname(directory);
    if (parent === directory) {
      return false;
    }
    directory = parent;
  }
}

async function selectedRemote(cwd: string): Promise<RemoteDiscovery> {
  const namesResult = await runGit(["remote"], cwd);

  if (namesResult.status !== "ok") {
    return { state: "unavailable" };
  }

  const names = namesResult.stdout
    .trim()
    .split("\n")
    .map((name) => name.trim())
    .filter((name) => name.length > 0);

  const selectedName = names.includes("origin")
    ? "origin"
    : names.length === 1
      ? names[0]
      : undefined;

  if (selectedName === undefined) {
    return { state: "available", remote: null };
  }

  const urlResult = await runGit(["remote", "get-url", selectedName], cwd);

  if (urlResult.status !== "ok") {
    return { state: "unavailable" };
  }

  return {
    state: "available",
    remote: normalizeRemote(urlResult.stdout.trim()),
  };
}

async function localIdentity(
  commonDirectory: string,
): Promise<{ key: string; replacementCount: number } | null> {
  if (!fitsUtf8(commonDirectory, REPOSITORY_IDENTITY_MAX_BYTES)) {
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
  const topLevelResult = await runGit(
    ["rev-parse", "--path-format=absolute", "--show-toplevel"],
    cwd,
  );

  if (
    topLevelResult.status === "failed" &&
    !(await repositoryMarkerPresent(cwd))
  ) {
    return { state: "not-repository", replacementCount: 0 };
  }

  if (topLevelResult.status !== "ok") {
    return { state: "repository-unavailable", replacementCount: 0 };
  }

  const commonResult = await runGit(
    ["rev-parse", "--path-format=absolute", "--git-common-dir"],
    cwd,
  );

  if (commonResult.status !== "ok") {
    return { state: "repository-unavailable", replacementCount: 0 };
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
      !fitsUtf8(cwdRelative, CWD_RELATIVE_MAX_BYTES)
    ) {
      return { state: "repository-unavailable", replacementCount: 0 };
    }

    const remoteDiscovery = await selectedRemote(cwd);

    if (remoteDiscovery.state === "unavailable") {
      return { state: "repository-unavailable", replacementCount: 0 };
    }

    const remote = remoteDiscovery.remote;
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
          return { state: "repository-unavailable", replacementCount };
        }

        key = local.key;
        replacementCount += local.replacementCount;
        displayName = path.basename(worktree);
      }
    } else {
      const local = await localIdentity(commonDirectory);

      if (local === null) {
        return { state: "repository-unavailable", replacementCount };
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
      !fitsUtf8(displayName, REPOSITORY_NAME_MAX_BYTES) ||
      (branchValue !== null && !fitsUtf8(branchValue, BRANCH_MAX_BYTES))
    ) {
      return { state: "repository-unavailable", replacementCount };
    }

    const name = screen(displayName);
    const branch = branchValue === null ? null : screen(branchValue);
    const screenedCwd = screen(cwdRelative);
    replacementCount +=
      name.replacementCount +
      (branch?.replacementCount ?? 0) +
      screenedCwd.replacementCount;

    return {
      state: "repository",
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
    };
  } catch (error) {
    if (error instanceof FrictionFailure) {
      throw error;
    }

    return { state: "repository-unavailable", replacementCount: 0 };
  }
}
