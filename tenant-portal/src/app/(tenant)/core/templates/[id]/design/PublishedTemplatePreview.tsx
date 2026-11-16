"use client";

import { sha256 } from "@noble/hashes/sha2.js";
import Link from "next/link";
import { Component, createRef, type ReactNode, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { Badge, Button, Skeleton } from "@/design-system";
import { useAccessMode } from "@/hooks/useAccessMode";
import { useI18n } from "@/i18n/I18nContext";
import { templatePreviewMessages } from "@/i18n/dictionaries/template-preview";
import { getStoredTenantSessionMeta } from "@/lib/api/axiosClient";
import { subscribeToTenantAuthEvents } from "@/lib/auth/sessionCoordinator";
import { fetchTemplateDataSchema, type TemplateDataSchema } from "../../template-design-api";
import { fetchTemplateVersion, previewTemplateHtml } from "../../template-lifecycle-api";
import type { TemplateHtmlPreview } from "../../template-lifecycle-contract";
import { confirmPublishedPdfVersion } from "../../template-preview-session-api";
import { supportsPublishedPdfPreview } from "../../template-preview-availability";
import type { PreviewVersionPin } from "../../template-preview-session-contract";
import type { TemplateDetail } from "../../templates-contract";
import { TemplatePdfSessionPanel } from "../components/TemplatePdfSessionPanel";
import { armPublishedPreviewReturnFocus, focusTemplateRegionWhenIdle } from "../feedback/published-preview-focus";
import { useTemplatePdfSession } from "../hooks/useTemplatePdfSession";

const publishedPreviewCopy = {
  ar: {
    quotation: "معاينة عرض السعر",
    title: "معاينة الإصدار المنشور",
    back: "العودة للتصميم",
    backToDetails: "العودة إلى تفاصيل القالب",
    failed: "تعذّر التحقق من معاينة الإصدار المنشور.",
    stale: "تغيّر الإصدار المنشور. أعد تحميل المعاينة للتحقق منه.",
    refresh: "إعادة تحميل الإصدار المنشور",
  },
  en: {
    quotation: "Quotation preview",
    title: "Published version preview",
    back: "Back to design",
    backToDetails: "Back to template details",
    failed: "The published version preview could not be verified.",
    stale: "The published version changed. Reload the preview to verify it.",
    refresh: "Reload published version",
  },
};

type PublishedFixture = TemplateDataSchema["syntheticFixtures"][number] & { fixtureChecksum: string };
type PublishedPdfEvidence = { version: PreviewVersionPin; fixture: PublishedFixture };
type PreviewState = { owner: object; kind: "failed" } | {
  owner: object; kind: "ready"; html: TemplateHtmlPreview; evidence: NonNullable<TemplateHtmlPreview["versionEvidence"]>;
  fixtureKey: string; pdf: PublishedPdfEvidence | null; current: () => boolean;
};

export function PublishedTemplatePreview({ template, versionId, backHref, backToDesign }: {
  template: TemplateDetail;
  versionId: string;
  backHref: string;
  backToDesign: boolean;
}) {
  const { lang, t } = useI18n();
  const { user, authState, realtimeAuthGeneration } = useTenantAuth();
  const { canMutate } = useAccessMode();
  const userId = user?.id;
  const { id, locale, dataSourceKey, documentType, outputChannel, layoutMode } = template;
  const { type, companyId, branchId } = template.scope;
  const salesQuotation = dataSourceKey === "TRADE_QUOTATION_PRINT_V1" && documentType === "QUOTATION" && outputChannel === "PRINT";
  const offerPdf = canMutate && supportsPublishedPdfPreview(template);
  const labels = publishedPreviewCopy[lang];
  const title = salesQuotation ? labels.quotation : labels.title;
  const [result, setResult] = useState<PreviewState | null>(null);
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt(value => value + 1), []);
  const owner = useMemo(() => ({ id, locale, dataSourceKey, documentType, outputChannel, layoutMode,
    scope: { type, companyId, branchId }, versionId, userId, authState, realtimeAuthGeneration, offerPdf, attempt }),
  [id, locale, dataSourceKey, documentType, outputChannel, layoutMode, type, companyId, branchId, versionId,
    userId, authState, realtimeAuthGeneration, offerPdf, attempt]);
  const state = result?.owner === owner ? result : null;
  const heading = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    // Retrying removes the action that held focus while the selected version reloads.
    if (heading.current) focusTemplateRegionWhenIdle(heading.current);
  }, [attempt]);

  useLayoutEffect(() => {
    const { id, versionId, dataSourceKey, locale, documentType, layoutMode, scope, authState, userId, realtimeAuthGeneration, offerPdf } = owner;
    const controller = new AbortController();
    const { signal } = controller;
    const current = () => {
      const sessionId = getStoredTenantSessionMeta()?.sessionId;
      return !signal.aborted && authState === "AUTHENTICATED" && !!sessionId && !!userId &&
        realtimeAuthGeneration === `tenant:${sessionId}:${userId}`;
    };
    const unsubscribe = subscribeToTenantAuthEvents(event => {
      if (signal.aborted) return;
      const same = realtimeAuthGeneration === `tenant:${event.sessionId}:${userId}`;
      if (event.kind === "session-ended" ? same : !same) {
        controller.abort();
        setResult({ owner, kind: "failed" });
      }
    });
    const load = async () => {
      try {
        if (!current()) throw new Error("Preview session changed");
        const [version, schema] = await Promise.all([
          fetchTemplateVersion(id, versionId, signal),
          fetchTemplateDataSchema(dataSourceKey, scope, signal),
        ]);
        if (!current()) throw new Error("Preview session changed");
        const fixtures = schema.syntheticFixtures.filter(fixture => fixture.locale === locale);
        if (version.id !== versionId || version.lifecycleStatus !== "PUBLISHED" ||
          version.dataSourceKey !== dataSourceKey || !/^[0-9a-f]{64}$/.test(version.templateContentChecksum) ||
          schema.documentType !== documentType || !schema.allowedOutputChannels.includes("PRINT") ||
          !schema.allowedLayoutModes.some(mode => mode === layoutMode) ||
          fixtures.length !== 1) {
          throw new Error("Published version or fixture could not be verified");
        }
        const fixture = fixtures[0];
        const { fixtureKey, fixtureChecksum } = fixture;
        const html = await previewTemplateHtml(id, {
          source: { kind: "VERSION", versionId: version.id },
          fixtureKey,
          locale,
          timeZone: "Africa/Cairo",
        }, signal);
        if (!current()) throw new Error("Preview session changed");
        const evidence = html.versionEvidence;
        if (html.sourceKind !== "VERSION" || html.templateId !== id || html.versionId !== version.id ||
          html.templateContentChecksum !== version.templateContentChecksum || evidence?.versionNumber !== version.versionNumber ||
          (evidence.publishedPreviewFixture && (evidence.publishedPreviewFixture.fixtureKey !== fixtureKey ||
            evidence.publishedPreviewFixture.fixturePayloadChecksum !== fixtureChecksum))) {
          throw new Error("Published preview source mismatch");
        }
        const digest = sha256(new TextEncoder().encode(html.html));
        const outputChecksum = Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("");
        if (!current() || outputChecksum !== evidence.outputChecksum) throw new Error("Published preview output mismatch");
        // The final read checks lifecycle after HTML rendering and supplies immutable PDF eligibility.
        let pdf: PublishedPdfEvidence | null = null;
        if (offerPdf && fixtureChecksum) {
          const pin = await confirmPublishedPdfVersion(owner, version, schema.schemaChecksum, evidence.compiledArtifactChecksum, signal);
          if (pin) pdf = { version: pin, fixture: { ...fixture, fixtureChecksum } };
        } else {
          const confirmed = await fetchTemplateVersion(id, version.id, signal);
          if (confirmed.lifecycleStatus !== "PUBLISHED" || confirmed.id !== version.id ||
            confirmed.versionNumber !== version.versionNumber || confirmed.dataSourceKey !== version.dataSourceKey ||
            confirmed.templateContentChecksum !== version.templateContentChecksum) {
            throw new Error("Published preview version is no longer verified");
          }
        }
        if (!current()) throw new Error("Preview session changed");
        setResult({ owner, kind: "ready", html, evidence, fixtureKey, pdf, current });
      } catch {
        if (!signal.aborted) setResult({ owner, kind: "failed" });
      }
    };
    queueMicrotask(() => { if (!signal.aborted) void load(); });
    return () => { unsubscribe(); controller.abort(); };
  }, [owner]);

  return (
    <section aria-label={title} className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 ref={heading} tabIndex={-1} className="text-lg font-semibold">{title}</h1>
          {state?.kind === "ready" && <Badge tone="positive">
            {t.quotationPdf.published} <bdi>v{state.evidence.versionNumber}</bdi>
          </Badge>}
        </div>
        <Button asChild variant="outline">
          <Link href={backHref} replace onNavigate={() => armPublishedPreviewReturnFocus(backHref, realtimeAuthGeneration)}>
            {backToDesign ? labels.back : labels.backToDetails}
          </Link>
        </Button>
      </header>
      {!state && <Skeleton className="h-[65dvh] w-full" aria-busy="true" />}
      {state?.kind === "failed" && <div className="flex flex-wrap items-center gap-2">
        <p role="alert">{labels.failed}</p>
        <Button variant="outline" onClick={reload}>{t.common.retry}</Button>
      </div>}
      {state?.kind === "ready" && state.pdf && <PublishedPdfActions template={template} {...state.pdf}
        current={state.current} reload={reload} lifetime={state.owner} />}
      {state?.kind === "ready" && <iframe title={title} srcDoc={state.html.html} sandbox="" referrerPolicy="no-referrer"
        data-preview-version-id={state.html.versionId} data-preview-fixture-key={state.fixtureKey}
        data-preview-output-checksum={state.evidence.outputChecksum}
        data-preview-fixture-payload-checksum={state.evidence.publishedPreviewFixture?.fixturePayloadChecksum}
        className="h-[75dvh] w-full rounded-lg border border-border bg-white" />}
    </section>
  );
}

function PublishedPdfActions(props: PublishedPdfEvidence & {
  template: TemplateDetail;
  current: () => boolean; reload: () => void; lifetime: object;
}) {
  const { lang, t } = useI18n();
  const session = useTemplatePdfSession({ ...props, canPreview: true, blocked: false });
  return <PublishedPdfFocusRegion label={templatePreviewMessages[lang].title} canResume={session.canResume} hasDownload={!!session.job?.artifact}
    current={props.current} denied={session.status === "denied"}>
    <TemplatePdfSessionPanel session={session} publishedCopy={{
      version: t.quotationPdf.publishedVersion,
      refresh: publishedPreviewCopy[lang].refresh,
      stale: publishedPreviewCopy[lang].stale,
    }} />
  </PublishedPdfFocusRegion>;
}

interface PublishedPdfFocusRegionProps {
  label: string;
  canResume: boolean;
  hasDownload: boolean;
  current: () => boolean;
  denied: boolean;
  children: ReactNode;
}

class PublishedPdfFocusRegion extends Component<PublishedPdfFocusRegionProps, object, boolean> {
  private readonly region = createRef<HTMLElement>();

  getSnapshotBeforeUpdate(previous: PublishedPdfFocusRegionProps) {
    const region = this.region.current;
    // Capture focus before React removes a session action.
    const removesAction = (previous.canResume && !this.props.canResume) || (previous.hasDownload && !this.props.hasDownload);
    return !!region && removesAction &&
      region.contains(region.ownerDocument.activeElement);
  }

  componentDidUpdate(_previous: PublishedPdfFocusRegionProps, _state: object, focusWasInside?: boolean) {
    const region = this.region.current;
    if (region && focusWasInside && !this.props.denied && this.props.current()) focusTemplateRegionWhenIdle(region);
  }

  render() {
    return <section ref={this.region} aria-label={this.props.label} tabIndex={-1}
      className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {this.props.children}
    </section>;
  }
}
