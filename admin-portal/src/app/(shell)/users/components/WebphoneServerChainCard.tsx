"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  ListOrdered,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useOrderableList } from "../../settings/webphone/hooks/useOrderableList";
import type {
  ExtensionServerRow,
  WebphoneFieldErrors,
  WebphoneServer,
} from "../../settings/webphone/webphone-contract";

/**
 * The user's failover chain: which servers they try, in what order, and where
 * they depart from that server's defaults.
 *
 * A blank timeout or retry count is not zero — it inherits the server default,
 * which is why each input advertises that default as its placeholder rather
 * than pre-filling it. Pre-filling would turn "inherit" into a copy that stops
 * tracking the server when the server changes.
 */
export function WebphoneServerChainCard({
  servers,
  rows,
  errors,
  hasChanges,
  canEdit,
  isSaving,
  onMove,
  onUpdateRow,
  onAdd,
  onRemove,
  onReset,
  onSave,
}: {
  servers: WebphoneServer[];
  rows: ExtensionServerRow[];
  errors: WebphoneFieldErrors;
  hasChanges: boolean;
  canEdit: boolean;
  isSaving: boolean;
  onMove: (from: number, to: number) => void;
  onUpdateRow: (
    serverId: string,
    field: "timeoutSeconds" | "maxRetries",
    value: string,
  ) => void;
  onAdd: (serverId: string) => void;
  onRemove: (serverId: string) => void;
  onReset: () => void;
  onSave: () => void;
}) {
  const { t } = useI18n();
  const [serverToAdd, setServerToAdd] = useState("");

  const byId = useMemo(
    () => new Map(servers.map((server) => [server.id, server])),
    [servers],
  );
  const ids = useMemo(() => rows.map((row) => row.serverId), [rows]);
  const available = useMemo(
    () => servers.filter((server) => !ids.includes(server.id)),
    [ids, servers],
  );

  const orderable = useOrderableList({
    ids,
    disabled: !canEdit || isSaving,
    onMove,
  });

  const addSelected = () => {
    if (!serverToAdd) return;
    onAdd(serverToAdd);
    setServerToAdd("");
  };

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm">
            <ListOrdered className="size-4 text-info" aria-hidden="true" />
            {t.users.serverChainTitle}
          </CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t.users.serverChainHint}
          </p>
        </div>
        {hasChanges && canEdit && (
          <Badge tone="warn">{t.users.unsavedBadge}</Badge>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {!canEdit ? (
          <p className="rounded-md border border-border bg-muted p-3 text-xs text-muted-foreground">
            {t.users.serverChainNeedsExtension}
          </p>
        ) : null}

        {rows.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            {t.users.serverChainEmpty}
          </p>
        ) : (
          <ol className="space-y-3">
            {rows.map((row, index) => {
              const server = byId.get(row.serverId);
              const isDropTarget =
                orderable.dropTargetId === row.serverId &&
                orderable.draggingId !== row.serverId;
              return (
                <li
                  key={row.serverId}
                  {...orderable.rowProps(row.serverId)}
                  className={`rounded-md border p-3 ${
                    isDropTarget ? "border-info" : "border-border"
                  } ${orderable.draggingId === row.serverId ? "opacity-50" : ""}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {canEdit && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        disabled={isSaving}
                        aria-label={`${t.users.dragServerHandle}: ${
                          server?.name ?? row.serverId
                        }`}
                        className="cursor-grab px-1 text-muted-foreground"
                        {...orderable.handleProps(row.serverId)}
                      >
                        <GripVertical className="size-4" aria-hidden="true" />
                      </Button>
                    )}
                    <Badge
                      tone="info"
                      aria-label={`${t.users.serverChainPosition}: ${index + 1}`}
                    >
                      {index + 1}
                    </Badge>
                    <span className="text-xs font-semibold text-foreground">
                      {server?.name ?? t.users.serverChainUnknownServer}
                    </span>
                    {server ? (
                      <span dir="ltr" className="font-mono text-xs text-muted-foreground">
                        {server.websocketUrl}
                      </span>
                    ) : null}
                    {server && !server.enabled ? (
                      <Badge tone="neutral">{t.users.disabledBadge}</Badge>
                    ) : null}

                    {canEdit && (
                      <div className="ms-auto flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          disabled={isSaving || index === 0}
                          onClick={() => orderable.moveUp(index)}
                          aria-label={`${t.users.moveServerUp}: ${
                            server?.name ?? row.serverId
                          }`}
                        >
                          <ChevronUp className="size-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          disabled={isSaving || index === rows.length - 1}
                          onClick={() => orderable.moveDown(index)}
                          aria-label={`${t.users.moveServerDown}: ${
                            server?.name ?? row.serverId
                          }`}
                        >
                          <ChevronDown className="size-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          disabled={isSaving}
                          onClick={() => onRemove(row.serverId)}
                          aria-label={`${t.users.removeFromChain}: ${
                            server?.name ?? row.serverId
                          }`}
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field
                      label={t.users.chainTimeoutLabel}
                      hint={t.users.chainInheritsHint}
                      error={errors[`${row.serverId}.timeoutSeconds`]
                        ? t.users.chainOutOfRange
                        : undefined}
                    >
                      {(fieldProps) => (
                        <Input
                          {...fieldProps}
                          inputMode="numeric"
                          maxLength={3}
                          disabled={!canEdit || isSaving}
                          value={row.timeoutSeconds}
                          placeholder={
                            server ? String(server.defaultTimeoutSeconds) : ""
                          }
                          onChange={(event) =>
                            onUpdateRow(
                              row.serverId,
                              "timeoutSeconds",
                              event.target.value,
                            )
                          }
                          className="font-mono"
                        />
                      )}
                    </Field>
                    <Field
                      label={t.users.chainMaxRetriesLabel}
                      hint={t.users.chainInheritsHint}
                      error={errors[`${row.serverId}.maxRetries`]
                        ? t.users.chainOutOfRange
                        : undefined}
                    >
                      {(fieldProps) => (
                        <Input
                          {...fieldProps}
                          inputMode="numeric"
                          maxLength={2}
                          disabled={!canEdit || isSaving}
                          value={row.maxRetries}
                          placeholder={
                            server ? String(server.defaultMaxRetries) : ""
                          }
                          onChange={(event) =>
                            onUpdateRow(
                              row.serverId,
                              "maxRetries",
                              event.target.value,
                            )
                          }
                          className="font-mono"
                        />
                      )}
                    </Field>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {canEdit && available.length > 0 ? (
          <div className="flex flex-wrap items-end gap-2">
            <Field label={t.users.addServerToChain} className="min-w-56 flex-1">
              {(fieldProps) => (
                <Select
                  value={serverToAdd}
                  onValueChange={setServerToAdd}
                  disabled={isSaving}
                >
                  <SelectTrigger {...fieldProps}>
                    <SelectValue placeholder={t.users.selectServerPlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {available.map((server) => (
                      <SelectItem key={server.id} value={server.id}>
                        {server.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!serverToAdd || isSaving}
              onClick={addSelected}
            >
              <Plus className="size-3.5" aria-hidden="true" />
              {t.users.addToChain}
            </Button>
          </div>
        ) : null}
      </CardContent>

      {canEdit && hasChanges && (
        <CardFooter>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={isSaving}
            loading={isSaving}
            onClick={onSave}
          >
            <Save className="size-3.5" aria-hidden="true" />
            {t.users.saveServerChain}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSaving}
            onClick={onReset}
          >
            {t.users.discardChanges}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
