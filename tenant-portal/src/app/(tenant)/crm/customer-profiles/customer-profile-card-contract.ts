import { isCardColor, type CardColor } from "@/design-system";
import { isUUIDv7 } from "@/lib/uuid";

const MAX_CUSTOMER_PROFILE_RATING = 3;

export interface CustomerProfileCardPatch {
  rating?: number;
  /** `null` clears the colour; omitted leaves it unchanged. */
  cardColor?: CardColor | null;
}

function invalid(): never {
  throw new Error("Invalid CRM customer-profiles response.");
}

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null;
}

export function parseCustomerProfileRating(value: unknown): number {
  if (isEmpty(value)) return 0;
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > MAX_CUSTOMER_PROFILE_RATING
  ) {
    invalid();
  }
  return value;
}

export function parseCustomerProfileCardColor(
  value: unknown,
): CardColor | null {
  if (isEmpty(value)) return null;
  if (!isCardColor(value)) invalid();
  return value;
}

export function buildCustomerProfileCardPatchBody(
  patch: CustomerProfileCardPatch,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (patch.rating !== undefined) body.rating = patch.rating;
  if (patch.cardColor !== undefined) body.cardColor = patch.cardColor;
  return body;
}

export function parseCustomerProfileCardPatchResponse(
  payload: unknown,
  expectedId: string,
  expectedBranchId: string,
): Required<CustomerProfileCardPatch> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    invalid();
  }
  const profile = payload as Record<string, unknown>;
  if (
    !isUUIDv7(profile.id) ||
    profile.id !== expectedId ||
    !isUUIDv7(profile.branchId) ||
    profile.branchId !== expectedBranchId
  ) {
    invalid();
  }
  return {
    rating: parseCustomerProfileRating(profile.rating),
    cardColor: parseCustomerProfileCardColor(profile.cardColor),
  };
}
