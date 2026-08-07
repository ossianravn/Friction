declare const screenedTextBrand: unique symbol;

export type ScreenedText = string & {
  readonly [screenedTextBrand]: true;
};

export function screenedTextFromRedactor(value: string): ScreenedText {
  return value as ScreenedText;
}
