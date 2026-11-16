"use client";

import { AlignLeft, CalendarDays, CalendarClock, Hash, Link, List, ListChecks, Mail, Pencil, Phone, Search, ShieldCheck, ToggleLeft, Type } from "lucide-react";
import { Badge, Button, Tooltip, TooltipContent, TooltipTrigger, type ColumnDef } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedValue } from "@/lib/format/localized";
import type { CrmCustomFieldType, CustomFieldItem } from "../custom-field-contract";

const TYPE_ICONS = { TEXT: Type, TEXTAREA: AlignLeft, NUMBER: Hash, DATE: CalendarDays,
  DATETIME: CalendarClock, BOOLEAN: ToggleLeft, SELECT: List, MULTI_SELECT: ListChecks,
  URL: Link, EMAIL: Mail, PHONE: Phone } satisfies Record<CrmCustomFieldType, typeof Type>;

export function useCustomFieldColumns({ canManage, busy, edit, requirements }: {
  canManage: boolean; busy: boolean; edit: (field: CustomFieldItem) => void; requirements: (field: CustomFieldItem) => void;
}): ColumnDef<CustomFieldItem>[] {
  const { t, lang } = useI18n();
  const columns: ColumnDef<CustomFieldItem>[] = [
    { id: "nameAr", header: t.crmLeadStages.arabicName, cell: (item) => <div className="flex items-center gap-1.5">
      <bdi dir="rtl" className="min-w-0">{item.nameAr}</bdi>
      {item.isSearchable && <Tooltip><TooltipTrigger asChild>
        <span tabIndex={0} aria-label={t.crmCustomFields.searchable} className="shrink-0 text-muted-foreground">
          <Search className="size-3" aria-hidden="true" /></span>
      </TooltipTrigger><TooltipContent>{t.crmCustomFields.searchable}</TooltipContent></Tooltip>}
    </div> },
    { id: "nameEn", header: t.crmLeadStages.englishName, cell: (item) => <bdi dir="ltr">{item.nameEn}</bdi> },
    { id: "key", header: t.crmCustomFields.key, cell: (item) => <bdi dir="ltr" className="font-mono text-muted-foreground">{item.fieldKey}</bdi> },
    { id: "owner", header: t.crmCustomFields.owner, cell: (item) => t.crmCustomFields.ownerTypes[item.ownerType] },
    { id: "fieldType", header: t.crmCustomFields.fieldType, cell: (item) => {
      const Icon = TYPE_ICONS[item.type];
      return <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        {t.crmCustomFields.fieldTypes[item.type]}
        {item.optionsCount > 0 && <span className="text-muted-foreground">· {t.crmCustomFields.optionsCount(item.optionsCount)}</span>}
      </span>;
    } },
    { id: "requirements", header: t.crmCustomFields.requirements, cell: (item) => item.requirements.some((rule) => rule.isRequired) ?
      <div className="flex flex-wrap gap-1">{item.requirements.filter((rule) => rule.isRequired).map((rule) => (
        <Badge key={`${rule.operation}-${rule.entityScope ?? "all"}`} tone="caution">
          {t.crmCustomFields.requirementOperations[rule.operation]}
          {rule.entityScope ? ` · ${t.crmCustomFields.ownerTypes[rule.entityScope]}` : ""}
        </Badge>
      ))}</div> : <span className="text-muted-foreground">{t.crmCustomFields.optional}</span> },
    { id: "status", header: t.common.status, cell: (item) => <Badge tone={item.isActive ? "positive" : "neutral"}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {item.isActive ? t.common.active : t.common.inactive}
    </Badge> },
  ];
  if (canManage) columns.push({ id: "actions", header: t.common.actions, align: "end", sticky: "end",
    cell: (item) => <div className="flex justify-end gap-1">
      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="sm" className="size-7 p-0" disabled={busy}
        aria-label={`${t.crmCustomFields.editTitle}: ${localizedValue(item.nameAr, item.nameEn, lang)}`} onClick={() => edit(item)}>
        <Pencil className="size-3.5" aria-hidden="true" /></Button></TooltipTrigger><TooltipContent>{t.crmCustomFields.editTitle}</TooltipContent></Tooltip>
      <Tooltip><TooltipTrigger asChild><span tabIndex={!item.isActive ? 0 : undefined}>
        <Button variant="ghost" size="sm" className="size-7 p-0" disabled={busy || !item.isActive}
          aria-label={`${t.crmCustomFields.requirementsTitle}: ${localizedValue(item.nameAr, item.nameEn, lang)}`} onClick={() => requirements(item)}>
          <ShieldCheck className="size-3.5" aria-hidden="true" /></Button></span></TooltipTrigger>
        <TooltipContent>{item.isActive ? t.crmCustomFields.requirementsTitle : t.crmCustomFields.inactiveRequirements}</TooltipContent></Tooltip>
    </div>,
  });
  return columns;
}

