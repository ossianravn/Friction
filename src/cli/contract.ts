import type { ImplementedCommand } from "./requests.js";

export type CommandEffects = {
  readOnly: boolean;
  appendsPrivate: boolean;
  destructive: boolean;
  writesRepository: boolean;
  writesConfiguration: boolean;
  previewDefault: boolean;
};

export type CommandContract = {
  purpose: string;
  syntax: readonly string[];
  options: readonly { name: string; description: string }[];
  notes: readonly string[];
  effects: CommandEffects;
};

const readOnly: CommandEffects = {
  readOnly: true,
  appendsPrivate: false,
  destructive: false,
  writesRepository: false,
  writesConfiguration: false,
  previewDefault: false,
};

const privateAppend: CommandEffects = {
  ...readOnly,
  readOnly: false,
  appendsPrivate: true,
};

const readScopeNote =
  "Defaults to current in safely attributed Git repositories and to all only outside Git; unavailable attribution fails with not_found.";

export const commandNames = [
  "add",
  "list",
  "stats",
  "resolve",
  "reopen",
  "export",
  "publish",
  "purge",
  "doctor",
  "setup",
  "schema",
] as const satisfies readonly ImplementedCommand[];

export const commandContract: Record<ImplementedCommand, CommandContract> = {
  add: {
    purpose: "Record one screened observation in the private store.",
    syntax: ["friction add TEXT", "friction add --stdin [options]"],
    options: [
      { name: "--stdin", description: "Read the body from stdin; recommended for agents." },
      { name: "--source SOURCE", description: "Set manual, codex, claude-code, or generic." },
      { name: "--model MODEL", description: "Record optional screened model context." },
      { name: "--area AREA", description: "Record one supported product area." },
      { name: "--impact IMPACT", description: "Record a repeatable supported impact." },
    ],
    notes: ["Provide exactly one positional body or --stdin, never both."],
    effects: privateAppend,
  },
  list: {
    purpose: "List screened private observations.",
    syntax: ["friction list [--repo current|all] [--since DURATION] [--limit N] [--status STATUS]"],
    options: [
      { name: "--repo current|all", description: "Select repository scope." },
      { name: "--since DURATION", description: "Include observations from a recent m, h, or d duration." },
      { name: "--limit N", description: "Return 1 to 1000 newest records; default 50." },
      { name: "--status STATUS", description: "Select open, resolved, or all; default open." },
    ],
    notes: [readScopeNote],
    effects: readOnly,
  },
  stats: {
    purpose: "Report structural facts about private observations.",
    syntax: ["friction stats [--repo current|all] [--since DURATION] [--status STATUS]"],
    options: [
      { name: "--repo current|all", description: "Select repository scope." },
      { name: "--since DURATION", description: "Include observations from a recent m, h, or d duration." },
      { name: "--status STATUS", description: "Select open, resolved, or all; default open." },
    ],
    notes: [readScopeNote],
    effects: readOnly,
  },
  resolve: {
    purpose: "Append a resolution to one observation.",
    syntax: ["friction resolve ID [--note TEXT] [--verification TEXT] [--source SOURCE]"],
    options: [
      { name: "--note TEXT", description: "Record an optional screened resolution note." },
      { name: "--verification TEXT", description: "Record optional screened verification." },
      { name: "--source SOURCE", description: "Set the lifecycle actor; default manual." },
    ],
    notes: ["Already-resolved observations are successful no-ops."],
    effects: privateAppend,
  },
  reopen: {
    purpose: "Append a reopen event to one observation.",
    syntax: ["friction reopen ID [--note TEXT] [--source SOURCE]"],
    options: [
      { name: "--note TEXT", description: "Record an optional screened reopen note." },
      { name: "--source SOURCE", description: "Set the lifecycle actor; default manual." },
    ],
    notes: ["Already-open observations are successful no-ops."],
    effects: privateAppend,
  },
  export: {
    purpose: "Render a private screened export to stdout or a file.",
    syntax: ["friction export [--repo current|all] [--since DURATION] [--status STATUS] [--format markdown|jsonl] [--output FILE] [--force]"],
    options: [
      { name: "--repo current|all", description: "Select repository scope." },
      { name: "--since DURATION", description: "Include observations from a recent m, h, or d duration." },
      { name: "--status STATUS", description: "Select open, resolved, or all; default open." },
      { name: "--format markdown|jsonl", description: "Select output format; default markdown." },
      { name: "--output FILE", description: "Write to a requested private export path." },
      { name: "--force", description: "Allow safe replacement of an existing regular file." },
    ],
    notes: [`${readScopeNote} Stdout is the default.`],
    effects: { ...readOnly, readOnly: false },
  },
  publish: {
    purpose: "Preview or write a sanitized current-repository projection.",
    syntax: ["friction publish ID [ID ...] [--output FILE] [--apply]", "friction publish --all-open [--output FILE] [--apply]"],
    options: [
      { name: "--all-open", description: "Select every open observation for the current repository." },
      { name: "--output FILE", description: "Set a safe path inside the current worktree." },
      { name: "--apply", description: "Apply the planned repository write." },
    ],
    notes: ["Preview is the default and writes nothing. Publishing is current-repository-only."],
    effects: { ...readOnly, readOnly: false, writesRepository: true, previewDefault: true },
  },
  purge: {
    purpose: "Preview or delete one observation's private event history.",
    syntax: ["friction purge ID [--apply]"],
    options: [{ name: "--apply", description: "Delete matching private event files." }],
    notes: ["Preview is the default. Exports, projections, commits, and other shared copies remain."],
    effects: { ...readOnly, readOnly: false, destructive: true, previewDefault: true },
  },
  doctor: {
    purpose: "Diagnose runtime, storage, repository, and setup health.",
    syntax: ["friction doctor"],
    options: [],
    notes: ["May create and remove one harmless probe inside the private temp directory; never repairs findings."],
    effects: { ...readOnly, readOnly: false },
  },
  setup: {
    purpose: "Preview or manage harness instructions and skills.",
    syntax: ["friction setup codex|claude-code|generic [--scope user|repo] [--undo] [--apply]"],
    options: [
      { name: "--scope user|repo", description: "Select setup scope; default user." },
      { name: "--undo", description: "Plan removal of known managed content." },
      { name: "--apply", description: "Apply the setup or undo plan." },
    ],
    notes: ["Preview is the default and writes nothing. Generic setup is output-only."],
    effects: { ...readOnly, readOnly: false, writesConfiguration: true, previewDefault: true },
  },
  schema: {
    purpose: "Print the versioned machine contract.",
    syntax: ["friction schema"],
    options: [],
    notes: ["Command output always uses one JSON envelope; --help remains unwrapped."],
    effects: readOnly,
  },
};
