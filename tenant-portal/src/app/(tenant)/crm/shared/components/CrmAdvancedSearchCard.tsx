"use client";

import { ChevronDown, Plus, Search, SlidersHorizontal } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
  iconSize,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { useCrmAdvancedSearch } from "../hooks/useCrmAdvancedSearch";
import type { CrmSearchFieldDef, CrmSearchGroup } from "../search/filter-tree";
import { CrmSearchGroupRow } from "./CrmSearchGroupRow";

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
  groups: readonly CrmSearchGroup<Id>[];
  onGroupsChange: (next: readonly CrmSearchGroup<Id>[]) => void;
  /** Runs the query. Nothing else in this card touches the network. */
  onSubmit: () => void;
  /** Clears the caller's advanced-search draft. */
  onReset: () => void;
  disabled?: boolean;
  /** New rows begin with an explicit field choice instead of assuming field 1. */
  requireFieldSelection?: boolean;
}

/**
 * The advanced-search card: OR-separated rows of AND-ed conditions, and one
 * button that runs them.
 *
 * Five decisions are load-bearing:
 *
 *  1. **Nothing runs until Apply is pressed.** A filter tree is built one
 *     control at a time and every intermediate state is a different question;
 *     a debounce would fire a request for each of them, and the half-built
 *     ones are usually the expensive ones. The basic bar keeps its debounce
 *     because a single text box has no half-built state worth skipping.
 *  2. **One row is one OR group.** Its conditions sit side by side joined by
 *     a fixed AND; every row after the first opens with OR, and switching that
 *     to AND merges the row into the one above. A row maps exactly onto one
 *     `{op:"AND",…}` child of `{op:"OR",children:[…]}`, so precedence is the
 *     layout itself.
 *  3. **A field may be repeated.** `POST /search` has a node per leaf, not a
 *     query-string slot per key, so `stageFlag = NEW OR stageFlag = CONTACTED`
 *     is expressible and the picker withholds nothing.
 *  4. **Applying collapses the card.** The answer is the table below it, and
 *     a builder that stays open pushes the first row off the screen.
 *  5. **Every action lives in the header.** A footer costs a full line under a
 *     builder that is usually two rows tall; the header line is already there.
 *
 * State, edits and focus handling live in `useCrmAdvancedSearch`.
 */
export function CrmAdvancedSearchCard<Id extends string>({
  fields,
  fieldLabels,
  enumLabel,
  catalogueOptions,
  groups,
  onGroupsChange,
  onSubmit,
  onReset,
  disabled,
  requireFieldSelection = false,
}: CrmAdvancedSearchCardProps<Id>) {
  const { t } = useI18n();
  const copy = t.crmAdvancedSearch;
  const {
    isOpen,
    setIsOpen,
    toggleRef,
    rowsRef,
    resolve,
    filledCount,
    submit,
    addGroup,
    changeConnector,
    patchCondition,
    addCondition,
    removeCondition,
    removeGroup,
  } = useCrmAdvancedSearch({
    fields,
    groups,
    onGroupsChange,
    onSubmit,
    disabled,
    requireFieldSelection,
  });

  return (
    // A real form around the whole card, header included, so Enter in any box
    // and the header's Apply button run the same submit.
    <form onSubmit={submit}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card className="border-border">
          {/* The header's rule separates it from the body; with the body shut
              there is nothing to separate it from. */}
          <CardHeader
            className={cn(
              "flex flex-row flex-wrap items-center gap-2 py-2 sm:py-2",
              !isOpen && "border-b-0",
            )}
          >
            <div className="flex min-w-0 items-center gap-2">
              <SlidersHorizontal
                className={cn(iconSize({ size: "md" }), "shrink-0 text-muted-foreground")}
                aria-hidden="true"
              />
              <span className="text-sm font-medium text-foreground">{copy.title}</span>
              {/* Always mounted, so a screen reader hears the count change. */}
              <span role="status" aria-live="polite" className="contents">
                {filledCount > 0 ? (
                  <Badge className="normal-case tracking-normal">
                    {formatTemplate(copy.conditionCount, { count: filledCount })}
                  </Badge>
                ) : (
                  // Visible only when shut; while open it still tells a screen
                  // reader that clearing the last condition left none.
                  <span className={cn("text-2xs text-muted-foreground", isOpen && "sr-only")}>
                    {copy.summaryEmpty}
                  </span>
                )}
              </span>
            </div>

            <div className="ms-auto flex flex-wrap items-center gap-2">
              {isOpen && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabled}
                    aria-label={copy.addGroupLabel}
                    onClick={addGroup}
                  >
                    <Plus className={iconSize({ size: "md" })} aria-hidden="true" />
                    {copy.addGroup}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onReset}>
                    {copy.reset}
                  </Button>
                  {/* Outline, not filled: the screen's one filled action is
                      the PageHeader's create button (design law 4). */}
                  <Button type="submit" variant="outline" size="sm" disabled={disabled}>
                    <Search className={iconSize({ size: "md" })} aria-hidden="true" />
                    {copy.submit}
                  </Button>
                </>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <CollapsibleTrigger asChild>
                    {/* Named by the title, not "Collapse…/Expand…": aria-expanded
                        already states which, and both would read as a
                        contradiction. Never disabled — it only shows or hides,
                        and Apply moves focus here even while the caller loads. */}
                    <Button
                      ref={toggleRef}
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={copy.title}
                      aria-describedby={undefined}
                      className="size-(--size-control-sm) p-0"
                    >
                      <ChevronDown
                        className={cn(
                          iconSize({ size: "md" }),
                          "text-muted-foreground transition-transform duration-150",
                          isOpen && "rotate-180",
                        )}
                        aria-hidden="true"
                      />
                    </Button>
                  </CollapsibleTrigger>
                </TooltipTrigger>
                <TooltipContent>{isOpen ? copy.collapse : copy.expand}</TooltipContent>
              </Tooltip>
            </div>
          </CardHeader>

          <CollapsibleContent>
            {/* The rail: one start-side rule down every row, each row ticking
                into it, so the rows read as branches of one question. */}
            <CardContent className="py-1.5 sm:py-1.5">
              <div
                ref={rowsRef}
                className="divide-y divide-border border-s border-border ps-2"
              >
                {groups.map((group, groupIndex) => (
                  <CrmSearchGroupRow
                    // Keyed by POSITION, for the focus reason the row explains.
                    key={groupIndex}
                    group={group}
                    groupIndex={groupIndex}
                    fields={fields}
                    fieldLabels={fieldLabels}
                    enumLabel={enumLabel}
                    catalogueOptions={catalogueOptions}
                    resolve={resolve}
                    removable={groups.length > 1}
                    disabled={disabled}
                    onConnectorChange={(next) => changeConnector(groupIndex, next)}
                    onPatch={(conditionIndex, patch) =>
                      patchCondition(groupIndex, conditionIndex, patch)
                    }
                    onConditionAdded={() => addCondition(groupIndex)}
                    onConditionRemoved={(conditionIndex) =>
                      removeCondition(groupIndex, conditionIndex)
                    }
                    onRemoved={() => removeGroup(groupIndex)}
                  />
                ))}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </form>
  );
}
