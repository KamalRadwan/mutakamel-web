"use client";

import { useId, useState, type ReactNode } from "react";
import { Check, MapPin, TrendingUp, X } from "lucide-react";
import { cn } from "../../lib/cn";
import { Button } from "../../primitives/Button";
import { Dialog, DialogContent, DialogTitle } from "../../primitives/Dialog";
import { PageActions } from "../../shell/PageActions";
import { ConfirmActionModal } from "../confirm-action/ConfirmActionModal";
import { FormErrorSummary } from "../form-shell/FormErrorSummary";
import { useFormShell } from "../form-shell/useFormShell";
import { DossierFormModeSwitch } from "./DossierFormCard";

export interface DossierFormSurfaceProps {
  open: boolean;
  expanded: boolean;
  title: string;
  branchLabel?: string;
  onExpandedChange: (expanded: boolean) => void;
  onClose: () => void;
  onSubmit: () => void;
  isDirty: boolean;
  isSubmitting: boolean;
  submitDisabled?: boolean;
  error?: string;
  footerLeading?: ReactNode;
  children: ReactNode;
  labels: {
    compact: string; expanded: string; submit: string; cancel: string; close: string;
    discardTitle: string; discardDescription: string; discardConfirm: string;
  };
}

export function DossierFormSurface(props: DossierFormSurfaceProps) {
  const formId = useId();
  const [body, setBody] = useState<HTMLDivElement | null>(null);
  const shell = useFormShell({ body, open: props.open, isDirty: props.isDirty,
    isSubmitting: props.isSubmitting, submitDisabled: props.submitDisabled, error: props.error,
    onSubmit: props.onSubmit, onOpenChange: (next) => { if (!next) props.onClose(); } });
  const modeSwitch = <DossierFormModeSwitch expanded={props.expanded} onExpandedChange={props.onExpandedChange}
    compactLabel={props.labels.compact} expandedLabel={props.labels.expanded} disabled={props.isSubmitting} />;
  const actions = <>
    <Button type="button" variant="outline" size="sm" onClick={shell.requestClose} disabled={props.isSubmitting}>{props.labels.cancel}</Button>
    <Button type="submit" form={formId} size="sm" variant="primary" loading={props.isSubmitting}
      disabled={props.submitDisabled}><Check className="size-4" aria-hidden="true" />{props.labels.submit}</Button>
  </>;
  const identity = <div className="flex min-w-0 flex-1 basis-full flex-wrap items-center gap-2 md:basis-auto sm:gap-3">
    <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-gradient-logo text-white shadow-sm"><TrendingUp className="size-6" aria-hidden="true" /></span>
    {props.expanded ? <h1 className="min-w-0 break-words text-lg font-semibold text-foreground sm:text-xl">{props.title}</h1>
      : <DialogTitle className="min-w-0 break-words text-lg font-semibold sm:text-xl">{props.title}</DialogTitle>}
    {props.branchLabel && <span title={props.branchLabel} className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-info/30 bg-info-subtle px-2 py-1 text-xs font-medium text-info-subtle-foreground"><MapPin className="size-3.5 shrink-0" aria-hidden="true" /><span className="truncate">{props.branchLabel}</span></span>}
  </div>;
  const content = <form id={formId} noValidate onSubmit={shell.handleSubmit} className={cn("flex min-h-0 flex-1 flex-col", props.expanded && "gap-3")}>
    <div className={cn("dossier-hero px-3! py-3! sm:px-5!", !props.expanded && "rounded-none! border-0! shadow-none!")}>{identity}<div className="ms-auto flex min-w-0 flex-wrap items-center gap-2">{modeSwitch}
      {!props.expanded && <Button type="button" variant="outline" size="sm" className="size-9 shrink-0 p-0 max-sm:size-11" disabled={props.isSubmitting} onClick={shell.requestClose} aria-label={props.labels.close}><X className="size-4" aria-hidden="true" /></Button>}
    </div></div>
    <div ref={setBody} className={cn("grid min-h-0 min-w-0 content-start gap-3 overflow-y-auto bg-surface-subtle p-4 [&_input]:bg-surface-subtle [&_textarea]:bg-surface-subtle [&_[role=combobox]]:bg-surface-subtle", props.expanded && "overflow-visible bg-transparent p-0")}>{props.children}</div>
    <div className="flex shrink-0 flex-col gap-2 border-t border-line-card bg-card px-4 py-3"><FormErrorSummary error={props.error} />
      <div className="flex flex-wrap items-center justify-between gap-2">{props.footerLeading}{!props.expanded && <div className="ms-auto flex items-center gap-2">{actions}</div>}</div>
    </div>
  </form>;
  const confirm = <ConfirmActionModal open={shell.confirmingDiscard} onOpenChange={shell.setConfirmingDiscard}
    title={props.labels.discardTitle} description={props.labels.discardDescription}
    confirmLabel={props.labels.discardConfirm} cancelLabel={props.labels.cancel} onConfirm={shell.confirmDiscard} />;
  if (!props.open) return null;
  if (props.expanded) return <><PageActions slot="actions"><div className="flex flex-wrap items-center gap-2">{actions}</div></PageActions>{content}{confirm}</>;
  return <><Dialog open={props.open} onOpenChange={(next) => { if (!next) shell.requestClose(); }}>
    <DialogContent size="2xl" showCloseButton={false} aria-describedby={undefined} className="flex max-h-[92dvh] w-[calc(100%-2rem)] max-w-[1120px] flex-col gap-0 overflow-hidden rounded-lg p-0 sm:p-0"
      onEscapeKeyDown={(event) => { event.preventDefault(); shell.requestClose(); }}
      onPointerDownOutside={(event) => { event.preventDefault(); shell.requestClose(); }}>
      {content}
    </DialogContent>
  </Dialog>{confirm}</>;
}
