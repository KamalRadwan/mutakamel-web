import { describe, expect, it } from "vitest";
import { MERGE_STRATEGIES, RISK_CLASSES } from "./configuration-contract";
import {
  MERGE_STRATEGY_INFO,
  POLICY_STARTER_TEMPLATES,
  RISK_CLASS_PALETTES,
  buildSchemaJsonFromVisual,
  describeTestDiagnostic,
  describeValueSchemaHumanReadable,
  formatPolicyValueHumanReadable,
  parseVisualArrayValue,
  parseVisualScalarValue,
  parseVisualSchema,
  validateMergeStrategyCompatibility,
} from "./configuration-catalogue-metadata";

describe("configuration-catalogue-metadata", () => {
  it("defines palettes for all RiskClass and MergeStrategy enum values", () => {
    for (const risk of RISK_CLASSES) {
      expect(RISK_CLASS_PALETTES[risk].risk).toBe(risk);
    }
    for (const strategy of MERGE_STRATEGIES) {
      expect(MERGE_STRATEGY_INFO[strategy].strategy).toBe(strategy);
    }
    expect(POLICY_STARTER_TEMPLATES.length).toBeGreaterThanOrEqual(5);
  });

  it("builds and parses visual value constraints accurately", () => {
    const schemaJson = buildSchemaJsonFromVisual({
      type: "number",
      minimum: "0",
      maximum: "50",
      minLength: "",
      maxLength: "",
      enumValues: "",
    });
    const parsed = parseVisualSchema(schemaJson);
    expect(parsed.type).toBe("number");
    expect(parsed.minimum).toBe("0");
    expect(parsed.maximum).toBe("50");
    expect(describeValueSchemaHumanReadable(JSON.parse(schemaJson), "en")).toContain(
      "Number (0 – 50)",
    );
  });

  it("validates merge strategy and value schema type compatibility", () => {
    expect(validateMergeStrategyCompatibility("MIN", "number").compatible).toBe(true);
    expect(validateMergeStrategyCompatibility("MIN", "boolean").compatible).toBe(false);
    expect(validateMergeStrategyCompatibility("DENY_WINS", "boolean").compatible).toBe(true);
    expect(validateMergeStrategyCompatibility("UNION", "array").compatible).toBe(true);
    expect(validateMergeStrategyCompatibility("OVERRIDE", "string").compatible).toBe(true);
  });

  it("translates test diagnostic codes into human-readable explanations", () => {
    expect(describeTestDiagnostic("COMPANY_BASELINE_REQUIRED", "en")).toContain(
      "Company Baseline Required",
    );
    expect(describeTestDiagnostic("BRANCH_WEAKENS_MIN", "ar")).toContain("MIN");
  });

  it("formats policy values into clean human-readable labels without raw JSON quotes", () => {
    expect(formatPolicyValueHumanReadable(true, "en")).toBe("Enabled (True)");
    expect(formatPolicyValueHumanReadable(false, "ar")).toBe("مغلق (False)");
    expect(formatPolicyValueHumanReadable(25, "en")).toBe("25");
    expect(formatPolicyValueHumanReadable("STRICT", "en")).toBe("STRICT");
    expect(formatPolicyValueHumanReadable(["EGP", "USD"], "en")).toBe("EGP · USD");
    expect(parseVisualArrayValue('["EGP","USD"]')).toEqual(["EGP", "USD"]);
    expect(parseVisualScalarValue('"STRICT"')).toBe("STRICT");
    expect(parseVisualScalarValue("15.5")).toBe("15.5");
  });
});
