import { redact } from "../security/redact.js";

export const builtInSources = [
  "manual",
  "codex",
  "claude-code",
  "opencode",
  "pi",
  "warp",
  "openclaw",
  "hermes",
  "generic",
] as const;

export const SOURCE_IDENTIFIER_MAX_BYTES = 64;
export const SOURCE_IDENTIFIER_PATTERN = "^[a-z0-9]+(?:-[a-z0-9]+)*$";

type BuiltInSource = (typeof builtInSources)[number];

declare const customSourceBrand: unique symbol;
type CustomSource = string & { readonly [customSourceBrand]: true };

export type Source = BuiltInSource | CustomSource;

const sourceIdentifierPattern = new RegExp(SOURCE_IDENTIFIER_PATTERN);

export function isSource(value: string): value is Source {
  return (
    Buffer.byteLength(value, "utf8") <= SOURCE_IDENTIFIER_MAX_BYTES &&
    sourceIdentifierPattern.test(value) &&
    redact(value).replacementCount === 0
  );
}
