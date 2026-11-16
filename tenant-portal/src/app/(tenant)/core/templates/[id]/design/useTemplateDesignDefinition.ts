"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { fetchTemplate } from "../../templates-api";
import type { TemplateDetail } from "../../templates-contract";
import type { TemplateDraftDocument } from "../../template-design-api";
import { templateDesignFailure, templateDesignTarget } from "../../template-design-route";

type DefinitionLoad = { state: "loading" | ReturnType<typeof templateDesignFailure> }
  | { state: "ready"; template: TemplateDetail };
type DraftTarget = Pick<TemplateDraftDocument, "templateId" | "draftId" | "revision" | "etag">;

function definitionTarget(template: TemplateDetail): string {
  return JSON.stringify([template.id, template.scope.type, template.scope.companyId, template.scope.branchId,
    template.documentType, template.outputChannel, template.layoutMode, template.dataSourceKey, template.locale, template.direction]);
}

function matchesDraftDetail(detail: TemplateDetail, draft: DraftTarget): boolean {
  const saved = detail.currentDraft;
  return !!saved && detail.id === draft.templateId && saved.draftId === draft.draftId && saved.revision === draft.revision &&
    saved.etag === draft.etag && /^[0-9a-f]{64}$/u.test(saved.contentChecksum);
}

/** A separate readback lane. It never replaces the route result or editor props. */
function createDefinitionDraftRefresh() {
  let active: {
    definition: TemplateDetail; draft: TemplateDraftDocument; controller: AbortController;
    target: string; isCurrent(): boolean;
  } | null = null;
  let detail: TemplateDetail | null = null;
  const listeners = new Set<() => void>();
  const publish = (next: TemplateDetail | null) => {
    if (detail === next) return;
    detail = next;
    listeners.forEach(listener => listener());
  };
  const cancel = () => {
    const controller = active?.controller;
    active = null;
    controller?.abort();
    publish(null);
  };
  return {
    cancel,
    getSnapshot: () => detail,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    async observe(definition: TemplateDetail, draft: TemplateDraftDocument, isCurrent: () => boolean, force: boolean) {
      if (definition.id !== draft.templateId || !templateDesignTarget(definition.scope) ||
          !Number.isSafeInteger(draft.revision) || draft.revision < 1 || draft.etag !== '"' + draft.revision + '"' ||
          !isCurrent()) return;
      cancel();
      const target = definitionTarget(definition);
      const { templateId, draftId, revision, etag } = draft;
      const expected = { templateId, draftId, revision, etag };
      const controller = new AbortController();
      const request = { definition, draft, controller, target, isCurrent };
      active = request;
      if (!force && matchesDraftDetail(definition, expected)) {
        publish(definition);
        return;
      }
      try {
        const fresh = await fetchTemplate(expected.templateId, controller.signal);
        if (active === request && !controller.signal.aborted && isCurrent() && definitionTarget(definition) === target &&
            definitionTarget(fresh) === target && matchesDraftDetail(fresh, expected)) publish(fresh);
      } catch { /* The draft binding stays unavailable. The mounted editor owns its own errors. */ }
    },
    read(definition: TemplateDetail, draft: TemplateDraftDocument): TemplateDetail | null {
      const request = active;
      if (!request || request.definition !== definition || request.draft !== draft) return null;
      if (!request.isCurrent() || definitionTarget(definition) !== request.target) return null;
      return detail && matchesDraftDetail(detail, draft) ? detail : null;
    },
  };
}

export type TemplateDesignDraftRefresh = ReturnType<typeof createDefinitionDraftRefresh>;

export function useTemplateDesignDefinition(selectedId: string) {
  const [result, setResult] = useState<DefinitionLoad>({ state: "loading" });
  const [loadAttempt, setAttempt] = useState(0);
  const { id, attempt, draftRefresh } = useMemo(() => ({
    id: selectedId,
    attempt: loadAttempt,
    draftRefresh: createDefinitionDraftRefresh(),
  }), [selectedId, loadAttempt]);
  useLayoutEffect(() => draftRefresh.cancel, [draftRefresh]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchTemplate(id, controller.signal).then(
      template => {
        if (!controller.signal.aborted) {
          setResult(template.id.toLowerCase() === id.toLowerCase() ? { state: "ready", template } : { state: "missing" });
        }
      },
      cause => {
        if (!controller.signal.aborted) setResult({ state: templateDesignFailure(cause) });
      },
    );
    return () => controller.abort();
  }, [id, attempt]);

  return { result, draftRefresh, retry: () => { setResult({ state: "loading" }); setAttempt(value => value + 1); } };
}
