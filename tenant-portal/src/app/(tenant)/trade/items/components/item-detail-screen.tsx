"use client";

import { Building2, Check, Globe, MapPin, Pencil, Plus } from "lucide-react";
import {
  Badge,
  Button,
  DetailHeader,
  ErrorState,
  IdentifierText,
  NotFoundState,
  Pagination,
  PermissionGate,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDateTime } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { TradeScopeBar } from "../../TradeScopeBar";
import { TRADE_PERMISSIONS } from "../../trade-scope";
import { tradeLocalizedName } from "../../trade-validation";
import { useActiveUoms } from "../hooks/useActiveUoms";
import { useCatalogUoms } from "../hooks/useCatalogUoms";
import { useItemDetail } from "../hooks/useItemDetail";
import { useItemListings } from "../hooks/useItemListings";
import { useItemProfiles } from "../hooks/useItemProfiles";
import { useItemReferenceData } from "../hooks/useItemReferenceData";
import { formatTradeDecimal, isItemKind, isItemStatus } from "../item-contract";
import { isTrackingMode, type ItemCompanyProfile } from "../item-profile-contract";
import {
  BranchProfileDrawer,
  CompanyProfileDrawer,
  ListingDrawer,
} from "./ItemProfileDrawers";
import { ItemIdentityDetails } from "./ItemIdentityDetails";
import { ItemImageManager } from "./ItemImageManager";
import { ItemStandardCostSection } from "./ItemStandardCostSection";

export function ItemDetailScreen({ id }: { id: string }) {
  const { t, lang, detail, isLoading, error, isGone, reload, applyImageChange } = useItemDetail(id);
  const profiles = useItemProfiles(
    id,
    detail?.companyProfile ?? null,
    detail?.branchProfile ?? null,
    reload,
  );
  const listings = useItemListings(id, Boolean(detail?.companyProfile));

  const item = detail?.item ?? null;
  const companyProfile = detail?.companyProfile ?? null;
  const branchProfile = detail?.branchProfile ?? null;

  const subtitleParts = item
    ? [
        item.canonicalCode,
        item.localizedNames.ar ? `${t.trade.nameAr}: ${item.localizedNames.ar}` : null,
        item.categorySummary
          ? `${t.trade.itemCategory}: ${item.categorySummary.path.map((segment) => segment.name).join(" / ")}`
          : null,
        `v${item.version}`,
        formatDateTime(item.updatedAt, lang),
      ].filter(Boolean)
    : [];

  return (
    <PermissionGate require={TRADE_PERMISSIONS.itemsRead}>
      <div className="flex flex-col gap-3">
        {/* Top Identity & KPI Strip Card */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-2xs">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            {/* Outside the loading branch below, so a reload after a stale image
                write keeps the picked file on screen (LLD 02b §19 Edit flow). */}
            {item ? (
              <ItemImageManager
                item={item}
                size="lg"
                onChanged={applyImageChange}
                onStale={reload}
              />
            ) : null}
            <DetailHeader
              className="pb-0!"
              title={
                item
                  ? tradeLocalizedName(item.localizedNames, lang) || item.canonicalCode
                  : t.trade.itemsTitle
              }
              subtitle={subtitleParts.length > 0 ? subtitleParts.join(" · ") : item?.canonicalCode}
              backHref={TENANT_ROUTES.tradeItems}
              backLabel={t.trade.backToItems}
              status={
                item ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={item.status === "ACTIVE" ? "positive" : "neutral"}>
                      {isItemStatus(item.status) ? t.trade[`itemStatus_${item.status}`] : item.status}
                    </Badge>
                    <Badge tone="brand">
                      {isItemKind(item.itemKind) ? t.trade[`itemKind_${item.itemKind}`] : item.itemKind}
                    </Badge>
                    <Badge tone="neutral">
                      <IdentifierText>{item.canonicalCode}</IdentifierText>
                    </Badge>
                    {item.categorySummary ? (
                      <Badge tone="caution">
                        {item.categorySummary.path.map((segment) => segment.name).join(" / ")}
                      </Badge>
                    ) : null}
                  </div>
                ) : null
              }
            />
          </div>

          {item ? (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-md border border-border bg-info-subtle/60 px-2.5 py-1 text-xs">
                <span className="text-muted-foreground">{t.trade.itemSalesPrice}:</span>
                <span className="font-semibold text-info-subtle-foreground">
                  {companyProfile?.salesPrice ? (
                    <IdentifierText>
                      {`${formatTradeDecimal(companyProfile.salesPrice)}${companyProfile.currencyCode ? ` ${companyProfile.currencyCode}` : ""}`}
                    </IdentifierText>
                  ) : (
                    "—"
                  )}
                </span>
              </div>

              <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2.5 py-1 text-xs">
                <span className="text-muted-foreground">{t.trade.listingsTitle}:</span>
                <Badge tone={!listings.scopeGap && listings.pageInfo.total > 0 ? "positive" : "neutral"}>
                  <IdentifierText>
                    {companyProfile && !listings.scopeGap ? String(listings.pageInfo.total) : "0"}
                  </IdentifierText>
                </Badge>
              </div>
            </div>
          ) : null}
        </div>

        <TradeScopeBar allowItemMaster hideWhenSingleScope />

        {isLoading ? (
          <Skeleton className="h-64" />
        ) : isGone ? (
          <NotFoundState
            title={t.trade.itemNotFoundTitle}
            description={t.trade.itemNotFoundDescription}
            backHref={TENANT_ROUTES.tradeItems}
            backLabel={t.trade.backToItems}
          />
        ) : error || !item ? (
          <ErrorState title={t.trade.itemLoadFailed} onRetry={reload} retryLabel={t.common.retry} />
        ) : (
          <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-12">
            {/* LEFT COLUMN (7 Cols): Master Item View & Inline Edit in Place */}
            <div className="xl:col-span-7">
              <ItemIdentityDetails item={item} onSaved={reload} />
            </div>

            {/* RIGHT COLUMN (5 Cols): Scoped Company Profile, Standard Cost, Branch Profile & Channel Listings */}
            <div className="flex flex-col gap-3 xl:col-span-5">
              {/* Card 4: Company Profile & Protected Standard Cost */}
              <section className="flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-2xs">
                <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-2.5">
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-info-subtle text-info-subtle-foreground">
                      <Building2 className="size-3.5" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-xs font-semibold tracking-tight text-foreground">
                        4. {t.trade.companyProfileTitle}
                      </h2>
                      <p className="truncate text-xs text-muted-foreground">
                        {t.trade.companyProfileDescription}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {companyProfile ? (
                      <Badge tone="positive">
                        <IdentifierText>{`v${companyProfile.version}`}</IdentifierText>
                      </Badge>
                    ) : null}
                    {profiles.canManage && !profiles.companyScopeGap ? (
                      <Button variant="outline" size="xs" onClick={profiles.openCompany}>
                        {companyProfile ? (
                          <Pencil className="size-3.5" aria-hidden="true" />
                        ) : (
                          <Plus className="size-3.5" aria-hidden="true" />
                        )}
                        {companyProfile ? t.trade.companyProfileSave : t.trade.companyProfileCreate}
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="p-4">
                  {companyProfile ? (
                    <CompanyProfileDetails
                      companyProfile={companyProfile}
                      itemId={item.id}
                      onSaved={reload}
                    />
                  ) : (
                    <p className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
                      {profiles.companyScopeGap
                        ? t.trade.errorMissingCompany
                        : t.trade.companyProfileMissing}
                    </p>
                  )}
                </div>
              </section>

              {/* Card 5: Branch Operational Profile */}
              <section className="flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-2xs">
                <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-2.5">
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-success-subtle text-success-subtle-foreground">
                      <MapPin className="size-3.5" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-xs font-semibold tracking-tight text-foreground">
                        5. {t.trade.branchProfileTitle}
                      </h2>
                      <p className="truncate text-xs text-muted-foreground">
                        {t.trade.branchProfileDescription}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {branchProfile ? (
                      <Badge tone={branchProfile.isAssorted ? "positive" : "neutral"}>
                        <IdentifierText>{`v${branchProfile.version}`}</IdentifierText>
                      </Badge>
                    ) : null}
                    {profiles.canManage && !profiles.branchScopeGap && companyProfile ? (
                      <Button variant="outline" size="xs" onClick={profiles.openBranch}>
                        {branchProfile ? (
                          <Pencil className="size-3.5" aria-hidden="true" />
                        ) : (
                          <Plus className="size-3.5" aria-hidden="true" />
                        )}
                        {branchProfile ? t.trade.branchProfileSave : t.trade.branchProfileCreate}
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="p-4">
                  {branchProfile ? (
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                      <div
                        className={`flex flex-col gap-0.5 rounded-lg border px-2.5 py-2 ${
                          branchProfile.isAssorted
                            ? "border-border bg-success-subtle text-success-subtle-foreground"
                            : "border-border bg-muted/35 text-muted-foreground"
                        }`}
                      >
                        <span className="text-xs font-medium">{t.trade.isAssorted}</span>
                        <span className="flex items-center gap-1 text-xs font-semibold">
                          {branchProfile.isAssorted ? (
                            <Check className="size-3" aria-hidden />
                          ) : null}
                          {branchProfile.isAssorted ? t.common.active : t.common.inactive}
                        </span>
                      </div>

                      <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-muted/35 px-2.5 py-2">
                        <span className="text-xs text-muted-foreground">
                          {t.trade.defaultFulfillmentNode}
                        </span>
                        <span className="text-xs font-semibold text-foreground">
                          {branchProfile.defaultFulfillmentNodeId ? (
                            <IdentifierText className="text-xs">
                              {branchProfile.defaultFulfillmentNodeId}
                            </IdentifierText>
                          ) : (
                            "—"
                          )}
                        </span>
                      </div>

                      <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-muted/35 px-2.5 py-2">
                        <span className="text-xs text-muted-foreground">
                          {t.trade.replenishmentPolicyKey}
                        </span>
                        <span className="text-xs font-semibold text-foreground">
                          {branchProfile.replenishmentPolicyKey ? (
                            <IdentifierText className="text-xs">
                              {branchProfile.replenishmentPolicyKey}
                            </IdentifierText>
                          ) : (
                            "—"
                          )}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
                      {profiles.companyScopeGap
                        ? t.trade.errorMissingCompany
                        : !companyProfile
                          ? t.trade.branchProfileRequiresCompany
                          : profiles.branchScopeGap
                            ? t.trade.channelBranchScopeRequired
                            : t.trade.branchProfileMissing}
                    </p>
                  )}
                </div>
              </section>

              {/* Card 6: Scoped Channel Listings */}
              <section className="flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-2xs">
                <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-2.5">
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-info-subtle text-info-subtle-foreground">
                      <Globe className="size-3.5" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-xs font-semibold tracking-tight text-foreground">
                        6. {t.trade.listingsTitle}
                      </h2>
                      <p className="truncate text-xs text-muted-foreground">
                        {t.trade.listingsDescription}
                      </p>
                    </div>
                  </div>

                  {listings.canManage && !listings.scopeGap && companyProfile ? (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button variant="primary" size="xs" onClick={listings.openCreate}>
                        <Plus className="size-3.5" aria-hidden="true" />
                        {t.trade.listingCreate}
                      </Button>
                    </div>
                  ) : null}
                </div>

                <div className="p-4">
                  {listings.scopeGap ? (
                    <p className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
                      {t.trade.errorMissingCompany}
                    </p>
                  ) : listings.isLoading ? (
                    <Skeleton className="h-24" />
                  ) : listings.error ? (
                    <ErrorState
                      title={t.trade.listingLoadFailed}
                      onRetry={() => void listings.reload()}
                      retryLabel={t.common.retry}
                    />
                  ) : listings.listings.length === 0 ? (
                    <p className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
                      {t.trade.listingEmpty}
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <ul className="flex flex-col gap-2">
                        {listings.listings.map((listing) => (
                          <li
                            key={listing.id}
                            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/25 p-2.5"
                          >
                            <span className="min-w-0">
                              <span className="flex items-center gap-1.5">
                                <Badge tone="brand">
                                  <IdentifierText className="text-xs">
                                    {listing.channelId}
                                  </IdentifierText>
                                </Badge>
                              </span>
                              <span className="mt-1 block text-xs text-muted-foreground">
                                {formatDateTime(listing.updatedAt, lang)}
                              </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-2">
                              <Badge
                                tone={
                                  listing.publicationStatus === "PUBLISHED" ? "positive" : "neutral"
                                }
                              >
                                <IdentifierText>{listing.publicationStatus}</IdentifierText>
                              </Badge>
                              {listings.canManage ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="xs"
                                      aria-label={t.trade.listingEditTitle}
                                      onClick={() => listings.openEdit(listing)}
                                    >
                                      <Pencil className="size-3.5" aria-hidden="true" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>{t.trade.listingEditTitle}</TooltipContent>
                                </Tooltip>
                              ) : null}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <Pagination
                        page={listings.pageInfo}
                        onPageChange={listings.setPage}
                        labels={{
                          previous: t.common.previousPage,
                          next: t.common.nextPage,
                          summary: (from, to, total) =>
                            formatTemplate(t.common.showingOf, { from, to, total }),
                        }}
                      />
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}

        <CompanyProfileDrawer
          key={`company-${detail?.companyProfile?.version ?? "new"}-${profiles.companyOpen}`}
          open={profiles.companyOpen}
          itemKind={item?.itemKind ?? "PRODUCT"}
          profile={detail?.companyProfile ?? null}
          isSubmitting={profiles.isSubmitting}
          error={profiles.companyFormError}
          onClose={profiles.closeCompany}
          onSubmit={profiles.saveCompanyProfile}
        />

        <BranchProfileDrawer
          key={`branch-${detail?.branchProfile?.version ?? "new"}-${profiles.branchOpen}`}
          open={profiles.branchOpen}
          profile={detail?.branchProfile ?? null}
          isSubmitting={profiles.isSubmitting}
          error={profiles.branchFormError}
          onClose={profiles.closeBranch}
          onSubmit={profiles.saveBranchProfile}
        />

        <ListingDrawer
          key={`listing-${listings.editing?.id ?? "new"}-${listings.createOpen}`}
          open={listings.createOpen || listings.editing !== null}
          listing={listings.editing}
          isSubmitting={listings.isSubmitting}
          error={listings.formError}
          onClose={() => {
            listings.closeCreate();
            listings.closeEdit();
          }}
          onSubmit={listings.save}
        />
      </div>
    </PermissionGate>
  );
}

function CompanyProfileDetails({
  companyProfile,
  itemId,
  onSaved,
}: {
  companyProfile: ItemCompanyProfile;
  itemId: string;
  onSaved: () => void;
}) {
  const { t, lang } = useI18n();
  const salesUoms = useCatalogUoms("SALES", Boolean(companyProfile.defaultSalesUomId));
  const purchaseUoms = useCatalogUoms("PURCHASE", Boolean(companyProfile.defaultPurchaseUomId));
  const masterUoms = useActiveUoms(
    Boolean(companyProfile.defaultSalesUomId || companyProfile.defaultPurchaseUomId),
  );
  const taxReference = useItemReferenceData(
    Boolean(companyProfile.salesTaxId || companyProfile.purchaseTaxId),
  );

  const allMasterUoms = masterUoms.all ?? masterUoms.options;
  const resolvedSalesUom =
    salesUoms.options.find((uom) => uom.id === companyProfile.defaultSalesUomId) ??
    allMasterUoms.find((uom) => uom.id === companyProfile.defaultSalesUomId);
  const resolvedPurchaseUom =
    purchaseUoms.options.find((uom) => uom.id === companyProfile.defaultPurchaseUomId) ??
    allMasterUoms.find((uom) => uom.id === companyProfile.defaultPurchaseUomId);
  const resolvedSalesUomName = resolvedSalesUom
    ? (resolvedSalesUom.localizedNames
        ? tradeLocalizedName(resolvedSalesUom.localizedNames, lang)
        : "") || resolvedSalesUom.displayName
    : null;
  const resolvedPurchaseUomName = resolvedPurchaseUom
    ? (resolvedPurchaseUom.localizedNames
        ? tradeLocalizedName(resolvedPurchaseUom.localizedNames, lang)
        : "") || resolvedPurchaseUom.displayName
    : null;
  const resolvedSalesTax = taxReference.taxes.find(
    (tax) => tax.id === companyProfile.salesTaxId,
  );
  const resolvedPurchaseTax = taxReference.taxes.find(
    (tax) => tax.id === companyProfile.purchaseTaxId,
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Colorful Capability Tiles */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div
          className={`flex flex-col gap-0.5 rounded-lg border px-2.5 py-2 ${
            companyProfile.canSell
              ? "border-border bg-success-subtle text-success-subtle-foreground"
              : "border-border bg-muted/35 text-muted-foreground"
          }`}
        >
          <span className="text-xs font-medium">{t.trade.canSell}</span>
          <span className="flex items-center gap-1 text-xs font-semibold">
            {companyProfile.canSell ? <Check className="size-3" aria-hidden /> : null}
            {companyProfile.canSell ? t.common.active : t.common.inactive}
          </span>
        </div>

        <div
          className={`flex flex-col gap-0.5 rounded-lg border px-2.5 py-2 ${
            companyProfile.canPurchase
              ? "border-border bg-success-subtle text-success-subtle-foreground"
              : "border-border bg-muted/35 text-muted-foreground"
          }`}
        >
          <span className="text-xs font-medium">{t.trade.canPurchase}</span>
          <span className="flex items-center gap-1 text-xs font-semibold">
            {companyProfile.canPurchase ? <Check className="size-3" aria-hidden /> : null}
            {companyProfile.canPurchase ? t.common.active : t.common.inactive}
          </span>
        </div>

        <div
          className={`flex flex-col gap-0.5 rounded-lg border px-2.5 py-2 ${
            companyProfile.canPos
              ? "border-border bg-info-subtle text-info-subtle-foreground"
              : "border-border bg-muted/35 text-muted-foreground"
          }`}
        >
          <span className="text-xs font-medium">{t.trade.canPos}</span>
          <span className="flex items-center gap-1 text-xs font-semibold">
            {companyProfile.canPos ? <Check className="size-3" aria-hidden /> : null}
            {companyProfile.canPos ? t.common.active : t.common.inactive}
          </span>
        </div>

        <div
          className={`flex flex-col gap-0.5 rounded-lg border px-2.5 py-2 ${
            companyProfile.trackInventory
              ? "border-border bg-warning-subtle text-warning-subtle-foreground"
              : "border-border bg-muted/35 text-muted-foreground"
          }`}
        >
          <span className="text-xs font-medium">{t.trade.trackingMode}</span>
          <span className="text-xs font-semibold">
            {isTrackingMode(companyProfile.trackingMode)
              ? t.trade[`trackingMode_${companyProfile.trackingMode}`]
              : companyProfile.trackingMode}
          </span>
        </div>
      </div>

      {/* Commercial UoMs & Sales Price Grid */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-muted/35 px-2.5 py-2">
          <span className="text-xs text-muted-foreground">{t.trade.defaultSalesUom}</span>
          <span className="text-xs font-semibold text-foreground">
            {resolvedSalesUom ? (
              `${resolvedSalesUom.code} — ${resolvedSalesUomName}`
            ) : companyProfile.defaultSalesUomId ? (
              <IdentifierText className="text-xs">
                {companyProfile.defaultSalesUomId}
              </IdentifierText>
            ) : (
              "—"
            )}
          </span>
        </div>

        <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-muted/35 px-2.5 py-2">
          <span className="text-xs text-muted-foreground">{t.trade.defaultPurchaseUom}</span>
          <span className="text-xs font-semibold text-foreground">
            {resolvedPurchaseUom ? (
              `${resolvedPurchaseUom.code} — ${resolvedPurchaseUomName}`
            ) : companyProfile.defaultPurchaseUomId ? (
              <IdentifierText className="text-xs">
                {companyProfile.defaultPurchaseUomId}
              </IdentifierText>
            ) : (
              "—"
            )}
          </span>
        </div>

        <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-info-subtle px-2.5 py-2 text-info-subtle-foreground">
          <span className="text-xs font-medium">{t.trade.itemSalesPrice}</span>
          <span className="text-xs font-semibold">
            {companyProfile.salesPrice ? (
              <IdentifierText>
                {`${formatTradeDecimal(companyProfile.salesPrice)}${companyProfile.currencyCode ? ` ${companyProfile.currencyCode}` : ""}`}
              </IdentifierText>
            ) : (
              "—"
            )}
          </span>
        </div>
      </div>

      {/* Taxes & Accounting Mapping Keys */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-muted/35 px-2.5 py-2">
          <span className="text-xs text-muted-foreground">{t.trade.itemSalesTax}</span>
          <span className="text-xs font-semibold text-foreground">
            {resolvedSalesTax ? (
              `${resolvedSalesTax.code} (${formatTradeDecimal(resolvedSalesTax.rate)}%)`
            ) : companyProfile.salesTaxId ? (
              <IdentifierText className="text-xs">{companyProfile.salesTaxId}</IdentifierText>
            ) : (
              "—"
            )}
          </span>
        </div>

        <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-muted/35 px-2.5 py-2">
          <span className="text-xs text-muted-foreground">{t.trade.itemPurchaseTax}</span>
          <span className="text-xs font-semibold text-foreground">
            {resolvedPurchaseTax ? (
              `${resolvedPurchaseTax.code} (${formatTradeDecimal(resolvedPurchaseTax.rate)}%)`
            ) : companyProfile.purchaseTaxId ? (
              <IdentifierText className="text-xs">{companyProfile.purchaseTaxId}</IdentifierText>
            ) : (
              "—"
            )}
          </span>
        </div>

        <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-muted/35 px-2.5 py-2">
          <span className="text-xs text-muted-foreground">{t.trade.taxClassificationKey}</span>
          <span className="text-xs font-semibold text-foreground">
            {companyProfile.taxClassificationKey ? (
              <IdentifierText className="text-xs">
                {companyProfile.taxClassificationKey}
              </IdentifierText>
            ) : (
              "—"
            )}
          </span>
        </div>

        <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-muted/35 px-2.5 py-2">
          <span className="text-xs text-muted-foreground">{t.trade.accountingMappingKey}</span>
          <span className="text-xs font-semibold text-foreground">
            {companyProfile.accountingMappingKey ? (
              <IdentifierText className="text-xs">
                {companyProfile.accountingMappingKey}
              </IdentifierText>
            ) : (
              "—"
            )}
          </span>
        </div>
      </div>

      {/* Protected Standard Cost Banner inside Company Profile Card */}
      <ItemStandardCostSection
        key={`standard-cost-${companyProfile.version}`}
        itemId={itemId}
        salesPrice={companyProfile.salesPrice}
        onSaved={onSaved}
      />
    </div>
  );
}
