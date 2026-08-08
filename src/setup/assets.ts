import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const packageRoot = fileURLToPath(new URL("../../", import.meta.url));

export type SkillAsset = {
  assetId: string;
  relativePath: string;
  bytes: Buffer;
};

export type SetupAssets = {
  captureShared: string;
  capturePosix: string;
  capturePowerShell: string;
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
      assets.push({
        assetId: relativePath.split(path.sep).join("/"),
        relativePath,
        bytes: await readFile(absolutePath),
      });
    }
  }

  return assets;
}

export async function loadSetupAssets(): Promise<SetupAssets> {
  const instructionRoot = path.join(packageRoot, "assets", "instructions");
  const [captureShared, capturePosix, capturePowerShell] = await Promise.all([
    readFile(path.join(instructionRoot, "capture-shared.md"), "utf8"),
    readFile(path.join(instructionRoot, "capture-posix.md"), "utf8"),
    readFile(path.join(instructionRoot, "capture-powershell.md"), "utf8"),
  ]);
  const skills: SkillAsset[] = [];

  for (const skillName of ["friction-review", "friction-fix"] as const) {
    const skillRoot = path.join(packageRoot, "skills", skillName);
    const files = await readDirectory(skillRoot);

    for (const file of files) {
      skills.push({
        assetId: `${skillName}/${file.assetId}`,
        relativePath: path.join(skillName, file.relativePath),
        bytes: file.bytes,
      });
    }
  }

  return { captureShared, capturePosix, capturePowerShell, skills };
}

export function captureInstruction(
  assets: SetupAssets,
  source: "codex" | "claude-code" | "generic",
  shell: "posix" | "powershell",
): Buffer {
  const command = captureCommand(assets, source, shell);
  return Buffer.from(assets.captureShared.replace("{{COMMAND}}", command), "utf8");
}

function captureCommand(
  assets: SetupAssets,
  source: "codex" | "claude-code" | "generic",
  shell: "posix" | "powershell",
): string {
  const template = shell === "powershell"
    ? assets.capturePowerShell
    : assets.capturePosix;
  return template.replaceAll("{{SOURCE}}", source).trimEnd();
}

export function genericCaptureSnippet(
  assets: SetupAssets,
  windows: boolean,
): string {
  const skills = `Skills: ${packagedSkillPaths().join(", ")}`;

  if (!windows) {
    return `${captureCommand(assets, "generic", "posix")}\n${skills}`;
  }

  return [
    "PowerShell:",
    captureCommand(assets, "generic", "powershell"),
    "",
    "Git Bash:",
    captureCommand(assets, "generic", "posix"),
    skills,
  ].join("\n");
}

export function packagedSkillPaths(): string[] {
  return [
    path.join(packageRoot, "skills", "friction-review"),
    path.join(packageRoot, "skills", "friction-fix"),
  ];
}
