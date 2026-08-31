"use client";

import { Trash2 } from "lucide-react";
import {
  Button,
  ConfirmActionModal,
  DataTable,
  DetailSection,
  Input,
  type ColumnDef,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import {
  MODULE_KEY_MAX_LENGTH,
  type UserModuleAssignment,
} from "../../../contracts/user-subresource-contract";
import { useCoreErrorText } from "../../../hooks/useCoreErrorText";
import { useUserModules } from "../hooks/useUserModules";
import { listTableLabels } from "./list-table-labels";

export function ModuleSeatsPanel({
  userId,
  canManage,
}: {
  userId: string;
  canManage: boolean;
}) {
  const { t } = useI18n();
  const copy = t.coreIdentity;
  const describeError = useCoreErrorText();
  const panel = useUserModules(userId, true);

  const columns: ColumnDef<UserModuleAssignment>[] = [
    {
      id: "moduleKey",
      header: copy.modules.moduleKey,
      // The module key is protocol, not copy — there is no localized module
      // catalogue on this route, so it renders as the value the server holds.
      cell: (assignment) => <span className="font-mono text-xs">{assignment.moduleKey}</span>,
    },
    ...(canManage
      ? [
          {
            id: "actions",
            header: t.common.actions,
            align: "end" as const,
            cell: (assignment: UserModuleAssignment) => (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => panel.requestRemoval(assignment)}
                aria-label={`${t.common.delete}: ${assignment.moduleKey}`}
              >
                <Trash2 className="size-4 text-destructive" aria-hidden="true" />
              </Button>
            ),
          },
        ]
      : []),
  ];

  const writeText = describeError(panel.writeError);

  return (
    <DetailSection title={copy.modules.title} description={copy.modules.description} columns={1}>
      <div className="flex flex-col gap-3">
        {panel.isSeatLimitReached ? (
          <p
            role="status"
            className="rounded-sm border border-caution-200 bg-caution-100 p-2.5 text-xs text-caution-800 dark:border-caution-800 dark:bg-caution-950 dark:text-caution-300"
          >
            {copy.modules.seatLimit}
          </p>
        ) : writeText ? (
          <p
            role="alert"
            className="rounded-sm border border-negative-200 bg-negative-100 p-2.5 text-xs text-negative-800 dark:border-negative-800 dark:bg-negative-950 dark:text-negative-300"
          >
            {writeText}
          </p>
        ) : null}

        <DataTable
          columns={columns}
          rows={panel.assignments}
          isLoading={panel.isLoading}
          error={panel.loadError}
          onRetry={panel.reload}
          rowKey={(assignment) => assignment.id}
          labels={listTableLabels(t, copy.modules.loadFailed, copy.modules.empty)}
        />

        {canManage ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-56 flex-1">
              <Input
                dir="ltr"
                value={panel.moduleKey}
                onChange={(event) => panel.setModuleKey(event.target.value)}
                maxLength={MODULE_KEY_MAX_LENGTH}
                placeholder={copy.modules.keyPlaceholder}
                aria-label={copy.modules.moduleKey}
                disabled={panel.isSubmitting}
              />
            </div>
            <Button
              variant="outline"
              disabled={!panel.isModuleKeyValid || panel.isSubmitting}
              onClick={() => void panel.assign()}
            >
              {copy.modules.assign}
            </Button>
          </div>
        ) : null}
        <p className="text-2xs text-muted-foreground">{copy.modules.keyHint}</p>
      </div>

      <ConfirmActionModal
        open={panel.pendingRemoval !== null}
        onOpenChange={(open) => {
          if (!open) panel.cancelRemoval();
        }}
        title={copy.modules.removeTitle}
        description={formatTemplate(copy.modules.removeMessage, {
          name: panel.pendingRemoval?.moduleKey ?? "",
        })}
        confirmLabel={t.common.delete}
        cancelLabel={t.common.cancel}
        onConfirm={() => void panel.unassign()}
        loading={panel.isSubmitting}
      />
    </DetailSection>
  );
}
