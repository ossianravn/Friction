import { spawn } from "node:child_process";

const MAXIMUM_OUTPUT_BYTES = 64 * 1_024;
const OUTSIDE_REPOSITORY_ERROR =
  "fatal: not a git repository (or any of the parent directories): .git";

export type GitCommandResult =
  | { status: "ok"; stdout: string }
  | { status: "failed"; reason: "not-repository" | "command" }
  | { status: "interrupted" }
  | { status: "unavailable" };

function failureReason(stderr: Buffer[]): "not-repository" | "command" {
  return Buffer.concat(stderr).toString("utf8").trim() === OUTSIDE_REPOSITORY_ERROR
    ? "not-repository"
    : "command";
}

export async function runGit(
  arguments_: readonly string[],
  cwd: string,
): Promise<GitCommandResult> {
  return new Promise((resolve) => {
    let child;

    try {
      child = spawn("git", arguments_, {
        cwd,
        env: {
          ...process.env,
          GIT_OPTIONAL_LOCKS: "0",
          GIT_TERMINAL_PROMPT: "0",
          LC_ALL: "C",
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch {
      resolve({ status: "unavailable" });
      return;
    }

    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let byteCount = 0;
    let settled = false;
    let interrupted = false;
    let timer: NodeJS.Timeout | undefined;

    const settle = (result: GitCommandResult): void => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(result);
      }
    };

    timer = setTimeout(() => {
      interrupted = true;
      child.kill();
    }, 5_000);

    child.stdout.on("data", (chunk: Buffer) => {
      byteCount += chunk.length;

      if (byteCount > MAXIMUM_OUTPUT_BYTES) {
        interrupted = true;
        child.kill();
        return;
      }

      stdout.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      byteCount += chunk.length;

      if (byteCount > MAXIMUM_OUTPUT_BYTES) {
        interrupted = true;
        child.kill();
        return;
      }

      stderr.push(chunk);
    });
    child.on("error", () => settle({ status: "unavailable" }));
    child.on("close", (code, signal) => {
      if (interrupted || signal !== null) {
        settle({ status: "interrupted" });
        return;
      }

      if (code !== 0) {
        settle({ status: "failed", reason: failureReason(stderr) });
        return;
      }

      settle({ status: "ok", stdout: Buffer.concat(stdout).toString("utf8") });
    });
  });
}
