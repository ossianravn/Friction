import type { CliWarning } from "../output.js";
import type { ImplementedCommand } from "../requests.js";

export type CommandExecution = {
  command: ImplementedCommand;
  data: unknown;
  human: string;
  warnings: CliWarning[];
  exitCode?: number;
};
