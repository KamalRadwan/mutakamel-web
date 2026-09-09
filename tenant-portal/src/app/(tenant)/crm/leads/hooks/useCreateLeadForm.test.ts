// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useCreateLeadForm } from "./useCreateLeadForm";
import type { LeadCreateMessages } from "../lead-create-validation";

const messages: LeadCreateMessages = {
  required: "Required.",
  email: "Bad email.",
  maxLength: "At most {max} characters.",
  duplicatePhone: "Already listed.",
  url: "Bad URL.",
  contactRequired: "Add a contact.",
  tagsLimit: "At most {max} tags.",
  tagsInvalid: "Choose valid tags.",
};

const COMPANY_A = "01900100-0000-7000-8000-0000000000c1";
const CONTACT_A = "01900100-0000-7000-8000-0000000000c2";
const TAG_A = "01900100-0000-7000-8000-0000000000c3";

function setup(requiredCustomFieldKeys: string[] = []) {
  return renderHook(() => useCreateLeadForm(messages, requiredCustomFieldKeys));
}

describe("switching profile type", () => {
  it("clears every field the server would then reject", () => {
    const { result } = setup();
    // Stated, because a blank form now opens on INDIVIDUAL and there would
    // otherwise be no switch to test.
    act(() => result.current.setProfileType("CORPORATE"));
    act(() => {
      result.current.selectCompany(COMPANY_A, "Acme Trading");
      result.current.setField("legalName", "Acme LLC");
      result.current.setField("taxNumber", "123");
      result.current.setField("commercialRegistrationNumber", "456");
    });
    act(() => result.current.setProfileType("INDIVIDUAL"));

    // 422 LEAD_EXISTING_COMPANY_INVALID and 422 LEAD_CORPORATE_FIELDS_FORBIDDEN
    // are what a form that carried these across would earn.
    expect(result.current.form.existingCompanyPartyId).toBe("");
    expect(result.current.form.legalName).toBe("");
    expect(result.current.form.taxNumber).toBe("");
    expect(result.current.form.commercialRegistrationNumber).toBe("");
  });

  it("keeps the corporate fields when staying corporate", () => {
    const { result } = setup();
    act(() => result.current.setField("legalName", "Acme LLC"));
    act(() => result.current.setProfileType("CORPORATE"));
    expect(result.current.form.legalName).toBe("Acme LLC");
  });
});

describe("choosing a company from the directory", () => {
  it("resets a contact that belonged to the previous company and keeps a typed one", () => {
    const { result } = setup();
    act(() => result.current.addContact());
    act(() => {
      result.current.updateContact(0, { contactPartyId: CONTACT_A, fullName: "Dina Ali" });
      result.current.updateContact(1, { fullName: "Typed By Hand" });
    });

    act(() => result.current.selectCompany(COMPANY_A, "Acme Trading"));

    // A contactPartyId from company A is `409 PARTY_CONTACT_INVALID` against
    // company B, so the picked row is cleared; the hand-typed one was never
    // tied to a company and survives.
    expect(result.current.form.contacts[0].contactPartyId).toBe("");
    expect(result.current.form.contacts[0].fullName).toBe("");
    expect(result.current.form.contacts[1].fullName).toBe("Typed By Hand");
    expect(result.current.form.companyName).toBe("Acme Trading");
  });
});

describe("contacts", () => {
  it("keeps exactly one primary, and promotes another when the primary is removed", () => {
    const { result } = setup();
    act(() => result.current.addContact());
    expect(result.current.form.contacts.map((c) => c.isPrimary)).toEqual([true, false]);

    act(() => result.current.setContactPrimary(1));
    expect(result.current.form.contacts.map((c) => c.isPrimary)).toEqual([false, true]);

    act(() => result.current.removeContact(1));
    // LEAD_CONTACT_PRIMARY_INVALID needs two; none silently promotes row 0 —
    // the form says out loud which row that is.
    expect(result.current.form.contacts.map((c) => c.isPrimary)).toEqual([true]);
  });

  it("refuses to remove the last row, because a corporate lead needs one", () => {
    const { result } = setup();
    act(() => result.current.removeContact(0));
    expect(result.current.form.contacts).toHaveLength(1);
  });
});

describe("phone rows", () => {
  it("always leaves one row behind when the last is removed", () => {
    const { result } = setup();
    act(() => result.current.addPhone("companyPhones"));
    act(() => result.current.setPhone("companyPhones", 1, "0100"));
    expect(result.current.form.companyPhones).toEqual(["", "0100"]);

    act(() => result.current.removePhone("companyPhones", 1));
    act(() => result.current.removePhone("companyPhones", 0));
    expect(result.current.form.companyPhones).toEqual([""]);
  });

  it("stops at the DTO's ten-number ceiling", () => {
    const { result } = setup();
    for (let index = 0; index < 15; index += 1) {
      act(() => result.current.addPhone("phones"));
    }
    expect(result.current.form.phones).toHaveLength(10);
  });
});

describe("tags", () => {
  it("tracks the selection as form state, preserves it across profile changes, and clears it on reset", () => {
    const { result } = setup();

    act(() => result.current.setField("tagIds", [TAG_A]));
    expect(result.current.form.tagIds).toEqual([TAG_A]);
    expect(result.current.isDirty).toBe(true);

    act(() => result.current.setProfileType("CORPORATE"));
    expect(result.current.form.tagIds).toEqual([TAG_A]);

    act(() => result.current.reset());
    expect(result.current.form.tagIds).toEqual([]);
    expect(result.current.isDirty).toBe(false);
  });
});

describe("when errors are allowed to speak", () => {
  it("stays silent until the field is blurred, then tracks it live", () => {
    const { result } = setup();
    // The first name is empty and therefore invalid from the first render —
    // and saying so before the user has touched it is the behaviour this
    // avoids. It is the field the default INDIVIDUAL shape cannot do without,
    // because CRM composes the lead's rendered name from it.
    expect(result.current.allErrors.firstName).toBe("Required.");
    expect(result.current.errors.firstName).toBeUndefined();

    act(() => result.current.touch("firstName"));
    expect(result.current.errors.firstName).toBe("Required.");

    act(() => result.current.setField("firstName", "Sara"));
    expect(result.current.errors.firstName).toBeUndefined();
  });

  it("reveals every field at once on submit, including ones never focused", () => {
    const { result } = setup();
    act(() => result.current.revealAll());
    expect(result.current.errors.firstName).toBe("Required.");
    // Client-side only — the DTO marks `acquisitionSourceId` `@IsOptional()`.
    expect(result.current.errors.acquisitionSourceId).toBe("Required.");
  });

  it("goes back to silent after a reset, and stops being dirty", () => {
    const { result } = setup();
    act(() => result.current.setField("firstName", "Sara"));
    expect(result.current.isDirty).toBe(true);

    act(() => result.current.revealAll());
    act(() => result.current.reset());

    expect(result.current.isDirty).toBe(false);
    expect(result.current.errors).toEqual({});
  });

  it("ignores a contact row's identity when deciding the form is dirty", () => {
    const { result } = setup();
    act(() => result.current.addContact());
    act(() => result.current.removeContact(1));
    // The row key changed; nothing the user typed did.
    expect(result.current.isDirty).toBe(false);
  });

  it("holds a required custom field open until it has a value", () => {
    const { result } = setup(["budget"]);
    expect(result.current.allErrors["customFields.budget"]).toBe("Required.");
    act(() => result.current.setCustomField("budget", 5000));
    expect(result.current.allErrors["customFields.budget"]).toBeUndefined();
  });
});
