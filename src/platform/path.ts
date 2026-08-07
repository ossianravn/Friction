import { constants } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";

export async function executableOnPath(name: string): Promise<boolean> {
  const pathValue = process.env["PATH"];

  if (pathValue === undefined) {
    return false;
  }

  for (const directory of pathValue.split(path.delimiter)) {
    const candidate = path.join(directory.length === 0 ? process.cwd() : directory, name);

    try {
      await access(candidate, constants.X_OK);
      return true;
    } catch {
      // Continue checking the remaining PATH entries.
    }
  }

  return false;
}
