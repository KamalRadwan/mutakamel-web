"use client";

import { Ban, Pencil, RotateCcw } from "lucide-react";
import {
  Badge,
  Button,
  IdentifierText,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
  iconSize,
  type ColumnDef,
} from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { Language } from "@/i18n/I18nContext";
import { formatDecimalString } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { companyLabel, type CompanyOption } from "../../company-options";
import type { Tax } from "../tax-contract";

interface BuildTaxColumnsOptions {
  t: Dictionary;
  lang: Language;
  companies: readonly CompanyOption[];
  canManage: boolean;
  canManageScope: (companyId: string | null) => boolean;
  isBusy: boolean;
  pendingId: string | null;
  onEdit: (tax: Tax) => void;
  onDeactivate: (tax: Tax) => void;
  onReactivate: (tax: Tax) => void;
}

export function buildTaxColumns({
  t,
  lang,
  companies,
  canManage,
  canManageScope,
  isBusy,
  pendingId,
  onEdit,
  onDeactivate,
  onReactivate,
}: BuildTaxColumnsOptions): ColumnDef<Tax>[] {
  return [
    {
      id: "name",
      sortable: true,
      header: t.coreSettings.taxName,
      cell: (tax) => (
        <span className="text-foreground">
          <bdi>{tax.name}</bdi>
        </span>
      ),
    },
    {
      id: "code",
      sortable: true,
      header: t.coreSettings.taxCode,
      cell: (tax) => <IdentifierText>{tax.code}</IdentifierText>,
    },
    {
      id: "rate",
      sortable: true,
      header: t.coreSettings.taxRate,
      align: "end",
      numeric: true,
      // `numeric(7,4)` arrives as an exact string and is already a percentage
      // value (0–100), so `style: "percent"` would multiply it by 100 again.
      cell: (tax) => (
        <span dir="ltr" className="tabular-nums text-foreground">
          {formatTemplate(t.coreSettings.taxRateValue, {
            rate: formatDecimalString(tax.rate, lang, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 4,
            }),
          })}
        </span>
      ),
    },
    {
      id: "inclusive",
      header: t.coreSettings.taxInclusive,
      cell: (tax) => (
        <Badge size="sm" tone="neutral">
          {tax.isInclusive ? t.coreSettings.taxInclusiveYes : t.coreSettings.taxInclusiveNo}
        </Badge>
      ),
    },
    {
      id: "scope",
      header: t.coreSettings.taxCompany,
      cell: (tax) => (
        <span className="text-foreground">
          <bdi>
            {companyLabel(
              companies,
              tax.companyId,
              t.coreSettings.taxTenantWide,
              t.coreSettings.unknownCompany,
            )}
          </bdi>
        </span>
      ),
    },
    {
      id: "status",
      header: t.common.status,
      cell: (tax) => (
        <Badge size="sm" tone={tax.status === "ACTIVE" ? "positive" : "negative"}>
          <span
            aria-hidden="true"
            className={cn(
              "size-1.5 shrink-0 rounded-full",
              pendingId === tax.id
                ? "dot-pending bg-muted-foreground"
                : tax.status === "ACTIVE"
                  ? "bg-success-vivid"
                  : "bg-destructive-vivid",
            )}
          />
          <span>{tax.status === "ACTIVE" ? t.common.active : t.common.inactive}</span>
        </Badge>
      ),
    },
    ...(canManage
      ? [
          {
            id: "actions",
            header: t.common.actions,
            align: "end" as const,
            sticky: "end" as const,
            cell: (tax: Tax) => {
              if (!canManageScope(tax.companyId)) return null;
              const rowLabel = `${tax.name} (${tax.code})`;
              const isRowPending = pendingId === tax.id;
              return (
                <span
                  className="flex items-center justify-end gap-1"
                  aria-busy={isRowPending || undefined}
                >
                  <RowAction
                    label={`${t.coreSettings.taxEditTitle}: ${rowLabel}`}
                    disabled={isBusy}
                    onClick={() => onEdit(tax)}
                  >
                    <Pencil className={iconSize({ size: "sm" })} aria-hidden="true" />
                  </RowAction>
                  {tax.status === "ACTIVE" ? (
                    <RowAction
                      label={`${t.coreSettings.deactivate}: ${rowLabel}`}
                      disabled={isBusy}
                      loading={isRowPending}
                      onClick={() => onDeactivate(tax)}
                    >
                      <Ban
                        className={cn(iconSize({ size: "sm" }), "text-destructive")}
                        aria-hidden="true"
                      />
                    </RowAction>
                  ) : (
                    <RowAction
                      label={`${t.coreSettings.reactivate}: ${rowLabel}`}
                      disabled={isBusy}
                      loading={isRowPending}
                      onClick={() => onReactivate(tax)}
                    >
                      <RotateCcw className={iconSize({ size: "sm" })} aria-hidden="true" />
                    </RowAction>
                  )}
                </span>
              );
            },
          },
        ]
      : []),
  ];
}

function RowAction({
  label,
  disabled,
  loading,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  loading?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="xs"
          aria-label={label}
          disabled={disabled}
          loading={loading}
          onClick={onClick}
          className="px-1.5"
        >
          {loading ? null : children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
