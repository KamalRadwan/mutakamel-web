// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CustomerProfileCreateMessages } from "../customer-profile-create-validation";

vi.mock("@/lib/api/axiosClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/axiosClient")>()),
  // Only the transport is replaced; nothing here submits.
  axiosClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const { useCreateCustomerProfile } = await import("./useCreateCustomerProfile");

const messages: CustomerProfileCreateMessages = {
  required: "Required.",
  email: "Bad email.",
  maxLength: "At most {max} characters.",
  duplicatePhone: "Already listed.",
  url: "Bad URL.",
};

const BRANCH = "01900100-0000-7000-8000-000000000099";

function setup(requiredCustomFieldKeys: string[] = []) {
  return renderHook(() =>
    useCreateCustomerProfile(
      BRANCH,
      messages,
      requiredCustomFieldKeys,
      () => undefined,
      () => undefined,
    ),
  );
}

describe("switching profile type", () => {
  it("clears every company field, each of which is a 422 on an individual", () => {
    const { result } = setup();
    act(() => {
      result.current.setField("companyName", "Acme");
      result.current.setField("taxNumber", "123");
      result.current.setField("companyWebsite", "https://acme.example");
    });
    act(() => result.current.setPhone("companyPhones", 0, "0100"));
    act(() => result.current.updateContact(0, { fullName: "Dina" }));

    act(() => result.current.setProfileType("INDIVIDUAL"));

    // 422 CUSTOMER_PROFILE_CORPORATE_FIELDS_FORBIDDEN covers all nine keys.
    expect(result.current.form.companyName).toBe("");
    expect(result.current.form.taxNumber).toBe("");
    expect(result.current.form.companyWebsite).toBe("");
    expect(result.current.form.companyPhones).toEqual([""]);
    // `contacts` is silently ignored on an individual, which is just as wrong
    // to keep as a rejected field would be.
    expect(result.current.form.contacts).toHaveLength(1);
    expect(result.current.form.contacts[0].fullName).toBe("");
  });
});

describe("contacts", () => {
  it("keeps exactly one primary and promotes another when the primary goes", () => {
    const { result } = setup();
    act(() => result.current.addContact());
    expect(result.current.form.contacts.map((c) => c.isPrimary)).toEqual([true, false]);

    act(() => result.current.setContactPrimary(1));
    act(() => result.current.removeContact(1));
    expect(result.current.form.contacts.map((c) => c.isPrimary)).toEqual([true]);
  });

  it("refuses to remove the last row, so there is always somewhere to type", () => {
    const { result } = setup();
    act(() => result.current.removeContact(0));
    expect(result.current.form.contacts).toHaveLength(1);
  });
});

describe("error reveal", () => {
  it("stays silent until a field is blurred, then tracks it live", () => {
    const { result } = setup();
    expect(result.current.allErrors.companyName).toBe("Required.");
    expect(result.current.errors.companyName).toBeUndefined();

    act(() => result.current.touch("companyName"));
    expect(result.current.errors.companyName).toBe("Required.");

    act(() => result.current.setField("companyName", "Acme"));
    expect(result.current.errors.companyName).toBeUndefined();
  });

  it("reveals every field at once, then goes quiet again after a reset", () => {
    const { result } = setup();
    act(() => result.current.revealAll());
    expect(result.current.errors.companyName).toBe("Required.");

    act(() => result.current.reset());
    expect(result.current.errors).toEqual({});
    expect(result.current.isDirty).toBe(false);
  });

  it("ignores a contact row's identity when deciding the form is dirty", () => {
    const { result } = setup();
    act(() => result.current.addContact());
    act(() => result.current.removeContact(1));
    expect(result.current.isDirty).toBe(false);
  });
});
