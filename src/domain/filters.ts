import { FrictionFailure } from "./failures.js";

export type RepositoryScope = "current" | "all";
export type StatusFilter = "open" | "resolved" | "all";

export type RawReadFilters = {
  repo: string | undefined;
  since: string | undefined;
  status: string | undefined;
};

export type ReadFilters = {
  repo: RepositoryScope | null;
  sinceAt: string | null;
  status: StatusFilter;
};

export function parseDuration(value: string, now: Date): string {
  const match = /^(\d+)(m|h|d)$/.exec(value);

  if (match === null) {
    throw new FrictionFailure("invalid_input");
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const multiplier = unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : 86_400_000;
  const duration = amount * multiplier;

  if (!Number.isSafeInteger(amount) || amount <= 0 || duration > 365 * 86_400_000) {
    throw new FrictionFailure("invalid_input");
  }

  return new Date(now.getTime() - duration).toISOString();
}

export function parseReadFilters(input: RawReadFilters, now: Date): ReadFilters {
  if (input.repo !== undefined && input.repo !== "current" && input.repo !== "all") {
    throw new FrictionFailure("invalid_input");
  }

  if (
    input.status !== undefined &&
    input.status !== "open" &&
    input.status !== "resolved" &&
    input.status !== "all"
  ) {
    throw new FrictionFailure("invalid_input");
  }

  return {
    repo: input.repo ?? null,
    sinceAt: input.since === undefined ? null : parseDuration(input.since, now),
    status: input.status ?? "open",
  };
}

export function parseLimit(value: string | undefined): number {
  if (value === undefined) {
    return 50;
  }

  if (!/^\d+$/.test(value)) {
    throw new FrictionFailure("invalid_input");
  }

  const limit = Number(value);

  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000) {
    throw new FrictionFailure("invalid_input");
  }

  return limit;
}
