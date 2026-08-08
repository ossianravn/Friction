import { FrictionFailure } from "../domain/failures.js";

export const runtimePlatforms = ["darwin", "linux", "win32"] as const;

export type RuntimePlatform = (typeof runtimePlatforms)[number];

export const nativeWindowsBaseline = {
  user: "Windows 11 x64",
  ci: "windows-2025",
  nodeMajor: 24,
  privateStoreFileSystem: "NTFS",
  privateStoreNetworkPaths: false,
} as const;

export function resolveRuntimePlatform(
  value: NodeJS.Platform = process.platform,
): RuntimePlatform {
  if (value === "darwin" || value === "linux" || value === "win32") {
    return value;
  }

  throw new FrictionFailure("unsupported_platform");
}

export function isWindows(platform: RuntimePlatform): boolean {
  return platform === "win32";
}
