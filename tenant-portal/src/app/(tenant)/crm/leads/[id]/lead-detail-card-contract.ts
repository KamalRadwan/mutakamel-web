import type { CardColor } from "@/design-system";
import { parseLeadCardColor, parseLeadRating } from "../lead-card-contract";

/**
 * The board-card fields `GET /leads/:id` and its `PATCH` carry beside
 * `LeadDetail`: the lead read model is the same `LeadEntity` the board reads,
 * so `rating`, `cardColor` and `stageEnteredAt` are on the detail response too.
 * They are parsed here rather than in `parseLeadDetailResponse` so the detail
 * contract stays the shape every card editor already compares against.
 */
export interface LeadDetailCard {
  rating: number;
  cardColor: CardColor | null;
  /** Absent on a row the server has not stamped; the screen then shows no age. */
  stageEnteredAt: string | undefined;
}

export function parseLeadDetailCard(payload: unknown): LeadDetailCard {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new Error("Invalid lead response.");
  }
  const lead = payload as Record<string, unknown>;
  const stageEnteredAt = lead.stageEnteredAt;
  return {
    rating: parseLeadRating(lead.rating),
    cardColor: parseLeadCardColor(lead.cardColor),
    stageEnteredAt:
      typeof stageEnteredAt === "string" && !Number.isNaN(Date.parse(stageEnteredAt))
        ? stageEnteredAt
        : undefined,
  };
}
