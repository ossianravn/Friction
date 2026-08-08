import { spawn } from "node:child_process";
import { lstat } from "node:fs/promises";
import path from "node:path";

import { FrictionFailure } from "../../domain/failures.js";
import {
  buildChildEnvironment,
  getEnvironmentValue,
} from "../environment.js";
import { resolveRuntimePlatform } from "../runtime-platform.js";
import { assertSafeWindowsPrivateHome } from "./path-policy.js";

const MAXIMUM_OUTPUT_BYTES = 16 * 1_024;
const TIMEOUT_MILLISECONDS = 15_000;

function executablePath(environment: NodeJS.ProcessEnv = process.env): string {
  const systemRoot = getEnvironmentValue("SystemRoot", environment, "win32");

  if (systemRoot === undefined || systemRoot.length === 0) {
    throw new FrictionFailure("configuration_error");
  }

  try {
    return path.win32.join(
      assertSafeWindowsPrivateHome(systemRoot),
      "System32",
      "WindowsPowerShell",
      "v1.0",
      "powershell.exe",
    );
  } catch (error) {
    if (error instanceof FrictionFailure) {
      throw new FrictionFailure("configuration_error");
    }

    throw error;
  }
}

export async function windowsPowerShellAvailable(): Promise<boolean> {
  if (resolveRuntimePlatform() !== "win32") {
    return false;
  }

  try {
    const status = await lstat(executablePath());
    return status.isFile() && !status.isSymbolicLink();
  } catch {
    return false;
  }
}

export async function runEncodedWindowsPowerShell(
  script: string,
  environmentOverrides: NodeJS.ProcessEnv,
): Promise<string> {
  if (resolveRuntimePlatform() !== "win32") {
    throw new FrictionFailure("unsupported_platform");
  }

  const encoded = Buffer.from(script, "utf16le").toString("base64");
  const executable = executablePath();
  const blockedProfileRoot = path.win32.join(executable, "profile");

  return new Promise((resolve, reject) => {
    let child;

    try {
      child = spawn(
        executable,
        ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
        {
          env: buildChildEnvironment(
            {
              ...environmentOverrides,
              APPDATA: blockedProfileRoot,
              HOME: blockedProfileRoot,
              LOCALAPPDATA: blockedProfileRoot,
              PSModuleAnalysisCachePath: "NUL",
              PSModulePath: blockedProfileRoot,
              USERPROFILE: blockedProfileRoot,
            },
            process.env,
            "win32",
          ),
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
    } catch {
      reject(new FrictionFailure("safety_failure"));
      return;
    }

    const stdout: Buffer[] = [];
    let outputBytes = 0;
    let interrupted = false;
    let settled = false;
    const timer = setTimeout(() => {
      interrupted = true;
      child.kill();
      fail();
    }, TIMEOUT_MILLISECONDS);

    const fail = (): void => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new FrictionFailure("safety_failure"));
      }
    };

    child.stdout.on("data", (chunk: Buffer) => {
      outputBytes += chunk.length;

      if (outputBytes > MAXIMUM_OUTPUT_BYTES) {
        interrupted = true;
        child.kill();
        fail();
        return;
      }

      stdout.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      outputBytes += chunk.length;

      if (outputBytes > MAXIMUM_OUTPUT_BYTES) {
        interrupted = true;
        child.kill();
        fail();
      }
    });
    child.on("error", fail);
    child.on("close", (code, signal) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);

      if (interrupted || signal !== null || code !== 0) {
        reject(new FrictionFailure("safety_failure"));
        return;
      }

      resolve(Buffer.concat(stdout).toString("utf8"));
    });
  });
}
