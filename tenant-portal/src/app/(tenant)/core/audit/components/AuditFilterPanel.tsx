"use client";

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
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useAuditFilters } from "../hooks/useAuditFilters";
import { auditCatalogue } from "@/lib/audit/catalogue";
import {
  AUDIT_OUTCOMES,
  AUDIT_SOURCE_APPS,
  AUDIT_SOURCE_KINDS,
  AUDIT_SENSITIVITIES,
  type AuditFilters,
} from "@/lib/audit/audit-contract";

const ANY = "__any";

/**
 * Every control maps to TenantAuditQueryDto. Label search is available only
 * on the deleted-record subset, as enforced by the reader.
 */
export function AuditFilterPanel({
  filters,
  onApply,
  disabled,
  deletedOnly,
}: {
  filters: AuditFilters;
  onApply: (next: AuditFilters) => void;
  disabled: boolean;
  deletedOnly: boolean;
}) {
  const { t, lang } = useI18n();
  const copy = t.coreOperations.audit;
  const { draft, range, change, applyRange, clear, apply } = useAuditFilters(filters, onApply);

  return (
    <DetailSection title={copy.filtersTitle} description={copy.filtersDescription}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {deletedOnly ? <Field label={t.audit.ledger.search}>
          <Input size="sm" maxLength={256} value={draft.q ?? ""} disabled={disabled}
            onChange={(event) => change({ q: event.target.value || undefined })} />
        </Field> : null}
        <Field label={t.audit.ledger.branch}>
          <Input size="sm" value={draft.branchId ?? ""} disabled={disabled}
            onChange={(event) => change({ branchId: event.target.value || undefined })} />
        </Field>
        <Field label={t.audit.ledger.owner}>
          <Input size="sm" value={draft.ownerUserId ?? ""} disabled={disabled}
            onChange={(event) => change({ ownerUserId: event.target.value || undefined })} />
        </Field>
        <Field label={t.audit.ledger.sensitivity}>
          <Select value={draft.sensitivity ?? ANY} disabled={disabled}
            onValueChange={(value) => change({ sensitivity: value === ANY ? undefined : value as AuditFilters["sensitivity"] })}>
            <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value={ANY}>{copy.anyValue}</SelectItem>
              {AUDIT_SENSITIVITIES.map((value) => <SelectItem key={value} value={value}>{t.audit.ledger.sensitivities[value]}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label={copy.filterEntityType} hint={copy.filterEntityTypeHint}>
          <Select value={draft.entityType ?? ANY} disabled={disabled}
            onValueChange={(value) => change({ entityType: value === ANY ? undefined : value })}>
            <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value={ANY}>{copy.anyValue}</SelectItem>
              {auditCatalogue.map((entry) => <SelectItem key={entry.entityType} value={entry.entityType}>
                {t.audit.ledger.apps[entry.sourceApp]} · {t.audit.ledger.entities[entry.labelKey]} ({entry.entityType})
              </SelectItem>)}
            </SelectContent>
          </Select>
        </Field>

        <Field label={copy.filterEntityId}>
          <Input size="sm" placeholder={copy.filterEntityId}
            dir="ltr"
            value={draft.entityId ?? ""}
            onChange={(event) => change({ entityId: event.target.value || undefined })}
            disabled={disabled}
          />
        </Field>

        <Field label={copy.filterAction} hint={copy.filterActionHint}>
          <Input size="sm" placeholder={copy.filterAction}
            dir="ltr"
            value={draft.action ?? ""}
            onChange={(event) => change({ action: event.target.value || undefined })}
            disabled={disabled}
          />
        </Field>

        <Field label={copy.filterActor} hint={copy.filterActorHint}>
          <Input size="sm" placeholder={copy.filterActor}
            dir="ltr"
            value={draft.actorUserId ?? ""}
            onChange={(event) => change({ actorUserId: event.target.value || undefined })}
            disabled={disabled}
          />
        </Field>

        <Field label={copy.filterCorrelation} hint={copy.filterCorrelationHint}>
          <Input size="sm" placeholder={copy.filterCorrelation}
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
            <SelectTrigger size="sm">
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
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>{copy.anyValue}</SelectItem>
              {AUDIT_SOURCE_APPS.map((app) => (
                <SelectItem key={app} value={app}>
                  {t.audit.ledger.apps[app]}
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
            <SelectTrigger size="sm">
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
        <Button size="sm" variant="outline" onClick={apply} disabled={disabled}>
          <Search className="size-4" aria-hidden="true" />
          {copy.applyFilters}
        </Button>
        <Button size="sm" variant="ghost" onClick={clear} disabled={disabled}>
          <X className="size-4" aria-hidden="true" />
          {t.filters.clearAll}
        </Button>
      </div>
    </DetailSection>
  );
}
