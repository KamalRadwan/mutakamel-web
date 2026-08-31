import { describe, expect, it } from "vitest";
import type { DashboardGroupAlert, DashboardMetric } from "@/types/dashboard";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import {
  resolveAlertMessage,
  resolveFieldLabel,
  resolveMetricDescription,
  resolveMetricLabel,
} from "./dashboard-copy";

function metric(partial: Partial<DashboardMetric>): DashboardMetric {
  return {
    key: "storage-total",
    label: "Storage Servers",
    value: 3,
    kind: "integer",
    description: "Registered Storage Servers",
    tone: "cyan",
    ...partial,
  };
}

function alert(partial: Partial<DashboardGroupAlert>): DashboardGroupAlert {
  return {
    key: "storage-connection-test-failed",
    severity: "critical",
    count: 1,
    message: "Storage Servers have a failed connection test.",
    ...partial,
  };
}

describe("metric copy", () => {
  it("leaves an English reader with Core's own words", () => {
    expect(resolveMetricLabel(metric({}), "en", en)).toBe("Storage Servers");
    expect(resolveMetricDescription(metric({}), "en", en)).toBe(
      "Registered Storage Servers",
    );
  });

  it("resolves a label and its caption by the metric key", () => {
    expect(resolveMetricLabel(metric({}), "ar", ar)).toBe("خوادم التخزين");
    expect(resolveMetricDescription(metric({}), "ar", ar)).toBe("خوادم تخزين مسجَّلة");
  });

  it("translates a caption Core composed at runtime, keeping its number", () => {
    expect(
      resolveMetricDescription(
        metric({ key: "active-tenants", description: "30% of total" }),
        "ar",
        ar,
      ),
    ).toBe("30% من الإجمالي");

    expect(
      resolveMetricDescription(
        metric({ key: "db-capacity", description: "2% of total capacity" }),
        "ar",
        ar,
      ),
    ).toBe("2% من إجمالي السعة");

    expect(
      resolveMetricDescription(
        metric({ key: "open-alerts", description: "Across 227 affected records" }),
        "ar",
        ar,
      ),
    ).toBe("عبر 227 سجلًا متأثرًا");

    expect(
      resolveMetricDescription(
        metric({ key: "open-alerts", description: "No open alerts" }),
        "ar",
        ar,
      ),
    ).toBe("لا توجد تنبيهات مفتوحة");
  });

  it("falls back to Core's English for a metric the portal has no copy for", () => {
    expect(
      resolveMetricLabel(metric({ key: "future-metric", label: "Future Metric" }), "ar", ar),
    ).toBe("Future Metric");
  });
});

describe("alert copy", () => {
  it("resolves the sentence by alert key", () => {
    expect(resolveAlertMessage(alert({}), "ar", ar)).toBe(
      "خوادم تخزين عليها اختبار اتصال فاشل.",
    );
  });

  it("carries across a window length Core interpolated", () => {
    const translated = resolveAlertMessage(
      alert({
        key: "audit-recent-application-failures",
        message: "Control-plane code failed in the last 15 minutes.",
      }),
      "ar",
      ar,
    );
    expect(translated).toBe("كود مستوى التحكم أخفق خلال آخر 15 دقيقة.");
    expect(translated).not.toContain("{n}");
  });

  it("falls back to Core's English for an unmapped alert", () => {
    expect(
      resolveAlertMessage(alert({ key: "brand-new", message: "Something new." }), "ar", ar),
    ).toBe("Something new.");
  });
});

describe("exact-value field names", () => {
  it("humanises for English and translates for Arabic", () => {
    expect(resolveFieldLabel(["totalServers"], "en", en)).toBe("Total Servers");
    expect(resolveFieldLabel(["totalServers"], "ar", ar)).toBe("إجمالي الخوادم");
  });

  it("resolves every segment of a nested path", () => {
    expect(resolveFieldLabel(["byteUsage", "maximumBytes"], "ar", ar)).toBe(
      "استخدام البايت · الحد الأقصى بالبايت",
    );
  });

  it("falls through to the shared chart terms for a status segment", () => {
    // `breakdowns.byStatus.ACTIVE` — the leaf is a status value, not a field.
    expect(resolveFieldLabel(["byStatus", "ACTIVE"], "ar", ar)).toBe(
      "حسب الحالة · نشط",
    );
  });

  it("leaves an unknown segment humanised rather than blank", () => {
    expect(resolveFieldLabel(["somethingBrandNew"], "ar", ar)).toBe(
      "Something Brand New",
    );
  });
});
