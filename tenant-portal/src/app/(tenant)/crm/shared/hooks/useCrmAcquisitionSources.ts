"use client";

import { useEffect, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import {
  ACQUISITION_SOURCES_PATH,
  parseAcquisitionSourcesResponse,
  type AcquisitionSource,
} from "../../acquisition-sources/acquisition-source-contract";

interface SharedRequest {
  promise: Promise<AcquisitionSource[]>;
  controller: AbortController;
  consumers: number;
}

// One request serves every picker mounted together: the Leads page mounts four
// (search bar, basic search, board view, create modal) and each used to send its
// own. Nothing is cached after the request settles, so a later mount still reads
// the catalogue fresh.
let shared: SharedRequest | null = null;

function acquire(): SharedRequest {
  if (!shared) {
    const controller = new AbortController();
    const entry: SharedRequest = {
      controller,
      consumers: 0,
      promise: axiosClient
        .get<unknown>(ACQUISITION_SOURCES_PATH, {
          signal: controller.signal,
          cache: "no-store",
          maxResponseBytes: 256 * 1024,
        })
        .then((response) =>
          parseAcquisitionSourcesResponse(response.data).filter(({ isActive }) => isActive),
        ),
    };
    const settle = () => {
      if (shared === entry) shared = null;
    };
    entry.promise.then(settle, settle);
    shared = entry;
  }
  shared.consumers += 1;
  return shared;
}

function release(entry: SharedRequest) {
  entry.consumers -= 1;
  // Deferred so React StrictMode's unmount/remount reuses the request instead
  // of aborting it and sending a second one.
  setTimeout(() => {
    if (entry.consumers > 0 || shared !== entry) return;
    shared = null;
    entry.controller.abort();
  }, 0);
}

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
    let active = true;
    const entry = acquire();
    entry.promise.then(
      (next) => {
        if (!active) return;
        setItems(next);
        setDegraded(false);
      },
      () => {
        if (!active || entry.controller.signal.aborted) return;
        setItems([]);
        setDegraded(true);
      },
    );
    return () => {
      active = false;
      release(entry);
    };
  }, []);

  return { items, degraded };
}
