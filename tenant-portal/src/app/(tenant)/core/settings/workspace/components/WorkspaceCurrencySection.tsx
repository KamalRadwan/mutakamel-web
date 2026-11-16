"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DegradedBanner,
  ErrorState,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { Language } from "@/i18n/useLanguage";
import type { NormalizedApiError } from "@/lib/api/errors";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import type { CurrencyOption } from "../currency-options";
import type { WorkspaceFieldName } from "../hooks/useWorkspaceSettings";
import {
  describeCurrencyOptionsFailure,
  type WorkspaceQueryFailure,
} from "../workspace-errors";
import {
  CURRENCY_CODE_LENGTH,
  type WorkspaceSettings,
  type WorkspaceSettingsDraft,
} from "../workspace-settings-contract";

interface WorkspaceCurrencySectionProps {
  t: Dictionary;
  lang: Language;
  settings: WorkspaceSettings | null;
  draft: WorkspaceSettingsDraft;
  currencyOptions: readonly CurrencyOption[];
  currenciesTotal: number;
  isCurrenciesTruncated: boolean;
  canReadCurrencies: boolean;
  isLoadingCurrencies: boolean;
  currencyLoadFailure: WorkspaceQueryFailure | null;
  describeError: (error: NormalizedApiError | null) => string | undefined;
  isReadOnly: boolean;
  isSaving: boolean;
  fieldError: { field: WorkspaceFieldName; message: string } | null;
  onRetryCurrencies: () => void;
  onUpdateDraft: (patch: Partial<WorkspaceSettingsDraft>) => void;
}

export function WorkspaceCurrencySection({
  t,
  lang,
  settings,
  draft,
  currencyOptions,
  currenciesTotal,
  isCurrenciesTruncated,
  canReadCurrencies,
  isLoadingCurrencies,
  currencyLoadFailure,
  describeError,
  isReadOnly,
  isSaving,
  fieldError,
  onRetryCurrencies,
  onUpdateDraft,
}: WorkspaceCurrencySectionProps) {
  const wsUi = t.coreSettings.workspaceUi;
  const hasCurrencyError = fieldError?.field === "defaultCurrencyCode";

  const selectableCurrencies = useMemo<readonly CurrencyOption[]>(() => {
    if (currencyOptions.length === 0) return currencyOptions;
    const extras: CurrencyOption[] = [];
    const seen = new Set(currencyOptions.map((item) => item.code));
    for (const candidate of [settings?.defaultCurrencyCode, draft.defaultCurrencyCode]) {
      const normalized = candidate?.trim().toUpperCase();
      if (normalized && normalized.length === CURRENCY_CODE_LENGTH && !seen.has(normalized)) {
        seen.add(normalized);
        extras.push({ code: normalized, name: normalized });
      }
    }
    return extras.length > 0 ? [...extras, ...currencyOptions] : currencyOptions;
  }, [currencyOptions, settings?.defaultCurrencyCode, draft.defaultCurrencyCode]);

  const failureCopy = useMemo(
    () =>
      canReadCurrencies && currencyLoadFailure
        ? describeCurrencyOptionsFailure(currencyLoadFailure, t, describeError)
        : null,
    [canReadCurrencies, currencyLoadFailure, t, describeError],
  );

  const truncatedNotice = useMemo(() => {
    if (!canReadCurrencies || failureCopy || !isCurrenciesTruncated || currencyOptions.length === 0) {
      return null;
    }
    const range = formatTemplate(t.common.showingOf, {
      from: formatNumber(1, lang),
      to: formatNumber(currencyOptions.length, lang),
      total: formatNumber(Math.max(currenciesTotal, currencyOptions.length), lang),
    });
    return `${t.coreSettings.currenciesTitle}: ${range}`;
  }, [
    canReadCurrencies,
    failureCopy,
    isCurrenciesTruncated,
    currencyOptions.length,
    t.common.showingOf,
    t.coreSettings.currenciesTitle,
    lang,
    currenciesTotal,
  ]);

  const currencyHint =
    selectableCurrencies.length > 0 || isReadOnly
      ? t.coreSettings.workspaceCurrencyHint
      : t.coreSettings.workspaceCurrencyManualHint;

  return (
    <Card className={cn(hasCurrencyError && "border-destructive/50")}>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-card-title">
          {t.coreSettings.workspaceCurrencySectionTitle}
        </CardTitle>
        {canReadCurrencies ? (
          <Button asChild size="xs" variant="outline">
            <Link href={TENANT_ROUTES.coreSettingsCurrencies}>
              <span>{wsUi.manageCurrenciesCta}</span>
              <ArrowUpRight className="size-3.5 rtl:-scale-x-100" aria-hidden="true" />
            </Link>
          </Button>
        ) : null}
      </CardHeader>

      <CardContent className="flex flex-col gap-3.5">
        {failureCopy ? (
          <ErrorState
            title={failureCopy.title}
            description={failureCopy.description}
            onRetry={failureCopy.retryable ? onRetryCurrencies : undefined}
            retryLabel={t.common.retry}
          />
        ) : null}

        {truncatedNotice ? <DegradedBanner message={truncatedNotice} /> : null}

        <Field
          showLabel
          label={t.coreSettings.workspaceCurrency}
          hint={currencyHint}
          error={hasCurrencyError ? fieldError.message : undefined}
          readOnly={isReadOnly}
        >
          {selectableCurrencies.length > 0 ? (
            <Select
              value={draft.defaultCurrencyCode}
              onValueChange={(value) => onUpdateDraft({ defaultCurrencyCode: value })}
              disabled={isReadOnly || isSaving}
            >
              <SelectTrigger size="sm">
                <SelectValue placeholder={t.coreSettings.workspaceCurrencyPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {selectableCurrencies.map((currency) => (
                  <SelectItem key={currency.code} value={currency.code}>
                    {formatCurrencySelectLabel(currency)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              size="sm"
              value={draft.defaultCurrencyCode}
              placeholder={t.coreSettings.workspaceCurrencyPlaceholder}
              onChange={(event) =>
                onUpdateDraft({ defaultCurrencyCode: event.target.value.toUpperCase() })
              }
              maxLength={CURRENCY_CODE_LENGTH}
              disabled={isSaving || isLoadingCurrencies}
              readOnly={isReadOnly}
              dir="ltr"
              className="font-mono uppercase"
            />
          )}
        </Field>
      </CardContent>
    </Card>
  );
}

function formatCurrencySelectLabel(currency: CurrencyOption): string {
  const code = currency.code.trim();
  const codeUpper = code.toUpperCase();
  const name = currency.name.trim();
  const hasDistinctName = name.length > 0 && name.toUpperCase() !== codeUpper;
  const rawSymbol = currency.symbol?.trim() ?? "";
  const hasDistinctSymbol =
    rawSymbol.length > 0 &&
    rawSymbol.toUpperCase() !== codeUpper &&
    (!hasDistinctName || rawSymbol.toLocaleLowerCase() !== name.toLocaleLowerCase());

  if (!hasDistinctName) {
    return hasDistinctSymbol ? `${code} (${rawSymbol})` : code;
  }

  return hasDistinctSymbol
    ? `${name} (${code} · ${rawSymbol})`
    : `${name} (${code})`;
}
