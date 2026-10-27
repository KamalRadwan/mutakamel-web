"use client";

import { useState } from "react";
import {
  AmbiguousOutcomePanel,
  Button,
  DateTime,
  DetailSection,
  EmptyState,
  ErrorState,
  PermissionGate,
  Skeleton,
  Textarea,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { CrmActionCapability } from "../crm-capabilities";
import { crmCapabilityAllowsOwner } from "../crm-capabilities";
import { CRM_NOTE_BODY_MAX_LENGTH, type CrmNoteSourceType } from "../notes-contract";
import { useCrmNotes } from "../hooks/useCrmNotes";
import {
  useAmbiguousOutcomeLabels,
  useAppliedUnreadableLabels,
} from "../hooks/useAmbiguousOutcomeLabels";
import { useCrmErrorText } from "../hooks/useCrmErrorText";
import { CrmScopeGate } from "./CrmScopeGate";
import { NoteRow } from "./NoteRow";

export interface RecordNotesSectionProps {
  branchId: string | null;
  sourceType: CrmNoteSourceType;
  sourceId: string | null;
  /**
   * Creation uses the source record's owner. Existing note mutations use the
   * server's per-item flags, so reassignment does not transfer authorship.
   */
  sourceOwnerUserId: string | null;
  createCapability: CrmActionCapability | null;
  /** Suppresses every write affordance — READ_ONLY, DUNNING or BLOCKED. */
  readOnly?: boolean;
}

/**
 * Notes on one CRM record, embedded on lead, customer and opportunity detail.
 *
 * Edit/delete admission comes from each note response, independently of create.
 */
export function RecordNotesSection(props: RecordNotesSectionProps) {
  return (
    <PermissionGate require="crm.notes.read" scoped>
      <RecordNotesContent {...props} />
    </PermissionGate>
  );
}

function RecordNotesContent({
  branchId,
  sourceType,
  sourceId,
  sourceOwnerUserId,
  createCapability,
  readOnly = false,
}: RecordNotesSectionProps) {
  const { t } = useI18n();
  const describeError = useCrmErrorText();
  const ambiguousLabels = useAmbiguousOutcomeLabels();
  const appliedLabels = useAppliedUnreadableLabels();
  const notes = useCrmNotes({ branchId, sourceType, sourceId });
  const [draft, setDraft] = useState("");

  const canCreate =
    !readOnly && crmCapabilityAllowsOwner(createCapability, sourceOwnerUserId);
  const trimmedDraft = draft.trim();

  async function submitDraft() {
    if (trimmedDraft.length === 0) return;
    if (await notes.create(trimmedDraft)) setDraft("");
  }

  const writeErrorText = describeError(notes.writeError);

  return (
    <DetailSection title={t.crmNotes.title} description={t.crmNotes.description}>
      {notes.loadError?.status === 403 ? (
        <CrmScopeGate />
      ) : (
        <div className="flex flex-col gap-3">
          {canCreate && (
            <div className="flex flex-col gap-2">
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={CRM_NOTE_BODY_MAX_LENGTH}
                placeholder={t.crmNotes.placeholder}
                aria-label={t.crmNotes.addLabel}
                disabled={notes.isSaving}
              />
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={submitDraft}
                  disabled={trimmedDraft.length === 0 || notes.isSaving}
                >
                  {notes.isSaving ? t.crmNotes.adding : t.crmNotes.add}
                </Button>
              </div>
            </div>
          )}

          {writeErrorText && (
            <ErrorState
              title={t.crmNotes.writeFailed}
              description={writeErrorText}
              onRetry={notes.clearWriteError}
              retryLabel={t.common.dismiss}
            />
          )}

          {notes.ambiguity && (
            <AmbiguousOutcomePanel
              operation={t.crmNotes.operations[notes.ambiguity.operation]}
              idempotencyKey={notes.ambiguity.attempt.idempotencyKey}
              description={t.crmNotes.ambiguousDescription}
              correlationId={notes.ambiguity.error.correlationId}
              onRetry={() => void notes.ambiguity?.replay()}
              onDismiss={notes.dismissAmbiguity}
              labels={ambiguousLabels}
            />
          )}

          {notes.appliedUnreadable && (
            <AmbiguousOutcomePanel
              operation={t.crmNotes.operations.create}
              idempotencyKey={notes.appliedUnreadable.attempt.idempotencyKey}
              description={t.crmShared.appliedUnreadableDescription}
              correlationId={notes.appliedUnreadable.error.correlationId}
              onRetry={notes.reload}
              onDismiss={notes.dismissAppliedUnreadable}
              labels={appliedLabels}
            />
          )}

          {notes.isLoading && (
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          )}

          {!notes.isLoading && notes.loadError && (
            <ErrorState
              title={t.crmNotes.loadFailed}
              description={describeError(notes.loadError) ?? undefined}
              onRetry={notes.reload}
              retryLabel={t.common.retry}
            />
          )}

          {!notes.isLoading && !notes.loadError && notes.notes.length === 0 && (
            <EmptyState
              title={t.crmNotes.emptyTitle}
              description={t.crmNotes.emptyDescription}
            />
          )}

          {!notes.isLoading && !notes.loadError && notes.notes.length > 0 && (
            <ul className="flex flex-col gap-2">
              {notes.notes.map((note) => (
                <NoteRow
                  key={note.id}
                  note={note}
                  canEdit={!readOnly && note.canEdit}
                  canDelete={!readOnly && note.canDelete}
                  isPending={notes.pendingId === note.id}
                  onSave={(body) => notes.update(note.id, body)}
                  onDelete={() => notes.remove(note.id)}
                  timestamp={<DateTime value={note.updatedAt} precision="datetime" />}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </DetailSection>
  );
}
