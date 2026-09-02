"use client";

import { useState } from "react";
import { CircleAlert, CircleCheck, CircleDashed, Play, Upload } from "lucide-react";
import { Badge, Button, DetailSection, Field, IdentifierText, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { TEMPLATE_CHANGE_NOTE_MAX } from "../../template-lifecycle-contract";
import type { TemplateDetail } from "../../templates-contract";
import type { useTemplateRelease } from "../hooks/useTemplateRelease";

/**
 * The three publish preconditions, stated before the button can be pressed.
 *
 * A definition revision, a draft revision and a validation run that names that
 * exact draft revision. Change one character of the draft after validating and
 * the run stops applying — so the run is shown against the revision it was for,
 * not merely as "passed".
 */
export function TemplateReleasePanel({
  template,
  release,
  canUpdate,
  canPublish,
}: {
  template: TemplateDetail;
  release: ReturnType<typeof useTemplateRelease>;
  canUpdate: boolean;
  canPublish: boolean;
}) {
  const { t } = useI18n();
  const copy = t.coreOperations.templates;
  const [changeNote, setChangeNote] = useState("");

  const preconditions = [
    {
      id: "definition",
      met: true,
      label: formatTemplate(copy.preconditionDefinition, {
        revision: String(template.definitionRevision),
      }),
    },
    {
      id: "draft",
      met: true,
      label: formatTemplate(copy.preconditionDraft, {
        revision: String(template.currentDraft.revision),
      }),
    },
    {
      id: "validation",
      met: release.run !== null && release.run.status === "PASSED" && release.isRunCurrent,
      label:
        release.run === null
          ? copy.preconditionNoRun
          : !release.isRunCurrent
            ? formatTemplate(copy.preconditionRunStale, {
                runRevision: String(release.run.draftRevision),
                draftRevision: String(template.currentDraft.revision),
              })
            : release.run.status === "PASSED"
              ? formatTemplate(copy.preconditionRunPassed, {
                  revision: String(release.run.draftRevision),
                })
              : copy.preconditionRunFailed,
    },
  ];

  return (
    <DetailSection
      title={copy.releaseTitle}
      description={copy.releaseDescription}
      action={
        canUpdate ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void release.validate()}
            loading={release.isValidating}
          >
            <Play className="size-4" aria-hidden="true" />
            {copy.validate}
          </Button>
        ) : null
      }
    >
      <ul className="flex flex-col gap-2">
        {preconditions.map((precondition) => (
          <li key={precondition.id} className="flex items-center gap-2 text-sm">
            {precondition.met ? (
              <CircleCheck className="size-4 text-primary" aria-hidden="true" />
            ) : (
              <CircleDashed className="size-4 text-muted-foreground" aria-hidden="true" />
            )}
            <span className={precondition.met ? "text-foreground" : "text-muted-foreground"}>
              {precondition.label}
            </span>
          </li>
        ))}
      </ul>

      {release.run && release.run.issues.length > 0 ? (
        <div className="flex flex-col gap-2 pt-2">
          <span className="text-sm font-medium text-foreground">{copy.validationIssues}</span>
          <ul className="flex flex-col gap-1">
            {release.run.issues.map((issue) => (
              <li key={`${issue.code}-${issue.nodeId ?? "root"}`} className="flex items-start gap-2 text-xs">
                <CircleAlert className="mt-0.5 size-3.5 text-destructive" aria-hidden="true" />
                <span className="flex flex-col">
                  <span className="text-foreground">{issue.message}</span>
                  <IdentifierText className="text-muted-foreground">{issue.code}</IdentifierText>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {canPublish ? (
        <div className="flex flex-col gap-3 pt-2">
          <Field label={copy.changeNote} hint={copy.changeNoteHint}>
            <Input
              value={changeNote}
              onChange={(event) => setChangeNote(event.target.value)}
              maxLength={TEMPLATE_CHANGE_NOTE_MAX}
              disabled={release.isPublishing}
            />
          </Field>
          <span className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => void release.publish(changeNote)}
              disabled={!release.canPublish}
              loading={release.isPublishing}
            >
              <Upload className="size-4" aria-hidden="true" />
              {copy.publish}
            </Button>
            {!release.canPublish ? (
              <Badge tone="caution">{copy.publishBlocked}</Badge>
            ) : null}
          </span>
        </div>
      ) : null}
    </DetailSection>
  );
}
