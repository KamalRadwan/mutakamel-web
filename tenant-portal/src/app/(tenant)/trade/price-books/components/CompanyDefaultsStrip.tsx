"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Plus, Star, X } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IdentifierText,
  cn,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import {
  localizedBookDisplayName,
  type CompanyDefaultPriceBook,
  type PriceBook,
  type PriceBookPurpose,
} from "../pricing-contract";

interface CompanyDefaultsStripProps {
  defaultMappings: Record<string, CompanyDefaultPriceBook>;
  items: PriceBook[];
  canManageDefaults: boolean;
  isBusy: boolean;
  onSetDefault?: (book: PriceBook) => Promise<boolean>;
  onRemoveDefault: (book: PriceBook) => Promise<boolean>;
  onCreateForSlot?: (purpose: PriceBookPurpose, currencyCode: string) => void;
}

interface DefaultMatrixSlot {
  purpose: PriceBookPurpose;
  currencyCode: string;
  key: string;
}

export function CompanyDefaultsStrip({
  defaultMappings,
  items,
  canManageDefaults,
  isBusy,
  onSetDefault,
  onRemoveDefault,
  onCreateForSlot,
}: CompanyDefaultsStripProps) {
  const { t, lang } = useI18n();

  const slots = useMemo<DefaultMatrixSlot[]>(() => {
    const seenCurrencies: string[] = [];
    for (const m of Object.values(defaultMappings)) {
      if (!seenCurrencies.includes(m.currencyCode)) seenCurrencies.push(m.currencyCode);
    }
    for (const b of items) {
      if (!seenCurrencies.includes(b.currencyCode)) seenCurrencies.push(b.currencyCode);
    }
    const topCurrencies = seenCurrencies.slice(0, 2);
    const matrix: DefaultMatrixSlot[] = [];
    for (const purpose of ["SALES", "PURCHASE"] as const) {
      for (const currencyCode of topCurrencies) {
        matrix.push({
          purpose,
          currencyCode,
          key: `${purpose}:${currencyCode}`,
        });
      }
    }
    for (const m of Object.values(defaultMappings)) {
      const k = `${m.purpose}:${m.currencyCode}`;
      if (!matrix.some((s) => s.key === k)) {
        matrix.push({ purpose: m.purpose, currencyCode: m.currencyCode, key: k });
      }
    }
    return matrix.slice(0, 4);
  }, [defaultMappings, items]);

  return (
    <div className="flex flex-col gap-3 rounded-column bg-gradient-header p-4 text-white shadow-sm lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-col gap-0.5 lg:max-w-xs">
        <div className="flex items-center gap-2">
          <Star className="size-4 shrink-0 fill-star-filled text-star-filled" aria-hidden="true" />
          <h2 className="truncate text-sm font-bold text-white">
            {t.tradePricing.defaultsMatrixTitle}
          </h2>
        </div>
        <p className="text-caption text-white/75">{t.tradePricing.defaultsMatrixSubtitle}</p>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        {slots.map((slot) => {
          const mapping = defaultMappings[slot.key];
          const matchedBook = mapping
            ? items.find((b) => b.id === mapping.priceBookId)
            : undefined;
          const candidateBooks = items.filter(
            (b) =>
              b.purpose === slot.purpose &&
              b.currencyCode === slot.currencyCode &&
              b.status === "ACTIVE",
          );
          const purposeLabel = tradeStatusLabel(t.tradeStatus, slot.purpose, t.common.unknownCode);
          const liveVer = matchedBook?.versions.find((v) => v.status === "PUBLISHED") ??
            matchedBook?.versions[0];

          if (mapping) {
            const codeLabel =
              mapping.priceBookCode ?? matchedBook?.code ?? mapping.priceBookId.slice(0, 8);
            const syntheticBook: PriceBook =
              matchedBook ?? {
                id: mapping.priceBookId,
                code: codeLabel,
                purpose: mapping.purpose,
                currencyCode: mapping.currencyCode,
                status: "ACTIVE",
                version: 1,
                versionCount: 0,
                versions: [],
              };

            return (
              <div
                key={slot.key}
                className="flex items-center justify-between gap-2 rounded-card border border-white/15 bg-white/10 px-3 py-2.5"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="flex items-center gap-1.5 text-badge font-semibold text-white/80">
                    <span>{purposeLabel}</span>
                    <span>·</span>
                    <IdentifierText className="font-bold text-white">
                      {slot.currencyCode}
                    </IdentifierText>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`${TENANT_ROUTES.tradePriceBooks}/${mapping.priceBookId}`}
                      className="truncate text-xs font-bold text-white hover:underline"
                    >
                      <IdentifierText>{codeLabel}</IdentifierText>
                    </Link>
                    {liveVer ? (
                      <IdentifierText className="text-badge text-white/75">
                        {`(v${liveVer.versionNumber})`}
                      </IdentifierText>
                    ) : null}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="inline-flex items-center rounded-md bg-kpi-qualified-surface px-2 py-0.5 text-badge font-bold text-kpi-qualified-text">
                    {tradeStatusLabel(t.tradeStatus, "ACTIVE", t.common.unknownCode)}
                  </span>
                  {canManageDefaults ? (
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      disabled={isBusy}
                      aria-label={t.tradePricing.removeCompanyDefault}
                      onClick={() => void onRemoveDefault(syntheticBook)}
                      className="size-6 rounded-md p-0 text-white/75 not-disabled:hover:bg-white/15 not-disabled:hover:text-white"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          }

          return (
            <div
              key={slot.key}
              className={cn(
                "flex items-center justify-between gap-2 rounded-card border border-dashed border-white/25 bg-white/5 px-3 py-2.5",
              )}
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex items-center gap-1.5 text-badge font-semibold text-white/75">
                  <span>{purposeLabel}</span>
                  <span>·</span>
                  <IdentifierText className="font-bold text-white">
                    {slot.currencyCode}
                  </IdentifierText>
                </div>
                <span className="truncate text-caption text-white/60">
                  {t.tradePricing.defaultsUnmappedSlot}
                </span>
              </div>

              {canManageDefaults && onSetDefault && candidateBooks.length > 0 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      disabled={isBusy}
                      className="shrink-0 rounded-md border border-white/25 bg-white/10 px-2.5 text-badge font-semibold text-white not-disabled:hover:bg-white/20"
                    >
                      <Plus className="size-3" aria-hidden="true" />
                      {t.tradePricing.defaultsAssignAction}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {candidateBooks.map((cand) => (
                      <DropdownMenuItem
                        key={cand.id}
                        onClick={() => void onSetDefault(cand)}
                      >
                        <IdentifierText className="me-2 text-xs font-bold">
                          {cand.code}
                        </IdentifierText>
                        <span className="truncate text-xs">
                          {localizedBookDisplayName(cand, lang)}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : canManageDefaults && onCreateForSlot ? (
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  disabled={isBusy}
                  onClick={() => onCreateForSlot(slot.purpose, slot.currencyCode)}
                  className="shrink-0 rounded-md border border-white/25 bg-white/10 px-2.5 text-badge font-semibold text-white not-disabled:hover:bg-white/20"
                >
                  <Plus className="size-3" aria-hidden="true" />
                  {t.tradePricing.defaultsAssignAction}
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
