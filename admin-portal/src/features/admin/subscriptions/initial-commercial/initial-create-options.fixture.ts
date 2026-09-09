// Test-only sealed-label projection; never fallback catalogue data.
import { initialId } from "./initial-commercial.fixture";
import { readInitialCreateOptions } from "./initial-create-options";
export function initialOptionsFixture() {
  return readInitialCreateOptions({ quoteRequired: true, applications: [{ applicationId: initialId(11), key: "crm", name: "Published CRM", description: null,
    rank: -2, commercialMode: "SUBSCRIPTION", technicalDefinitionRevision: "9", selectionBlockers: [], readinessReasons: [], catalogueReasons: [],
    tiers: [{ id: initialId(12), key: "starter", name: "CRM Starter", rank: 0 }],
    addons: [{ addonId: initialId(14), key: "crm.logistics", name: "Published Logistics", description: "Published addon terms", definitionVersionId: initialId(15),
      compatibleTierIds: [initialId(12)], catalogueReasons: [] }] }] });
}
