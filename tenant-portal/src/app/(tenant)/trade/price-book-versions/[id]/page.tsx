"use client";

import { use } from "react";
import { Building2 } from "lucide-react";
import {
  EmptyState,
  ErrorState,
  NotFoundState,
  PermissionGate,
  Skeleton,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { PriceBookLeaveDialog } from "../../price-books/workspace/PriceBookLeaveDialog";
import { PRICING_READ_PERMISSION } from "../../price-books/pricing-contract";
import { PriceBookVersionTimeline } from "../../price-books/workspace/PriceBookVersionTimeline";
import { VersionGovernanceSideRail } from "../../price-books/workspace/VersionGovernanceSideRail";
import {
  VersionWorkspaceTabs,
  type WorkspaceTabKey,
} from "../../price-books/workspace/VersionWorkspaceTabs";
import { VersionPublishModal } from "./components/VersionPublishModal";
import {
  VersionDetailHeaderBar,
  VersionStandaloneFallback,
} from "./components/VersionStandaloneFallback";
import { usePriceBookVersion } from "./hooks/usePriceBookVersion";
import { usePriceBookWorkspaceUi } from "../../price-books/workspace/hooks/usePriceBookWorkspaceUi";

function readInitialTab(): WorkspaceTabKey {
  if (typeof window === "undefined") return "prices";
  return new URLSearchParams(window.location.search).get("diff") === "1" ? "comparison" : "prices";
}

export default function PriceBookVersionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useI18n();
  const vm = usePriceBookVersion(id);
  const {
    user, scope, isOffline = false, canRead, canManage = false,
    canPublishGrant = false, canTest, canPublish, canRetire = false,
    canDeleteDraft = false, isEditableStatus = false, isDirty = false,
    isMakerSameAsActor = false, soloEligible = false,
    savedEvidenceMatchesChecksum = false, publishDisabledReasons = [],
    detail, draft, setDraft, discardDraft, conflictReport = null,
    isLoading, queryError, isNotFound, pending, testReport,
    supersedesVersionId, setSupersedesVersionId,
    soloOwnerAttestation = false, setSoloOwnerAttestation,
    approvalNotes = "", setApprovalNotes,
    diffResult = null, isDiffLoading = false,
    ambiguous = null, replayNotice = null,
    staleConflict = null, acceptServerReloadOnConflict,
    reference, navigateToVersion,
    reload, saveDraft, test, publish, retire, deleteDraft, loadDiff,
  } = vm;

  const ui = usePriceBookWorkspaceUi({ scopeKey: JSON.stringify([id, user?.id, scope?.headers]),
    unknownWrite: Boolean(ambiguous), isDirty, initialTab: readInitialTab });
  const { activeTab, setActiveTab, publishOpen, setPublishOpen, retireOpen, setRetireOpen, deleteOpen, setDeleteOpen } = ui;
  const backHref = detail?.book.id
    ? `${TENANT_ROUTES.tradePriceBooks}/${encodeURIComponent(detail.book.id)}?versionId=${encodeURIComponent(detail.version.id)}`
    : TENANT_ROUTES.tradePriceBooks;

  const leaveDialog = <PriceBookLeaveDialog guard={ui.leaveGuard} unknownWrite={Boolean(ambiguous)} />;
  if (isNotFound) {
    return (
      <>
        {leaveDialog}
      <NotFoundState
        title={t.tradePricing.versionNotFound}
        description={t.tradePricing.versionNotFoundDescription}
        backLabel={t.tradePricing.backToBooks}
        backHref={backHref}
      />
      </>
    );
  }

  if (scope && !scope.isResolved) {
    return (
      <>
        {leaveDialog}
      <div className="p-6">
        <EmptyState
          icon={Building2}
          title={t.tradePricing.selectCompanyTitle}
          description={t.tradePricing.selectCompanyDescription}
        />
      </div>
      </>
    );
  }

  if (!canRead || queryError?.status === 403) {
    return (
      <>
        {leaveDialog}
      <PermissionGate require={PRICING_READ_PERMISSION} denied={queryError?.status === 403}>
        {null}
      </PermissionGate>
      </>
    );
  }

  if (isLoading && !detail) return <>{leaveDialog}<Skeleton className="h-96" /></>;

  if (queryError && !detail) {
    return (
      <>
        {leaveDialog}
      <ErrorState
        title={t.tradePricing.versionLoadFailed}
        description={queryError.message}
        onRetry={() => void reload()}
        retryLabel={t.common.retry}
      />
      </>
    );
  }

  if (!detail) return leaveDialog;

  return (
    <div className="flex flex-col gap-4">
      <VersionDetailHeaderBar
        isUnavailable={Boolean(queryError || ambiguous || isLoading) || vm.mutationError?.status === 403}
        detail={detail}
        backHref={backHref}
        hasDraft={Boolean(draft)}
        isDirty={isDirty}
        isOffline={isOffline}
        canManage={canManage}
        canTest={canTest}
        canPublish={canPublish}
        canPublishGrant={canPublishGrant}
        canRetire={canRetire}
        canDeleteDraft={canDeleteDraft}
        publishDisabledReasons={publishDisabledReasons}
        pending={pending}
        onSaveDraft={() => void saveDraft?.()}
        onDiscardDraft={discardDraft}
        onRunTest={() => void test()}
        onOpenPublishModal={() => setPublishOpen(true)}
        onDirectPublish={() => void publish()}
        onOpenRetire={() => setRetireOpen(true)}
        onOpenDeleteDraft={() => setDeleteOpen(true)}
      />

      {!draft ? (
        <VersionStandaloneFallback
          canPublish={canPublish}
          publishDisabledReasons={publishDisabledReasons}
          supersedesVersionId={supersedesVersionId}
          onChangeSupersedesVersionId={setSupersedesVersionId}
          pending={pending}
          testReport={testReport}
        />
      ) : (
        <>
          {(detail.book.versions ?? []).length > 0 ? (
            <PriceBookVersionTimeline
              versions={detail.book.versions ?? []}
              selectedVersionId={detail.version.id}
              isDirty={isDirty}
              canManage={false}
              isOffline={isOffline}
              onSelectVersion={(nextId) => navigateToVersion?.(nextId)}
              onCreateDraft={() => {}}
            />
          ) : null}

          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
            <div className="lg:col-span-8 xl:col-span-9">
              <VersionWorkspaceTabs isRefreshing={isLoading} versionError={queryError} onRetryVersion={() => void reload()} mutationError={vm.mutationError} mutationPermission={vm.mutationPermission}
                activeTab={activeTab}
                onChangeTab={setActiveTab}
                detail={detail}
                allVersions={detail.book.versions ?? []}
                draft={draft}
                onChangeDraft={(updater) => setDraft?.((prev) => (prev ? updater(prev) : prev))}
                editable={isEditableStatus && canManage}
                canManage={canManage}
                canTest={canTest}
                isDirty={isDirty}
                isOffline={isOffline}
                pending={pending}
                savedEvidenceMatchesChecksum={savedEvidenceMatchesChecksum}
                conflictReport={conflictReport}
                testReport={testReport}
                diffResult={diffResult}
                isDiffLoading={isDiffLoading}
                referenceData={reference?.data ?? null}
                channelBranchIdsByChannel={reference?.channelBranchIdsByChannel}
                referenceError={reference?.error ?? null}
                ambiguous={ambiguous}
                replayNotice={replayNotice}
                staleConflict={staleConflict}
                retireOpen={retireOpen}
                onRetireOpenChange={setRetireOpen}
                deleteOpen={deleteOpen}
                onDeleteOpenChange={setDeleteOpen}
                onSaveDraft={() => void saveDraft?.()}
                onDiscardDraft={() => discardDraft?.()}
                onRunTest={() => void test()}
                onConfirmRetire={(reason) => (retire ? retire(reason) : Promise.resolve(false))}
                onConfirmDelete={() => (deleteDraft ? deleteDraft() : Promise.resolve(false))}
                onLoadDiff={(otherId) => (loadDiff ? loadDiff(otherId) : Promise.resolve())}
                onRetryReference={() => reference?.reload()}
                onAcceptServerReload={() => (acceptServerReloadOnConflict ? acceptServerReloadOnConflict() : Promise.resolve())}
              />
            </div>
            <div className="lg:col-span-4 xl:col-span-3">
              <VersionGovernanceSideRail
                detail={detail}
                draft={draft}
                isDirty={isDirty}
                canTest={canTest}
                canPublish={canPublish}
                canPublishGrant={canPublishGrant}
                isMakerSameAsActor={isMakerSameAsActor}
                soloEligible={soloEligible}
                savedEvidenceMatchesChecksum={savedEvidenceMatchesChecksum}
                isOffline={isOffline}
                pending={pending}
                testReport={testReport}
                onRunTest={() => void test()}
                onOpenPublish={() => setPublishOpen(true)}
              />
            </div>
          </div>

          <VersionPublishModal
            open={publishOpen}
            onOpenChange={setPublishOpen}
            detail={detail}
            siblingVersions={detail.book.versions ?? []}
            currentUserId={user?.id}
            currentUserDisplayName={([user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email)}
            currentUserEmail={user?.email}
            canPublishGrant={canPublishGrant}
            savedEvidenceMatchesChecksum={savedEvidenceMatchesChecksum}
            canPublish={canPublish}
            publishDisabledReasons={publishDisabledReasons}
            supersedesVersionId={supersedesVersionId}
            onChangeSupersedesVersionId={setSupersedesVersionId}
            soloOwnerAttestation={soloOwnerAttestation}
            onChangeSoloOwnerAttestation={(val) => setSoloOwnerAttestation?.(val)}
            approvalNotes={approvalNotes}
            onChangeApprovalNotes={(val) => setApprovalNotes?.(val)}
            isPublishing={pending === "publish"}
            onConfirmPublish={() => publish()}
          />
        </>
      )}
      {leaveDialog}
    </div>
  );
}
