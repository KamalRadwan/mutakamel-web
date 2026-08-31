"use client";

import { Pencil, Plus } from "lucide-react";
import {
  Badge,
  Button,
  DetailHeader,
  DetailSection,
  ErrorState,
  NotFoundState,
  Pagination,
  PermissionGate,
  Skeleton,
} from "@/design-system";
import { formatDateTime } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { TradeScopeBar } from "../../TradeScopeBar";
import { TRADE_PERMISSIONS } from "../../trade-scope";
import { tradeLocalizedName } from "../../trade-validation";
import { useItemDetail } from "../hooks/useItemDetail";
import { useItemListings } from "../hooks/useItemListings";
import { useItemProfiles } from "../hooks/useItemProfiles";
import { isItemKind, isItemStatus } from "../item-contract";
import { isTrackingMode } from "../item-profile-contract";
import {
  BranchProfileDrawer,
  CompanyProfileDrawer,
  ListingDrawer,
} from "./ItemProfileDrawers";

export function ItemDetailScreen({ id }: { id: string }) {
  const { t, lang, detail, isLoading, error, isGone, reload } = useItemDetail(id);
  const profiles = useItemProfiles(
    id,
    detail?.companyProfile ?? null,
    detail?.branchProfile ?? null,
    reload,
  );
  const listings = useItemListings(id);

  const item = detail?.item ?? null;

  return (
    <PermissionGate require={TRADE_PERMISSIONS.itemsRead}>
      <div className="flex flex-col gap-4">
        <DetailHeader
          title={
            item ? tradeLocalizedName(item.localizedNames, lang) || item.canonicalCode : t.trade.itemsTitle
          }
          subtitle={item?.canonicalCode}
          backHref={TENANT_ROUTES.tradeItems}
          backLabel={t.trade.backToItems}
          status={
            item ? (
              <Badge tone={item.status === "ACTIVE" ? "positive" : "neutral"}>
                {isItemStatus(item.status) ? t.trade[`itemStatus_${item.status}`] : item.status}
              </Badge>
            ) : null
          }
        />

        <TradeScopeBar />

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
          <>
            <DetailSection
              title={t.trade.itemDetailTitle}
              description={t.trade.itemScopeNote}
              emptyValueLabel="—"
              fields={[
                {
                  label: t.trade.itemCode,
                  value: <span className="font-mono">{item.canonicalCode}</span>,
                },
                {
                  label: t.trade.itemKind,
                  value: isItemKind(item.itemKind)
                    ? t.trade[`itemKind_${item.itemKind}`]
                    : item.itemKind,
                },
                {
                  label: t.trade.itemBaseUom,
                  value: <span className="font-mono text-xs">{item.baseUomId}</span>,
                },
                {
                  label: t.trade.itemCategory,
                  value: item.categoryId ? (
                    <span className="font-mono text-xs">{item.categoryId}</span>
                  ) : null,
                },
                { label: t.trade.version, value: <span className="font-mono">{item.version}</span> },
                { label: t.trade.updatedAt, value: formatDateTime(item.updatedAt, lang) },
                {
                  label: t.trade.itemVariantIdentity,
                  wide: true,
                  value: item.variantIdentity ? (
                    <pre className="overflow-x-auto font-mono text-xs">
                      {JSON.stringify(item.variantIdentity, null, 2)}
                    </pre>
                  ) : null,
                },
              ]}
            />

            <DetailSection
              title={t.trade.companyProfileTitle}
              description={t.trade.companyProfileDescription}
              emptyValueLabel="—"
              action={
                profiles.canManage && !profiles.companyScopeGap ? (
                  <Button variant="outline" size="sm" onClick={profiles.openCompany}>
                    {detail?.companyProfile ? (
                      <Pencil className="size-4" aria-hidden="true" />
                    ) : (
                      <Plus className="size-4" aria-hidden="true" />
                    )}
                    {detail?.companyProfile
                      ? t.trade.companyProfileSave
                      : t.trade.companyProfileCreate}
                  </Button>
                ) : null
              }
              fields={
                detail?.companyProfile
                  ? [
                      {
                        label: t.trade.canSell,
                        value: detail.companyProfile.canSell ? t.common.active : t.common.inactive,
                      },
                      {
                        label: t.trade.canPurchase,
                        value: detail.companyProfile.canPurchase
                          ? t.common.active
                          : t.common.inactive,
                      },
                      {
                        label: t.trade.trackInventory,
                        value: detail.companyProfile.trackInventory
                          ? t.common.active
                          : t.common.inactive,
                      },
                      {
                        label: t.trade.trackingMode,
                        value: isTrackingMode(detail.companyProfile.trackingMode)
                          ? t.trade[`trackingMode_${detail.companyProfile.trackingMode}`]
                          : detail.companyProfile.trackingMode,
                      },
                      {
                        label: t.trade.defaultSalesUom,
                        value: detail.companyProfile.defaultSalesUomId ? (
                          <span className="font-mono text-xs">
                            {detail.companyProfile.defaultSalesUomId}
                          </span>
                        ) : null,
                      },
                      {
                        label: t.trade.defaultPurchaseUom,
                        value: detail.companyProfile.defaultPurchaseUomId ? (
                          <span className="font-mono text-xs">
                            {detail.companyProfile.defaultPurchaseUomId}
                          </span>
                        ) : null,
                      },
                      { label: t.trade.taxClassificationKey, value: detail.companyProfile.taxClassificationKey },
                      { label: t.trade.accountingMappingKey, value: detail.companyProfile.accountingMappingKey },
                    ]
                  : undefined
              }
            >
              {detail?.companyProfile ? null : (
                <p className="text-xs text-muted-foreground">
                  {profiles.companyScopeGap
                    ? t.trade.errorMissingCompany
                    : t.trade.companyProfileMissing}
                </p>
              )}
            </DetailSection>

            <DetailSection
              title={t.trade.branchProfileTitle}
              description={t.trade.branchProfileDescription}
              emptyValueLabel="—"
              action={
                profiles.canManage && !profiles.branchScopeGap ? (
                  <Button variant="outline" size="sm" onClick={profiles.openBranch}>
                    {detail?.branchProfile ? (
                      <Pencil className="size-4" aria-hidden="true" />
                    ) : (
                      <Plus className="size-4" aria-hidden="true" />
                    )}
                    {detail?.branchProfile ? t.trade.branchProfileSave : t.trade.branchProfileCreate}
                  </Button>
                ) : null
              }
              fields={
                detail?.branchProfile
                  ? [
                      {
                        label: t.trade.isAssorted,
                        value: detail.branchProfile.isAssorted
                          ? t.common.active
                          : t.common.inactive,
                      },
                      {
                        label: t.trade.defaultFulfillmentNode,
                        value: detail.branchProfile.defaultFulfillmentNodeId ? (
                          <span className="font-mono text-xs">
                            {detail.branchProfile.defaultFulfillmentNodeId}
                          </span>
                        ) : null,
                      },
                      {
                        label: t.trade.replenishmentPolicyKey,
                        value: detail.branchProfile.replenishmentPolicyKey,
                      },
                    ]
                  : undefined
              }
            >
              {detail?.branchProfile ? null : (
                <p className="text-xs text-muted-foreground">
                  {profiles.branchScopeGap
                    ? t.trade.channelBranchScopeRequired
                    : t.trade.branchProfileMissing}
                </p>
              )}
            </DetailSection>

            <DetailSection
              title={t.trade.listingsTitle}
              description={t.trade.listingsDescription}
              action={
                listings.canManage && !listings.scopeGap ? (
                  <Button variant="outline" size="sm" onClick={listings.openCreate}>
                    <Plus className="size-4" aria-hidden="true" />
                    {t.trade.listingCreate}
                  </Button>
                ) : null
              }
            >
              {listings.scopeGap ? (
                <p className="text-xs text-muted-foreground">{t.trade.errorMissingCompany}</p>
              ) : listings.isLoading ? (
                <Skeleton className="h-24" />
              ) : listings.error ? (
                <ErrorState
                  title={t.trade.listingLoadFailed}
                  onRetry={() => void listings.reload()}
                  retryLabel={t.common.retry}
                />
              ) : listings.listings.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t.trade.listingEmpty}</p>
              ) : (
                <div className="flex flex-col gap-2">
                  <ul className="flex flex-col gap-2">
                    {listings.listings.map((listing) => (
                      <li
                        key={listing.id}
                        className="flex items-center justify-between gap-3 rounded-sm border border-border p-2"
                      >
                        <span className="min-w-0">
                          <span className="block font-mono text-xs text-foreground">
                            {listing.channelId}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {formatDateTime(listing.updatedAt, lang)}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <Badge tone="neutral">
                            <span className="font-mono">{listing.publicationStatus}</span>
                          </Badge>
                          {listings.canManage ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={t.trade.listingEditTitle}
                              onClick={() => listings.openEdit(listing)}
                            >
                              <Pencil className="size-4" aria-hidden="true" />
                            </Button>
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
            </DetailSection>
          </>
        )}

        <CompanyProfileDrawer
          key={`company-${detail?.companyProfile?.version ?? "new"}-${profiles.companyOpen}`}
          open={profiles.companyOpen}
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
