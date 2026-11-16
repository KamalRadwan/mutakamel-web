import { invalidCoreResponse, requiredText } from "../contracts/core-page";

/** Validate an existing owner checksum; never substitute a calculated or default value. */
export function templateChecksum(row: Record<string, unknown>, key: string): string {
  const value = requiredText(row, key, 64);
  if (!/^[a-f0-9]{64}$/u.test(value)) invalidCoreResponse();
  return value;
}
