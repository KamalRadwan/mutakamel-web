"use client";

import { useVersionComparison } from "./hooks/useVersionComparison";
import { GitCompare, Info } from "lucide-react";
import {
  Badge,
  EmptyState,
  Field,
  IdentifierText,
  Money,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import {
  localizedRecordName,
  type PriceBookVersionDetail,
  type PriceBookVersionDiff,
} from "../pricing-contract";
import type { TemporalVersionInput } from "../version-temporal";

interface VersionComparisonPanelProps {
  detail: PriceBookVersionDetail;
  versions: readonly TemporalVersionInput[];
  diffResult: PriceBookVersionDiff | null;
  isDiffLoading: boolean;
  onLoadDiff: (baselineVersionId: string) => Promise<void>;
  onSelectTargetVersion?: (targetVersionId: string) => void;
}

export function VersionComparisonPanel({
  detail,
  versions,
  diffResult,
  isDiffLoading,
  onLoadDiff,
  onSelectTargetVersion,
}: VersionComparisonPanelProps) {
  const { t, lang } = useI18n();
  const { siblingVersions, activeBaselineId, setSelectedBaselineId } = useVersionComparison(detail.version.id, versions, diffResult, onLoadDiff);

  if (siblingVersions.length === 0) {
    return (
      <div className="rounded-card border border-border bg-card p-6">
        <EmptyState
          icon={GitCompare}
          title={t.tradePricing.workspaceTabComparison}
          description={t.tradePricing.noSiblingVersionToCompare}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Selector Bar */}
      <div className="grid grid-cols-1 gap-3 rounded-card border border-border bg-card p-3.5 sm:grid-cols-2">
        <Field label={t.tradePricing.diffTargetLabel} showLabel>
          <Select
            value={detail.version.id}
            disabled={!onSelectTargetVersion}
            onValueChange={(next) => {
              if (onSelectTargetVersion && next !== detail.version.id) {
                onSelectTargetVersion(next);
              }
            }}
          >
            <SelectTrigger size="sm" aria-label={t.tradePricing.diffTargetLabel}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {versions.map((ver) => (
                <SelectItem key={ver.id} value={ver.id}>
                  {`v${ver.versionNumber} · ${tradeStatusLabel(t.tradeStatus, ver.status, t.common.unknownCode)}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label={t.tradePricing.diffBaselineLabel} showLabel>
          <Select
            value={activeBaselineId}
            onValueChange={(next) => {
              setSelectedBaselineId(next);
              void onLoadDiff(next);
            }}
          >
            <SelectTrigger size="sm" aria-label={t.tradePricing.diffBaselineLabel}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {siblingVersions.map((ver) => (
                <SelectItem key={ver.id} value={ver.id}>
                  {`v${ver.versionNumber} · ${tradeStatusLabel(t.tradeStatus, ver.status, t.common.unknownCode)}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {/* Explicit Price-Only Disclaimer */}
      <div className="flex items-start gap-2 rounded-lg border border-info/30 bg-info-subtle/60 px-3.5 py-2.5 text-xs text-info-subtle-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>{t.tradePricing.diffPriceOnlyDisclaimer}</span>
      </div>

      {isDiffLoading ? (
        <Skeleton className="h-56" />
      ) : diffResult ? (
        <>
          {/* Neutral Directional Summary Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border bg-card px-4 py-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">
                {t.tradePricing.diffDecreasedLabel}:{" "}
                <IdentifierText className="ms-1 text-badge">
                  {formatNumber(diffResult.summary.decreased, lang)}
                </IdentifierText>
              </Badge>
              <Badge tone="neutral">
                {t.tradePricing.diffIncreasedLabel}:{" "}
                <IdentifierText className="ms-1 text-badge">
                  {formatNumber(diffResult.summary.increased, lang)}
                </IdentifierText>
              </Badge>
              <Badge tone="neutral">
                {t.tradePricing.diffUnchangedPriceLabel}:{" "}
                <IdentifierText className="ms-1 text-badge">
                  {formatNumber(diffResult.summary.unchanged, lang)}
                </IdentifierText>
              </Badge>
              <Badge tone="brand">
                {t.tradePricing.diffAddedLabel}:{" "}
                <IdentifierText className="ms-1 text-badge">
                  {formatNumber(diffResult.summary.added, lang)}
                </IdentifierText>
              </Badge>
              <Badge tone="caution">
                {t.tradePricing.diffRemovedLabel}:{" "}
                <IdentifierText className="ms-1 text-badge">
                  {formatNumber(diffResult.summary.removed, lang)}
                </IdentifierText>
              </Badge>
            </div>
            <Badge tone="neutral">
              {t.tradePricing.diffPromosChangedBadge.replace(
                "{count}",
                formatNumber(diffResult.summary.promotionsChanged, lang),
              )}
            </Badge>
          </div>

          {/* Entry Diff Table */}
          <div className="overflow-hidden rounded-card border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.tradePricing.itemColumn}</TableHead>
                  <TableHead className="text-end">{t.tradePricing.promoQtyRangeCol}</TableHead>
                  <TableHead className="text-end">{t.tradePricing.diffOldPrice}</TableHead>
                  <TableHead className="text-end">{t.tradePricing.diffNewPrice}</TableHead>
                  <TableHead className="text-end">{t.tradePricing.diffDeltaPct}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {diffResult.entries.map((row, idx) => (
                  <TableRow key={`${row.itemId}-${row.uomId}-${row.minimumQuantity}-${idx}`} className="font-normal">
                    <TableCell className="font-normal">
                      <div className="flex flex-col">
                        <span className="text-xs text-foreground">
                          {localizedRecordName(row.itemLocalizedNames, row.itemCode, lang)}
                        </span>
                        <IdentifierText className="text-caption text-muted-foreground">
                          {`${row.itemCode} · ${row.uomCode}`}
                        </IdentifierText>
                      </div>
                    </TableCell>
                    <TableCell className="text-end font-normal">
                      <IdentifierText className="text-xs">
                        {`[${row.minimumQuantity}, ${row.maximumQuantity ?? t.tradePricing.noUpperLimitSymbol})`}
                      </IdentifierText>
                    </TableCell>
                    <TableCell className="text-end font-normal">
                      {row.baselineUnitPrice ? (
                        <Money
                          value={row.baselineUnitPrice}
                          currency={diffResult.currencyCode}
                          language={lang}
                          minimumFractionDigits={2}
                          maximumFractionDigits={8}
                        />
                      ) : (
                        t.tradePricing.noUpperLimitSymbol
                      )}
                    </TableCell>
                    <TableCell className="text-end font-normal">
                      {row.targetUnitPrice ? (
                        <Money
                          value={row.targetUnitPrice}
                          currency={diffResult.currencyCode}
                          language={lang}
                          minimumFractionDigits={2}
                          maximumFractionDigits={8}
                        />
                      ) : (
                        t.tradePricing.noUpperLimitSymbol
                      )}
                    </TableCell>
                    <TableCell className="text-end font-normal">
                      <Badge tone="neutral">
                        <IdentifierText className="text-badge">
                          {row.deltaPct !== null
                            ? `${row.deltaPct > 0 ? "+" : ""}${row.deltaPct.toFixed(2)}%`
                            : tradeStatusLabel(t.tradeStatus, row.changeType, row.changeType)}
                        </IdentifierText>
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Promotion Changes */}
          {diffResult.promotions.length > 0 ? (
            <section className="flex flex-col gap-2 rounded-card border border-border bg-card p-3.5 text-xs">
              <h3 className="font-semibold text-foreground">{t.tradePricing.diffPromotionsSection}</h3>
              <ul className="flex flex-col gap-1.5">
                {diffResult.promotions.map((p) => (
                  <li key={`${p.code}-${p.changeType}`} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-1.5 last:border-b-0 last:pb-0">
                    <div>
                      <span className="font-medium text-foreground">{p.name}</span>{" "}
                      <IdentifierText className="text-caption text-muted-foreground">({p.code})</IdentifierText>
                    </div>
                    <div className="flex items-center gap-2">
                      <IdentifierText className="text-caption text-muted-foreground">
                        {`${typeof p.baselineBenefit?.value === "string" ? p.baselineBenefit.value : "—"} → ${typeof p.targetBenefit?.value === "string" ? p.targetBenefit.value : "—"}`}
                      </IdentifierText>
                      <Badge tone="neutral">
                        {tradeStatusLabel(t.tradeStatus, p.changeType, p.changeType)}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
