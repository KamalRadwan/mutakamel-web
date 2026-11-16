"use client";

import { Component, createRef } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { templatePreviewMessages } from "@/i18n/dictionaries/template-preview";
import { isTemplateFocusTarget } from "../feedback/inspector-feedback-context";
import { useTemplatePdfSession, type TemplatePdfSessionInput } from "../hooks/useTemplatePdfSession";
import { TemplatePdfSessionPanel } from "./TemplatePdfSessionPanel";

export function TemplatePdfPreviewBridge(props: TemplatePdfSessionInput) {
  const session = useTemplatePdfSession(props);
  const { lang } = useI18n();
  if (props.template.dataSourceKey !== "TRADE_QUOTATION_PRINT_V1") {
    return <TemplatePdfSessionPanel session={session} />;
  }

  const { id, currentDraft, outputChannel, layoutMode, locale, scope } = props.template;
  const source = JSON.stringify([id, currentDraft.draftId, currentDraft.revision, currentDraft.contentChecksum,
    props.draft?.templateId, props.draft?.draftId, props.draft?.revision, outputChannel, layoutMode, locale,
    scope.type, scope.companyId, scope.branchId, session.fixtureKey]);
  return <PdfPreviewRegion session={session} label={templatePreviewMessages[lang].title}
    descriptorReady={props.schema !== null} lifetime={props.lifetime} subscribeRetirement={props.subscribeRetirement}
    source={source} current={props.current} />;
}

interface PdfPreviewRegionProps {
  session: ReturnType<typeof useTemplatePdfSession>;
  label: string;
  descriptorReady: boolean;
  lifetime: TemplatePdfSessionInput["lifetime"];
  subscribeRetirement: TemplatePdfSessionInput["subscribeRetirement"];
  source: string;
  current: TemplatePdfSessionInput["current"];
}

class PdfPreviewRegion extends Component<PdfPreviewRegionProps, object, HTMLElement | null> {
  private readonly region = createRef<HTMLElement>();

  // Capture focus before React disables or removes the active control.
  getSnapshotBeforeUpdate(previous: PdfPreviewRegionProps) {
    const region = this.region.current;
    if (!region || previous.lifetime !== this.props.lifetime || previous.source !== this.props.source ||
      previous.subscribeRetirement !== this.props.subscribeRetirement) return null;

    const active = region.ownerDocument.activeElement;
    return active instanceof HTMLElement && active !== region && region.contains(active) ? active : null;
  }

  componentDidUpdate(previous: PdfPreviewRegionProps, _state: object, origin?: HTMLElement | null) {
    const region = this.region.current;
    if (!origin || !region || !this.props.current()) return;
    // Download stays focusable during the authorization check.
    if (region.contains(origin) && !origin.matches(":disabled") &&
      (this.props.session.status === "checking" || !origin.matches('[aria-disabled="true"]'))) return;

    const finishedPolling = ["pending", "retrying"].includes(previous.session.status) &&
      this.props.session.status === "completed" && this.props.session.job?.artifact;
    // Download is the enabled native button after the polling controls are removed.
    const action = finishedPolling ? region.querySelector<HTMLButtonElement>('button:not(:disabled):not([aria-disabled="true"])') : null;
    const target = action && isTemplateFocusTarget(action, region) ? action : region;
    if (!isTemplateFocusTarget(target, region)) return;

    const document = region.ownerDocument;
    const active = document.activeElement;
    if (active?.isConnected && active !== origin && active !== document.body && active !== document.documentElement) return;
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'));
    const topDialog = dialogs.at(-1);
    if (!topDialog || topDialog.contains(target)) target.focus();
  }

  render() {
    return <section ref={this.region} aria-label={this.props.label} tabIndex={-1}
      className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <TemplatePdfSessionPanel session={this.props.session} salesDraftDescriptorReady={this.props.descriptorReady} />
    </section>;
  }
}
