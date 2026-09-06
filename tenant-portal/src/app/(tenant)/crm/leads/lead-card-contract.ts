// The four board-card fields, and the one write that changes two of them.
//
//   PATCH /api/tenant/crm/v1/leads/:id   { rating?, cardColor? }   200
//
// That route is `idempotent: false` in the Gateway contract, so unlike
// `POST /leads` it needs no `x-idempotency-key`: replaying it writes the same
// value a second time and lands on the same state. What it does NOT get to
// skip is the outcome classification — a rating whose result is unknown is
// neither kept nor discarded silently. See ../shared/crm-write.ts.
//
// Split out of lead-contract.ts because these four fields are read by the LIST
// parser (useLeads.parseLead), not the detail one, and the two contracts have
// no other overlap.

import { isCardColor, type CardColor } from "@/design-system";
import { isUUIDv7 } from "@/lib/uuid";

const LEAD_ACTIVITY_BUCKETS = ["OVERDUE", "TODAY", "FUTURE"] as const;

type LeadActivityBucket = (typeof LEAD_ACTIVITY_BUCKETS)[number];

/** The board card's bucket set: the server's three, plus "no open activity". */
export type LeadActivityState = LeadActivityBucket | "NONE";

export interface LeadNextActivity {
  activityAt: string;
  bucket: LeadActivityBucket;
}

export interface LeadOwner {
  userId: string;
  firstName: string;
  lastName: string;
}

/** Stars on a card. The server clamps to the same range. */
export const MAX_LEAD_RATING = 3;

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
    value > MAX_LEAD_RATING
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

/** The bucket the card paints, with "no open activity" folded in. */
export function leadActivityState(activity: LeadNextActivity | null): LeadActivityState {
  return activity === null ? "NONE" : activity.bucket;
}

export interface LeadTag {
  id: string;
  name: string;
  /**
   * One of the app's eleven filing colours, or `null`.
   *
   * `null` covers two different facts, and neither is a broken payload: a tag
   * the tenant gave no colour, and a colour from a vocabulary this screen does
   * not own. CRM's `CreateTagDto` carries a name and nothing else today, so the
   * field is optional on the wire and usually absent. Unlike `cardColor` — a
   * CRM enum with a database CHECK behind it, where an unknown value IS a
   * contract break — an unrecognised tag colour degrades to the neutral badge
   * instead of taking the whole board down. A colour of the wrong TYPE still
   * throws, exactly as everything else here does.
   */
  color: CardColor | null;
}

/**
 * The lead's tags, in the order the server sent them.
 *
 * Absent and `null` are both "this lead has no tags" — one is a crm-app that
 * does not project the field yet, the other a lead nobody has tagged — and
 * both give an empty array. Anything else that is not an array of objects
 * carrying an id and a name throws, the way every parser in this file does.
 */
export function parseLeadTags(value: unknown): LeadTag[] {
  if (isEmpty(value)) return [];
  if (!Array.isArray(value)) invalid();
  return value.map((entry) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) invalid();
    const tag = entry as Record<string, unknown>;
    if (!isUUIDv7(tag.id)) invalid();
    if (typeof tag.name !== "string" || tag.name.length === 0) invalid();
    const color = tag.color;
    if (!isEmpty(color) && typeof color !== "string") invalid();
    return { id: tag.id, name: tag.name, color: isCardColor(color) ? color : null };
  });
}

/**
 * The owner's initials — "Kamal Radwan" is `KR`.
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

/**
 * The card's two title lines.
 *
 * A corporate lead is filed under its COMPANY, and the person named on it is
 * the contact to ring; an individual lead is the person, and there is no
 * second party to name. The list parser already resolves `company` to the
 * display name when there is no company, so the two being equal IS the
 * individual case — no `leadProfileType` is needed, and none is projected onto
 * the list row.
 */
export function leadCardHeading(lead: {
  leadName: string;
  company: string;
  primaryContactName: string;
}): {
  title: string;
  contactName: string | null;
} {
  // The contact is what decides the shape, not the names.
  //
  // Comparing `company` with `leadName` looked like it separated a company
  // from a person and does not: CRM composes a corporate lead's display name
  // FROM its company name, so the two are equal precisely on the corporate
  // leads — and the card collapsed to one line exactly where the second one
  // belonged. `primaryContactName` is empty on an individual lead, whose party
  // is the person and therefore has no contact hanging off it.
  const contactName = lead.primaryContactName.trim();
  if (!contactName) return { title: lead.leadName, contactName: null };
  return { title: lead.company || lead.leadName, contactName };
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
