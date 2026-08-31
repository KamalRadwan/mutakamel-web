import { describe, expect, it } from "vitest";
import {
  GOVERNANCE_ACTIONS,
  GOVERNANCE_ACTION_PERMISSION,
  GOVERNED_VERSION_STATUSES,
  POLICIES_PATH,
  POLICY_APPROVE_PERMISSION,
  POLICY_READ_PERMISSION,
  WORKFLOWS_PATH,
  buildCreateDefinitionRequest,
  buildCreateVersionRequest,
  buildGovernanceActionRequest,
  decisionPath,
  governanceActionPath,
  governanceListPath,
  governanceVersionPath,
  governanceVersionsPath,
  parseDecisionReceipt,
  parseGovernanceListResponse,
} from "./governance-contract";

const definitionId = "01902001-3000-7000-8000-000000000001";
const versionId = "01902001-3000-7000-8000-000000000002";
const receiptId = "01902001-3000-7000-8000-000000000003";
const aggregateId = "01902001-3000-7000-8000-000000000004";

describe("Trade governance ladder", () => {
  it("serves policies and workflows from the same shape and the same grants", () => {
    expect(governanceListPath("policy", 1)).toBe(`${POLICIES_PATH}?page=1&limit=25`);
    expect(governanceListPath("workflow", 1)).toBe(`${WORKFLOWS_PATH}?page=1&limit=25`);
    expect(governanceVersionsPath("policy", definitionId)).toBe(
      `${POLICIES_PATH}/${definitionId}/versions`,
    );
    expect(governanceVersionPath("workflow", versionId)).toBe(
      `/api/tenant/trade/v1/workflow-versions/${versionId}`,
    );
    expect(governanceActionPath("policy", versionId, "rollback")).toBe(
      `/api/tenant/trade/v1/policy-versions/${versionId}/rollback`,
    );
    // There is no trade.workflow.* permission anywhere in trade-app.
    expect(POLICY_READ_PERMISSION).toBe("trade.policy.read");
  });

  it("keeps seven states against eight verbs", () => {
    expect(GOVERNED_VERSION_STATUSES).toHaveLength(7);
    expect(GOVERNANCE_ACTIONS).toHaveLength(8);
    // SCHEDULED and SUPERSEDED are reached without a user action, so they have
    // no verb and must still render.
    expect(GOVERNED_VERSION_STATUSES).toContain("SCHEDULED");
    expect(GOVERNED_VERSION_STATUSES).toContain("SUPERSEDED");
    expect(GOVERNANCE_ACTIONS).not.toContain("schedule");
  });

  it("puts reject behind the approve grant, not manage", () => {
    expect(GOVERNANCE_ACTION_PERMISSION.reject).toBe(POLICY_APPROVE_PERMISSION);
    expect(GOVERNANCE_ACTION_PERMISSION.approve).toBe(POLICY_APPROVE_PERMISSION);
    expect(GOVERNANCE_ACTION_PERMISSION.retire).toBe("trade.policy.publish");
    expect(GOVERNANCE_ACTION_PERMISSION.rollback).toBe("trade.policy.publish");
  });

  it("names the kind key per family, which is the only body difference", () => {
    expect(
      buildCreateDefinitionRequest("policy", {
        code: "credit.guard",
        kind: "CREDIT",
        scopeTarget: "COMPANY",
      }),
    ).toEqual({ code: "CREDIT.GUARD", policyKind: "CREDIT", scopeTarget: "COMPANY" });
    expect(
      buildCreateDefinitionRequest("workflow", {
        code: "QUOTE_FLOW",
        kind: "QUOTATION",
        scopeTarget: "TENANT",
      }),
    ).toEqual({ code: "QUOTE_FLOW", workflowKind: "QUOTATION", scopeTarget: "TENANT" });
    expect(() =>
      buildCreateDefinitionRequest("policy", {
        code: "OK",
        kind: "QUOTATION",
        scopeTarget: "COMPANY",
      }),
    ).toThrow("GOVERNANCE_FORM_KIND");
  });

  it("refuses a version with no test cases, which the DTO requires", () => {
    expect(
      buildCreateVersionRequest({
        content: '{"rules":[]}',
        testCases: '[{"name":"one"}]',
        effectiveFrom: "2026-09-01T00:00:00.000Z",
        effectiveTo: "",
      }),
    ).toMatchObject({ content: { rules: [] }, testCases: [{ name: "one" }] });
    expect(() =>
      buildCreateVersionRequest({
        content: "{}",
        testCases: "[]",
        effectiveFrom: "2026-09-01T00:00:00.000Z",
        effectiveTo: "",
      }),
    ).toThrow("GOVERNANCE_FORM_TEST_CASES");
    expect(() =>
      buildCreateVersionRequest({
        content: "[]",
        testCases: '[{"name":"one"}]',
        effectiveFrom: "2026-09-01T00:00:00.000Z",
        effectiveTo: "",
      }),
    ).toThrow("GOVERNANCE_FORM_CONTENT");
  });

  it("omits an empty reason rather than sending an empty string", () => {
    expect(buildGovernanceActionRequest("  ")).toEqual({});
    expect(buildGovernanceActionRequest("needed")).toEqual({ reason: "needed" });
    expect(() => buildGovernanceActionRequest("x".repeat(241))).toThrow(
      "GOVERNANCE_FORM_REASON",
    );
  });

  it("reads the versions the definition list embeds", () => {
    // A version has no GET of its own (Q91): this array is the only read.
    const page = parseGovernanceListResponse(
      {
        items: [
          {
            id: definitionId,
            code: "CREDIT",
            policyKind: "CREDIT",
            scopeTarget: "COMPANY",
            status: "ACTIVE",
            version: 3,
            versions: [
              {
                id: versionId,
                versionNumber: 2,
                version: 5,
                status: "APPROVAL_PENDING",
                contentHash: "b".repeat(64),
                effectiveFrom: "2026-09-01T00:00:00.000Z",
                effectiveTo: null,
                approvedAt: null,
              },
            ],
          },
        ],
        total: 1,
        page: 1,
        limit: 25,
      },
      "policy",
    );
    expect(page.items[0].kind).toBe("CREDIT");
    expect(page.items[0].versions[0].status).toBe("APPROVAL_PENDING");
    expect(page.items[0].versions[0].version).toBe(5);
  });

  it("reads a decision receipt reachable only by id", () => {
    expect(decisionPath(receiptId)).toBe(`/api/tenant/trade/v1/decisions/${receiptId}`);
    const receipt = parseDecisionReceipt({
      id: receiptId,
      decisionType: "SALES_PRICE",
      aggregateType: "TRADE_QUOTATION",
      aggregateId,
      scopeTarget: "BRANCH",
      result: { outcome: "ALLOW" },
      explanation: "matched",
      evaluatedAt: "2026-08-31T00:00:00.000Z",
      correlationId: "abc",
    });
    expect(receipt.outcome).toBe("ALLOW");
    expect(receipt.scopeTarget).toBe("BRANCH");
  });
});
