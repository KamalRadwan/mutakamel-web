"use client";

import { useState, type FormEvent } from "react";
import type { UseTenantBillingWorkspaceResult } from "../hooks/useTenantBillingWorkspace";
import type {
  BillingCycle,
  PaymentReconciliationAction,
  SubscriptionPlanChangeOperation,
  WalletAdjustmentDirection,
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
  return (
    <section className="space-y-4" dir={rtl ? "rtl" : "ltr"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
            {copy.title}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {copy.subtitle}
          </p>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => void workspace.refresh()}
        >
          {copy.refresh}
        </button>
      </div>

      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label={copy.title}
      >
        {(["subscription", "wallet", "payments"] as const).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={section === key}
            className={section === key ? "primary-button" : "secondary-button"}
            onClick={() => setSection(key)}
          >
            {copy.sections[key]}
          </button>
        ))}
      </div>

      {workspace.mutation.error ? (
        <ErrorNotice error={workspace.mutation.error} lang={lang} />
      ) : null}
      {section === "subscription" ? (
        <div className="space-y-4">
          <BillingSummary workspace={workspace} lang={lang} />
          <SubscriptionSection workspace={workspace} lang={lang} />
        </div>
      ) : null}
      {section === "wallet" ? (
        <WalletSection workspace={workspace} lang={lang} />
      ) : null}
      {section === "payments" ? (
        <PaymentsSection workspace={workspace} lang={lang} />
      ) : null}
    </section>
  );
}

function SubscriptionSection({ workspace, lang }: TenantBillingPanelProps) {
  const copy = billingCopy[lang];
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("MONTHLY");
  const [trialDays, setTrialDays] = useState("14");
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
    workspace.subscriptionState === "loading" ||
    workspace.subscriptionState === "idle"
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
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
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
              value={billingCycle}
              onChange={(value) => setBillingCycle(value as BillingCycle)}
              options={["MONTHLY", "ANNUAL"]}
            />
            <TextField
              label={copy.trialDays}
              value={trialDays}
              onChange={setTrialDays}
              type="number"
              min="1"
              max="365"
            />
            <TextField
              label={copy.moduleKey}
              value={moduleKey}
              onChange={setModuleKey}
              required
            />
            <TextField
              label={copy.tierKey}
              value={tierKey}
              onChange={setTierKey}
              required
            />
            <TextField
              label={copy.seats}
              value={seats}
              onChange={setSeats}
              type="number"
              min="1"
              required
            />
            <div className="flex items-end">
              <button
                className="primary-button"
                disabled={Boolean(workspace.mutation.name)}
              >
                {copy.createSubscription}
              </button>
            </div>
          </form>
        ) : (
          <p className="mt-2 text-sm text-slate-500">
            {copy.noCreatePermission}
          </p>
        )}
      </div>
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
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">{copy.subscriptionItems}</h3>
            <p className="text-xs text-slate-500">
              {copy.periodEnd}: {formatDate(header.currentPeriodEnd, lang)}
            </p>
            {header.cancelAt ? (
              <p className="text-xs text-amber-700">
                {copy.cancelAt}: {formatDate(header.cancelAt, lang)}
              </p>
            ) : null}
          </div>
          {workspace.permissions.canCancelSubscription &&
          header.status !== "CANCELLED" &&
          header.cancelAt === null ? (
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={cancelConfirmed}
                  onChange={(event) => setCancelConfirmed(event.target.checked)}
                />
                {copy.confirmCancel}
              </label>
              <button
                type="button"
                className="danger-button"
                disabled={!cancelConfirmed || Boolean(workspace.mutation.name)}
                onClick={() => void workspace.cancelSubscription()}
              >
                {copy.cancelSubscription}
              </button>
            </div>
          ) : null}
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-start text-xs text-slate-500">
                <th className="p-2 text-start">{copy.module}</th>
                <th className="p-2 text-start">{copy.tier}</th>
                <th className="p-2 text-start">{copy.seats}</th>
                <th className="p-2 text-start">{copy.lineTotal}</th>
                <th className="p-2 text-start">{copy.features}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-slate-100 dark:border-slate-900"
                >
                  <td className="p-2">
                    {item.moduleName ?? item.moduleKey ?? item.moduleId}
                  </td>
                  <td className="p-2">
                    {item.tierName ?? item.tierKey ?? item.tierId}
                  </td>
                  <td className="p-2">{item.seats}</td>
                  <td className="p-2 font-mono">
                    {item.currencyCode ?? "USD"} {item.lineTotal}
                  </td>
                  <td className="p-2 text-xs">
                    {item.features === null
                      ? copy.enrichmentUnavailable
                      : item.features.join(", ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {workspace.permissions.canUpdateSubscription && canChangePlan ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
          <h3 className="font-semibold">{copy.planChange}</h3>
          <p className="text-xs text-slate-500">{copy.serverPreview}</p>
          <form
            className="mt-4 grid gap-3 md:grid-cols-2"
            onSubmit={submitPreview}
          >
            <SelectField
              label={copy.operation}
              value={operation}
              onChange={(value) =>
                updatePlanDraft(() =>
                  setOperation(value as SubscriptionPlanChangeOperation),
                )
              }
              options={["ADD", "CHANGE", "REMOVE"]}
            />
            {operation !== "ADD" ? (
              <label className="space-y-1 text-sm">
                <span>{copy.item}</span>
                <select
                  className="field w-full"
                  required
                  value={itemId}
                  onChange={(event) =>
                    updatePlanDraft(() => setItemId(event.target.value))
                  }
                >
                  <option value="">{copy.selectItem}</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.moduleName ?? item.moduleKey ?? item.id} ·{" "}
                      {item.tierName ?? item.tierKey}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <TextField
                label={copy.moduleKey}
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
              <button
                className="primary-button"
                disabled={Boolean(workspace.mutation.name)}
              >
                {copy.previewChange}
              </button>
            </div>
          </form>
          {workspace.planPreview ? (
            <div className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm dark:border-indigo-900 dark:bg-indigo-950/40">
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
                <p className="mt-3 text-sm text-red-700">
                  {copy.previewExpired}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {workspace.permissions.canApplySubscriptionUpdate ? (
                  <button
                    type="button"
                    className="primary-button"
                    disabled={
                      !previewIsCurrent ||
                      !workspace.planPreview.financial.canApply ||
                      Boolean(workspace.mutation.name)
                    }
                    onClick={() => void workspace.applyPlanChange()}
                  >
                    {copy.applyReviewedChange}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="secondary-button"
                  onClick={workspace.clearPlanPreview}
                >
                  {copy.dismiss}
                </button>
              </div>
            </div>
          ) : null}
        </div>
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
  if (workspace.walletState === "loading" || workspace.walletState === "idle")
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
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
          <h3 className="font-semibold">{copy.walletAdjustment}</h3>
          <p className="text-xs text-slate-500">{copy.fxAuthority}</p>
          {workspace.inputCurrenciesState === "loading" ||
          workspace.inputCurrenciesState === "idle" ? (
            <p className="mt-3 text-sm text-slate-500">
              {copy.loadingCurrencies}
            </p>
          ) : null}
          {workspace.inputCurrenciesState === "error" ? (
            <ErrorNotice error={workspace.inputCurrenciesError} lang={lang} />
          ) : null}
          {workspace.inputCurrenciesState === "forbidden" ? (
            <p className="mt-3 text-sm text-amber-700">
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
                value={amount}
                onChange={(value) => updateWalletDraft(() => setAmount(value))}
                required
                pattern="^(?:0|[1-9]\\d{0,13})(?:\\.\\d{1,4})?$"
              />
              <SelectField
                label={copy.currency}
                value={selectedCurrency}
                onChange={(value) =>
                  updateWalletDraft(() => setCurrency(value))
                }
                options={currencyOptions}
              />
              <div>
                <button
                  className="primary-button"
                  disabled={Boolean(workspace.mutation.name)}
                >
                  {copy.previewAdjustment}
                </button>
              </div>
            </form>
          ) : workspace.inputCurrenciesState === "empty" ? (
            <p className="mt-3 text-sm text-slate-500">{copy.noCurrencies}</p>
          ) : null}
          {workspace.walletPreview ? (
            <div className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-950/40">
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
                <p className="mt-3 text-sm text-red-700">
                  {copy.previewExpired}
                </p>
              ) : null}
              {workspace.permissions.canConfirmWalletAdjustment ? (
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <TextField
                    label={copy.auditNote}
                    value={note}
                    onChange={setNote}
                    required
                    minLength={1}
                    maxLength={255}
                  />
                  <button
                    type="button"
                    className="primary-button"
                    disabled={
                      !previewIsCurrent ||
                      !note.trim() ||
                      Boolean(workspace.mutation.name)
                    }
                    onClick={() => void workspace.confirmWalletAdjustment(note)}
                  >
                    {copy.confirmAdjustment}
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={workspace.clearWalletPreview}
                  >
                    {copy.dismiss}
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-sm text-amber-700">
                  {copy.previewOnly}
                </p>
              )}
            </div>
          ) : null}
        </div>
      ) : workspace.permissions.canPreviewWalletAdjustment ? (
        <StateCard>{copy.walletAdjustmentUnavailable}</StateCard>
      ) : null}
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
        <h3 className="font-semibold">{copy.ledger}</h3>
        {workspace.ledgerState === "loading" ||
        workspace.ledgerState === "idle" ? (
          <p className="mt-3 text-sm text-slate-500">{copy.loadingLedger}</p>
        ) : null}
        {workspace.ledgerState === "error" ? (
          <ErrorNotice error={workspace.ledgerError} lang={lang} />
        ) : null}
        {workspace.ledgerState === "forbidden" ? (
          <p className="mt-3 text-sm text-amber-700">{copy.ledgerForbidden}</p>
        ) : null}
        {workspace.ledgerState === "empty" ? (
          <p className="mt-3 text-sm text-slate-500">{copy.noLedger}</p>
        ) : null}
        {workspace.ledgerState === "ready" ? (
          <>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-slate-500">
                    <th className="p-2 text-start">{copy.created}</th>
                    <th className="p-2 text-start">{copy.direction}</th>
                    <th className="p-2 text-start">{copy.amount}</th>
                    <th className="p-2 text-start">{copy.source}</th>
                    <th className="p-2 text-start">{copy.reason}</th>
                    <th className="p-2 text-start">{copy.balanceAfter}</th>
                  </tr>
                </thead>
                <tbody>
                  {workspace.ledger.items.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-slate-100 dark:border-slate-900"
                    >
                      <td className="p-2">
                        {formatDate(entry.createdAt, lang)}
                      </td>
                      <td className="p-2">{entry.direction}</td>
                      <td className="p-2 font-mono">USD {entry.amountUsd}</td>
                      <td className="p-2 font-mono">
                        {entry.sourceCurrencyCode} {entry.sourceAmount}
                      </td>
                      <td className="p-2">{entry.reason}</td>
                      <td className="p-2 font-mono">
                        USD {entry.balanceAfterUsd}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager
              page={workspace.ledger.meta.page}
              hasPrev={workspace.ledger.meta.hasPrev}
              hasNext={workspace.ledger.meta.hasNext}
              onPage={workspace.setLedgerPage}
              lang={lang}
            />
          </>
        ) : null}
      </div>
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
    workspace.paymentsState === "loading" ||
    workspace.paymentsState === "idle"
  )
    return <StateCard>{copy.loadingPayments}</StateCard>;
  if (workspace.paymentsState === "forbidden")
    return <StateCard>{copy.paymentsForbidden}</StateCard>;
  if (workspace.paymentsState === "error")
    return <ErrorNotice error={workspace.paymentsError} lang={lang} />;
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
        <h3 className="font-semibold">{copy.paymentHistory}</h3>
        {workspace.payments.items.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">{copy.noPayments}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-slate-500">
                  <th className="p-2 text-start">{copy.created}</th>
                  <th className="p-2 text-start">{copy.status}</th>
                  <th className="p-2 text-start">{copy.purpose}</th>
                  <th className="p-2 text-start">{copy.provider}</th>
                  <th className="p-2 text-start">{copy.amount}</th>
                  <th className="p-2 text-start">{copy.actions}</th>
                </tr>
              </thead>
              <tbody>
                {workspace.payments.items.map((payment) => (
                  <tr
                    key={payment.paymentId}
                    className="border-b border-slate-100 align-top dark:border-slate-900"
                  >
                    <td className="p-2">
                      {formatDate(payment.createdAt, lang)}
                    </td>
                    <td className="p-2">{payment.status}</td>
                    <td className="p-2">{payment.purpose}</td>
                    <td className="p-2">{payment.provider}</td>
                    <td className="p-2 font-mono">
                      {payment.providerCurrencyCode} {payment.providerAmount}
                      <div className="text-xs text-slate-500">
                        USD {payment.totalAppliedUsd}
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="flex min-w-56 flex-col gap-2">
                        {workspace.permissions.canRefundPayment &&
                        payment.status === "SUCCEEDED" ? (
                          <>
                            <input
                              className="field"
                              value={refundNotes[payment.paymentId] ?? ""}
                              onChange={(event) =>
                                setRefundNotes((current) => ({
                                  ...current,
                                  [payment.paymentId]: event.target.value,
                                }))
                              }
                              placeholder={copy.refundNote}
                              maxLength={500}
                            />
                            <label className="flex items-center gap-2 text-xs text-slate-600">
                              <input
                                type="checkbox"
                                checked={
                                  refundConfirmations[payment.paymentId] ??
                                  false
                                }
                                onChange={(event) =>
                                  setRefundConfirmations((current) => ({
                                    ...current,
                                    [payment.paymentId]: event.target.checked,
                                  }))
                                }
                              />
                              {copy.confirmRefund}
                            </label>
                            <button
                              type="button"
                              className="danger-button"
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
                            </button>
                          </>
                        ) : null}
                        {workspace.permissions.canReconcilePayment ? (
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() =>
                              void workspace.selectPayment(payment.paymentId)
                            }
                          >
                            {copy.reconcile}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager
          page={workspace.payments.meta.page}
          hasPrev={workspace.payments.meta.hasPrev}
          hasNext={workspace.payments.meta.hasNext}
          onPage={workspace.setPaymentsPage}
          lang={lang}
        />
      </div>
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
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">{copy.reconciliation}</h3>
        <button
          type="button"
          className="secondary-button"
          onClick={() => void workspace.selectPayment(null)}
        >
          {copy.close}
        </button>
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
                value={effectiveEvidence}
                onChange={setEvidence}
                required
                maxLength={128}
                readOnly={authoritativeEvidence !== null}
              />
              {providerReferenceRequired ? (
                <TextField
                  label={copy.providerReference}
                  value={effectiveProviderReference}
                  onChange={setProviderReference}
                  required
                  maxLength={128}
                  readOnly={authoritativeProviderReference !== null}
                />
              ) : null}
              <TextField
                label={copy.auditNote}
                value={proposalNote}
                onChange={setProposalNote}
                required
                minLength={10}
                maxLength={500}
              />
              <div>
                <button
                  className="primary-button"
                  disabled={
                  !effectiveEvidence.trim() ||
                  (providerReferenceRequired &&
                    !effectiveProviderReference.trim()) ||
                    proposalNote.trim().length < 10 ||
                    Boolean(workspace.mutation.name)
                  }
                >
                  {copy.propose}
                </button>
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
                  className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <span className="font-medium">{row.action}</span> ·{" "}
                      {row.status}
                      <p className="text-xs text-slate-500">
                        {row.evidenceReference} ·{" "}
                        {formatDate(row.createdAt, lang)}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-sm">{row.proposalNote}</p>
                  {row.status === "PROPOSED" &&
                  row.proposedByAdminId === workspace.actorId ? (
                    <p className="mt-3 text-sm text-amber-700">
                      {copy.makerChecker}
                    </p>
                  ) : null}
                  {mayDecide ? (
                    <div className="mt-3 flex flex-wrap items-end gap-2">
                      <TextField
                        label={copy.decisionNote}
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
                      <button
                        type="button"
                        className="primary-button"
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
                      </button>
                      <button
                        type="button"
                        className="danger-button"
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
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
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
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
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
        <p className="mt-2 text-sm text-slate-500">
          {copy.noCollectionInvoice}
        </p>
      )}
    </div>
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
      className="mt-4 grid gap-3 border-t border-slate-200 pt-4 md:grid-cols-2 dark:border-slate-800"
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
        <p className="text-xs text-slate-500">{copy.offlinePaymentHelp}</p>
      </div>
      <TextField
        label={copy.sourceAmount}
        value={amount}
        onChange={(value) => updateDraft(() => setAmount(value))}
        required
        inputMode="decimal"
        pattern="^\d{1,14}(?:\.\d{1,4})?$"
      />
      <TextField
        label={copy.currency}
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
        value={reference}
        onChange={(value) => updateDraft(() => setReference(value))}
        required
        maxLength={128}
      />
      <TextField
        label={copy.auditNote}
        value={note}
        onChange={(value) => updateDraft(() => setNote(value))}
        maxLength={500}
      />
      <label className="flex items-center gap-2 text-xs text-slate-600 md:col-span-2">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        {copy.confirmOfflinePayment}
      </label>
      <div className="md:col-span-2">
        <button
          className="danger-button"
          disabled={
            !confirmed ||
            !amount ||
            !reference.trim() ||
            Boolean(workspace.mutation.name)
          }
        >
          {copy.recordOfflinePayment}
        </button>
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
          ? "rounded-lg bg-white/70 p-2 dark:bg-slate-900/50"
          : "rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
      }
    >
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 break-words font-medium text-slate-950 dark:text-white">
        {value}
      </p>
    </div>
  );
}

function StateCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
      {children}
    </div>
  );
}

function ErrorNotice({
  error,
  lang,
}: {
  error: { message: string; errorCode: string; correlationId?: string } | null;
  lang: "ar" | "en";
}) {
  if (!error) return null;
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
    >
      <p className="font-medium">{error.message}</p>
      <p className="mt-1 font-mono text-xs">
        {error.errorCode}
        {error.correlationId
          ? ` · ${lang === "ar" ? "معرّف الارتباط" : "Correlation"}: ${error.correlationId}`
          : ""}
      </p>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  ...inputProps
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type"
>) {
  return (
    <label className="space-y-1 text-sm">
      <span>{label}</span>
      <input
        {...inputProps}
        type={type}
        className="field w-full"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
}) {
  return (
    <label className="space-y-1 text-sm">
      <span>{label}</span>
      <select
        className="field w-full"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Pager({
  page,
  hasPrev,
  hasNext,
  onPage,
  lang,
}: {
  page: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPage: (page: number) => void;
  lang: "ar" | "en";
}) {
  const copy = billingCopy[lang];
  return (
    <div className="mt-3 flex items-center justify-end gap-2">
      <button
        type="button"
        className="secondary-button"
        disabled={!hasPrev}
        onClick={() => onPage(Math.max(1, page - 1))}
      >
        {copy.previous}
      </button>
      <span className="text-xs text-slate-500">
        {copy.page} {page}
      </span>
      <button
        type="button"
        className="secondary-button"
        disabled={!hasNext}
        onClick={() => onPage(page + 1)}
      >
        {copy.next}
      </button>
    </div>
  );
}

function formatDate(value: string | null, lang: "ar" | "en"): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-GB", {
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
