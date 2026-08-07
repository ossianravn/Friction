import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const binPath = path.join(repositoryRoot, "src", "bin", "friction.ts");
const tsxImport = import.meta.resolve("tsx");

export type ProcessResult = {
  code: number;
  stdout: string;
  stderr: string;
};

type RunOptions = {
  cwd: string;
  environment?: NodeJS.ProcessEnv;
  stdin?: string | undefined;
};

export async function runProcess(
  executable: string,
  arguments_: readonly string[],
  options: RunOptions,
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const hasInput = options.stdin !== undefined;
    const child = spawn(executable, arguments_, {
      cwd: options.cwd,
      env: options.environment ?? process.env,
      stdio: [hasInput ? "pipe" : "ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let settled = false;

    const fail = (error: Error): void => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    };

    child.stdout!.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr!.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", fail);
    child.on("close", (code) => {
      if (settled) {
        return;
      }

      settled = true;
      resolve({
        code: code ?? 1,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });

    if (hasInput) {
      child.stdin!.on("error", (error: NodeJS.ErrnoException) => {
        if (error.code !== "EPIPE") {
          fail(error);
        }
      });
      child.stdin!.end(options.stdin);
    }
  });
}

export async function runFriction(options: {
  arguments: readonly string[];
  cwd: string;
  home: string;
  environment?: NodeJS.ProcessEnv;
  stdin?: string;
}): Promise<ProcessResult> {
  return runProcess(
    process.execPath,
    ["--import", tsxImport, binPath, ...options.arguments],
    {
      cwd: options.cwd,
      environment: {
        ...process.env,
        HOME: path.dirname(options.home),
        ...options.environment,
        FRICTION_HOME: options.home,
      },
      stdin: options.stdin,
    },
  );
}

export async function runGit(
  cwd: string,
  arguments_: readonly string[],
): Promise<string> {
  const result = await runProcess("git", arguments_, { cwd });

  if (result.code !== 0) {
    throw new Error(`git command failed: ${result.stderr}`);
  }

  return result.stdout.trim();
}
