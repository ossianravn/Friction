import path from "node:path";

import { FrictionFailure } from "../../domain/failures.js";

const reservedNames = new Set([
  "CON",
  "PRN",
  "AUX",
  "NUL",
  ...Array.from({ length: 9 }, (_, index) => `COM${index + 1}`),
  ...Array.from({ length: 9 }, (_, index) => `LPT${index + 1}`),
]);

function invalidComponent(component: string): boolean {
  const baseName = component.split(".", 1)[0]?.toUpperCase() ?? "";

  return (
    component.endsWith(" ") ||
    component.endsWith(".") ||
    component.includes(":") ||
    /[<>"|?*\u0001-\u001f]/u.test(component) ||
    reservedNames.has(baseName)
  );
}

export function assertSafeWindowsPathInput(value: string): string {
  if (value.length === 0 || value.includes("\0")) {
    throw new FrictionFailure("invalid_input");
  }

  const native = value.replaceAll("/", "\\");
  const lower = native.toLowerCase();

  if (
    lower.startsWith("\\\\.\\") ||
    lower.startsWith("\\\\?\\") ||
    lower.startsWith("\\??\\") ||
    /^[a-zA-Z]:(?!\\)/.test(native)
  ) {
    throw new FrictionFailure("invalid_input");
  }

  return native;
}

export function assertSafeWindowsAbsolutePath(value: string): string {
  const native = assertSafeWindowsPathInput(value);
  const unc = native.startsWith("\\\\");
  let components: string[];

  if (unc) {
    components = native.slice(2).split("\\");

    if (
      components.length < 2 ||
      components[0]?.length === 0 ||
      components[1]?.length === 0
    ) {
      throw new FrictionFailure("invalid_input");
    }
  } else {
    if (!/^[a-zA-Z]:\\/.test(native)) {
      throw new FrictionFailure("invalid_input");
    }

    components = native.slice(3).split("\\");
  }

  const nonempty = components.filter((part) => part.length > 0);

  if (nonempty.some(invalidComponent)) {
    throw new FrictionFailure("invalid_input");
  }

  return path.win32.normalize(native);
}

export function assertSafeWindowsPrivateHome(value: string): string {
  const safe = assertSafeWindowsAbsolutePath(value);

  if (safe.startsWith("\\\\")) {
    throw new FrictionFailure("invalid_input");
  }

  return safe;
}
