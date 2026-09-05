import { describe, expect, it } from "vitest";
import {
  provisioningEventLabel,
  provisioningStepKindLabel,
  provisioningStepLabel,
  provisioningStepStatusLabel,
} from "./step-labels";

describe("provisioningStepLabel", () => {
  it("names the three fleet-wide steps in both languages", () => {
    expect(provisioningStepLabel("database.create", false)).toBe("Create tenant database");
    expect(provisioningStepLabel("database.create", true)).toBe("إنشاء قاعدة بيانات المستأجر");
    expect(provisioningStepLabel("tenant.activate", true)).toBe("تفعيل المستأجر");
    expect(provisioningStepLabel("core.owner-invitation", false)).toBe("Owner invitation email");
  });

  it("reads a component's own steps as component then detail", () => {
    expect(provisioningStepLabel("crm.schema", false)).toBe("CRM — schema");
    expect(provisioningStepLabel("crm.verify", true)).toBe("إدارة العملاء — التحقق");
    expect(provisioningStepLabel("core.foundation.schema", true)).toBe("أساس النواة — المخطط");
    expect(provisioningStepLabel("crm.seed.crm.lead-stages", false)).toBe("CRM — Lead stages");
    expect(provisioningStepLabel("core.foundation.seed.core.rbac", true)).toBe(
      "أساس النواة — الأدوار والصلاحيات",
    );
  });

  // A release ships components and seed packs this file has never seen. The
  // plan grammar still names the component; only the pack keeps its raw key.
  it("decomposes an unmapped seed pack of a known component", () => {
    expect(provisioningStepLabel("trade.seed.trade.tax-profiles", false)).toBe(
      "Trade — trade.tax-profiles",
    );
    expect(provisioningStepLabel("trade.seed.trade.tax-profiles", true)).toBe(
      "التجارة — trade.tax-profiles",
    );
  });

  it("returns the key itself rather than inventing a name for it", () => {
    expect(provisioningStepLabel("payments.schema", false)).toBe("payments.schema");
    expect(provisioningStepLabel("crm.something-new", true)).toBe("crm.something-new");
    expect(provisioningStepLabel("", false)).toBe("");
  });
});

describe("provisioningStepKindLabel", () => {
  it("translates every kind the plan emits", () => {
    const kinds = [
      "DATABASE",
      "SCHEMA",
      "SYSTEM_SEED",
      "REFERENCE_SEED",
      "IDENTITY",
      "CONFIG",
      "VERIFICATION",
      "NOTIFICATION",
      "ACTIVATION",
    ];
    for (const kind of kinds) {
      expect(provisioningStepKindLabel(kind, false)).not.toBe(kind);
      expect(provisioningStepKindLabel(kind, true)).not.toBe(kind);
    }
    expect(provisioningStepKindLabel("SYSTEM_SEED", false)).toBe("System data");
    expect(provisioningStepKindLabel("REFERENCE_SEED", true)).toBe("بيانات مرجعية");
  });

  it("keeps an unknown kind's wire value", () => {
    expect(provisioningStepKindLabel("QUANTUM_SEED", true)).toBe("QUANTUM_SEED");
  });
});

describe("provisioningEventLabel", () => {
  it("translates the four types the timeline actually emits", () => {
    expect(provisioningEventLabel("OPERATION_PLANNED", false)).toBe("Operation planned");
    expect(provisioningEventLabel("STEP_STARTED", true)).toBe("بدأت الخطوة");
    expect(provisioningEventLabel("STEP_SUCCEEDED", true)).toBe("نجحت الخطوة");
    expect(provisioningEventLabel("STEP_FAILED", false)).toBe("Step failed");
  });

  it("keeps an unknown event type's wire value", () => {
    expect(provisioningEventLabel("STEP_TELEPORTED", true)).toBe("STEP_TELEPORTED");
  });
});

describe("provisioningStepStatusLabel", () => {
  it("translates the step lifecycle", () => {
    expect(provisioningStepStatusLabel("SUCCEEDED", false)).toBe("Succeeded");
    expect(provisioningStepStatusLabel("SUCCEEDED", true)).toBe("نجحت");
    expect(provisioningStepStatusLabel("RUNNING", true)).toBe("قيد التنفيذ");
    expect(provisioningStepStatusLabel("CONFLICT", false)).toBe("Conflict");
  });

  it("keeps an unknown status's wire value", () => {
    expect(provisioningStepStatusLabel("HALF_DONE", true)).toBe("HALF_DONE");
  });
});
