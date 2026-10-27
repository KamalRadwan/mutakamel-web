import { describe, expect, it } from "vitest";
import {
  buildLeadDuplicateCheckRequest,
  bulkLeadFields,
  leadIdBatches,
  parseLeadDocumentCountsResponse,
  parseLeadKpisResponse,
} from "./lead-bulk-contract";
import { leadEditablePrimaryPhone, leadPrimaryPhonePatch } from "./lead-phone-patch";

const PARTY_A = "0192f3a0-0000-7000-8000-000000000001";
const PARTY_B = "0192f3a0-0000-7000-8000-000000000002";
const STAGE = "0192f3a0-0000-7000-8000-000000000010";

describe("lead bulk contract", () => {
  it("splits a selection into unique batches of at most 100 ids", () => {
    const leads = Array.from({ length: 205 }, (_, index) => ({ id: `id-${index % 201}` }));
    const batches = leadIdBatches(leads);
    expect(batches.map((batch) => batch.length)).toEqual([100, 100, 1]);
  });

  it("sends only the four bulk-update fields", () => {
    const patch = { rating: 3, cardColor: null, displayName: "x" } as unknown as Parameters<typeof bulkLeadFields>[0];
    expect(bulkLeadFields(patch)).toEqual({ rating: 3, cardColor: null });
  });

  it("parses headline KPI figures without a stage breakdown and refuses a malformed count", () => {
    const body = {
      totalLeads: 3, newStageLeads: 1, newTodayLeads: 1, hotLeads: 2, overdueActivityLeads: 0, qualifiedLeads: 1,
    };
    expect(parseLeadKpisResponse(body)).toEqual(body);
    expect(() => parseLeadKpisResponse({ ...body, hotLeads: -1 })).toThrow();
  });

  it("asks for a duplicate check only once a probe is worth asking about", () => {
    expect(buildLeadDuplicateCheckRequest({ branchId: STAGE, name: "ab", phones: ["12"] })).toBeNull();
    expect(buildLeadDuplicateCheckRequest({ branchId: STAGE, name: " Acme ", email: "bad", phones: [" 01001234567 "] }))
      .toEqual({ branchId: STAGE, name: "Acme", phones: ["01001234567"] });
  });

  it("parses one counter row per requested Party, keeping null as unavailable", () => {
    const counts = parseLeadDocumentCountsResponse(
      {
        countsByPartyId: {
          [PARTY_A]: { opportunities: 2, quotations: 3, salesOrders: 1, invoices: 0 },
          [PARTY_B]: { opportunities: 0, quotations: null, salesOrders: null, invoices: null },
        },
      },
      [PARTY_A, PARTY_B],
    );
    expect(counts.get(PARTY_B)).toEqual({ opportunities: 0, quotations: null, salesOrders: null, invoices: null });
    expect(() => parseLeadDocumentCountsResponse({ countsByPartyId: {} }, [PARTY_A])).toThrow();
  });
});

describe("lead primary phone patch", () => {
  const individual = {
    leadProfileType: "INDIVIDUAL" as const,
    phone: "+201000000001",
    phones: ["+201000000001", "+201000000002"],
    primaryContact: null,
  };
  const corporate = {
    leadProfileType: "CORPORATE" as const,
    phone: "+20222222222",
    phones: ["+20222222222"],
    primaryContact: { phones: ["+201555555555"] } as never,
  };

  it("edits an individual's own first number and a company's primary contact number", () => {
    expect(leadEditablePrimaryPhone(individual)).toBe("+201000000001");
    expect(leadEditablePrimaryPhone(corporate)).toBe("+201555555555");
  });

  it("sends primaryPhone alone for a changed number, and nothing for an unchanged one", () => {
    expect(leadPrimaryPhonePatch(individual, " +201000000009 ")).toEqual({ primaryPhone: "+201000000009" });
    expect(leadPrimaryPhonePatch(corporate, "+201666666666")).toEqual({ primaryPhone: "+201666666666" });
    expect(leadPrimaryPhonePatch(individual, "+201000000001")).toEqual({});
  });

  it("clears an individual's first number by sending the rest, and never clears a contact's from a card", () => {
    expect(leadPrimaryPhonePatch(individual, "")).toEqual({ primaryMobile: "+201000000002", phones: ["+201000000002"] });
    expect(leadPrimaryPhonePatch(corporate, "")).toEqual({});
  });
});
