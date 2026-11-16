import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useTenantAuth, type TenantProfileCommit } from "@/context/AuthContext";
import type { DesignerCommandStore } from "../../designer-command-store";
import type { TemplateDraftDocument } from "../../template-design-api";
import type { EditorDocument } from "../../template-editor-model";
import type { TemplateDetail } from "../../templates-contract";
import { createSalesQuotationBindingCommands, type SalesQuotationBindingCommand } from "../bindings/sales-quotation-binding-commands";
import { observeSalesQuotationOrigin, type SalesQuotationOriginObservation } from "../bindings/sales-quotation-origin-observation";
import type { ScopedTableChoice } from "../bindings/scoped-table-source";

const noProfile = () => null;

interface SalesBindingReceipt {
  readonly observation: SalesQuotationOriginObservation | null;
  readonly profile: TenantProfileCommit;
  readonly detail: TemplateDetail;
  readonly draft: TemplateDraftDocument;
  readonly authorityKey: string;
  readonly generation: number;
  readonly attempt: number;
}

export function useSalesQuotationOriginBinding(
  detail: TemplateDetail,
  draft: TemplateDraftDocument | null,
  authorityKey: string,
  generation: number,
  store: DesignerCommandStore,
  isCurrentDraft: () => boolean,
  canEdit: () => boolean,
  execute: (document: EditorDocument, isCurrent: () => boolean) => boolean,
) {
  const { readReadyProfileCommit, subscribeProfileReadiness } = useTenantAuth();
  const profile = useSyncExternalStore(subscribeProfileReadiness, readReadyProfileCommit, noProfile);
  const request = useRef<AbortController | null>(null);
  const [receipt, setReceipt] = useState<SalesBindingReceipt | null>(null);
  const [attempt, setAttempt] = useState(0);
  const currentReceipt = receipt?.profile === profile && receipt.detail === detail && receipt.draft === draft &&
    receipt.authorityKey === authorityKey && receipt.generation === generation && receipt.attempt === attempt ? receipt : null;
  const observation = currentReceipt?.observation ?? null;

  useLayoutEffect(() => {
    if (!draft || !profile) return;
    const controller = new AbortController();
    request.current = controller;
    const isCurrent = () => request.current === controller && isCurrentDraft() &&
      store.getSnapshot().generation === generation;
    queueMicrotask(() => {
      if (!isCurrent()) return;
      void observeSalesQuotationOrigin({
        profile, detail, draft, authorityKey, generation, signal: controller.signal,
        readProfile: readReadyProfileCommit, readOrigin: () => window.location.origin, isCurrent,
      }).then(observation => {
        if (isCurrent() && readReadyProfileCommit() === profile && (!observation || observation.authority.isCurrent())) {
          setReceipt({ observation, profile, detail, draft, authorityKey, generation, attempt });
        }
      });
    });
    return () => {
      controller.abort();
      if (request.current === controller) request.current = null;
    };
  }, [attempt, authorityKey, detail, draft, generation, isCurrentDraft, profile, readReadyProfileCommit, store]);

  const currentEdit = useRef(canEdit);
  const currentExecute = useRef(execute);
  // Only commit this render's authority to callbacks after React commits.
  useLayoutEffect(() => {
    currentEdit.current = canEdit;
    currentExecute.current = execute;
  }, [canEdit, execute]);
  const binding = useMemo(() => createSalesQuotationBindingCommands({
    readOwner: () => observation?.owner ?? null,
    readDraftAuthority: () => observation?.authority ?? null,
    readTrust: () => observation?.trust ?? null,
    readDocument: store.getSnapshot,
    readSelection: () => store.getViewport().selectedIds,
    canEdit: () => observation?.authority.isCurrent() === true,
  }), [observation, store]);
  const offer = canEdit() ? binding.readOffer() : null;
  const commit = (prepared: SalesQuotationBindingCommand | null) =>
    !!prepared && currentEdit.current() && currentExecute.current(prepared.document, prepared.isCurrent);

  return {
    offer,
    saveObservationPending: !!draft && !!profile && !currentReceipt,
    readSaveDescriptorChecksum: () => observation?.authority.isCurrent() ? observation.saveDescriptorChecksum : null,
    retrySaveVerification: currentReceipt?.observation === null ? () => {
      if (!isCurrentDraft() || readReadyProfileCommit() !== profile ||
          store.getSnapshot().generation !== generation || !currentEdit.current()) return;
      setAttempt(value => value === attempt ? value + 1 : value);
    } : undefined,
    insertField: (pin: string, path: string) =>
      currentEdit.current() && commit(binding.prepareField(pin, path, path)),
    insertTable: (choice: ScopedTableChoice) => currentEdit.current() && commit(binding.prepareTable(choice)),
    updateTableHeaders: (pin: string, values: readonly { id: string; label: string }[]) =>
      currentEdit.current() && commit(binding.prepareTableHeaders(pin, values)),
  };
}
