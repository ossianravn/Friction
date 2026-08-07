import type { Readable } from "node:stream";

import {
  isArea,
  isImpact,
  isSource,
  type Area,
  type Impact,
  type Source,
} from "../domain/events.js";
import { FrictionFailure } from "../domain/failures.js";
import { BODY_MAX_BYTES, MODEL_MAX_BYTES } from "../domain/limits.js";

export type RawCaptureInput = {
  body: string;
  source: string | undefined;
  model: string | undefined;
  area: string | undefined;
  impacts: string[];
};

export type ValidCaptureInput = {
  body: string;
  source: Source;
  model: string | null;
  area: Area | null;
  impacts: Impact[];
};

function byteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function validateAuthoredText(value: string, maximumBytes: number): string {
  if (byteLength(value) > maximumBytes || value.includes("\0")) {
    throw new FrictionFailure("invalid_input");
  }

  const normalized = value.replaceAll("\r\n", "\n").trim();

  if (normalized.length === 0) {
    throw new FrictionFailure("invalid_input");
  }

  return normalized;
}

export function validateCaptureInput(input: RawCaptureInput): ValidCaptureInput {
  const source = input.source ?? "manual";

  if (!isSource(source)) {
    throw new FrictionFailure("invalid_input");
  }

  if (input.area !== undefined && !isArea(input.area)) {
    throw new FrictionFailure("invalid_input");
  }

  if (input.impacts.some((impact) => !isImpact(impact))) {
    throw new FrictionFailure("invalid_input");
  }

  const uniqueImpacts = [...new Set(input.impacts)] as Impact[];

  return {
    body: validateAuthoredText(input.body, BODY_MAX_BYTES),
    source,
    model:
      input.model === undefined
        ? null
        : validateAuthoredText(input.model, MODEL_MAX_BYTES),
    area: input.area ?? null,
    impacts: uniqueImpacts,
  };
}

export async function readStdinBody(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  let bytesRead = 0;

  for await (const chunk of stream) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    const remaining = BODY_MAX_BYTES + 1 - bytesRead;

    if (remaining > 0) {
      chunks.push(bytes.subarray(0, remaining));
      bytesRead += Math.min(bytes.length, remaining);
    }

    if (bytes.length > remaining || bytesRead > BODY_MAX_BYTES) {
      stream.destroy();
      throw new FrictionFailure("invalid_input");
    }
  }

  return Buffer.concat(chunks).toString("utf8");
}
