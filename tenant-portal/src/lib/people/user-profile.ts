import { readCoreData } from "@/lib/api/envelope";
import { isUUIDv7 } from "@/lib/uuid";

export const USER_PROFILE_READ_PERMISSION = "users.user.read";

/** Contact-only projection of TenantUsersService.TenantUserView. */
export interface UserContactProfile {
  id: string;
  fullName: string;
  email: string;
  // The current user contract has no phone/image or usable Party link.
  phone: null;
  imageUrl: null;
}

export type UserProfileResult =
  | { status: "ready"; profile: UserContactProfile }
  | { status: "loading" | "forbidden" | "unavailable" | "error"; profile: null };

export function parseUserContactProfile(payload: unknown, expectedId: string): UserContactProfile {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Invalid user profile.");
  const source = payload as Record<string, unknown>;
  if (!isUUIDv7(source.id) || source.id !== expectedId ||
    typeof source.firstName !== "string" || source.firstName.length > 80 ||
    typeof source.lastName !== "string" || source.lastName.length > 80 ||
    typeof source.email !== "string" || source.email.length > 255 || !source.email.trim()) {
    throw new Error("Invalid user profile.");
  }
  const fullName = [source.firstName.trim(), source.lastName.trim()].filter(Boolean).join(" ");
  if (!fullName || isUUIDv7(fullName)) throw new Error("Invalid user profile name.");
  return { id: source.id, fullName, email: source.email, phone: null, imageUrl: null };
}

export async function readUserContactProfile(id: string, signal: AbortSignal): Promise<UserContactProfile> {
  if (!isUUIDv7(id)) throw new Error("Invalid user identifier.");
  // Gateway core.tenant.users.get → TenantUsersController.findOne → toUserView.
  return parseUserContactProfile(await readCoreData(`/api/tenant/core/v1/users/${encodeURIComponent(id)}`, {
    signal, cache: "no-store", maxResponseBytes: 64 * 1024,
  }), id);
}
