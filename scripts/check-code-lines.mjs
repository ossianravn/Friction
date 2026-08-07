import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const maximumLines = 300;
const roots = ["src", "test", "scripts"];
const codeExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);
const ignoredDirectories = new Set([
  "coverage",
  "dist",
  "generated",
  "node_modules",
]);

async function collectCodeFiles(directory) {
  let entries;

  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory() && !ignoredDirectories.has(entry.name)) {
      files.push(...(await collectCodeFiles(entryPath)));
    } else if (entry.isFile() && codeExtensions.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }

  return files;
}

function countPhysicalLines(contents) {
  if (contents.length === 0) {
    return 0;
  }

  const lineBreaks = contents.match(/\r\n|\r|\n/g)?.length ?? 0;
  const endsWithLineBreak = /(?:\r\n|\r|\n)$/.test(contents);

  return lineBreaks + (endsWithLineBreak ? 0 : 1);
}

const files = (await Promise.all(roots.map(collectCodeFiles))).flat().sort();
const violations = [];

for (const file of files) {
  const contents = await readFile(file, "utf8");
  const lineCount = countPhysicalLines(contents);

  if (lineCount > maximumLines) {
    violations.push({ file, lineCount });
  }
}

if (violations.length > 0) {
  for (const violation of violations) {
    console.error(
      `${violation.file}: ${violation.lineCount} lines (maximum ${maximumLines})`,
    );
  }

  process.exitCode = 1;
} else {
  console.log(
    `Code line limit passed: ${files.length} files checked (maximum ${maximumLines}).`,
  );
}
