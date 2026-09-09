// Card-specific request builders for `PATCH /leads/:id`.
//
// `forbidNonWhitelisted: true` is on (crm-app/src/main.ts), so an undocumented
// key is a 400 rather than a silently-ignored field. Every key below is copied
// from `crm-app/src/crm/leads/dto/lead.dto.ts` and nothing else is sent.

import { looksLikeEmail } from "../shared/crm-form-validation";

/**
 * The `UpdateLeadDto` fields used by the company/contact editors.
 *
 * Three absences are load-bearing and none of them is an oversight:
 *
 * - **no `stageId`** — a stage move is `POST /leads/:id/stage`, which derives
 *   lifecycle `status` from the destination stage's semantic flag;
 * - **no `status`** — same reason, it is derived and never set;
 * - **no `companyPhone`** — the update DTO takes the `companyPhones` array
 *   only, while `CreateLeadDto` takes both. Sending the singular here is a 400.
 */
export interface UpdateLeadRequest {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  honorificTitle?: string | null;
  primaryMobile?: string | null;
  /** Full individual MOBILE list; [] clears it, omission preserves it. */
  phones?: string[];
  email?: string | null;
  /** Existing people only in the detail editor; the server replaces this list. */
  contacts?: Array<{ contactPartyId: string; jobTitle: string; isPrimary: boolean }>;
  companyName?: string;
  /**
   * The plural the update DTO actually takes — `@ArrayMaxSize(10)`,
   * `@MaxLength(32, { each: true })`. Sending `[]` is a real edit that clears
   * every stored number, which is why the array is never omitted for being
   * empty; omitting it is what "leave the numbers alone" means.
   */
  companyPhones?: string[];
  /**
   * The rest of the company identity, all four `string | null` on the DTO.
   *
   * Nullable because a cleared box is a real edit that has to reach the Party
   * as `NULL` — `undefined` would leave the stored value in place, which is
   * how a user empties a field, saves, and watches the old value come back.
   * `companyEmail` carries `@IsEmail()`, so a non-address that reaches the
   * server is a 400 rather than a stored oddity.
   */
  companyEmail?: string | null;
  companyWebsite?: string | null;
  taxNumber?: string | null;
  commercialRegistrationNumber?: string | null;
  acquisitionSourceId?: string | null;
  description?: string;
  interestSummary?: string;
  expectedNeed?: string;
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
