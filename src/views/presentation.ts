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

const MAX_CONTENT_WIDTH = 96;

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

export function contentWidth(options: HumanRenderOptions): number {
  const available = options.columns === null
    ? MAX_CONTENT_WIDTH
    : Math.max(1, options.columns - 1);

  return Math.min(MAX_CONTENT_WIDTH, available);
}

export function renderDivider(options: HumanRenderOptions): string {
  return styleText(options, "muted", "─".repeat(contentWidth(options)));
}
