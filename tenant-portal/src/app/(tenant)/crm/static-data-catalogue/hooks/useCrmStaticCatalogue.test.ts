import { describe, expect, it } from "vitest";
import {
  buildStaticCatalogueGroups,
  CRM_STATIC_DATA_PATH,
  parseCrmStaticDataResponse,
} from "./useCrmStaticCatalogue";

const rawPayload = {
  enums: {
    profileTypes: ["INDIVIDUAL", "CORPORATE"],
    additiveServerGroup: ["FUTURE_VALUE"],
  },
  enumOptions: {
    profileTypes: [
      {
        value: "INDIVIDUAL",
        label: { en: "Individual", ar: "فرد" },
      },
      {
        value: "CORPORATE",
        label: { en: "Corporate", ar: "شركة" },
      },
    ],
    additiveServerGroup: [
      {
        value: "FUTURE_VALUE",
        label: { en: "Future value", ar: "قيمة مستقبلية" },
      },
    ],
  },
  attachmentPolicy: {
    maxSizeBytes: 26_214_400,
    allowedMimeTypes: { pdf: ["application/pdf"] },
    allowedExtensions: { pdf: [".pdf"] },
    rejectedFamilies: ["executables"],
    familyLabels: [
      { value: "pdf", label: { en: "PDF", ar: "PDF" } },
    ],
    rejectedFamilyLabels: [
      {
        value: "executables",
        label: { en: "Executables", ar: "ملفات تنفيذية" },
      },
    ],
  },
  permissions: ["crm.settings.read"],
  permissionOptions: [
    {
      value: "crm.settings.read",
      label: { en: "Read CRM settings", ar: "قراءة إعدادات CRM" },
    },
  ],
  ownerTypeOptions: [
    { value: "LEAD", label: { en: "Lead", ar: "عميل محتمل" } },
  ],
  eventOptions: [
    {
      value: "crm.opportunity.won",
      label: { en: "Opportunity won", ar: "تم الفوز بالفرصة" },
    },
  ],
  derivedRules: {
    opportunityStatusByStageFlag: {
      WON: "WON",
      default: "IN_PROGRESS",
    },
    leadConversionCopiesCustomFieldOwnerType: "LEAD_AND_PARTY",
  },
};

const NOTE = "no Arabic label";

describe("CRM static-data contract", () => {
  it("uses the one canonical Gateway read route", () => {
    expect(CRM_STATIC_DATA_PATH).toBe("/api/tenant/crm/v1/static-data");
  });

  it("parses the raw CRM response and keeps additive groups", () => {
    const parsed = parseCrmStaticDataResponse(rawPayload);

    expect(parsed.enumOptions.additiveServerGroup[0].label.ar).toBe(
      "قيمة مستقبلية",
    );
    expect(buildStaticCatalogueGroups(parsed, "ar", NOTE)).toContainEqual(
      expect.objectContaining({
        id: "additiveServerGroup",
        entriesCount: 1,
        values: ["قيمة مستقبلية (FUTURE_VALUE)"],
      }),
    );
  });

  it("rejects a fabricated success envelope and malformed labels", () => {
    expect(() =>
      parseCrmStaticDataResponse({ success: true, data: rawPayload }),
    ).toThrow("Invalid CRM static-data response.");
    expect(() =>
      parseCrmStaticDataResponse({
        ...rawPayload,
        permissionOptions: [
          {
            value: "crm.settings.read",
            label: { en: "Read CRM settings" },
          },
        ],
      }),
    ).toThrow("Invalid CRM static-data response.");
  });
});

describe("Q121 · a permission label the server did not translate is not shown as one", () => {
  // crm-app's `permissionLabel` fallback returns the identical English string
  // for both languages on every scoped permission — 78 of 98. `.own` here is a
  // verbatim example of what that endpoint sends.
  const withUntranslated = () =>
    parseCrmStaticDataResponse({
      ...rawPayload,
      permissionOptions: [
        {
          value: "crm.settings.read",
          label: { en: "Read CRM settings", ar: "قراءة إعدادات CRM" },
        },
        {
          value: "crm.leads.read.own",
          label: { en: "Read leads (own)", ar: "Read leads (own)" },
        },
      ],
    });

  const permissionValues = (lang: "ar" | "en"): string[] =>
    buildStaticCatalogueGroups(withUntranslated(), lang, NOTE).find(
      (group) => group.id === "permissions",
    )?.values ?? [];

  it("marks the untranslated permission and leaves the translated one alone", () => {
    expect(permissionValues("ar")).toEqual([
      "قراءة إعدادات CRM (crm.settings.read)",
      `Read leads (own) — ${NOTE} (crm.leads.read.own)`,
    ]);
  });

  it("marks it in English too, because a missing Arabic label is a fact about the vocabulary", () => {
    expect(permissionValues("en")).toEqual([
      "Read CRM settings (crm.settings.read)",
      `Read leads (own) — ${NOTE} (crm.leads.read.own)`,
    ]);
  });

  it("does not misfire on a non-permission label that is legitimately the same in both", () => {
    // `attachment_family.pdf` is "PDF" in both dictionaries and is translated.
    // This is why the guard is scoped to permissions rather than applied to
    // every option in the catalogue.
    const groups = buildStaticCatalogueGroups(withUntranslated(), "ar", NOTE);
    expect(groups.find((group) => group.id === "attachmentPolicy")?.values).toContain(
      "PDF (pdf)",
    );
  });
});
