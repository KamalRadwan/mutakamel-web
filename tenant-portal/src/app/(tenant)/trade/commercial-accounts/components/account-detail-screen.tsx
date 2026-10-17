"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  CreditCard,
  Filter,
  GitBranch,
  Lock,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import {
  Badge,
  Button,
  DetailHeader,
  DetailSection,
  EmptyState,
  ErrorState,
  Field,
  IdentifierText,
  Input,
  Money,
  NotFoundState,
  PermissionGate,
  ReasonDialog,
  Skeleton,
  Switch,
  SWATCH_SURFACE_PALETTES,
  Textarea,
  cn,
} from "@/design-system";
import { formatDateTime } from "@/lib/format/date";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { TradeScopeBar } from "../../TradeScopeBar";
import { TRADE_PERMISSIONS } from "../../trade-scope";
import { useAccountDetail } from "../hooks/useAccountDetail";
import { ACCOUNT_KNOWN_STATUSES, isAccountRole } from "../commercial-account-contract";
import {
  ACCOUNT_ROLE_PALETTES,
  ACCOUNT_UI_COPY,
  ISO_CURRENCY_PRESETS,
  parseVisualNarrowingRules,
  parseVisualTerms,
  serializeVisualNarrowingRules,
  validateNarrowingAgainstCompany,
} from "../commercial-account-metadata";
import { CreditPanel } from "./CreditPanel";

const BLOCK_REASON_MAX_LENGTH = 80;

export function AccountDetailScreen({ id }: { id: string }) {
  const detail = useAccountDetail(id);
  const { t, lang, account } = detail;
  const copy = ACCOUNT_UI_COPY[lang];
  const [rules, setRules] = useState<string | null>(null);
  const [showRawRulesJson, setShowRawRulesJson] = useState(false);
  const [transition, setTransition] = useState<"block" | "unblock" | null>(null);

  const isKnownStatus =
    account !== null && (ACCOUNT_KNOWN_STATUSES as readonly string[]).includes(account.status);
  const rulesValue =
    rules ??
    (detail.branchRule ? JSON.stringify(detail.branchRule.narrowingRules, null, 2) : "");

  const roleKey =
    account && isAccountRole(account.accountRole) ? account.accountRole : "CUSTOMER";
  const rolePalette = ACCOUNT_ROLE_PALETTES[roleKey];
  const companyTerms = parseVisualTerms(JSON.stringify(account?.terms ?? {}));
  const visualNarrowing = parseVisualNarrowingRules(rulesValue);
  const narrowingValidation = account
    ? validateNarrowingAgainstCompany(visualNarrowing, account)
    : {
        exceedsCompanyCreditLimit: false,
        disallowedCurrencies: [],
        supplierCreditLimitForbidden: false,
        isValid: true,
      };

  function updateVisualNarrowing(patch: Partial<typeof visualNarrowing>) {
    const next = { ...visualNarrowing, ...patch };
    setRules(serializeVisualNarrowingRules(next));
  }

  function toggleBranchCurrency(code: string) {
    const exists = visualNarrowing.allowedCurrencies.includes(code);
    const nextCurrencies = exists
      ? visualNarrowing.allowedCurrencies.filter((c) => c !== code)
      : [...visualNarrowing.allowedCurrencies, code];
    updateVisualNarrowing({ allowedCurrencies: nextCurrencies });
  }

  const greenSwatch = SWATCH_SURFACE_PALETTES.green;
  const blueSwatch = SWATCH_SURFACE_PALETTES.blue;
  const redSwatch = SWATCH_SURFACE_PALETTES.red;
  const amberSwatch = SWATCH_SURFACE_PALETTES.amber;

  return (
    <PermissionGate require={TRADE_PERMISSIONS.commercialAccountsRead}>
      <div className="flex flex-col gap-4">
        <DetailHeader
          title={account?.partyId ?? t.trade.accountsTitle}
          subtitle={
            account && isAccountRole(account.accountRole)
              ? t.trade[`accountRole_${account.accountRole}`]
              : account?.accountRole
          }
          backHref={TENANT_ROUTES.tradeCommercialAccounts}
          backLabel={t.trade.backToAccounts}
          status={
            account ? (
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-xs font-semibold",
                    rolePalette.badgeClass,
                  )}
                >
                  <span className={cn("size-1.5 rounded-full", rolePalette.dotClass)} />
                  {isAccountRole(account.accountRole)
                    ? t.trade[`accountRole_${account.accountRole}`]
                    : account.accountRole}
                </span>
                <Badge
                  tone={isKnownStatus && account.status === "ACTIVE" ? "positive" : "negative"}
                >
                  {isKnownStatus ? (
                    t.trade[`accountStatus_${account.status as "ACTIVE" | "BLOCKED"}`]
                  ) : (
                    <IdentifierText>{account.status}</IdentifierText>
                  )}
                </Badge>
              </div>
            ) : null
          }
          secondaryActions={
            account && detail.canManage && !detail.writeScopeGap ? (
              <Button
                size="sm"
                variant={account.status === "BLOCKED" ? "primary" : "outline"}
                onClick={() => setTransition(account.status === "BLOCKED" ? "unblock" : "block")}
                disabled={detail.isSubmitting}
              >
                {account.status === "BLOCKED" ? t.trade.unblockAction : t.trade.blockAction}
              </Button>
            ) : null
          }
        />

        <TradeScopeBar hideWhenSingleScope />

        {detail.scopeGap ? (
          <EmptyState
            icon={Filter}
            title={t.trade.scopeRequiredTitle}
            description={t.trade.accountScopeRequiredDescription}
          />
        ) : detail.isLoading ? (
          <Skeleton className="h-64" />
        ) : detail.isGone ? (
          <NotFoundState
            title={t.trade.accountNotFoundTitle}
            description={t.trade.accountNotFoundDescription}
            backHref={TENANT_ROUTES.tradeCommercialAccounts}
            backLabel={t.trade.backToAccounts}
          />
        ) : detail.error || !account ? (
          <ErrorState
            title={t.trade.accountLoadFailed}
            onRetry={detail.reload}
            retryLabel={t.common.retry}
          />
        ) : (
          <>
            {/* Executive Account Dossier KPI Strip */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div
                className={cn(
                  "relative overflow-hidden rounded-lg border bg-card p-3.5 shadow-xs",
                  rolePalette.cardBorderClass,
                )}
              >
                <div className={cn("absolute inset-x-0 top-0 h-1", rolePalette.topAccentClass)} />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {t.trade.accountRole}
                  </span>
                  <Building2 className="size-4 text-primary" aria-hidden="true" />
                </div>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {isAccountRole(account.accountRole)
                    ? t.trade[`accountRole_${account.accountRole}`]
                    : account.accountRole}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  <IdentifierText>{account.partyId}</IdentifierText>
                </p>
              </div>

              <div
                className={cn(
                  "relative overflow-hidden rounded-lg border bg-card p-3.5 shadow-xs",
                  greenSwatch.sectionCard,
                )}
              >
                <div className={cn("absolute inset-x-0 top-0 h-1", greenSwatch.dot)} />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {t.trade.accountCreditLimit}
                  </span>
                  <CreditCard className={cn("size-4", greenSwatch.iconText)} aria-hidden="true" />
                </div>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {account.creditLimit === null ? (
                    t.trade.creditUnlimited
                  ) : (
                    <Money
                      value={account.creditLimit}
                      currency={account.creditCurrencyCode ?? undefined}
                    />
                  )}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t.trade.accountCurrency}: {account.creditCurrencyCode ?? "—"}
                </p>
              </div>

              <div
                className={cn(
                  "relative overflow-hidden rounded-lg border bg-card p-3.5 shadow-xs",
                  account.status === "BLOCKED" ? redSwatch.sectionCard : blueSwatch.sectionCard,
                )}
              >
                <div
                  className={cn(
                    "absolute inset-x-0 top-0 h-1",
                    account.status === "BLOCKED" ? redSwatch.dot : blueSwatch.dot,
                  )}
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {t.common.status}
                  </span>
                  {account.status === "BLOCKED" ? (
                    <ShieldAlert className={cn("size-4", redSwatch.iconText)} aria-hidden="true" />
                  ) : (
                    <ShieldCheck className={cn("size-4", blueSwatch.iconText)} aria-hidden="true" />
                  )}
                </div>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {isKnownStatus
                    ? t.trade[`accountStatus_${account.status as "ACTIVE" | "BLOCKED"}`]
                    : account.status}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {account.blockReasonCode ? (
                    <IdentifierText>{account.blockReasonCode}</IdentifierText>
                  ) : (
                    copy.noBlockReason
                  )}
                </p>
              </div>

              <div
                className={cn(
                  "relative overflow-hidden rounded-lg border bg-card p-3.5 shadow-xs",
                  amberSwatch.sectionCard,
                )}
              >
                <div className={cn("absolute inset-x-0 top-0 h-1", amberSwatch.dot)} />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {t.trade.creditOrderingHold}
                  </span>
                  <SlidersHorizontal
                    className={cn("size-4", amberSwatch.iconText)}
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {companyTerms.orderingHold ? t.common.active : t.common.inactive}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {companyTerms.allowedCurrencies.length > 0
                    ? companyTerms.allowedCurrencies.join(" · ")
                    : copy.allStandardCurrencies}
                </p>
              </div>
            </div>

            <DetailSection
              title={t.trade.accountDetailTitle}
              emptyValueLabel="—"
              fields={[
                {
                  label: t.trade.accountParty,
                  value: <IdentifierText className="text-xs">{account.partyId}</IdentifierText>,
                },
                {
                  label: t.trade.accountCreditLimit,
                  value:
                    account.creditLimit === null ? null : (
                      <Money
                        value={account.creditLimit}
                        currency={account.creditCurrencyCode ?? undefined}
                      />
                    ),
                },
                { label: t.trade.accountCurrency, value: account.creditCurrencyCode },
                {
                  label: t.trade.accountPaymentTerms,
                  value: account.paymentTermsId ? (
                    <IdentifierText className="text-xs">{account.paymentTermsId}</IdentifierText>
                  ) : null,
                },
                {
                  label: t.trade.accountPriceBook,
                  value: account.priceBookId ? (
                    <IdentifierText className="text-xs">{account.priceBookId}</IdentifierText>
                  ) : null,
                },
                {
                  label: t.trade.accountCreditPolicy,
                  value: account.creditPolicyVersionId ? (
                    <IdentifierText className="text-xs">
                      {account.creditPolicyVersionId}
                    </IdentifierText>
                  ) : null,
                },
                { label: t.trade.accountBlockReason, value: account.blockReasonCode },
                {
                  label: t.trade.version,
                  value: <IdentifierText>{account.version}</IdentifierText>,
                },
                { label: t.trade.updatedAt, value: formatDateTime(account.updatedAt, lang) },
              ]}
            />

            {/* Branch Narrowing Rules Builder (`narrowingRules`) */}
            <DetailSection
              title={t.trade.branchRulesTitle}
              description={t.trade.branchRulesDescription}
              action={
                detail.canManage && !detail.branchScopeGap ? (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => setShowRawRulesJson((prev) => !prev)}
                      className="text-xs font-medium text-primary"
                    >
                      {showRawRulesJson ? copy.visualBuilderBtn : copy.contractViewBtn}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      loading={detail.isSubmitting}
                      disabled={!narrowingValidation.isValid}
                      onClick={() => void detail.saveBranchRule(rulesValue)}
                    >
                      {detail.branchRule ? t.trade.branchRuleEdit : t.trade.branchRuleAdd}
                    </Button>
                  </div>
                ) : null
              }
            >
              {detail.branchScopeGap ? (
                <p className="text-xs text-muted-foreground">{t.trade.branchRuleScopeRequired}</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {detail.branchRule ? null : (
                    <p className="text-xs text-muted-foreground">{t.trade.branchRuleEmpty}</p>
                  )}

                  {/* Visual Narrowing Rules Builder */}
                  <div className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-muted/20 p-3.5 md:grid-cols-3">
                    <div className="rounded-md border border-border bg-card p-3">
                      <Field
                        label={copy.branchCreditLimitLabel}
                        hint={
                          account.creditLimit
                            ? `${copy.companyCeilingPrefix} ${account.creditLimit}`
                            : undefined
                        }
                      >
                        <Input
                          size="sm"
                          dir="ltr"
                          inputMode="decimal"
                          placeholder={account.creditLimit ?? "0.00"}
                          value={visualNarrowing.creditLimit}
                          disabled={
                            !detail.canManage ||
                            detail.isSubmitting ||
                            account.accountRole === "SUPPLIER"
                          }
                          onChange={(e) =>
                            updateVisualNarrowing({ creditLimit: e.target.value })
                          }
                        />
                      </Field>
                      {account.accountRole === "SUPPLIER" && (
                        <p
                          className={cn(
                            "mt-1.5 inline-flex items-center gap-1 text-xs",
                            amberSwatch.iconText,
                          )}
                        >
                          <Lock className="size-3" aria-hidden="true" />
                          {copy.lockedForSupplierHint}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col justify-between rounded-md border border-border bg-card p-3">
                      <div>
                        <p className="text-xs font-semibold text-foreground">
                          {t.trade.creditOrderingHold}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {copy.branchOrderingHoldDesc}
                        </p>
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2">
                        <Badge tone={visualNarrowing.orderingHold ? "caution" : "neutral"}>
                          {visualNarrowing.orderingHold ? t.common.active : t.common.inactive}
                        </Badge>
                        <Switch
                          checked={visualNarrowing.orderingHold}
                          disabled={!detail.canManage || detail.isSubmitting}
                          onCheckedChange={(checked) =>
                            updateVisualNarrowing({ orderingHold: checked })
                          }
                        />
                      </div>
                    </div>

                    <div className="rounded-md border border-border bg-card p-3">
                      <p className="text-xs font-semibold text-foreground">
                        {copy.branchCurrenciesTitle}
                      </p>
                      <p className="mt-0.5 mb-2 text-xs text-muted-foreground">
                        {copy.branchCurrenciesDesc}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {ISO_CURRENCY_PRESETS.map((preset) => {
                          const selected = visualNarrowing.allowedCurrencies.includes(
                            preset.code,
                          );
                          return (
                            <Button
                              key={preset.code}
                              type="button"
                              size="xs"
                              variant={selected ? "primary" : "outline"}
                              disabled={!detail.canManage || detail.isSubmitting}
                              onClick={() => toggleBranchCurrency(preset.code)}
                              className="gap-1 px-2 py-0.5 font-mono text-xs font-semibold"
                            >
                              <span>{preset.code}</span>
                              {selected && (
                                <CheckCircle2 className="size-3" aria-hidden="true" />
                              )}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Client-Side Policy Narrowing Guard Warning */}
                  {!narrowingValidation.isValid && (
                    <div
                      className={cn(
                        "flex items-start gap-2.5 rounded-lg border p-3 text-xs",
                        redSwatch.sectionCard,
                      )}
                    >
                      <AlertTriangle
                        className={cn("mt-0.5 size-4 shrink-0", redSwatch.iconText)}
                        aria-hidden="true"
                      />
                      <div className="flex flex-col gap-1">
                        <p className="font-semibold">{t.trade.branchRuleWeakens}</p>
                        {narrowingValidation.exceedsCompanyCreditLimit && (
                          <p>{copy.branchExceedsCreditError}</p>
                        )}
                        {narrowingValidation.disallowedCurrencies.length > 0 && (
                          <p>
                            {copy.branchDisallowedCurrenciesPrefix}{" "}
                            {narrowingValidation.disallowedCurrencies.join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className={cn(!showRawRulesJson && "sr-only")}>
                    <Textarea
                      dir="ltr"
                      className="font-mono text-xs"
                      aria-label={t.trade.branchRuleNarrowing}
                      placeholder={t.trade.branchRuleNarrowing}
                      value={rulesValue}
                      onChange={(event) => setRules(event.target.value)}
                      disabled={!detail.canManage || detail.isSubmitting}
                      readOnly={!detail.canManage}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <GitBranch className="me-1 inline size-3.5" aria-hidden="true" />
                    {t.trade.branchRuleNarrowingHint}
                  </p>
                </div>
              )}
            </DetailSection>

            <CreditPanel
              canViewCredit={detail.canViewCredit}
              isSubmitting={detail.isSubmitting}
              decision={detail.credit}
              error={detail.creditError}
              defaultCurrency={account.creditCurrencyCode}
              onEvaluate={(amount, currency) => void detail.evaluateCredit(amount, currency)}
            />
          </>
        )}

        {/* `AccountTransitionDto.reasonCode` is required and bounded at 80. */}
        <ReasonDialog
          open={transition !== null}
          onOpenChange={(open) => {
            if (!open) setTransition(null);
          }}
          title={transition === "unblock" ? t.trade.unblockTitle : t.trade.blockTitle}
          description={
            transition === "unblock" ? t.trade.unblockDescription : t.trade.blockDescription
          }
          reasonRequired
          maxLength={BLOCK_REASON_MAX_LENGTH}
          destructive={transition === "block"}
          loading={detail.isSubmitting}
          onConfirm={(reason) => {
            if (!transition) return;
            void detail.transition(transition, reason).then((done) => {
              if (done) setTransition(null);
            });
          }}
          labels={{
            reason: t.trade.blockReasonLabel,
            reasonHint: t.trade.blockReasonHint,
            confirm: transition === "unblock" ? t.trade.unblockAction : t.trade.blockAction,
            cancel: t.common.cancel,
          }}
        />
      </div>
    </PermissionGate>
  );
}
