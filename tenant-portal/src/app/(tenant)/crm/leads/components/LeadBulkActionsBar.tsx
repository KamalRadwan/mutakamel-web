"use client";

import {
  BulkActionBar,
  BulkConfirmDialog,
  Field,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  type BulkAction,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { localizedName } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import { MAX_LEAD_RATING } from "../lead-card-contract";
import type { LeadBulkKind, LeadsWorkspaceBulk } from "../hooks/useLeadsWorkspaceBulk";

const RATINGS = Array.from({ length: MAX_LEAD_RATING + 1 }, (_, index) => MAX_LEAD_RATING - index);

/** The Card/Table selection's bulk actions, each confirmed before it is sent. */
export function LeadBulkActionsBar({ bulk }: { bulk: LeadsWorkspaceBulk }) {
  const { t, lang } = useI18n();
  const labels = t.crmLeadWorkspace.bulk;
  const count = formatNumber(bulk.count, lang);
  const scope = formatTemplate(labels.scope, { count });

  const actions: BulkAction[] = [];
  if (bulk.canUpdate && bulk.moveStages.length > 0) {
    actions.push({ id: "stage", label: labels.moveStage, onSelect: () => bulk.open("stage") });
  }
  if (bulk.canUpdate) {
    actions.push({ id: "rating", label: labels.setRating, onSelect: () => bulk.open("rating") });
  }
  if (bulk.canDelete) {
    actions.push({ id: "delete", label: labels.delete, destructive: true, onSelect: () => bulk.open("delete") });
  }

  const dialogs: Record<LeadBulkKind, { title: string; description: string; confirm: string }> = {
    stage: { title: labels.moveTitle, description: scope, confirm: labels.confirmMove },
    rating: { title: labels.ratingTitle, description: scope, confirm: labels.confirmRating },
    delete: {
      title: labels.deleteTitle,
      description: formatTemplate(labels.deleteScope, { count }),
      confirm: t.common.delete,
    },
  };
  const kind = bulk.draft?.kind ?? "stage";

  return (
    <>
      <BulkActionBar
        selectedCount={bulk.count}
        actions={actions}
        onClear={bulk.clear}
        disabled={bulk.isBusy}
        labels={{ selection: formatTemplate(labels.selection, { count }), clear: labels.clear }}
      />
      <BulkConfirmDialog
        open={bulk.draft !== null}
        onOpenChange={(open) => {
          if (!open) bulk.cancel();
        }}
        title={dialogs[kind].title}
        description={dialogs[kind].description}
        summary={bulk.draft && kind !== "delete" && <LeadBulkPicker bulk={bulk} kind={kind} />}
        destructive={kind === "delete"}
        onConfirm={bulk.confirm}
        loading={bulk.isBusy}
        labels={{ confirm: dialogs[kind].confirm, cancel: t.common.cancel }}
      />
    </>
  );
}

function LeadBulkPicker({ bulk, kind }: { bulk: LeadsWorkspaceBulk; kind: "stage" | "rating" }) {
  const { t, lang } = useI18n();
  const draft = bulk.draft;
  if (!draft) return null;

  if (kind === "stage") {
    return (
      <Field label={t.crmLeads.stage}>
        <Select value={draft.stageId} onValueChange={bulk.setStageId}>
          <SelectTrigger size="sm" disabled={bulk.isBusy}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {bulk.moveStages.map((stage) => (
              <SelectItem key={stage.id} value={stage.id}>
                {localizedName(stage, lang)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    );
  }

  return (
    <Field label={t.crmLeads.card.rating}>
      <Select value={String(draft.rating)} onValueChange={(value) => bulk.setRating(Number(value))}>
        <SelectTrigger size="sm" disabled={bulk.isBusy}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {RATINGS.map((rating) => (
            <SelectItem key={rating} value={String(rating)}>
              {formatTemplate(t.crmLeads.card.ratingValue, {
                count: formatNumber(rating, lang),
                max: formatNumber(MAX_LEAD_RATING, lang),
              })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
