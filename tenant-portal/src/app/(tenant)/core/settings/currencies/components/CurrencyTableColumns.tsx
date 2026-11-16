"use client";

import { Ban, MoreHorizontal, Pencil, RotateCcw, Star } from "lucide-react";
import {
  Badge,
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IdentifierText,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  type ColumnDef,
} from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { Language } from "@/i18n/I18nContext";
import { formatDecimalString } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { formatCurrencyLabel, type Currency } from "../currency-contract";

interface BuildCurrencyColumnsOptions {
  t: Dictionary;
  lang: Language;
  canManage: boolean;
  pendingId: string | null;
  baseCurrencyCode: string | null;
  onEdit: (currency: Currency) => void;
  onSetDefault: (currency: Currency) => void;
  onDeactivate: (currency: Currency) => void;
  onReactivate: (currency: Currency) => void;
}

export function buildCurrencyColumns({
  t,
  lang,
  canManage,
  pendingId,
  baseCurrencyCode,
  onEdit,
  onSetDefault,
  onDeactivate,
  onReactivate,
}: BuildCurrencyColumnsOptions): ColumnDef<Currency>[] {
  const rateHeader = baseCurrencyCode
    ? formatTemplate(t.coreSettings.currencyExchangeRatePerBase, { code: baseCurrencyCode })
    : t.coreSettings.currencyExchangeRate;

  return [
    {
      id: "name",
      sortable: true,
      header: t.coreSettings.currencyName,
      cell: (currency) => {
        const trimmedSymbol = currency.symbol?.trim() ?? "";
        const distinctSymbol =
          trimmedSymbol.length > 0 && trimmedSymbol !== currency.code ? trimmedSymbol : null;
        return (
          <span className="flex items-center gap-2">
            <bdi className="text-foreground">{currency.name}</bdi>
            {distinctSymbol ? (
              <bdi className="text-xs text-muted-foreground">{distinctSymbol}</bdi>
            ) : null}
          </span>
        );
      },
    },
    {
      id: "code",
      sortable: true,
      header: t.coreSettings.currencyCode,
      cell: (currency) => (
        <IdentifierText className="text-foreground">{currency.code}</IdentifierText>
      ),
    },
    {
      id: "rate",
      sortField: "exchangeRate",
      sortable: true,
      header: rateHeader,
      align: "end",
      numeric: true,
      // `numeric(18,8)` arrives as an exact string and is formatted with fixed 8
      // fractional digits, never coerced through `Number()`.
      cell: (currency) =>
        currency.exchangeRate === null ? (
          "—"
        ) : (
          <bdi dir="ltr">
            {formatDecimalString(currency.exchangeRate, lang, {
              minimumFractionDigits: 8,
              maximumFractionDigits: 8,
            })}
          </bdi>
        ),
    },
    {
      id: "status",
      header: t.common.status,
      cell: (currency) => {
        const isRowPending = pendingId === currency.id;
        if (currency.isDefault) {
          return (
            <Badge tone="brand" size="sm">
              {isRowPending ? (
                <span
                  aria-hidden="true"
                  className="dot-pending size-1.5 shrink-0 rounded-full bg-muted-foreground"
                />
              ) : null}
              <span>{t.coreSettings.currencyDefault}</span>
            </Badge>
          );
        }
        const isActive = currency.status === "ACTIVE";
        return (
          <Badge
            tone={isActive ? "positive" : "negative"}
            size="sm"
            className="gap-1.5 bg-transparent px-0 font-medium"
          >
            <span
              aria-hidden="true"
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                isRowPending
                  ? "dot-pending bg-muted-foreground"
                  : isActive
                    ? "bg-success-vivid"
                    : "bg-destructive-vivid",
              )}
            />
            <span>{isActive ? t.common.active : t.common.inactive}</span>
          </Badge>
        );
      },
    },
    ...(canManage
      ? [
          {
            id: "actions",
            header: t.common.actions,
            align: "end" as const,
            sticky: "end" as const,
            cell: (currency: Currency) => (
              <CurrencyRowActions
                currency={currency}
                t={t}
                pendingId={pendingId}
                onEdit={onEdit}
                onSetDefault={onSetDefault}
                onDeactivate={onDeactivate}
                onReactivate={onReactivate}
              />
            ),
          },
        ]
      : []),
  ];
}

function CurrencyRowActions({
  currency,
  t,
  pendingId,
  onEdit,
  onSetDefault,
  onDeactivate,
  onReactivate,
}: {
  currency: Currency;
  t: Dictionary;
  pendingId: string | null;
  onEdit: (currency: Currency) => void;
  onSetDefault: (currency: Currency) => void;
  onDeactivate: (currency: Currency) => void;
  onReactivate: (currency: Currency) => void;
}) {
  const label = formatCurrencyLabel(currency);
  const busy = pendingId !== null;
  const rowBusy = pendingId === currency.id;
  const isInactiveNonDefault = currency.status === "INACTIVE" && !currency.isDefault;

  return (
    <span className="flex items-center justify-end gap-1">
      {isInactiveNonDefault ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`${t.coreSettings.reactivate}: ${label}`}
          disabled={busy}
          loading={rowBusy}
          onClick={() => onReactivate(currency)}
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
          {t.coreSettings.reactivate}
        </Button>
      ) : null}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`${t.coreSettings.currencyEditTitle}: ${label}`}
            disabled={busy}
            onClick={() => onEdit(currency)}
          >
            <Pencil className="size-3.5" aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{`${t.coreSettings.currencyEditTitle}: ${label}`}</TooltipContent>
      </Tooltip>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`${t.common.actions}: ${label}`}
            disabled={busy}
            loading={rowBusy && !isInactiveNonDefault}
          >
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={busy} onSelect={() => onEdit(currency)}>
            <Pencil className="size-3.5" aria-hidden="true" />
            {t.coreSettings.currencyEditTitle}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={busy || currency.isDefault || currency.status !== "ACTIVE"}
            onSelect={() => onSetDefault(currency)}
          >
            <Star className="size-3.5" aria-hidden="true" />
            {t.coreSettings.currencySetDefault}
          </DropdownMenuItem>
          {isInactiveNonDefault ? (
            <DropdownMenuItem disabled={busy} onSelect={() => onReactivate(currency)}>
              <RotateCcw className="size-3.5" aria-hidden="true" />
              {t.coreSettings.reactivate}
            </DropdownMenuItem>
          ) : null}
          {currency.status === "ACTIVE" ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                disabled={busy || currency.isDefault}
                onSelect={() => onDeactivate(currency)}
              >
                <Ban className="size-3.5" aria-hidden="true" />
                {t.coreSettings.deactivate}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}
