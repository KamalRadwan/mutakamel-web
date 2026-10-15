// Card-specific request builders for `PATCH /leads/:id`.
//
// `forbidNonWhitelisted: true` is on (crm-app/src/main.ts), so an undocumented
// key is a 400 rather than a silently-ignored field. Every key below is copied
// from `crm-app/src/crm/leads/dto/lead.dto.ts` and nothing else is sent.

import type { CardColor } from "@/design-system";
import { looksLikeEmail } from "../shared/crm-form-validation";
import type { CreateLeadAddressRequest } from "./lead-create-contract";

export const LEAD_CARD_COLORS = [
  "RED",
  "ORANGE",
  "AMBER",
  "YELLOW",
  "GREEN",
  "TEAL",
  "BLUE",
  "INDIGO",
  "PURPLE",
  "PINK",
  "SLATE",
] as const satisfies readonly CardColor[];

interface UpdateLeadContactRequest {
  contactPartyId?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  honorificTitle?: string | null;
  jobTitle?: string | null;
  phones?: string[];
  email?: string | null;
  isPrimary?: boolean;
}

/**
 * The verified `UpdateLeadDto` fields accepted by PATCH /api/tenant/crm/v1/leads/:id.
 *
 * Rules:
 * - Omitted property preserves existing value.
 * - Send only properties that changed.
 * - phones: [] clears individual numbers.
 * - companyPhones: [] clears company numbers.
 * - contacts is a complete replacement list; [] removes all contacts.
 * - rating: 0, 1, 2, or 3 (null is invalid).
 * - cardColor: CardColor or null (to clear).
 * - acquisitionSourceId: UUIDv7 or null (to clear).
 * - honorificTitle, primaryMobile, email, companyEmail, companyWebsite, taxNumber,
 *   commercialRegistrationNumber, ownerUserId: cleared with null.
 * - description, interestSummary, expectedNeed: cleared with empty string "".
 * - displayName and companyName: cannot be blank when supplied.
 * - Forbidden on PATCH: branchId, leadProfileType, stageId, status, tagIds,
 *   existingCompanyPartyId, legalName, companyPhone.
 */
export interface UpdateLeadRequest {
  // Individual
  displayName?: string;
  firstName?: string;
  lastName?: string;
  honorificTitle?: string | null;
  primaryMobile?: string | null;
  phones?: string[];
  /**
   * The inline editors' one-number write: replaces only the first mobile of
   * the person the lead is about (the individual, or a corporate lead's
   * primary contact) and keeps every other number. Cannot be combined with
   * `phones`, `primaryMobile`, `companyPhones` or `contacts`
   * (`422 LEAD_PRIMARY_PHONE_CONFLICT`).
   */
  primaryPhone?: string;
  email?: string | null;

  // Corporate
  companyName?: string;
  companyPhones?: string[];
  companyEmail?: string | null;
  companyWebsite?: string | null;
  taxNumber?: string | null;
  commercialRegistrationNumber?: string | null;
  contacts?: UpdateLeadContactRequest[];

  // Shared
  address?: CreateLeadAddressRequest;
  acquisitionSourceId?: string | null;
  rating?: number;
  cardColor?: CardColor | null;
  description?: string;
  interestSummary?: string;
  expectedNeed?: string;
  ownerUserId?: string | null;
  customFields?: Record<string, unknown>;
}

/**
 * The five boxes on the detail screen's company card.
 *
 * `companyPhone` is absent for the reason `UpdateLeadRequest` gives — the
 * update DTO has no singular — and the array has its own builder below.
 */
export type LeadCompanyField =
  | "companyName"
  | "companyEmail"
  | "companyWebsite"
  | "taxNumber"
  | "commercialRegistrationNumber";

/**
 * One company field, composed into the modal's changed-field PATCH.
 *
 * The modal compares its draft with its baseline before calling this builder.
 * Unchanged fields stay out of the final request so editing one value does not
 * resend unrelated stored company values.
 *
 * Four of the five are `string | null` on the DTO, so an emptied box sends an
 * explicit `null` and the value is genuinely cleared. Two are special:
 *
 * - **`companyName`** has no null form (`companyName?: string`, backing the
 *   organization's NOT NULL display name), so an emptied box has nothing it
 *   could legally send. It returns an EMPTY request rather than throwing —
 *   a caller then treats "nothing to send" the same way for every field and
 *   skips the PATCH, instead of wrapping five call sites in a try. Telling the
 *   user the box is required is the UI's own validation, not this builder's
 *   job; this only guarantees the wire stays legal.
 * - **`companyEmail`** carries `@IsEmail()`, so a non-empty value that is not
 *   address-shaped is also nothing to send — it would come back a 400 with a
 *   class-validator message, which is a worse thing to show than the field
 *   error the form already knows how to render. The check is
 *   `looksLikeEmail`, the same deliberately-loose pattern every CRM create
 *   form validates with, so this cannot refuse an address the server would
 *   have taken. Clearing the box is unaffected: empty means `null`, not
 *   malformed.
 */
export function buildLeadCompanyFieldRequest(
  field: LeadCompanyField,
  value: string,
): UpdateLeadRequest {
  const next = value.trim();
  const cleared = next.length > 0 ? next : null;

  switch (field) {
    case "companyName":
      return next.length > 0 ? { companyName: next } : {};
    case "companyEmail":
      if (cleared !== null && !looksLikeEmail(cleared)) return {};
      return { companyEmail: cleared };
    case "companyWebsite":
      return { companyWebsite: cleared };
    case "taxNumber":
      return { taxNumber: cleared };
    case "commercialRegistrationNumber":
      return { commercialRegistrationNumber: cleared };
  }
}

/** `@ArrayMaxSize(10)` on `companyPhones`. Enforced here so the 400 never happens. */
const COMPANY_PHONES_MAX = 10;

/**
 * The company's phone list, whole.
 *
 * An array field is replaced rather than merged, so this always sends the full
 * list — including `[]`, which is how the last number is removed. Blank rows
 * are dropped because the card keeps an empty input around for the next entry
 * and `@MaxLength(32, { each: true })` has nothing useful to say about `""`.
 *
 * Numbers are sent as typed, not normalised: the server compares NORMALISED
 * values when it rejects a duplicate, and rewriting the user's `00966…` into
 * `+966…` on the way out would hide from them which of their two entries the
 * server considers the same number.
 */
export function buildLeadCompanyPhonesRequest(phones: string[]): UpdateLeadRequest {
  return {
    companyPhones: phones
      .map((phone) => phone.trim())
      .filter((phone) => phone.length > 0)
      .slice(0, COMPANY_PHONES_MAX),
  };
}
