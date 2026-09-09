"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { DEFINITION_ADOPTION_PERMISSION } from "../definition-adoption-command";
import { readDefinitionAdoptionSelections, readDefinitionAdoptionTargets } from "../definition-adoption-api";
import type { DefinitionAdoptionSelection, DefinitionAdoptionSelections, DefinitionAdoptionTargets } from "../definition-adoption-discovery";

interface State {
  key: string; revision: string | null; selections: DefinitionAdoptionSelections | null; targets: DefinitionAdoptionTargets | null;
  selected: DefinitionAdoptionSelection | null; busy: boolean; changed: boolean; error: NormalizedApiError | null;
}
interface Owner { key: string; active: boolean; busy: boolean; controller: AbortController }
const initial = (key: string): State => ({ key, revision: null, selections: null, targets: null,
  selected: null, busy: false, changed: false, error: null });

export function useDefinitionAdoptionDiscovery() {
  const { user, isAuthenticated, authState, realtimeAuthGeneration } = useTenantAuth();
  const allowed = isAuthenticated && !!user && (user.isTenantOwner || user.permissions.includes(DEFINITION_ADOPTION_PERMISSION));
  const ready = allowed && authState === "AUTHENTICATED" && realtimeAuthGeneration !== null;
  const [reloadToken, setReloadToken] = useState(0);
  const key = JSON.stringify([user?.id, realtimeAuthGeneration, authState, allowed, reloadToken]);
  const [state, setState] = useState<State | null>(null);
  const owner = useRef<Owner | null>(null);
  if (state !== null && state.key !== key) setState(null);
  useEffect(() => {
    const captured: Owner = { key, active: true, busy: true, controller: new AbortController() };
    owner.current = captured;
    if (ready) void readDefinitionAdoptionSelections(null, captured.controller.signal).then(
      (page) => { if (captured.active) setState({ ...initial(key), revision: page.expectedSubscriptionRevision, selections: page }); },
      (error: unknown) => { if (captured.active) setState({ ...initial(key), error: normalizeApiError(error) }); },
    ).finally(() => { captured.busy = false; });
    return () => { captured.active = false; captured.controller.abort(); };
  }, [key, ready]);
  const current = state?.key === key ? state : null;
  const denied = !allowed || current?.error?.status === 403;
  const isCurrent = (captured: Owner) => captured.active && captured.key === key && owner.current === captured;
  const reload = useCallback(() => setReloadToken((value) => value + 1), []);

  const nextSelections = async () => {
    const captured = owner.current, after = current?.selections?.nextCursor;
    if (!captured || !isCurrent(captured) || captured.busy || !ready || denied || !current || !after) return;
    captured.busy = true;
    const pending = { ...current, selections: null, selected: null, targets: null, busy: true, error: null };
    setState(pending);
    try {
      const page = await readDefinitionAdoptionSelections(after, captured.controller.signal);
      if (!isCurrent(captured)) return;
      setState(page.expectedSubscriptionRevision === current.revision ? { ...pending, selections: page, busy: false }
        : { ...initial(key), changed: true });
    } catch (error) { if (isCurrent(captured)) setState({ ...pending, busy: false, error: normalizeApiError(error) }); }
    finally { captured.busy = false; }
  };
  const loadTargets = async (selection: DefinitionAdoptionSelection, after: string | null) => {
    const captured = owner.current;
    if (!captured || !isCurrent(captured) || captured.busy || !ready || denied || !current || current.revision === null) return;
    captured.busy = true;
    const pending = { ...current, selected: selection, targets: null, busy: true, error: null };
    setState(pending);
    try {
      const page = await readDefinitionAdoptionTargets(selection.addonSelectionId, after, captured.controller.signal);
      if (!isCurrent(captured)) return;
      const same = page.expectedSubscriptionRevision === current.revision
        && JSON.stringify(page.currentDefinition) === JSON.stringify(selection.currentDefinition);
      setState(same ? { ...pending, targets: page, busy: false } : { ...initial(key), changed: true });
    } catch (error) { if (isCurrent(captured)) setState({ ...pending, busy: false, error: normalizeApiError(error) }); }
    finally { captured.busy = false; }
  };
  const select = async (id: string) => {
    const row = current?.selections?.items.find((item) => item.addonSelectionId === id);
    if (row) await loadTargets(row, null);
  };
  const nextTargets = async () => {
    if (current?.selected && current.targets?.nextCursor) await loadTargets(current.selected, current.targets.nextCursor);
  };
  return { key, revision: current?.revision ?? null, snapshotKey: JSON.stringify([key, current?.revision]), state: current,
    denied, ready, busy: current?.busy === true || (ready && current === null), reload, select, nextSelections, nextTargets };
}
