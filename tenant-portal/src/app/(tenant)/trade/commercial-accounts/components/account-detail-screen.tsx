"use client";

import { useState } from "react";
import { Filter } from "lucide-react";
import {
  Badge,
  Button,
  DetailHeader,
  DetailSection,
  EmptyState,
  ErrorState,
  IdentifierText,
  Money,
  NotFoundState,
  PermissionGate,
  ReasonDialog,
  Skeleton,
  Textarea,
} from "@/design-system";
import { formatDateTime } from "@/lib/format/date";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { TradeScopeBar } from "../../TradeScopeBar";
import { TRADE_PERMISSIONS } from "../../trade-scope";
import { useAccountDetail } from "../hooks/useAccountDetail";
import { ACCOUNT_KNOWN_STATUSES, isAccountRole } from "../commercial-account-contract";
import { CreditPanel } from "./CreditPanel";

const BLOCK_REASON_MAX_LENGTH = 80;

export function AccountDetailScreen({ id }: { id: string }) {
  const detail = useAccountDetail(id);
  const { t, lang, account } = detail;
  const [rules, setRules] = useState<string | null>(null);
  const [transition, setTransition] = useState<"block" | "unblock" | null>(null);

  const isKnownStatus =
    account !== null && (ACCOUNT_KNOWN_STATUSES as readonly string[]).includes(account.status);
  const rulesValue =
    rules ??
    (detail.branchRule ? JSON.stringify(detail.branchRule.narrowingRules, null, 2) : "");

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
              <Badge
                tone={isKnownStatus && account.status === "ACTIVE" ? "positive" : "negative"}
              >
                {isKnownStatus ? (
                  t.trade[`accountStatus_${account.status as "ACTIVE" | "BLOCKED"}`]
                ) : (
                  <IdentifierText>{account.status}</IdentifierText>
                )}
              </Badge>
            ) : null
          }
          secondaryActions={
            account && detail.canManage && !detail.writeScopeGap ? (
              <Button
                variant="outline"
                onClick={() => setTransition(account.status === "BLOCKED" ? "unblock" : "block")}
                disabled={detail.isSubmitting}
              >
                {account.status === "BLOCKED" ? t.trade.unblockAction : t.trade.blockAction}
              </Button>
            ) : null
          }
        />

        <TradeScopeBar />

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
                    <IdentifierText className="text-xs">{account.creditPolicyVersionId}</IdentifierText>
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

            <DetailSection
              title={t.trade.branchRulesTitle}
              description={t.trade.branchRulesDescription}
              action={
                detail.canManage && !detail.branchScopeGap ? (
                  <Button
                    variant="outline"
                    size="sm"
                    loading={detail.isSubmitting}
                    onClick={() => void detail.saveBranchRule(rulesValue)}
                  >
                    {detail.branchRule ? t.trade.branchRuleEdit : t.trade.branchRuleAdd}
                  </Button>
                ) : null
              }
            >
              {detail.branchScopeGap ? (
                <p className="text-xs text-muted-foreground">{t.trade.branchRuleScopeRequired}</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {detail.branchRule ? null : (
                    <p className="text-xs text-muted-foreground">{t.trade.branchRuleEmpty}</p>
                  )}
                  <Textarea
                    dir="ltr"
                    className="font-mono"
                    aria-label={t.trade.branchRuleNarrowing}
                    value={rulesValue}
                    onChange={(event) => setRules(event.target.value)}
                    disabled={!detail.canManage || detail.isSubmitting}
                    readOnly={!detail.canManage}
                  />
                  <p className="text-xs text-muted-foreground">{t.trade.branchRuleNarrowingHint}</p>
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
