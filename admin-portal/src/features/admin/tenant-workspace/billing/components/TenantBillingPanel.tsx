"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import {
  Card,
  Checkbox,
  Field,
  Input,
  Button,
  DataTable,
  EmptyState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type ColumnDef,
} from "@/design-system";
import type { UseTenantBillingWorkspaceResult } from "../hooks/useTenantBillingWorkspace";
import { localeForLanguage } from "@/i18n/locale";
import type {
  BillingCycle,
  PaymentReconciliationAction,
  PaymentStatusView,
  SubscriptionItemView,
  SubscriptionPlanChangeOperation,
  WalletAdjustmentDirection,
  WalletLedgerView,
} from "../types";

type BillingSection = "subscription" | "wallet" | "payments";

export interface TenantBillingPanelProps {
  workspace: UseTenantBillingWorkspaceResult;
  lang: "ar" | "en";
}

export function TenantBillingPanel({
  workspace,
  lang,
}: TenantBillingPanelProps) {
  const [section, setSection] = useState<BillingSection>("subscription");
  const rtl = lang === "ar";
  const copy = billingCopy[lang];
  const refreshing = [
    workspace.subscriptionState,
    workspace.walletState,
    workspace.ledgerState,
    workspace.paymentsState,
    workspace.billingSummaryState,
  ].includes("loading");
  return (
    <section className="space-y-4" dir={rtl ? "rtl" : "ltr"} aria-busy={refreshing || undefined}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {copy.title}
          </h2>
          <p className="text-sm text-muted-foreground">{copy.subtitle}</p>
        </div>
        <Button type="button" variant="outline" loading={refreshing} onClick={() => void workspace.refresh()}>
          {copy.refresh}
        </Button>
      </div>

      <Tabs value={section} onValueChange={(value) => setSection(value as BillingSection)} className="space-y-4">
        <TabsList aria-label={copy.title} className="max-w-full overflow-x-auto">
          {(["subscription", "wallet", "payments"] as const).map((key) => (
            <TabsTrigger key={key} value={key} className="shrink-0 px-3">
              {copy.sections[key]}
            </TabsTrigger>
          ))}
        </TabsList>
        {refreshing ? <p role="status" aria-live="polite" className="text-xs text-muted-foreground">{copy.refreshing}</p> : null}

        {workspace.mutation.error ? (
          <ErrorNotice error={workspace.mutation.error} lang={lang} focusOnMount />
        ) : null}
        <TabsContent value="subscription" className="mt-0 space-y-4">
          <BillingSummary workspace={workspace} lang={lang} />
          <SubscriptionSection workspace={workspace} lang={lang} />
        </TabsContent>
        <TabsContent value="wallet" className="mt-0">
        <WalletSection workspace={workspace} lang={lang} />
        </TabsContent>
        <TabsContent value="payments" className="mt-0">
        <PaymentsSection workspace={workspace} lang={lang} />
        </TabsContent>
      </Tabs>
    </section>
  );
}

function SubscriptionSection({ workspace, lang }: TenantBillingPanelProps) {
  const copy = billingCopy[lang];
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("MONTHLY");
  const [trialDays, setTrialDays] = useState(String(DEFAULT_TRIAL_DAYS));
  const [moduleKey, setModuleKey] = useState("");
  const [tierKey, setTierKey] = useState("");
  const [seats, setSeats] = useState("1");
  const [operation, setOperation] =
    useState<SubscriptionPlanChangeOperation>("CHANGE");
  const [itemId, setItemId] = useState("");
  const [changeModuleKey, setChangeModuleKey] = useState("");
  const [changeTierKey, setChangeTierKey] = useState("");
  const [changeSeats, setChangeSeats] = useState("1");
  const [cancelConfirmed, setCancelConfirmed] = useState(false);

  if (
    (workspace.subscriptionState === "loading" ||
      workspace.subscriptionState === "idle") &&
    !workspace.subscription
  ) {
    return <StateCard>{copy.loadingSubscription}</StateCard>;
  }
  if (workspace.subscriptionState === "forbidden") {
    return <StateCard>{copy.subscriptionForbidden}</StateCard>;
  }
  if (workspace.subscriptionState === "error") {
    return <ErrorNotice error={workspace.subscriptionError} lang={lang} />;
  }
  if (workspace.subscriptionState === "empty") {
    return (
      <Card className="p-5">
        <h3 className="font-semibold">{copy.noSubscription}</h3>
        {workspace.permissions.canCreateSubscription ? (
          <form
            className="mt-4 grid gap-3 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              void workspace.seedSubscription({
                billingCycle,
                currencyCode: "USD",
                trialDays: Math.max(1, Math.min(365, Number(trialDays))),
                items: [
                  {
                    moduleKey: moduleKey.trim(),
                    tierKey: tierKey.trim(),
                    seats: Math.max(1, Number(seats)),
                  },
                ],
              });
            }}
          >
            <SelectField
              label={copy.billingCycle}
              name="billingCycle"
              value={billingCycle}
              onChange={(value) => setBillingCycle(value as BillingCycle)}
              options={["MONTHLY", "ANNUAL"]}
            />
            <TextField
              label={copy.trialDays}
              name="trialDays"
              value={trialDays}
              onChange={setTrialDays}
              type="number"
              min="1"
              max="365"
            />
            <TextField
              label={copy.moduleKey}
              name="moduleKey"
              value={moduleKey}
              onChange={setModuleKey}
              required
            />
            <TextField
              label={copy.tierKey}
              name="tierKey"
              value={tierKey}
              onChange={setTierKey}
              required
            />
            <TextField
              label={copy.seats}
              name="seats"
              value={seats}
              onChange={setSeats}
              type="number"
              min="1"
              required
            />
            <div className="flex items-end">
              <Button type="submit" variant="primary" disabled={Boolean(workspace.mutation.name)}>
                {copy.createSubscription}
              </Button>
            </div>
          </form>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            {copy.noCreatePermission}
          </p>
        )}
      </Card>
    );
  }

  const subscription = workspace.subscription;
  if (!subscription) return <StateCard>{copy.noSubscription}</StateCard>;
  const header = subscription.subscription;
  const items = workspace.subscriptionItems.length
    ? workspace.subscriptionItems
    : subscription.items;
  const canChangePlan = header.status === "TRIAL" || header.status === "ACTIVE";
  const previewIsCurrent = workspace.planPreview
    ? isFutureInstant(workspace.planPreview.expiresAt)
    : false;
  const updatePlanDraft = (update: () => void) => {
    workspace.clearPlanPreview();
    update();
  };

  const submitPreview = (event: FormEvent) => {
    event.preventDefault();
    if (operation === "REMOVE") {
      void workspace.previewPlanChange({ operation, itemId });
      return;
    }
    if (operation === "CHANGE") {
      void workspace.previewPlanChange({
        operation,
        itemId,
        tierKey: changeTierKey.trim(),
        seats: Math.max(1, Number(changeSeats)),
      });
      return;
    }
    void workspace.previewPlanChange({
      operation,
      moduleKey: changeModuleKey.trim(),
      tierKey: changeTierKey.trim(),
      seats: Math.max(1, Number(changeSeats)),
    });
  };

  const itemColumns: ColumnDef<SubscriptionItemView>[] = [
    {
      key: "module",
      headerEn: copy.module,
      headerAr: copy.module,
      cell: (item) => item.moduleName ?? item.moduleKey ?? item.moduleId,
    },
    {
      key: "tier",
      headerEn: copy.tier,
      headerAr: copy.tier,
      cell: (item) => item.tierName ?? item.tierKey ?? item.tierId,
    },
    {
      key: "seats",
      headerEn: copy.seats,
      headerAr: copy.seats,
      cell: (item) => item.seats,
    },
    {
      key: "lineTotal",
      headerEn: copy.lineTotal,
      headerAr: copy.lineTotal,
      cell: (item) => (
        <span className="font-mono">
          {item.currencyCode ?? "USD"} {item.lineTotal}
        </span>
      ),
    },
    {
      key: "features",
      headerEn: copy.features,
      headerAr: copy.features,
      cell: (item) => (
        <span className="text-xs">
          {item.features === null
            ? copy.enrichmentUnavailable
            : item.features.join(", ") || "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <Metric label={copy.status} value={header.status} />
        <Metric label={copy.billingCycle} value={header.billingCycle ?? "—"} />
        <Metric
          label={copy.effectiveUsers}
          value={String(subscription.effectiveAllowedUsers)}
        />
        <Metric
          label={copy.totalPrice}
          value={`${header.currencyCode ?? "USD"} ${header.totalPrice ?? "—"}`}
        />
      </div>
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">{copy.subscriptionItems}</h3>
            <p className="text-xs text-muted-foreground">
              {copy.periodEnd}: {formatDate(header.currentPeriodEnd, lang)}
            </p>
            {header.cancelAt ? (
              <p className="text-xs text-warning-subtle-foreground">
                {copy.cancelAt}: {formatDate(header.cancelAt, lang)}
              </p>
            ) : null}
          </div>
          {workspace.permissions.canCancelSubscription &&
          header.status !== "CANCELLED" &&
          header.cancelAt === null ? (
            <div className="flex items-center gap-2">
              <label htmlFor="cancel-subscription-confirmation" className="flex min-h-11 items-center gap-3 text-xs text-muted-foreground">
                <Checkbox
                  id="cancel-subscription-confirmation"
                  name="cancelSubscriptionConfirmed"
                  checked={cancelConfirmed}
                  onCheckedChange={(checked) => setCancelConfirmed(checked === true)}
                />
                {copy.confirmCancel}
              </label>
              <Button
                type="button"
                variant="destructive"
                disabled={!cancelConfirmed || Boolean(workspace.mutation.name)}
                onClick={() => void workspace.cancelSubscription()}
              >
                {copy.cancelSubscription}
              </Button>
            </div>
          ) : null}
        </div>
        <div className="mt-4">
          <DataTable
            columns={itemColumns}
            data={items}
            getRowId={(item) => item.id}
            pagination={{
              page: 1,
              limit: Math.max(items.length, 1),
              totalItems: items.length,
              totalPages: 1,
              onPageChange: () => {},
            }}
          />
        </div>
      </Card>

      {workspace.permissions.canUpdateSubscription && canChangePlan ? (
        <Card className="p-5">
          <h3 className="font-semibold">{copy.planChange}</h3>
          <p className="text-xs text-muted-foreground">{copy.serverPreview}</p>
          <form
            className="mt-4 grid gap-3 md:grid-cols-2"
            onSubmit={submitPreview}
          >
            <SelectField
              label={copy.operation}
              name="planChangeOperation"
              value={operation}
              onChange={(value) =>
                updatePlanDraft(() =>
                  setOperation(value as SubscriptionPlanChangeOperation),
                )
              }
              options={["ADD", "CHANGE", "REMOVE"]}
            />
            {operation !== "ADD" ? (
              <SelectField
                label={copy.item}
                name="subscriptionItemId"
                value={itemId}
                placeholder={copy.selectItem}
                required
                onChange={(value) => updatePlanDraft(() => setItemId(value))}
                options={items.map((item) => [item.id, `${item.moduleName ?? item.moduleKey ?? item.id} · ${item.tierName ?? item.tierKey}`] as const)}
              />
            ) : (
              <TextField
                label={copy.moduleKey}
                name="moduleKey"
                value={changeModuleKey}
                onChange={(value) =>
                  updatePlanDraft(() => setChangeModuleKey(value))
                }
                required
              />
            )}
            {operation !== "REMOVE" ? (
              <TextField
                label={copy.tierKey}
                name="tierKey"
                value={changeTierKey}
                onChange={(value) =>
                  updatePlanDraft(() => setChangeTierKey(value))
                }
                required
              />
            ) : null}
            {operation !== "REMOVE" ? (
              <TextField
                label={copy.seats}
                name="seats"
                value={changeSeats}
                onChange={(value) =>
                  updatePlanDraft(() => setChangeSeats(value))
                }
                type="number"
                min="1"
                required
              />
            ) : null}
            <div className="flex items-end">
              <Button type="submit" variant="primary" disabled={Boolean(workspace.mutation.name)}>
                {copy.previewChange}
              </Button>
            </div>
          </form>
          {workspace.planPreview ? (
            <div className="mt-4 rounded-lg border border-info/30 bg-info-subtle p-4 text-sm text-info-subtle-foreground">
              <div className="grid gap-2 md:grid-cols-4">
                <Metric
                  label={copy.operation}
                  value={workspace.planPreview.operation}
                  compact
                />
                <Metric
                  label={copy.prorated}
                  value={`USD ${workspace.planPreview.financial.proratedAmountUsd}`}
                  compact
                />
                <Metric
                  label={copy.walletShortfall}
                  value={`USD ${workspace.planPreview.financial.walletShortfallUsd}`}
                  compact
                />
                <Metric
                  label={copy.expires}
                  value={formatDate(workspace.planPreview.expiresAt, lang)}
                  compact
                />
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-4">
                <Metric
                  label={copy.module}
                  value={workspace.planPreview.item.moduleId}
                  compact
                />
                <Metric
                  label={copy.tierChange}
                  value={`${workspace.planPreview.item.fromTierId ?? "—"} → ${workspace.planPreview.item.toTierId ?? "—"}`}
                  compact
                />
                <Metric
                  label={copy.seatChange}
                  value={`${workspace.planPreview.item.fromSeats ?? "—"} → ${workspace.planPreview.item.toSeats ?? "—"}`}
                  compact
                />
                <Metric
                  label={copy.lineDelta}
                  value={`USD ${workspace.planPreview.item.previousLineTotalUsd} → ${workspace.planPreview.item.nextLineTotalUsd}`}
                  compact
                />
              </div>
              {!previewIsCurrent ? (
                <p className="mt-3 text-sm text-destructive-subtle-foreground">
                  {copy.previewExpired}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {workspace.permissions.canApplySubscriptionUpdate ? (
                  <Button
                    type="button"
                    variant="primary"
                    disabled={
                      !previewIsCurrent ||
                      !workspace.planPreview.financial.canApply ||
                      Boolean(workspace.mutation.name)
                    }
                    onClick={() => void workspace.applyPlanChange()}
                  >
                    {copy.applyReviewedChange}
                  </Button>
                ) : null}
                <Button type="button" variant="outline" onClick={workspace.clearPlanPreview}>
                  {copy.dismiss}
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      ) : workspace.permissions.canUpdateSubscription ? (
        <StateCard>{copy.planChangeUnavailable}</StateCard>
      ) : null}
    </div>
  );
}

function WalletSection({ workspace, lang }: TenantBillingPanelProps) {
  const copy = billingCopy[lang];
  const [direction, setDirection] =
    useState<WalletAdjustmentDirection>("CREDIT");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [note, setNote] = useState("");
  if ((workspace.walletState === "loading" || workspace.walletState === "idle") && !workspace.wallet)
    return <StateCard>{copy.loadingWallet}</StateCard>;
  if (workspace.walletState === "forbidden")
    return <StateCard>{copy.walletForbidden}</StateCard>;
  if (workspace.walletState === "error")
    return <ErrorNotice error={workspace.walletError} lang={lang} />;
  if (!workspace.wallet) return <StateCard>{copy.noWallet}</StateCard>;
  const wallet = workspace.wallet;
  const currencies = workspace.inputCurrencies?.items ?? [];
  const currencyOptions = currencies.map((item) => item.currencyCode);
  const selectedCurrency = currencyOptions.includes(currency)
    ? currency
    : (currencyOptions[0] ?? "");
  const previewIsCurrent = workspace.walletPreview
    ? isFutureInstant(workspace.walletPreview.expiresAt)
    : false;
  const updateWalletDraft = (update: () => void) => {
    workspace.clearWalletPreview();
    setNote("");
    update();
  };

  const ledgerColumns: ColumnDef<WalletLedgerView>[] = [
    {
      key: "created",
      headerEn: copy.created,
      headerAr: copy.created,
      cell: (entry) => formatDate(entry.createdAt, lang),
    },
    {
      key: "direction",
      headerEn: copy.direction,
      headerAr: copy.direction,
      cell: (entry) => entry.direction,
    },
    {
      key: "amount",
      headerEn: copy.amount,
      headerAr: copy.amount,
      cell: (entry) => <span className="font-mono">USD {entry.amountUsd}</span>,
    },
    {
      key: "source",
      headerEn: copy.source,
      headerAr: copy.source,
      cell: (entry) => (
        <span className="font-mono">
          {entry.sourceCurrencyCode} {entry.sourceAmount}
        </span>
      ),
    },
    {
      key: "reason",
      headerEn: copy.reason,
      headerAr: copy.reason,
      cell: (entry) => entry.reason,
    },
    {
      key: "balanceAfter",
      headerEn: copy.balanceAfter,
      headerAr: copy.balanceAfter,
      cell: (entry) => <span className="font-mono">USD {entry.balanceAfterUsd}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <Metric label={copy.balance} value={`USD ${wallet.balanceUsd}`} />
        <Metric
          label={copy.reserved}
          value={`USD ${wallet.reservedBalanceUsd}`}
        />
        <Metric
          label={copy.available}
          value={`USD ${wallet.availableBalanceUsd}`}
        />
        <Metric label={copy.status} value={wallet.status} />
      </div>
      {workspace.permissions.canPreviewWalletAdjustment &&
      wallet.status === "ACTIVE" ? (
        <Card className="p-5">
          <h3 className="font-semibold">{copy.walletAdjustment}</h3>
          <p className="text-xs text-muted-foreground">{copy.fxAuthority}</p>
          {workspace.inputCurrenciesState === "loading" ||
          workspace.inputCurrenciesState === "idle" ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {copy.loadingCurrencies}
            </p>
          ) : null}
          {workspace.inputCurrenciesState === "error" ? (
            <ErrorNotice error={workspace.inputCurrenciesError} lang={lang} />
          ) : null}
          {workspace.inputCurrenciesState === "forbidden" ? (
            <p className="mt-3 text-sm text-warning-subtle-foreground">
              {copy.currenciesForbidden}
            </p>
          ) : null}
          {currencyOptions.length > 0 ? (
            <form
              className="mt-4 grid gap-3 md:grid-cols-3"
              onSubmit={(event) => {
                event.preventDefault();
                const amountFields = {
                  sourceAmount: amount,
                  sourceCurrencyCode: selectedCurrency,
                };
                void workspace.previewWalletAdjustment(
                  direction === "CREDIT"
                    ? {
                        ...amountFields,
                        direction: "CREDIT",
                        reasonCode: "MANUAL_CREDIT",
                      }
                    : {
                        ...amountFields,
                        direction: "DEBIT",
                        reasonCode: "MANUAL_DEBIT",
                      },
                );
              }}
            >
              <SelectField
                label={copy.direction}
                name="walletAdjustmentDirection"
                value={direction}
                onChange={(value) =>
                  updateWalletDraft(() =>
                    setDirection(value as WalletAdjustmentDirection),
                  )
                }
                options={["CREDIT", "DEBIT"]}
              />
              <TextField
                label={copy.sourceAmount}
                name="sourceAmount"
                value={amount}
                onChange={(value) => updateWalletDraft(() => setAmount(value))}
                required
                pattern="^(?:0|[1-9]\d{0,13})(?:\.\d{1,4})?$"
              />
              <SelectField
                label={copy.currency}
                name="sourceCurrencyCode"
                value={selectedCurrency}
                onChange={(value) =>
                  updateWalletDraft(() => setCurrency(value))
                }
                options={currencyOptions}
              />
              <div>
                <Button type="submit" variant="primary" disabled={Boolean(workspace.mutation.name)}>
                  {copy.previewAdjustment}
                </Button>
              </div>
            </form>
          ) : workspace.inputCurrenciesState === "empty" ? (
            <p className="mt-3 text-sm text-muted-foreground">{copy.noCurrencies}</p>
          ) : null}
          {workspace.walletPreview ? (
            <div className="mt-4 rounded-lg border border-info/30 bg-info-subtle p-4 text-info-subtle-foreground">
              <div className="grid gap-2 md:grid-cols-4">
                <Metric
                  label={copy.sourceAmount}
                  value={`${workspace.walletPreview.sourceCurrencyCode} ${workspace.walletPreview.sourceAmount}`}
                  compact
                />
                <Metric
                  label={copy.usdAmount}
                  value={`USD ${workspace.walletPreview.amountUsd}`}
                  compact
                />
                <Metric
                  label={copy.balanceAfter}
                  value={`USD ${workspace.walletPreview.balanceAfterUsd}`}
                  compact
                />
                <Metric
                  label={copy.expires}
                  value={formatDate(workspace.walletPreview.expiresAt, lang)}
                  compact
                />
              </div>
              {!previewIsCurrent ? (
                <p className="mt-3 text-sm text-destructive-subtle-foreground">
                  {copy.previewExpired}
                </p>
              ) : null}
              {workspace.permissions.canConfirmWalletAdjustment ? (
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <TextField
                    label={copy.auditNote}
                    name="auditNote"
                    value={note}
                    onChange={setNote}
                    required
                    minLength={1}
                    maxLength={255}
                  />
                  <Button
                    type="button"
                    variant="primary"
                    disabled={
                      !previewIsCurrent ||
                      !note.trim() ||
                      Boolean(workspace.mutation.name)
                    }
                    onClick={() => void workspace.confirmWalletAdjustment(note)}
                  >
                    {copy.confirmAdjustment}
                  </Button>
                  <Button type="button" variant="outline" onClick={workspace.clearWalletPreview}>
                    {copy.dismiss}
                  </Button>
                </div>
              ) : (
                <p className="mt-3 text-sm text-warning-subtle-foreground">
                  {copy.previewOnly}
                </p>
              )}
            </div>
          ) : null}
        </Card>
      ) : workspace.permissions.canPreviewWalletAdjustment ? (
        <StateCard>{copy.walletAdjustmentUnavailable}</StateCard>
      ) : null}
      <Card className="p-5">
        <h3 className="font-semibold">{copy.ledger}</h3>
        {workspace.ledgerState === "loading" ||
        workspace.ledgerState === "idle" ? (
          <p className="mt-3 text-sm text-muted-foreground">{copy.loadingLedger}</p>
        ) : null}
        {workspace.ledgerState === "error" ? (
          <ErrorNotice error={workspace.ledgerError} lang={lang} />
        ) : null}
        {workspace.ledgerState === "forbidden" ? (
          <LedgerForbiddenState title={copy.ledgerForbidden} />
        ) : null}
        {workspace.ledgerState === "empty" ? (
          <EmptyState title={copy.noLedger} />
        ) : null}
        {workspace.ledgerState === "ready" || (workspace.ledgerState === "loading" && workspace.ledger.items.length > 0) ? (
          <div className="mt-3">
            <DataTable
              columns={ledgerColumns}
              data={workspace.ledger.items}
              getRowId={(entry) => entry.id}
              pagination={{
                page: workspace.ledger.meta.page,
                limit: workspace.ledger.meta.limit,
                totalItems: workspace.ledger.meta.total,
                totalPages: Math.max(1, workspace.ledger.meta.totalPages),
                onPageChange: workspace.setLedgerPage,
              }}
            />
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function PaymentsSection({ workspace, lang }: TenantBillingPanelProps) {
  const copy = billingCopy[lang];
  const [refundNotes, setRefundNotes] = useState<Record<string, string>>({});
  const [refundConfirmations, setRefundConfirmations] = useState<
    Record<string, boolean>
  >({});
  if (
    (workspace.paymentsState === "loading" ||
      workspace.paymentsState === "idle") &&
    workspace.payments.items.length === 0
  )
    return <StateCard>{copy.loadingPayments}</StateCard>;
  if (workspace.paymentsState === "forbidden")
    return <StateCard>{copy.paymentsForbidden}</StateCard>;
  if (workspace.paymentsState === "error")
    return <ErrorNotice error={workspace.paymentsError} lang={lang} />;

  const paymentColumns: ColumnDef<PaymentStatusView>[] = [
    {
      key: "created",
      headerEn: copy.created,
      headerAr: copy.created,
      cell: (payment) => formatDate(payment.createdAt, lang),
    },
    {
      key: "status",
      headerEn: copy.status,
      headerAr: copy.status,
      cell: (payment) => payment.status,
    },
    {
      key: "purpose",
      headerEn: copy.purpose,
      headerAr: copy.purpose,
      cell: (payment) => payment.purpose,
    },
    {
      key: "provider",
      headerEn: copy.provider,
      headerAr: copy.provider,
      cell: (payment) => payment.provider,
    },
    {
      key: "amount",
      headerEn: copy.amount,
      headerAr: copy.amount,
      cell: (payment) => (
        <div className="font-mono">
          {payment.providerCurrencyCode} {payment.providerAmount}
          <div className="text-xs font-normal text-muted-foreground">
            USD {payment.totalAppliedUsd}
          </div>
        </div>
      ),
    },
    {
      key: "actions",
      headerEn: copy.actions,
      headerAr: copy.actions,
      cell: (payment) => (
        <div className="flex min-w-56 flex-col gap-2">
          {workspace.permissions.canRefundPayment &&
          payment.status === "SUCCEEDED" ? (
            <>
              <Field id={`refund-note-${payment.paymentId}`} label={copy.refundNote}>
                {(field) => (
                  <Input
                    {...field}
                    name={`refundNote.${payment.paymentId}`}
                    value={refundNotes[payment.paymentId] ?? ""}
                    onChange={(event) =>
                      setRefundNotes((current) => ({
                        ...current,
                        [payment.paymentId]: event.target.value,
                      }))
                    }
                    maxLength={500}
                  />
                )}
              </Field>
              <label htmlFor={`refund-confirmation-${payment.paymentId}`} className="flex min-h-11 items-center gap-3 text-xs text-muted-foreground">
                <Checkbox
                  id={`refund-confirmation-${payment.paymentId}`}
                  name={`refundConfirmed.${payment.paymentId}`}
                  checked={refundConfirmations[payment.paymentId] ?? false}
                  onCheckedChange={(checked) =>
                    setRefundConfirmations((current) => ({
                      ...current,
                      [payment.paymentId]: checked === true,
                    }))
                  }
                />
                {copy.confirmRefund}
              </label>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={
                  !refundConfirmations[payment.paymentId] ||
                  Boolean(workspace.mutation.name)
                }
                onClick={() =>
                  void workspace.refundPayment(
                    payment.paymentId,
                    refundNotes[payment.paymentId],
                  )
                }
              >
                {copy.refund}
              </Button>
            </>
          ) : null}
          {workspace.permissions.canReconcilePayment ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void workspace.selectPayment(payment.paymentId)}
            >
              {copy.reconcile}
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="font-semibold">{copy.paymentHistory}</h3>
        {workspace.payments.items.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{copy.noPayments}</p>
        ) : (
          <div className="mt-3">
            <DataTable
              columns={paymentColumns}
              data={workspace.payments.items}
              getRowId={(payment) => payment.paymentId}
              pagination={{
                page: workspace.payments.meta.page,
                limit: workspace.payments.meta.limit,
                totalItems: workspace.payments.meta.total,
                totalPages: Math.max(1, workspace.payments.meta.totalPages),
                onPageChange: workspace.setPaymentsPage,
              }}
            />
          </div>
        )}
      </Card>
      {workspace.selectedPaymentId ? (
        <PaymentReconciliationPanel
          key={workspace.selectedPaymentId}
          workspace={workspace}
          lang={lang}
        />
      ) : null}
    </div>
  );
}

function PaymentReconciliationPanel({
  workspace,
  lang,
}: TenantBillingPanelProps) {
  const copy = billingCopy[lang];
  const [action, setAction] = useState<PaymentReconciliationAction | "">("");
  const [evidence, setEvidence] = useState("");
  const [providerReference, setProviderReference] = useState("");
  const [proposalNote, setProposalNote] = useState("");
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>(
    {},
  );
  const reconciliationCase = workspace.reconciliationCase;
  const eligibleActions = reconciliationCase?.eligibleActions ?? [];
  const effectiveAction = eligibleActions.includes(
    action as PaymentReconciliationAction,
  )
    ? (action as PaymentReconciliationAction)
    : (eligibleActions[0] ?? null);
  const hasOpenProposal =
    reconciliationCase?.reconciliations.some(
      (row) => row.status === "PROPOSED",
    ) ?? false;
  const providerReferenceRequired = effectiveAction === "CONFIRM_REFUNDED";
  const authoritativeEvidence =
    effectiveAction === "CONFIRM_SUCCEEDED"
      ? (reconciliationCase?.payment.providerSuccessEventReference ?? null)
      : effectiveAction === "CONFIRM_REFUNDED"
        ? (reconciliationCase?.payment.unexpectedRefundEventReference ??
          (reconciliationCase?.payment.failureCode ===
          "LATE_SUCCESS_REQUIRES_RECONCILIATION"
            ? (reconciliationCase.payment.providerSuccessEventReference ?? null)
            : null))
        : null;
  const authoritativeProviderReference =
    effectiveAction === "CONFIRM_REFUNDED"
      ? (reconciliationCase?.payment.unexpectedRefundProviderOutcomeReference ??
        reconciliationCase?.payment.refundProviderReference ??
        null)
      : null;
  const effectiveEvidence = authoritativeEvidence ?? evidence;
  const effectiveProviderReference =
    authoritativeProviderReference ?? providerReference;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">{copy.reconciliation}</h3>
        <Button type="button" variant="outline" onClick={() => void workspace.selectPayment(null)}>
          {copy.close}
        </Button>
      </div>
      {workspace.reconciliationState === "loading" ? (
        <p className="mt-3 text-sm">{copy.loadingReconciliation}</p>
      ) : null}
      {workspace.reconciliationError ? (
        <ErrorNotice error={workspace.reconciliationError} lang={lang} />
      ) : null}
      {reconciliationCase ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Metric
              label={copy.status}
              value={reconciliationCase.payment.status}
              compact
            />
            <Metric
              label={copy.failureCode}
              value={reconciliationCase.payment.failureCode ?? "—"}
              compact
            />
            <Metric
              label={copy.eligibleActions}
              value={eligibleActions.join(", ") || "—"}
              compact
            />
          </div>
          {effectiveAction && !hasOpenProposal ? (
            <form
              className="grid gap-3 md:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                void workspace.proposeReconciliation({
                  action: effectiveAction,
                  evidenceReference: effectiveEvidence,
                  ...(providerReferenceRequired
                    ? { providerOutcomeReference: effectiveProviderReference }
                    : {}),
                  note: proposalNote,
                });
              }}
            >
              <SelectField
                label={copy.action}
                name="reconciliationAction"
                value={effectiveAction}
                onChange={(value) => {
                  setAction(value as PaymentReconciliationAction);
                  setEvidence("");
                  setProviderReference("");
                }}
                options={eligibleActions}
              />
              <TextField
                label={copy.evidenceReference}
                name="evidenceReference"
                value={effectiveEvidence}
                onChange={setEvidence}
                required
                maxLength={128}
                readOnly={authoritativeEvidence !== null}
              />
              {providerReferenceRequired ? (
                <TextField
                  label={copy.providerReference}
                  name="providerOutcomeReference"
                  value={effectiveProviderReference}
                  onChange={setProviderReference}
                  required
                  maxLength={128}
                  readOnly={authoritativeProviderReference !== null}
                />
              ) : null}
              <TextField
                label={copy.auditNote}
                name="proposalNote"
                value={proposalNote}
                onChange={setProposalNote}
                required
                minLength={10}
                maxLength={500}
              />
              <div>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={
                    !effectiveEvidence.trim() ||
                    (providerReferenceRequired &&
                      !effectiveProviderReference.trim()) ||
                    proposalNote.trim().length < 10 ||
                    Boolean(workspace.mutation.name)
                  }
                >
                  {copy.propose}
                </Button>
              </div>
            </form>
          ) : hasOpenProposal ? (
            <StateCard>{copy.openProposalExists}</StateCard>
          ) : null}
          <div className="space-y-3">
            {reconciliationCase.reconciliations.map((row) => {
              const mayDecide =
                row.status === "PROPOSED" &&
                workspace.permissions.canDecideReconciliation &&
                row.proposedByAdminId !== workspace.actorId;
              return (
                <div
                  key={row.id}
                  className="rounded-lg border border-border p-3"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <span className="font-medium">{row.action}</span> ·{" "}
                      {row.status}
                      <p className="text-xs text-muted-foreground">
                        {row.evidenceReference} ·{" "}
                        {formatDate(row.createdAt, lang)}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-sm">{row.proposalNote}</p>
                  {row.status === "PROPOSED" &&
                  row.proposedByAdminId === workspace.actorId ? (
                    <p className="mt-3 text-sm text-warning-subtle-foreground">
                      {copy.makerChecker}
                    </p>
                  ) : null}
                  {mayDecide ? (
                    <div className="mt-3 flex flex-wrap items-end gap-2">
                      <TextField
                        label={copy.decisionNote}
                        name={`decisionNote.${row.id}`}
                        value={decisionNotes[row.id] ?? ""}
                        onChange={(value) =>
                          setDecisionNotes((current) => ({
                            ...current,
                            [row.id]: value,
                          }))
                        }
                        minLength={10}
                        maxLength={500}
                      />
                      <Button
                        type="button"
                        variant="primary"
                        disabled={
                          (decisionNotes[row.id]?.trim().length ?? 0) < 10 ||
                          Boolean(workspace.mutation.name)
                        }
                        onClick={() =>
                          void workspace.decideReconciliation(
                            row.id,
                            "APPROVE",
                            decisionNotes[row.id] ?? "",
                          )
                        }
                      >
                        {copy.approve}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={
                          (decisionNotes[row.id]?.trim().length ?? 0) < 10 ||
                          Boolean(workspace.mutation.name)
                        }
                        onClick={() =>
                          void workspace.decideReconciliation(
                            row.id,
                            "REJECT",
                            decisionNotes[row.id] ?? "",
                          )
                        }
                      >
                        {copy.reject}
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function BillingSummary({ workspace, lang }: TenantBillingPanelProps) {
  const copy = billingCopy[lang];
  if (workspace.billingSummaryState === "forbidden") return null;
  if (workspace.billingSummaryState === "loading")
    return <StateCard>{copy.loadingBillingSummary}</StateCard>;
  if (workspace.billingSummaryState === "error")
    return <ErrorNotice error={workspace.billingSummaryError} lang={lang} />;
  const invoice = workspace.billingSummary?.currentCollectionInvoice;
  return (
    <Card className="p-5">
      <h3 className="font-semibold">{copy.collectionInvoice}</h3>
      {invoice ? (
        <>
          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <Metric label={copy.invoiceNumber} value={invoice.number} compact />
            <Metric label={copy.status} value={invoice.status} compact />
            <Metric
              label={copy.total}
              value={`USD ${invoice.totalUsd ?? "—"}`}
              compact
            />
            <Metric
              label={copy.outstanding}
              value={`USD ${invoice.outstandingUsd ?? "—"}`}
              compact
            />
          </div>
          {workspace.permissions.canRecordOfflinePayment &&
          ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status) ? (
            <OfflinePaymentForm
              key={invoice.id}
              workspace={workspace}
              lang={lang}
            />
          ) : null}
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          {copy.noCollectionInvoice}
        </p>
      )}
    </Card>
  );
}

function OfflinePaymentForm({ workspace, lang }: TenantBillingPanelProps) {
  const copy = billingCopy[lang];
  const [amount, setAmount] = useState("");
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const updateDraft = (update: () => void) => {
    setConfirmed(false);
    update();
  };
  return (
    <form
      className="mt-4 grid gap-3 border-t border-border pt-4 md:grid-cols-2"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!confirmed) return;
        const result = await workspace.recordOfflinePayment({
          amount,
          currencyCode,
          reference,
          ...(note.trim() ? { note } : {}),
        });
        if (result) {
          setAmount("");
          setCurrencyCode("USD");
          setReference("");
          setNote("");
          setConfirmed(false);
        }
      }}
    >
      <div className="md:col-span-2">
        <h4 className="font-medium">{copy.offlinePayment}</h4>
        <p className="text-xs text-muted-foreground">{copy.offlinePaymentHelp}</p>
      </div>
      <TextField
        label={copy.sourceAmount}
        name="sourceAmount"
        value={amount}
        onChange={(value) => updateDraft(() => setAmount(value))}
        required
        inputMode="decimal"
        pattern="^\d{1,14}(?:\.\d{1,4})?$"
      />
      <TextField
        label={copy.currency}
        name="currencyCode"
        value={currencyCode}
        onChange={(value) =>
          updateDraft(() => setCurrencyCode(value.toUpperCase()))
        }
        required
        minLength={3}
        maxLength={3}
        pattern="^[A-Z]{3}$"
      />
      <TextField
        label={copy.offlineReference}
        name="reference"
        value={reference}
        onChange={(value) => updateDraft(() => setReference(value))}
        required
        maxLength={128}
      />
      <TextField
        label={copy.auditNote}
        name="note"
        value={note}
        onChange={(value) => updateDraft(() => setNote(value))}
        maxLength={500}
      />
      <label htmlFor="offline-payment-confirmation" className="flex min-h-11 items-center gap-3 text-xs text-muted-foreground md:col-span-2">
        <Checkbox
          id="offline-payment-confirmation"
          name="offlinePaymentConfirmed"
          checked={confirmed}
          onCheckedChange={(checked) => setConfirmed(checked === true)}
        />
        {copy.confirmOfflinePayment}
      </label>
      <div className="md:col-span-2">
        <Button
          type="submit"
          variant="destructive"
          disabled={
            !confirmed ||
            !amount ||
            !reference.trim() ||
            Boolean(workspace.mutation.name)
          }
        >
          {copy.recordOfflinePayment}
        </Button>
      </div>
    </form>
  );
}

function Metric({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? "rounded-lg bg-card/70 p-2"
          : "rounded-lg border border-border bg-card p-4"
      }
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-words font-medium text-foreground">{value}</p>
    </div>
  );
}

function StateCard({ children }: { children: ReactNode }) {
  return (
    <Card className="p-5 text-sm text-muted-foreground">{children}</Card>
  );
}

// A 403 is not an empty state (AGENTS.md) — same layout rhythm as the shared
// EmptyState pattern, but a distinct icon and an "alert" role so assistive
// tech and a quick visual scan both tell a permission gap apart from a
// genuinely empty ledger.
function LedgerForbiddenState({ title }: { title: string }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <ShieldAlert className="mb-1 size-8 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">{title}</p>
    </div>
  );
}

function ErrorNotice({
  error,
  lang,
  focusOnMount = false,
}: {
  error: { message: string; errorCode: string; correlationId?: string } | null;
  lang: "ar" | "en";
  focusOnMount?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error && focusOnMount) ref.current?.focus();
  }, [error, focusOnMount]);
  if (!error) return null;
  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      className="rounded-lg border border-destructive/30 bg-destructive-subtle p-3 text-sm text-destructive-subtle-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <p className="font-medium">{error.message}</p>
      <p className="mt-1 font-mono text-xs">
        {error.errorCode}
        {error.correlationId
          ? ` · ${billingCopy[lang].correlationLabel}: ${error.correlationId}`
          : ""}
      </p>
    </div>
  );
}

function TextField({
  label,
  name,
  value,
  onChange,
  type = "text",
  ...inputProps
}: {
  label: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type"
>) {
  return (
    <Field label={label}>
      {(fp) => (
        <Input
          id={fp.id}
          {...inputProps}
          name={name}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}

const EMPTY_SELECT_VALUE = "__none__";
/**
 * Prefill for the manual trial length. Core's `tenants.trial_days` setting is
 * what applies when no explicit value is sent; this only seeds the input an
 * admin is about to override.
 */
const DEFAULT_TRIAL_DAYS = 7;

function SelectField({
  label,
  name,
  value,
  onChange,
  options,
  placeholder,
  required,
}: {
  label: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<string | readonly [string, string]>;
  placeholder?: string;
  required?: boolean;
}) {
  const entries = options.map((option) => typeof option === "string" ? [option, option] as const : option);
  const generatedId = useId();
  const id = name ? `tenant-billing-${name}` : generatedId;
  const labelId = `${id}-label`;
  return (
    <div className="space-y-1.5">
      <span id={labelId} className="text-sm font-medium text-foreground">
        {label}
        {required ? <span className="ms-0.5 text-destructive" aria-hidden="true">*</span> : null}
      </span>
      <Select
        name={name}
        value={value || EMPTY_SELECT_VALUE}
        onValueChange={(next) => onChange(next === EMPTY_SELECT_VALUE ? "" : next)}
      >
        <SelectTrigger id={id} aria-labelledby={labelId} aria-required={required || undefined}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {placeholder ? <SelectItem value={EMPTY_SELECT_VALUE}>{placeholder}</SelectItem> : null}
          {entries.map(([optionValue, optionLabel]) => (
            <SelectItem key={optionValue} value={optionValue}>{optionLabel}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function formatDate(value: string | null, lang: "ar" | "en"): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(localeForLanguage(lang), {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function isFutureInstant(value: string): boolean {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

const billingCopy = {
  en: {
    title: "Subscription, wallet & payments",
    subtitle: "Authoritative billing state and reviewed financial commands.",
    refresh: "Refresh",
    refreshing: "Refreshing billing data while keeping the current view available…",
    correlationLabel: "Correlation",
    sections: {
      subscription: "Subscription",
      wallet: "Wallet",
      payments: "Payments",
    },
    loadingSubscription: "Loading subscription…",
    subscriptionForbidden:
      "You do not have permission to read this subscription.",
    noSubscription: "No subscription exists for this tenant.",
    noCreatePermission: "You cannot seed a subscription.",
    billingCycle: "Billing cycle",
    trialDays: "Trial days",
    moduleKey: "Application key",
    tierKey: "Tier key",
    seats: "Seats",
    createSubscription: "Create subscription",
    status: "Status",
    effectiveUsers: "Effective users",
    totalPrice: "Total price",
    subscriptionItems: "Subscription items",
    periodEnd: "Period ends",
    cancelAt: "Cancellation scheduled",
    confirmCancel: "I confirm cancellation",
    cancelSubscription: "Cancel subscription",
    module: "Application",
    tier: "Tier",
    lineTotal: "Line total",
    features: "Features",
    enrichmentUnavailable: "Catalogue enrichment unavailable",
    planChange: "Plan change",
    serverPreview:
      "The server prices and locks every change before it can be applied.",
    operation: "Operation",
    item: "Item",
    selectItem: "Select an item",
    previewChange: "Preview change",
    prorated: "Prorated amount",
    walletShortfall: "Wallet shortfall",
    expires: "Expires",
    applyReviewedChange: "Apply reviewed change",
    tierChange: "Tier change",
    seatChange: "Seat change",
    lineDelta: "Line price change",
    previewExpired:
      "This reviewed server preview has expired. Request a new preview.",
    planChangeUnavailable:
      "Plan changes are available only while the subscription is in trial or active.",
    dismiss: "Dismiss",
    loadingWallet: "Loading wallet…",
    walletForbidden: "You do not have permission to read the wallet.",
    noWallet: "No wallet exists for this tenant.",
    balance: "Balance",
    reserved: "Reserved",
    available: "Available",
    walletAdjustment: "Manual wallet adjustment",
    fxAuthority:
      "Conversion and resulting balance are calculated only by the server.",
    direction: "Direction",
    sourceAmount: "Source amount",
    currency: "Input currency",
    previewAdjustment: "Preview adjustment",
    usdAmount: "USD amount",
    balanceAfter: "Balance after",
    auditNote: "Audit note",
    confirmAdjustment: "Confirm adjustment",
    previewOnly: "You may review this quote but cannot confirm it.",
    loadingCurrencies: "Loading accepted input currencies…",
    currenciesForbidden:
      "Accepted input currencies are not available to this administrator.",
    noCurrencies: "No accepted input currencies are currently available.",
    walletAdjustmentUnavailable:
      "Manual adjustments are unavailable while the wallet is frozen or closed.",
    ledger: "Ledger",
    loadingLedger: "Loading ledger…",
    ledgerForbidden: "You do not have permission to read the ledger.",
    noLedger: "No ledger entries found.",
    created: "Created",
    amount: "Amount",
    source: "Source",
    reason: "Reason",
    loadingPayments: "Loading payments…",
    paymentsForbidden: "You do not have permission to read payments.",
    paymentHistory: "Payment history",
    noPayments: "No payments found.",
    purpose: "Purpose",
    provider: "Provider",
    actions: "Actions",
    refundNote: "Optional refund note",
    confirmRefund: "I confirm this critical refund",
    refund: "Refund",
    reconcile: "Open reconciliation",
    reconciliation: "Payment reconciliation",
    close: "Close",
    loadingReconciliation: "Loading reconciliation case…",
    failureCode: "Failure code",
    eligibleActions: "Eligible actions",
    action: "Action",
    evidenceReference: "Evidence reference",
    providerReference: "Provider outcome reference",
    propose: "Propose",
    openProposalExists:
      "An open reconciliation proposal already exists for this payment.",
    makerChecker:
      "The proposing administrator cannot approve or reject their own proposal.",
    decisionNote: "Decision note (10+ characters)",
    approve: "Approve",
    reject: "Reject",
    loadingBillingSummary: "Loading collection summary…",
    collectionInvoice: "Current collection invoice",
    invoiceNumber: "Invoice",
    total: "Total",
    outstanding: "Outstanding",
    noCollectionInvoice: "No current collection invoice.",
    offlinePayment: "Record offline invoice payment",
    offlinePaymentHelp:
      "Record a verified external collection against this open invoice. The server performs currency conversion and settlement.",
    offlineReference: "External receipt reference",
    confirmOfflinePayment:
      "I verified the receipt and confirm this critical collection",
    recordOfflinePayment: "Record offline payment",
    previous: "Previous",
    next: "Next",
    page: "Page",
  },
  ar: {
    title: "الاشتراك والمحفظة والمدفوعات",
    subtitle: "حالة فوترة موثوقة وأوامر مالية بعد المراجعة.",
    refresh: "تحديث",
    refreshing: "جارٍ تحديث بيانات الفوترة مع إبقاء العرض الحالي متاحًا…",
    correlationLabel: "معرّف الارتباط",
    sections: {
      subscription: "الاشتراك",
      wallet: "المحفظة",
      payments: "المدفوعات",
    },
    loadingSubscription: "جارٍ تحميل الاشتراك…",
    subscriptionForbidden: "لا تملك صلاحية قراءة الاشتراك.",
    noSubscription: "لا يوجد اشتراك لهذا المستأجر.",
    noCreatePermission: "لا يمكنك إنشاء الاشتراك.",
    billingCycle: "دورة الفوترة",
    trialDays: "أيام التجربة",
    moduleKey: "مفتاح التطبيق",
    tierKey: "مفتاح الباقة",
    seats: "المقاعد",
    createSubscription: "إنشاء الاشتراك",
    status: "الحالة",
    effectiveUsers: "المستخدمون الفعليون",
    totalPrice: "السعر الإجمالي",
    subscriptionItems: "بنود الاشتراك",
    periodEnd: "نهاية الفترة",
    cancelAt: "موعد الإلغاء",
    confirmCancel: "أؤكد الإلغاء",
    cancelSubscription: "إلغاء الاشتراك",
    module: "التطبيق",
    tier: "الباقة",
    lineTotal: "إجمالي البند",
    features: "الميزات",
    enrichmentUnavailable: "بيانات الكتالوج غير متاحة",
    planChange: "تغيير الخطة",
    serverPreview: "يُسعّر الخادم كل تغيير ويثبته قبل التنفيذ.",
    operation: "العملية",
    item: "البند",
    selectItem: "اختر بنداً",
    previewChange: "معاينة التغيير",
    prorated: "القيمة النسبية",
    walletShortfall: "عجز المحفظة",
    expires: "تنتهي",
    applyReviewedChange: "تنفيذ التغيير المُراجع",
    tierChange: "تغيير الباقة",
    seatChange: "تغيير المقاعد",
    lineDelta: "تغيير سعر البند",
    previewExpired: "انتهت صلاحية معاينة الخادم المُراجعة. اطلب معاينة جديدة.",
    planChangeUnavailable:
      "تغييرات الخطة متاحة فقط عندما يكون الاشتراك تجريبياً أو نشطاً.",
    dismiss: "إغلاق",
    loadingWallet: "جارٍ تحميل المحفظة…",
    walletForbidden: "لا تملك صلاحية قراءة المحفظة.",
    noWallet: "لا توجد محفظة لهذا المستأجر.",
    balance: "الرصيد",
    reserved: "المحجوز",
    available: "المتاح",
    walletAdjustment: "تعديل يدوي للمحفظة",
    fxAuthority: "الخادم وحده يحسب التحويل والرصيد الناتج.",
    direction: "الاتجاه",
    sourceAmount: "المبلغ المصدر",
    currency: "عملة الإدخال",
    previewAdjustment: "معاينة التعديل",
    usdAmount: "المبلغ بالدولار",
    balanceAfter: "الرصيد بعد",
    auditNote: "ملاحظة التدقيق",
    confirmAdjustment: "تأكيد التعديل",
    previewOnly: "يمكنك مراجعة العرض ولا يمكنك تأكيده.",
    loadingCurrencies: "جارٍ تحميل عملات الإدخال المقبولة…",
    currenciesForbidden: "عملات الإدخال المقبولة غير متاحة لهذا المسؤول.",
    noCurrencies: "لا توجد عملات إدخال مقبولة متاحة حالياً.",
    walletAdjustmentUnavailable:
      "التعديلات اليدوية غير متاحة عندما تكون المحفظة مجمدة أو مغلقة.",
    ledger: "دفتر القيود",
    loadingLedger: "جارٍ تحميل دفتر القيود…",
    ledgerForbidden: "لا تملك صلاحية قراءة دفتر القيود.",
    noLedger: "لا توجد قيود.",
    created: "الإنشاء",
    amount: "المبلغ",
    source: "المصدر",
    reason: "السبب",
    loadingPayments: "جارٍ تحميل المدفوعات…",
    paymentsForbidden: "لا تملك صلاحية قراءة المدفوعات.",
    paymentHistory: "سجل المدفوعات",
    noPayments: "لا توجد مدفوعات.",
    purpose: "الغرض",
    provider: "المزوّد",
    actions: "الإجراءات",
    refundNote: "ملاحظة استرداد اختيارية",
    confirmRefund: "أؤكد هذا الاسترداد المالي الحرج",
    refund: "استرداد",
    reconcile: "فتح التسوية",
    reconciliation: "تسوية الدفعة",
    close: "إغلاق",
    loadingReconciliation: "جارٍ تحميل حالة التسوية…",
    failureCode: "رمز الفشل",
    eligibleActions: "الإجراءات المتاحة",
    action: "الإجراء",
    evidenceReference: "مرجع الدليل",
    providerReference: "مرجع نتيجة المزوّد",
    propose: "اقتراح",
    openProposalExists: "يوجد اقتراح تسوية مفتوح لهذه الدفعة بالفعل.",
    makerChecker: "لا يمكن للمسؤول مقدم الاقتراح اعتماد اقتراحه أو رفضه.",
    decisionNote: "ملاحظة القرار (10 أحرف على الأقل)",
    approve: "اعتماد",
    reject: "رفض",
    loadingBillingSummary: "جارٍ تحميل ملخص التحصيل…",
    collectionInvoice: "فاتورة التحصيل الحالية",
    invoiceNumber: "الفاتورة",
    total: "الإجمالي",
    outstanding: "المتبقي",
    noCollectionInvoice: "لا توجد فاتورة تحصيل حالية.",
    offlinePayment: "تسجيل دفعة فاتورة خارجية",
    offlinePaymentHelp:
      "سجّل تحصيلاً خارجياً تم التحقق منه على هذه الفاتورة المفتوحة. يتولى الخادم تحويل العملة والتسوية.",
    offlineReference: "مرجع الإيصال الخارجي",
    confirmOfflinePayment: "تحققت من الإيصال وأؤكد هذا التحصيل المالي الحرج",
    recordOfflinePayment: "تسجيل الدفعة الخارجية",
    previous: "السابق",
    next: "التالي",
    page: "صفحة",
  },
} as const;
