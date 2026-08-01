export type StorageEndpointKind = "internal" | "public";

export type StorageEndpointIssue =
  | "INVALID_ORIGIN"
  | "INTERNAL_PROTOCOL"
  | "PUBLIC_HTTPS_REQUIRED"
  | "ORIGIN_COMPONENTS_NOT_ALLOWED"
  | "PRIVATE_HTTP_HOST_REQUIRED";

export function storageEndpointIssue(
  value: unknown,
  kind: StorageEndpointKind,
): StorageEndpointIssue | null {
  if (typeof value !== "string" || !value.trim() || value.length > 2048) {
    return "INVALID_ORIGIN";
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "INVALID_ORIGIN";
  }

  if (!url.hostname) return "INVALID_ORIGIN";
  if (kind === "public" && url.protocol !== "https:") {
    return "PUBLIC_HTTPS_REQUIRED";
  }
  if (
    kind === "internal" &&
    url.protocol !== "http:" &&
    url.protocol !== "https:"
  ) {
    return "INTERNAL_PROTOCOL";
  }
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    return "ORIGIN_COMPONENTS_NOT_ALLOWED";
  }
  if (
    kind === "internal" &&
    url.protocol === "http:" &&
    !isPrivateHttpHost(url.hostname)
  ) {
    return "PRIVATE_HTTP_HOST_REQUIRED";
  }
  return null;
}

export function isSafeStorageEndpoint(
  value: unknown,
  kind: StorageEndpointKind,
): value is string {
  return storageEndpointIssue(value, kind) === null;
}

function isPrivateHttpHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (normalized === "localhost" || normalized === "[::1]") return true;

  const octets = normalized.split(".");
  if (
    octets.length !== 4 ||
    octets.some(
      (octet) =>
        !/^(0|[1-9]\d{0,2})$/.test(octet) ||
        Number(octet) < 0 ||
        Number(octet) > 255,
    )
  ) {
    return false;
  }

  const first = Number(octets[0]);
  const second = Number(octets[1]);
  return (
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}
