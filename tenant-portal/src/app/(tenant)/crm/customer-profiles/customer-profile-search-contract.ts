// Customer search keeps Odoo-style Basic tokens and an explicit-submit Advanced tree.

import {
  crmCompileFilterTree,
  crmUnselectedCondition,
  type CrmSearchFieldDef,
  type CrmSearchGroup,
  type CrmSearchRequestBody,
} from "../shared/search/filter-tree";
import {
  DEFAULT_CUSTOMER_PROFILE_BASIC_SEARCH,
  EMPTY_CUSTOMER_PROFILE_BASIC_SEARCH,
  addCustomerProfileBasicFilter,
  buildCustomerProfilesListQuery as buildBasicListQuery,
  replaceCustomerProfileBasicField,
  type CustomerProfileBasicSearch,
  type CustomerProfileSearchFieldId,
  type CustomerProfileSearchWindow,
} from "./customer-profile-basic-search-contract";

export {
  CUSTOMER_PROFILE_SEARCH_FIELDS,
  customerProfileSearchField,
  type CustomerProfileSearchFieldDef,
  type CustomerProfileSearchFieldId,
} from "./customer-profile-basic-search-contract";

export type CustomerProfileSortBy = "displayName" | "createdAt";

export const CUSTOMER_PROFILE_FILTERABLE_FIELDS: readonly string[] = [
  "id",
  "branchId",
  "acquisitionSourceId",
  "profileType",
  "status",
  "ownerUserId",
  "sourceLeadId",
  "description",
  "createdAt",
  "updatedAt",
];

export type CustomerProfileAdvancedFieldId =
  | "id"
  | "source"
  | "profileType"
  | "status"
  | "owner"
  | "sourceLead"
  | "description"
  | "createdAt"
  | "updatedAt";

export const CUSTOMER_PROFILE_ADVANCED_FIELDS: readonly CrmSearchFieldDef<CustomerProfileAdvancedFieldId>[] = [
  { id: "id", field: "id", kind: "uuid", operators: ["eq"] },
  {
    id: "source",
    field: "acquisitionSourceId",
    kind: "catalogue",
    nullable: true,
    operators: ["eq", "neq", "in", "nin"],
  },
  {
    id: "profileType",
    field: "profileType",
    kind: "enum",
    operators: ["eq", "neq", "in", "nin"],
    values: ["INDIVIDUAL", "CORPORATE"],
  },
  {
    id: "status",
    field: "status",
    kind: "enum",
    operators: ["eq", "neq", "in", "nin"],
    values: ["PROSPECT", "ACTIVE_CUSTOMER", "INACTIVE", "BLACKLISTED"],
  },
  {
    id: "owner",
    field: "ownerUserId",
    kind: "uuid",
    nullable: true,
    operators: ["eq"],
  },
  {
    id: "sourceLead",
    field: "sourceLeadId",
    kind: "uuid",
    nullable: true,
    operators: ["eq"],
  },
  {
    id: "description",
    field: "description",
    kind: "text",
    nullable: true,
    maxLength: 2000,
    operators: ["ilike", "like", "startsWith", "endsWith", "eq", "neq"],
  },
  {
    id: "createdAt",
    field: "createdAt",
    kind: "date",
    operators: ["gt", "gte", "lt", "lte", "between"],
  },
  {
    id: "updatedAt",
    field: "updatedAt",
    kind: "date",
    operators: ["gt", "gte", "lt", "lte", "between"],
  },
];

export type CustomerProfileSearchGroup =
  CrmSearchGroup<CustomerProfileAdvancedFieldId>;

export function customerProfileAdvancedField(
  id: CustomerProfileAdvancedFieldId,
): CrmSearchFieldDef<CustomerProfileAdvancedFieldId> {
  const field = CUSTOMER_PROFILE_ADVANCED_FIELDS.find(
    (candidate) => candidate.id === id,
  );
  if (!field) throw new Error(`Unknown customer profile filter field: ${id}`);
  return field;
}

export const DEFAULT_CUSTOMER_PROFILE_ADVANCED_FIELD =
  CUSTOMER_PROFILE_ADVANCED_FIELDS[0]!;

export type CustomerProfileSearchMode = "basic" | "advanced";

export interface CustomerProfileSearchState {
  mode: CustomerProfileSearchMode;
  basic: CustomerProfileBasicSearch;
  groups: readonly CustomerProfileSearchGroup[];
}

export const EMPTY_CUSTOMER_PROFILE_SEARCH: CustomerProfileSearchState = {
  mode: "basic",
  basic: EMPTY_CUSTOMER_PROFILE_BASIC_SEARCH,
  groups: [
    {
      conditions: [
        crmUnselectedCondition(DEFAULT_CUSTOMER_PROFILE_ADVANCED_FIELD),
      ],
    },
  ],
};

export const DEFAULT_CUSTOMER_PROFILE_SEARCH: CustomerProfileSearchState = {
  ...EMPTY_CUSTOMER_PROFILE_SEARCH,
  basic: DEFAULT_CUSTOMER_PROFILE_BASIC_SEARCH,
};

/** Used by customer pickers that must search every eligible customer. */
export function customerProfileTextSearch(
  value: string,
): CustomerProfileSearchState {
  return {
    ...EMPTY_CUSTOMER_PROFILE_SEARCH,
    basic: addCustomerProfileBasicFilter(EMPTY_CUSTOMER_PROFILE_BASIC_SEARCH, {
      field: "customer",
      value,
    }),
  };
}

export function customerProfileSearchWithMode(
  state: CustomerProfileSearchState,
  mode: CustomerProfileSearchMode,
): CustomerProfileSearchState {
  return mode === state.mode ? state : { ...state, mode };
}

export function customerProfileSearchValuesOf(
  state: CustomerProfileSearchState,
  field: CustomerProfileSearchFieldId,
): string[] {
  return state.basic.filters
    .filter((filter) => filter.field === field)
    .map((filter) => filter.value);
}

export function customerProfileSearchWithField(
  state: CustomerProfileSearchState,
  field: CustomerProfileSearchFieldId,
  value: string,
): CustomerProfileSearchState {
  return {
    ...state,
    mode: "basic",
    basic: replaceCustomerProfileBasicField(state.basic, field, value),
  };
}

export function customerProfileSearchWithGroups(
  state: CustomerProfileSearchState,
  groups: readonly CustomerProfileSearchGroup[],
): CustomerProfileSearchState {
  return { ...state, groups };
}

export function customerProfileSearchCleared(
  state: CustomerProfileSearchState,
): CustomerProfileSearchState {
  return { ...state, groups: EMPTY_CUSTOMER_PROFILE_SEARCH.groups };
}

export interface CustomerProfilesListQueryInput
  extends CustomerProfileSearchWindow {
  search: CustomerProfileSearchState;
  actorId?: string;
}

export function buildCustomerProfilesListQuery({
  search,
  actorId,
  ...window
}: CustomerProfilesListQueryInput): URLSearchParams {
  return buildBasicListQuery({ ...window, basic: search.basic, actorId });
}

export const CUSTOMER_PROFILE_LIST_QUERY_KEYS: readonly string[] = [
  "branchId",
  "page",
  "limit",
  "sortBy",
  "sortDir",
  "search",
  "searchField",
  "acquisitionSourceId",
  "profileType",
  "status",
  "ownerUserId",
];

export function buildCustomerProfileSearchRequest(
  state: CustomerProfileSearchState,
  { branchId, page, limit, sortBy, sortDir }: CustomerProfileSearchWindow,
): CrmSearchRequestBody {
  const filterTree = crmCompileFilterTree(
    state.groups,
    customerProfileAdvancedField,
  );
  return {
    branchId,
    ...(filterTree ? { filterTree } : {}),
    sort: `${sortBy}:${sortDir}`,
    page,
    limit,
  };
}
