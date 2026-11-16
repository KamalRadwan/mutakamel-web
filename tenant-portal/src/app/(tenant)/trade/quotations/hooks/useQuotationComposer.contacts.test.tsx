// @vitest-environment jsdom

import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { renderComposer, resetHarness, tradeGetMock, tradePostMock, reply, settle } from "./quotation-composer.test-harness";
import { CONTACT_OPTION, CREATED_HEADER, CUSTOMER_OPTION } from "./quotation-composer.test-fixtures";

const person = { ...CUSTOMER_OPTION, partyId: "01890000-0000-7000-8000-000000000005", partyType: "PERSON" as const, displayName: "Person test fixture" };

describe("quotation customer-bound contact selection", () => {
  beforeEach(() => {
    resetHarness();
    tradeGetMock.mockImplementation(async (path: string) => reply(path.includes("customer-options")
      ? { items: [CUSTOMER_OPTION, person] } : path.includes("contact-options")
        ? { partyType: "ORGANIZATION", items: [CONTACT_OPTION] }
        : { ...CREATED_HEADER, contactPartyId: CONTACT_OPTION.partyId, revisions: [], currentLines: [] }));
  });

  it("accepts real returned options only and submits the contact ID without presentation metadata", async () => {
    tradePostMock.mockResolvedValueOnce(reply({ ...CREATED_HEADER, contactPartyId: CONTACT_OPTION.partyId }));
    const { result } = renderComposer();
    await settle();
    act(() => result.current.selectCustomer(CUSTOMER_OPTION.partyId));
    await waitFor(() => expect(result.current.contacts.options).toHaveLength(1));
    act(() => result.current.selectContact(person.partyId));
    expect(result.current.contactPartyId).toBe("");
    act(() => result.current.selectContact(CONTACT_OPTION.partyId));
    expect(result.current.selectedContact?.customerPartyId).toBe(CUSTOMER_OPTION.partyId);
    await act(async () => { await result.current.submit({ headerOnly: true }); });
    expect(tradePostMock.mock.calls[0][1]).toMatchObject({ partyId: CUSTOMER_OPTION.partyId, contactPartyId: CONTACT_OPTION.partyId });
    for (const key of ["selectedContact", "displayName", "email", "relationshipType", "customerPartyId"]) {
      expect(tradePostMock.mock.calls[0][1]).not.toHaveProperty(key);
    }
  });

  it("clears contact identity and metadata when switching organization to person, and never reads person contacts", async () => {
    const { result } = renderComposer();
    await settle();
    act(() => result.current.selectCustomer(CUSTOMER_OPTION.partyId));
    await waitFor(() => expect(result.current.contacts.options).toHaveLength(1));
    act(() => result.current.selectContact(CONTACT_OPTION.partyId));
    const before = tradeGetMock.mock.calls.filter(([path]) => String(path).includes("contact-options")).length;
    act(() => result.current.selectCustomer(person.partyId));
    await settle();
    expect(result.current.selected?.partyType).toBe("PERSON");
    expect(result.current.contactPartyId).toBe("");
    expect(result.current.selectedContact).toBeNull();
    expect(tradeGetMock.mock.calls.filter(([path]) => String(path).includes("contact-options"))).toHaveLength(before);
    act(() => result.current.selectContact(CONTACT_OPTION.partyId));
    expect(result.current.contactPartyId).toBe("");
  });

  it("retains the selected contact name across searches and validated Fast Add to full-page handoff", async () => {
    const first = renderComposer();
    await settle();
    act(() => first.result.current.selectCustomer(CUSTOMER_OPTION.partyId));
    await waitFor(() => expect(first.result.current.contacts.options).toHaveLength(1));
    act(() => first.result.current.selectContact(CONTACT_OPTION.partyId));
    tradeGetMock.mockImplementation(async (path: string) => reply(path.includes("customer-options")
      ? { items: [CUSTOMER_OPTION, person] } : { partyType: "ORGANIZATION", items: [] }));
    act(() => first.result.current.contacts.setSearch("no matching people"));
    await waitFor(() => expect(first.result.current.contacts.isLoading).toBe(false));
    expect(first.result.current.contacts.options).toEqual([]);
    expect(first.result.current.selectedContact?.displayName).toBe(CONTACT_OPTION.displayName);
    expect(first.result.current.saveHandoffSnapshot()).toBe(true);
    first.unmount();
    const second = renderComposer({ hydrateHandoff: true });
    await waitFor(() => expect(second.result.current.selectedContact?.partyId).toBe(CONTACT_OPTION.partyId));
    expect(second.result.current.selectedContact?.displayName).toBe(CONTACT_OPTION.displayName);
    expect(second.result.current.contactPartyId).toBe(CONTACT_OPTION.partyId);
    expect(tradePostMock).not.toHaveBeenCalled();
  });
});
