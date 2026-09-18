import { isCardColor, type CardColor } from "@/design-system";
import { isUUIDv7 } from "@/lib/uuid";

export const MAX_OPPORTUNITY_IMPORTANCE = 3;

export interface OpportunityCardPatch {
  importance?: number;
  /** `null` clears the filing colour; omission leaves it unchanged. */
  cardColor?: CardColor | null;
}

export interface OpportunityCardState {
  importance: number;
  cardColor: CardColor | null;
}

function invalid(): never {
  throw new Error("Invalid opportunity response.");
}

export function parseOpportunityCardColor(value: unknown): CardColor | null {
  if (value === null || value === undefined) return null;
  if (!isCardColor(value)) invalid();
  return value;
}

function parseImportance(value: unknown): number {
  if (
    !Number.isSafeInteger(value) ||
    (value as number) < 0 ||
    (value as number) > MAX_OPPORTUNITY_IMPORTANCE
  ) {
    invalid();
  }
  return value as number;
}

/** Builds the small PATCH used by the card controls and sends no untouched key. */
export function buildOpportunityCardPatchBody(
  patch: OpportunityCardPatch,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (patch.importance !== undefined) {
    body.importance = parseImportance(patch.importance);
  }
  if (patch.cardColor !== undefined) {
    body.cardColor = patch.cardColor === null
      ? null
      : parseOpportunityCardColor(patch.cardColor);
  }
  return body;
}

/**
 * Reads only fields owned by the card write. The PATCH route returns the
 * persisted entity, which is intentionally narrower than the rich Card/Table
 * projection. Callers merge this result into their existing row so customer,
 * contact, source and owner data cannot be replaced by undefined values.
 */
export function parseOpportunityCardPatchResponse(
  payload: unknown,
  expectedId: string,
  previous: OpportunityCardState,
  patch: OpportunityCardPatch,
): OpportunityCardState {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) invalid();
  const item = payload as Record<string, unknown>;
  if (!isUUIDv7(item.id) || item.id !== expectedId) invalid();
  if (
    (patch.importance !== undefined && !("importance" in item)) ||
    (patch.cardColor !== undefined && !("cardColor" in item))
  ) {
    invalid();
  }
  return {
    importance:
      patch.importance === undefined
        ? previous.importance
        : parseImportance(item.importance),
    cardColor:
      patch.cardColor === undefined
        ? previous.cardColor
        : parseOpportunityCardColor(item.cardColor),
  };
}
