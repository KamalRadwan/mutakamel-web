// The four board-card fields, and the one write that changes two of them.
//
//   PATCH /api/tenant/crm/v1/leads/:id   { rating?, cardColor? }   200
//
// That route is `idempotent: false` in the Gateway contract, so unlike
// `POST /leads` it needs no `x-idempotency-key`: replaying it writes the same
// value a second time and lands on the same state. What it does NOT get to
// skip is the outcome classification — a rating whose result is unknown is
// neither kept nor discarded silently. See lib/api/idempotent-write.ts.
//
// Split out of lead-contract.ts because these four fields are read by the LIST
// parser (useLeads.parseLead), not the detail one, and the two contracts have
// no other overlap.

import { isCardColor, type CardColor } from "@/design-system";
import { countryIsoFromName } from "@/lib/geo/country-data";
import { isUUIDv7 } from "@/lib/uuid";
import type { CrmActivityState } from "../shared/crm-activity-tone";
import { MAX_CRM_RATING } from "../shared/crm-rating-contract";

export { crmActivityState as leadActivityState } from "../shared/crm-activity-tone";

const LEAD_ACTIVITY_BUCKETS = ["OVERDUE", "TODAY", "FUTURE"] as const;

type LeadActivityBucket = (typeof LEAD_ACTIVITY_BUCKETS)[number];

/** The board card's bucket set: the server's three, plus "no open activity". */
export type LeadActivityState = CrmActivityState;

export interface LeadNextActivity {
  activityAt: string;
  bucket: LeadActivityBucket;
}

export interface LeadOwner {
  userId: string;
  firstName: string;
  lastName: string;
}

function invalid(): never {
  throw new Error("Invalid leads response.");
}

// `undefined` and `null` are the two empty values, and they are not the same
// thing: `undefined` is a field the branch's crm-app has not started sending
// yet, `null` is a column nobody has written. Both mean "no value", so both
// take the default. A value of the WRONG SHAPE is neither, and throws exactly
// as a bad stageId does — a rating of "3" or a colour of "MAUVE" is a contract
// break, and a screen that quietly renders zero stars over one hides it.
function isEmpty(value: unknown): boolean {
  return value === undefined || value === null;
}

export function parseLeadRating(value: unknown): number {
  if (isEmpty(value)) return 0;
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > MAX_CRM_RATING
  ) {
    invalid();
  }
  return value;
}

export function parseLeadCardColor(value: unknown): CardColor | null {
  if (isEmpty(value)) return null;
  if (!isCardColor(value)) invalid();
  return value;
}

export function parseLeadOwner(value: unknown): LeadOwner | null {
  if (isEmpty(value)) return null;
  if (typeof value !== "object" || Array.isArray(value)) invalid();
  const owner = value as Record<string, unknown>;
  if (!isUUIDv7(owner.userId)) invalid();
  // The names are optional where the id is not: a user record can carry one
  // name or neither, and `leadOwnerInitials` already renders what it is given.
  // A name of the wrong TYPE still throws.
  const firstName = owner.firstName;
  const lastName = owner.lastName;
  if (!isEmpty(firstName) && typeof firstName !== "string") invalid();
  if (!isEmpty(lastName) && typeof lastName !== "string") invalid();
  return {
    userId: owner.userId,
    firstName: typeof firstName === "string" ? firstName : "",
    lastName: typeof lastName === "string" ? lastName : "",
  };
}

export function parseLeadNextActivity(value: unknown): LeadNextActivity | null {
  if (isEmpty(value)) return null;
  if (typeof value !== "object" || Array.isArray(value)) invalid();
  const activity = value as Record<string, unknown>;
  const activityAt = activity.activityAt;
  if (
    typeof activityAt !== "string" ||
    Number.isNaN(new Date(activityAt).getTime()) ||
    !LEAD_ACTIVITY_BUCKETS.includes(activity.bucket as LeadActivityBucket)
  ) {
    invalid();
  }
  return { activityAt, bucket: activity.bucket as LeadActivityBucket };
}

/**
 * The owner's initials, using the first letter of each known name.
 *
 * One letter when only one name is known, and an empty string when neither is:
 * a badge reading "?" claims the owner is unknown, when what is unknown is
 * only their name. The caller renders nothing instead.
 *
 * Split by code point rather than by `charAt`, so a name outside the BMP does
 * not contribute half a surrogate pair.
 */
export function leadOwnerInitials(owner: LeadOwner): string {
  return [owner.firstName, owner.lastName]
    .map((part) => Array.from(part.trim())[0] ?? "")
    .join("");
}

/** Avatar initials for a lead or contact display name, by code point. */
export function leadNameInitials(name: string): string {
  const words = name.trim().split(/\s+/u).filter(Boolean);
  if (words.length === 0) return "LD";
  if (words.length === 1) return Array.from(words[0]).slice(0, 2).join("").toUpperCase();
  return words.slice(0, 2).map((word) => Array.from(word)[0] ?? "").join("").toUpperCase();
}

/**
 * The ISO code behind a stored country, which is either already a code or a
 * country name in either language. An unknown value has none: the row shows
 * no flag rather than a guessed one.
 */
export function leadCountryIso(country: string | null | undefined): string | null {
  const trimmed = country?.trim() ?? "";
  if (!trimmed) return null;
  if (/^[A-Z]{2}$/iu.test(trimmed)) return trimmed.toUpperCase();
  return countryIsoFromName(trimmed);
}

/**
 * The card's two title lines.
 *
 * A corporate lead is filed under its company, with the named contact below.
 * An individual lead is the person and has no second identity line. The
 * explicit profile type decides the shape; display names are never compared.
 */
export function leadCardHeading(lead: {
  leadProfileType: "INDIVIDUAL" | "CORPORATE";
  leadName: string;
  company: string;
  primaryContact: { displayName: string } | null;
}): {
  title: string;
  contactName: string | null;
} {
  if (lead.leadProfileType === "INDIVIDUAL") {
    return { title: lead.leadName, contactName: null };
  }
  const contactName = lead.primaryContact?.displayName.trim() ?? "";
  return {
    title: lead.company || lead.leadName,
    contactName: contactName || null,
  };
}

export interface LeadCardPatch {
  rating?: number;
  /** `null` clears the colour; omitted leaves it alone. */
  cardColor?: CardColor | null;
}

/**
 * The PATCH body, carrying only what changed.
 *
 * Written explicitly rather than by spreading `patch`, because an
 * `{ cardColor: undefined }` that survives into the body serialises to nothing
 * on the wire but reads, to anyone editing this, as "clear the colour".
 */
export function buildLeadCardPatchBody(patch: LeadCardPatch): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (patch.rating !== undefined) body.rating = patch.rating;
  if (patch.cardColor !== undefined) body.cardColor = patch.cardColor;
  return body;
}
