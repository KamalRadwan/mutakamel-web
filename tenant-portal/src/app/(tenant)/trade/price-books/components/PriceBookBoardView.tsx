"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronsLeft,
  ChevronsRight,
  Clock3,
  FileSpreadsheet,
  MoreHorizontal,
  Plus,
  Power,
  RefreshCw,
  Star,
} from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IdentifierText,
  cn,
  mirrorInRtl,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDate } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import {
  localizedBookDisplayName,
  type PriceBook,
  type PriceBookStatus,
} from "../pricing-contract";

type BoardLaneId = "COMPANY_DEFAULT" | "PUBLISHED" | "SCHEDULED" | "PIPELINE" | "INACTIVE";

interface PriceBookBoardViewProps {
  items: PriceBook[];
  canManage: boolean;
  canManageDefaults: boolean;
  isDefaultBusy: boolean;
  isBookDefault: (book: PriceBook) => boolean;
  onSetDefault: (book: PriceBook) => Promise<boolean>;
  onRemoveDefault: (book: PriceBook) => Promise<boolean>;
  onToggleStatus: (book: PriceBook, nextStatus: PriceBookStatus) => Promise<boolean>;
  onOpenCreate?: () => void;
  onManageDefaults?: () => void;
}

function classifyBoardLane(book: PriceBook, isDefault: boolean): BoardLaneId {
  if (book.status === "INACTIVE") return "INACTIVE";
  if (isDefault) return "COMPANY_DEFAULT";
  if (book.versions.some((v) => v.status === "PUBLISHED" && !v.supersededAt)) {
    return "PUBLISHED";
  }
  if (book.versions.some((v) => v.status === "SCHEDULED")) {
    return "SCHEDULED";
  }
  if (book.versions.length > 0 && book.versions.every((v) => v.status === "RETIRED")) {
    return "INACTIVE";
  }
  return "PIPELINE";
}

function secondaryBookSubtitle(book: PriceBook, displayName: string): string | null {
  const arName = book.localizedNames?.ar?.trim() || "";
  const enName = book.localizedNames?.en?.trim() || "";
  if (arName && enName && arName !== enName) {
    return displayName === arName ? enName : arName;
  }
  return null;
}

export function PriceBookBoardView({
  items,
  canManage,
  canManageDefaults,
  isDefaultBusy,
  isBookDefault,
  onSetDefault,
  onRemoveDefault,
  onToggleStatus,
  onOpenCreate,
  onManageDefaults,
}: PriceBookBoardViewProps) {
  const { t, lang } = useI18n();
  // Inactive/Retired lane starts collapsed as a sleek 52px vertical rail (Mockup 01)
  const [collapsedLanes, setCollapsedLanes] = useState<Record<BoardLaneId, boolean>>({
    COMPANY_DEFAULT: false,
    PUBLISHED: false,
    SCHEDULED: false,
    PIPELINE: false,
    INACTIVE: true,
  });

  const toggleLane = (laneId: BoardLaneId) => {
    setCollapsedLanes((prev) => ({ ...prev, [laneId]: !prev[laneId] }));
  };

  const lanes: ReadonlyArray<{
    id: BoardLaneId;
    title: string;
    accentBarClass: string;
    countPillClass: string;
    cardEdgeClass: string;
    showStar?: boolean;
  }> = [
    {
      id: "COMPANY_DEFAULT",
      title: t.tradePricing.boardLaneCompanyDefault,
      accentBarClass: "bg-warning-vivid",
      countPillClass: "bg-kpi-rated-surface text-kpi-rated-text border border-kpi-rated-line",
      cardEdgeClass: "border-s-warning-vivid",
      showStar: true,
    },
    {
      id: "PUBLISHED",
      title: t.tradePricing.boardLanePublished,
      accentBarClass: "bg-success-vivid",
      countPillClass:
        "bg-kpi-qualified-surface text-kpi-qualified-text border border-kpi-qualified-line",
      cardEdgeClass: "border-s-success-vivid",
    },
    {
      id: "SCHEDULED",
      title: t.tradePricing.boardLaneScheduled,
      accentBarClass: "bg-info-vivid",
      countPillClass: "bg-kpi-new-surface text-kpi-new-text border border-kpi-new-line",
      cardEdgeClass: "border-s-info-vivid",
    },
    {
      id: "PIPELINE",
      title: t.tradePricing.boardLanePipeline,
      accentBarClass: "bg-destructive-vivid",
      countPillClass:
        "bg-kpi-overdue-surface text-kpi-overdue-text border border-kpi-overdue-line",
      cardEdgeClass: "border-s-destructive-vivid",
    },
    {
      id: "INACTIVE",
      title: t.tradePricing.boardLaneInactive,
      accentBarClass: "bg-border",
      countPillClass: "bg-count-zero-surface text-count-zero-fg",
      cardEdgeClass: "border-s-border",
    },
  ];

  const grouped: Record<BoardLaneId, PriceBook[]> = {
    COMPANY_DEFAULT: [],
    PUBLISHED: [],
    SCHEDULED: [],
    PIPELINE: [],
    INACTIVE: [],
  };

  for (const book of items) {
    const lane = classifyBoardLane(book, isBookDefault(book));
    grouped[lane].push(book);
  }

  return (
    <div className="flex h-full min-h-0 gap-3 overflow-x-auto pb-1">
      {lanes.map((lane) => {
        const laneBooks = grouped[lane.id];
        const isCollapsed = collapsedLanes[lane.id];

        if (isCollapsed) {
          return (
            <div
              key={lane.id}
              className="flex h-full min-h-72 w-[52px] flex-[0_0_52px] flex-col items-center gap-3 rounded-column border border-line-column bg-surface-column py-3 shadow-column transition-colors"
            >
              <Button
                type="button"
                variant="ghost"
                onClick={() => toggleLane(lane.id)}
                aria-expanded={false}
                aria-label={`${t.views.expandColumn}: ${lane.title}`}
                title={`${t.views.expandColumn}: ${lane.title}`}
                className="size-7 shrink-0 rounded-lg border border-line-card bg-card p-0 text-foreground-secondary not-disabled:hover:bg-surface-subtle not-disabled:hover:text-foreground"
              >
                <ChevronsRight className={cn("size-4", mirrorInRtl)} aria-hidden="true" />
              </Button>

              <span
                className={cn(
                  "inline-flex size-[26px] shrink-0 items-center justify-center rounded-full text-badge font-bold tabular-nums",
                  lane.countPillClass,
                )}
              >
                {formatNumber(laneBooks.length, lang)}
              </span>

              <span className="min-h-0 truncate text-tab font-bold text-foreground-secondary [writing-mode:vertical-rl] rotate-180">
                {lane.title}
              </span>

              <span className="min-h-2 w-px flex-1 bg-line-divider" aria-hidden="true" />
            </div>
          );
        }

        return (
          <div
            key={lane.id}
            className="flex h-full min-h-72 min-w-[292px] flex-[1_1_0] flex-col overflow-hidden rounded-column border border-line-column bg-surface-column shadow-column"
          >
            {/* Column Header + Signature 3px Accent Bar */}
            <div className="flex shrink-0 flex-col gap-2.5 rounded-t-column border-b border-line-divider bg-surface-column-header px-3.5 pt-3 pb-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  {lane.showStar ? (
                    <Star
                      className="size-4 shrink-0 fill-star-filled text-star-filled"
                      aria-hidden="true"
                    />
                  ) : null}
                  <span className="truncate text-column-title font-bold text-foreground">
                    {lane.title}
                  </span>
                  <span
                    className={cn(
                      "inline-flex h-5 min-w-[23px] shrink-0 items-center justify-center rounded-full px-1.5 text-badge font-bold tabular-nums",
                      lane.countPillClass,
                    )}
                  >
                    {formatNumber(laneBooks.length, lang)}
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {lane.id === "COMPANY_DEFAULT" && onManageDefaults ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={onManageDefaults}
                      className="h-6 rounded-md px-2 text-badge font-semibold"
                    >
                      {t.tradePricing.manageDefaultsShort}
                    </Button>
                  ) : null}

                  {lane.id === "PUBLISHED" && canManage && onOpenCreate ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={onOpenCreate}
                      aria-label={t.tradePricing.bookCreate}
                      title={t.tradePricing.bookCreate}
                      className="size-[26px] shrink-0 rounded-md border border-line-card bg-surface-subtle p-0 text-muted-foreground not-disabled:hover:bg-count-active-surface not-disabled:hover:text-primary"
                    >
                      <Plus className="size-3.5" aria-hidden="true" />
                    </Button>
                  ) : null}

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => toggleLane(lane.id)}
                    aria-expanded={true}
                    aria-label={`${t.views.collapseColumn}: ${lane.title}`}
                    title={`${t.views.collapseColumn}: ${lane.title}`}
                    className="size-[26px] shrink-0 rounded-md border border-line-card bg-surface-subtle p-0 text-muted-foreground not-disabled:hover:bg-accent not-disabled:hover:text-foreground"
                  >
                    <ChevronsLeft className={cn("size-3.5", mirrorInRtl)} aria-hidden="true" />
                  </Button>
                </div>
              </div>

              <div className={cn("h-[3px] w-full rounded-full", lane.accentBarClass)} />
            </div>

            {/* Cards Stack */}
            <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-2.5">
              {laneBooks.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center rounded-card border border-dashed border-line-card bg-card/60 px-3 py-8 text-center text-xs text-muted-foreground">
                  {t.tradePricing.boardEmptyStage}
                </div>
              ) : (
                laneBooks.map((book) => {
                  const isDefault = isBookDefault(book);
                  const displayName = localizedBookDisplayName(book, lang);
                  const subtitle = secondaryBookSubtitle(book, displayName);
                  const detailHref = `${TENANT_ROUTES.tradePriceBooks}/${book.id}`;
                  const publishedVer = book.versions.find(
                    (v) => v.status === "PUBLISHED" && !v.supersededAt,
                  );
                  const scheduledVer = book.versions.find((v) => v.status === "SCHEDULED");
                  const testedVer = book.versions.find((v) => v.status === "TESTED");
                  const headVersion =
                    publishedVer ?? scheduledVer ?? testedVer ?? book.versions[0] ?? null;

                  const entriesCount = book.entryCount ?? 0;
                  const promosCount = book.promotionCount ?? 0;
                  const accountsCount = book.linkedAccountsCount ?? 0;
                  const isSales = book.purpose === "SALES";

                  return (
                    <div
                      key={book.id}
                      className={cn(
                        "flex flex-col gap-2.5 rounded-card border border-line-card border-s-4 bg-card p-3.5 shadow-2xs transition-colors hover:border-chip-active-line",
                        lane.cardEdgeClass,
                      )}
                    >
                      {/* Row 1: Default Pill + Title + Code/Subtitle + Menu */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          {isDefault ? (
                            <span className="mb-1.5 inline-flex items-center gap-1 rounded-md border border-kpi-rated-line bg-kpi-rated-surface px-2 py-0.5 text-badge font-bold text-kpi-rated-text">
                              <Star className="size-3 fill-star-filled text-star-filled" aria-hidden="true" />
                              {t.tradePricing.isCompanyDefault}
                            </span>
                          ) : null}
                          <Link
                            href={detailHref}
                            className="block truncate text-card-title font-bold text-foreground hover:text-primary"
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
                                <span className="min-w-0 truncate text-muted-foreground">
                                  {subtitle}
                                </span>
                              </>
                            ) : null}
                          </div>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              size="xs"
                              variant="ghost"
                              aria-label={t.tradePricing.cardManageBook}
                              className="size-6 shrink-0 rounded-md p-0 text-muted-foreground"
                            >
                              <MoreHorizontal className="size-4" aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={detailHref}>{t.tradePricing.openWorkspace}</Link>
                            </DropdownMenuItem>
                            {headVersion ? (
                              <DropdownMenuItem asChild>
                                <Link
                                  href={`${TENANT_ROUTES.trade}/price-book-versions/${headVersion.id}`}
                                >
                                  <FileSpreadsheet className="me-2 size-3.5" aria-hidden="true" />
                                  {t.tradePricing.openMatrixEditor}
                                </Link>
                              </DropdownMenuItem>
                            ) : null}
                            {canManageDefaults ? (
                              <>
                                <DropdownMenuSeparator />
                                {isDefault ? (
                                  <DropdownMenuItem
                                    disabled={isDefaultBusy}
                                    onClick={() => void onRemoveDefault(book)}
                                  >
                                    <Star className="me-2 size-3.5" aria-hidden="true" />
                                    {t.tradePricing.removeCompanyDefault}
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    disabled={isDefaultBusy || book.status === "INACTIVE"}
                                    onClick={() => void onSetDefault(book)}
                                  >
                                    <Star className="me-2 size-3.5" aria-hidden="true" />
                                    {t.tradePricing.setAsCompanyDefault}
                                  </DropdownMenuItem>
                                )}
                              </>
                            ) : null}
                            {canManage ? (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  disabled={isDefault && book.status === "ACTIVE"}
                                  onClick={() =>
                                    void onToggleStatus(
                                      book,
                                      book.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                                    )
                                  }
                                >
                                  <Power className="me-2 size-3.5" aria-hidden="true" />
                                  {book.status === "ACTIVE"
                                    ? t.tradePricing.bulkDeactivate
                                    : t.tradePricing.bulkActivate}
                                </DropdownMenuItem>
                              </>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Row 2: Purpose Pill + Solid Dark Currency Pill + Version Status Pill */}
                      <div className="flex flex-wrap items-center gap-1.5">
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

                        {headVersion ? (
                          <Link
                            href={`${TENANT_ROUTES.trade}/price-book-versions/${headVersion.id}`}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-badge font-bold hover:underline",
                              headVersion.status === "PUBLISHED"
                                ? "border-kpi-qualified-line bg-kpi-qualified-surface text-kpi-qualified-text"
                                : headVersion.status === "SCHEDULED" || headVersion.status === "TESTED"
                                  ? "border-kpi-new-line bg-kpi-new-surface text-kpi-new-text"
                                  : "border-kpi-overdue-line bg-kpi-overdue-surface text-kpi-overdue-text",
                            )}
                          >
                            <IdentifierText>{`v${headVersion.versionNumber}`}</IdentifierText>
                            <span>·</span>
                            <span>
                              {tradeStatusLabel(
                                t.tradeStatus,
                                headVersion.status,
                                t.common.unknownCode,
                              )}
                            </span>
                          </Link>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-count-zero-surface px-2 py-0.5 text-badge font-semibold text-count-zero-fg">
                            {t.tradePricing.noVersions}
                          </span>
                        )}
                      </div>

                      {/* Row 3: 3-Column Mini Stats Box */}
                      <div className="grid grid-cols-3 gap-2 rounded-lg bg-surface-subtle px-2.5 py-2 text-start">
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate text-micro font-semibold text-muted-foreground">
                            {t.tradePricing.cardMetricItemsTiers}
                          </span>
                          <span className="truncate text-caption font-bold text-foreground">
                            {entriesCount === 1
                              ? t.tradePricing.boardItemSingle
                              : formatTemplate(t.tradePricing.boardItemsCount, {
                                  count: entriesCount,
                                })}
                          </span>
                        </div>

                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate text-micro font-semibold text-muted-foreground">
                            {t.tradePricing.cardMetricActivePromos}
                          </span>
                          <span className="truncate text-caption font-bold text-foreground">
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
                            {t.tradePricing.cardMetricLinkedAccounts}
                          </span>
                          <span className="truncate text-caption font-bold text-foreground">
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

                      {/* Row 4: Contextual Governance Status Banner (for Scheduled / Tested / Draft) */}
                      {lane.id === "PIPELINE" && headVersion?.status === "TESTED" ? (
                        <div className="flex items-center gap-1.5 rounded-md border border-kpi-qualified-line bg-kpi-qualified-surface px-2.5 py-1.5 text-badge font-semibold text-kpi-qualified-text">
                          <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
                          <span className="truncate">{t.tradePricing.cardTestedBanner}</span>
                        </div>
                      ) : lane.id === "SCHEDULED" ? (
                        <div className="flex items-center gap-1.5 rounded-md border border-kpi-new-line bg-kpi-new-surface px-2.5 py-1.5 text-badge font-semibold text-kpi-new-text">
                          <RefreshCw className="size-3 shrink-0" aria-hidden="true" />
                          <span className="truncate">{t.tradePricing.cardScheduledBanner}</span>
                        </div>
                      ) : lane.id === "PIPELINE" ? (
                        <div className="flex items-center gap-1.5 rounded-md border border-kpi-rated-line bg-kpi-rated-surface px-2.5 py-1.5 text-badge font-semibold text-kpi-rated-text">
                          <Clock3 className="size-3 shrink-0" aria-hidden="true" />
                          <span className="truncate">{t.tradePricing.cardDraftBanner}</span>
                        </div>
                      ) : null}

                      {/* Row 5: Footer with Effective Date + Open Book CTA */}
                      <div className="flex items-center justify-between gap-2 border-t border-line-divider pt-2 text-caption">
                        <span className="inline-flex min-w-0 items-center gap-1 truncate text-muted-foreground">
                          <Calendar className="size-3 shrink-0" aria-hidden="true" />
                          <span className="truncate">
                            {headVersion
                              ? formatDate(headVersion.effectiveFrom, lang)
                              : t.tradePricing.noVersions}
                          </span>
                        </span>

                        <Link
                          href={detailHref}
                          className="inline-flex shrink-0 items-center gap-1 font-bold text-primary hover:underline"
                        >
                          <span>{t.tradePricing.cardOpenBook}</span>
                          <ArrowRight
                            className={cn("size-3.5", mirrorInRtl)}
                            aria-hidden="true"
                          />
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
