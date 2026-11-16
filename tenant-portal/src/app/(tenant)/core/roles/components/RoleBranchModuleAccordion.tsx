"use client";

import { LockKeyhole } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Button,
  Card,
  Checkbox,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { Language } from "@/i18n/useLanguage";
import { localizedValue } from "@/lib/format/localized";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type {
  RoleBranchCatalogueItem,
  RoleRecordScope,
} from "../contracts/role-branch-contract";
import {
  computeNodeSelectionState,
  isBranchActionRowSelected,
  resolveSelectedRowScope,
} from "../hooks/branch-permissions-selection";
import type {
  BranchActionRow,
  BranchModuleNode,
} from "../hooks/branch-permissions-taxonomy";

interface RoleBranchModuleAccordionProps {
  t: Dictionary;
  lang: Language;
  readOnly: boolean;
  modules: BranchModuleNode[];
  activeSelectedSet: ReadonlySet<string>;
  onToggleActionRow: (row: BranchActionRow) => void;
  onChangeRecordScope: (row: BranchActionRow, scope: RoleRecordScope) => void;
  onToggleCollection: (rows: BranchActionRow[]) => void;
}

export function RoleBranchModuleAccordion({
  t,
  lang,
  readOnly,
  modules,
  activeSelectedSet,
  onToggleActionRow,
  onChangeRecordScope,
  onToggleCollection,
}: RoleBranchModuleAccordionProps) {
  const permCopy = t.coreIdentity.roleBranch.permissions;

  const renderActionRows = (rows: BranchActionRow[]) => (
    <ul className="divide-y divide-border">
      {rows.map((row) => {
        const checked = isBranchActionRowSelected(row, activeSelectedSet);
        const currentScope = resolveSelectedRowScope(row, activeSelectedSet);
        const selectedVariant = row.variants.find(variant => variant.scope === currentScope)?.item;
        const rowLabel = localizedValue(selectedVariant?.nameAr ?? row.labelAr, selectedVariant?.nameEn ?? row.labelEn, lang);
        return (
          <li
            key={row.id}
            className="flex min-w-0 flex-col items-stretch gap-2 py-2 ps-5 pe-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:ps-8"
          >
            <label
              className={`flex min-w-0 flex-1 items-center gap-2.5 ${
                readOnly ? "cursor-default" : "cursor-pointer"
              }`}
            >
              <Checkbox
                checked={checked}
                onCheckedChange={() => onToggleActionRow(row)}
                disabled={readOnly}
                aria-label={rowLabel}
              />
              <span className="min-w-0 text-sm font-normal break-words text-foreground sm:truncate">{rowLabel}</span>
            </label>
            {row.variants.length > 1 ? (
              <div className="min-w-0 w-full sm:w-56 sm:shrink-0">
                <Select
                  value={currentScope ?? row.primaryItem.recordScope ?? "ALL"}
                  onValueChange={(next) => onChangeRecordScope(row, next as RoleRecordScope)}
                  disabled={readOnly || !checked}
                >
                  <SelectTrigger
                    size="xs"
                    aria-label={`${permCopy.recordScopes.label}: ${rowLabel}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {row.variants.map((variant) => (
                      <SelectItem key={variant.item.id} value={variant.scope}>
                        {permCopy.recordScopes[variant.scope]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : checked && row.primaryItem.recordScope ? (
              <span className="shrink-0 text-xs text-muted-foreground">
                {row.primaryItem.recordScope === "ALL"
                  ? permCopy.recordScopes.allBranchReadonly
                  : permCopy.recordScopes[row.primaryItem.recordScope]}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );

  return (
    <Card className="min-w-0 overflow-hidden p-0">
      <Accordion type="multiple" defaultValue={modules.map((mod) => mod.id)}>
        {modules.map((mod) => {
          const modLabel = localizedValue(mod.labelAr, mod.labelEn, lang);
          const modState = computeNodeSelectionState(mod.allRows, activeSelectedSet);
          return (
            <AccordionItem key={mod.id} value={mod.id} className="last:border-b-0">
              <div className="flex items-center gap-2.5 bg-muted/45 px-3">
                <Checkbox
                  checked={modState.checked}
                  onCheckedChange={() => onToggleCollection(mod.allRows)}
                  disabled={readOnly}
                  aria-label={modLabel}
                />
                <div className="min-w-0 flex-1">
                  <AccordionTrigger className="min-w-0 py-2.5 font-medium">
                    <span className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2 pe-2">
                      <span className="text-sm font-medium break-words text-foreground">{modLabel}</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        {permCopy.groupSummary[modState.summaryKind]}
                      </span>
                    </span>
                  </AccordionTrigger>
                </div>
              </div>
              <AccordionContent className="pb-0">
                <Accordion type="multiple" defaultValue={mod.groups.map((grp) => grp.id)}>
                  {mod.groups.map((grp) => {
                    const grpLabel = localizedValue(grp.labelAr, grp.labelEn, lang);
                    const grpState = computeNodeSelectionState(grp.allRows, activeSelectedSet);
                    return (
                      <AccordionItem
                        key={grp.id}
                        value={grp.id}
                        className="border-t border-border border-b-0"
                      >
                        <div className="flex items-center gap-2.5 ps-5 pe-3">
                          <Checkbox
                            checked={grpState.checked}
                            onCheckedChange={() => onToggleCollection(grp.allRows)}
                            disabled={readOnly}
                            aria-label={grpLabel}
                          />
                          <div className="min-w-0 flex-1">
                            <AccordionTrigger className="min-w-0 py-2 font-medium">
                              <span className="text-sm font-medium break-words text-foreground">{grpLabel}</span>
                            </AccordionTrigger>
                          </div>
                        </div>
                        <AccordionContent className="pb-1">
                          {grp.directRows.length > 0 ? renderActionRows(grp.directRows) : null}
                          {grp.subgroups.map((sub) => {
                            const subLabel = localizedValue(sub.labelAr, sub.labelEn, lang);
                            const subState = computeNodeSelectionState(sub.rows, activeSelectedSet);
                            return (
                              <div key={sub.id} className="border-t border-border/60">
                                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 bg-muted/20 py-1.5 ps-7 pe-3">
                                  <label
                                    className={`flex min-w-0 flex-1 items-center gap-2.5 ${
                                      readOnly ? "cursor-default" : "cursor-pointer"
                                    }`}
                                  >
                                    <Checkbox
                                      checked={subState.checked}
                                      onCheckedChange={() => onToggleCollection(sub.rows)}
                                      disabled={readOnly}
                                      aria-label={subLabel}
                                    />
                                    <span className="text-sm font-medium text-foreground">
                                      {subLabel}
                                    </span>
                                  </label>
                                  <span className="text-xs text-muted-foreground">
                                    {permCopy.groupSummary[subState.summaryKind]}
                                  </span>
                                </div>
                                {renderActionRows(sub.rows)}
                              </div>
                            );
                          })}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </Card>
  );
}

export function RoleBranchWorkspaceLockedSection({
  t,
  lang,
  items,
  expanded,
  onToggleExpanded,
}: {
  t: Dictionary;
  lang: Language;
  items: RoleBranchCatalogueItem[];
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  const permCopy = t.coreIdentity.roleBranch.permissions;
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <LockKeyhole className="size-3.5 shrink-0" aria-hidden="true" />
          <span>{permCopy.workspaceLockedNotice}</span>
        </span>
        {items.length > 0 ? (
          <Button type="button" size="xs" variant="ghost" onClick={onToggleExpanded}>
            {expanded
              ? permCopy.workspaceLockedToggleHide
              : formatTemplate(permCopy.workspaceLockedToggleShow, {
                  count: formatNumber(items.length, lang),
                })}
          </Button>
        ) : null}
      </div>
      {expanded && items.length > 0 ? (
        <ul className="grid gap-1.5 border-t border-border pt-2 sm:grid-cols-2">
          {items.map((item) => {
            const itemLabel = localizedValue(item.nameAr, item.nameEn, lang);
            return (
              <li
                key={item.id}
                className="flex items-center justify-between gap-2 rounded-sm border border-border bg-card px-2.5 py-1.5 opacity-75"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Checkbox checked={false} disabled aria-label={itemLabel} />
                  <span className="truncate text-xs text-muted-foreground">{itemLabel}</span>
                </span>
                <Badge tone="neutral" size="sm">
                  {permCopy.workspaceLockedBadge}
                </Badge>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
