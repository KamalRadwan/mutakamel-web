import { describe, expect, it } from "vitest";
import { opportunityCreateNeedsFullView } from "./opportunity-create-visibility";

describe("Fast-create error visibility", () => {
  it.each(["probabilityPercent", "expectedCloseDate", "contactPartyId", "leadId", "description", "customFields.optional_note"])("reveals a hidden field: %s", (path) => {
    expect(opportunityCreateNeedsFullView({ [path]: "Invalid" }, ["purchase_reference"])).toBe(true);
  });
  it("keeps ordinary visible errors and required tenant fields in Fast create", () => {
    expect(opportunityCreateNeedsFullView({ title: "Required", stageId: "Required", amount: "Invalid", currencyCode: "Required", ownerUserId: "Unavailable", "customFields.purchase_reference": "Required" }, ["purchase_reference"])).toBe(false);
  });
  it("does not change a valid draft's view", () => {
    expect(opportunityCreateNeedsFullView({}, [])).toBe(false);
  });
});
