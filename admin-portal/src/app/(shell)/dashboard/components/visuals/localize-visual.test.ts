import { describe, expect, it } from "vitest";
import type { DashboardVisual } from "@/types/dashboard";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { localizeVisual } from "./localize-visual";

const donut = {
  key: "tenants.byStatus",
  kind: "donut",
  title: "Tenants by Status",
  unit: "count",
  data: {
    categories: [
      { key: "ACTIVE", label: "Active", value: 3 },
      { key: "SUSPENDED", label: "Suspended", value: 1 },
      { key: "WEIRD_NEW_STATE", label: "Weird New State", value: 1 },
    ],
  },
} as DashboardVisual;

describe("localizeVisual", () => {
  it("leaves an English reader with Core's authored copy untouched", () => {
    expect(localizeVisual(donut, "en", en)).toBe(donut);
  });

  it("translates the title by key and the categories by term", () => {
    const localized = localizeVisual(donut, "ar", ar);

    expect(localized.title).toBe("المستأجرون حسب الحالة");
    expect(
      localized.kind === "donut" && localized.data.categories.map((c) => c.label),
    ).toEqual(["نشط", "معلق", "Weird New State"]);
  });

  it("keeps values and keys exactly as Core sent them", () => {
    const localized = localizeVisual(donut, "ar", ar);
    expect(
      localized.kind === "donut" && localized.data.categories.map((c) => [c.key, c.value]),
    ).toEqual([
      ["ACTIVE", 3],
      ["SUSPENDED", 1],
      ["WEIRD_NEW_STATE", 1],
    ]);
  });

  it("translates both series labels of a two-metric chart", () => {
    const comparison = {
      key: "billing.periodVsTotal",
      kind: "comparison",
      title: "Receivables: All Time vs Selected Period",
      unit: "usd",
      data: {
        primaryLabel: "All time",
        secondaryLabel: "Selected period",
        pairs: [{ key: "collected", label: "Collected", primary: 9, secondary: 4 }],
      },
    } as DashboardVisual;

    const localized = localizeVisual(comparison, "ar", ar);
    expect(localized.title).toBe("المستحقات: الإجمالي مقابل الفترة المحددة");
    expect(localized.kind === "comparison" && localized.data).toMatchObject({
      primaryLabel: "الإجمالي",
      secondaryLabel: "الفترة المحددة",
      pairs: [{ label: "مُحصَّل", primary: 9, secondary: 4 }],
    });
  });

  it("translates funnel stages, bullet rows and waterfall steps", () => {
    const funnel = localizeVisual(
      {
        key: "payments.settlement",
        kind: "funnel",
        title: "Settlement Funnel",
        unit: "count",
        data: {
          categories: [
            { key: "attempted", label: "Attempted", value: 10 },
            { key: "succeeded", label: "Succeeded", value: 8 },
          ],
        },
      } as DashboardVisual,
      "ar",
      ar,
    );
    expect(
      funnel.kind === "funnel" && funnel.data.categories.map((c) => c.label),
    ).toEqual(["تمت المحاولة", "ناجح"]);

    const waterfall = localizeVisual(
      {
        key: "billing.receivables",
        kind: "waterfall",
        title: "Receivables Flow",
        unit: "usd",
        data: {
          steps: [
            { key: "s", label: "Settlement Total", value: 100, role: "start" },
            { key: "c", label: "Collected", value: -60, role: "delta" },
            { key: "o", label: "Outstanding", value: 40, role: "total" },
          ],
        },
      } as DashboardVisual,
      "ar",
      ar,
    );
    expect(
      waterfall.kind === "waterfall" && waterfall.data.steps.map((s) => s.label),
    ).toEqual(["إجمالي التسوية", "مُحصَّل", "مستحق"]);
  });

  it("leaves a time series' bucket labels alone — they are dates, not words", () => {
    const series = localizeVisual(
      {
        key: "audit.eventsOverTime",
        kind: "area",
        title: "Audit Events Over Time",
        unit: "count",
        data: {
          series: [
            { key: "2026-08-01", label: "Aug 01", value: 4 },
            { key: "2026-08-02", label: "Aug 02", value: 7 },
          ],
        },
      } as DashboardVisual,
      "ar",
      ar,
    );

    expect(series.title).toBe("أحداث التدقيق عبر الزمن");
    expect(series.kind === "area" && series.data.series.map((p) => p.label)).toEqual([
      "Aug 01",
      "Aug 02",
    ]);
  });

  it("translates a multi-series' names while leaving its dated buckets alone", () => {
    const health = localizeVisual(
      {
        key: "domains.health",
        kind: "multi-series",
        title: "Verified vs Needing Attention",
        unit: "count",
        data: {
          series: [
            {
              key: "verified",
              label: "Verified",
              tone: "green",
              points: [{ key: "2026-08", label: "Aug", value: 9 }],
            },
            {
              key: "attention",
              label: "Needing Attention",
              tone: "red",
              points: [{ key: "2026-08", label: "Aug", value: 3 }],
            },
          ],
        },
      } as DashboardVisual,
      "ar",
      ar,
    );

    expect(health.title).toBe("المُتحقَّق منها مقابل ما يحتاج متابعة");
    expect(health.kind === "multi-series" && health.data.series.map((s) => s.label)).toEqual([
      "مُتحقَّق منه",
      "يحتاج متابعة",
    ]);
    expect(
      health.kind === "multi-series" && health.data.series[0].points.map((p) => p.label),
    ).toEqual(["Aug"]);
  });

  it("translates a scatter's axis names while leaving the subject each mark stands for", () => {
    const evidence = localizeVisual(
      {
        key: "audit.evidenceQuality",
        kind: "scatter",
        title: "Evidence Gaps Against Event Volume",
        unit: "count",
        data: {
          xLabel: "Events",
          yLabel: "Non-success",
          points: [
            { key: "t-1", label: "Acme Holdings", x: 12_000, y: 0.7, size: 40, tone: "red" },
            { key: "t-2", label: "Beta Logistics", x: 12, y: 0.7 },
          ],
        },
      } as DashboardVisual,
      "ar",
      ar,
    );

    expect(evidence.title).toBe("فجوات الأدلة مقابل حجم الأحداث");
    // The axis names are vocabulary; they say what the two measures are.
    expect(evidence.kind === "scatter" && [evidence.data.xLabel, evidence.data.yLabel]).toEqual([
      "الأحداث",
      "غير ناجح",
    ]);
    // A mark stands for a tenant, and a tenant name is a record, not a word.
    expect(evidence.kind === "scatter" && evidence.data.points.map((p) => p.label)).toEqual([
      "Acme Holdings",
      "Beta Logistics",
    ]);
    // Both coordinates and the third measure come through untouched.
    expect(evidence.kind === "scatter" && evidence.data.points[0]).toMatchObject({
      key: "t-1",
      x: 12_000,
      y: 0.7,
      size: 40,
    });
  });

  it("never renames the record a list row points at", () => {
    const list = localizeVisual(
      {
        key: "domains.invalidTenants",
        kind: "list",
        title: "Invalid Tenant Domains",
        unit: "count",
        data: {
          rows: [
            {
              key: "t-1:acme.example",
              label: "Acme Holdings",
              detail: "acme.example",
              value: "Validation failed",
              href: "/tenants/t-1",
              tone: "red",
            },
          ],
        },
      } as DashboardVisual,
      "ar",
      ar,
    );

    expect(list.title).toBe("نطاقات مستأجرين غير صالحة");
    expect(list.kind === "list" && list.data.rows[0]).toMatchObject({
      // A tenant name and its domain are the identity of the thing to open.
      label: "Acme Holdings",
      detail: "acme.example",
      href: "/tenants/t-1",
      // The reason phrase is vocabulary, so it does translate.
      value: "فشل التحقق",
    });
  });

  it("falls back to Core's English for a visual the portal has no copy for", () => {
    const unknown = localizeVisual(
      {
        key: "future.somethingNew",
        kind: "bar",
        title: "Something New",
        unit: "count",
        data: { categories: [{ key: "a", label: "Alpha", value: 1 }] },
      } as DashboardVisual,
      "ar",
      ar,
    );

    expect(unknown.title).toBe("Something New");
  });
});
