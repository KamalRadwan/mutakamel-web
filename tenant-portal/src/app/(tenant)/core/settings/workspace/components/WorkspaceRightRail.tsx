"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Switch,
} from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { WorkspaceSettingsDraft } from "../workspace-settings-contract";

interface WorkspaceSupportSectionProps {
  t: Dictionary;
  draft: WorkspaceSettingsDraft;
  isReadOnly: boolean;
  isSaving: boolean;
  onUpdateDraft: (patch: Partial<WorkspaceSettingsDraft>) => void;
}

export function WorkspaceSupportSection({
  t,
  draft,
  isReadOnly,
  isSaving,
  onUpdateDraft,
}: WorkspaceSupportSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-card-title">
          {t.coreSettings.workspaceSupportSectionTitle}
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-sm font-medium text-foreground">
              {t.coreSettings.workspaceAllowSupport}
            </span>
            <p className="text-caption leading-relaxed text-muted-foreground">
              {t.coreSettings.workspaceAllowSupportHint}
            </p>
          </div>

          <Field
            label={t.coreSettings.workspaceAllowSupport}
            readOnly={isReadOnly}
            className="shrink-0"
          >
            <Switch
              checked={draft.allowSupport}
              onCheckedChange={(checked) => onUpdateDraft({ allowSupport: checked })}
              disabled={isReadOnly || isSaving}
            />
          </Field>
        </div>
      </CardContent>
    </Card>
  );
}
