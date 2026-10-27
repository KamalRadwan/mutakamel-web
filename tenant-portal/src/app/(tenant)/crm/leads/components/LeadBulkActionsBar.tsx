"use client";

import {
  ArrowUpRight,
  Star,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import { useLeadBulkControls } from "../hooks/useLeadMutations";
import type { LeadStage } from "../hooks/useLeads";

interface LeadBulkActionsBarProps {
  selectedIds: ReadonlySet<string>;
  stages: readonly LeadStage[];
  canUpdateAny: boolean;
  canDeleteAny: boolean;
  deleteEligibleCount: number;
  isDeleting: boolean;
  onBulkMoveStage: (stageId: string) => Promise<void>;
  onBulkSetRating: (rating: number) => Promise<void>;
  onBulkDelete: () => void;
  onClearSelection: () => void;
  owners: readonly { id: string; firstName: string; lastName: string }[];
  ownersLoading: boolean;
  ownersFailed: boolean;
  onBulkAssignOwner: (ownerUserId: string) => Promise<void>;
}

/**
 * Selected-lead stage, owner, rating and delete actions.
 */
export function LeadBulkActionsBar({
  selectedIds,
  stages,
  canUpdateAny,
  canDeleteAny,
  deleteEligibleCount,
  isDeleting,
  onBulkMoveStage,
  onBulkSetRating,
  onBulkDelete,
  onClearSelection,
  owners,
  ownersLoading,
  ownersFailed,
  onBulkAssignOwner,
}: LeadBulkActionsBarProps) {
  const { lang, t } = useI18n();
  const { isBusy, stageSelect, ratingSelect, handleMove, handleRating, handleOwner } = useLeadBulkControls({
    isDeleting, owners, onBulkMoveStage, onBulkSetRating, onBulkAssignOwner,
  });

  const count = selectedIds.size;
  if (count === 0) return null;

  return (
    <div
      role="region"
      aria-label={t.crmLeads.executive.bulkActions}
      className="fixed inset-x-0 bottom-5 z-(--z-sticky-header) mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2.5 rounded-lg border border-border bg-popover px-4 py-2.5 text-popover-foreground shadow-lg"
    >
      <div className="flex items-center gap-2 text-xs font-semibold">
        <span className="inline-flex size-6 items-center justify-center rounded-lg bg-primary text-xs font-semibold tabular-nums text-primary-foreground">
          {count}
        </span>
        <span>{t.crmLeads.executive.leadsSelected}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {canUpdateAny && stages.length > 0 && (
          <div className="relative inline-flex items-center">
            <ArrowUpRight className="pointer-events-none absolute start-2.5 size-3.5 text-primary-foreground" aria-hidden="true" />
            <select
              aria-label={t.crmLeads.executive.bulkMoveStage}
              value={stageSelect}
              disabled={isBusy || isDeleting}
              onChange={(e) => void handleMove(e.target.value)}
              className="h-8 cursor-pointer rounded-lg bg-primary ps-7 pe-3 text-xs font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              <option value="">
                {t.crmLeads.executive.moveStageCount(count)}
              </option>
              {stages
                .filter((st) => st.flag !== "CONVERTED")
                .map((stage) => (
                  <option key={stage.id} value={stage.id} className="bg-popover text-popover-foreground">
                    {localizedName(stage, lang)}
                  </option>
                ))}
            </select>
          </div>
        )}

        {canUpdateAny && (
          <div className="flex items-center gap-2">
            <Select value="" onValueChange={(value) => void handleOwner(value)} disabled={isBusy || isDeleting || ownersLoading || owners.length === 0}>
              <SelectTrigger aria-label={t.crmLeads.bulkAssignOwner} aria-busy={ownersLoading || isBusy}>
                <UserCheck className="size-3.5" aria-hidden="true" />
                <SelectValue placeholder={ownersLoading ? t.common.loading : t.crmLeads.bulkAssignOwner} />
              </SelectTrigger>
              <SelectContent>
                {owners.map((owner) => (
                  <SelectItem key={owner.id} value={owner.id}>
                    {[owner.firstName, owner.lastName].filter(Boolean).join(" ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {ownersFailed && <span role="alert" className="text-xs">{t.crmLeads.bulkOwnersUnavailable}</span>}
            {!ownersFailed && !ownersLoading && owners.length === 0 && <span role="status" className="text-xs">{t.crmLeads.bulkNoOwners}</span>}
          </div>
        )}

        {canUpdateAny && (
          <div className="relative inline-flex items-center">
            <Star className="pointer-events-none absolute start-2.5 size-3.5 text-warning" aria-hidden="true" />
            <select
              aria-label={t.crmLeads.executive.bulkSetRating}
              value={ratingSelect}
              disabled={isBusy || isDeleting}
              onChange={(e) => void handleRating(e.target.value)}
              className="h-8 cursor-pointer rounded-lg border border-border bg-card ps-7 pe-2.5 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50"
            >
              <option value="">
                {t.crmLeads.bulkSetRating}
              </option>
              <option value="3">★★★ (3)</option>
              <option value="2">★★☆ (2)</option>
              <option value="1">★☆☆ (1)</option>
              <option value="0">☆☆☆ (0)</option>
            </select>
          </div>
        )}

        {canDeleteAny && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={isBusy || isDeleting}
            onClick={onBulkDelete}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold shadow-xs"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            <span>{t.crmLeads.bulkDeleteLabel(deleteEligibleCount, count)}</span>
          </Button>
        )}

        <Button
          type="button"
          variant="outline"
          size="xs"
          disabled={isBusy || isDeleting}
          onClick={onClearSelection}
          title={t.crmLeads.executive.clearSelection}
          aria-label={t.crmLeads.executive.clearSelection}
          className="flex size-8 items-center justify-center rounded-lg p-0 text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
