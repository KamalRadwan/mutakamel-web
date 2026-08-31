"use client";

import { useEffect, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import {
  ACQUISITION_SOURCES_PATH,
  parseAcquisitionSourcesResponse,
  type AcquisitionSource,
} from "../../acquisition-sources/acquisition-source-contract";

/**
 * The tenant acquisition-source catalogue, for every CRM picker that offers it.
 *
 * It degrades rather than failing: the source is one optional field on an edit
 * form, and a catalogue that will not load must not stop a user fixing a
 * misspelled name. `degraded` drives a banner so the absence is stated rather
 * than looking like an empty catalogue.
 */
export function useCrmAcquisitionSources() {
  const [items, setItems] = useState<AcquisitionSource[]>([]);
  const [degraded, setDegraded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await axiosClient.get<unknown>(
          ACQUISITION_SOURCES_PATH,
          {
            signal: controller.signal,
            cache: "no-store",
            maxResponseBytes: 256 * 1024,
          },
        );
        setItems(
          parseAcquisitionSourcesResponse(response.data).filter(
            ({ isActive }) => isActive,
          ),
        );
        setDegraded(false);
      } catch {
        if (controller.signal.aborted) return;
        setItems([]);
        setDegraded(true);
      }
    })();
    return () => controller.abort();
  }, []);

  return { items, degraded };
}
