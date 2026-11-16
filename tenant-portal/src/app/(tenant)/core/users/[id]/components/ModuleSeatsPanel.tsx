"use client";

import { Plus, Trash2 } from "lucide-react";
import {
  Button,
  ConfirmActionModal,
  DataTable,
  DetailSection,
  Field,
  FormModal,
  IdentifierText,
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
  const panel = useUserModules(userId, true, canManage);

  const columns: ColumnDef<UserModuleAssignment>[] = [
    {
      id: "moduleKey",
      header: copy.modules.moduleKey,
      cell: (assignment) => (
        <IdentifierText className="text-xs">{assignment.moduleKey}</IdentifierText>
      ),
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
    <DetailSection
      title={copy.modules.title}
      description={copy.modules.description}
      columns={1}
    >
      <div className="flex flex-col gap-3">
        {writeText && !panel.isAssignOpen ? (
          <p
            role="alert"
            className="rounded-sm border border-destructive/30 bg-destructive-subtle p-2.5 text-xs text-destructive-subtle-foreground"
          >
            {writeText}
          </p>
        ) : null}

        {canManage ? (
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              disabled={panel.isSubmitting}
              onClick={panel.openAssign}
            >
              <Plus className="size-4" aria-hidden="true" />
              {copy.modules.assign}
            </Button>
          </div>
        ) : null}

        <DataTable
          columns={columns}
          rows={panel.assignments}
          isLoading={panel.isLoading}
          error={panel.loadError}
          onRetry={panel.reload}
          rowKey={(assignment) => assignment.id}
          labels={listTableLabels(
            t,
            copy.modules.loadFailed,
            copy.modules.empty,
          )}
        />
      </div>

      {canManage && panel.isAssignOpen ? (
        <FormModal
          open={panel.isAssignOpen}
          onOpenChange={(open) => {
            if (!open) panel.closeAssign();
          }}
          size="card"
          title={copy.modules.title}
          description={copy.modules.description}
          isDirty={panel.moduleKey.trim().length > 0}
          isSubmitting={panel.isSubmitting}
          submitDisabled={!panel.isModuleKeyValid}
          onSubmit={() => void panel.assign()}
          error={panel.isSeatLimitReached ? undefined : writeText}
          labels={{
            submit: copy.modules.assign,
            cancel: t.common.cancel,
            close: copy.actions.close,
            discardTitle: t.common.discardTitle,
            discardDescription: t.common.discardDescription,
            discardConfirm: t.common.discardConfirm,
            discardCancel: t.common.cancel,
            sections: t.common.general,
            sectionInvalid: copy.errors.UNKNOWN,
          }}
        >
          <div className="flex flex-col gap-3">
            {panel.isSeatLimitReached ? (
              <p
                role="status"
                className="rounded-sm border border-warning/30 bg-warning-subtle p-2.5 text-xs text-warning-subtle-foreground"
              >
                {copy.modules.seatLimit}
              </p>
            ) : null}
            <Field
              label={copy.modules.moduleKey}
              hint={copy.modules.keyHint}
              showLabel
              required
            >
              <Input
                size="sm"
                dir="ltr"
                value={panel.moduleKey}
                onChange={(event) => panel.setModuleKey(event.target.value)}
                maxLength={MODULE_KEY_MAX_LENGTH}
                placeholder={copy.modules.keyPlaceholder}
                disabled={panel.isSubmitting}
                required
              />
            </Field>
          </div>
        </FormModal>
      ) : null}

      <ConfirmActionModal
        open={panel.pendingRemoval !== null}
        onOpenChange={(open) => {
          if (!open) panel.cancelRemoval();
        }}
        title={copy.modules.removeTitle}
        description={formatTemplate(copy.modules.removeMessage, {
          name: panel.pendingRemoval?.moduleKey ?? "",
        })}
        confirmLabel={copy.actions.delete}
        cancelLabel={t.common.cancel}
        onConfirm={() => void panel.unassign()}
        loading={panel.isSubmitting}
      />
    </DetailSection>
  );
}
