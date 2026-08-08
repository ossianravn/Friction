import { constants } from "node:fs";
import { access, lstat, stat } from "node:fs/promises";
import path from "node:path";

import { getEnvironmentValue } from "./environment.js";
import {
  resolveRuntimePlatform,
  type RuntimePlatform,
} from "./runtime-platform.js";
import { inspectWindowsPathComponents } from "./windows/reparse.js";

export type ResolvedCommand = {
  path: string;
  kind: "posix" | "windows-executable" | "windows-command";
};

export type CommandResolutionOptions = {
  platform?: RuntimePlatform;
  environment?: NodeJS.ProcessEnv;
  cwd?: string;
};

const defaultWindowsExtensions = [".COM", ".EXE", ".BAT", ".CMD"] as const;

function windowsExtensions(value: string | undefined): string[] {
  if (value === undefined) {
    return [...defaultWindowsExtensions];
  }

  return value
    .split(";")
    .map((extension) => extension.trim())
    .filter((extension) => /^\.[a-zA-Z0-9]+$/.test(extension));
}

function commandKind(candidate: string, platform: RuntimePlatform): ResolvedCommand["kind"] {
  if (platform !== "win32") {
    return "posix";
  }

  const extension = path.win32.extname(candidate).toUpperCase();
  return extension === ".BAT" || extension === ".CMD"
    ? "windows-command"
    : "windows-executable";
}

async function usableCommand(candidate: string, platform: RuntimePlatform): Promise<boolean> {
  if (platform === "win32") {
    const status = await lstat(candidate);

    if (!status.isFile() || status.isSymbolicLink()) {
      return false;
    }

    if (resolveRuntimePlatform() === "win32") {
      await inspectWindowsPathComponents(candidate, candidate, "file");
    }

    return true;
  }

  const status = await stat(candidate);

  if (!status.isFile()) {
    return false;
  }

  await access(candidate, constants.X_OK);
  return true;
}

export async function resolveCommandOnPath(
  name: string,
  options: CommandResolutionOptions = {},
): Promise<ResolvedCommand | null> {
  const platform = options.platform ?? resolveRuntimePlatform();
  const environment = options.environment ?? process.env;
  const pathValue = getEnvironmentValue("PATH", environment, platform);

  if (pathValue === undefined) {
    return null;
  }

  const platformPath = platform === "win32" ? path.win32 : path.posix;
  const names = platform === "win32" && platformPath.extname(name).length === 0
    ? windowsExtensions(getEnvironmentValue("PATHEXT", environment, platform)).map(
        (extension) => `${name}${extension}`,
      )
    : [name];

  for (const directory of pathValue.split(platformPath.delimiter)) {
    const selectedDirectory = directory.length === 0
      ? (options.cwd ?? process.cwd())
      : directory;

    for (const candidateName of names) {
      const candidate = platformPath.join(selectedDirectory, candidateName);

      try {
        if (await usableCommand(candidate, platform)) {
          return { path: candidate, kind: commandKind(candidate, platform) };
        }
      } catch {
        // Continue checking the remaining candidates and PATH entries.
      }
    }
  }

  return null;
}

export async function executableOnPath(name: string): Promise<boolean> {
  return (await resolveCommandOnPath(name)) !== null;
}
