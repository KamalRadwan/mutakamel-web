"use client";

import { ArrowLeft, ArrowLeftRight, ArrowRight, CalendarDays, ChartNoAxesColumn, CircleCheck, Database, FilePlus2, Info, Monitor } from "lucide-react";
import { Button, ConfirmActionModal, DegradedBanner, PageHeader, Stepper, cn, mirrorInRtl, type StepState } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { DashboardCatalog } from "../../dashboards/dashboard-catalog-contract";
import { useWidgetBuilderSteps } from "../hooks/useWidgetBuilderSteps";
import { useWidgetForm } from "../hooks/useWidgetForm";
import type { WidgetFormState } from "../widget-form";
import { WidgetBuilderFields } from "./WidgetBuilderFields";

const STEP_ICONS = {
  details: Database,
  metrics: ChartNoAxesColumn,
  scope: CalendarDays,
  comparison: ArrowLeftRight,
  display: Monitor,
  review: CircleCheck,
};

interface Props {
  title: string;
  initial?: WidgetFormState;
  catalog: DashboardCatalog | null;
  isSubmitting: boolean;
  error?: string;
  canPreview: boolean;
  blocked?: boolean;
  needsReview?: boolean;
  reviewReady?: boolean;
  onReload: () => void;
  onReview: () => void;
  onCancel: () => void;
  onSaveDraft: (form: WidgetFormState) => void;
}

export function WidgetBuilder(props: Props) {
  const { t } = useI18n();
  const { builder, review, formErrors } = t.crmWidgets;
  const state = useWidgetForm({ initial: props.initial, catalog: props.catalog, canPreview: props.canPreview,
    pending: props.isSubmitting, blocked: props.blocked ?? false, onSaveDraft: props.onSaveDraft });
  const { step, steps: stepIds, heading, errorStep, previous, next, select, isComplete } = useWidgetBuilderSteps(state.error);
  const reviewing = step === "review";
  const stepLabel = builder.steps[step];
  const validation = state.error && (reviewing || (state.touched && step === errorStep)) ? formErrors[state.error] : null;
  const steps = stepIds.map((id) => {
    let status: StepState = "upcoming";
    if (id === step) status = "current";
    else if (id === errorStep && (state.touched || reviewing)) status = "invalid";
    else if (isComplete(id)) status = "complete";
    const Icon = STEP_ICONS[id];
    return { id, label: builder.steps[id].title, state: status, icon: <Icon className="size-5" /> };
  });

  return <div className="flex min-h-full flex-col gap-4 px-1 sm:px-3">
    <PageHeader title={props.title} description={t.crmWidgets.formDescription}
      leading={<FilePlus2 className="mt-0.5 size-7 shrink-0 text-foreground sm:size-8" aria-hidden="true" />}
      primaryAction={{ label: t.crmWidgets.lifecycle.saveDraft, onClick: state.saveDraft,
        disabled: state.disabled || !props.catalog, loading: props.isSubmitting }} />
    <Stepper label={builder.progress} steps={steps} layout="stacked"
      onStepSelect={props.isSubmitting ? undefined : select} />
    {!props.catalog && <DegradedBanner message={t.crmWidgets.catalogueUnavailableForBuilder} />}
    {props.needsReview && <div className="space-y-2 rounded-lg border border-border bg-card p-4">
      <DegradedBanner message={review.uncertain} />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={props.onReload} disabled={props.isSubmitting}>{review.checkCurrent}</Button>
        <Button variant="outline" onClick={props.onReview} disabled={!props.reviewReady || props.isSubmitting}>{review.reviewed}</Button>
      </div>
    </div>}
    <section aria-labelledby="widget-builder-step" className="min-w-0 rounded-card border border-border bg-card p-4 shadow-xs sm:p-6">
      <header className="mb-5 border-b border-border pb-4">
        <h2 id="widget-builder-step" ref={heading} tabIndex={-1} className="text-xl font-semibold">{stepLabel.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{stepLabel.description}</p>
      </header>
      <div className="grid gap-4">
        <WidgetBuilderFields step={step} state={state} catalog={props.catalog} canPreview={props.canPreview} />
        {validation && <div className="flex flex-wrap items-center gap-2">
          <p role="alert" className="text-sm text-destructive">{validation}</p>
          {reviewing && errorStep && <Button variant="outline" onClick={() => select(errorStep)}>{builder.reviewSettings}</Button>}
        </div>}
        {props.error && <p role="alert" className="text-sm text-destructive">{props.error}</p>}
      </div>
      {step === "details" && <p className="mt-6 flex items-start gap-2 rounded-lg bg-secondary p-3 text-sm text-secondary-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{builder.nextDetails}
      </p>}
    </section>
    <footer className="sticky bottom-0 mt-auto flex flex-wrap items-center justify-end gap-2 border-t border-border bg-background py-3">
      <Button size="xl" variant="outline" disabled={props.isSubmitting} onClick={() => state.guard.requestDiscard(props.onCancel)}>{t.common.cancel}</Button>
      <div className="flex flex-wrap items-center gap-2">
        {previous && <Button size="xl" variant="outline" disabled={props.isSubmitting} onClick={() => select(previous)}>
          <ArrowLeft className={cn("size-4", mirrorInRtl)} aria-hidden="true" />{builder.back}
        </Button>}
        {next && <Button size="xl" variant="secondary" onClick={() => select(next)}>
          {builder.next}<ArrowRight className={cn("size-4", mirrorInRtl)} aria-hidden="true" />
        </Button>}
        {reviewing && props.canPreview && <Button size="xl" variant="outline" onClick={state.runPreview}
          loading={state.preview.busy} disabled={!!state.error || state.disabled}>{t.crmWidgets.preview}</Button>}
      </div>
    </footer>
    <ConfirmActionModal open={state.guard.isDiscardOpen} onOpenChange={(open) => { if (!open) state.guard.cancelDiscard(); }}
      title={t.common.discardTitle} description={t.common.discardDescription} confirmLabel={t.common.discardConfirm}
      cancelLabel={t.common.cancel} onConfirm={state.guard.confirmDiscard} />
  </div>;
}
