import { describe, expect, it } from "vitest";
import {
  DEFAULT_CUSTOMER_PROFILE_BASIC_SEARCH,
  EMPTY_CUSTOMER_PROFILE_BASIC_SEARCH,
  addCustomerProfileBasicFilter,
  buildCustomerProfileBasicSearchRequest,
  customerProfileBasicSearchNeedsPost,
  removeCustomerProfileBasicFilter,
} from "./customer-profile-basic-search-contract";
import {
  CUSTOMER_PROFILE_FILTERABLE_FIELDS,
  CUSTOMER_PROFILE_LIST_QUERY_KEYS,
  DEFAULT_CUSTOMER_PROFILE_SEARCH,
  EMPTY_CUSTOMER_PROFILE_SEARCH,
  buildCustomerProfileSearchRequest,
  buildCustomerProfilesListQuery,
  customerProfileSearchCleared,
  customerProfileSearchValuesOf,
  customerProfileSearchWithField,
  customerProfileSearchWithGroups,
  customerProfileSearchWithMode,
  customerProfileTextSearch,
} from "./customer-profile-search-contract";

const BRANCH_ID = "01900100-0000-7000-8000-000000000099";
const OWNER_ID = "01900100-0000-7000-8000-0000000000a2";
const SOURCE_ID = "01900100-0000-7000-8000-0000000000a1";
const WINDOW = {
  branchId: BRANCH_ID,
  page: 1,
  limit: 25,
  sortBy: "createdAt",
  sortDir: "DESC",
} as const;

describe("customer profile Basic search", () => {
  it("starts on My Customers and an explicit clear removes that scope", () => {
    expect(DEFAULT_CUSTOMER_PROFILE_BASIC_SEARCH).toEqual({
      myCustomers: true,
      filters: [],
    });
    expect(EMPTY_CUSTOMER_PROFILE_BASIC_SEARCH).toEqual({
      myCustomers: false,
      filters: [],
    });
    expect(DEFAULT_CUSTOMER_PROFILE_SEARCH.basic.myCustomers).toBe(true);
    expect(
      removeCustomerProfileBasicFilter(
        DEFAULT_CUSTOMER_PROFILE_BASIC_SEARCH,
        "my-customers",
      ).myCustomers,
    ).toBe(false);
  });

  it("builds one bounded GET query with semantic field and owner scope", () => {
    const basic = addCustomerProfileBasicFilter(
      addCustomerProfileBasicFilter(DEFAULT_CUSTOMER_PROFILE_BASIC_SEARCH, {
        field: "customer",
        value: "  Acme  ",
      }),
      { field: "status", value: "PROSPECT" },
    );
    const query = buildCustomerProfilesListQuery({
      ...WINDOW,
      actorId: OWNER_ID,
      search: { ...DEFAULT_CUSTOMER_PROFILE_SEARCH, basic },
    });

    expect(query.toString()).toBe(
      "branchId=" +
        BRANCH_ID +
        "&page=1&limit=25&sortBy=createdAt&sortDir=DESC" +
        "&status=PROSPECT&search=Acme&searchField=customer&ownerUserId=" +
        OWNER_ID,
    );
    for (const key of query.keys()) {
      expect(CUSTOMER_PROFILE_LIST_QUERY_KEYS).toContain(key);
    }
  });

  it("uses POST for multiple values of one structured key", () => {
    const basic = addCustomerProfileBasicFilter(
      addCustomerProfileBasicFilter(DEFAULT_CUSTOMER_PROFILE_BASIC_SEARCH, {
        field: "status",
        value: "PROSPECT",
      }),
      { field: "status", value: "INACTIVE" },
    );
    expect(customerProfileBasicSearchNeedsPost(basic)).toBe(true);
    expect(
      buildCustomerProfileBasicSearchRequest(basic, WINDOW, OWNER_ID),
    ).toEqual({
      branchId: BRANCH_ID,
      filterTree: {
        op: "AND",
        children: [
          {
            field: "status",
            operator: "in",
            value: ["PROSPECT", "INACTIVE"],
          },
          { field: "ownerUserId", operator: "eq", value: OWNER_ID },
        ],
      },
      sort: "createdAt:DESC",
      page: 1,
      limit: 25,
    });
  });

  it("keeps structured tokens while replacing the one semantic term", () => {
    const withSource = addCustomerProfileBasicFilter(
      EMPTY_CUSTOMER_PROFILE_BASIC_SEARCH,
      { field: "source", value: SOURCE_ID },
    );
    const withCustomer = addCustomerProfileBasicFilter(withSource, {
      field: "customer",
      value: "Acme",
    });
    const withPhone = addCustomerProfileBasicFilter(withCustomer, {
      field: "phone",
      value: "0100",
    });

    expect(withPhone.filters).toEqual([
      { field: "source", value: SOURCE_ID },
      { field: "phone", value: "0100" },
    ]);
  });

  it("wraps picker text without applying My Customers", () => {
    const state = customerProfileTextSearch("Acme");
    expect(state.basic.myCustomers).toBe(false);
    expect(state.basic.filters).toEqual([
      { field: "customer", value: "Acme" },
    ]);
  });

  it("lets the status bar replace status without dropping other tokens", () => {
    const sourceState = {
      ...DEFAULT_CUSTOMER_PROFILE_SEARCH,
      basic: addCustomerProfileBasicFilter(
        DEFAULT_CUSTOMER_PROFILE_BASIC_SEARCH,
        { field: "source", value: SOURCE_ID },
      ),
    };
    const next = customerProfileSearchWithField(
      sourceState,
      "status",
      "ACTIVE_CUSTOMER",
    );
    expect(customerProfileSearchValuesOf(next, "status")).toEqual([
      "ACTIVE_CUSTOMER",
    ]);
    expect(next.basic.filters).toContainEqual({
      field: "source",
      value: SOURCE_ID,
    });
  });
});

describe("customer profile Advanced search", () => {
  it("keeps Basic and Advanced drafts independent", () => {
    const basic = customerProfileSearchWithField(
      DEFAULT_CUSTOMER_PROFILE_SEARCH,
      "status",
      "PROSPECT",
    );
    const advanced = customerProfileSearchWithGroups(basic, [
      {
        conditions: [
          {
            field: "status",
            operator: "eq",
            value: "ACTIVE_CUSTOMER",
            valueTo: "",
          },
        ],
      },
    ]);
    const switched = customerProfileSearchWithMode(advanced, "advanced");
    expect(switched.basic.filters).toContainEqual({
      field: "status",
      value: "PROSPECT",
    });
    expect(buildCustomerProfileSearchRequest(switched, WINDOW)).toEqual({
      branchId: BRANCH_ID,
      filterTree: {
        field: "status",
        operator: "eq",
        value: "ACTIVE_CUSTOMER",
      },
      sort: "createdAt:DESC",
      page: 1,
      limit: 25,
    });
  });

  it("clears to one unselected Advanced condition", () => {
    const cleared = customerProfileSearchCleared({
      ...EMPTY_CUSTOMER_PROFILE_SEARCH,
      mode: "advanced",
      groups: [
        {
          conditions: [
            {
              field: "status",
              operator: "eq",
              value: "PROSPECT",
              valueTo: "",
            },
          ],
        },
      ],
    });
    expect(cleared.mode).toBe("advanced");
    expect(buildCustomerProfileSearchRequest(cleared, WINDOW)).toEqual({
      branchId: BRANCH_ID,
      sort: "createdAt:DESC",
      page: 1,
      limit: 25,
    });
  });

  it("compiles rating and card-colour filters with their typed operators", () => {
    const state = customerProfileSearchWithMode(
      customerProfileSearchWithGroups(EMPTY_CUSTOMER_PROFILE_SEARCH, [
        {
          conditions: [
            {
              field: "rating",
              operator: "gte",
              value: "2",
              valueTo: "",
            },
            {
              field: "cardColor",
              operator: "eq",
              value: "TEAL",
              valueTo: "",
            },
          ],
        },
      ]),
      "advanced",
    );

    expect(buildCustomerProfileSearchRequest(state, WINDOW).filterTree).toEqual({
      op: "AND",
      children: [
        { field: "rating", operator: "gte", value: 2 },
        { field: "cardColor", operator: "eq", value: "TEAL" },
      ],
    });
  });

  it("offers only repository-whitelisted Advanced fields", () => {
    expect(CUSTOMER_PROFILE_FILTERABLE_FIELDS).toEqual([
      "id",
      "branchId",
      "acquisitionSourceId",
      "profileType",
      "status",
      "rating",
      "cardColor",
      "ownerUserId",
      "sourceLeadId",
      "description",
      "createdAt",
      "updatedAt",
    ]);
  });
});
