import { isUUIDv7 } from "@/lib/uuid";

export type OpportunityCustomerProfileType = "INDIVIDUAL" | "CORPORATE";
export type OpportunityActivityState = "NO_OPEN" | "OVERDUE" | "TODAY" | "FUTURE";

export interface OpportunityPrimaryContact {
  partyId: string;
  displayName: string;
  jobTitle: string | null;
  isPrimary: boolean;
  email: string | null;
  phones: string[];
}

export interface OpportunityTagSummary {
  id: string;
  name: string;
  color: string | null;
}

export interface OpportunityReadFields {
  customerProfileType: OpportunityCustomerProfileType | null;
  customerDisplayName: string | null;
  customerCompanyName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  customerCountry: string | null;
  customerCity: string | null;
  primaryContact: OpportunityPrimaryContact | null;
  leadSourceName: string | null;
  leadSourceIconUrl: string | null;
  ownerDisplayName: string | null;
  ownerAvatarUrl: string | null;
  openActivityCount: number;
  nextOpenActivityAt: string | null;
  activityState: OpportunityActivityState;
  tags: OpportunityTagSummary[];
}

const MAX_OPPORTUNITY_TAGS = 500;

function invalid(): never {
  throw new Error("Invalid opportunity response.");
}

function nullableString(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") invalid();
  return value;
}

function profileType(value: unknown): OpportunityCustomerProfileType | null {
  if (value === null || value === undefined) return null;
  if (value !== "INDIVIDUAL" && value !== "CORPORATE") invalid();
  return value;
}

function primaryContact(value: unknown): OpportunityPrimaryContact | null {
  if (value === null || value === undefined) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  const contact = value as Record<string, unknown>;
  if (
    !isUUIDv7(contact.partyId) ||
    typeof contact.displayName !== "string" ||
    contact.displayName.length === 0 ||
    typeof contact.isPrimary !== "boolean" ||
    !Array.isArray(contact.phones) ||
    contact.phones.some((phone) => typeof phone !== "string" || phone.length === 0)
  ) {
    invalid();
  }
  return {
    partyId: contact.partyId,
    displayName: contact.displayName,
    jobTitle: nullableString(contact.jobTitle),
    isPrimary: contact.isPrimary,
    email: nullableString(contact.email),
    phones: [...contact.phones] as string[],
  };
}

function tags(value: unknown): OpportunityTagSummary[] {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_OPPORTUNITY_TAGS) invalid();
  const parsed = value.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) invalid();
    const tag = entry as Record<string, unknown>;
    if (!isUUIDv7(tag.id) || typeof tag.name !== "string" || tag.name.length === 0) invalid();
    return { id: tag.id, name: tag.name, color: nullableString(tag.color) };
  });
  if (new Set(parsed.map(({ id }) => id)).size !== parsed.length) invalid();
  return parsed;
}

function activityState(value: unknown): OpportunityActivityState {
  if (value === null || value === undefined) return "NO_OPEN";
  if (value !== "NO_OPEN" && value !== "OVERDUE" && value !== "TODAY" && value !== "FUTURE") {
    invalid();
  }
  return value;
}

/** Shared parser for the rich Card, Table and One Opportunity projection. */
export function parseOpportunityReadFields(
  item: Record<string, unknown>,
): OpportunityReadFields {
  const count = item.openActivityCount ?? 0;
  if (!Number.isSafeInteger(count) || (count as number) < 0) invalid();
  const nextOpenActivityAt = nullableString(item.nextOpenActivityAt);
  if (nextOpenActivityAt && Number.isNaN(new Date(nextOpenActivityAt).getTime())) invalid();
  return {
    customerProfileType: profileType(item.customerProfileType),
    customerDisplayName: nullableString(item.customerDisplayName),
    customerCompanyName: nullableString(item.customerCompanyName),
    customerPhone: nullableString(item.customerPhone),
    customerEmail: nullableString(item.customerEmail),
    customerCountry: nullableString(item.customerCountry),
    customerCity: nullableString(item.customerCity),
    primaryContact: primaryContact(item.primaryContact),
    leadSourceName: nullableString(item.leadSourceName),
    leadSourceIconUrl: nullableString(item.leadSourceIconUrl ?? item.sourceIconUrl),
    ownerDisplayName: nullableString(item.ownerDisplayName),
    ownerAvatarUrl: nullableString(item.ownerAvatarUrl),
    openActivityCount: count as number,
    nextOpenActivityAt,
    activityState: activityState(item.activityState),
    tags: tags(item.tags),
  };
}

export function opportunityActivityDisplayState(
  value: OpportunityActivityState,
): "NONE" | "OVERDUE" | "TODAY" | "FUTURE" {
  return value === "NO_OPEN" ? "NONE" : value;
}
