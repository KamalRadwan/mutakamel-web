"use client";

import { useEffect, useState } from "react";
import { Info, ShieldCheck } from "lucide-react";
import {
  Button, DateTime, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
  RadioGroup, RadioGroupItem, Skeleton, type ComboboxOption,
} from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useAccessMode } from "@/hooks/useAccessMode";
import { useAuthScopeKey } from "@/hooks/useAuthScopeKey";
import { useTenantBranchLabels, useTenantCompanyLabels } from "@/hooks/useTenantBranchLabels";
import { useI18n } from "@/i18n/I18nContext";
import { can } from "@/lib/auth/permission-scope";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { isUUIDv7 } from "@/lib/uuid";
import { canReview } from "./contract";
import { InquiryPicker } from "./InquiryPicker";
import { InquiryRecordCard, InquiryReviewError, InquiryReviewHistory } from "./InquiryReviewEvidence";
import { useInquiryReview } from "./useInquiryReview";

const MANAGE = "crm.inquiry_identities.manage";

export function InquiryReviewAction() {
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const scope = useAuthScopeKey(user);
  const { canMutate } = useAccessMode();
  if (!user || !isUUIDv7(user.id)) return null;
  const allowed = user.isTenantOwner ? user.permissions.includes(MANAGE) : can(user, MANAGE, { tenantWide: true });
  if (!allowed) return null;
  return <ReviewTrigger key={JSON.stringify([realtimeAuthGeneration, scope, user.isTenantOwner, canMutate])}
    actorId={user.id} canMutate={canMutate} />;
}

function ReviewTrigger({ actorId, canMutate }: { actorId: string; canMutate: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [locked, setLocked] = useState(false);
  const close = () => { if (!locked) setOpen(false); };
  return <Dialog open={open} onOpenChange={next => { if (next) setOpen(true); else close(); }}>
    <DialogTrigger asChild>
      <Button size="xl" variant="outline"><ShieldCheck className="size-4" aria-hidden="true" />{t.crmDashboardReports.inquiryReview.action}</Button>
    </DialogTrigger>
    {open && <ReviewDialog actorId={actorId} canMutate={canMutate} onLockChange={setLocked} close={close} />}
  </Dialog>;
}

function useInquiryBranches(): ComboboxOption[] {
  const { user } = useTenantAuth();
  const { t, lang } = useI18n();
  const names = useTenantBranchLabels();
  const companies = useTenantCompanyLabels();
  return [...new Set(user?.accessibleBranches ?? [])].filter(isUUIDv7).map((id, index) => {
    const companyId = user?.accessibleBranchCompanies?.find(branch => branch.branchId === id)?.companyId;
    const company = companyId ? companies.get(companyId) : undefined;
    const label = names.get(id) ?? formatTemplate(t.common.branchNameFallback, { number: formatNumber(index + 1, lang) });
    return { value: id, label: company ? `${label} · ${company}` : label };
  });
}

function ReviewDialog({ actorId, canMutate, onLockChange, close }: {
  actorId: string;
  canMutate: boolean;
  onLockChange: (locked: boolean) => void;
  close: () => void;
}) {
  const { t, dir } = useI18n();
  const copy = t.crmDashboardReports.inquiryReview;
  const review = useInquiryReview(actorId, canMutate);
  const branches = useInquiryBranches();
  const { context, error } = review.sourceRead;
  const selectedReference = review.referenceRead.context;
  const reason = context?.current ? "CORRECTION" : review.mode === "LINK" ? "VERIFIED_SAME" : "VERIFIED_DISTINCT";
  const branchName = (id: string) => branches.find(branch => branch.value === id)?.label;

  useEffect(() => {
    onLockChange(review.locked);
    if (!review.locked) return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [onLockChange, review.locked]);

  return <DialogContent size="2xl" dir={dir}
    className="flex max-h-[94dvh] w-[95vw] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:p-0"
    showCloseButton={!review.locked}
    onEscapeKeyDown={event => { if (review.locked) event.preventDefault(); }}
    onInteractOutside={event => event.preventDefault()}>
    <DialogHeader className="shrink-0 border-b border-border px-4 py-4 pe-14 sm:px-6 sm:pe-14">
      <DialogTitle className="text-xl">{copy.action}</DialogTitle>
      <DialogDescription className="text-sm">{copy.description}</DialogDescription>
    </DialogHeader>
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-6" aria-busy={review.busy || review.sourceRead.loading}>
      {review.pending && <p role="alert" className="rounded-lg border border-border bg-muted p-3 text-sm">{copy.uncertain}</p>}
      {review.denied ? <InquiryReviewError error={{ status: 403 }} /> : <>
        {branches.length ? <InquiryPicker branches={branches} value={review.source} onChange={review.chooseSource} disabled={review.locked} />
          : <p role="status" className="text-sm text-muted-foreground">{copy.noBranches}</p>}
        {review.sourceRead.loading && <Skeleton className="h-20" />}
        {error && <InquiryReviewError error={error} retry={review.locked ? undefined : review.reload} />}
        {review.error && <InquiryReviewError error={review.error} />}
        {review.saved && <p role="status" className="text-sm font-medium">{context ? copy.saved : copy.savedReload}</p>}
        {context && review.source && <>
          <InquiryRecordCard label={copy.currentInquiry} context={context} selection={review.source} branchName={branchName(review.source.branchId)} />
          <p className="flex flex-wrap items-center gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
            <Info className="size-4 shrink-0" aria-hidden="true" />
            {copy.coverage} <DateTime value={context.coverageStartedAt} precision="date" />
          </p>
          {canReview(context) && <RadioGroup value={review.mode ?? ""} disabled={review.locked || !canMutate}
            aria-label={copy.mode} onValueChange={value => { if (value === "NEW" || value === "LINK") review.chooseMode(value); }}
            className="grid gap-2 sm:grid-cols-2">
            <ReviewOption value="LINK" title={copy.link} hint={copy.linkHint} />
            <ReviewOption value="NEW" title={copy.distinct} hint={copy.distinctHint} />
          </RadioGroup>}
          {review.mode === "LINK" && canReview(context) && <>
            <InquiryPicker reference branches={branches} value={review.reference} onChange={review.chooseReference}
              disabled={review.locked || !canMutate} excludeId={review.source.id} />
            {review.referenceRead.loading && <Skeleton className="h-20" />}
            {review.referenceRead.error && <InquiryReviewError error={review.referenceRead.error}
              retry={review.locked ? undefined : review.reload} />}
            {selectedReference && review.reference && <>
              <InquiryRecordCard label={copy.referenceRecord} linkLabel={copy.openReference}
                context={selectedReference} selection={review.reference}
                branchName={branchName(review.reference.branchId)} />
              {!review.target && <p role="status" className="text-sm text-muted-foreground">{copy.incompatible}</p>}
            </>}
          </>}
          {review.mode && canReview(context) && <div className="rounded-lg bg-muted p-3 text-sm">
            <p className="font-medium">{copy.reason} · {copy.reasons[reason]}</p>
            <p className="mt-1 text-muted-foreground">{copy.effect}</p>
          </div>}
          <InquiryReviewHistory context={context} earlier={review.before !== undefined} disabled={review.locked} navigate={review.historyPage} />
        </>}
      </>}
    </div>
    <DialogFooter className="shrink-0 border-t border-border px-4 py-3 sm:px-6">
      <Button size="xl" variant="outline" disabled={review.locked} onClick={close}>{t.common.cancel}</Button>
      {review.pending
        ? <Button size="xl" variant="primary" loading={review.busy} disabled={!canMutate} onClick={() => void review.reconcile()}>{copy.reconcile}</Button>
        : <Button size="xl" variant="primary" loading={review.busy} disabled={!review.canSave} onClick={() => void review.save()}>{review.mode === "LINK" ? copy.saveLink : copy.save}</Button>}
      {review.denied && !review.pending && <Button size="xl" variant="outline" onClick={review.reload}>{t.common.retry}</Button>}
    </DialogFooter>
  </DialogContent>;
}

function ReviewOption({ value, title, hint }: { value: string; title: string; hint: string }) {
  return <label className="flex min-w-0 cursor-pointer items-start gap-3 rounded-lg border border-border p-3 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5">
    <RadioGroupItem value={value} className="mt-0.5" />
    <span className="min-w-0">
      <span className="block text-sm font-semibold">{title}</span>
      <span className="block text-sm text-muted-foreground">{hint}</span>
    </span>
  </label>;
}
