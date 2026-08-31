import { describe, expect, it } from "vitest";
import {
  PARTIES_PATH,
  buildCreatePartyRequest,
  buildUpdatePartyRequest,
  parseParty,
  partyImageRoute,
  partyImageSrc,
  partyPath,
  toPartyForm,
  type Party,
} from "./directory-contract";
import {
  addressPath,
  contactMethodPath,
  partyContactMethodsPath,
  partyContactsPath,
  partyRolePath,
  parsePartyContact,
} from "./directory-children-contract";
import {
  buildAddressUpdate,
  buildContactMethodCreate,
  buildContactMethodUpdate,
} from "./party-child-forms";

const partyId = "01902001-3000-7000-8000-000000000001";
const methodId = "01902001-3000-7000-8000-000000000002";
const addressId = "01902001-3000-7000-8000-000000000003";
const roleId = "01902001-3000-7000-8000-000000000004";

const partyPayload = {
  id: partyId,
  partyType: "ORGANIZATION",
  displayName: "Nile Trading",
  legalName: "Nile Trading LLC",
  firstName: null,
  lastName: null,
  honorificTitle: null,
  organizationName: "Nile Trading",
  taxNumber: "100200300",
  commercialRegistrationNumber: null,
  branchId: null,
  ownerUserId: null,
  status: "ACTIVE",
  imageRevision: "1756600000000",
  imageUrl: "/api/v1/tenant/directory/parties/x/image?v=1",
  createdAt: "2026-08-30T09:00:00.000Z",
  updatedAt: "2026-08-30T09:30:00.000Z",
  roles: [{ id: roleId, roleType: "CUSTOMER", branchId: null, appSource: null }],
  contactMethods: [
    {
      id: methodId,
      methodType: "EMAIL",
      value: "sales@example.test",
      label: null,
      isPrimary: true,
      isVerified: false,
    },
  ],
  addresses: [
    {
      id: addressId,
      addressType: "BILLING",
      label: null,
      country: "EG",
      city: "Cairo",
      area: null,
      street: "1 Nile St",
      buildingNo: null,
      floor: null,
      apartment: null,
      landmark: null,
      postalCode: null,
      isPrimary: true,
    },
  ],
};

describe("Core directory contract", () => {
  it("writes every route as its own canonical Gateway literal", () => {
    expect(PARTIES_PATH).toBe("/api/tenant/core/v1/directory/parties");
    expect(partyPath(partyId)).toBe(`${PARTIES_PATH}/${partyId}`);
    expect(partyImageRoute(partyId)).toBe(`${PARTIES_PATH}/${partyId}/image`);
    expect(partyContactsPath(partyId)).toBe(`${PARTIES_PATH}/${partyId}/contacts`);
    expect(partyContactMethodsPath(partyId)).toBe(`${PARTIES_PATH}/${partyId}/contact-methods`);
  });

  it("addresses a child by its own id, never through the party", () => {
    // The asymmetry that makes a shared prefix impossible: create through the
    // party, edit and delete by the child's id.
    expect(contactMethodPath(methodId)).toBe(
      `/api/tenant/core/v1/directory/contact-methods/${methodId}`,
    );
    expect(addressPath(addressId)).toBe(`/api/tenant/core/v1/directory/addresses/${addressId}`);
    expect(partyRolePath(roleId)).toBe(`/api/tenant/core/v1/directory/party-roles/${roleId}`);
    expect(() => contactMethodPath("not-a-uuid")).toThrow("Invalid Core identity response.");
  });

  it("parses a party with its hydrated children and keeps every child id", () => {
    const party = parseParty(partyPayload);
    expect(party.contactMethods[0]?.id).toBe(methodId);
    expect(party.addresses[0]?.id).toBe(addressId);
    expect(party.roles[0]?.id).toBe(roleId);
    expect(party.imageKind).toBe("LOGO");
  });

  it("rebuilds the image URL on the canonical path, ignoring the upstream one", () => {
    const party = parseParty(partyPayload);
    expect(partyImageSrc(party)).toBe(
      `${PARTIES_PATH}/${partyId}/image?v=1756600000000`,
    );
    expect(partyImageSrc(party)).not.toContain("/api/v1/");
  });

  it("never sends nested children on create — each child has its own permission", () => {
    const request = buildCreatePartyRequest({
      partyType: "PERSON",
      displayName: "  Mona Saleh  ",
      legalName: "",
      firstName: "Mona",
      lastName: "Saleh",
      honorificTitle: "",
      organizationName: "",
      taxNumber: "",
      commercialRegistrationNumber: "",
    });
    expect(request).toEqual({
      partyType: "PERSON",
      displayName: "Mona Saleh",
      firstName: "Mona",
      lastName: "Saleh",
    });
    expect(request).not.toHaveProperty("contactMethods");
    expect(request).not.toHaveProperty("addresses");
    expect(request).not.toHaveProperty("roles");
  });

  it("sends only the fields that moved, and status only through the update route", () => {
    const party: Party = parseParty(partyPayload);
    const values = toPartyForm(party);
    expect(buildUpdatePartyRequest(party, values, party.status)).toEqual({});
    expect(buildUpdatePartyRequest(party, { ...values, taxNumber: "999" }, "BLOCKED")).toEqual({
      taxNumber: "999",
      status: "BLOCKED",
    });
  });

  it("refuses an empty display name rather than letting the server decide", () => {
    const party = parseParty(partyPayload);
    expect(() =>
      buildUpdatePartyRequest(party, { ...toPartyForm(party), displayName: "   " }, "ACTIVE"),
    ).toThrow("PARTY_FORM_DISPLAY_NAME");
  });

  it("builds child requests without the keys the DTO does not declare", () => {
    expect(
      buildContactMethodCreate({
        methodType: "MOBILE",
        value: " +20100 ",
        label: "",
        isPrimary: false,
      }),
    ).toEqual({ methodType: "MOBILE", value: "+20100" });

    const method = parseParty(partyPayload).contactMethods[0]!;
    expect(buildContactMethodUpdate(method, {
      methodType: "EMAIL",
      value: "sales@example.test",
      label: "",
      isPrimary: true,
    })).toEqual({});

    const address = parseParty(partyPayload).addresses[0]!;
    expect(
      buildAddressUpdate(address, {
        addressType: "BILLING",
        label: "",
        country: "EG",
        city: "Giza",
        area: "",
        street: "1 Nile St",
        buildingNo: "",
        floor: "",
        apartment: "",
        landmark: "",
        postalCode: "",
        isPrimary: true,
      }),
    ).toEqual({ city: "Giza" });
  });

  it("keys a contact row by its relationship, which is what a delete addresses", () => {
    const relationshipId = "01902001-3000-7000-8000-00000000000a";
    const contact = parsePartyContact({
      relationshipId,
      relationshipType: "CONTACT_PERSON",
      relationshipLabel: null,
      isPrimary: true,
      partyId,
      displayName: "Mona Saleh",
      firstName: "Mona",
      lastName: "Saleh",
      honorificTitle: null,
      email: "mona@example.test",
      mobile: null,
      phone: null,
    });
    expect(contact.id).toBe(relationshipId);
    expect(contact.relationshipId).toBe(relationshipId);
  });
});
