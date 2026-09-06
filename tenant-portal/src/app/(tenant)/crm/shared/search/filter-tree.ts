// The GRAMMAR of `POST /crm/*/search` — node shapes, operators, and the
// compiler that turns a screen's groups into a `filterTree`.
//
// This module owns the grammar and NOTHING ELSE. Which fields a module may
// filter on, and what each one is called on the wire, stays in that module's
// own search contract (`lead-search-contract`, `customer-profile-search-contract`,
// `opportunity-search-contract`) — those three remain the only places a CRM
// field name is written. The split is deliberate: field names differ per
// module and drift per module, while the grammar is one thing defined once in
// shared-libs (`SearchManyDto`, `FilterTreeNode`, `FindOperatorsEnum`,
// `OperatorCompiler`) and copied three times would drift three ways.
//
// Four facts from the server shape everything here
// (shared-libs/packages/database/src/query-engine/operator.compiler.ts):
//
//  1. **`isNull`/`isNotNull` take NO value; everything else requires one.**
//     `value === null || value === undefined` on any other operator is
//     `400 INVALID_OPERATOR_VALUE`, so a blank condition must be DROPPED
//     rather than sent empty.
//  2. **`between` is a 2-tuple, `in`/`nin` a non-empty array.** Anything else
//     is `expected 2-tuple` / `expected non-empty array`.
//  3. **`gt`/`gte`/`lt`/`lte` want a number or a date.** A numeric field must
//     send a JSON number, not the control's string: `new Date("500")` parses
//     as the year 500, so a numeric string passes validation and then compares
//     as a timestamp.
//  4. **`like` is case-SENSITIVE while `startsWith`/`endsWith` are not** —
//     both of those compile to `ILIKE`. Offering `like` beside them would put
//     the odd one out in the middle of a case-insensitive set, so only `ilike`
//     is offered. `eqAny`/`neqAny` are literally `In`/`Not(In)` and are left
//     out for the same reason: two names for one operator.

/** Every operator this portal may send. A subset of `FindOperatorsEnum`. */
export type CrmFilterOperator =
  | "eq"
  | "neq"
  | "in"
  | "nin"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  | "ilike"
  | "startsWith"
  | "endsWith"
  | "isNull"
  | "isNotNull";

/** One condition on the wire. `value` is absent for the two null operators. */
export interface CrmFilterLeaf {
  field: string;
  operator: CrmFilterOperator;
  value?: unknown;
}

/** A boolean node. `children` may hold leaves and further groups alike. */
interface CrmFilterGroupNode {
  op: "AND" | "OR";
  children: readonly CrmFilterTreeNode[];
}

export type CrmFilterTreeNode = CrmFilterLeaf | CrmFilterGroupNode;

/**
 * How a field's value is entered, which decides BOTH its operator list and
 * its value control.
 *
 * `catalogue` is a uuid whose options come from a list the screen already
 * holds — a lead stage, an acquisition source, a pipeline. It shares `uuid`'s
 * operators exactly; it is a separate kind only because the control differs.
 */
export type CrmSearchValueKind =
  | "text"
  | "enum"
  | "uuid"
  | "catalogue"
  | "date"
  | "number";

/** The operators each kind may offer, in the order the picker lists them. */
const OPERATORS_BY_KIND: Record<CrmSearchValueKind, readonly CrmFilterOperator[]> = {
  // No `like`: it is the only case-SENSITIVE operator in the family (fact 4).
  text: ["ilike", "startsWith", "endsWith", "eq", "neq"],
  enum: ["eq", "neq", "in", "nin"],
  uuid: ["eq", "neq", "in", "nin"],
  catalogue: ["eq", "neq", "in", "nin"],
  date: ["gte", "lte", "gt", "lt", "between"],
  number: ["eq", "neq", "gt", "gte", "lt", "lte", "between"],
};

/** The two operators that take no value, and may only be offered on a nullable field. */
const NULL_OPERATORS: readonly CrmFilterOperator[] = ["isNull", "isNotNull"];

export function crmOperatorTakesNoValue(operator: CrmFilterOperator): boolean {
  return NULL_OPERATORS.includes(operator);
}

export function crmOperatorTakesTwoValues(operator: CrmFilterOperator): boolean {
  return operator === "between";
}

export function crmOperatorTakesManyValues(operator: CrmFilterOperator): boolean {
  return operator === "in" || operator === "nin";
}

/**
 * The operators a field may be asked with.
 *
 * Offering an operator the server will reject is a bug, not a nuisance: an
 * unsupported pair answers `400 INVALID_OPERATOR_VALUE`, which reaches the
 * screen as a failed load rather than as "that filter is not available".
 * `isNull`/`isNotNull` are appended only for a column that can actually be
 * null — asking whether a `NOT NULL` column is empty is a question with one
 * answer, and drawing it invites a user to ask it.
 */
export function crmOperatorsFor(
  kind: CrmSearchValueKind,
  nullable: boolean,
): readonly CrmFilterOperator[] {
  const base = OPERATORS_BY_KIND[kind];
  return nullable ? [...base, ...NULL_OPERATORS] : base;
}

/** One field a module offers, as the picker and the compiler both need it. */
export interface CrmSearchFieldDef<Id extends string> {
  /**
   * The SCREEN's identity for the field — the picker's value and the
   * dictionary key. Deliberately not the wire name, so a UI rename cannot
   * reach the request.
   */
  readonly id: Id;
  /** The whitelisted column this field filters on. */
  readonly field: string;
  readonly kind: CrmSearchValueKind;
  /** `true` only where the column really is nullable — see `crmOperatorsFor`. */
  readonly nullable?: boolean;
  /** The accepted wire values, for `kind: "enum"` only. */
  readonly values?: readonly string[];
  /** `@MaxLength` equivalent for a text control; a longer value is clamped. */
  readonly maxLength?: number;
}

/**
 * One condition as the screen holds it.
 *
 * Values are kept as the STRINGS their controls produce and converted at
 * compile time. A half-typed number is a string on the way to being a number,
 * and storing it as one would mean deciding what `-` means mid-keystroke.
 */
export interface CrmSearchCondition<Id extends string> {
  field: Id;
  operator: CrmFilterOperator;
  /** The single value, `between`'s lower bound, or `in`'s comma-joined list. */
  value: string;
  /** `between`'s upper bound. Empty for every other operator. */
  valueTo: string;
}

/**
 * A section of the card: conditions AND-ed together.
 *
 * OR lives BETWEEN groups and nowhere else. A per-row AND/OR selector reads as
 * a flat list whose meaning depends on operator precedence a user cannot see;
 * a second section is a boundary they can point at.
 */
export interface CrmSearchGroup<Id extends string> {
  conditions: readonly CrmSearchCondition<Id>[];
}

/** The separator `in`/`nin` lists are typed with, and split on. */
const LIST_SEPARATOR = ",";

/** A blank condition on `field` — the shape both "add" controls produce. */
export function crmBlankCondition<Id extends string>(
  definition: CrmSearchFieldDef<Id>,
): CrmSearchCondition<Id> {
  const [operator] = crmOperatorsFor(definition.kind, definition.nullable ?? false);
  return {
    field: definition.id,
    // Never undefined: every kind's operator list is non-empty by construction.
    operator: operator ?? "eq",
    value: "",
    valueTo: "",
  };
}

/** One group holding one blank condition — what an empty card starts from. */
function crmBlankGroup<Id extends string>(
  definition: CrmSearchFieldDef<Id>,
): CrmSearchGroup<Id> {
  return { conditions: [crmBlankCondition(definition)] };
}

/**
 * The values a condition contributes, or `null` when it contributes nothing.
 *
 * A condition is DROPPED — not sent empty — when its value is blank, because
 * every operator but the two null ones answers `400 INVALID_OPERATOR_VALUE`
 * on a missing value (fact 1). A user with a half-filled row wants the rest of
 * their query to run, not an error.
 */
function conditionValue<Id extends string>(
  condition: CrmSearchCondition<Id>,
  definition: CrmSearchFieldDef<Id>,
): { present: false } | { present: true; value?: unknown } {
  if (crmOperatorTakesNoValue(condition.operator)) return { present: true };

  const value = condition.value.trim();

  if (crmOperatorTakesTwoValues(condition.operator)) {
    const to = condition.valueTo.trim();
    // Both bounds or neither: `between` is a 2-tuple and a one-sided range is
    // a `gte`, which the user can pick instead (fact 2).
    if (!value || !to) return { present: false };
    return { present: true, value: [scalar(value, definition), scalar(to, definition)] };
  }

  if (crmOperatorTakesManyValues(condition.operator)) {
    const parts = value
      .split(LIST_SEPARATOR)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    if (parts.length === 0) return { present: false };
    return { present: true, value: parts.map((part) => scalar(part, definition)) };
  }

  if (!value) return { present: false };
  return { present: true, value: scalar(value, definition) };
}

/**
 * One control value in the JSON type its column compares as.
 *
 * Only `number` converts. A date stays the `YYYY-MM-DD` string the picker
 * produced — `requireNumberOrDate` accepts it, and Postgres compares a
 * `timestamptz` against it correctly, while `new Date(...)` here would bake
 * the browser's timezone into a date the user picked in their own.
 */
function scalar<Id extends string>(
  value: string,
  definition: CrmSearchFieldDef<Id>,
): unknown {
  if (definition.kind !== "number") return value;
  const parsed = Number(value);
  // A non-numeric string reaching a numeric column is the user's typo, not a
  // request worth making: `Number("")` is 0 and would filter on zero.
  return Number.isFinite(parsed) ? parsed : value;
}

/**
 * `groups` compiled into the `filterTree` the route takes, or `undefined`
 * when nothing was actually asked.
 *
 * Three shapes come out, and the smallest one that says the thing is the one
 * sent — the tree limits are depth 5 / 100 leaves / 100 children per group,
 * and a needless wrapper spends a level of depth to say nothing:
 *
 *   one leaf, one group      -> the leaf itself
 *   several leaves, one group -> `{ op: "AND", children: [...] }`
 *   several groups            -> `{ op: "OR", children: [group, ...] }`,
 *                                each group collapsed by the same two rules
 *
 * `resolve` throws on an unknown field id, which is the whitelist boundary:
 * `400 INVALID_FIELD` empties the screen, so an id that cannot be resolved is
 * a bug in this portal and is raised as one.
 */
export function crmCompileFilterTree<Id extends string>(
  groups: readonly CrmSearchGroup<Id>[],
  resolve: (id: Id) => CrmSearchFieldDef<Id>,
): CrmFilterTreeNode | undefined {
  const compiled: CrmFilterTreeNode[] = [];

  for (const group of groups) {
    const leaves: CrmFilterTreeNode[] = [];
    for (const condition of group.conditions) {
      const definition = resolve(condition.field);
      // A field may appear as often as a user likes: the tree has a node per
      // leaf, unlike the query string's one slot per key. `stageFlag = NEW OR
      // stageFlag = CONTACTED` is a normal question and used to be unaskable.
      const outcome = conditionValue(condition, definition);
      if (!outcome.present) continue;
      leaves.push(
        "value" in outcome
          ? { field: definition.field, operator: condition.operator, value: outcome.value }
          : // No `value` KEY at all, not `value: undefined`: `JSON.stringify`
            // drops an undefined property, but the object would still carry it
            // for any caller that inspects the body before it is serialised.
            { field: definition.field, operator: condition.operator },
      );
    }
    if (leaves.length === 0) continue;
    compiled.push(leaves.length === 1 ? leaves[0]! : { op: "AND", children: leaves });
  }

  if (compiled.length === 0) return undefined;
  return compiled.length === 1 ? compiled[0]! : { op: "OR", children: compiled };
}

/** The POST body every `/search` route takes, minus the module's own extras. */
export interface CrmSearchRequestBody {
  branchId: string;
  /** Omitted entirely when no condition was filled in — not sent as `{}`. */
  filterTree?: CrmFilterTreeNode;
  /** Free text over the party columns the tree cannot reach. */
  search?: string;
  /** `field:DIR`, the one form `SortCompiler.normalise` and the GET route agree on. */
  sort?: string;
  page: number;
  limit: number;
}

/** `@MaxLength(200)` on `SearchManyDto.search`; a longer term is a 400. */
const CRM_SEARCH_TEXT_MAX_LENGTH = 200;

/**
 * The `search` term as the wire takes it, or `undefined` when there is none.
 *
 * Clamped rather than sent long, for the same reason the list query clamps:
 * a 201st character rejects the whole request, which reads as an empty result
 * rather than as a term that was too long.
 */
export function crmSearchTerm(text: string): string | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, CRM_SEARCH_TEXT_MAX_LENGTH);
}

/* --------------------------- group/condition edits --------------------------- */
//
// Every helper returns fresh objects and fresh arrays, so a caller may hold
// the previous state and compare identities.

export function crmGroupsWithCondition<Id extends string>(
  groups: readonly CrmSearchGroup<Id>[],
  groupIndex: number,
  conditionIndex: number,
  patch: Partial<CrmSearchCondition<Id>>,
  resolve: (id: Id) => CrmSearchFieldDef<Id>,
): readonly CrmSearchGroup<Id>[] {
  return groups.map((group, index) => {
    if (index !== groupIndex) return group;
    return {
      conditions: group.conditions.map((condition, position) => {
        if (position !== conditionIndex) return condition;
        // Changing the FIELD resets the row: `OPEN` means nothing as a stage
        // id, and `ilike` means nothing on a date. Both would reach the wire
        // as a 400 that looks like an empty list.
        if (patch.field !== undefined && patch.field !== condition.field) {
          return crmBlankCondition(resolve(patch.field));
        }
        if (patch.operator !== undefined && patch.operator !== condition.operator) {
          // The operator decides how many values the row holds. Carrying an
          // upper bound out of `between` would send a tuple to `eq`.
          return { ...condition, operator: patch.operator, value: "", valueTo: "" };
        }
        return { ...condition, ...patch };
      }),
    };
  });
}

export function crmGroupsWithConditionAdded<Id extends string>(
  groups: readonly CrmSearchGroup<Id>[],
  groupIndex: number,
  definition: CrmSearchFieldDef<Id>,
): readonly CrmSearchGroup<Id>[] {
  return groups.map((group, index) =>
    index === groupIndex
      ? { conditions: [...group.conditions, crmBlankCondition(definition)] }
      : group,
  );
}

/**
 * Remove one condition, and the group with it once it was the last one.
 *
 * The card never holds zero groups: removing the final condition of the final
 * group leaves one blank group behind, so the controls that add the next one
 * are still on screen.
 */
export function crmGroupsWithConditionRemoved<Id extends string>(
  groups: readonly CrmSearchGroup<Id>[],
  groupIndex: number,
  conditionIndex: number,
  definition: CrmSearchFieldDef<Id>,
): readonly CrmSearchGroup<Id>[] {
  const next = groups
    .map((group, index) =>
      index === groupIndex
        ? {
            conditions: group.conditions.filter(
              (_condition, position) => position !== conditionIndex,
            ),
          }
        : group,
    )
    .filter((group) => group.conditions.length > 0);
  return next.length > 0 ? next : [crmBlankGroup(definition)];
}

/** A new OR section, opened on a blank condition. */
export function crmGroupsWithGroupAdded<Id extends string>(
  groups: readonly CrmSearchGroup<Id>[],
  definition: CrmSearchFieldDef<Id>,
): readonly CrmSearchGroup<Id>[] {
  return [...groups, crmBlankGroup(definition)];
}

export function crmGroupsWithGroupRemoved<Id extends string>(
  groups: readonly CrmSearchGroup<Id>[],
  groupIndex: number,
  definition: CrmSearchFieldDef<Id>,
): readonly CrmSearchGroup<Id>[] {
  const next = groups.filter((_group, index) => index !== groupIndex);
  return next.length > 0 ? next : [crmBlankGroup(definition)];
}
