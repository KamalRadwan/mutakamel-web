"use client";

import { useVersionWorkspaceInteractions } from "./hooks/useVersionWorkspaceInteractions";
import { RefreshCw } from "lucide-react";
import {
  Badge,
  Button,
  ConflictDialog,
  ConfirmActionModal,
  ReasonDialog,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/design-system";
import type { NormalizedApiError } from "@/lib/api/errors";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { VersionMatrixEditor } from "../../price-book-versions/[id]/components/VersionMatrixEditor";
import { VersionPromotionsStudio } from "../../price-book-versions/[id]/components/VersionPromotionsStudio";
import { VersionTestReadinessPanel } from "../../price-book-versions/[id]/components/VersionTestAndDiffModal";
import {
  RETIRE_REASON_MAX_LENGTH,
  type GovernanceAuditEvent,
  type PriceBookDetail,
  type PriceBookVersionDetail,
  type PriceBookVersionDiff,
  type PriceBookVersionTestReport,
  type PricingReferenceData,
} from "../pricing-contract";
import type {
  PriceBookVersionDraft,
  VersionDraftConflictReport,
} from "../version-draft";
import type { TemporalVersionInput } from "../version-temporal";
import type { AmbiguousMutationState, StaleConflictSnapshot } from "./idempotent-mutation";
import type { VersionPendingAction } from "./useVersionWorkspaceController";
import { VersionActivityPanel } from "./VersionActivityPanel";
import { VersionComparisonPanel } from "./VersionComparisonPanel";
import { VersionValidationBanners } from "./VersionValidationBanners";

export type WorkspaceTabKey = "prices" | "promotions" | "test" | "comparison" | "activity";

interface VersionWorkspaceTabsProps {
  isRefreshing?: boolean;
  versionError?: NormalizedApiError | null;
  onRetryVersion?: () => void;
  mutationError?: NormalizedApiError | null;
  mutationPermission?: string;
  activeTab: WorkspaceTabKey;
  onChangeTab: (next: WorkspaceTabKey) => void;
  detail: PriceBookVersionDetail;
  bookDetail?: PriceBookDetail | null;
  allVersions: readonly TemporalVersionInput[];
  draft: PriceBookVersionDraft;
  onChangeDraft: (updater: (prev: PriceBookVersionDraft) => PriceBookVersionDraft) => void;
  editable: boolean;
  canManage: boolean;
  canTest: boolean;
  isDirty: boolean;
  isOffline: boolean;
  pending: VersionPendingAction;
  savedEvidenceMatchesChecksum: boolean;
  conflictReport: VersionDraftConflictReport | null;
  testReport: PriceBookVersionTestReport | null;
  diffResult: PriceBookVersionDiff | null;
  isDiffLoading: boolean;
  referenceData: PricingReferenceData | null;
  channelBranchIdsByChannel: Record<string, string[]>;
  referenceError: NormalizedApiError | null;
  ambiguous: AmbiguousMutationState | null;
  replayNotice: string | null;
  staleConflict: StaleConflictSnapshot<PriceBookVersionDraft, PriceBookVersionDetail> | null;
  retireOpen: boolean;
  onRetireOpenChange: (open: boolean) => void;
  deleteOpen: boolean;
  onDeleteOpenChange: (open: boolean) => void;
  onSaveDraft: () => void;
  onDiscardDraft: () => void;
  onRunTest: () => void;
  onConfirmRetire: (reason: string) => Promise<boolean>;
  onConfirmDelete: () => Promise<boolean>;
  onLoadDiff: (baselineVersionId: string) => Promise<void>;
  onSelectTargetVersion?: (versionId: string) => void;
  onRetryReference: () => void;

  onAcceptServerReload: () => Promise<void>;
}

export function VersionWorkspaceTabs(props: VersionWorkspaceTabsProps) {
  const {
    activeTab, onChangeTab, detail, bookDetail, allVersions, draft, onChangeDraft,
    editable, canManage, canTest, isDirty, isOffline, pending, savedEvidenceMatchesChecksum,
    conflictReport, testReport, diffResult, isDiffLoading, referenceData, channelBranchIdsByChannel,
    referenceError, ambiguous, replayNotice, staleConflict, retireOpen, onRetireOpenChange,
    deleteOpen, onDeleteOpenChange, onSaveDraft, onDiscardDraft, onRunTest,
    onConfirmRetire, onConfirmDelete, onLoadDiff, onSelectTargetVersion,
    onRetryReference, onAcceptServerReload,
  } = props;
  const { t, lang } = useI18n();
  const interactions = useVersionWorkspaceInteractions(staleConflict, onChangeTab);
  const currencyMeta = referenceData?.currencies.find((c) => c.code === detail.book.currencyCode);
  const auditTrail: readonly GovernanceAuditEvent[] =
    bookDetail?.auditTrail ?? detail.auditTrail ?? [];
  return (
    <div className="flex flex-col gap-3">
      {staleConflict ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/30 bg-warning-subtle px-3.5 py-2.5 text-xs text-warning-subtle-foreground"
        >
          <span>{t.tradePricing.staleConflictKeepEditsHint}</span>
          <Button size="xs" variant="outline" onClick={() => void onAcceptServerReload()}>
            <RefreshCw className="me-1 size-3" aria-hidden="true" />
            {t.crmDashboards.conflictReload}
          </Button>
        </div>
      ) : null}

      <VersionValidationBanners
        versionError={props.versionError}
        isRefreshing={props.isRefreshing}
        onRetryVersion={props.onRetryVersion}
        mutationError={props.mutationError}
        mutationPermission={props.mutationPermission}
        isDirty={isDirty}
        canManage={canManage}
        isOffline={isOffline}
        pending={pending}
        issues={conflictReport?.issues ?? []}
        referenceError={referenceError}
        ambiguous={ambiguous}
        replayNotice={replayNotice}
        onSaveDraft={onSaveDraft}
        onDiscardDraft={onDiscardDraft}
        onRetryReference={onRetryReference}

        onJumpToIssue={interactions.jumpToIssue}
      />

      <Tabs value={activeTab} onValueChange={(v) => onChangeTab(v as WorkspaceTabKey)}>
        <TabsList className="h-auto min-h-10 w-full justify-start overflow-x-auto overflow-y-hidden">
          <TabsTrigger className="shrink-0 whitespace-nowrap" value="prices">
            {t.tradePricing.workspaceTabPrices}
            <Badge tone="neutral" className="ms-1.5">{formatNumber(draft.entries.length, lang)}</Badge>
          </TabsTrigger>
          <TabsTrigger className="shrink-0 whitespace-nowrap" value="promotions">
            {t.tradePricing.workspaceTabPromotions}
            <Badge tone="neutral" className="ms-1.5">{formatNumber(draft.promotions.length, lang)}</Badge>
          </TabsTrigger>
          <TabsTrigger className="shrink-0 whitespace-nowrap" value="test">{t.tradePricing.workspaceTabTestEvidence}</TabsTrigger>
          <TabsTrigger className="shrink-0 whitespace-nowrap" value="comparison">{t.tradePricing.workspaceTabComparison}</TabsTrigger>
          <TabsTrigger className="shrink-0 whitespace-nowrap" value="activity">{t.tradePricing.workspaceTabActivity}</TabsTrigger>
        </TabsList>

        <TabsContent value="prices" className="mt-3">
          <VersionMatrixEditor
            detail={detail}
            draft={draft}
            onChangeDraft={onChangeDraft}
            editable={editable && !props.isRefreshing && !props.versionError && props.mutationError?.status !== 403 && pending === null && ambiguous === null && staleConflict === null}
            items={referenceData?.items ?? []}
            uoms={referenceData?.uoms ?? []}
            currencyDecimalPlaces={currencyMeta?.decimalPlaces}
            focusRequest={interactions.focusRequest}
          />
        </TabsContent>

        <TabsContent value="promotions" className="mt-3">
          <VersionPromotionsStudio
            purpose={detail.book.purpose}
            currencyCode={detail.book.currencyCode}
            draft={draft}
            onChangeDraft={onChangeDraft}
            editable={editable && !props.isRefreshing && !props.versionError && props.mutationError?.status !== 403 && pending === null && ambiguous === null && staleConflict === null}
            items={referenceData?.items ?? []}
            uoms={referenceData?.uoms ?? []}
            branches={referenceData?.branches ?? []}
            channels={referenceData?.channels ?? []}
            channelBranchIdsByChannel={channelBranchIdsByChannel}
            accounts={referenceData?.commercialAccounts ?? []}
            focusRequest={interactions.focusRequest}
          />
        </TabsContent>

        <TabsContent value="test" className="mt-3">
          <VersionTestReadinessPanel
            detail={detail}
            canTest={canTest}
            isTesting={pending === "test"}
            isDirty={isDirty}
            draftEntryCount={draft.entries.length}
            savedEvidenceMatchesChecksum={savedEvidenceMatchesChecksum}
            conflictReport={conflictReport}
            testReport={testReport}
            onRunTest={onRunTest}
          />
        </TabsContent>

        <TabsContent value="comparison" className="mt-3">
          <VersionComparisonPanel
            detail={detail}
            versions={allVersions}
            diffResult={diffResult}
            isDiffLoading={isDiffLoading}
            onLoadDiff={onLoadDiff}
            onSelectTargetVersion={onSelectTargetVersion}
          />
        </TabsContent>

        <TabsContent value="activity" className="mt-3">
          <VersionActivityPanel bookDetail={bookDetail} auditTrail={auditTrail} />
        </TabsContent>
      </Tabs>

      <ConflictDialog
        open={interactions.conflictDialogOpen}
        onOpenChange={interactions.onConflictOpenChange}
        title={t.crmDashboards.conflictTitle}
        description={t.tradePricing.staleConflictKeepEditsHint}
        onReload={() => void onAcceptServerReload()}
        onCancel={interactions.dismissConflict}
        labels={{
          yourChanges: t.crmDashboards.conflictYours,
          theirChanges: t.crmDashboards.conflictTheirs,
          reload: t.crmDashboards.conflictReload,
          overwrite: t.crmDashboards.conflictOverwrite,
          cancel: t.common.cancel,
        }}
      />

      <ReasonDialog
        open={retireOpen}
        onOpenChange={onRetireOpenChange}
        title={t.tradePricing.retireVersionTitle}
        description={t.tradePricing.retireVersionDesc}
        destructive
        showLabel
        maxLength={RETIRE_REASON_MAX_LENGTH}
        loading={pending === "retire"}
        onConfirm={(reason) => {
          void onConfirmRetire(reason).then((ok) => {
            if (ok) onRetireOpenChange(false);
          });
        }}
        labels={{
          reason: t.tradePricing.retiredReasonLabel,
          reasonPlaceholder: t.tradePricing.retireReasonPlaceholder,
          confirm: t.tradePricing.retireVersionAction,
          cancel: t.common.cancel,
        }}
      />

      <ConfirmActionModal
        open={deleteOpen}
        onOpenChange={onDeleteOpenChange}
        title={t.tradePricing.deleteDraftTitle}
        description={t.tradePricing.deleteDraftDesc}
        confirmLabel={t.tradePricing.deleteDraftAction}
        cancelLabel={t.common.cancel}
        loading={pending === "delete"}
        onConfirm={() => {
          void onConfirmDelete().then((ok) => {
            if (ok) onDeleteOpenChange(false);
          });
        }}
      />
    </div>
  );
}
