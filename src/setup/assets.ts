import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const packageRoot = fileURLToPath(new URL("../../", import.meta.url));

export type SkillAsset = {
  relativePath: string;
  bytes: Buffer;
};

export type SetupAssets = {
  captureTemplate: string;
  skills: SkillAsset[];
};

async function readDirectory(
  directory: string,
  relativeDirectory: string = "",
): Promise<SkillAsset[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const assets: SkillAsset[] = [];

  for (const entry of entries.sort((left, right) =>
    left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
  )) {
    const relativePath = path.join(relativeDirectory, entry.name);
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      assets.push(...(await readDirectory(absolutePath, relativePath)));
    } else if (entry.isFile()) {
      assets.push({ relativePath, bytes: await readFile(absolutePath) });
    }
  }

  return assets;
}

export async function loadSetupAssets(): Promise<SetupAssets> {
  const captureTemplate = await readFile(
    path.join(packageRoot, "assets", "instructions", "capture.md"),
    "utf8",
  );
  const skills: SkillAsset[] = [];

  for (const skillName of ["friction-review", "friction-fix"] as const) {
    const skillRoot = path.join(packageRoot, "skills", skillName);
    const files = await readDirectory(skillRoot);

    for (const file of files) {
      skills.push({
        relativePath: path.join(skillName, file.relativePath),
        bytes: file.bytes,
      });
    }
  }

  return { captureTemplate, skills };
}

export function captureInstruction(
  template: string,
  source: "codex" | "claude-code" | "generic",
): Buffer {
  return Buffer.from(template.replaceAll("{{SOURCE}}", source), "utf8");
}

export function packagedSkillPaths(): string[] {
  return [
    path.join(packageRoot, "skills", "friction-review"),
    path.join(packageRoot, "skills", "friction-fix"),
  ];
}
