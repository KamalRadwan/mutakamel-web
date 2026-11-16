"use client";
import { useMemo, useState, useSyncExternalStore } from "react";
import { createDesignerCommandStore } from "../../designer-command-store";

export function useDesignerCommandState() {
  const [store] = useState(createDesignerCommandStore);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const viewport = useSyncExternalStore(store.subscribeViewport, store.getViewport, store.getViewport);
  // Public rendering aliases cannot mutate the private authored history.
  const { document: privateDocument } = state;
  const document = useMemo(() => privateDocument ? JSON.parse(JSON.stringify(privateDocument)) as typeof privateDocument : null, [privateDocument]);
  return { store, state, viewport, document };
}
