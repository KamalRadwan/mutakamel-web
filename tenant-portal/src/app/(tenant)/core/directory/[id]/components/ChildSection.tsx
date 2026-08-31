"use client";

import type { ReactNode } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  Button,
  ConfirmActionModal,
  DetailSection,
  EmptyState,
  ErrorState,
  Skeleton,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { NormalizedApiError } from "@/lib/api/errors";
import { useCoreOperationsErrorText } from "../../../hooks/useCoreOperationsErrorText";

interface ChildRow {
  id: string;
  primary: ReactNode;
  secondary?: ReactNode;
  trailing?: ReactNode;
}

interface ChildSectionProps {
  title: string;
  description: string;
  rows: ChildRow[];
  emptyTitle: string;
  emptyDescription: string;
  addLabel: string;
  /**
   * Write access for THIS section only. A caller can hold
   * `directory.party.read` and be refused `directory.address.manage`, so the
   * section renders read-only rather than the page refusing to load.
   */
  canManage: boolean;
  readOnlyNotice: string;
  onAdd: () => void;
  onEdit?: (id: string) => void;
  onDelete: (id: string) => void;
  editLabel?: string;
  deleteLabel: string;
  deleteTitle: string;
  deleteDescription: string;
  deletingId: string | null;
  pendingId: string | null;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  isLoading?: boolean;
  loadError?: NormalizedApiError | null;
  onRetry?: () => void;
  loadFailedTitle?: string;
}

export function ChildSection(props: ChildSectionProps) {
  const { t } = useI18n();
  const describeError = useCoreOperationsErrorText();

  return (
    <DetailSection
      title={props.title}
      description={props.description}
      action={
        props.canManage ? (
          <Button variant="outline" size="sm" onClick={props.onAdd}>
            <Plus className="size-4" aria-hidden="true" />
            {props.addLabel}
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">{props.readOnlyNotice}</span>
        )
      }
    >
      {props.loadError ? (
        <ErrorState
          title={props.loadFailedTitle ?? t.common.retry}
          description={describeError(props.loadError)}
          onRetry={props.onRetry}
          retryLabel={t.common.retry}
        />
      ) : props.isLoading ? (
        <div className="flex flex-col gap-2" role="status" aria-busy="true">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : props.rows.length === 0 ? (
        <EmptyState title={props.emptyTitle} description={props.emptyDescription} />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {props.rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2"
              aria-busy={props.pendingId === row.id}
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm text-foreground">{row.primary}</span>
                {row.secondary ? (
                  <span className="truncate text-xs text-muted-foreground">{row.secondary}</span>
                ) : null}
              </span>
              <span className="flex items-center gap-2">
                {row.trailing}
                {props.canManage && props.onEdit ? (
                  <Button
                    variant="ghost"
                    size="xs"
                    aria-label={`${props.editLabel ?? t.common.save}: ${row.id}`}
                    disabled={props.pendingId !== null}
                    onClick={() => props.onEdit?.(row.id)}
                  >
                    <Pencil className="size-3.5" aria-hidden="true" />
                  </Button>
                ) : null}
                {props.canManage ? (
                  <Button
                    variant="ghost"
                    size="xs"
                    aria-label={`${props.deleteLabel}: ${row.id}`}
                    disabled={props.pendingId !== null}
                    onClick={() => props.onDelete(row.id)}
                  >
                    <Trash2 className="size-3.5 text-destructive" aria-hidden="true" />
                  </Button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}

      <ConfirmActionModal
        open={props.deletingId !== null}
        onOpenChange={(open) => {
          if (!open) props.onCancelDelete();
        }}
        title={props.deleteTitle}
        description={props.deleteDescription}
        confirmLabel={t.common.confirmDelete}
        cancelLabel={t.common.cancel}
        onConfirm={props.onConfirmDelete}
        loading={props.pendingId !== null}
      />
    </DetailSection>
  );
}
