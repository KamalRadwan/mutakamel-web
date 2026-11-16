import {
  CalendarClock,
  CircleCheck,
  CircleX,
  ClipboardList,
  FileSpreadsheet,
  GitCommitHorizontal,
  History,
  Paperclip,
  PenLine,
  Receipt,
  Sparkles,
  StickyNote,
  Trash2,
  UserPen,
  type LucideIcon,
} from "lucide-react";
import type { HistoryTone, HistoryTreeNode } from "@/design-system";
import { auditRecordHref } from "@/lib/audit/catalogue";
import { formatDateTimeNumeric } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import { isUUIDv7 } from "@/lib/uuid";
import type {
  EntityAuditEvent,
  HistorySubjectKind,
} from "@/lib/audit/entity-history-contract";
import {
  buildAuditDiffRows,
  type AuditCopy,
  type HistoryPeople,
  type HistoryValueLabels,
} from "./HistoryChangeValue";

export interface AuditHistoryTreeItem extends HistoryTreeNode {
  outcome: "SUCCESS" | "FAILURE" | null;
  changeCount: number;
}

export function humanizeAuditAction(action: string, copy: AuditCopy): string {
  const known = copy.actions[action];
  if (known) return known;
  const words = action.replace(/_/gu, " ").trim().toLowerCase();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : copy.ledger.unknownAction;
}

export function actorInitials(name: string): string {
  const parts = name.trim().split(/\s+/u).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return Array.from(parts[0]).slice(0, 2).join("").toUpperCase();
  return `${Array.from(parts[0])[0] ?? ""}${Array.from(parts[parts.length - 1])[0] ?? ""}`.toUpperCase();
}

function resolveSemanticAction(
  event: EntityAuditEvent,
  context: { entityType: string; entityId?: string | null },
): string {
  const creationAction = creationSummaryAction(event, context);
  if (creationAction) return creationAction;

  const kind = event.subjectKind;
  if (kind === "quotation" || context.entityType === "TradeQuotationEntity") {
    if (event.action === "CREATE") return "QUOTATION_CREATED";
    if (event.action === "DELETE" || event.action === "SOFT_DELETE") return "QUOTATION_DELETED";
    if (event.action === "UPDATE") return "QUOTATION_UPDATED";
  }
  if (kind === "salesOrder" || context.entityType === "TradeSalesOrderEntity") {
    if (event.action === "CREATE") return "SALES_ORDER_CREATED";
    if (event.action === "DELETE" || event.action === "SOFT_DELETE") return "SALES_ORDER_DELETED";
    if (event.action === "UPDATE") return "SALES_ORDER_UPDATED";
  }
  if (kind === "invoice" || context.entityType === "TradeSalesInvoiceEntity") {
    if (event.action === "CREATE") return "INVOICE_CREATED";
    if (event.action === "DELETE" || event.action === "SOFT_DELETE") return "INVOICE_DELETED";
    if (event.action === "UPDATE") return "INVOICE_UPDATED";
  }
  if (kind === "contact") {
    if (event.action === "CREATE") return "CONTACT_ADDED";
    if (
      [
        "UPDATE",
        "CRM_PARTY_UPDATED",
        "CRM_PARTY_CONTACT_METHOD_CHANGED",
        "SOFT_DELETE",
        "DELETE",
      ].includes(event.action)
    ) {
      return "CONTACT_UPDATED";
    }
  }
  if (context.entityType === "Lead" && (!kind || kind === "lead")) {
    const onlyForeignSubjects =
      event.changes.length > 0 &&
      Boolean(context.entityId) &&
      event.changes.every((c) => Boolean(c.subjectId) && c.subjectId !== context.entityId);
    if (onlyForeignSubjects) {
      return event.action === "CREATE" ? "CONTACT_ADDED" : "CONTACT_UPDATED";
    }
    if (event.action === "UPDATE") return "LEAD_UPDATED";
    if (event.action === "DELETE" || event.action === "SOFT_DELETE") return "LEAD_DELETED";
  }
  return event.action;
}

export function actionIconFor(action: string, subjectKind?: HistorySubjectKind): LucideIcon {
  if (subjectKind === "quotation" || action.startsWith("QUOTATION_")) return FileSpreadsheet;
  if (subjectKind === "salesOrder" || action.startsWith("SALES_ORDER_")) return ClipboardList;
  if (subjectKind === "invoice" || action.startsWith("INVOICE_")) return Receipt;
  if (subjectKind === "contact" || action.startsWith("CONTACT_")) return UserPen;
  if (subjectKind === "activity" || action.startsWith("ACTIVITY_")) return CalendarClock;
  if (subjectKind === "note" || action.startsWith("NOTE_")) return StickyNote;
  if (subjectKind === "attachment" || action.startsWith("ATTACHMENT_")) return Paperclip;
  if (action.endsWith("_CREATED") || action === "CREATE") return Sparkles;
  if (action.includes("STAGE_CHANGED") || action === "LEAD_CONVERTED") return GitCommitHorizontal;
  if (action.endsWith("_DELETED") || action === "DELETE" || action === "SOFT_DELETE") return Trash2;
  return PenLine;
}

function resolveReferenceBadge(event: EntityAuditEvent): {
  label: string | null;
  href: string | null;
} {
  const raw = event.referenceLabel?.trim();
  if (!raw) return { label: null, href: null };
  const kind = event.subjectKind;
  if (kind === "quotation" || kind === "salesOrder" || kind === "invoice") {
    const entityType =
      kind === "quotation"
        ? "TradeQuotationEntity"
        : kind === "salesOrder"
          ? "TradeSalesOrderEntity"
          : "TradeSalesInvoiceEntity";
    const label = raw.startsWith("#") ? raw : `#${raw}`;
    const href = auditRecordHref(entityType, event.subjectId ?? null);
    return { label, href };
  }
  return { label: raw, href: null };
}

export function toHistoryTreeItem(
  event: EntityAuditEvent,
  lang: "ar" | "en",
  copy: AuditCopy,
  statusValues: Record<string, string | undefined>,
  valueLabels: HistoryValueLabels | undefined,
  context: { entityType: string; entityId?: string | null },
  people?: HistoryPeople,
): AuditHistoryTreeItem {
  const actorName = event.actorLabel || copy.actorUnknown;
  const semanticAction = resolveSemanticAction(event, context);
  const actionTitle = humanizeAuditAction(semanticAction, copy);
  const reference = resolveReferenceBadge(event);
  const changeCount = event.changes.length;
  const changeCountLabel =
    changeCount === 1
      ? copy.oneChangeCount
      : changeCount > 1
        ? formatTemplate(copy.changesCount, { count: changeCount })
        : null;
  const tone: HistoryTone =
    event.outcome === "FAILURE"
      ? "negative"
      : event.outcome === "SUCCESS"
        ? "positive"
        : "neutral";

  return {
    id: event.id,
    actorName,
    actorInitials: actorInitials(actorName),
    timestamp: formatDateTimeNumeric(event.occurredAt, lang),
    outcome: event.outcome,
    tone,
    markerIcon:
      event.outcome === "FAILURE"
        ? CircleX
        : event.outcome === "SUCCESS"
          ? CircleCheck
          : History,
    actionTitle,
    actionIcon: actionIconFor(semanticAction, event.subjectKind),
    referenceLabel: reference.label,
    referenceHref: reference.href,
    changeCount,
    changeCountLabel,
    diffs: buildAuditDiffRows(event.changes, copy, statusValues, valueLabels, context, people),
    detailsFooter: event.reason
      ? formatTemplate(copy.reasonLine, { reason: event.reason })
      : undefined,
  };
}

const CREATION_ACTIONS: Record<string, string> = {
  Lead: "LEAD_CREATED",
  CustomerProfile: "CUSTOMER_PROFILE_CREATED",
  Opportunity: "OPPORTUNITY_CREATED",
};

const CREATION_FIELDS: Record<
  string,
  readonly { field: string; valid: (value: unknown) => boolean }[]
> = {
  Lead: [
    {
      field: "leadProfileType",
      valid: (value) => value === "INDIVIDUAL" || value === "CORPORATE",
    },
    { field: "branchId", valid: isUUIDv7 },
    { field: "stageId", valid: isUUIDv7 },
  ],
  CustomerProfile: [
    {
      field: "profileType",
      valid: (value) => value === "INDIVIDUAL" || value === "CORPORATE",
    },
    { field: "branchId", valid: isUUIDv7 },
    { field: "status", valid: (value) => typeof value === "string" && value.length > 0 },
  ],
  Opportunity: [
    { field: "branchId", valid: isUUIDv7 },
    { field: "customerProfileId", valid: isUUIDv7 },
    { field: "pipelineId", valid: isUUIDv7 },
    { field: "stageId", valid: isUUIDv7 },
  ],
};

function creationSummaryAction(
  event: EntityAuditEvent,
  context: { entityType: string; entityId?: string | null },
): string | null {
  if (event.outcome === "FAILURE") return null;
  const action = CREATION_ACTIONS[context.entityType];
  if (!action) return null;
  if (event.action === action) return action;
  if (!context.entityId) return null;
  const required = CREATION_FIELDS[context.entityType];
  if (!required) return null;
  return required.every(({ field, valid }) =>
    event.changes.some(
      (change) =>
        change.subjectId === context.entityId &&
        change.field === field &&
        change.before == null &&
        valid(change.after),
    ),
  )
    ? action
    : null;
}
