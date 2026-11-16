"use client";

import { use } from "react";
import { Building2 } from "lucide-react";
import {

  Button,
  EmptyState,
  ErrorState,
  NotFoundState,
  PermissionGate,
  Skeleton,
} from "@/design-system";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { PriceBookLeaveDialog } from "../workspace/PriceBookLeaveDialog";
import { VersionPublishModal } from "../../price-book-versions/[id]/components/VersionPublishModal";
import { PRICING_READ_PERMISSION } from "../pricing-contract";
import { PriceBookWriteRecovery } from "../workspace/PriceBookWriteRecovery";
import { CreateDraftVersionModal } from "../workspace/CreateDraftVersionModal";
import { EditPriceBookModal } from "../workspace/EditPriceBookModal";
import { PriceBookIdentityHeader } from "../workspace/PriceBookIdentityHeader";
import { PriceBookVersionTimeline } from "../workspace/PriceBookVersionTimeline";
import { VersionGovernanceSideRail } from "../workspace/VersionGovernanceSideRail";
import { VersionWorkspaceTabs } from "../workspace/VersionWorkspaceTabs";
import { usePriceBookDetail } from "./hooks/usePriceBookDetail";
import { usePriceBookWorkspaceUi } from "../workspace/hooks/usePriceBookWorkspaceUi";

export default function PriceBookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const {
    t, user, scope, companyName, isOffline, canManage, canManageDefaults,
    detail, isLoading, queryError, isNotFound, isDenied, isBusy, bookAmbiguous, bookPending,
    actionError, clearActionError, hasEffectiveVersionNow, selectedVersion, selectVersion,
    versionWorkspace: vw, reference, updateMetadata, toggleCompanyDefault, cloneOrSeedVersion, reload,
  } = usePriceBookDetail(id);

  const ui = usePriceBookWorkspaceUi({ scopeKey: JSON.stringify([id, user?.id, scope.headers]),
    unknownWrite: Boolean(bookAmbiguous || vw.ambiguous), isDirty: vw.isDirty,
    onDiscardDraft: vw.discardChanges, clearActionError, onUpdateBook: updateMetadata, onCreateDraft: cloneOrSeedVersion });
  const { activeTab, setActiveTab, createDraftOpen, setCreateDraftOpen, createSourceVersionId,
    editBookOpen, setEditBookOpen, publishOpen, setPublishOpen, retireOpen, setRetireOpen, deleteOpen, setDeleteOpen } = ui;
  const leaveDialog = <PriceBookLeaveDialog guard={ui.leaveGuard} unknownWrite={Boolean(bookAmbiguous || vw.ambiguous)} />;
  if (isNotFound) {
    return (
      <>
        {leaveDialog}
      <NotFoundState
        title={t.tradePricing.bookDetailNotFound}
        description={t.tradePricing.bookDetailNotFoundDesc}
        backLabel={t.tradePricing.backToBooks}
        backHref={TENANT_ROUTES.tradePriceBooks}
      />
      </>
    );
  }

  if (!scope.isResolved) {
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

  if (isDenied) {
    return (
      <>
        {leaveDialog}
      <PermissionGate
        require={PRICING_READ_PERMISSION}
        denied={queryError?.status === 403 || vw.error?.status === 403}
      >
        {null}
      </PermissionGate>
      </>
    );
  }

  if (isLoading && !detail) {
    return (
      <>
        {leaveDialog}
      <div className="flex flex-col gap-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-28" />
        <Skeleton className="h-96" />
      </div>
      </>
    );
  }

  if (queryError && !detail) {
    return (
      <>
        {leaveDialog}
      <ErrorState
        title={t.tradePricing.booksLoadFailed}
        description={queryError.message}
        onRetry={() => void reload()}
        retryLabel={t.common.retry}
      />
      </>
    );
  }

  if (!detail) return leaveDialog;

  const canViewCost = vw.detail?.canViewCost ?? reference.data?.canViewCost;
  const companyScopeLabel = companyName;
  const handleOpenCreateDraft = ui.openCreateDraft;

  return (
    <div className="flex flex-col gap-4">
      {queryError ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/30 bg-warning-subtle p-3 text-xs text-warning-subtle-foreground">
          <span>{t.tradePricing.booksLoadFailed}</span>
          <Button size="xs" variant="outline" onClick={() => void reload()}>{t.common.retry}</Button>
        </div>
      ) : null}
      {actionError ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/30 bg-warning-subtle p-3 text-xs text-warning-subtle-foreground">
          <span>{actionError}</span>
          <Button size="xs" variant="ghost" onClick={clearActionError}>{t.common.close}</Button>
        </div>
      ) : null}
      {bookAmbiguous ? (
        <PriceBookWriteRecovery command={bookAmbiguous} pending={bookPending !== null} onResolved={() => { setCreateDraftOpen(false); setEditBookOpen(false); }} />
      ) : null}

      <PriceBookIdentityHeader
        detail={detail}
        companyScopeLabel={companyScopeLabel}
        selectedVersion={selectedVersion}
        hasEffectiveVersionNow={hasEffectiveVersionNow}
        canManage={canManage}
        canManageDefaults={canManageDefaults}
        canViewCost={canViewCost}
        isOffline={isOffline}
        isDirty={vw.isDirty}
        canTest={vw.canTest}
        canPublish={vw.canPublish}
        canPublishGrant={vw.canPublishGrant}
        canRetire={vw.canRetire}
        canDeleteDraft={vw.canDeleteDraft}
        pending={vw.pending}
        isBookBusy={isBusy || Boolean(queryError) || Boolean(vw.ambiguous) || Boolean(vw.error) || vw.isLoading || vw.pending !== null || vw.mutationError?.status === 403}
        onSaveDraft={() => void vw.saveDraft()}
        onDiscardDraft={vw.discardChanges}
        onRunTest={() => void vw.test()}
        onOpenPublish={() => setPublishOpen(true)}
        onOpenCreateDraft={handleOpenCreateDraft}
        onOpenEditBook={ui.openEditBook}
        onToggleBookActive={() => void updateMetadata({ status: detail.book.status === "INACTIVE" ? "ACTIVE" : "INACTIVE" })}
        onToggleCompanyDefault={() => void toggleCompanyDefault()}
        onOpenCompareTab={() => setActiveTab("comparison")}
        onOpenRetire={() => setRetireOpen(true)}
        onOpenDeleteDraft={() => setDeleteOpen(true)}
      />

      <PriceBookVersionTimeline
        versions={detail.versions}
        selectedVersionId={selectedVersion?.id ?? null}
        isDirty={vw.isDirty}
        canManage={canManage}
        isBusy={isBusy || vw.pending !== null || Boolean(vw.ambiguous)}
        isOffline={isOffline}
        onSelectVersion={(nextId) => selectVersion(nextId)}
        onCreateDraft={() => handleOpenCreateDraft(selectedVersion?.id)}
      />

      {detail.versions.length > 0 ? (
        vw.isLoading && !vw.detail ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <Skeleton className="h-96 lg:col-span-8 xl:col-span-9" />
            <Skeleton className="h-96 lg:col-span-4 xl:col-span-3" />
          </div>
        ) : vw.error && !vw.detail ? (
          <ErrorState
            title={t.tradePricing.versionLoadFailed}
            description={vw.error.message}
            onRetry={() => void vw.reload()}
            retryLabel={t.common.retry}
          />
        ) : vw.detail && vw.draft ? (
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
            <div className="lg:col-span-8 xl:col-span-9">
              <VersionWorkspaceTabs isRefreshing={vw.isLoading} versionError={vw.error} onRetryVersion={() => void vw.reload()} mutationError={vw.mutationError} mutationPermission={vw.mutationPermission}
                activeTab={activeTab}
                onChangeTab={setActiveTab}
                detail={vw.detail}
                bookDetail={detail}
                allVersions={detail.versions}
                draft={vw.draft}
                onChangeDraft={(updater) => vw.setDraft((prev) => (prev ? updater(prev) : prev))}
                editable={vw.isEditableStatus && canManage}
                canManage={canManage}
                canTest={vw.canTest}
                isDirty={vw.isDirty}
                isOffline={isOffline}
                pending={vw.pending}
                savedEvidenceMatchesChecksum={vw.savedEvidenceMatchesChecksum}
                conflictReport={vw.conflictReport}
                testReport={vw.testReport}
                diffResult={vw.diffResult}
                isDiffLoading={vw.isDiffLoading}
                referenceData={reference.data}
                channelBranchIdsByChannel={reference.channelBranchIdsByChannel}
                referenceError={reference.error}
                ambiguous={vw.ambiguous}
                replayNotice={vw.replayNotice}
                staleConflict={vw.staleConflict}
                retireOpen={retireOpen}
                onRetireOpenChange={setRetireOpen}
                deleteOpen={deleteOpen}
                onDeleteOpenChange={setDeleteOpen}
                onSaveDraft={() => void vw.saveDraft()}
                onDiscardDraft={vw.discardChanges}
                onRunTest={() => void vw.test()}
                onConfirmRetire={vw.retire}
                onConfirmDelete={vw.deleteDraft}
                onLoadDiff={vw.loadDiff}
                onSelectTargetVersion={(targetId) => selectVersion(targetId)}
                onRetryReference={reference.reload}
    
                onAcceptServerReload={vw.acceptServerReloadOnConflict}
              />
            </div>
            <div className="lg:col-span-4 xl:col-span-3">
              <VersionGovernanceSideRail
                detail={vw.detail}
                bookDetail={detail}
                draft={vw.draft}
                isDirty={vw.isDirty}
                canTest={vw.canTest}
                canPublish={vw.canPublish}
                canPublishGrant={vw.canPublishGrant}
                isMakerSameAsActor={vw.isMakerSameAsActor}
                soloEligible={vw.soloEligible}
                savedEvidenceMatchesChecksum={vw.savedEvidenceMatchesChecksum}
                isOffline={isOffline}
                pending={vw.pending}
                testReport={vw.testReport}
                onRunTest={() => void vw.test()}
                onOpenPublish={() => setPublishOpen(true)}
              />
            </div>
          </div>
        ) : null
      ) : null}

      <CreateDraftVersionModal
        key={`${detail.book.id}-create-${ui.createSession}`}
        open={createDraftOpen}
        onOpenChange={setCreateDraftOpen}
        detail={detail}
        books={reference.books}
        initialSourceVersionId={createSourceVersionId}
        isSubmitting={isBusy}
        error={actionError}
        onSubmit={ui.createDraft}
      />

      <EditPriceBookModal
        key={`${detail.book.id}-edit-${detail.book.version}-${ui.editSession}`}
        open={editBookOpen}
        onOpenChange={setEditBookOpen}
        detail={detail}
        isSubmitting={isBusy}
        error={actionError}
        onSubmit={ui.saveBook}
      />

      {vw.detail ? (
        <VersionPublishModal
          open={publishOpen}
          onOpenChange={setPublishOpen}
          detail={vw.detail}
          siblingVersions={detail.versions}
          currentUserId={user?.id}
          currentUserDisplayName={([user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email)}
          currentUserEmail={user?.email}
          canPublishGrant={vw.canPublishGrant}
          savedEvidenceMatchesChecksum={vw.savedEvidenceMatchesChecksum}
          canPublish={vw.canPublish}
          publishDisabledReasons={vw.publishDisabledReasons}
          supersedesVersionId={vw.supersedesVersionId}
          onChangeSupersedesVersionId={vw.setSupersedesVersionId}
          soloOwnerAttestation={vw.soloOwnerAttestation}
          onChangeSoloOwnerAttestation={vw.setSoloOwnerAttestation}
          approvalNotes={vw.approvalNotes}
          onChangeApprovalNotes={vw.setApprovalNotes}
          isPublishing={vw.pending === "publish"}
          onConfirmPublish={vw.publish}
        />
      ) : null}
      {leaveDialog}
    </div>
  );
}
