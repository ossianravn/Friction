import {
  screenedTextFromRedactor,
  type ScreenedText,
} from "./screened-text.js";

export const REDACTION_RULESET_VERSION = 1;

export type RedactionResult = {
  text: ScreenedText;
  replacementCount: number;
  rulesetVersion: typeof REDACTION_RULESET_VERSION;
};

type RedactionRule = {
  pattern: RegExp;
  replacement: string;
};

const rules: readonly RedactionRule[] = [
  {
    pattern:
      /-----BEGIN ((?:(?:RSA|EC|OPENSSH|DSA|ENCRYPTED) )?PRIVATE KEY)-----[\s\S]*?-----END \1-----/g,
    replacement: "[REDACTED:PRIVATE_KEY]",
  },
  {
    pattern: /\bAuthorization\s*:\s*[^\r\n]+/gi,
    replacement: "[REDACTED:AUTHORIZATION]",
  },
  {
    pattern: /\bCookie\s*:\s*[^\r\n]+/gi,
    replacement: "[REDACTED:COOKIE]",
  },
  {
    pattern: /\b([a-z][a-z0-9+.-]*:\/\/)[^\s/:@]+:[^\s/@]+@/gi,
    replacement: "[REDACTED:URL_CREDENTIAL]",
  },
  {
    pattern:
      /\b(?:[A-Za-z0-9]+[_-])*(?:api[_-]?key|private[_-]?key|access[_-]?key|token|secret|password|passwd|key)(?:[_-][A-Za-z0-9]+)*\s*(?:=|:)\s*(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;]+)/gi,
    replacement: "[REDACTED:SECRET]",
  },
  {
    pattern:
      /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{20,}|xox[a-z]-[A-Za-z0-9-]{10,})\b/g,
    replacement: "[REDACTED:CREDENTIAL]",
  },
];

export function redact(value: string): RedactionResult {
  let text = value;
  let replacementCount = 0;

  for (const rule of rules) {
    text = text.replace(rule.pattern, () => {
      replacementCount += 1;
      return rule.replacement;
    });
  }

  return {
    text: screenedTextFromRedactor(text),
    replacementCount,
    rulesetVersion: REDACTION_RULESET_VERSION,
  };
}
