import { axiosClient } from "@/lib/api/axiosClient";
import {
  LEAD_STAGES_PATH,
  parseLeadStageCatalogueResponse,
  type LeadStageItem,
} from "../lead-stages/lead-stage-contract";

export async function readLeadStageCatalogue(signal?: AbortSignal): Promise<LeadStageItem[]> {
  const response = await axiosClient.get<unknown>(LEAD_STAGES_PATH, {
    signal,
    cache: "no-store",
    maxResponseBytes: 256 * 1024,
  });
  return parseLeadStageCatalogueResponse(response.data);
}
