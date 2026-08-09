import { spawn } from "node:child_process";

export function childEnvironment(overrides) {
  const entries = new Map();

  for (const [name, value] of Object.entries({ ...process.env, ...overrides })) {
    if (value !== undefined) {
      entries.set(process.platform === "win32" ? name.toLowerCase() : name, {
        name,
        value,
      });
    }
  }

  return Object.fromEntries([...entries.values()].map(({ name, value }) => [name, value]));
}

export function createProcessRunner(defaultCwd) {
  async function run(command, arguments_, options = {}) {
    return new Promise((resolve, reject) => {
      const hasInput = options.input !== undefined;
      const child = spawn(command, arguments_, {
        cwd: options.cwd ?? defaultCwd,
        env: options.env ?? process.env,
        stdio: [hasInput ? "pipe" : "ignore", "pipe", "pipe"],
        windowsHide: process.platform === "win32",
      });
      const stdout = [];
      const stderr = [];
      let settled = false;
      const fail = (error) => {
        if (!settled) {
          settled = true;
          reject(error);
        }
      };
      child.stdout.on("data", (chunk) => stdout.push(chunk));
      child.stderr.on("data", (chunk) => stderr.push(chunk));
      child.on("error", fail);
      child.on("close", (code) => {
        if (settled) {
          return;
        }

        settled = true;
        const result = {
          stdout: Buffer.concat(stdout).toString("utf8"),
          stderr: Buffer.concat(stderr).toString("utf8"),
        };

        if (code === 0) {
          resolve(result);
        } else {
          reject(new Error(`${command} exited ${code}: ${result.stderr}`));
        }
      });

      if (hasInput) {
        child.stdin.on("error", (error) => {
          if (error.code !== "EPIPE") {
            fail(error);
          }
        });
        child.stdin.end(options.input);
      }
    });
  }

  function runNpm(arguments_, options = {}) {
    const npmEntry = process.env.npm_execpath;

    if (npmEntry === undefined || npmEntry.length === 0) {
      throw new Error("Package smoke requires npm's executable entry point.");
    }

    return run(process.execPath, [npmEntry, ...arguments_], options);
  }

  return { run, runNpm };
}
