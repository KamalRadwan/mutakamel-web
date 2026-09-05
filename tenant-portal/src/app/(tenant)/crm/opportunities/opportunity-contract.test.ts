import { describe, expect, it } from "vitest";
import {
  opportunityPath,
  opportunityPipelinePath,
  opportunityStageHistoryPath,
  parseOpportunityDetailResponse,
  parseOpportunityStageHistory,
} from "./opportunity-contract";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { WRITE_APPLIED_UNREADABLE } from "../shared/crm-write";
import { MONEY_MAX_AMOUNT, MONEY_OUT_OF_RANGE } from "../shared/money";
import {
  OPPORTUNITY_AMOUNT_NOT_CLEARABLE,
  OPPORTUNITY_CURRENCY_INVALID,
  OPPORTUNITY_IMPORTANCE_REQUIRED,
  OPPORTUNITY_NOTHING_TO_SEND,
  OPPORTUNITY_TITLE_REQUIRED,
  OPPORTUNITY_VALUE_OUT_OF_RANGE,
  buildCreateOpportunityRequest,
  buildTransferPipelineRequest,
  buildUpdateOpportunityRequest,
  isValidOpportunityAmount,
  toOpportunityForm,
  type OpportunityForm,
} from "./opportunity-write-contract";

const ID = "01900100-0000-7000-8000-000000000001";
const BRANCH = "01900100-0000-7000-8000-000000000099";
const PROFILE = "01900100-0000-7000-8000-000000000040";
const PIPELINE = "01900100-0000-7000-8000-000000000050";
const STAGE = "01900100-0000-7000-8000-000000000051";
const OTHER_STAGE = "01900100-0000-7000-8000-000000000052";
const OWNER = "01900100-0000-7000-8000-000000000020";
const HISTORY_ID = "01900100-0000-7000-8000-000000000070";

const opportunity = {
  id: ID,
  branchId: BRANCH,
  customerProfileId: PROFILE,
  customerPartyId: null,
  contactPartyId: null,
  leadId: null,
  pipelineId: PIPELINE,
  stageId: STAGE,
  stageFlag: "QUALIFICATION",
  status: "IN_PROGRESS",
  title: "Initial ERP rollout",
  importance: 3,
  amount: "150000.00",
  currencyCode: "USD",
  description: null,
  expectedCloseDate: "2026-07-31",
  probabilityPercent: 40,
  ownerUserId: OWNER,
  wonAt: null,
  lostAt: null,
  lostReason: null,
  createdAt: "2026-06-24T15:00:00.000Z",
  updatedAt: "2026-06-24T15:15:00.000Z",
};

describe("opportunity detail contract", () => {
  it("keeps the amount as an exact decimal string", () => {
    const parsed = parseOpportunityDetailResponse(opportunity);
    expect(parsed.amount).toBe("150000.00");
    expect(typeof parsed.amount).toBe("string");
  });

  it("rejects an amount that is not a well-formed decimal", () => {
    expect(() =>
      parseOpportunityDetailResponse({ ...opportunity, amount: "1.5e6" }),
    ).toThrow();
    expect(() =>
      parseOpportunityDetailResponse({ ...opportunity, amount: 150000 }),
    ).toThrow();
    expect(parseOpportunityDetailResponse({ ...opportunity, amount: null }).amount).toBeNull();
  });

  it("bounds importance and probability to the DTO's own ranges", () => {
    expect(() =>
      parseOpportunityDetailResponse({ ...opportunity, importance: 4 }),
    ).toThrow();
    expect(() =>
      parseOpportunityDetailResponse({ ...opportunity, probabilityPercent: 101 }),
    ).toThrow();
  });

  it("tolerates a null stage flag, which the entity allows", () => {
    expect(
      parseOpportunityDetailResponse({ ...opportunity, stageFlag: null }).stageFlag,
    ).toBeNull();
  });

  it("builds each id-scoped path and refuses a malformed id", () => {
    expect(opportunityPath(ID)).toBe(`/api/tenant/crm/v1/opportunities/${ID}`);
    expect(opportunityStageHistoryPath(ID)).toContain("/stage-history");
    expect(opportunityPipelinePath(ID)).toContain("/pipeline");
    expect(() => opportunityPath("capabilities")).toThrow();
  });
});

describe("opportunity stage history", () => {
  const row = {
    id: HISTORY_ID,
    opportunityId: ID,
    fromStageId: STAGE,
    fromStatus: "IN_PROGRESS",
    toStageId: OTHER_STAGE,
    toStatus: "WON",
    changedByUserId: OWNER,
    reason: "Signed",
    changedAt: "2026-06-24T15:15:00.000Z",
    fromStageSnapshot: {
      pipelineNameAr: "المسار الافتراضي",
      pipelineNameEn: "Default pipeline",
      stageNameAr: "تأهيل",
      stageNameEn: "Qualification",
      flag: "QUALIFICATION",
    },
    toStageSnapshot: {
      pipelineNameAr: "المسار الافتراضي",
      pipelineNameEn: "Default pipeline",
      stageNameAr: "تم الفوز",
      stageNameEn: "Won",
      flag: "WON",
    },
  };

  it("reads a plain array, not a paginated page", () => {
    const [entry] = parseOpportunityStageHistory([row]);
    expect(entry.toStatus).toBe("WON");
    expect(entry.toStageSnapshot?.stageNameEn).toBe("Won");
  });

  it("preserves the server's order rather than re-sorting", () => {
    const older = { ...row, id: ID, changedAt: "2026-06-01T00:00:00.000Z" };
    const parsed = parseOpportunityStageHistory([row, older]);
    expect(parsed.map(({ id }) => id)).toEqual([HISTORY_ID, ID]);
  });

  it("falls back to createdAt when changedAt is absent", () => {
    const [entry] = parseOpportunityStageHistory([
      { ...row, changedAt: null, createdAt: "2026-06-01T00:00:00.000Z" },
    ]);
    expect(entry.changedAt).toBe("2026-06-01T00:00:00.000Z");
  });

  it("tolerates a snapshot the server could not resolve", () => {
    const [entry] = parseOpportunityStageHistory([
      { ...row, fromStageSnapshot: null },
    ]);
    expect(entry.fromStageSnapshot).toBeNull();
  });

  it("rejects a row with no id", () => {
    expect(() => parseOpportunityStageHistory([{ ...row, id: null }])).toThrow();
  });
});

const form: OpportunityForm = {
  customFields: {},
  customerProfileId: PROFILE,
  pipelineId: PIPELINE,
  stageId: STAGE,
  title: "Initial ERP rollout",
  importance: "3",
  amount: "150000.00",
  currencyCode: "usd",
  description: "",
  expectedCloseDate: "2026-07-31",
  probabilityPercent: "40",
};

describe("opportunity write payloads", () => {
  it("builds the create body with the branch from the caller", () => {
    expect(buildCreateOpportunityRequest(form, BRANCH)).toEqual({
      branchId: BRANCH,
      customerProfileId: PROFILE,
      pipelineId: PIPELINE,
      stageId: STAGE,
      title: "Initial ERP rollout",
      importance: 3,
      amount: 150000,
      currencyCode: "USD",
      expectedCloseDate: "2026-07-31",
      probabilityPercent: 40,
    });
  });

  it("omits every optional field left blank", () => {
    const bare = buildCreateOpportunityRequest(
      {
        ...form,
        importance: "",
        amount: "",
        currencyCode: "",
        expectedCloseDate: "",
        probabilityPercent: "",
      },
      BRANCH,
    );
    expect(Object.keys(bare).sort()).toEqual([
      "branchId",
      "customerProfileId",
      "pipelineId",
      "stageId",
      "title",
    ]);
  });

  it("refuses an out-of-range importance or probability", () => {
    expect(() =>
      buildCreateOpportunityRequest({ ...form, importance: "4" }, BRANCH),
    ).toThrow();
    expect(() =>
      buildCreateOpportunityRequest({ ...form, probabilityPercent: "101" }, BRANCH),
    ).toThrow();
  });

  it("guards the amount so the one permitted Number() stays exact", () => {
    expect(isValidOpportunityAmount("150000.00")).toBe(true);
    expect(isValidOpportunityAmount("1.234")).toBe(false);
    expect(isValidOpportunityAmount("1234567890123456")).toBe(false);
    // D3: the old guard allowed 15 integer digits because the INTEGER part
    // stays below 2^53 — but `Number("999999999999999.99")` is
    // 1_000_000_000_000_000, a whole unit invented on the client, on a column
    // that stores the value exactly.
    expect(isValidOpportunityAmount("999999999999999.99")).toBe(false);
    expect(() =>
      buildCreateOpportunityRequest(
        { ...form, amount: "999999999999999.99" },
        BRANCH,
      ),
    ).toThrow(MONEY_OUT_OF_RANGE);
    expect(
      buildCreateOpportunityRequest({ ...form, amount: MONEY_MAX_AMOUNT }, BRANCH)
        .amount,
    ).toBe(9999999999999.99);
  });

  it("round-trips a decimal string through the form without formatting it", () => {
    const round = toOpportunityForm(parseOpportunityDetailResponse(opportunity));
    expect(round.amount).toBe("150000.00");
  });

  it("patches only the changed keys and never pipeline or stage", () => {
    const baseline = { ...form };
    expect(buildUpdateOpportunityRequest(baseline, baseline)).toEqual({});
    const changed = buildUpdateOpportunityRequest(
      { ...baseline, title: "Phase 1", amount: "200000" },
      baseline,
    );
    expect(changed).toEqual({ title: "Phase 1", amount: 200000 });
    expect(changed).not.toHaveProperty("pipelineId");
    expect(changed).not.toHaveProperty("stageId");
    expect(changed).not.toHaveProperty("customerProfileId");
  });

  // D8. This used to assert `{}` — an emptied box produced a request with
  // nothing in it, the drawer closed, and the old title stayed on the record.
  // A key the API has no representation for is now a refusal the user reads.
  it("refuses an emptied title instead of returning an empty patch", () => {
    const baseline = { ...form };
    expect(() =>
      buildUpdateOpportunityRequest({ ...baseline, title: "" }, baseline),
    ).toThrow(OPPORTUNITY_TITLE_REQUIRED);
  });

  it("clears the three columns the API can empty, with null rather than ''", () => {
    const baseline = { ...form };
    expect(
      buildUpdateOpportunityRequest(
        {
          ...baseline,
          expectedCloseDate: "",
          currencyCode: "",
          probabilityPercent: "",
        },
        baseline,
      ),
    ).toEqual({
      // "" here is `@IsDateString()`'s 400 — the reason Clear used to fail.
      expectedCloseDate: null,
      currencyCode: null,
      probabilityPercent: null,
    });
  });

  it("refuses the two columns the API cannot empty rather than no-opping", () => {
    const baseline = { ...form };
    // `OpportunitiesService.amountValue` is `String(dto.amount)`, so a null
    // would reach numeric(18,2) as the text "null".
    expect(() =>
      buildUpdateOpportunityRequest({ ...baseline, amount: "" }, baseline),
    ).toThrow(OPPORTUNITY_AMOUNT_NOT_CLEARABLE);
    // `importance` is smallint NOT NULL DEFAULT 0.
    expect(() =>
      buildUpdateOpportunityRequest({ ...baseline, importance: "" }, baseline),
    ).toThrow(OPPORTUNITY_IMPORTANCE_REQUIRED);
  });

  it("refuses a half-typed currency instead of dropping the key", () => {
    const baseline = { ...form };
    expect(() =>
      buildUpdateOpportunityRequest({ ...baseline, currencyCode: "US" }, baseline),
    ).toThrow(OPPORTUNITY_CURRENCY_INVALID);
  });

  // A thrown code with no sentence behind it renders as the raw constant, which
  // is how D8's refusals would land back in front of a user as gibberish. Both
  // dictionaries are checked, because ar.ts is the type source and en.ts can
  // still drift in content.
  it("gives every client-side refusal a sentence in both dictionaries", () => {
    const codes = [
      MONEY_OUT_OF_RANGE,
      OPPORTUNITY_VALUE_OUT_OF_RANGE,
      OPPORTUNITY_TITLE_REQUIRED,
      OPPORTUNITY_IMPORTANCE_REQUIRED,
      OPPORTUNITY_CURRENCY_INVALID,
      OPPORTUNITY_AMOUNT_NOT_CLEARABLE,
      OPPORTUNITY_NOTHING_TO_SEND,
    ];
    for (const dictionary of [ar, en]) {
      const refusals: Record<string, string> = dictionary.crmShared.refusals;
      for (const code of codes) {
        expect(refusals[code], code).toBeTruthy();
      }
    }
    // D2's outcome is not a refusal — it has its own panel and its own words.
    expect(ar.crmShared.refusals).not.toHaveProperty(WRITE_APPLIED_UNREADABLE);
    expect(ar.crmShared.appliedUnreadableTitle).toBeTruthy();
    expect(en.crmShared.appliedUnreadableTitle).toBeTruthy();
  });

  it("builds a transfer with an optional stage and reason", () => {
    expect(
      buildTransferPipelineRequest({ pipelineId: PIPELINE, stageId: "", reason: "  " }),
    ).toEqual({ pipelineId: PIPELINE });
    expect(
      buildTransferPipelineRequest({
        pipelineId: PIPELINE,
        stageId: STAGE,
        reason: " Reorganised ",
      }),
    ).toEqual({ pipelineId: PIPELINE, stageId: STAGE, reason: "Reorganised" });
  });
});
