import { axiosClient } from "@/lib/api/axiosClient";
import { parseLeadDetailCard, type LeadDetailCard } from "./[id]/lead-detail-card-contract";
import { leadPath, parseLeadDetailResponse, type LeadDetail } from "./lead-contract";

export async function fetchLeadDetail(
  leadId: string,
  signal?: AbortSignal,
): Promise<{ lead: LeadDetail; card: LeadDetailCard | null }> {
  const response = await axiosClient.get<unknown>(leadPath(leadId), {
    signal,
    cache: "no-store",
    maxResponseBytes: 512 * 1024,
  });
  const lead = parseLeadDetailResponse(response.data);
  if (lead.id !== leadId) throw new Error("Invalid lead response.");

  // Optional card decoration must not hide an otherwise valid lead.
  let card: LeadDetailCard | null = null;
  try {
    card = parseLeadDetailCard(response.data);
  } catch {
    // The detail page hides its card controls when these fields are invalid.
  }
  return { lead, card };
}
