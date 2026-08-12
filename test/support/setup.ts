import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

export async function treeBytes(root: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};

  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute);

      if (entry.isDirectory()) {
        result[`${relative}/`] = "directory";
        await visit(absolute);
      } else {
        const mode = (await stat(absolute)).mode & 0o777;
        const bytes = (await readFile(absolute)).toString("base64");
        result[relative] = `${mode}:${bytes}`;
      }
    }
  }

  await visit(root);
  return result;
}
