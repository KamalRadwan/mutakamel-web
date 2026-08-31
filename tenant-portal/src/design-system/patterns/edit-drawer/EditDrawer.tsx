"use client";

import type { NormalizedApiError } from "@/lib/api/errors";
import { Button } from "../../primitives/Button";
import { Skeleton } from "../../primitives/Skeleton";
import { ErrorState } from "../error-state/ErrorState";
import { FormDrawer, type FormDrawerLabels } from "../form-drawer/FormDrawer";
import { NotFoundState } from "../not-found-state/NotFoundState";

export interface EditDrawerLabels extends FormDrawerLabels {
  /** e.g. "Could not load this record". */
  loadErrorTitle: string;
  retry: string;
  /** Shown when the record was deleted while the list was on screen. */
  notFoundTitle: string;
  notFoundBack: string;
  /** Returns the form to the values the server last returned. */
  revert?: string;
  delete?: string;
}

export interface EditDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** The record is still being fetched. The body is skeletons; submit is blocked. */
  isLoading?: boolean;
  /** The fetch failed. The body is an `ErrorState` with a retry, not the form. */
  loadError?: NormalizedApiError | string | null;
  onRetryLoad?: () => void;
  /** A 404 on the record itself. Distinct from `loadError`: retrying cannot help. */
  notFound?: boolean;
  isDirty: boolean;
  isSubmitting: boolean;
  onSubmit: () => void;
  /** Restores the last server values. Omit where the caller keeps no baseline. */
  onRevert?: () => void;
  /** Rendered as a `destructive` footer control. Opens the caller's own confirmation. */
  onDelete?: () => void;
  /** A write error that is not field-level. Field errors belong on their `Field`. */
  error?: string;
  /**
   * The 409 / 412 / 428 surface, rendered by the caller as a `ConflictDialog`.
   *
   * Passed through rather than owned: only the caller knows what "their
   * changes" were, and this drawer must not guess a diff it cannot see.
   */
  conflict?: React.ReactNode;
  labels: EditDrawerLabels;
  children: React.ReactNode;
}

function errorMessage(error: NormalizedApiError | string | null | undefined): string | undefined {
  if (!error) return undefined;
  return typeof error === "string" ? error : error.message;
}

/**
 * The edit counterpart to `FormDrawer`, which is create-only.
 *
 * Around 20 screens in phases 4–12 open a drawer on an **existing** record, and
 * every one of them needs the same four things `FormDrawer` has no shape for:
 * a load state, a load failure that is not a submit failure, a deleted-record
 * state that must not offer a retry, and a revert. Building those inline
 * twenty times is how twenty slightly different edit drawers happen.
 *
 * It composes `FormDrawer`, so the dirty guard, the escape/backdrop handling
 * and the one filled submit are the same code, not a second copy.
 */
export function EditDrawer({
  open,
  onOpenChange,
  title,
  description,
  isLoading,
  loadError,
  onRetryLoad,
  notFound,
  isDirty,
  isSubmitting,
  onSubmit,
  onRevert,
  onDelete,
  error,
  conflict,
  labels,
  children,
}: EditDrawerProps) {
  const unloaded = Boolean(isLoading || notFound || loadError);

  return (
    <>
      <FormDrawer
        open={open}
        onOpenChange={onOpenChange}
        title={title}
        description={description}
        // A drawer whose record never loaded has nothing to discard, so the
        // dirty guard must not fire on close and strand the user in a
        // confirmation about changes that do not exist.
        isDirty={isDirty && !unloaded}
        isSubmitting={isSubmitting}
        onSubmit={onSubmit}
        submitDisabled={unloaded}
        error={error}
        labels={labels}
        footerLeading={
          <>
            {onDelete && labels.delete && (
              <Button
                variant="destructive"
                onClick={onDelete}
                disabled={isSubmitting || unloaded}
                className="cursor-pointer"
              >
                {labels.delete}
              </Button>
            )}
            {onRevert && labels.revert && (
              <Button
                variant="ghost"
                onClick={onRevert}
                disabled={!isDirty || isSubmitting || unloaded}
                className="cursor-pointer"
              >
                {labels.revert}
              </Button>
            )}
          </>
        }
      >
        {notFound ? (
          <NotFoundState title={labels.notFoundTitle} backLabel={labels.notFoundBack} onBack={() => onOpenChange(false)} />
        ) : loadError ? (
          <ErrorState
            title={labels.loadErrorTitle}
            description={errorMessage(loadError)}
            onRetry={onRetryLoad}
            retryLabel={labels.retry}
          />
        ) : isLoading ? (
          <div className="flex flex-col gap-4 p-1" aria-busy="true">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : (
          children
        )}
      </FormDrawer>

      {conflict}
    </>
  );
}
