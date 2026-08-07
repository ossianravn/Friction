import { FrictionFailure } from "../domain/failures.js";

const startMarker = "<!-- friction:managed:start v1 -->";
const endMarker = "<!-- friction:managed:end v1 -->";

function newlineFor(bytes: Buffer): "\n" | "\r\n" {
  return bytes.includes(Buffer.from("\r\n")) ? "\r\n" : "\n";
}

function markerRange(text: string): { start: number; end: number } | null {
  const starts = [...text.matchAll(new RegExp(startMarker, "g"))];
  const ends = [...text.matchAll(new RegExp(endMarker, "g"))];

  if (starts.length === 0 && ends.length === 0) {
    return null;
  }

  if (starts.length !== 1 || ends.length !== 1) {
    throw new FrictionFailure("setup_conflict");
  }

  const start = starts[0]!.index;
  let end = ends[0]!.index + endMarker.length;

  if (ends[0]!.index < start) {
    throw new FrictionFailure("setup_conflict");
  }

  if (text.slice(end, end + 2) === "\r\n") {
    end += 2;
  } else if (text[end] === "\n") {
    end += 1;
  }

  return { start, end };
}

function block(content: Buffer, newline: "\n" | "\r\n"): string {
  const normalized = content
    .toString("utf8")
    .replaceAll("\r\n", "\n")
    .replaceAll("\n", newline)
    .replace(/[\r\n]+$/, "");
  return `${startMarker}${newline}${normalized}${newline}${endMarker}${newline}`;
}

export function applyManagedBlock(original: Buffer, content: Buffer): Buffer {
  const newline = newlineFor(original);
  const text = original.toString("utf8");
  const range = markerRange(text);
  const managed = block(content, newline);
  return Buffer.from(
    range === null
      ? `${managed}${text}`
      : `${text.slice(0, range.start)}${managed}${text.slice(range.end)}`,
    "utf8",
  );
}

export function removeManagedBlock(original: Buffer): Buffer | null {
  const text = original.toString("utf8");
  const range = markerRange(text);

  if (range === null) {
    return null;
  }

  return Buffer.from(`${text.slice(0, range.start)}${text.slice(range.end)}`, "utf8");
}
