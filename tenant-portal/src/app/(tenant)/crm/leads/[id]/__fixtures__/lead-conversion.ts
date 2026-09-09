import { parseLeadDetailResponse } from "../../lead-contract";

export const CONVERSION_IDS = {
  lead: "01900100-0000-7000-8000-000000000001",
  party: "01900100-0000-7000-8000-000000000002",
  branch: "01900100-0000-7000-8000-000000000003",
  owner: "01900100-0000-7000-8000-000000000004",
  pipeline: "01900100-0000-7000-8000-000000000005",
  membership: "01900100-0000-7000-8000-000000000006",
  customer: "01900100-0000-7000-8000-000000000007",
  opportunity: "01900100-0000-7000-8000-000000000008",
};

export const conversionLead = parseLeadDetailResponse({
  id: CONVERSION_IDS.lead, partyId: CONVERSION_IDS.party, branchId: CONVERSION_IDS.branch,
  ownerUserId: CONVERSION_IDS.owner, stageId: CONVERSION_IDS.membership,
  stageFlag: "QUALIFIED", status: "OPEN", leadProfileType: "CORPORATE",
  displayName: "Acme", companyName: "Acme Trading", contacts: [], phones: [],
  createdAt: "2026-09-07T00:00:00.000Z", updatedAt: "2026-09-07T00:00:00.000Z",
});

export function conversionReceipt(withOpportunity = false) {
  return {
    lead: { ...conversionLead, status: "CONVERTED", stageFlag: "CONVERTED",
      convertedCustomerProfileId: CONVERSION_IDS.customer,
      convertedOpportunityId: withOpportunity ? CONVERSION_IDS.opportunity : null,
      convertedAt: "2026-09-07T01:00:00.000Z" },
    customerProfileId: CONVERSION_IDS.customer,
    ...(withOpportunity ? { opportunityId: CONVERSION_IDS.opportunity } : {}),
  };
}
