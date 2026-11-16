"use client";

import Link from "next/link";
import { ArrowRight, Copy, Plus, Star } from "lucide-react";
import { Button, IdentifierText, cn, mirrorInRtl } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import { localizedBookDisplayName, type PriceBook } from "../pricing-contract";

interface PriceBookCardViewProps {
  items: PriceBook[];
  canManageDefaults: boolean;
  isDefaultBusy: boolean;
  isBookDefault: (book: PriceBook) => boolean;
  onSetDefault: (book: PriceBook) => Promise<boolean>;
}

function secondaryBookSubtitle(book: PriceBook, displayName: string): string | null {
  const arName = book.localizedNames?.ar?.trim() || "";
  const enName = book.localizedNames?.en?.trim() || "";
  if (arName && enName && arName !== enName) {
    return displayName === arName ? enName : arName;
  }
  return null;
}

export function PriceBookCardView({
  items,
  canManageDefaults,
  isDefaultBusy,
  isBookDefault,
  onSetDefault,
}: PriceBookCardViewProps) {
  const { t, lang } = useI18n();
  const sortedItems = [...items].sort(
    (a, b) => Number(isBookDefault(b)) - Number(isBookDefault(a)),
  );

  return (
    <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
      {sortedItems.map((book) => {
        const isDefault = isBookDefault(book);
        const isSales = book.purpose === "SALES";
        const displayName = localizedBookDisplayName(book, lang);
        const subtitle = secondaryBookSubtitle(book, displayName);
        const detailHref = `${TENANT_ROUTES.tradePriceBooks}/${book.id}`;

        const publishedVer = book.versions.find(
          (v) => v.status === "PUBLISHED" && !v.supersededAt,
        );
        const scheduledVer = book.versions.find((v) => v.status === "SCHEDULED");
        const testedVer = book.versions.find((v) => v.status === "TESTED");
        const activeVersion =
          publishedVer ?? scheduledVer ?? testedVer ?? book.versions[0] ?? null;

        const chronologicalVersions = [...book.versions]
          .sort((a, b) => a.versionNumber - b.versionNumber)
          .slice(-4);

        const entriesCount = book.entryCount ?? 0;
        const promosCount = book.promotionCount ?? 0;
        const accountsCount = book.linkedAccountsCount ?? 0;

        return (
          <div
            key={book.id}
            className="flex flex-col justify-between gap-3 rounded-column border border-line-card bg-card p-4 shadow-column transition-colors hover:border-chip-active-line"
          >
            <div className="flex flex-col gap-3">
              {/* Row 1: Book Identity (Start) + Default/Purpose/Currency Pills (End) */}
              <div className="flex items-start justify-between gap-2.5">
                <div className="min-w-0 flex-1">
                  <Link
                    href={detailHref}
                    className="block truncate text-base font-bold text-foreground hover:text-primary"
                  >
                    {displayName}
                  </Link>
                  <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-caption">
                    <IdentifierText className="shrink-0 font-bold text-primary">
                      {book.code}
                    </IdentifierText>
                    {subtitle ? (
                      <>
                        <span className="shrink-0 text-muted-foreground" aria-hidden="true">
                          ·
                        </span>
                        <span className="min-w-0 truncate text-muted-foreground">{subtitle}</span>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                  {isDefault ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-kpi-rated-line bg-kpi-rated-surface px-2 py-0.5 text-badge font-bold text-kpi-rated-text">
                      <Star
                        className="size-3 fill-star-filled text-star-filled"
                        aria-hidden="true"
                      />
                      {t.tradePricing.isCompanyDefault}
                    </span>
                  ) : null}

                  <span
                    className={cn(
                      "inline-flex items-center rounded-md border px-2 py-0.5 text-badge font-bold",
                      isSales
                        ? "border-kpi-new-line bg-kpi-new-surface text-kpi-new-text"
                        : "border-kpi-qualified-line bg-kpi-qualified-surface text-kpi-qualified-text",
                    )}
                  >
                    {tradeStatusLabel(t.tradeStatus, book.purpose, t.common.unknownCode)}
                  </span>

                  <span className="inline-flex items-center rounded-md bg-foreground px-2 py-0.5 text-badge font-bold text-background">
                    <IdentifierText>{book.currencyCode}</IdentifierText>
                  </span>
                </div>
              </div>

              {/* Row 2: 4-Column Metric Strip */}
              <div className="grid grid-cols-4 gap-2 rounded-lg bg-surface-subtle px-3 py-2.5 text-start">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-micro font-semibold text-muted-foreground">
                    {t.tradePricing.bentoActiveVersion}
                  </span>
                  {activeVersion ? (
                    <span
                      className={cn(
                        "truncate text-xs font-bold",
                        activeVersion.status === "PUBLISHED"
                          ? "text-kpi-qualified-text"
                          : activeVersion.status === "SCHEDULED" ||
                              activeVersion.status === "TESTED"
                            ? "text-kpi-new-text"
                            : "text-kpi-rated-text",
                      )}
                    >
                      <IdentifierText>{`v${activeVersion.versionNumber}`}</IdentifierText>
                      {" · "}
                      {tradeStatusLabel(t.tradeStatus, activeVersion.status, t.common.unknownCode)}
                    </span>
                  ) : (
                    <span className="truncate text-xs font-semibold text-muted-foreground">
                      {t.tradePricing.noVersions}
                    </span>
                  )}
                </div>

                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-micro font-semibold text-muted-foreground">
                    {t.tradePricing.cardActiveEntries}
                  </span>
                  <span className="truncate text-xs font-bold tabular-nums text-foreground">
                    {formatNumber(entriesCount, lang)}
                  </span>
                </div>

                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-micro font-semibold text-muted-foreground">
                    {t.tradePricing.cardActivePromotions}
                  </span>
                  <span
                    className={cn(
                      "truncate text-xs font-bold",
                      promosCount > 0 ? "text-kpi-qualified-text" : "text-foreground",
                    )}
                  >
                    {promosCount > 0
                      ? promosCount === 1
                        ? t.tradePricing.boardPromoSingle
                        : formatTemplate(t.tradePricing.boardPromosCount, {
                            count: promosCount,
                          })
                      : t.tradePricing.cardNoPromos}
                  </span>
                </div>

                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-micro font-semibold text-muted-foreground">
                    {t.tradePricing.cardLinkedAccounts}
                  </span>
                  <span className="truncate text-xs font-bold text-foreground">
                    {accountsCount > 0
                      ? accountsCount === 1
                        ? t.tradePricing.boardAccountSingle
                        : formatTemplate(t.tradePricing.boardAccountsCount, {
                            count: accountsCount,
                          })
                      : isDefault
                        ? t.tradePricing.cardGeneralDefault
                        : "0"}
                  </span>
                </div>
              </div>

              {/* Row 3: Chronological Version Lineage Strip */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line-divider bg-surface-subtle/60 px-3 py-2">
                <span className="text-caption font-semibold text-muted-foreground">
                  {`${t.tradePricing.bentoVersionChain}:`}
                </span>

                {chronologicalVersions.length === 0 ? (
                  <span className="text-caption text-muted-foreground">
                    {t.tradePricing.noVersions}
                  </span>
                ) : (
                  <div className="flex flex-wrap items-center gap-1">
                    {chronologicalVersions.map((ver, index) => {
                      const isLive = ver.status === "PUBLISHED" && !ver.supersededAt;
                      return (
                        <span key={ver.id} className="inline-flex items-center gap-1">
                          {index > 0 ? (
                            <ArrowRight
                              className={cn("size-3 text-muted-foreground", mirrorInRtl)}
                              aria-hidden="true"
                            />
                          ) : null}
                          <Link
                            href={`${TENANT_ROUTES.trade}/price-book-versions/${ver.id}`}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-badge font-bold hover:underline",
                              isLive
                                ? "border-kpi-qualified-line bg-kpi-qualified-surface text-kpi-qualified-text"
                                : ver.status === "SCHEDULED" || ver.status === "TESTED"
                                  ? "border-kpi-new-line bg-kpi-new-surface text-kpi-new-text"
                                  : ver.status === "DRAFT"
                                    ? "border-kpi-rated-line bg-kpi-rated-surface text-kpi-rated-text"
                                    : "border-line-card bg-count-zero-surface text-count-zero-fg",
                            )}
                          >
                            <IdentifierText>{`v${ver.versionNumber}`}</IdentifierText>
                            {isLive || ver.status !== "RETIRED" ? (
                              <span>
                                {tradeStatusLabel(t.tradeStatus, ver.status, t.common.unknownCode)}
                              </span>
                            ) : null}
                          </Link>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Row 4: Card Footer */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  asChild
                  size="xs"
                  variant="outline"
                  className="border-kpi-new-line bg-kpi-new-surface text-kpi-new-text not-disabled:hover:bg-kpi-new-surface/80"
                >
                  <Link href={detailHref}>
                    <Plus className="size-3.5" aria-hidden="true" />
                    {t.tradePricing.newVersion}
                  </Link>
                </Button>

                <Button asChild size="xs" variant="outline">
                  <Link href={detailHref}>
                    <Copy className="size-3" aria-hidden="true" />
                    {t.tradePricing.bentoCloneAdjust}
                  </Link>
                </Button>

                {canManageDefaults && !isDefault && book.status === "ACTIVE" ? (
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    disabled={isDefaultBusy}
                    aria-label={t.tradePricing.setAsCompanyDefault}
                    title={t.tradePricing.setAsCompanyDefault}
                    onClick={() => void onSetDefault(book)}
                    className="px-2 text-muted-foreground not-disabled:hover:text-foreground"
                  >
                    <Star className="size-3.5" aria-hidden="true" />
                  </Button>
                ) : null}
              </div>

              <Button
                asChild
                size="xs"
                variant="outline"
                className="font-bold text-primary not-disabled:hover:text-primary"
              >
                <Link href={detailHref}>
                  <span>{t.tradePricing.bentoOpenWorkspace}</span>
                  <ArrowRight className={cn("size-3.5", mirrorInRtl)} aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
