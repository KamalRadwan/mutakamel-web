// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import type { LeadDetail } from "../../lead-contract";
import { runCrmWrite } from "../../../shared/crm-write";
import { useLeadCompanyEdit } from "./useLeadCompanyEdit";
import { useLeadCompanyModal } from "./useLeadCompanyModal";

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en }) }));
vi.mock("../../../shared/crm-write", () => ({
  runCrmWrite: vi.fn(),
  createCrmWriteAttempt: () => ({ idempotencyKey: "01900100-0000-7000-8000-000000000001" }),
}));

const lead = {
  id: "01900100-0000-7000-8000-000000000001", leadProfileType: "CORPORATE",
  companyName: "Acme", companyEmail: null, companyWebsite: null,
  taxNumber: null, commercialRegistrationNumber: null, phones: [],
  address: { addressType: "LEGAL", country: "Egypt", city: null },
} as unknown as LeadDetail;

function setup() {
  const onSaved = vi.fn();
  const onReconcile = vi.fn();
  const hook = renderHook(({ currentLead }: { currentLead: LeadDetail }) => {
    const edit = useLeadCompanyEdit(currentLead, onSaved, onReconcile);
    const modal = useLeadCompanyModal(currentLead, edit, false);
    return { edit, modal };
  }, { initialProps: { currentLead: lead } });
  return { ...hook, onSaved, onReconcile };
}

beforeEach(() => vi.clearAllMocks());

describe("useLeadCompanyModal", () => {
  it.each(["ambiguous", "applied_unreadable"] as const)("blocks retries after %s and reopens from refreshed data", async (kind) => {
    const { result, rerender, onReconcile, onSaved } = setup();
    vi.mocked(runCrmWrite).mockResolvedValueOnce({ kind, error: { status: 0 } });
    act(() => result.current.modal.open());
    act(() => result.current.modal.setField("companyName", "Draft"));
    await act(async () => result.current.modal.save());
    expect(onReconcile).toHaveBeenCalledOnce();
    expect(onSaved).not.toHaveBeenCalled();
    expect(result.current.edit.reconciliationRequired).toBe(true);
    await act(async () => result.current.modal.save());
    expect(runCrmWrite).toHaveBeenCalledOnce();
    rerender({ currentLead: { ...lead, companyName: "Confirmed server name" } });
    act(() => result.current.modal.close());
    act(() => result.current.modal.open());
    expect(result.current.edit.reconciliationRequired).toBe(false);
    expect(result.current.modal.form?.companyName).toBe("Confirmed server name");
    expect(result.current.modal.isDirty).toBe(false);
  });

  it("does not silently discard an attempt to clear the entire address", async () => {
    const { result } = setup();
    act(() => result.current.modal.open());
    act(() => result.current.modal.setAddressField("country", ""));
    await act(async () => result.current.modal.save());
    expect(runCrmWrite).not.toHaveBeenCalled();
    expect(result.current.modal.errors.address).toBe(en.crmLeadDetail.companyAddressClearUnavailable);
    expect(result.current.modal.form?.address.country).toBe("");
  });

  it("keeps its opening baseline when unrelated refreshed data arrives", async () => {
    const { result, rerender } = setup();
    vi.mocked(runCrmWrite).mockResolvedValueOnce({ kind: "success", value: lead, replayed: false });
    act(() => result.current.modal.open());
    act(() => result.current.modal.setField("companyName", "Updated name"));
    rerender({ currentLead: { ...lead, taxNumber: "Changed elsewhere" } });
    await act(async () => result.current.modal.save());
    expect(runCrmWrite).toHaveBeenCalledWith(expect.objectContaining({ body: { companyName: "Updated name" } }));
  });
});
