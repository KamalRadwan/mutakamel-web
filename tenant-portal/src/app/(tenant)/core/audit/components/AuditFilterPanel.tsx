"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
import {
  Button,
  DateRangePicker,
  DetailSection,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  type DateRangeValue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  AUDIT_OUTCOMES,
  AUDIT_SOURCE_APPS,
  AUDIT_SOURCE_KINDS,
  type AuditFilters,
} from "../../contracts/audit-contract";

const ANY = "__any";

/**
 * Every control here maps to a field `TenantAuditQueryDto` declares. There is
 * deliberately no free-text search: the endpoint has none, and a box that
 * silently drops what is typed into it is worse than its absence.
 */
export function AuditFilterPanel({
  filters,
  onApply,
  disabled,
}: {
  filters: AuditFilters;
  onApply: (next: AuditFilters) => void;
  disabled: boolean;
}) {
  const { t, lang } = useI18n();
  const copy = t.coreOperations.audit;
  const [draft, setDraft] = useState<AuditFilters>(filters);
  const [range, setRange] = useState<DateRangeValue | undefined>(undefined);

  const change = (patch: Partial<AuditFilters>) =>
    setDraft((current) => ({ ...current, ...patch }));

  const applyRange = (next: DateRangeValue | undefined) => {
    setRange(next);
    change({
      from: next?.from?.toISOString(),
      to: next?.to?.toISOString(),
    });
  };

  const clear = () => {
    setDraft({});
    setRange(undefined);
    onApply({});
  };

  return (
    <DetailSection title={copy.filtersTitle} description={copy.filtersDescription}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={copy.filterEntityType} hint={copy.filterEntityTypeHint}>
          <Input
            dir="ltr"
            value={draft.entityType ?? ""}
            onChange={(event) => change({ entityType: event.target.value || undefined })}
            disabled={disabled}
          />
        </Field>

        <Field label={copy.filterEntityId}>
          <Input
            dir="ltr"
            value={draft.entityId ?? ""}
            onChange={(event) => change({ entityId: event.target.value || undefined })}
            disabled={disabled}
          />
        </Field>

        <Field label={copy.filterAction} hint={copy.filterActionHint}>
          <Input
            dir="ltr"
            value={draft.action ?? ""}
            onChange={(event) => change({ action: event.target.value || undefined })}
            disabled={disabled}
          />
        </Field>

        <Field label={copy.filterActor} hint={copy.filterActorHint}>
          <Input
            dir="ltr"
            value={draft.actorUserId ?? ""}
            onChange={(event) => change({ actorUserId: event.target.value || undefined })}
            disabled={disabled}
          />
        </Field>

        <Field label={copy.filterCorrelation} hint={copy.filterCorrelationHint}>
          <Input
            dir="ltr"
            value={draft.correlationId ?? ""}
            onChange={(event) => change({ correlationId: event.target.value || undefined })}
            disabled={disabled}
          />
        </Field>

        <Field label={copy.filterOutcome} hint={copy.filterOutcomeHint}>
          <Select
            value={draft.outcome ?? ANY}
            onValueChange={(value) =>
              change({ outcome: value === ANY ? undefined : (value as AuditFilters["outcome"]) })
            }
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>{copy.anyValue}</SelectItem>
              {AUDIT_OUTCOMES.map((outcome) => (
                <SelectItem key={outcome} value={outcome}>
                  {copy.outcomes[outcome]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label={copy.filterSourceApp}>
          <Select
            value={draft.sourceApp ?? ANY}
            onValueChange={(value) =>
              change({ sourceApp: value === ANY ? undefined : (value as AuditFilters["sourceApp"]) })
            }
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>{copy.anyValue}</SelectItem>
              {AUDIT_SOURCE_APPS.map((app) => (
                <SelectItem key={app} value={app}>
                  {app}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label={copy.filterSourceKind}>
          <Select
            value={draft.sourceKind ?? ANY}
            onValueChange={(value) =>
              change({
                sourceKind: value === ANY ? undefined : (value as AuditFilters["sourceKind"]),
              })
            }
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>{copy.anyValue}</SelectItem>
              {AUDIT_SOURCE_KINDS.map((kind) => (
                <SelectItem key={kind} value={kind}>
                  {copy.sourceKinds[kind]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label={copy.filterRange} hint={copy.filterRangeHint}>
          <DateRangePicker
            value={range}
            onValueChange={applyRange}
            placeholder={copy.filterRangePlaceholder}
            presetLabels={copy.datePresets}
            clearLabel={t.filters.clearAll}
            language={lang}
            disabled={disabled}
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-2">
        <Button variant="outline" onClick={() => onApply(draft)} disabled={disabled}>
          <Search className="size-4" aria-hidden="true" />
          {copy.applyFilters}
        </Button>
        <Button variant="ghost" onClick={clear} disabled={disabled}>
          <X className="size-4" aria-hidden="true" />
          {t.filters.clearAll}
        </Button>
      </div>
    </DetailSection>
  );
}
