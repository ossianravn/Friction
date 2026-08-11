import type { HumanRenderOptions } from "../views/presentation.js";

type TerminalOutput = {
  isTTY?: boolean;
  columns?: number;
};

function validColumns(value: number | undefined): number | null {
  return value !== undefined && Number.isSafeInteger(value) && value > 1
    ? value
    : null;
}

export function humanRenderOptions(
  output: TerminalOutput,
  environment: NodeJS.ProcessEnv,
): HumanRenderOptions {
  const color = output.isTTY === true &&
    environment["NO_COLOR"] === undefined &&
    environment["TERM"] !== "dumb";

  return {
    color,
    columns: validColumns(output.columns),
  };
}
