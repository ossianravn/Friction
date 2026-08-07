const REMOTE_MAX_BYTES = 4_096;

export type NormalizedRemote = {
  identity: string;
  name: string;
};

function normalizeRepositoryPath(value: string): string | null {
  const normalized = value
    .replaceAll("\\", "/")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\.git$/i, "");
  const segments = normalized.split("/");

  if (
    normalized.length === 0 ||
    segments.some((segment) => segment.length === 0 || segment === "..")
  ) {
    return null;
  }

  return normalized;
}

function resultFor(host: string, port: string, pathname: string): NormalizedRemote | null {
  const repositoryPath = normalizeRepositoryPath(pathname);

  if (host.length === 0 || repositoryPath === null) {
    return null;
  }

  const identity = `${host.toLowerCase()}${port.length > 0 ? `:${port}` : ""}/${repositoryPath}`;

  if (Buffer.byteLength(identity, "utf8") > REMOTE_MAX_BYTES) {
    return null;
  }

  return {
    identity,
    name: repositoryPath.split("/").at(-1) ?? "",
  };
}

export function normalizeRemote(value: string): NormalizedRemote | null {
  if (value.includes("\0") || Buffer.byteLength(value, "utf8") > REMOTE_MAX_BYTES) {
    return null;
  }

  if (value.startsWith("https://") || value.startsWith("ssh://")) {
    try {
      const remote = new URL(value);

      if (remote.protocol !== "https:" && remote.protocol !== "ssh:") {
        return null;
      }

      const defaultPort =
        (remote.protocol === "https:" && remote.port === "443") ||
        (remote.protocol === "ssh:" && remote.port === "22");

      return resultFor(
        remote.hostname,
        defaultPort ? "" : remote.port,
        remote.pathname,
      );
    } catch {
      return null;
    }
  }

  const scp = /^(?:[^@\s]+@)?([^:\s]+):(.+)$/.exec(value);
  return scp === null ? null : resultFor(scp[1] ?? "", "", scp[2] ?? "");
}
