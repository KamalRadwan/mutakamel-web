"use client";

import { useId, useState, type ReactNode } from "react";
import { Building2, ChevronDown, LockKeyhole, RefreshCw } from "lucide-react";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, NameSelect, cn, hitArea } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { QuotationComposerState } from "../hooks/useQuotationComposer";
import { NO_QUOTATION_CHANNEL, useQuotationContextFields } from "../hooks/useQuotationContextFields";
import { QuotationScopeChangeInline } from "./QuotationScopeChangeInline";

type ContextOption = { value: string; label: string; disabled?: boolean };

function ContextValue({ label, value, locked, optional = false, selectValue, options, onChange, placeholder, searchPlaceholder, disabled }: {
  label: string; value: string; locked: boolean; optional?: boolean; selectValue?: string;
  options: readonly ContextOption[]; onChange: (value: string) => void; placeholder: string; searchPlaceholder?: string; disabled: boolean;
}) {
  const { t } = useI18n();
  return <div className="flex min-w-0 items-center gap-2">
    <span className="w-28 shrink-0 text-xs font-medium text-foreground lg:w-32">
      {label}
      {optional ? <span className="sr-only"> ({t.quotationFlow.channelOptional})</span> : null}
    </span>
    {locked ? (
      <div aria-label={`${label}: ${value}`} aria-readonly="true"
        className="flex min-h-(--size-control-sm) min-w-0 max-w-88 flex-1 items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1 text-xs font-medium text-foreground sm:h-(--size-control-sm) sm:py-0">
        <LockKeyhole className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 flex-1 wrap-anywhere text-start sm:truncate"><bdi>{value}</bdi></span>
      </div>
    ) : (
      <NameSelect size="sm" className="min-w-0 max-w-88 flex-1 data-[placeholder]:text-foreground" aria-label={`${label}: ${value}`} value={selectValue} options={options}
        onValueChange={onChange} placeholder={placeholder} searchPlaceholder={searchPlaceholder} disabled={disabled} />
    )}
  </div>;
}
/** Never show the ordinal "Company 1" placeholder for a selected id; unresolved identity reads as unavailable. */
function selectedOrganizationLabel(options: readonly { value: string; label: string; resolved?: boolean }[], id: string | null | undefined, unavailable: string): string | undefined {
  const option = id ? options.find((entry) => entry.value === id) : undefined;
  if (!option) return undefined;
  return option.resolved === false ? unavailable : option.label;
}

export function QuotationContextFields({
  composer,
  contextLocked = false,
  labels,
  embedded = false,
  renderDetails,
}: {
  composer: QuotationComposerState;
  contextLocked?: boolean;
  labels?: { company?: string | null; branch?: string | null; channel?: string | null };
  embedded?: boolean;
  /**
   * When provided, Channel leaves the Company/Branch scope strip and is handed (as the single, already-wired node)
   * to this callback, which renders the details group below. Without it Channel stays the third scope column.
   */
  renderDetails?: (channel: ReactNode) => ReactNode;
}) {
  const fieldsId = useId();
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const view = useQuotationContextFields(composer);
  const { t, scope, companies, branches, channels, companyId, branchId, activeChannelId } = view;
  const locked = view.locked || contextLocked;
  const companyOptions = companies.map((option) => ({ ...option, label: option.resolved === false ? t.common.nameUnavailable : option.label }));
  const branchOptions = branches.map((option) => ({ ...option, label: option.resolved === false ? t.common.nameUnavailable : option.label }));
  const controlsBusy = view.scopeChangeBusy;
  const branchSelectable = Boolean(companyId) && !scope.isLoadingBranches && branchOptions.length > 0;
  const channelSelectable = branchSelectable && Boolean(branchId) && branchOptions.some((option) => option.value === branchId)
    && !view.channelsLoading && view.channelChoiceReady;
  const explicitCompany = labels?.company?.trim();
  const explicitBranch = labels?.branch?.trim();
  const explicitChannel = labels?.channel?.trim();
  const companyOption = companyId ? companies.find((entry) => entry.value === companyId) : undefined;
  const branchOption = branchId ? branches.find((entry) => entry.value === branchId) : undefined;
  const channelOption = channels.find((option) => option.value === (activeChannelId ?? NO_QUOTATION_CHANNEL));
  const companyValue = explicitCompany || selectedOrganizationLabel(companies, companyId, t.common.nameUnavailable) || t.trade.scopeSelectCompany;
  const branchValue = explicitBranch || selectedOrganizationLabel(branches, branchId, t.common.nameUnavailable) || t.quotationFlow.chooseBranch;
  const channelValue = explicitChannel || channelOption?.label || t.trade.scopeNoChannel;

  const companyResolved = Boolean(explicitCompany || (companyOption && companyOption.resolved !== false));
  const branchResolved = Boolean(explicitBranch || (branchOption && branchOption.resolved !== false));
  const channelResolved = !activeChannelId || activeChannelId === NO_QUOTATION_CHANNEL || Boolean(explicitChannel || channelOption);
  const channelInDetails = Boolean(renderDetails);
  const hasScopeGap = !locked && Boolean(scope.gapFor?.("BRANCH"));
  const isContextResolved = companyResolved && branchResolved && (channelInDetails || channelResolved) && !hasScopeGap
    && !scope.branchesError && (channelInDetails || !view.channelsError);
  const showCompany = !channelInDetails || scope.companyIds.length > 1;
  const showScopeGrid = !channelInDetails || showCompany || scope.branchIds.length > 1
    || scope.isLoadingBranches || !isContextResolved;
  const canCollapseScope = isContextResolved && !channelInDetails;
  const summaryValue = `${companyValue} · ${branchValue} · ${channelValue}`;
  const SummaryIcon = locked ? LockKeyhole : Building2;

  const channelOptions = view.channelsError ? channels.map((option) => ({ ...option, disabled: true })) : channels;
  const channelField = <ContextValue label={t.trade.scopeChannel} value={channelValue} locked={locked} optional
    selectValue={activeChannelId ?? NO_QUOTATION_CHANNEL} options={channelOptions}
    onChange={(next) => view.selectChannel(next === NO_QUOTATION_CHANNEL ? null : next)}
    placeholder={view.channelsLoading ? t.common.loading : t.trade.scopeNoChannel} searchPlaceholder={t.trade.scopeSearchChannels}
    disabled={controlsBusy || !channelSelectable} />;
  const channelNode = channelInDetails && view.channelsError ? <div className="min-w-0 space-y-1.5">
    {channelField}
    <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning/30 bg-warning-subtle px-2.5 py-1.5 text-xs text-warning-subtle-foreground">
      <p>{t.quotationFlow.channelsUnavailable}</p>
      <Button variant="outline" size="xs" disabled={locked} onClick={view.refreshChannels}>
        <RefreshCw className="size-3.5" aria-hidden="true" />{t.common.retry}
      </Button>
    </div>
  </div> : channelField;
  const pendingInline = composer.scopeChangePending && composer.scopeChangePending.kind !== "navigate"
    ? <QuotationScopeChangeInline composer={composer} currentContext={view.currentContext} requestedContext={view.requestedContext} />
    : null;

  return <>
    <div className={cn("min-w-0", channelInDetails && "space-y-2", !embedded && "rounded-lg border border-border bg-card px-3 py-2")}>
    {showScopeGrid || composer.write.ambiguous ? <section aria-label={t.trade.scopeTitle}
      className={cn("min-w-0", channelInDetails && "rounded-lg border border-border bg-card px-3 py-2")}>
      <h2 className="sr-only">{t.trade.scopeTitle}</h2>
      {canCollapseScope ? (
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "flex w-full min-w-0 justify-between px-2.5 text-xs font-medium text-foreground sm:hidden",
            locked ? "bg-muted" : "bg-muted/40",
            hitArea,
          )}
          aria-label={`${t.trade.scopeTitle}: ${summaryValue}`}
          aria-expanded={mobileExpanded}
          aria-controls={fieldsId}
          onClick={() => setMobileExpanded((open) => !open)}
        >
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            <SummaryIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-start">
              <bdi>{companyValue}</bdi>
              {" · "}
              <bdi>{branchValue}</bdi>
              {" · "}
              <bdi>{channelValue}</bdi>
            </span>
          </span>
          <ChevronDown
            className={cn("size-3.5 shrink-0 text-muted-foreground", mobileExpanded && "rotate-180")}
            aria-hidden="true"
          />
        </Button>
      ) : null}
      {showScopeGrid ? <div
        id={fieldsId}
        className={cn(
          "min-w-0 gap-x-4 gap-y-1.5 sm:mt-0 sm:grid",
          channelInDetails ? "lg:grid-cols-2" : "sm:grid-cols-3",
          canCollapseScope ? (mobileExpanded ? "mt-2 grid" : "hidden") : "grid",
        )}
      >
        {showCompany ? <ContextValue label={t.trade.scopeCompany} value={companyValue} locked={locked} selectValue={companyId ?? undefined}
          options={companyOptions} onChange={scope.selectCompany} placeholder={t.trade.scopeSelectCompany}
          disabled={controlsBusy || companyOptions.length === 0} /> : null}
        <ContextValue label={t.trade.scopeBranch} value={branchValue} locked={locked} selectValue={branchId ?? undefined}
          options={branchOptions} onChange={scope.selectBranch}
          placeholder={scope.isLoadingBranches ? t.common.loading : companyId && branchOptions.length === 0 && !scope.branchesError ? t.quotationFlow.noBranches : t.quotationFlow.chooseBranch}
          disabled={controlsBusy || !branchSelectable} />
        {channelInDetails ? null : channelNode}
      </div> : null}
      {locked ? (
        <p role="status" className={cn(composer.write.ambiguous ? "mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground" : "sr-only")}>
          <LockKeyhole className="size-3.5" aria-hidden="true" />
          {composer.write.ambiguous ? t.quotationFlow.unknownMustRecover : t.quotationFlow.contextLocked}
        </p>
      ) : null}
      {scope.branchesError || (view.channelsError && !channelInDetails) ? (
        <div role="alert" className="mt-1.5 flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning/30 bg-warning-subtle px-2.5 py-1.5 text-xs text-warning-subtle-foreground">
          <p>{scope.branchesError ? t.quotationFlow.branchesUnavailable : t.quotationFlow.channelsUnavailable}</p>
          <Button variant="outline" size="xs" disabled={locked} onClick={scope.branchesError ? scope.refreshBranches : view.refreshChannels}>
            <RefreshCw className="size-3.5" aria-hidden="true" />{t.common.retry}
          </Button>
        </div>
      ) : null}
      {channelInDetails ? null : pendingInline}
    </section> : null}
    {renderDetails ? <>
      {renderDetails(channelNode)}
      {pendingInline}
    </> : null}
    </div>
    <QuotationLeaveDialog composer={composer} currentContext={view.currentContext} />
  </>;
}

function QuotationLeaveDialog({ composer, currentContext }: { composer: QuotationComposerState; currentContext: string }) {
  const { t } = useI18n();
  return <Dialog open={composer.scopeChangePending?.kind === "navigate"} onOpenChange={(open) => { if (!open && !composer.isChangingScope) composer.cancelScopeChange(); }}>
    <DialogContent size="lg" aria-busy={composer.isChangingScope || undefined}>
      <DialogHeader>
        <DialogTitle>{t.quotationFlow.leaveTitle}</DialogTitle>
        <DialogDescription>{t.quotationFlow.leaveDescription}</DialogDescription>
      </DialogHeader>
      <dl className="space-y-2 rounded-md border border-border bg-muted/20 p-3 text-sm">
        <div><dt className="text-xs text-muted-foreground">{t.quotationFlow.currentContext}</dt><dd className="mt-0.5 font-medium">{currentContext}</dd></div>
      </dl>
      <DialogFooter className="flex-wrap">
        <Button variant="outline" disabled={composer.isChangingScope} onClick={composer.cancelScopeChange}>{t.quotationFlow.stay}</Button>
        <Button variant="outline" disabled={composer.isChangingScope} onClick={() => void composer.confirmScopeChange(false)}>
          {t.quotationFlow.discardAndLeave}
        </Button>
        <Button variant="primary" loading={composer.isChangingScope} disabled={!composer.canSubmit} onClick={() => void composer.confirmScopeChange(true)}>
          {t.quotationFlow.saveAndLeave}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
