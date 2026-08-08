import {
  isWindows,
  resolveRuntimePlatform,
  type RuntimePlatform,
} from "./runtime-platform.js";

function environmentKey(name: string, platform: RuntimePlatform): string {
  return isWindows(platform) ? name.toLowerCase() : name;
}

export function getEnvironmentValue(
  name: string,
  environment: NodeJS.ProcessEnv = process.env,
  platform: RuntimePlatform = resolveRuntimePlatform(),
): string | undefined {
  if (!isWindows(platform) || environment[name] !== undefined) {
    return environment[name];
  }

  const requested = name.toLowerCase();

  for (const [key, value] of Object.entries(environment)) {
    if (key.toLowerCase() === requested) {
      return value;
    }
  }

  return undefined;
}

export function buildChildEnvironment(
  overrides: NodeJS.ProcessEnv,
  environment: NodeJS.ProcessEnv = process.env,
  platform: RuntimePlatform = resolveRuntimePlatform(),
): NodeJS.ProcessEnv {
  const entries = new Map<string, { name: string; value: string }>();

  for (const [name, value] of Object.entries(environment)) {
    if (value !== undefined) {
      entries.set(environmentKey(name, platform), { name, value });
    }
  }

  for (const [name, value] of Object.entries(overrides)) {
    const key = environmentKey(name, platform);

    if (value === undefined) {
      entries.delete(key);
      continue;
    }

    const existing = entries.get(key);
    entries.set(key, { name: existing?.name ?? name, value });
  }

  return Object.fromEntries(
    [...entries.values()].map(({ name, value }) => [name, value]),
  );
}
