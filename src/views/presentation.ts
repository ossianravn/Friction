export type HumanRenderOptions = Readonly<{
  color: boolean;
  columns: number | null;
}>;

export type TextTone =
  | "heading"
  | "section"
  | "muted"
  | "accent"
  | "success"
  | "warning"
  | "error";

const sequences: Readonly<Record<TextTone, string>> = {
  heading: "\u001b[1;36m",
  section: "\u001b[1m",
  muted: "\u001b[2m",
  accent: "\u001b[36m",
  success: "\u001b[32m",
  warning: "\u001b[33m",
  error: "\u001b[31m",
};

export function styleText(
  options: HumanRenderOptions,
  tone: TextTone,
  value: string,
): string {
  return options.color ? `${sequences[tone]}${value}\u001b[0m` : value;
}

export function formatTimestamp(value: string): string {
  const iso = new Date(value).toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

export function renderDivider(options: HumanRenderOptions): string {
  const width = options.columns === null
    ? 64
    : Math.min(64, Math.max(1, options.columns - 1));
  return styleText(options, "muted", "─".repeat(width));
}
