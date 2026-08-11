function isWhitespace(value: string): boolean {
  return /\s/u.test(value);
}

function wrapLine(value: string, width: number): string[] {
  const remaining = Array.from(value);

  if (remaining.length === 0) {
    return [""];
  }

  const lines: string[] = [];

  while (remaining.length > width) {
    let breakAt = -1;

    for (let index = width; index > 0; index -= 1) {
      if (isWhitespace(remaining[index] ?? "")) {
        breakAt = index;
        break;
      }
    }

    if (breakAt === -1) {
      lines.push(remaining.splice(0, width).join(""));
      continue;
    }

    lines.push(remaining.splice(0, breakAt).join(""));
    while (remaining.length > 0 && isWhitespace(remaining[0] ?? "")) {
      remaining.shift();
    }
  }

  lines.push(remaining.join(""));
  return lines;
}

export function wrapText(value: string, width: number): string[] {
  if (!Number.isSafeInteger(width) || width < 1) {
    throw new RangeError("Wrap width must be a positive integer.");
  }

  return value
    .split("\n")
    .flatMap((line) => wrapLine(line, width));
}
