import { spawn } from "node:child_process";

const MAXIMUM_STDOUT_BYTES = 64 * 1_024;

export type GitCommandResult =
  | { status: "ok"; stdout: string }
  | { status: "failed" }
  | { status: "unavailable" };

export async function runGit(
  arguments_: readonly string[],
  cwd: string,
): Promise<GitCommandResult> {
  return new Promise((resolve) => {
    const child = spawn("git", arguments_, {
      cwd,
      env: {
        ...process.env,
        GIT_OPTIONAL_LOCKS: "0",
        GIT_TERMINAL_PROMPT: "0",
        LC_ALL: "C",
      },
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5_000,
    });
    const chunks: Buffer[] = [];
    let byteCount = 0;
    let settled = false;
    let overflowed = false;

    const settle = (result: GitCommandResult): void => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };

    child.stdout.on("data", (chunk: Buffer) => {
      byteCount += chunk.length;

      if (byteCount > MAXIMUM_STDOUT_BYTES) {
        overflowed = true;
        child.kill();
        return;
      }

      chunks.push(chunk);
    });
    child.on("error", () => settle({ status: "unavailable" }));
    child.on("close", (code) => {
      if (overflowed || code !== 0) {
        settle({ status: "failed" });
        return;
      }

      settle({ status: "ok", stdout: Buffer.concat(chunks).toString("utf8") });
    });
  });
}
