"use client";

import { Fragment, useRef } from "react";
import { ArrowRightToLine, Plus, Trash2, X } from "lucide-react";
import {
  Badge,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
  iconSize,
  mirrorInRtl,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import type {
  CrmSearchCondition,
  CrmSearchConnector,
  CrmSearchFieldDef,
  CrmSearchGroup,
} from "../search/filter-tree";
import type { CrmSearchCatalogueOption } from "./CrmAdvancedSearchCard";
import { CrmSearchConditionControls } from "./CrmSearchConditionControls";

interface CrmSearchGroupRowProps<Id extends string> {
  group: CrmSearchGroup<Id>;
  groupIndex: number;
  fields: readonly CrmSearchFieldDef<Id>[];
  fieldLabels: Record<Id, string>;
  enumLabel: (field: Id, wireValue: string) => string;
  catalogueOptions: (field: Id) => readonly CrmSearchCatalogueOption[];
  resolve: (id: Id) => CrmSearchFieldDef<Id>;
  /** False on a lone row: removing it would only put back an identical blank row. */
  removable: boolean;
  disabled?: boolean;
  onConnectorChange: (connector: CrmSearchConnector) => void;
  onPatch: (conditionIndex: number, patch: Partial<CrmSearchCondition<Id>>) => void;
  onConditionAdded: () => void;
  onConditionRemoved: (conditionIndex: number) => void;
  onRemoved: () => void;
}

/**
 * One OR group on one line: `WHERE`/`OR`, then its AND-ed conditions side by
 * side, then `+` for the next AND.
 *
 * The leading cluster and the conditions are two grid columns, so conditions
 * that wrap stay aligned under the first condition instead of sliding under
 * the trash button — the eye reads the connector column straight down.
 *
 * The AND between conditions is a label, not a picker. Inside a row it can
 * only ever be AND; an OR is a new row, which is what keeps precedence
 * readable without parentheses.
 */
export function CrmSearchGroupRow<Id extends string>({
  group,
  groupIndex,
  fields,
  fieldLabels,
  enumLabel,
  catalogueOptions,
  resolve,
  removable,
  disabled,
  onConnectorChange,
  onPatch,
  onConditionAdded,
  onConditionRemoved,
  onRemoved,
}: CrmSearchGroupRowProps<Id>) {
  const { t } = useI18n();
  const copy = t.crmAdvancedSearch;
  const groupNumber = groupIndex + 1;
  const merged = useRef(false);

  return (
    <div
      role="group"
      aria-label={formatTemplate(copy.groupLabel, { number: groupIndex + 1 })}
      className="grid grid-cols-1 gap-2 py-1.5 md:grid-cols-[auto_1fr] md:items-start"
    >
      <div className="flex h-(--size-control-sm) items-center gap-1">
        {/* The rail's tick into this row; OR order never changes a result,
            so this is a marker, not a drag handle. */}
        <ArrowRightToLine
          className={cn(iconSize({ size: "sm" }), "text-muted-foreground", mirrorInRtl)}
          aria-hidden="true"
        />
        {removable ? (
          <IconAction
            label={formatTemplate(copy.removeGroup, { number: groupIndex + 1 })}
            disabled={disabled}
            onClick={onRemoved}
          >
            <Trash2 className={cn(iconSize({ size: "sm" }), "text-destructive")} aria-hidden="true" />
          </IconAction>
        ) : (
          // Holds the trash's width so a lone row lines up with a later one.
          <span className="size-(--size-control-sm) shrink-0" aria-hidden="true" />
        )}

        {groupIndex === 0 ? (
          <span className="w-20 shrink-0 text-center text-2xs font-medium uppercase text-muted-foreground">
            {copy.where}
          </span>
        ) : (
          // AND here merges this row into the one above; OR keeps it apart.
          <Select
            value="OR"
            disabled={disabled}
            onValueChange={(next) => {
              merged.current = next === "AND";
              onConnectorChange(next as CrmSearchConnector);
            }}
          >
            <SelectTrigger
              size="sm"
              className="w-20 shrink-0"
              aria-label={formatTemplate(copy.connector, { group: groupNumber })}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              onCloseAutoFocus={(event) => {
                // After a merge this trigger, reused by the row that slid up
                // into this index, would take focus back from the merged
                // condition the card just focused.
                if (!merged.current) return;
                merged.current = false;
                event.preventDefault();
              }}
            >
              <SelectItem value="OR">{copy.or}</SelectItem>
              <SelectItem value="AND">{copy.and}</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        {group.conditions.map((condition, conditionIndex) => (
          // Keyed by POSITION. Every control is fully controlled by props, so
          // an index that shifts after a removal still renders the right
          // condition — and a stable key is what keeps a Radix trigger from
          // being destroyed in the same commit that closes its menu, which
          // drops focus to the body.
          <Fragment key={conditionIndex}>
            {conditionIndex > 0 && <Badge tone="brand">{copy.and}</Badge>}
            {/* Numbered, so a field repeated across rows still has controls
                a screen reader can tell apart. */}
            <div
              role="group"
              aria-label={formatTemplate(copy.conditionLabel, {
                number: conditionIndex + 1,
                group: groupNumber,
              })}
              className="flex flex-wrap items-center gap-1.5"
            >
              <CrmSearchConditionControls
                focusKey={`${groupIndex}:${conditionIndex}`}
                condition={condition}
                definition={
                  condition.fieldSelected === false ? undefined : resolve(condition.field)
                }
                fields={fields}
                fieldLabels={fieldLabels}
                enumLabel={enumLabel}
                catalogueOptions={catalogueOptions}
                disabled={disabled}
                onPatch={(patch) => onPatch(conditionIndex, patch)}
              />
              <IconAction
                label={formatTemplate(copy.removeCondition, {
                  number: conditionIndex + 1,
                  group: groupNumber,
                  field:
                    condition.fieldSelected === false ? copy.field : fieldLabels[condition.field],
                })}
                disabled={disabled}
                onClick={() => onConditionRemoved(conditionIndex)}
              >
                <X className={cn(iconSize({ size: "sm" }), "text-muted-foreground")} aria-hidden="true" />
              </IconAction>
            </div>
          </Fragment>
        ))}

        <IconAction
          label={formatTemplate(copy.addCondition, { group: groupNumber })}
          variant="outline"
          disabled={disabled}
          onClick={onConditionAdded}
        >
          <Plus className={iconSize({ size: "sm" })} aria-hidden="true" />
        </IconAction>
      </div>
    </div>
  );
}

/** An icon-only button: the dictionary label is its name and its tooltip. */
function IconAction({
  label,
  variant = "ghost",
  disabled,
  onClick,
  children,
}: {
  label: string;
  variant?: "ghost" | "outline";
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size="sm"
          disabled={disabled}
          aria-label={label}
          // The tooltip repeats the name; describing the button with it
          // would read the same words twice on focus.
          aria-describedby={undefined}
          onClick={onClick}
          className="size-(--size-control-sm) shrink-0 p-0"
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
