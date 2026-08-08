import { spawn } from "node:child_process";

import { buildChildEnvironment } from "./environment.js";
import { resolveRuntimePlatform } from "./runtime-platform.js";

const MAXIMUM_OUTPUT_BYTES = 64 * 1_024;
export type GitCommandResult =
  | { status: "ok"; stdout: string }
  | { status: "failed" }
  | { status: "interrupted" }
  | { status: "unavailable" };

function normalizedText(bytes: Buffer): string {
  return bytes.toString("utf8").replaceAll("\r\n", "\n").replaceAll("\r", "\n");
}

export async function runGit(
  arguments_: readonly string[],
  cwd: string,
): Promise<GitCommandResult> {
  const platform = resolveRuntimePlatform();
  return new Promise((resolve) => {
    let child;

    try {
      child = spawn("git", arguments_, {
        cwd,
        env: buildChildEnvironment({
          GIT_OPTIONAL_LOCKS: "0",
          GIT_TERMINAL_PROMPT: "0",
          ...(platform === "win32" ? {} : { LC_ALL: "C" }),
        }),
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: platform === "win32",
      });
    } catch {
      resolve({ status: "unavailable" });
      return;
    }

    const stdout: Buffer[] = [];
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
      settle({ status: "interrupted" });
    }, 5_000);

    child.stdout.on("data", (chunk: Buffer) => {
      byteCount += chunk.length;

      if (byteCount > MAXIMUM_OUTPUT_BYTES) {
        interrupted = true;
        child.kill();
        settle({ status: "interrupted" });
        return;
      }

      stdout.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      byteCount += chunk.length;

      if (byteCount > MAXIMUM_OUTPUT_BYTES) {
        interrupted = true;
        child.kill();
        settle({ status: "interrupted" });
        return;
      }

    });
    child.on("error", () => settle({ status: "unavailable" }));
    child.on("close", (code, signal) => {
      if (interrupted || signal !== null) {
        settle({ status: "interrupted" });
        return;
      }

      if (code !== 0) {
        settle({ status: "failed" });
        return;
      }

      settle({ status: "ok", stdout: normalizedText(Buffer.concat(stdout)) });
    });
  });
}
