"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Database, Loader2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Field,
  Textarea,
} from "@/design-system";
import { normalizeApiError } from "@/shared/api/normalized-api-error";
import { applicationsApi } from "../api/applications.api";
import type {
  ApplicationDatabaseServerBindReceipt,
  ApplicationDatabaseServerBindResult,
  ApplicationDatabaseServerCandidateView,
  ApplicationDatabaseServerCandidatesView,
  BindApplicationDatabaseServersDto,
} from "../types";

type BindCopy = ReturnType<typeof useBindCopy>;

interface Props {
  isOpen: boolean;
  applicationKey: string;
  isSubmitting: boolean;
  onClose: () => void;
  onBind: (
    dto: BindApplicationDatabaseServersDto,
  ) => Promise<ApplicationDatabaseServerBindReceipt>;
}

function useBindCopy() {
  return useI18n().t.applications.detail.databaseBind;
}

/**
 * Step 2 of releasing an Application: bind it to several database servers at
 * once.
 *
 * The command reports one outcome per server instead of rolling the batch
 * back, so this dialog stays open on a partial failure and offers a retry
 * scoped to exactly the servers that failed.
 */
export function ApplicationDatabaseBindDialog({
  isOpen,
  applicationKey,
  isSubmitting,
  onClose,
  onBind,
}: Props) {
  const copy = useBindCopy();
  const [fleet, setFleet] = useState<ApplicationDatabaseServerCandidatesView | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ApplicationDatabaseServerBindReceipt | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const next = await applicationsApi.listBindableDatabaseServers(applicationKey);
      setFleet(next);
      setSelected(
        next.servers
          .filter((server) => server.bindable)
          .map((server) => server.databaseServerId),
      );
    } catch (requestError) {
      setFleet(null);
      setLoadError(normalizeApiError(requestError).message);
    } finally {
      setIsLoading(false);
    }
  }, [applicationKey]);

  useEffect(() => {
    if (!isOpen) return;
    queueMicrotask(() => {
      setReason("");
      setError(null);
      setReceipt(null);
      void load();
    });
  }, [isOpen, load]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const servers = useMemo(() => fleet?.servers ?? [], [fleet]);
  const bindableIds = useMemo(
    () =>
      servers
        .filter((server) => server.bindable)
        .map((server) => server.databaseServerId),
    [servers],
  );

  if (!isOpen) return null;

  const submitIds = async (databaseServerIds: string[]) => {
    if (!fleet?.policyRevision) return;
    if (!databaseServerIds.length) return setError(copy.selectServer);
    // Retrying reuses the same audited reason, so it is re-validated here too.
    if (reason.trim().length < 8) return setError(copy.reasonMinimum);
    setError(null);
    try {
      setReceipt(
        await onBind({
          databaseServerIds,
          expectedCatalogueRevision: fleet.catalogueRevision,
          expectedPolicyRevision: fleet.policyRevision,
          reason: reason.trim(),
        }),
      );
      await load();
    } catch (submissionError) {
      setError(readMessage(submissionError, copy.submitFailed));
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await submitIds(selected);
  };

  const failedIds = (receipt?.results ?? [])
    .filter((row) => row.outcome === "FAILED")
    .map((row) => row.databaseServerId);
  const canSubmit =
    !isSubmitting && !isLoading && fleet?.bindable === true && bindableIds.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <p className="text-xs font-semibold text-primary">{copy.stepLabel}</p>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Database className="size-4 text-info" aria-hidden="true" />
            {copy.title}
          </DialogTitle>
          <p className="text-xs leading-relaxed text-muted-foreground">{copy.description}</p>
        </DialogHeader>

        <form onSubmit={submit} noValidate className="space-y-4">
          {isLoading ? (
            <div role="status" className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              {copy.loading}
            </div>
          ) : loadError ? (
            <div role="alert" className="space-y-3 rounded-md border border-destructive bg-destructive-subtle px-3 py-2 text-xs text-destructive-subtle-foreground">
              <p>{loadError || copy.loadFailed}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
                {copy.retry}
              </Button>
            </div>
          ) : (
            <>
              {fleet?.bindable === false && (
                <p className="rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-xs leading-relaxed text-warning-subtle-foreground">
                  {copy.applicationBlocked}
                </p>
              )}
              <ServerPicker
                servers={servers}
                selected={selected}
                bindableIds={bindableIds}
                disabled={isSubmitting || fleet?.bindable !== true}
                copy={copy}
                onToggle={(databaseServerId, checked) =>
                  setSelected((current) =>
                    checked
                      ? [...new Set([...current, databaseServerId])]
                      : current.filter((id) => id !== databaseServerId),
                  )
                }
                onSelectAll={() => setSelected(bindableIds)}
                onClear={() => setSelected([])}
              />
              {bindableIds.length > 0 && fleet?.bindable === true && (
                <Field
                  label={copy.reason}
                  hint={copy.reasonHint.replace("{{count}}", String(reason.trim().length))}
                  required
                >
                  {(fp) => (
                    <Textarea
                      {...fp}
                      minLength={8}
                      maxLength={500}
                      rows={3}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      className="resize-none"
                    />
                  )}
                </Field>
              )}
            </>
          )}

          {receipt && <BindOutcomes receipt={receipt} copy={copy} />}

          {error && (
            <p
              ref={errorRef}
              role="alert"
              tabIndex={-1}
              className="rounded-md border border-destructive bg-destructive-subtle px-3 py-2 text-xs text-destructive-subtle-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {error}
            </p>
          )}

          <footer className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={onClose}>
              {copy.close}
            </Button>
            {failedIds.length > 0 && (
              <Button
                type="button"
                variant="secondary"
                loading={isSubmitting}
                onClick={() => void submitIds(failedIds)}
              >
                {copy.retryFailed}
              </Button>
            )}
            <Button type="submit" variant="primary" loading={isSubmitting} disabled={!canSubmit}>
              {copy.confirm}
            </Button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ServerPicker({
  servers,
  selected,
  bindableIds,
  disabled,
  copy,
  onToggle,
  onSelectAll,
  onClear,
}: {
  servers: ApplicationDatabaseServerCandidateView[];
  selected: string[];
  bindableIds: string[];
  disabled: boolean;
  copy: BindCopy;
  onToggle: (databaseServerId: string, checked: boolean) => void;
  onSelectAll: () => void;
  onClear: () => void;
}) {
  if (!servers.length) {
    return (
      <div className="rounded-md border border-dashed border-border p-5 text-center text-xs text-muted-foreground">
        {copy.empty}
      </div>
    );
  }
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <legend className="text-xs font-semibold text-muted-foreground">
          {copy.selectedCount.replace("{{count}}", String(selected.length))}
        </legend>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || !bindableIds.length}
            onClick={onSelectAll}
          >
            {copy.selectAll}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || !selected.length}
            onClick={onClear}
          >
            {copy.clear}
          </Button>
        </div>
      </div>
      <ul className="max-h-72 space-y-2 overflow-y-auto">
        {servers.map((server) => (
          <ServerRow
            key={server.databaseServerId}
            server={server}
            checked={selected.includes(server.databaseServerId)}
            copy={copy}
            onToggle={onToggle}
          />
        ))}
      </ul>
    </fieldset>
  );
}

function ServerRow({
  server,
  checked,
  copy,
  onToggle,
}: {
  server: ApplicationDatabaseServerCandidateView;
  checked: boolean;
  copy: BindCopy;
  onToggle: (databaseServerId: string, checked: boolean) => void;
}) {
  const blocked = blockedCopy(server, copy);
  return (
    <li className="rounded-md border border-border p-3">
      <label className="flex cursor-pointer items-start gap-3">
        <Checkbox
          checked={checked}
          disabled={!server.bindable}
          onCheckedChange={(next) => onToggle(server.databaseServerId, next === true)}
          className="mt-0.5"
        />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-foreground">{server.name}</span>
            <Badge tone={server.serverStatus === "ACTIVE" ? "success" : "neutral"}>
              {server.serverStatus}
            </Badge>
            {server.bound && <Badge tone="info">{copy.boundBadge}</Badge>}
          </span>
          <span className="mt-1 block truncate font-mono text-xs text-muted-foreground" dir="ltr">
            {server.host}:{server.port}
          </span>
          {blocked && (
            <span className="mt-1 block text-xs text-warning-subtle-foreground">{blocked}</span>
          )}
        </span>
      </label>
    </li>
  );
}

function BindOutcomes({
  receipt,
  copy,
}: {
  receipt: ApplicationDatabaseServerBindReceipt;
  copy: BindCopy;
}) {
  const titleId = "application-database-bind-outcomes";
  return (
    <section
      aria-live="polite"
      aria-labelledby={titleId}
      className="space-y-2 rounded-md border border-border p-3"
    >
      <h3 id={titleId} className="text-xs font-semibold text-foreground">
        {copy.outcomeTitle}
      </h3>
      <p className="text-xs text-muted-foreground">
        {copy.outcomeSummary
          .replace("{{bound}}", String(receipt.bound))
          .replace("{{alreadyBound}}", String(receipt.alreadyBound))
          .replace("{{failed}}", String(receipt.failed))}
      </p>
      <ul className="space-y-1.5">
        {receipt.results.map((result) => (
          <OutcomeRow key={result.databaseServerId} result={result} copy={copy} />
        ))}
      </ul>
    </section>
  );
}

function OutcomeRow({
  result,
  copy,
}: {
  result: ApplicationDatabaseServerBindResult;
  copy: BindCopy;
}) {
  const failed = result.outcome === "FAILED";
  return (
    <li className="flex items-start gap-2 text-xs">
      {failed ? (
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden="true" />
      ) : (
        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden="true" />
      )}
      <span className="min-w-0 flex-1">
        <span className="font-semibold text-foreground">
          {result.databaseServerName ?? result.databaseServerId}
        </span>
        <span className="ms-2 text-muted-foreground">{OUTCOME_LABEL[result.outcome](copy)}</span>
        {failed && result.message && (
          <span className="mt-0.5 block text-warning-subtle-foreground">{result.message}</span>
        )}
        {failed && result.code && (
          <code className="mt-0.5 block font-mono text-xs text-muted-foreground" dir="ltr">
            {result.code}
          </code>
        )}
      </span>
    </li>
  );
}

const OUTCOME_LABEL = {
  BOUND: (copy: BindCopy) => copy.outcomeBound,
  ALREADY_BOUND: (copy: BindCopy) => copy.outcomeAlreadyBound,
  FAILED: (copy: BindCopy) => copy.outcomeFailed,
} as const;

function blockedCopy(
  server: ApplicationDatabaseServerCandidateView,
  copy: BindCopy,
): string | null {
  if (server.bindable || server.bound) return null;
  if (server.blockedReason === "DB_SERVER_SECURITY_ADMIN_CREDENTIALS_REQUIRED") {
    return copy.blockedSecurityAdmin;
  }
  if (server.blockedReason === "DB_SERVER_APPLICATION_ALREADY_BOUND_OR_NEEDS_RECOVERY") {
    return copy.blockedBindingBusy;
  }
  return copy.blockedUnknown;
}

function readMessage(value: unknown, fallback: string): string {
  if (value instanceof Error) return value.message;
  if (
    value &&
    typeof value === "object" &&
    "message" in value &&
    typeof value.message === "string"
  ) {
    return value.message;
  }
  return fallback;
}
