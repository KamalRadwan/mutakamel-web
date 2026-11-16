"use client";

import type { ReactNode } from "react";
import { AlertCircle, RefreshCw, Settings2, Tag, X } from "lucide-react";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  Field, IdentifierText, Input, Money, PermissionGate, ToggleGroup, ToggleGroupItem, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, cn, hitArea, hitTarget } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { tradeDocumentMessage } from "../../documents/trade-document-errors";
import type { QuotationPricingState } from "../hooks/useQuotationPricing";
import { QUOTATION_PERMISSIONS } from "../quotation-contract";
import { discountValue } from "../quotation-discount-draft";
import { QUOTATION_DISCOUNT_REASON_MAX } from "../quotation-discount-contract";
import { QuotationDiscountLimitsDialog } from "./QuotationDiscountLimitsDialog";
import { QuotationPricingFeedback } from "./QuotationPricingFeedback";

export function QuotationPricingControls({
  state,
  currencyCode,
  disabled = false,
  requiredPermission = QUOTATION_PERMISSIONS.create,
  actions,
}: {
  state: QuotationPricingState;
  currencyCode: string;
  disabled?: boolean;
  requiredPermission?: string | string[];
  actions?: ReactNode;
}) {
  const { t, dir } = useI18n();
  const copy = t.quotationDiscount;
  const { discount, policy } = state;
  const draft = discount.draft;
  const manual = draft.mode === "DISCOUNT";
  const valueError = manual && draft.scope === "DOCUMENT" && discountValue(draft.value, draft.type) === null
    ? draft.type === "PERCENT" ? copy.invalidPercent : copy.invalidValue : undefined;
  const policyStatusMessage = policy.loading
    ? copy.policyLoading
    : !policy.error && !policy.policy?.canApply
      ? policy.policy?.hasApplyPermission ? copy.policyMissing : copy.policyDenied
      : null;
  const priceFailure = state.preview.error?.code?.startsWith("TRADE.PRICE.") ? state.preview.error : null;
  const priceFailureMessage = priceFailure
    ? tradeDocumentMessage(priceFailure.code, t.tradeDocuments.errors)
      ?? (priceFailure.status === 403 ? t.quotationExperience.writePermission : copy.previewUnavailable)
    : null;
  const feedbackState = priceFailure
    ? { ...state, preview: { ...state.preview, error: null } }
    : state;
  const segmentItemClass = cn(
    "min-h-9 min-w-0 flex-auto px-2.5 sm:h-6 sm:min-h-0 sm:flex-none",
    hitTarget,
  );

  return <TooltipProvider delayDuration={200}><section aria-label={copy.title} className="space-y-1.5">
    <div className="flex min-h-9 flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2 sm:px-2.5 sm:py-1.5">
      <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-foreground">{copy.discount}</span>
      <ToggleGroup type="single" value={draft.mode} size="sm" dir={dir} aria-label={copy.mode} disabled={disabled}
        className="min-w-0"
        onValueChange={(value) => { if (value === "NONE" || value === "PROMOTIONS" || value === "DISCOUNT") discount.setMode(value); }}>
        <ToggleGroupItem value="NONE" aria-label={copy.none} className={segmentItemClass}>
          <span className="truncate">{copy.none}</span>
        </ToggleGroupItem>
        <ToggleGroupItem value="PROMOTIONS" aria-label={copy.promotions}
          className={cn(segmentItemClass, "gap-1 data-[state=on]:bg-success-subtle data-[state=on]:text-success-subtle-foreground")}>
          <Tag className="size-3.5 shrink-0" aria-hidden="true" /><span className="truncate">{copy.promotions}</span>
        </ToggleGroupItem>
        <ToggleGroupItem value="DISCOUNT" aria-label={copy.discount}
          className={cn(segmentItemClass, "data-[state=on]:bg-info-subtle data-[state=on]:text-info-subtle-foreground")}
          disabled={disabled || policy.policy?.canApply !== true}>
          <span className="truncate">{copy.discount}</span>
        </ToggleGroupItem>
      </ToggleGroup>
      </div>

      {!manual ? (
        policyStatusMessage ? <span role="status" className="min-w-0 text-xs text-muted-foreground">{policyStatusMessage}</span> : null
      ) : (
        <div className="flex min-w-0 basis-full flex-wrap items-center gap-2 sm:basis-auto">
          {/* Scope and type are segmented ToggleGroups, not Radix Selects. A Select closes by
              returning focus to its trigger on a deferred tick; when the change needs the
              confirmation Dialog (existing value/reason), that focus lands outside the freshly
              opened Dialog, which dismisses it as an outside interaction and cancels the change,
              so the old option silently stayed selected. ToggleGroup has no popup or focus
              return, matching the mode switch contract. */}
          <ToggleGroup type="single" value={draft.scope} size="sm" dir={dir} aria-label={copy.scope}
            disabled={disabled} className="w-full min-w-0 max-w-full sm:w-auto sm:shrink-0"
            onValueChange={(value) => { if (value === "LINE" || value === "DOCUMENT") discount.setScope(value); }}>
            <ToggleGroupItem value="LINE" aria-label={copy.lineScope}
              className={cn(segmentItemClass, "data-[state=on]:bg-info-subtle data-[state=on]:text-info-subtle-foreground")}>
              <span className="truncate">{copy.lineScope}</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="DOCUMENT" aria-label={copy.documentScope}
              className={cn(segmentItemClass, "data-[state=on]:bg-warning-subtle data-[state=on]:text-warning-subtle-foreground")}>
              <span className="truncate">{copy.documentScope}</span>
            </ToggleGroupItem>
          </ToggleGroup>

          {draft.scope === "DOCUMENT" ? <>
            <ToggleGroup type="single" value={draft.type} size="sm" dir={dir} aria-label={copy.type}
              disabled={disabled} className="min-w-0 max-w-full flex-auto sm:flex-none sm:shrink-0"
              onValueChange={(value) => { if (value === "PERCENT" || value === "AMOUNT") discount.setType(value); }}>
              <ToggleGroupItem value="PERCENT" aria-label={copy.percent}
                className={cn(segmentItemClass, "data-[state=on]:bg-success-subtle data-[state=on]:text-success-subtle-foreground")}>
                <span className="truncate">{copy.percent}</span>
              </ToggleGroupItem>
              <ToggleGroupItem value="AMOUNT" aria-label={copy.amount}
                className={cn(segmentItemClass, "data-[state=on]:bg-info-subtle data-[state=on]:text-info-subtle-foreground")}>
                <span className="truncate">{copy.amount}</span>
              </ToggleGroupItem>
            </ToggleGroup>
            <Field label={draft.type === "PERCENT" ? copy.percentValue : copy.value} error={valueError} required
              className="min-w-24 max-w-full flex-1 gap-0 sm:w-28 sm:flex-none [&>p]:sr-only">
              <div dir="ltr" className="relative flex w-full items-center">
                <Input size="sm" dir="ltr" inputMode="decimal" value={draft.value} maxLength={40} disabled={disabled}
                  placeholder="0" className="min-h-11 pe-10 text-end tabular-nums sm:min-h-0 sm:pe-9"
                  onChange={(event) => discount.setValue(event.target.value)} />
                <span className="pointer-events-none absolute end-2.5 text-xs text-muted-foreground sm:end-2">
                  <IdentifierText>{draft.type === "PERCENT" ? "%" : currencyCode}</IdentifierText>
                </span>
              </div>
            </Field>
          </> : null}

          <Field label={copy.reasonOptional} className="min-w-0 basis-full gap-0 sm:w-48 sm:basis-auto">
            <Input size="sm" value={draft.reason} maxLength={QUOTATION_DISCOUNT_REASON_MAX} disabled={disabled}
              placeholder={copy.reasonOptional}
              className="min-h-11 sm:min-h-0"
              onChange={(event) => discount.setReason(event.target.value)} />
          </Field>

          {policy.policy?.limit ? (
            <span className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground xl:inline-flex">
              <span>{copy.maxPercent}:</span>
              <span dir="ltr" className="font-medium text-foreground tabular-nums">
                <Money value={policy.policy.limit.maxPercent} maximumFractionDigits={8} />%
              </span>
            </span>
          ) : null}
        </div>
      )}

      {policy.policy?.canManage || actions ? (
        <div className="ms-auto flex max-w-full shrink-0 flex-wrap items-center gap-1.5">
          {policy.policy?.canManage ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" aria-label={copy.manageLimits} disabled={disabled}
                  className={cn("min-h-11 min-w-11 px-2.5 sm:min-h-0 sm:min-w-0", hitArea)}
                  onClick={() => state.limits.setOpen(true)}>
                  <Settings2 className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="hidden lg:inline">{copy.manageLimits}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{copy.manageLimits}</TooltipContent>
            </Tooltip>
          ) : null}
          {actions}
        </div>
      ) : null}
      {valueError ? <p role="alert" className="flex basis-full items-center gap-1.5 text-xs text-destructive">
        <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />{valueError}
      </p> : null}
    </div>

    {manual && policyStatusMessage ? (
      <p role="status" className="rounded-md border border-warning/30 bg-warning-subtle px-2.5 py-1.5 text-xs text-warning-subtle-foreground">
        {policyStatusMessage}
      </p>
    ) : null}

    {policy.error?.status === 403 ? (
      <PermissionGate require={requiredPermission} denied>{null}</PermissionGate>
    ) : policy.error ? (
      <div role="alert" className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/25 bg-destructive/5 px-2.5 py-1.5 text-xs text-destructive">
        <p>{copy.policyUnavailable}</p>
        <Button variant="outline" size="xs" onClick={policy.retry}>{t.common.retry}</Button>
      </div>
    ) : null}

    {discount.notice === "currency" ? (
      <div role="status" className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground">
        <p className="min-w-0 flex-1">{copy.currencyReset}</p>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="xs" className={cn("size-6 shrink-0 p-0", hitArea)}
              aria-label={t.common.close} onClick={discount.dismissNotice}>
              <X className="size-3.5" aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t.common.close}</TooltipContent>
        </Tooltip>
      </div>
    ) : null}

    {priceFailure && priceFailureMessage ? (
      <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/25 bg-destructive/5 px-2.5 py-2 text-xs">
        <div className="flex min-w-0 flex-1 items-start gap-2 text-destructive">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 space-y-0.5">
            <p>{priceFailureMessage}</p>
            {priceFailure.code ? (
              <p className="text-muted-foreground">
                {t.quotationExperience.errorCode}: <IdentifierText>{priceFailure.code}</IdentifierText>
              </p>
            ) : null}
          </div>
        </div>
        <Button variant="outline" size="xs" onClick={state.refresh}>
          <RefreshCw className="size-3.5" aria-hidden="true" />
          {copy.recalculate}
        </Button>
      </div>
    ) : null}

    <div className="[&>p[role=status]]:text-xs">
      <QuotationPricingFeedback state={feedbackState} currencyCode={currencyCode} />
    </div>

    <Dialog open={Boolean(discount.pendingChange)} onOpenChange={(open) => { if (!open) discount.cancelChange(); }}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{copy.modeChangeTitle}</DialogTitle>
          <DialogDescription>{copy.modeChangeDescription}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={disabled} onClick={discount.cancelChange}>{copy.keepCurrent}</Button>
          <Button variant="primary" disabled={disabled} onClick={discount.confirmChange}>{copy.confirmChange}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <QuotationDiscountLimitsDialog state={state.limits} />
  </section></TooltipProvider>;
}
