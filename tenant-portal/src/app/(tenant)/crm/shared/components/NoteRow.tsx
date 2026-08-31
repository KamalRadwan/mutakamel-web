"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import {
  Button,
  ConfirmActionModal,
  Textarea,
  cn,
  iconSize,
  proseMeasure,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { CRM_NOTE_BODY_MAX_LENGTH, type CrmNote } from "../notes-contract";

export interface NoteRowProps {
  note: CrmNote;
  canEdit: boolean;
  canDelete: boolean;
  isPending: boolean;
  onSave: (body: string) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
  /** A `DateTime` node — the caller formats, this row never parses a date. */
  timestamp: React.ReactNode;
}

/**
 * One note, read by default and editable in place.
 *
 * Delete confirms first. A note is the only record of a phone call nobody wrote
 * down anywhere else, and `DELETE /notes/:id` reports no blockers to render, so
 * this is `ConfirmActionModal` rather than `DeletionBlockerDialog`.
 */
export function NoteRow({
  note,
  canEdit,
  canDelete,
  isPending,
  onSave,
  onDelete,
  timestamp,
}: NoteRowProps) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.body);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function startEditing() {
    setDraft(note.body);
    setEditing(true);
  }

  async function save() {
    if (draft.trim().length === 0) return;
    if (await onSave(draft)) setEditing(false);
  }

  return (
    <li className="rounded-sm border border-border bg-card p-3" aria-busy={isPending}>
      {editing ? (
        <div className="flex flex-col gap-2">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={CRM_NOTE_BODY_MAX_LENGTH}
            aria-label={t.crmNotes.editLabel}
            disabled={isPending}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditing(false)}
              disabled={isPending}
            >
              {t.common.cancel}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={save}
              disabled={isPending || draft.trim().length === 0}
            >
              {t.common.save}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className={cn("whitespace-pre-wrap break-words text-xs text-foreground", proseMeasure)}>
              {note.body}
            </p>
            <span className="text-xs text-muted-foreground">{timestamp}</span>
          </div>
          {canEdit && (
            <Button
              variant="ghost"
              size="xs"
              aria-label={t.crmNotes.editLabel}
              onClick={startEditing}
              disabled={isPending}
              className="shrink-0 cursor-pointer"
            >
              <Pencil className={iconSize({ size: "sm" })} aria-hidden="true" />
            </Button>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              size="xs"
              aria-label={t.crmNotes.deleteLabel}
              onClick={() => setConfirmingDelete(true)}
              disabled={isPending}
              className="shrink-0 cursor-pointer text-destructive"
            >
              <Trash2 className={iconSize({ size: "sm" })} aria-hidden="true" />
            </Button>
          )}
        </div>
      )}

      <ConfirmActionModal
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={t.crmNotes.deleteTitle}
        description={formatTemplate(t.crmNotes.deleteDescription, {
          excerpt: note.body.slice(0, 80),
        })}
        confirmLabel={t.common.confirmDelete}
        cancelLabel={t.common.cancel}
        loading={isPending}
        onConfirm={() => {
          void onDelete().then((deleted) => {
            if (deleted) setConfirmingDelete(false);
          });
        }}
      />
    </li>
  );
}
