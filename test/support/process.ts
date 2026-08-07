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
    const child = spawn(executable, arguments_, {
      cwd: options.cwd,
      env: options.environment ?? process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        code: code ?? 1,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
    child.stdin.end(options.stdin ?? "");
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
