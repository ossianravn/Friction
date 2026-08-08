import path from "node:path";

import { FrictionFailure } from "../../domain/failures.js";
import { assertSafeWindowsAbsolutePath } from "./path-policy.js";
import { runEncodedWindowsPowerShell } from "./powershell.js";
import { windowsReparseScript } from "./reparse-script.js";

export type SafePathInspection = {
  exists: boolean;
  kind: "file" | "directory" | "other" | "missing";
  reparsePoint: boolean;
};

type ExpectedKind = "file" | "directory" | "file-or-missing" | "directory-or-missing";

function isInspection(value: unknown): value is SafePathInspection {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record["exists"] === "boolean" &&
    ["file", "directory", "other", "missing"].includes(String(record["kind"])) &&
    typeof record["reparsePoint"] === "boolean" &&
    record["exists"] === (record["kind"] !== "missing");
}

function contained(root: string, target: string): boolean {
  const relative = path.win32.relative(root, target);
  return relative !== ".." &&
    !relative.startsWith(`..${path.win32.sep}`) &&
    !path.win32.isAbsolute(relative);
}

function componentPaths(root: string, target: string): string[] {
  const relative = path.win32.relative(root, target);
  const parts = relative === "" ? [] : relative.split(path.win32.sep);
  const components = [root];

  for (const part of parts) {
    components.push(path.win32.join(components.at(-1)!, part));
  }

  return components;
}

function expectedTarget(inspection: SafePathInspection, expected: ExpectedKind): boolean {
  if (expected === "file-or-missing") {
    return inspection.kind === "file" || inspection.kind === "missing";
  }

  if (expected === "directory-or-missing") {
    return inspection.kind === "directory" || inspection.kind === "missing";
  }

  return inspection.kind === expected;
}

function safeKinds(
  items: readonly SafePathInspection[],
  expected: ExpectedKind,
): boolean {
  const missingIndex = items.findIndex((item) => item.kind === "missing");

  if (missingIndex >= 0) {
    const missingAllowed = expected.endsWith("-or-missing");
    return missingAllowed &&
      items.slice(0, missingIndex).every((item) => item.kind === "directory") &&
      items.slice(missingIndex).every((item) => item.kind === "missing");
  }

  return items.slice(0, -1).every((item) => item.kind === "directory") &&
    expectedTarget(items.at(-1)!, expected);
}

export async function inspectWindowsPathComponents(
  rootValue: string,
  targetValue: string,
  expected: ExpectedKind,
): Promise<SafePathInspection> {
  const root = assertSafeWindowsAbsolutePath(rootValue);
  const target = assertSafeWindowsAbsolutePath(targetValue);

  if (!contained(root, target)) {
    throw new FrictionFailure("safety_failure");
  }

  const components = componentPaths(root, target);
  const output = await runEncodedWindowsPowerShell(windowsReparseScript, {
    FRICTION_WINDOWS_PATH_COMPONENTS: JSON.stringify(components),
  });
  let value: unknown;

  try {
    value = JSON.parse(output.trim());
  } catch {
    throw new FrictionFailure("safety_failure");
  }

  const record = value as { items?: unknown };
  const items = record?.items;

  if (!Array.isArray(items) || items.length !== components.length || !items.every(isInspection)) {
    throw new FrictionFailure("safety_failure");
  }

  const targetInspection = items.at(-1)!;

  if (
    items.some((item) => item.reparsePoint) ||
    !safeKinds(items, expected)
  ) {
    throw new FrictionFailure("safety_failure");
  }

  return targetInspection;
}
