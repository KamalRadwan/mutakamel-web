"use client";

import { Pencil, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  ConfirmActionModal,
  DetailHeader,
  DetailSection,
  ErrorState,
  NotFoundState,
  PermissionGate,
  Skeleton,
} from "@/design-system";
import { formatDateTime } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { EntityHistoryPanel } from "../../../components/EntityHistoryPanel";
import { useCoreOperationsErrorText } from "../../../hooks/useCoreOperationsErrorText";
import { PARTY_READ_PERMISSION } from "../../directory-contract";
import { usePartyDetail } from "../hooks/usePartyDetail";
import { EditPartyDrawer } from "./EditPartyDrawer";
import { PartyChildSections } from "./PartyChildSections";
import { PartyImageCard } from "./PartyImageCard";

/** `PartyEntity` is audited as `party` — @Auditable() on the entity class. */
const PARTY_AUDIT_ENTITY_TYPE = "party";

export function PartyDetailWorkspace({ id }: { id: string }) {
  const detail = usePartyDetail(id);
  const { t, lang, grants, party } = detail;
  const copy = t.coreOperations.directory;
  const describeError = useCoreOperationsErrorText();

  return (
    <PermissionGate require={PARTY_READ_PERMISSION}>
      <div className="flex flex-col gap-4">
        {detail.isMissing ? (
          <NotFoundState
            title={copy.partyNotFoundTitle}
            description={copy.partyNotFoundDescription}
            backLabel={copy.backToList}
            backHref={TENANT_ROUTES.coreDirectory}
          />
        ) : detail.loadError ? (
          <ErrorState
            title={copy.partyLoadFailed}
            description={describeError(detail.loadError)}
            onRetry={detail.reload}
            retryLabel={t.common.retry}
          />
        ) : detail.isLoading || !party ? (
          <div className="flex flex-col gap-3" role="status" aria-busy="true">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <>
            <DetailHeader
              title={party.displayName}
              subtitle={party.legalName ?? undefined}
              backLabel={copy.backToList}
              backHref={TENANT_ROUTES.coreDirectory}
              breadcrumbs={[
                { label: copy.listTitle, href: TENANT_ROUTES.coreDirectory },
                { label: party.displayName },
              ]}
              status={
                <Badge tone={party.status === "ACTIVE" ? "positive" : "neutral"}>
                  {copy.partyStatuses[party.status]}
                </Badge>
              }
              // Edit is deliberately not the filled primary: `detail-screens.md`
              // caps a screen at one, and promoting Edit into it is the thing
              // that cap exists to prevent.
              secondaryActions={
                grants.canManageParty ? (
                  <>
                    <Button variant="outline" size="sm" onClick={detail.openEdit}>
                      <Pencil className="size-4" aria-hidden="true" />
                      {copy.partyEdit}
                    </Button>
                    <Button variant="outline" size="sm" onClick={detail.openDelete}>
                      <Trash2 className="size-4 text-destructive" aria-hidden="true" />
                      {t.common.delete}
                    </Button>
                  </>
                ) : null
              }
            />

            <DetailSection
              title={copy.identityTitle}
              emptyValueLabel={t.detail.notRecorded}
              fields={[
                { label: copy.fieldPartyType, value: copy.partyTypes[party.partyType] },
                { label: copy.fieldDisplayName, value: party.displayName },
                { label: copy.fieldLegalName, value: party.legalName },
                { label: copy.fieldOrganizationName, value: party.organizationName },
                { label: copy.fieldHonorific, value: party.honorificTitle },
                { label: copy.fieldFirstName, value: party.firstName },
                { label: copy.fieldLastName, value: party.lastName },
                { label: copy.fieldTaxNumber, value: party.taxNumber },
                {
                  label: copy.fieldCommercialRegistration,
                  value: party.commercialRegistrationNumber,
                },
                { label: t.common.status, value: copy.partyStatuses[party.status] },
                { label: copy.fieldCreatedAt, value: formatDateTime(party.createdAt, lang) },
                { label: copy.fieldUpdatedAt, value: formatDateTime(party.updatedAt, lang) },
              ]}
            />

            <PartyImageCard
              party={party}
              setParty={detail.setParty}
              canManage={grants.canManageParty}
            />

            <PartyChildSections party={party} setParty={detail.setParty} grants={grants} />

            <EntityHistoryPanel entityType={PARTY_AUDIT_ENTITY_TYPE} entityId={party.id} />

            <EditPartyDrawer
              key={party.updatedAt}
              party={party}
              isOpen={detail.isEditOpen}
              onClose={detail.closeEdit}
              onSubmit={detail.save}
              isSubmitting={detail.isSubmitting}
              error={detail.formError}
            />

            <ConfirmActionModal
              open={detail.isDeleteOpen}
              onOpenChange={(open) => {
                if (!open) detail.closeDelete();
              }}
              title={copy.partyDeleteTitle}
              description={formatTemplate(copy.partyDeleteDescription, {
                name: party.displayName,
              })}
              confirmLabel={t.common.confirmDelete}
              cancelLabel={t.common.cancel}
              onConfirm={() => void detail.remove()}
              loading={detail.isDeleting}
            />
          </>
        )}
      </div>
    </PermissionGate>
  );
}
