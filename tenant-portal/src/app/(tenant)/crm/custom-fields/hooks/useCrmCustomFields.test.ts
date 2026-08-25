import { describe, expect, it } from "vitest";
import {
  CRM_CUSTOM_FIELD_OWNER_TYPES,
  CRM_CUSTOM_FIELD_SIMPLE_CREATE_TYPES,
  CRM_CUSTOM_FIELDS_PATH,
  normalizeCrmCustomFieldKey,
  parseCrmCustomField,
  parseCrmCustomFieldsResponse,
} from "./useCrmCustomFields";

const definition = {
  id: "0191e9a8-7f51-7b32-8d72-19f9217a41b3",
  ownerType: "LEAD",
  fieldKey: "preferred_channel",
  nameAr: "قناة التواصل",
  nameEn: "Preferred channel",
  type: "TEXT",
  options: [],
  isSearchable: true,
  isActive: true,
  sortOrder: 10,
  requirements: [],
};

describe("CRM custom-fields contract", () => {
  it("uses the canonical Gateway route and exact create vocabularies", () => {
    expect(CRM_CUSTOM_FIELDS_PATH).toBe(
      "/api/tenant/crm/v1/custom-fields",
    );
    expect(CRM_CUSTOM_FIELD_OWNER_TYPES).toEqual([
      "LEAD",
      "PARTY",
      "CUSTOMER_PROFILE",
      "OPPORTUNITY",
    ]);
    expect(CRM_CUSTOM_FIELD_SIMPLE_CREATE_TYPES).toEqual([
      "TEXT",
      "TEXTAREA",
      "NUMBER",
      "DATE",
      "DATETIME",
      "BOOLEAN",
      "URL",
      "EMAIL",
      "PHONE",
    ]);
  });

  it("parses the raw list response, including a definition-only owner type", () => {
    expect(
      parseCrmCustomFieldsResponse([
        definition,
        {
          ...definition,
          id: "0191e9a8-7f51-7b32-8d72-19f9217a41b4",
          ownerType: "LEAD_AND_PARTY",
          fieldKey: "segment",
          type: "SELECT",
          options: [
            {
              key: "enterprise",
              nameAr: "مؤسسة",
              nameEn: "Enterprise",
              sortOrder: 1,
              isActive: true,
            },
          ],
        },
      ])[1],
    ).toMatchObject({
      ownerType: "LEAD_AND_PARTY",
      type: "SELECT",
      optionsCount: 1,
    });
  });

  it("parses the raw create response and normalizes keys like the service", () => {
    expect(parseCrmCustomField(definition).fieldKey).toBe("preferred_channel");
    expect(normalizeCrmCustomFieldKey("  Preferred Channel ")).toBe(
      "preferred_channel",
    );
  });

  it("rejects a fabricated success envelope and malformed definitions", () => {
    expect(() =>
      parseCrmCustomFieldsResponse({ success: true, data: [definition] }),
    ).toThrow("Invalid CRM custom-fields response.");
    expect(() =>
      parseCrmCustomFieldsResponse([{ ...definition, ownerType: "lead" }]),
    ).toThrow("Invalid CRM custom-fields response.");
    expect(() =>
      parseCrmCustomFieldsResponse([
        { ...definition, type: "SELECT", options: [] },
      ]),
    ).toThrow("Invalid CRM custom-fields response.");
    expect(() =>
      parseCrmCustomField({ ...definition, id: "field-one" }),
    ).toThrow("Invalid CRM custom-fields response.");
  });
});
