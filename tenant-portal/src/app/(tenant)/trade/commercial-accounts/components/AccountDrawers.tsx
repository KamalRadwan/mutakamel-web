"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Lock,
  Pencil,
  ShieldAlert,
  SlidersHorizontal,
} from "lucide-react";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FormDrawer,
  IdentifierText,
  Input,
  Money,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  SWATCH_SURFACE_PALETTES,
  Textarea,
  cn,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDateTime } from "@/lib/format/date";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import {
  ACCOUNT_KNOWN_STATUSES,
  ACCOUNT_ROLES,
  EMPTY_ACCOUNT_FORM,
  isAccountRole,
  toAccountForm,
  type AccountFormValues,
  type AccountRole,
  type CommercialAccount,
} from "../commercial-account-contract";
import {
  ACCOUNT_ROLE_PALETTES,
  ACCOUNT_UI_COPY,
  ISO_CURRENCY_PRESETS,
  getRolePaletteDescription,
  parseVisualTerms,
  serializeVisualTerms,
} from "../commercial-account-metadata";
import {
  useCommercialAccountLookups,
  type CommercialAccountLookupsData,
} from "../hooks/useCommercialAccountLookups";
import { useAccountPriceBooks } from "../hooks/useAccountPriceBooks";

interface AccountDrawerProps {
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: AccountFormValues) => Promise<boolean>;
}

function useDrawerLabels() {
  const { t } = useI18n();
  return {
    submit: t.trade.save,
    cancel: t.common.cancel,
    discardTitle: t.common.discardTitle,
    discardDescription: t.common.discardDescription,
    discardConfirm: t.common.discardConfirm,
    discardCancel: t.common.cancel,
  };
}

function AccountFields({
  values,
  onChange,
  isSubmitting,
  isEdit,
  lookups,
}: {
  values: AccountFormValues;
  onChange: (patch: Partial<AccountFormValues>) => void;
  isSubmitting: boolean;
  isEdit: boolean;
  lookups: CommercialAccountLookupsData;
}) {
  const { t, lang } = useI18n();
  const copy = ACCOUNT_UI_COPY[lang];
  const [showAdvancedJson, setShowAdvancedJson] = useState(false);
  const priceBooks = useAccountPriceBooks(values.accountRole);

  const isSupplier = values.accountRole === "SUPPLIER";
  const visualTerms = parseVisualTerms(values.terms);

  function updateVisualTerms(next: Partial<typeof visualTerms>) {
    const merged = { ...visualTerms, ...next };
    onChange({ terms: serializeVisualTerms(merged) });
  }

  function toggleAllowedCurrency(code: string) {
    const exists = visualTerms.allowedCurrencies.includes(code);
    const nextCurrencies = exists
      ? visualTerms.allowedCurrencies.filter((c) => c !== code)
      : [...visualTerms.allowedCurrencies, code];
    updateVisualTerms({ allowedCurrencies: nextCurrencies });
  }

  return (
    <div className="flex flex-col gap-4">
      <Field
        label={t.trade.accountParty}
        hint={t.trade.accountPartyHint}
        readOnly={isEdit}
        required={!isEdit}
      >
        <Input
          size="sm"
          placeholder={t.trade.accountParty}
          dir="ltr"
          className="font-mono"
          value={values.partyId}
          onChange={(event) => onChange({ partyId: event.target.value })}
          disabled={isSubmitting}
          readOnly={isEdit}
          required={!isEdit}
        />
      </Field>

      {/* `UpdateCommercialAccountDto` carries no `accountRole`: one account per
          party per role, fixed at creation. */}
      <Field label={t.trade.accountRole} readOnly={isEdit} required>
        <Select
          value={values.accountRole}
          onValueChange={(next) => {
            const role = next as AccountRole;
            onChange({
              accountRole: role,
              ...(role === "SUPPLIER" ? { creditLimit: "" } : {}),
            });
          }}
          disabled={isSubmitting || isEdit}
        >
          <SelectTrigger size="sm" aria-label={t.trade.accountRole} aria-readonly={isEdit}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACCOUNT_ROLES.map((role) => (
              <SelectItem key={role} value={role}>
                {t.trade[`accountRole_${role}`]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {/* Visual Role Selector Cards */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ACCOUNT_ROLES.map((role) => {
          const palette = ACCOUNT_ROLE_PALETTES[role];
          const selected = values.accountRole === role;
          return (
            <Button
              key={role}
              type="button"
              variant="outline"
              disabled={isSubmitting || isEdit}
              onClick={() =>
                onChange({
                  accountRole: role,
                  ...(role === "SUPPLIER" ? { creditLimit: "" } : {}),
                })
              }
              className={cn(
                "h-auto flex-col items-start justify-start gap-1 rounded-lg border p-3 text-start whitespace-normal transition-all",
                selected
                  ? cn("bg-card shadow-xs ring-2 ring-primary/20", palette.cardBorderClass)
                  : "border-border bg-card/60 opacity-80 hover:bg-muted/40",
                isEdit && !selected && "opacity-45",
              )}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-semibold",
                    palette.badgeClass,
                  )}
                >
                  <span className={cn("size-1.5 rounded-full", palette.dotClass)} />
                  {t.trade[`accountRole_${role}`]}
                </span>
                {selected && (
                  <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
                )}
              </div>
              <p className="mt-1 text-xs font-normal leading-snug text-muted-foreground">
                {getRolePaletteDescription(palette, lang)}
              </p>
            </Button>
          );
        })}
      </div>

      {/* Credit Limit & Currency Section */}
      <div className="rounded-lg border border-border bg-muted/20 p-3.5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <CreditCard className="size-3.5 text-primary" aria-hidden="true" />
            {copy.creditControlsTitle}
          </span>
          {isSupplier && (
            <Badge tone="caution">
              <Lock className="me-1 size-3" aria-hidden="true" />
              {copy.lockedForSupplierBadge}
            </Badge>
          )}
        </div>

        {isSupplier && (
          <p
            className={cn(
              "mb-3 rounded-md border px-2.5 py-1.5 text-xs",
              SWATCH_SURFACE_PALETTES.amber.sectionCard,
            )}
          >
            {copy.supplierCreditLockNotice}
          </p>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t.trade.accountCreditLimit} hint={t.trade.accountCreditLimitHint}>
            <Input
              size="sm"
              placeholder={isSupplier ? "—" : t.trade.accountCreditLimit}
              dir="ltr"
              inputMode="decimal"
              className="tabular-nums"
              value={isSupplier ? "" : values.creditLimit}
              onChange={(event) => onChange({ creditLimit: event.target.value })}
              disabled={isSubmitting || isSupplier}
              readOnly={isSupplier}
            />
          </Field>

          <Field label={t.trade.accountCurrency} hint={t.trade.accountCurrencyHint}>
            <Input
              size="sm"
              placeholder={t.trade.accountCurrency}
              dir="ltr"
              value={values.creditCurrencyCode}
              onChange={(event) =>
                onChange({ creditCurrencyCode: event.target.value.toUpperCase() })
              }
              maxLength={3}
              disabled={isSubmitting}
            />
            <div className="mt-1.5 flex flex-wrap gap-1">
              {ISO_CURRENCY_PRESETS.map((preset) => {
                const active = values.creditCurrencyCode.toUpperCase() === preset.code;
                return (
                  <Button
                    key={preset.code}
                    type="button"
                    size="xs"
                    variant={active ? "primary" : "outline"}
                    disabled={isSubmitting}
                    onClick={() => onChange({ creditCurrencyCode: preset.code })}
                    className="px-1.5 py-0.5 font-mono text-xs font-semibold"
                  >
                    {preset.code}
                  </Button>
                );
              })}
            </div>
          </Field>
        </div>
      </div>

      {/* Lookups-backed Reference Pointers */}
      <div className="grid grid-cols-1 gap-3">
        <Field label={t.trade.accountPaymentTerms}>
          <Input
            size="sm"
            placeholder={t.trade.accountPaymentTerms}
            dir="ltr"
            className="font-mono"
            value={values.paymentTermsId}
            onChange={(event) => onChange({ paymentTermsId: event.target.value })}
            disabled={isSubmitting}
          />
          {lookups.paymentTerms.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              <span className="text-xs text-muted-foreground">{copy.availablePaymentTerms}</span>
              {lookups.paymentTerms.slice(0, 4).map((pt) => (
                <Button
                  key={pt.id}
                  type="button"
                  size="xs"
                  variant={values.paymentTermsId === pt.id ? "primary" : "outline"}
                  disabled={isSubmitting}
                  onClick={() => onChange({ paymentTermsId: pt.id })}
                  className="px-1.5 py-0.5 font-mono text-xs"
                >
                  {pt.id.slice(0, 8)}…
                </Button>
              ))}
            </div>
          )}
        </Field>

        <Field
          label={t.trade.accountPriceBook}
          hint={t.trade.accountPriceBookPurposeHint}
        >
          <Input
            size="sm"
            placeholder={t.trade.accountPriceBook}
            dir="ltr"
            className="font-mono"
            value={values.priceBookId}
            onChange={(event) => onChange({ priceBookId: event.target.value })}
            disabled={isSubmitting}
          />
          {priceBooks.unavailable && (
            <p className="mt-1.5 text-xs text-muted-foreground">{t.trade.accountPriceBookLookupUnavailable}</p>
          )}
          {priceBooks.books.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              <span className="text-xs text-muted-foreground">{t.trade.accountPriceBookSuggestions}</span>
              {priceBooks.books.slice(0, 4).map((book) => (
                <Button
                  key={book.id}
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={() => onChange({ priceBookId: book.id })}
                >
                  {book.code} ({book.currencyCode})
                </Button>
              ))}
            </div>
          )}
        </Field>

        <Field label={t.trade.accountCreditPolicy}>
          <Input
            size="sm"
            placeholder={t.trade.accountCreditPolicy}
            dir="ltr"
            className="font-mono"
            value={values.creditPolicyVersionId}
            onChange={(event) => onChange({ creditPolicyVersionId: event.target.value })}
            disabled={isSubmitting}
          />
          {lookups.creditPolicies.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              <span className="text-xs text-muted-foreground">
                {copy.publishedCreditPolicies}
              </span>
              {lookups.creditPolicies.slice(0, 4).map((cp) => (
                <Button
                  key={cp.id}
                  type="button"
                  size="xs"
                  variant={values.creditPolicyVersionId === cp.id ? "primary" : "outline"}
                  disabled={isSubmitting}
                  onClick={() => onChange({ creditPolicyVersionId: cp.id })}
                  className="px-2 py-0.5 text-xs"
                >
                  {cp.code} (v{cp.versionNumber})
                </Button>
              ))}
            </div>
          )}
        </Field>
      </div>

      {/* Visual Commercial Terms Builder */}
      <div className="rounded-lg border border-border bg-muted/20 p-3.5">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <SlidersHorizontal className="size-3.5 text-primary" aria-hidden="true" />
            {t.trade.accountTerms}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => setShowAdvancedJson((prev) => !prev)}
            className="text-xs font-medium text-primary"
          >
            {showAdvancedJson ? copy.hideAdvancedTerms : copy.showAdvancedTerms}
          </Button>
        </div>

        <div className="flex flex-col gap-3">
          {/* Ordering Hold Switch */}
          <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-2.5">
            <div>
              <p className="text-xs font-semibold text-foreground">
                {t.trade.creditOrderingHold}
              </p>
              <p className="text-xs text-muted-foreground">{copy.orderingHoldDesc}</p>
            </div>
            <Switch
              checked={visualTerms.orderingHold}
              disabled={isSubmitting}
              onCheckedChange={(checked) => updateVisualTerms({ orderingHold: checked })}
            />
          </div>

          {/* Allowed Currencies Multi-Chip Selector */}
          <div className="rounded-md border border-border bg-card p-2.5">
            <p className="text-xs font-semibold text-foreground">{copy.allowedCurrenciesTitle}</p>
            <p className="mb-2 text-xs text-muted-foreground">{copy.allowedCurrenciesDesc}</p>
            <div className="flex flex-wrap gap-1.5">
              {ISO_CURRENCY_PRESETS.map((preset) => {
                const selected = visualTerms.allowedCurrencies.includes(preset.code);
                return (
                  <Button
                    key={preset.code}
                    type="button"
                    size="xs"
                    variant="outline"
                    disabled={isSubmitting}
                    onClick={() => toggleAllowedCurrency(preset.code)}
                    className={cn(
                      "gap-1 text-xs font-semibold",
                      selected && SWATCH_SURFACE_PALETTES.green.badge,
                    )}
                  >
                    <span>{preset.code}</span>
                    {selected && <CheckCircle2 className="size-3" aria-hidden="true" />}
                  </Button>
                );
              })}
            </div>
          </div>

          {showAdvancedJson && (
            <Field label={t.trade.accountTerms} hint={t.trade.accountTermsHint}>
              <Textarea
                placeholder={t.trade.accountTerms}
                dir="ltr"
                className="font-mono text-xs"
                value={values.terms}
                onChange={(event) => onChange({ terms: event.target.value })}
                disabled={isSubmitting}
              />
            </Field>
          )}
        </div>
      </div>
    </div>
  );
}

export function CreateAccountDrawer({
  isOpen,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: AccountDrawerProps & { isOpen: boolean }) {
  const { t } = useI18n();
  const labels = useDrawerLabels();
  const [values, setValues] = useState<AccountFormValues>(EMPTY_ACCOUNT_FORM);
  const { lookups } = useCommercialAccountLookups(isOpen);

  return (
    <FormDrawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setValues(EMPTY_ACCOUNT_FORM);
          onClose();
        }
      }}
      title={t.trade.accountCreateTitle}
      description={t.trade.accountCreateDescription}
      isDirty={JSON.stringify(values) !== JSON.stringify(EMPTY_ACCOUNT_FORM)}
      isSubmitting={isSubmitting}
      onSubmit={() => {
        void onSubmit(values).then((saved) => {
          if (saved) setValues(EMPTY_ACCOUNT_FORM);
        });
      }}
      error={error ?? undefined}
      labels={labels}
    >
      <AccountFields
        values={values}
        onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
        isSubmitting={isSubmitting}
        isEdit={false}
        lookups={lookups}
      />
    </FormDrawer>
  );
}

export function EditAccountDrawer({
  account,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: AccountDrawerProps & { account: CommercialAccount }) {
  const { t } = useI18n();
  const labels = useDrawerLabels();
  const initial = toAccountForm(account);
  const [values, setValues] = useState<AccountFormValues>(initial);
  const { lookups } = useCommercialAccountLookups(true);

  return (
    <FormDrawer
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t.trade.accountEditTitle}
      description={t.trade.accountEditDescription}
      isDirty={JSON.stringify(values) !== JSON.stringify(initial)}
      isSubmitting={isSubmitting}
      onSubmit={() => void onSubmit(values)}
      error={error ?? undefined}
      labels={labels}
    >
      <AccountFields
        values={values}
        onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
        isSubmitting={isSubmitting}
        isEdit
        lookups={lookups}
      />
    </FormDrawer>
  );
}

export function AccountInspectModal({
  account,
  canManage,
  onClose,
  onEdit,
}: {
  account: CommercialAccount | null;
  canManage: boolean;
  onClose: () => void;
  onEdit: (account: CommercialAccount) => void;
}) {
  const { t, lang } = useI18n();
  const copy = ACCOUNT_UI_COPY[lang];
  if (!account) return null;

  const role = isAccountRole(account.accountRole) ? account.accountRole : "CUSTOMER";
  const palette = ACCOUNT_ROLE_PALETTES[role];
  const isKnownStatus = (ACCOUNT_KNOWN_STATUSES as readonly string[]).includes(account.status);
  const visualTerms = parseVisualTerms(JSON.stringify(account.terms ?? {}));

  return (
    <Dialog
      open={account !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent size="2xl" closeLabel={t.common.close}>
        <div className={cn("-mx-3.5 -mt-3.5 mb-2 h-2 rounded-t-lg", palette.topAccentClass)} />
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={account.status === "ACTIVE" ? "positive" : "negative"}>
              {isKnownStatus
                ? t.trade[`accountStatus_${account.status as "ACTIVE" | "BLOCKED"}`]
                : account.status}
            </Badge>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold",
                palette.badgeClass,
              )}
            >
              <span className={cn("size-1.5 rounded-full", palette.dotClass)} />
              {isAccountRole(account.accountRole)
                ? t.trade[`accountRole_${account.accountRole}`]
                : account.accountRole}
            </span>
            <Badge tone="neutral">
              <IdentifierText>v{account.version}</IdentifierText>
            </Badge>
          </div>
          <DialogTitle className="mt-1 flex items-center gap-2">
            <Building2 className="size-4 text-primary" aria-hidden="true" />
            <IdentifierText className="text-sm font-semibold">{account.partyId}</IdentifierText>
          </DialogTitle>
          <DialogDescription>{getRolePaletteDescription(palette, lang)}</DialogDescription>
        </DialogHeader>

        {account.status === "BLOCKED" && account.blockReasonCode && (
          <div
            className={cn(
              "flex items-center gap-2.5 rounded-lg border p-3 text-xs",
              SWATCH_SURFACE_PALETTES.red.sectionCard,
            )}
          >
            <ShieldAlert
              className={cn("size-4 shrink-0", SWATCH_SURFACE_PALETTES.red.iconText)}
              aria-hidden="true"
            />
            <div>
              <span className="font-semibold">{t.trade.accountBlockReason}: </span>
              <IdentifierText className="font-semibold">{account.blockReasonCode}</IdentifierText>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-muted/25 p-3.5 sm:grid-cols-2">
          <div>
            <span className="text-xs font-medium text-muted-foreground">
              {t.trade.accountCreditLimit}
            </span>
            <p className="mt-0.5 text-sm font-semibold text-foreground">
              {account.creditLimit === null ? (
                t.trade.creditUnlimited
              ) : (
                <Money
                  value={account.creditLimit}
                  currency={account.creditCurrencyCode ?? undefined}
                />
              )}
            </p>
          </div>
          <div>
            <span className="text-xs font-medium text-muted-foreground">
              {t.trade.accountCurrency}
            </span>
            <p className="mt-0.5 text-sm font-semibold text-foreground">
              {account.creditCurrencyCode ?? "—"}
            </p>
          </div>
          <div>
            <span className="text-xs font-medium text-muted-foreground">
              {t.trade.creditOrderingHold}
            </span>
            <p className="mt-0.5 text-sm font-semibold text-foreground">
              <Badge tone={visualTerms.orderingHold ? "caution" : "positive"}>
                {visualTerms.orderingHold ? t.common.active : t.common.inactive}
              </Badge>
            </p>
          </div>
          <div>
            <span className="text-xs font-medium text-muted-foreground">
              {t.trade.updatedAt}
            </span>
            <p className="mt-0.5 text-xs font-medium text-foreground">
              {formatDateTime(account.updatedAt, lang)}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            {t.common.close}
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`${TENANT_ROUTES.tradeCommercialAccounts}/${account.id}`}>
              <ExternalLink className="size-3.5" aria-hidden="true" />
              {copy.fullAccountDossier}
            </Link>
          </Button>
          {canManage && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                onClose();
                onEdit(account);
              }}
            >
              <Pencil className="size-3.5" aria-hidden="true" />
              {t.trade.accountEditTitle}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
