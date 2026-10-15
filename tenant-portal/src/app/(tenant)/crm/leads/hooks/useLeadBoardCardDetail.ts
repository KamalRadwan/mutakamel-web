"use client";

import { useEffect, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { leadPath, parseLeadDetailResponse, type LeadDetail } from "../lead-contract";

const DETAIL_RESPONSE_LIMIT_BYTES = 512 * 1024;

/**
 * `GET /leads/:id` for an expanded board card — the only read that lists every
 * contact and stored number. Mounted only while the card is open, so it is one
 * request per expansion.
 */
export function useLeadBoardCardDetail(leadId: string): LeadDetail | null {
  const [loaded, setLoaded] = useState<LeadDetail | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    axiosClient
      .get<unknown>(leadPath(leadId), {
        signal: controller.signal,
        cache: "no-store",
        maxResponseBytes: DETAIL_RESPONSE_LIMIT_BYTES,
      })
      .then((response) => {
        if (!controller.signal.aborted) setLoaded(parseLeadDetailResponse(response.data));
      })
      // The card already shows the list row's numbers and primary contact; a
      // failed or unreadable read leaves exactly those in place.
      .catch(() => undefined);
    return () => controller.abort();
  }, [leadId]);

  return loaded?.id === leadId ? loaded : null;
}
