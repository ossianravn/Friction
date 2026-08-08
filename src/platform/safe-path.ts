import { homedir } from "node:os";
import path from "node:path";

import { FrictionFailure } from "../domain/failures.js";
import { getEnvironmentValue } from "./environment.js";
import {
  resolveRuntimePlatform,
  type RuntimePlatform,
} from "./runtime-platform.js";
import { assertSafeWindowsPrivateHome } from "./windows/path-policy.js";

export type PrivateHomeOptions = {
  platform?: RuntimePlatform;
  environment?: NodeJS.ProcessEnv;
  homeDirectory?: string;
};

export function assertPathInsideRoot(
  rootValue: string,
  targetValue: string,
  platform: RuntimePlatform = resolveRuntimePlatform(),
): void {
  const platformPath = platform === "win32" ? path.win32 : path.posix;
  const root = platformPath.resolve(rootValue);
  const target = platformPath.resolve(targetValue);
  const relative = platformPath.relative(root, target);

  if (
    relative === ".." ||
    relative.startsWith(`..${platformPath.sep}`) ||
    platformPath.isAbsolute(relative)
  ) {
    throw new FrictionFailure("safety_failure");
  }
}

export function resolvePrivateHome(options: PrivateHomeOptions = {}): string {
  const platform = options.platform ?? resolveRuntimePlatform();
  const environment = options.environment ?? process.env;
  const configured = getEnvironmentValue("FRICTION_HOME", environment, platform);

  if (configured !== undefined && configured.length > 0) {
    return platform === "win32"
      ? assertSafeWindowsPrivateHome(configured)
      : path.posix.resolve(configured);
  }

  if (platform === "win32") {
    const localAppData = getEnvironmentValue("LOCALAPPDATA", environment, platform);

    if (localAppData === undefined || localAppData.length === 0) {
      throw new FrictionFailure("configuration_error");
    }

    try {
      return path.win32.join(
        assertSafeWindowsPrivateHome(localAppData),
        "friction",
      );
    } catch (error) {
      if (error instanceof FrictionFailure) {
        throw new FrictionFailure("configuration_error");
      }

      throw error;
    }
  }

  const homeDirectory = options.homeDirectory ?? homedir();

  if (platform === "darwin") {
    return path.posix.join(homeDirectory, "Library", "Application Support", "friction");
  }

  const dataHome = getEnvironmentValue("XDG_DATA_HOME", environment, platform);
  return dataHome !== undefined && dataHome.length > 0
    ? path.posix.resolve(dataHome, "friction")
    : path.posix.join(homeDirectory, ".local", "share", "friction");
}
