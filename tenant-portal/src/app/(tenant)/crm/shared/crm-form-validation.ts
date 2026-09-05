// The checks every CRM create form repeats, in one place.
//
// These are MIRRORS of specific decorators and throws, not a second opinion:
// a client rule stricter than the server's rejects a value the API would have
// taken, which is worse than letting a rare shape through to the error summary
// the modal already renders.

import { formatTemplate } from "@/lib/format/template";
import type { CrmFormErrors } from "./hooks/useCrmCreateForm";

export interface CrmFieldMessages {
  required: string;
  email: string;
  /** Takes `{max}`. */
  maxLength: string;
  duplicatePhone: string;
  url: string;
}

// `@IsEmail()` is stricter than this, deliberately: a client-side check that
// rejects an address the server would have accepted is worse than one that
// lets a rare shape through.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

/**
 * `normalizeMobile`, mirrored from the CRM services.
 *
 * Only ever used to compare two numbers the user typed. What is SENT is the raw
 * string — normalising client-side would hide from the user which of their two
 * entries the server considers the same number.
 */
function normalizeCrmPhone(phone: string): string {
  const compact = phone.replace(/[^\d+]/gu, "").trim();
  const digits = compact.replace(/\D/gu, "");
  if (compact.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  return digits;
}

/** `@MaxLength(32)` on every phone string in CRM. */
const PHONE_MAX_LENGTH = 32;

/**
 * Collects one form's field errors, keyed by path.
 *
 * A class rather than a bag of functions because every method needs the same
 * message set, and threading it through a dozen calls is how one of them ends
 * up with the wrong wording.
 */
export class CrmErrorBag {
  readonly errors: CrmFormErrors = {};

  constructor(private readonly messages: CrmFieldMessages) {}

  /** Returns whether the value is present, so a caller can skip further checks. */
  required(key: string, value: string): boolean {
    if (value.trim().length > 0) return true;
    this.errors[key] = this.messages.required;
    return false;
  }

  maxLength(key: string, value: string, max: number): void {
    if (this.errors[key] || value.trim().length <= max) return;
    this.errors[key] = formatTemplate(this.messages.maxLength, { max });
  }

  email(key: string, value: string, max = 180): void {
    const trimmed = value.trim();
    if (trimmed.length === 0) return;
    if (!EMAIL_PATTERN.test(trimmed)) {
      this.errors[key] = this.messages.email;
      return;
    }
    this.maxLength(key, trimmed, max);
  }

  /** `@IsUrl()` / a website column. Blank passes; a bare host does not. */
  url(key: string, value: string, max = 255): void {
    const trimmed = value.trim();
    if (trimmed.length === 0) return;
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        this.errors[key] = this.messages.url;
        return;
      }
    } catch {
      this.errors[key] = this.messages.url;
      return;
    }
    this.maxLength(key, trimmed, max);
  }

  /** Only sets a message when the path has none, so the first cause wins. */
  set(key: string, message: string): void {
    this.errors[key] ??= message;
  }

  /**
   * A phone array.
   *
   * `normalizedPhones` throws `PARTY_DUPLICATE_CONTACT_METHOD` when one array
   * holds the same number twice, and it compares NORMALISED values — so
   * `00966…` and `+966…` collide even though the two strings differ. The
   * duplicate is marked on the later row, which is the one the user just typed.
   */
  phones(prefix: string, phones: readonly string[]): void {
    const seen = new Set<string>();
    phones.forEach((phone, index) => {
      const trimmed = phone.trim();
      if (trimmed.length === 0) return;
      const key = `${prefix}.${index}`;
      this.maxLength(key, trimmed, PHONE_MAX_LENGTH);
      const normalized = normalizeCrmPhone(trimmed);
      if (normalized.length === 0) return;
      if (seen.has(normalized)) this.set(key, this.messages.duplicatePhone);
      seen.add(normalized);
    });
  }

}

/**
 * Which section an error path belongs to, for a `FormModal` index.
 *
 * A lookup on the path's head rather than a chain of conditionals, so adding a
 * field is one row — docs/design/anti-patterns.md on branching that grows with
 * the data.
 */
export function sectionOfErrorPath<TSection extends string>(
  map: ReadonlyArray<readonly [string, TSection]>,
  key: string,
): TSection | null {
  const head = key.split(".")[0];
  return map.find(([prefix]) => prefix === head)?.[1] ?? null;
}

export function sectionErrorCount<TSection extends string>(
  map: ReadonlyArray<readonly [string, TSection]>,
  errors: CrmFormErrors,
  section: TSection,
): number {
  return Object.keys(errors).filter((key) => sectionOfErrorPath(map, key) === section)
    .length;
}
