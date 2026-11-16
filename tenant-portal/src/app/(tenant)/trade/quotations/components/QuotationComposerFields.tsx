"use client";

import type { ReactNode } from "react";
import { ChevronDown, LockKeyhole, RefreshCw, Truck } from "lucide-react";
import { Button, Collapsible, CollapsibleContent, CollapsibleTrigger, DatePicker, Field, Input, NameSelect, cn } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import type { QuotationComposerState } from "../hooks/useQuotationComposer";
import { useQuotationFieldEditor } from "../hooks/useQuotationFieldEditor";
import { quotationDatePickerText, quotationDatePickerValue } from "../quotation-editor-values";
import { QuotationCustomerSelect } from "./QuotationCustomerSelect";
import { QuotationDocumentStrip } from "./QuotationDocumentStrip";
import { QuotationDocumentEditor, QuotationTermsEditor } from "./QuotationDocumentEditor";
import { QuotationContactSelect } from "./QuotationContactSelect";
import { QuotationContactDisplay } from "./QuotationContactDisplay";

const COMPACT_CUSTOMER_SELECT = [
  "[&>div]:flex [&>div]:min-w-0 [&>div]:items-center [&>div]:gap-2 [&>div]:space-y-0",
  "[&>div>span]:w-28 [&>div>span]:shrink-0 [&>div>span]:text-xs [&>div>span]:text-foreground lg:[&>div>span]:w-32",
  "[&>div>button]:h-(--size-control-sm) [&>div>button]:min-h-0 [&>div>button]:min-w-0 [&>div>button]:max-w-88 [&>div>button]:flex-1",
  "[&>div>button]:rounded-md [&>div>button]:border [&>div>button]:border-input [&>div>button]:bg-card [&>div>button]:px-2.5 [&>div>button]:py-0",
  "[&>div>button_.size-12]:hidden [&>div>button_.space-y-1]:space-y-0",
  "[&>div>button_.text-base]:text-xs [&>div>button_.text-base]:font-normal [&>div>button_.text-sm]:hidden",
].join(" ");

const COMPACT_CONTACT_SELECT = [
  "[&>div]:space-y-1",
  "[&>div>div]:flex-row [&>div>div]:flex-wrap [&>div>div]:items-center [&>div>div]:gap-x-2 [&>div>div]:gap-y-1",
  "[&>div>div>div:first-child]:w-28 [&>div>div>div:first-child]:shrink-0 lg:[&>div>div>div:first-child]:w-32 [&>div>div>div:nth-child(2)]:min-w-0 [&>div>div>div:nth-child(2)]:max-w-88 [&>div>div>div:nth-child(2)]:flex-1",
  "[&_label]:text-foreground [&_p[id$=-hint]]:sr-only [&>div>p[role=status]]:sr-only",
].join(" ");
const DETAILS_FIELD = "min-w-0 flex-row items-center gap-2 [&>div:first-child]:w-28 [&>div:first-child]:shrink-0 lg:[&>div:first-child]:w-32";

export function QuotationComposerFields({
  composer,
  compact = false,
  embedded = false,
  identityLocked = false,
  headerFieldsLocked = false,
  commercialLocked = false,
  savedValidUntil,
  customerLabel,
  showContact,
  channel,
}: {
  composer: QuotationComposerState;
  compact?: boolean;
  embedded?: boolean;
  identityLocked?: boolean;
  headerFieldsLocked?: boolean;
  commercialLocked?: boolean;
  savedValidUntil?: string;
  customerLabel?: string | null;
  showContact?: boolean;
  /** Single Channel node owned by QuotationContextFields (one lookup hook); first in the start column. */
  channel?: ReactNode;
}) {
  const { t } = useI18n();
  const editor = useQuotationFieldEditor(composer, "document");
  const currencies = composer.currencies;
  const lockedIdentity = identityLocked || composer.partialHeader !== null;
  const lockedHeaderFields = headerFieldsLocked || composer.partialHeader !== null;
  const saved = commercialLocked ? composer.existingQuotation : null;
  const blocked = editor.blocked;
  const hasCompanyContact = showContact
    ?? (composer.selected?.partyType === "ORGANIZATION" || composer.contacts.partyType === "ORGANIZATION");
  const currencyLookupError = !lockedIdentity
    && (currencies.error !== null || !currencies.canRead || (!currencies.loading && currencies.options.length === 0));
  const contactComposer: QuotationComposerState = composer.selected?.partyType === "ORGANIZATION"
    ? composer
    : {
      ...composer,
      selected: composer.selected
        ? { ...composer.selected, partyType: "ORGANIZATION" }
        : {
          partyId: composer.partialHeader?.partyId ?? "",
          displayName: customerLabel ?? "",
          partyType: "ORGANIZATION" as const,
          quotationSelectable: true,
          eligibilitySource: "ACTIVE_COMMERCIAL_ACCOUNT" as const,
          commercialAccountStatus: "ACTIVE" as const,
          crmCustomerProfileId: null,
          denialCode: null,
        },
    };

  return <>
    <QuotationDocumentStrip compact={compact} embedded={embedded} channel={channel}
      customer={lockedIdentity ? (
        <div className="flex min-w-0 items-center gap-2">
          <span className="w-28 shrink-0 text-xs font-medium text-foreground lg:w-32">{t.tradeDocuments.customer}</span>
          <div aria-label={t.tradeDocuments.customer} aria-readonly="true"
            className="flex h-(--size-control-sm) min-w-0 max-w-88 flex-1 items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 text-xs font-medium text-foreground">
            <LockKeyhole className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-start">
              <bdi>{customerLabel ?? composer.selected?.displayName ?? t.tradeDocuments.notRecorded}</bdi>
            </span>
          </div>
        </div>
      ) : (
        <div className={cn("min-w-0", COMPACT_CUSTOMER_SELECT)}>
          <QuotationCustomerSelect customers={composer.customers} selected={composer.selected}
            onSelect={composer.selectCustomer} disabled={blocked} />
        </div>
      )}
      contact={hasCompanyContact ? (
        lockedHeaderFields ? (
          <div className="flex min-w-0 items-center gap-2">
            <span className="w-28 shrink-0 text-xs font-medium text-foreground lg:w-32">{t.quotationExperience.contactLabel}</span>
            <div aria-label={t.quotationExperience.contactLabel} aria-readonly="true"
              className="flex h-(--size-control-sm) min-w-0 max-w-88 flex-1 items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 text-xs font-medium text-foreground">
              <LockKeyhole className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-start">
                <bdi>{composer.selectedContact?.displayName ?? (
                  composer.existingQuotation?.contactPartyId && composer.lockedHeaders
                    ? <QuotationContactDisplay partyId={composer.existingQuotation.partyId}
                        contactPartyId={composer.existingQuotation.contactPartyId} headers={composer.lockedHeaders} />
                    : composer.contactPartyId ? t.quotationExperience.contactUnavailable : t.quotationExperience.contactNone
                )}</bdi>
              </span>
            </div>
          </div>
        ) : (
          <div className={cn("min-w-0", COMPACT_CONTACT_SELECT)}>
            <QuotationContactSelect composer={contactComposer} disabled={blocked} />
          </div>
        )
      ) : undefined}
      currency={
        <Field label={t.tradeDocuments.currency} required={!lockedIdentity} readOnly={lockedIdentity} showLabel
          className={DETAILS_FIELD}>
          {lockedIdentity ? (
            <div className="relative min-w-0 max-w-88 flex-1">
              <LockKeyhole className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input size="sm" dir="ltr" readOnly value={saved?.currencyCode ?? composer.currencyCode} className="ps-7 font-medium tabular-nums" />
            </div>
          ) : (
            <div className="min-w-0 max-w-88 flex-1">
              <NameSelect size="sm" options={currencies.options} value={composer.currencyCode || undefined}
                onValueChange={composer.setCurrencyCode} placeholder={t.quotationFlow.currencySelect}
                disabled={blocked || currencies.loading || !currencies.canRead} className="w-full data-[placeholder]:text-foreground" />
            </div>
          )}
        </Field>
      }
      validity={
        <Field label={t.quotationExperience.validity} required={!commercialLocked && composer.hasPopulatedLines}
          readOnly={commercialLocked} error={commercialLocked ? undefined : composer.validUntilError} showLabel
          className={cn(DETAILS_FIELD, "flex-wrap")}>
          <div className="min-w-0 max-w-88 flex-1">
            <DatePicker size="sm" value={quotationDatePickerValue(commercialLocked ? savedValidUntil ?? "" : composer.validUntil)}
              onValueChange={(value) => composer.setValidUntil(quotationDatePickerText(value))}
              placeholder={commercialLocked ? t.tradeDocuments.notRecorded : t.quotationExperience.validity}
              readOnly={commercialLocked} disabled={blocked} />
          </div>
        </Field>
      }
      reference={
        <Field label={t.quotationFlow.documentReference} readOnly={lockedHeaderFields} showLabel
          className={DETAILS_FIELD}>
          <div className="min-w-0 max-w-88 flex-1">
            <Input size="sm" dir="ltr" value={saved ? saved.draftReference ?? "" : composer.draftReference} maxLength={80}
              placeholder="" readOnly={lockedHeaderFields} disabled={blocked}
              onChange={(event) => composer.setDraftReference(event.target.value)} />
          </div>
        </Field>
      }
      footer={composer.currencyUnavailable || currencyLookupError ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          {composer.currencyUnavailable ? (
            <p role="alert" className="text-destructive">{t.quotationFlow.currencyNotEnabled}</p>
          ) : currencyLookupError ? (
            <div role="alert" className="flex flex-wrap items-center gap-2 text-warning-subtle-foreground">
              <span>{t.quotationFlow.currencyUnavailable}</span>
              {currencies.canRead ? (
                <Button variant="outline" size="xs" disabled={blocked} onClick={currencies.retry}>
                  <RefreshCw className="size-3" aria-hidden="true" />{t.common.retry}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : undefined}
    />
    <QuotationDocumentEditor editor={editor} composer={composer} />
  </>;
}

export function QuotationCommercialTerms({
  composer,
  compact = false,
  savedTerms,
}: {
  composer: QuotationComposerState;
  compact?: boolean;
  savedTerms?: Record<string, unknown>;
}) {
  const { t, lang } = useI18n();
  const c = t.quotationExperience;
  const editor = useQuotationFieldEditor(composer, "terms");
  const readOnly = savedTerms !== undefined;
  const savedText = (key: string) => {
    const value = savedTerms?.[key];
    return typeof value === "string" || typeof value === "number" ? String(value) : "";
  };
  const terms = readOnly ? {
    paymentTermCode: savedText("paymentTermCode"),
    incotermCode: savedText("incotermCode"),
    deliveryDays: savedText("deliveryDays"),
    warrantyMonths: savedText("warrantyMonths"),
  } : composer;
  const formatDuration = (raw: string, unit: string) => {
    const trimmed = raw.trim();
    const parsed = /^\d+$/u.test(trimmed) ? Number(trimmed) : NaN;
    return Number.isSafeInteger(parsed) && parsed >= 0 ? `${formatNumber(parsed, lang)} ${unit}` : t.tradeDocuments.notRecorded;
  };
  const summary = [
    terms.paymentTermCode.trim() || t.tradeDocuments.notRecorded,
    terms.incotermCode.trim() || t.tradeDocuments.notRecorded,
    formatDuration(terms.deliveryDays, t.quotationFlow.dayUnit),
    formatDuration(terms.warrantyMonths, t.quotationFlow.monthUnit),
  ];
  const hasTermError = !readOnly && Boolean(composer.deliveryDaysError || composer.warrantyMonthsError);

  return <Collapsible open={editor.open} onOpenChange={(next) => { if (next) editor.show(); else editor.setOpen(false); }}
    className="rounded-lg border border-border bg-card">
    <CollapsibleTrigger disabled={editor.blocked}
      className={cn("flex w-full items-center justify-between gap-3 text-start", compact ? "px-3 py-1.5" : "px-3 py-2")}>
      <span className="flex min-w-0 items-center gap-2 text-xs font-semibold text-foreground sm:text-sm">
        <Truck className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="shrink-0">{c.termsSection}</span>
        {hasTermError ? <span className="text-xs font-normal text-destructive">({c.validationTitle})</span> : null}
      </span>
      <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
        <span className="hidden truncate sm:inline">
          <bdi>{summary[0]}</bdi>{" · "}<bdi>{summary[1]}</bdi>{" · "}{summary[2]}{" · "}{summary[3]}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 transition-transform", editor.open && "rotate-180")} aria-hidden="true" />
      </span>
    </CollapsibleTrigger>
    <CollapsibleContent>
      <QuotationTermsEditor editor={readOnly ? {
        ...editor, draft: { ...editor.draft, ...terms }, deliveryValid: true, warrantyValid: true,
      } : editor} inline readOnly={readOnly} />
    </CollapsibleContent>
  </Collapsible>;
}
