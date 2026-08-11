import type { DoctorCheck } from "../doctor/checks.js";
import {
  styleText,
  type HumanRenderOptions,
  type TextTone,
} from "./presentation.js";

const statusStyle: Readonly<
  Record<DoctorCheck["status"], { symbol: string; tone: TextTone }>
> = {
  ok: { symbol: "✓", tone: "success" },
  warn: { symbol: "!", tone: "warning" },
  error: { symbol: "×", tone: "error" },
};

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function renderDoctor(
  checks: readonly DoctorCheck[],
  options: HumanRenderOptions,
): string {
  const counts = { ok: 0, warn: 0, error: 0 };
  const names = checks.map((check) => check.name.replaceAll("-", " "));
  const nameWidth = Math.max(0, ...names.map((name) => name.length));

  for (const check of checks) {
    counts[check.status] += 1;
  }

  const summary = [
    countLabel(counts.ok, "check passed", "checks passed"),
    countLabel(counts.warn, "warning", "warnings"),
    countLabel(counts.error, "error", "errors"),
  ].join(" · ");
  const lines = checks.map((check, index) => {
    const presentation = statusStyle[check.status];
    const symbol = styleText(options, presentation.tone, presentation.symbol);
    const name = styleText(options, "section", names[index]!.padEnd(nameWidth));
    return `${symbol} ${name}  ${check.message}`;
  });

  return [
    styleText(options, "heading", "Friction doctor"),
    styleText(options, "muted", summary),
    "",
    ...lines,
  ].join("\n") + "\n";
}
