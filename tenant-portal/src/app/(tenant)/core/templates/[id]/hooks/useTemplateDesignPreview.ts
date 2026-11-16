import { useCallback, useRef, useState } from "react";
import { previewTemplateEmail, previewTemplateHtml } from "../../template-lifecycle-api";
import type { TemplateDetail } from "../../templates-contract";
import type { TemplateDataSchema, TemplateDraftDocument } from "../../template-design-api";
import type { DraftOwner } from "./template-design-flight";

type PreviewFlight = {
  owner: DraftOwner;
  draftId: string;
  draftRevision: number;
};
type DraftSample = PreviewFlight & {
  html: string;
  email: { subject: string; preheader: string | null; locale: TemplateDetail["locale"] } | null;
};

export function useTemplateDesignPreview(template: TemplateDetail, draft: TemplateDraftDocument | null, schema: TemplateDataSchema | null,
  owner: DraftOwner, access: { blocked: boolean; current: () => boolean; ready: () => boolean; onError: (value: string | null) => void; failure: string }) {
  const [sample, setSample] = useState<DraftSample | null>(null);
  const [flight, setFlight] = useState<PreviewFlight | null>(null);
  const activeFlight = useRef<PreviewFlight | null>(null);
  const matchesDraft = (entry: PreviewFlight | null) => entry?.owner === owner &&
    entry.draftId === draft?.draftId && entry.draftRevision === draft?.revision;
  const clearSample = useCallback(() => {
    activeFlight.current = null;
    setFlight(null);
    setSample(null);
  }, []);
  const preview = async () => {
    if (!access.current() || !draft || !schema || access.blocked || matchesDraft(activeFlight.current)) return;
    const fixture = schema.syntheticFixtures.find(row => row.locale === template.locale);
    if (!fixture) { access.onError(access.failure); return; }
    const request = { owner, draftId: draft.draftId, draftRevision: draft.revision };
    activeFlight.current = request;
    setFlight(request); access.onError(null);
    try {
      const requestPreview = template.outputChannel === "EMAIL" ? previewTemplateEmail : previewTemplateHtml;
      const result = await requestPreview(template.id, {
        source: { kind: "DRAFT", draftRevision: draft.revision }, fixtureKey: fixture.fixtureKey,
        locale: template.locale, timeZone: "Africa/Cairo",
      });
      if (activeFlight.current !== request || !access.current() || !access.ready()) return;
      if (result.templateId !== template.id || result.sourceKind !== "DRAFT" ||
        result.draftId !== draft.draftId || result.draftRevision !== draft.revision) {
        access.onError(access.failure); return;
      }
      setSample({ ...request, html: result.html,
        email: result.kind === "EMAIL" ? { subject: result.subject, preheader: result.preheader, locale: template.locale } : null });
    } catch {
      if (activeFlight.current === request && access.current() && access.ready()) access.onError(access.failure);
    } finally {
      if (activeFlight.current === request) {
        activeFlight.current = null;
        setFlight(current => current === request ? null : current);
      }
    }
  };
  const currentSample = matchesDraft(sample) ? sample : null;
  return { sample: currentSample?.html ?? null, emailSample: currentSample?.email ?? null,
    previewing: matchesDraft(flight), preview, clearSample };
}
