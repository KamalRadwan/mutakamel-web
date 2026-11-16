import { useCallback, useRef, useState } from "react";
import { getStoredTenantSessionMeta } from "@/lib/api/axiosClient";
import { fetchTemplateDraft, saveTemplateDraft, type TemplateDraftDocument } from "../../template-design-api";
import type { DraftOwner } from "./template-design-flight";
import { discardSalesDraftSave, isCurrentSalesDraftSave, matchesSalesDraftSave, readSalesDraftSave, type RetainedSalesDraftSave } from "./sales-draft-save-storage";

type Restored = { owner: DraftOwner; command: RetainedSalesDraftSave };

export function useSalesDraftSaveRecovery(owner: DraftOwner, key: string | null) {
  const [state, setState] = useState<Restored | null>(null);
  const restored = useRef<Restored | null>(null);
  const [checking, setChecking] = useState<DraftOwner | null>(null);
  const [unconfirmed, setUnconfirmed] = useState<Restored | null>(null);
  const flight = useRef<DraftOwner | null>(null);

  const read = useCallback(() => {
    const command = key ? readSalesDraftSave(key) : null;
    const current = command ? { owner, command } : null;
    restored.current = current;
    setState(current);
    return current;
  }, [key, owner]);

  function discard() {
    const current = restored.current;
    if (!key || current?.owner !== owner || flight.current === owner || !discardSalesDraftSave(key, current.command)) return false;
    restored.current = null;
    setState(null);
    return true;
  }

  async function check(templateId: string, isCurrent: () => boolean,
    adoptCheckpoint: (draft: TemplateDraftDocument, clearRecovery: () => boolean) => void) {
    const current = restored.current;
    const authorizationVersion = getStoredTenantSessionMeta()?.authorizationVersion;
    if (!key || current?.owner !== owner || current.command === "invalid" || flight.current === owner ||
      authorizationVersion === undefined || !isCurrent()) return;
    const { command } = current;
    const sameAuthority = () => isCurrent() && restored.current === current &&
      getStoredTenantSessionMeta()?.authorizationVersion === authorizationVersion && isCurrentSalesDraftSave(key, command);
    const assertCurrent = () => { if (!sameAuthority()) throw new Error("Draft recovery authority changed"); };
    flight.current = owner;
    setChecking(owner);
    setUnconfirmed(null);
    try {
      const latest = await fetchTemplateDraft(templateId, undefined, "TRADE_QUOTATION_PRINT_V1");
      if (!sameAuthority() || latest.templateId !== templateId || !matchesSalesDraftSave(command, latest)) return;
      // The authoritative read has passed the original If-Match. This PATCH can replay a receipt or fail its CAS.
      const replay = await saveTemplateDraft(templateId, latest.editorDocument, command.ifMatch ?? `"${command.revision}"`, command.mutationId, {
        assertCurrent, requireReplay: true,
      });
      if (!sameAuthority() || replay.templateId !== templateId || !matchesSalesDraftSave(command, replay)) return;
      // Core can replay the original success even after a newer save wins.
      const currentDraft = await fetchTemplateDraft(templateId, undefined, "TRADE_QUOTATION_PRINT_V1");
      if (!sameAuthority() || currentDraft.templateId !== templateId || !matchesSalesDraftSave(command, currentDraft)) return;
      adoptCheckpoint(currentDraft, () => {
        if (!sameAuthority() || !discardSalesDraftSave(key, command)) return false;
        restored.current = null;
        setState(null);
        return true;
      });
    } catch {
      // Only an exact stored acknowledgment can clear the unresolved notice.
    } finally {
      if (flight.current === owner) {
        if (restored.current === current && isCurrent()) setUnconfirmed(current);
        flight.current = null;
        setChecking(value => value === owner ? null : value);
      }
    }
  }

  return { read, check, discard, blocked: () => restored.current?.owner === owner, unresolved: state?.owner === owner,
    canCheck: state?.owner === owner && state.command !== "invalid", checking: checking === owner,
    unconfirmed: state?.owner === owner && (state.command === "invalid" || state === unconfirmed) };
}
