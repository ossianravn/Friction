import { lstat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import { FrictionFailure } from "../domain/failures.js";

export type FrictionPaths = {
  home: string;
  events: string;
  temporary: string;
};

function selectedHomePath(): string {
  const configuredHome = process.env["FRICTION_HOME"];

  if (configuredHome !== undefined && configuredHome.length > 0) {
    return configuredHome;
  }

  if (process.platform === "darwin") {
    return path.join(homedir(), "Library", "Application Support", "friction");
  }

  if (process.platform === "linux") {
    const dataHome = process.env["XDG_DATA_HOME"];
    return dataHome !== undefined && dataHome.length > 0
      ? path.join(dataHome, "friction")
      : path.join(homedir(), ".local", "share", "friction");
  }

  throw new FrictionFailure("unsupported_platform");
}

export function resolveFrictionPaths(): FrictionPaths {
  const home = path.resolve(selectedHomePath());

  return {
    home,
    events: path.join(home, "v1", "events"),
    temporary: path.join(home, "v1", "tmp"),
  };
}

export async function rejectUnsafeStoreDirectory(directory: string): Promise<void> {
  try {
    const status = await lstat(directory);

    if (status.isSymbolicLink() || !status.isDirectory()) {
      throw new FrictionFailure("safety_failure");
    }
  } catch (error) {
    if (
      error !== null &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return;
    }

    throw error;
  }
}

export const rejectSymlinkedHome = rejectUnsafeStoreDirectory;
