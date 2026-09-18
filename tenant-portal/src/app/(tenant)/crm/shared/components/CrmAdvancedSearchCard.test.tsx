// @vitest-environment jsdom

import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import {
  crmCompileFilterTree,
  type CrmSearchFieldDef,
  type CrmSearchGroup,
} from "../search/filter-tree";
import { CrmAdvancedSearchCard } from "./CrmAdvancedSearchCard";

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en", t: en }),
}));

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

const filledGroups: readonly CrmSearchGroup<FieldId>[] = [{
  conditions: [
    { field: "description", operator: "like", value: "Acme", valueTo: "" },
    { field: "createdAt", operator: "between", value: "2026-01-01", valueTo: "2026-12-31" },
    { field: "rating", operator: "gte", value: "2", valueTo: "" },
    { field: "status", operator: "in", value: "OPEN,ON_HOLD", valueTo: "" },
  ],
}];

afterEach(cleanup);

function Card({
  groups,
  onGroupsChange = vi.fn(),
  requireFieldSelection = false,
  onSubmit = vi.fn(),
  omitTextSearch = false,
}: {
  groups: readonly CrmSearchGroup<FieldId>[];
  onGroupsChange?: (next: readonly CrmSearchGroup<FieldId>[]) => void;
  requireFieldSelection?: boolean;
  onSubmit?: () => void;
  omitTextSearch?: boolean;
}) {
  return (
    <CrmAdvancedSearchCard
      fields={fields}
      fieldLabels={fieldLabels}
      enumLabel={(_field, value) => value}
      catalogueOptions={() => []}
      {...(omitTextSearch ? {} : { text: "", onTextChange: vi.fn() })}
      groups={groups}
      onGroupsChange={onGroupsChange}
      onSubmit={onSubmit}
      onReset={vi.fn()}
      requireFieldSelection={requireFieldSelection}
    />
  );
}

it("starts with condition rows when the caller omits free-text search", () => {
  render(<Card groups={filledGroups} omitTextSearch />);

  expect(screen.queryByRole("textbox", { name: en.crmAdvancedSearch.textLabel })).toBeNull();
  expect(screen.queryByText(en.crmAdvancedSearch.textHint)).toBeNull();
  expect(screen.getAllByRole("combobox", { name: en.crmAdvancedSearch.operator })).not.toHaveLength(0);
});

it("renders typed operators, explicit AND connectors, and explicit submit", () => {
  const onSubmit = vi.fn();
  render(<Card groups={filledGroups} onSubmit={onSubmit} />);

  expect(
    screen.getAllByRole("combobox", { name: en.crmAdvancedSearch.operator })
      .map((control) => control.textContent),
  ).toEqual([
    en.crmAdvancedSearch.operators.like,
    en.crmAdvancedSearch.operators.between,
    en.crmAdvancedSearch.operators.gte,
    en.crmAdvancedSearch.operators.in,
  ]);
  expect(
    screen.getAllByRole("combobox", { name: en.crmAdvancedSearch.connector })
      .map((control) => control.textContent),
  ).toEqual([en.crmAdvancedSearch.and, en.crmAdvancedSearch.and, en.crmAdvancedSearch.and]);

  fireEvent.click(screen.getByRole("button", { name: en.crmAdvancedSearch.submit }));
  expect(onSubmit).toHaveBeenCalledOnce();
});

it("starts with Key only, then reveals Lead Type value without an operator", () => {
  const initial: readonly CrmSearchGroup<FieldId>[] = [{
    conditions: [{
      field: "description",
      fieldSelected: false,
      operator: "eq",
      value: "",
      valueTo: "",
    }],
  }];

  function ControlledCard() {
    const [groups, setGroups] = useState(initial);
    return <Card groups={groups} onGroupsChange={setGroups} requireFieldSelection />;
  }

  render(<ControlledCard />);

  const field = screen.getByRole("combobox", { name: en.crmAdvancedSearch.field });
  expect(field).toHaveTextContent(en.crmAdvancedSearch.selectField);
  expect(screen.queryByRole("combobox", { name: en.crmAdvancedSearch.operator })).not.toBeInTheDocument();
  expect(screen.queryByRole("combobox", { name: `${en.crmAdvancedSearch.value}: Lead Type` })).not.toBeInTheDocument();

  fireEvent.click(field);
  fireEvent.click(screen.getByRole("option", { name: "Lead Type" }));

  expect(screen.queryByRole("combobox", { name: en.crmAdvancedSearch.operator })).not.toBeInTheDocument();
  expect(
    screen.getByRole("combobox", { name: `${en.crmAdvancedSearch.value}: Lead Type` }),
  ).toBeInTheDocument();
});

it("lets a user change the connector from AND to OR and back", () => {
  const initial: readonly CrmSearchGroup<FieldId>[] = [{
    conditions: [
      { field: "status", operator: "eq", value: "OPEN", valueTo: "" },
      { field: "leadType", operator: "eq", value: "CORPORATE", valueTo: "" },
    ],
  }];

  const onGroupsChange = vi.fn();
  function ControlledCard() {
    const [groups, setGroups] = useState(initial);
    return (
      <Card
        groups={groups}
        onGroupsChange={(next) => {
          onGroupsChange(next);
          setGroups(next);
        }}
      />
    );
  }

  render(<ControlledCard />);

  let connector = screen.getByRole("combobox", { name: en.crmAdvancedSearch.connector });
  expect(connector).toHaveTextContent(en.crmAdvancedSearch.and);
  fireEvent.click(connector);
  fireEvent.click(screen.getByRole("option", { name: en.crmAdvancedSearch.or }));

  connector = screen.getByRole("combobox", { name: en.crmAdvancedSearch.connector });
  expect(connector).toHaveTextContent(en.crmAdvancedSearch.or);
  const orGroups = onGroupsChange.mock.calls.at(-1)?.[0] as readonly CrmSearchGroup<FieldId>[];
  expect(
    crmCompileFilterTree(orGroups, (id) => fields.find((field) => field.id === id)!),
  ).toEqual({
    op: "OR",
    children: [
      { field: "status", operator: "eq", value: "OPEN" },
      { field: "leadProfileType", operator: "eq", value: "CORPORATE" },
    ],
  });
  fireEvent.click(connector);
  fireEvent.click(screen.getByRole("option", { name: en.crmAdvancedSearch.and }));

  expect(
    screen.getByRole("combobox", { name: en.crmAdvancedSearch.connector }),
  ).toHaveTextContent(en.crmAdvancedSearch.and);
  const andGroups = onGroupsChange.mock.calls.at(-1)?.[0] as readonly CrmSearchGroup<FieldId>[];
  expect(
    crmCompileFilterTree(andGroups, (id) => fields.find((field) => field.id === id)!),
  ).toEqual({
    op: "AND",
    children: [
      { field: "status", operator: "eq", value: "OPEN" },
      { field: "leadProfileType", operator: "eq", value: "CORPORATE" },
    ],
  });
});
