// @vitest-environment jsdom

import { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/design-system";
import { en } from "@/i18n/dictionaries/en";
import { formatTemplate } from "@/lib/format/template";
import {
  crmCompileFilterTree,
  type CrmSearchFieldDef,
  type CrmSearchGroup,
} from "../search/filter-tree";
import { CrmAdvancedSearchCard } from "./CrmAdvancedSearchCard";

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en", t: en }),
}));

const copy = en.crmAdvancedSearch;

type FieldId = "description" | "createdAt" | "rating" | "status" | "leadType";

const fields: readonly CrmSearchFieldDef<FieldId>[] = [
  { id: "description", field: "description", kind: "text", nullable: true },
  { id: "createdAt", field: "createdAt", kind: "date" },
  { id: "rating", field: "rating", kind: "number" },
  { id: "status", field: "status", kind: "enum", values: ["OPEN", "ON_HOLD"] },
  {
    id: "leadType",
    field: "leadProfileType",
    kind: "enum",
    operators: ["eq"],
    values: ["INDIVIDUAL", "CORPORATE"],
  },
];

const fieldLabels: Record<FieldId, string> = {
  description: "Description",
  createdAt: "Created at",
  rating: "Rating",
  status: "Status",
  leadType: "Lead Type",
};

const resolve = (id: FieldId) => fields.find((field) => field.id === id)!;

const filledGroups: readonly CrmSearchGroup<FieldId>[] = [{
  conditions: [
    { field: "description", operator: "like", value: "Acme", valueTo: "" },
    { field: "createdAt", operator: "between", value: "2026-01-01", valueTo: "2026-12-31" },
    { field: "rating", operator: "gte", value: "2", valueTo: "" },
    { field: "status", operator: "in", value: "OPEN,ON_HOLD", valueTo: "" },
  ],
}];

const twoRows: readonly CrmSearchGroup<FieldId>[] = [
  {
    conditions: [
      { field: "leadType", operator: "eq", value: "INDIVIDUAL", valueTo: "" },
      { field: "status", operator: "eq", value: "OPEN", valueTo: "" },
    ],
  },
  { conditions: [{ field: "leadType", operator: "eq", value: "CORPORATE", valueTo: "" }] },
];

afterEach(cleanup);

function Card({
  groups,
  onGroupsChange = vi.fn(),
  requireFieldSelection = false,
  onSubmit = vi.fn(),
  onReset = vi.fn(),
}: {
  groups: readonly CrmSearchGroup<FieldId>[];
  onGroupsChange?: (next: readonly CrmSearchGroup<FieldId>[]) => void;
  requireFieldSelection?: boolean;
  onSubmit?: () => void;
  onReset?: () => void;
}) {
  return (
    <TooltipProvider>
      <CrmAdvancedSearchCard
        fields={fields}
        fieldLabels={fieldLabels}
        enumLabel={(_field, value) => value}
        catalogueOptions={() => []}
        groups={groups}
        onGroupsChange={onGroupsChange}
        onSubmit={onSubmit}
        onReset={onReset}
        requireFieldSelection={requireFieldSelection}
      />
    </TooltipProvider>
  );
}

/** A card that owns its groups, reporting every change. */
function ControlledCard({
  initial,
  onGroupsChange = vi.fn(),
  requireFieldSelection = false,
}: {
  initial: readonly CrmSearchGroup<FieldId>[];
  onGroupsChange?: (next: readonly CrmSearchGroup<FieldId>[]) => void;
  requireFieldSelection?: boolean;
}) {
  const [groups, setGroups] = useState(initial);
  return (
    <Card
      groups={groups}
      requireFieldSelection={requireFieldSelection}
      onGroupsChange={(next) => {
        onGroupsChange(next);
        setGroups(next);
      }}
    />
  );
}

/** The `group:condition` key of the field picker that holds focus, if any. */
function focusedField() {
  return document.activeElement?.getAttribute("data-crm-search-field") ?? null;
}

function rows() {
  return screen.getAllByRole("group", { name: /^Group \d+$/ });
}

it("lays one OR group per row, with typed operators and a fixed AND between conditions", () => {
  render(<Card groups={filledGroups} />);

  expect(rows()).toHaveLength(1);
  expect(
    screen.getAllByRole("combobox", { name: copy.operator }).map((control) => control.textContent),
  ).toEqual([copy.operators.like, copy.operators.between, copy.operators.gte, copy.operators.in]);
  // Inside a row AND is a label, never a picker.
  expect(screen.queryByRole("combobox", { name: /group/ })).toBeNull();
  expect(within(rows()[0]!).getAllByText(copy.and)).toHaveLength(3);
  expect(screen.getByRole("group", { name: formatTemplate(copy.conditionLabel, { number: 4, group: 1 }) })).toBeInTheDocument();
  expect(within(rows()[0]!).getByText(copy.where)).toBeInTheDocument();
});

it("counts only conditions the request would carry", () => {
  render(
    <Card
      groups={[{
        conditions: [
          ...filledGroups[0]!.conditions,
          // Blank, and a one-sided range: the compiler drops both.
          { field: "description", operator: "like", value: "", valueTo: "" },
          { field: "createdAt", operator: "between", value: "2026-01-01", valueTo: "" },
        ],
      }]}
    />,
  );

  expect(screen.getByText(copy.conditionCount.replace("{count}", "4"))).toBeInTheDocument();
});

it("applies from the header, collapses with the count still shown, and reopens", () => {
  const onSubmit = vi.fn();
  render(<Card groups={filledGroups} onSubmit={onSubmit} />);

  fireEvent.click(screen.getByRole("button", { name: copy.submit }));

  expect(onSubmit).toHaveBeenCalledOnce();
  expect(screen.queryByRole("button", { name: copy.submit })).toBeNull();
  expect(screen.queryByRole("button", { name: copy.addGroupLabel })).toBeNull();
  expect(screen.getByText(copy.conditionCount.replace("{count}", "4"))).toBeInTheDocument();

  const toggle = screen.getByRole("button", { name: copy.title });
  expect(toggle).toHaveFocus();
  expect(toggle).toHaveAttribute("aria-expanded", "false");

  fireEvent.click(toggle);

  expect(screen.getByRole("button", { name: copy.title })).toHaveAttribute("aria-expanded", "true");
  expect(rows()).toHaveLength(1);
});

it("puts every value box and the Apply button in one form, so Enter submits", () => {
  const onSubmit = vi.fn();
  render(<Card groups={filledGroups} onSubmit={onSubmit} />);

  const value = screen.getByRole("textbox", { name: `${copy.value}: Description` });
  const apply = screen.getByRole("button", { name: copy.submit });
  expect(apply).toHaveAttribute("type", "submit");
  expect((value as HTMLInputElement).form).toBe((apply as HTMLButtonElement).form);

  fireEvent.submit((value as HTMLInputElement).form!);
  expect(onSubmit).toHaveBeenCalledOnce();
});

it("clears through the caller's reset", () => {
  const onReset = vi.fn();
  render(<Card groups={filledGroups} onReset={onReset} />);

  fireEvent.click(screen.getByRole("button", { name: copy.reset }));

  expect(onReset).toHaveBeenCalledOnce();
});

it("offers no trash on a lone row, where removing would only refill it", () => {
  render(<Card groups={filledGroups} />);

  expect(
    screen.queryByRole("button", { name: copy.removeGroup.replace("{number}", "1") }),
  ).toBeNull();
});

it("starts with Field only, then reveals Lead Type value without an operator", () => {
  render(
    <ControlledCard
      requireFieldSelection
      initial={[{
        conditions: [{
          field: "description",
          fieldSelected: false,
          operator: "eq",
          value: "",
          valueTo: "",
        }],
      }]}
    />,
  );

  const field = screen.getByRole("combobox", { name: copy.field });
  expect(field).toHaveTextContent(copy.selectField);
  expect(screen.queryByRole("combobox", { name: copy.operator })).not.toBeInTheDocument();

  fireEvent.click(field);
  fireEvent.click(screen.getByRole("option", { name: "Lead Type" }));

  expect(screen.queryByRole("combobox", { name: copy.operator })).not.toBeInTheDocument();
  expect(
    screen.getByRole("combobox", { name: `${copy.value}: Lead Type` }),
  ).toBeInTheDocument();
});

it("adds an OR row from the header and an AND condition from a row's plus", () => {
  const onGroupsChange = vi.fn();
  render(<ControlledCard initial={twoRows} onGroupsChange={onGroupsChange} />);

  fireEvent.click(screen.getByRole("button", { name: copy.addGroupLabel }));
  expect(rows()).toHaveLength(3);
  // Focus follows the new row, not the button that made it.
  expect(focusedField()).toBe("2:0");

  fireEvent.click(
    within(rows()[1]!).getByRole("button", { name: formatTemplate(copy.addCondition, { group: 2 }) }),
  );
  const last = onGroupsChange.mock.calls.at(-1)?.[0] as readonly CrmSearchGroup<FieldId>[];
  expect(last.map((group) => group.conditions.length)).toEqual([2, 2, 1]);
  expect(focusedField()).toBe("1:1");
});

it("removes one condition with its cross and a whole row with its trash", () => {
  const onGroupsChange = vi.fn();
  render(<ControlledCard initial={twoRows} onGroupsChange={onGroupsChange} />);

  fireEvent.click(
    within(rows()[0]!).getByRole("button", {
      name: formatTemplate(copy.removeCondition, { number: 2, group: 1, field: "Status" }),
    }),
  );
  // The removed condition was the row's last: focus lands on the one before it.
  expect(focusedField()).toBe("0:0");
  let last = onGroupsChange.mock.calls.at(-1)?.[0] as readonly CrmSearchGroup<FieldId>[];
  expect(last.map((group) => group.conditions.map((condition) => condition.value))).toEqual([
    ["INDIVIDUAL"],
    ["CORPORATE"],
  ]);

  fireEvent.click(screen.getByRole("button", { name: copy.removeGroup.replace("{number}", "2") }));
  last = onGroupsChange.mock.calls.at(-1)?.[0] as readonly CrmSearchGroup<FieldId>[];
  expect(last.map((group) => group.conditions.map((condition) => condition.value))).toEqual([
    ["INDIVIDUAL"],
  ]);
  expect(rows()).toHaveLength(1);
  expect(focusedField()).toBe("0:0");
});

it("merges a row into the one above when its connector turns to AND", () => {
  const onGroupsChange = vi.fn();
  render(<ControlledCard initial={twoRows} onGroupsChange={onGroupsChange} />);

  const connectorName = formatTemplate(copy.connector, { group: 2 });
  const connector = screen.getByRole("combobox", { name: connectorName });
  expect(connector).toHaveTextContent(copy.or);

  fireEvent.click(connector);
  fireEvent.click(screen.getByRole("option", { name: copy.and }));

  expect(rows()).toHaveLength(1);
  expect(screen.queryByRole("combobox", { name: connectorName })).toBeNull();
  // Focus moves to the first condition that came over from the merged row.
  expect(focusedField()).toBe("0:2");
  const merged = onGroupsChange.mock.calls.at(-1)?.[0] as readonly CrmSearchGroup<FieldId>[];
  expect(crmCompileFilterTree(merged, resolve)).toEqual({
    op: "AND",
    children: [
      { field: "leadProfileType", operator: "eq", value: "INDIVIDUAL" },
      { field: "status", operator: "eq", value: "OPEN" },
      { field: "leadProfileType", operator: "eq", value: "CORPORATE" },
    ],
  });
});
