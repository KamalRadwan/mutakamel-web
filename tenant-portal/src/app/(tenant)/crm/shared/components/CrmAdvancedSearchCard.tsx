"use client";

import { useState } from "react";
import { ChevronDown, Plus, Search, Trash2 } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  DatePicker,
  Input,
  MultiSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
  iconSize,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { fromIsoDate, toIsoDate } from "../iso-date";
import {
  crmGroupsWithCondition,
  crmGroupsWithConditionAdded,
  crmGroupsWithConditionRemoved,
  crmGroupsWithGroupAdded,
  crmGroupsWithGroupRemoved,
  crmOperatorTakesManyValues,
  crmOperatorTakesNoValue,
  crmOperatorTakesTwoValues,
  crmOperatorsFor,
  type CrmFilterOperator,
  type CrmSearchCondition,
  type CrmSearchFieldDef,
  type CrmSearchGroup,
} from "../search/filter-tree";

/** One option of a catalogue-backed field, already localized by the caller. */
export interface CrmSearchCatalogueOption {
  id: string;
  label: string;
  /**
   * Rendered instead of `label` inside a single-value picker — the acquisition
   * source's icon row, for instance. The multi-value picker takes plain text
   * only, because its chips and its type-ahead both match on the label.
   */
  content?: React.ReactNode;
}

export interface CrmAdvancedSearchCardProps<Id extends string> {
  /** Every field this module may filter on. Order is the picker's order. */
  fields: readonly CrmSearchFieldDef<Id>[];
  fieldLabels: Record<Id, string>;
  /** A localized label for one accepted wire value of an enum field. */
  enumLabel: (field: Id, wireValue: string) => string;
  /** The options of a `catalogue` field, or an empty list while it is degraded. */
  catalogueOptions: (field: Id) => readonly CrmSearchCatalogueOption[];
  /** Free text over the columns the tree cannot reach. */
  text: string;
  onTextChange: (next: string) => void;
  /**
   * What the free-text box actually matches on THIS screen, when it is not
   * what the shared copy says. Free text is a per-repository `searchableFields`
   * list, not one rule: leads and customers match the party's name, phone and
   * email; opportunities match the title alone. A card that told every screen
   * the same story would be lying to two of them.
   */
  textHint?: string;
  groups: readonly CrmSearchGroup<Id>[];
  onGroupsChange: (next: readonly CrmSearchGroup<Id>[]) => void;
  /** Runs the query. Nothing else in this card touches the network. */
  onSubmit: () => void;
  /** Clears every condition and the free text with them. */
  onReset: () => void;
  disabled?: boolean;
}

/**
 * The advanced-search card: free text, OR-separated groups of AND-ed
 * conditions, and one button that runs them.
 *
 * Four decisions are load-bearing:
 *
 *  1. **Nothing runs until Search is pressed.** A filter tree is built one
 *     control at a time and every intermediate state is a different question;
 *     a debounce would fire a request for each of them, and the half-built
 *     ones are usually the expensive ones. The basic bar keeps its debounce
 *     because a single text box has no half-built state worth skipping.
 *  2. **OR starts a new SECTION.** The wire grammar allows a boolean operator
 *     per adjacent pair, but a flat list of rows joined by mixed AND/OR reads
 *     by precedence a user cannot see. A group is a boundary they can point
 *     at, and it maps exactly onto `{op:"OR",children:[{op:"AND",…},…]}`.
 *  3. **A field may be repeated.** `POST /search` has a node per leaf, not a
 *     query-string slot per key, so `stageFlag = NEW OR stageFlag = CONTACTED`
 *     is expressible and the picker withholds nothing.
 *  4. **Searching collapses the card.** The answer is the table below it, and
 *     a builder that stays open pushes the first row off the screen.
 */
export function CrmAdvancedSearchCard<Id extends string>({
  fields,
  fieldLabels,
  enumLabel,
  catalogueOptions,
  text,
  onTextChange,
  textHint,
  groups,
  onGroupsChange,
  onSubmit,
  onReset,
  disabled,
}: CrmAdvancedSearchCardProps<Id>) {
  const { t } = useI18n();
  // Open on arrival: the card exists to be filled in. It closes itself on
  // Search (decision 4) and the trigger reopens it to adjust the question.
  const [isOpen, setIsOpen] = useState(true);

  const copy = t.crmAdvancedSearch;
  // Never empty: every caller passes its whole whitelist, and a module with no
  // filterable field would not mount this card at all.
  const first = fields[0]!;

  function resolve(id: Id): CrmSearchFieldDef<Id> {
    const definition = fields.find((candidate) => candidate.id === id);
    // Only reachable through a cast — the picker offers ids from this list.
    if (!definition) throw new Error(`Unknown search field: ${id}`);
    return definition;
  }

  // What the header says while the card is shut, so a collapsed filter is
  // never a silent one. Counts only conditions a user actually filled in,
  // because the blank ones are dropped before the request is built.
  const filledCount = groups.reduce(
    (total, group) =>
      total +
      group.conditions.filter(
        (condition) =>
          crmOperatorTakesNoValue(condition.operator) || condition.value.trim().length > 0,
      ).length,
    0,
  );

  function submit() {
    onSubmit();
    setIsOpen(false);
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-border">
        {/* The header's rule separates it from the body; with the body shut
            there is nothing to separate it from. */}
        <CardHeader
          className={cn(
            "flex flex-row items-center justify-between gap-2 py-3",
            !isOpen && "border-b-0",
          )}
        >
          <CollapsibleTrigger disabled={disabled} className="text-sm text-foreground">
            <ChevronDown
              className={cn(
                iconSize({ size: "md" }),
                "text-muted-foreground transition-transform duration-150",
                !isOpen && "-rotate-90 rtl:rotate-90",
              )}
              aria-hidden="true"
            />
            {copy.title}
          </CollapsibleTrigger>

          {!isOpen && (
            <span className="text-2xs text-muted-foreground">
              {filledCount > 0
                ? formatTemplate(copy.summary, { count: filledCount })
                : copy.summaryEmpty}
            </span>
          )}
        </CardHeader>

        <CollapsibleContent>
          {/* A real form, so Enter in any text box runs the query the same way
              the button does — a filter builder that ignores Enter feels
              broken long before a user finds the button. */}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!disabled) submit();
            }}
          >
            <CardContent className="flex flex-col gap-3 pt-0">
              <div className="flex flex-col gap-1">
                <Input
                  size="sm"
                  value={text}
                  disabled={disabled}
                  maxLength={200}
                  placeholder={copy.textPlaceholder}
                  aria-label={copy.textLabel}
                  onChange={(event) => onTextChange(event.target.value)}
                />
                {/* Said here rather than in a tooltip, because this box is
                    exactly where a user goes looking for a "name" condition
                    and will not find one in the picker below: display name,
                    phone and email come from a party join the filter compiler
                    cannot resolve to a column. */}
                <p className="text-2xs text-muted-foreground">{textHint ?? copy.textHint}</p>
              </div>

              {groups.map((group, groupIndex) => (
                // Keyed by POSITION. Every row is fully controlled by props, so
                // an index that shifts after a removal still renders the right
                // condition — and a stable key is what keeps a Radix trigger
                // from being destroyed in the same commit that closes its menu,
                // which drops focus to the body.
                <div key={groupIndex} className="flex flex-col gap-2">
                  {groupIndex > 0 && (
                    // The OR boundary, drawn as a rule with a word on it: this
                    // is the one join in the card a reader must not have to
                    // infer, since everything inside a section is AND.
                    <div className="flex items-center gap-2 py-1">
                      <span className="h-px flex-1 bg-border" aria-hidden="true" />
                      <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-2xs uppercase text-muted-foreground">
                        {copy.or}
                      </span>
                      <span className="h-px flex-1 bg-border" aria-hidden="true" />
                    </div>
                  )}

                  <div
                    role="group"
                    aria-label={formatTemplate(copy.groupLabel, { number: groupIndex + 1 })}
                    className="flex flex-col gap-2 rounded-sm border border-border bg-card p-3"
                  >
                    {group.conditions.map((condition, conditionIndex) => (
                      <div key={conditionIndex} className="flex flex-wrap items-center gap-2">
                        <span
                          aria-hidden={conditionIndex === 0 || undefined}
                          className={cn(
                            "shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-2xs uppercase text-muted-foreground",
                            conditionIndex === 0 && "invisible",
                          )}
                        >
                          {copy.and}
                        </span>

                        <ConditionRow
                          condition={condition}
                          definition={resolve(condition.field)}
                          fields={fields}
                          fieldLabels={fieldLabels}
                          enumLabel={enumLabel}
                          catalogueOptions={catalogueOptions}
                          disabled={disabled}
                          onPatch={(patch) =>
                            onGroupsChange(
                              crmGroupsWithCondition(
                                groups,
                                groupIndex,
                                conditionIndex,
                                patch,
                                resolve,
                              ),
                            )
                          }
                        />

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={disabled}
                          aria-label={formatTemplate(copy.removeCondition, {
                            field: fieldLabels[condition.field],
                          })}
                          onClick={() =>
                            onGroupsChange(
                              crmGroupsWithConditionRemoved(
                                groups,
                                groupIndex,
                                conditionIndex,
                                first,
                              ),
                            )
                          }
                          className="size-6 shrink-0 rounded-full p-0"
                        >
                          <Trash2 className="size-3.5 text-destructive" aria-hidden="true" />
                        </Button>
                      </div>
                    ))}

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={disabled}
                        onClick={() =>
                          onGroupsChange(
                            crmGroupsWithConditionAdded(groups, groupIndex, first),
                          )
                        }
                      >
                        <Plus className={iconSize({ size: "md" })} aria-hidden="true" />
                        {copy.addCondition}
                      </Button>

                      {groups.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={disabled}
                          onClick={() =>
                            onGroupsChange(crmGroupsWithGroupRemoved(groups, groupIndex, first))
                          }
                        >
                          {formatTemplate(copy.removeGroup, { number: groupIndex + 1 })}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  onClick={() => onGroupsChange(crmGroupsWithGroupAdded(groups, first))}
                >
                  <Plus className={iconSize({ size: "md" })} aria-hidden="true" />
                  {copy.addGroup}
                </Button>
              </div>
            </CardContent>

            <CardFooter className="flex flex-wrap items-center justify-end gap-2 pt-0">
              <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onReset}>
                {copy.reset}
              </Button>
              <Button type="submit" size="sm" disabled={disabled}>
                <Search className={iconSize({ size: "md" })} aria-hidden="true" />
                {copy.submit}
              </Button>
            </CardFooter>
          </form>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

interface ConditionRowProps<Id extends string> {
  condition: CrmSearchCondition<Id>;
  definition: CrmSearchFieldDef<Id>;
  fields: readonly CrmSearchFieldDef<Id>[];
  fieldLabels: Record<Id, string>;
  enumLabel: (field: Id, wireValue: string) => string;
  catalogueOptions: (field: Id) => readonly CrmSearchCatalogueOption[];
  disabled?: boolean;
  onPatch: (patch: Partial<CrmSearchCondition<Id>>) => void;
}

/**
 * Field, operator, value — where both the operator LIST and the value CONTROL
 * follow the field's kind.
 *
 * The operator list is the whole point of deriving it: `ilike` on a date and
 * `between` on an enum are both `400 INVALID_OPERATOR_VALUE`, which arrives at
 * the screen as a failed load rather than as an unavailable option.
 */
function ConditionRow<Id extends string>({
  condition,
  definition,
  fields,
  fieldLabels,
  enumLabel,
  catalogueOptions,
  disabled,
  onPatch,
}: ConditionRowProps<Id>) {
  const { t, lang } = useI18n();
  const copy = t.crmAdvancedSearch;
  const operators = crmOperatorsFor(definition.kind, definition.nullable ?? false);
  const operatorLabels: Record<CrmFilterOperator, string> = copy.operators;

  // Names the row as well as the control, so several conditions do not present
  // a screen reader with identically labelled value boxes.
  const valueLabel = `${copy.value}: ${fieldLabels[definition.id]}`;

  return (
    <>
      <Select
        value={condition.field}
        disabled={disabled}
        onValueChange={(next) => onPatch({ field: next as Id })}
      >
        <SelectTrigger size="sm" className="w-52" aria-label={copy.field}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {/* Every field, every time: repeating one is legal on this wire. */}
          {fields.map((candidate) => (
            <SelectItem key={candidate.id} value={candidate.id}>
              {fieldLabels[candidate.id]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={condition.operator}
        disabled={disabled}
        onValueChange={(next) => onPatch({ operator: next as CrmFilterOperator })}
      >
        <SelectTrigger size="sm" className="w-44" aria-label={copy.operator}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {operators.map((operator) => (
            <SelectItem key={operator} value={operator}>
              {operatorLabels[operator]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <ValueControl
        condition={condition}
        definition={definition}
        label={valueLabel}
        enumLabel={enumLabel}
        catalogueOptions={catalogueOptions}
        disabled={disabled}
        language={lang}
        onPatch={onPatch}
      />
    </>
  );
}

interface ValueControlProps<Id extends string> {
  condition: CrmSearchCondition<Id>;
  definition: CrmSearchFieldDef<Id>;
  label: string;
  enumLabel: (field: Id, wireValue: string) => string;
  catalogueOptions: (field: Id) => readonly CrmSearchCatalogueOption[];
  disabled?: boolean;
  language: ReturnType<typeof useI18n>["lang"];
  onPatch: (patch: Partial<CrmSearchCondition<Id>>) => void;
}

/** The value half of a row: nothing, one control, a list, or a pair. */
function ValueControl<Id extends string>({
  condition,
  definition,
  label,
  enumLabel,
  catalogueOptions,
  disabled,
  language,
  onPatch,
}: ValueControlProps<Id>) {
  const { t } = useI18n();
  const copy = t.crmAdvancedSearch;

  // `isNull`/`isNotNull` carry NO value key at all; the compiler drops it and
  // the row must not offer a box that would silently be ignored.
  if (crmOperatorTakesNoValue(condition.operator)) {
    return <span className="text-2xs text-muted-foreground">{copy.noValueNeeded}</span>;
  }

  if (crmOperatorTakesManyValues(condition.operator)) {
    const options = catalogueOptions(definition.id);
    const selectable =
      definition.kind === "enum"
        ? (definition.values ?? []).map((wireValue) => ({
            value: wireValue,
            label: enumLabel(definition.id, wireValue),
          }))
        : options.map((option) => ({ value: option.id, label: option.label }));

    // A raw uuid column has no catalogue to pick from, so the list is typed.
    if (definition.kind === "uuid") {
      return (
        <Input
          size="sm"
          className="w-60"
          dir="ltr"
          value={condition.value}
          disabled={disabled}
          placeholder={copy.listPlaceholder}
          aria-label={label}
          onChange={(event) => onPatch({ value: event.target.value })}
        />
      );
    }

    return (
      <MultiSelect
        className="w-60"
        values={splitList(condition.value)}
        options={selectable}
        disabled={disabled || selectable.length === 0}
        placeholder={
          selectable.length > 0 ? copy.selectValue : copy.catalogueUnavailable
        }
        emptyLabel={copy.catalogueUnavailable}
        moreLabel={copy.multiMore}
        removeLabel={copy.multiRemove}
        overflowLabel={copy.multiOverflow}
        clearAllLabel={copy.multiClearAll}
        onValuesChange={(next) => onPatch({ value: next.join(",") })}
      />
    );
  }

  const isRange = crmOperatorTakesTwoValues(condition.operator);

  if (definition.kind === "date") {
    return (
      <>
        <DatePicker
          className="w-44"
          value={fromIsoDate(condition.value)}
          language={language}
          disabled={disabled}
          placeholder={isRange ? copy.valueFrom : copy.datePlaceholder}
          clearLabel={copy.clearDate}
          onValueChange={(next) => onPatch({ value: toIsoDate(next) })}
        />
        {isRange && (
          <DatePicker
            className="w-44"
            value={fromIsoDate(condition.valueTo)}
            language={language}
            disabled={disabled}
            placeholder={copy.valueTo}
            clearLabel={copy.clearDate}
            onValueChange={(next) => onPatch({ valueTo: toIsoDate(next) })}
          />
        )}
      </>
    );
  }

  if (definition.kind === "number") {
    return (
      <>
        <Input
          size="sm"
          className="w-28 tabular-nums"
          dir="ltr"
          inputMode="decimal"
          value={condition.value}
          disabled={disabled}
          placeholder={isRange ? copy.valueFrom : copy.numberPlaceholder}
          aria-label={label}
          onChange={(event) => onPatch({ value: event.target.value })}
        />
        {isRange && (
          <Input
            size="sm"
            className="w-28 tabular-nums"
            dir="ltr"
            inputMode="decimal"
            value={condition.valueTo}
            disabled={disabled}
            placeholder={copy.valueTo}
            aria-label={`${label} — ${copy.valueTo}`}
            onChange={(event) => onPatch({ valueTo: event.target.value })}
          />
        )}
      </>
    );
  }

  if (definition.kind === "enum" || definition.kind === "catalogue") {
    const options =
      definition.kind === "enum"
        ? (definition.values ?? []).map((wireValue) => ({
            id: wireValue,
            label: enumLabel(definition.id, wireValue),
          }))
        : catalogueOptions(definition.id);
    const hasOptions = options.length > 0;

    return (
      <Select
        value={condition.value}
        disabled={disabled || !hasOptions}
        onValueChange={(next) => onPatch({ value: next })}
      >
        <SelectTrigger size="sm" className="w-60" aria-label={label}>
          <SelectValue
            placeholder={hasOptions ? copy.selectValue : copy.catalogueUnavailable}
          />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {("content" in option && option.content) || option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // `uuid` and `text` alike: a single box. A uuid is typed left-to-right in
  // both languages, which `dir="ltr"` is what states.
  return (
    <Input
      size="sm"
      className={cn("w-60", definition.kind === "uuid" && "font-mono")}
      dir={definition.kind === "uuid" ? "ltr" : undefined}
      value={condition.value}
      disabled={disabled}
      maxLength={definition.maxLength}
      placeholder={definition.kind === "uuid" ? copy.uuidPlaceholder : copy.textValuePlaceholder}
      aria-label={label}
      onChange={(event) => onPatch({ value: event.target.value })}
    />
  );
}

/** The comma-joined list a multi-value row stores, back as its parts. */
function splitList(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}
