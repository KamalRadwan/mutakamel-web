import { isUUIDv7 } from "@/lib/uuid";
import type {
  CrmFilterLeaf,
  CrmSearchRequestBody,
} from "../shared/search/filter-tree";

export type CustomerProfileTextSearchField = "customer" | "email" | "phone";
export type CustomerProfileSearchFieldId =
  | CustomerProfileTextSearchField
  | "status"
  | "profileType"
  | "source";

export interface CustomerProfileSearchFieldDef {
  id: CustomerProfileSearchFieldId;
  key: string;
  kind: "text" | "enum" | "source";
  searchField?: CustomerProfileTextSearchField;
  values?: readonly string[];
}

export const CUSTOMER_PROFILE_SEARCH_FIELDS: readonly CustomerProfileSearchFieldDef[] = [
  { id: "customer", key: "search", kind: "text", searchField: "customer" },
  { id: "email", key: "search", kind: "text", searchField: "email" },
  { id: "phone", key: "search", kind: "text", searchField: "phone" },
  {
    id: "status",
    key: "status",
    kind: "enum",
    values: ["PROSPECT", "ACTIVE_CUSTOMER", "INACTIVE", "BLACKLISTED"],
  },
  {
    id: "profileType",
    key: "profileType",
    kind: "enum",
    values: ["INDIVIDUAL", "CORPORATE"],
  },
  { id: "source", key: "acquisitionSourceId", kind: "source" },
];

export interface CustomerProfileBasicFilter {
  field: CustomerProfileSearchFieldId;
  value: string;
}

export interface CustomerProfileBasicSearch {
  myCustomers: boolean;
  filters: readonly CustomerProfileBasicFilter[];
}

export const EMPTY_CUSTOMER_PROFILE_BASIC_SEARCH: CustomerProfileBasicSearch = {
  myCustomers: false,
  filters: [],
};

export const DEFAULT_CUSTOMER_PROFILE_BASIC_SEARCH: CustomerProfileBasicSearch = {
  myCustomers: true,
  filters: [],
};

export interface CustomerProfileSearchWindow {
  branchId: string;
  page: number;
  limit: number;
  sortBy: "displayName" | "createdAt";
  sortDir: "ASC" | "DESC";
}

export interface CustomerProfileBasicSearchRequest extends CrmSearchRequestBody {
  searchField?: CustomerProfileTextSearchField;
}

export function customerProfileSearchField(
  id: CustomerProfileSearchFieldId,
): CustomerProfileSearchFieldDef {
  const field = CUSTOMER_PROFILE_SEARCH_FIELDS.find((entry) => entry.id === id);
  if (!field) throw new Error(`Unknown customer profile search field: ${id}`);
  return field;
}

export function customerProfileBasicFilterId(
  filter: CustomerProfileBasicFilter,
): string {
  return `${filter.field}:${filter.value}`;
}

function normalizeFilter(
  filter: CustomerProfileBasicFilter,
): CustomerProfileBasicFilter | null {
  const definition = customerProfileSearchField(filter.field);
  const value = filter.value.trim().slice(0, definition.kind === "text" ? 200 : undefined);
  if (!value) return null;
  if (
    (definition.values && !definition.values.includes(value)) ||
    ((definition.kind === "source") && !isUUIDv7(value))
  ) {
    throw new Error("Invalid customer profile search value.");
  }
  return { field: filter.field, value };
}

function isTextField(id: CustomerProfileSearchFieldId): boolean {
  return customerProfileSearchField(id).kind === "text";
}

export function addCustomerProfileBasicFilter(
  basic: CustomerProfileBasicSearch,
  filter: CustomerProfileBasicFilter,
): CustomerProfileBasicSearch {
  const next = normalizeFilter(filter);
  if (!next) return basic;
  if (
    basic.filters.some(
      (entry) => customerProfileBasicFilterId(entry) === customerProfileBasicFilterId(next),
    )
  ) {
    return basic;
  }
  const filters = isTextField(next.field)
    ? basic.filters.filter((entry) => !isTextField(entry.field))
    : basic.filters;
  return { ...basic, filters: [...filters, next] };
}

export function replaceCustomerProfileBasicField(
  basic: CustomerProfileBasicSearch,
  field: CustomerProfileSearchFieldId,
  value: string,
): CustomerProfileBasicSearch {
  return addCustomerProfileBasicFilter(
    { ...basic, filters: basic.filters.filter((entry) => entry.field !== field) },
    { field, value },
  );
}

export function removeCustomerProfileBasicFilter(
  basic: CustomerProfileBasicSearch,
  id: string,
): CustomerProfileBasicSearch {
  return id === "my-customers"
    ? { ...basic, myCustomers: false }
    : {
        ...basic,
        filters: basic.filters.filter(
          (entry) => customerProfileBasicFilterId(entry) !== id,
        ),
      };
}

function groupedValues(
  basic: CustomerProfileBasicSearch,
): Map<CustomerProfileSearchFieldId, string[]> {
  const grouped = new Map<CustomerProfileSearchFieldId, string[]>();
  for (const input of basic.filters) {
    const filter = normalizeFilter(input);
    if (!filter) continue;
    const values = grouped.get(filter.field) ?? [];
    if (!values.includes(filter.value)) grouped.set(filter.field, [...values, filter.value]);
  }
  const textCount = [...grouped.entries()]
    .filter(([field]) => isTextField(field))
    .reduce((count, [, values]) => count + values.length, 0);
  if (textCount > 1) {
    throw new Error("Only one semantic customer search term is supported.");
  }
  return grouped;
}

export function customerProfileBasicSearchNeedsPost(
  basic: CustomerProfileBasicSearch,
): boolean {
  return [...groupedValues(basic).entries()].some(
    ([field, alternatives]) => !isTextField(field) && alternatives.length > 1,
  );
}

function ownerId(
  basic: CustomerProfileBasicSearch,
  actorId?: string,
): string | undefined {
  if (!basic.myCustomers) return undefined;
  if (!isUUIDv7(actorId)) {
    throw new Error("My Customers requires the authenticated user.");
  }
  return actorId;
}

function textFilter(
  values: Map<CustomerProfileSearchFieldId, string[]>,
): { field: CustomerProfileTextSearchField; value: string } | undefined {
  for (const definition of CUSTOMER_PROFILE_SEARCH_FIELDS) {
    if (definition.kind !== "text" || !definition.searchField) continue;
    const value = values.get(definition.id)?.[0];
    if (value) return { field: definition.searchField, value };
  }
  return undefined;
}

export function buildCustomerProfilesListQuery({
  basic,
  actorId,
  ...window
}: CustomerProfileSearchWindow & {
  basic: CustomerProfileBasicSearch;
  actorId?: string;
}): URLSearchParams {
  if (customerProfileBasicSearchNeedsPost(basic)) {
    throw new Error("Selected customer filters require the search endpoint.");
  }
  const values = groupedValues(basic);
  const query = new URLSearchParams({
    branchId: window.branchId,
    page: String(window.page),
    limit: String(window.limit),
    sortBy: window.sortBy,
    sortDir: window.sortDir,
  });
  for (const [field, alternatives] of values) {
    const definition = customerProfileSearchField(field);
    if (definition.kind === "text") continue;
    query.set(definition.key, alternatives[0]!);
  }
  const text = textFilter(values);
  if (text) {
    query.set("search", text.value);
    query.set("searchField", text.field);
  }
  const owner = ownerId(basic, actorId);
  if (owner) query.set("ownerUserId", owner);
  return query;
}

export function buildCustomerProfileBasicSearchRequest(
  basic: CustomerProfileBasicSearch,
  window: CustomerProfileSearchWindow,
  actorId?: string,
): CustomerProfileBasicSearchRequest {
  const values = groupedValues(basic);
  const children: CrmFilterLeaf[] = [];
  for (const [field, alternatives] of values) {
    const definition = customerProfileSearchField(field);
    if (definition.kind === "text") continue;
    children.push({
      field: definition.key,
      operator: alternatives.length === 1 ? "eq" : "in",
      value: alternatives.length === 1 ? alternatives[0] : alternatives,
    });
  }
  const owner = ownerId(basic, actorId);
  if (owner) children.push({ field: "ownerUserId", operator: "eq", value: owner });
  const text = textFilter(values);
  return {
    branchId: window.branchId,
    ...(children.length
      ? {
          filterTree:
            children.length === 1
              ? children[0]
              : { op: "AND" as const, children },
        }
      : {}),
    ...(text ? { search: text.value, searchField: text.field } : {}),
    sort: `${window.sortBy}:${window.sortDir}`,
    page: window.page,
    limit: window.limit,
  };
}
