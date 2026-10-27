// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { runIdempotentWrite, type WriteOutcome } from "@/lib/api/idempotent-write";
import type { CrmActionCapability } from "../../../shared/crm-capabilities";
import { parseLeadConversionResponse, type LeadConversionResult } from "../lead-conversion-contract";
import { CONVERSION_IDS as ids, conversionLead, conversionReceipt } from "../__fixtures__/lead-conversion";
import { useLeadConversionOptions } from "./useLeadConversionOptions";
import { useCrmCreateCustomFields } from "../../../shared/hooks/useCrmCreateCustomFields";
import { useLeadConvert } from "./useLeadConvert";

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en }) }));
vi.mock("./useLeadConversionOptions", () => ({ useLeadConversionOptions: vi.fn() }));
vi.mock("../../../shared/hooks/useCrmCreateCustomFields", () => ({ useCrmCreateCustomFields: vi.fn() }));
vi.mock("@/lib/api/idempotent-write", async (original) => ({ ...await original<typeof import("@/lib/api/idempotent-write")>(), runIdempotentWrite: vi.fn() }));

const all: CrmActionCapability = { scope: "all", ownerUserIds: null };
const defaults = { canConvert: true, capability: all as CrmActionCapability | null, lead: conversionLead };
const individualLead = { ...conversionLead, leadProfileType: "INDIVIDUAL" as const, displayName: "Noura Saleh", companyName: null };
const corporateLead = { ...conversionLead, contacts: [{
  partyId: ids.party, relationshipId: null, displayName: "Noura Saleh", firstName: "Noura", lastName: "Saleh",
  honorificTitle: null, jobTitle: null, isPrimary: true, email: null, phones: [],
}] };
const success = (): WriteOutcome<LeadConversionResult> => ({ kind: "success", replayed: false,
  value: parseLeadConversionResponse(conversionReceipt(), ids.lead, false, true) });

function setup(overrides: Partial<typeof defaults> = {}) {
  const reload = vi.fn();
  const hook = renderHook(({ lead, canConvert, capability }) => useLeadConvert(lead, reload, canConvert, capability),
    { initialProps: { ...defaults, ...overrides } });
  act(() => hook.result.current.openModal());
  return { ...hook, reload };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useCrmCreateCustomFields).mockReturnValue({ definitions: [], requiredFieldKeys: [], degraded: false, loading: false });
  vi.mocked(useLeadConversionOptions).mockReturnValue({ pipelines: [{ id: ids.pipeline, code: "SALES", isActive: true, isDefault: true, nameAr: "مسار", nameEn: "Pipeline", stages: [
    { id: ids.membership, pipelineId: ids.pipeline, opportunityStageId: ids.party, nameAr: "جديد", nameEn: "New", flag: "NEW", isActive: true, rank: 0, category: "ACTIVE", isSystem: true },
    { id: ids.opportunity, pipelineId: ids.pipeline, opportunityStageId: ids.customer, nameAr: "فوز", nameEn: "Won", flag: "WON", isActive: true, rank: 1, category: "CLOSED", isSystem: true },
  ] }], ownerOptions: [], actorId: ids.owner, loading: false, pipelinesFailed: false, usersFailed: false, canReadPipelines: true, canReadUsers: true, reload: vi.fn() });
});
afterEach(cleanup);

describe("useLeadConvert", () => {
  it("reviews before posting and ignores a same-render double submission", async () => {
    let finish!: (value: WriteOutcome<LeadConversionResult>) => void;
    vi.mocked(runIdempotentWrite).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { result, reload } = setup();
    await act(async () => result.current.submit());
    expect(result.current.reviewing).toBe(true);
    expect(runIdempotentWrite).not.toHaveBeenCalled();
    let pending!: Promise<void>;
    act(() => { pending = result.current.submit(); void result.current.submit(); result.current.closeModal(); });
    expect(runIdempotentWrite).toHaveBeenCalledOnce();
    expect(result.current.open).toBe(true);
    expect(result.current.locked).toBe(true);
    await act(async () => { finish(success()); await pending; });
    expect(reload).toHaveBeenCalledOnce();
    expect(result.current.result?.customerProfileId).toBe(ids.customer);
    expect(runIdempotentWrite).toHaveBeenCalledWith(expect.objectContaining({ method: "post", path: `/api/tenant/crm/v1/leads/${ids.lead}/convert`,
      body: { profileType: "CORPORATE", displayName: "Acme", companyName: "Acme Trading", keepLead: true, createOpportunity: false } }));
  });
  it("sends the explicit remove choice and keeps the receipt visible without reloading a deleted lead", async () => {
    vi.mocked(runIdempotentWrite).mockResolvedValue({
      kind: "success",
      replayed: false,
      value: parseLeadConversionResponse(
        conversionReceipt(false, false),
        ids.lead,
        false,
        false,
      ),
    });
    const { result, reload } = setup();
    act(() => result.current.setField("keepLead", false));

    await act(async () => result.current.submit());
    await act(async () => result.current.submit());

    expect(runIdempotentWrite).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.objectContaining({ keepLead: false }) }),
    );
    expect(result.current.result).toMatchObject({ lead: null, leadDeleted: true });
    expect(reload).not.toHaveBeenCalled();
  });
  it("freezes an ambiguous attempt across close/reopen and retries the identical body/key", async () => {
    vi.mocked(runIdempotentWrite).mockResolvedValueOnce({ kind: "ambiguous", error: { status: 0 } }).mockResolvedValueOnce(success());
    const { result } = setup();
    await act(async () => result.current.submit());
    await act(async () => result.current.submit());
    const intent = vi.mocked(runIdempotentWrite).mock.calls[0][0];
    act(() => { result.current.setField("displayName", "Unsafe changed intent"); result.current.closeModal(); });
    act(() => result.current.openModal());
    expect(result.current.form?.displayName).toBe("Acme");
    expect(result.current.hasReceipt).toBe(true);
    act(() => result.current.setField("profileType", "INDIVIDUAL"));
    expect(result.current.form?.profileType).toBe("CORPORATE");
    await act(async () => result.current.submit());
    expect(runIdempotentWrite).toHaveBeenCalledOnce();
    await act(async () => result.current.retry());
    const replay = vi.mocked(runIdempotentWrite).mock.calls[1][0];
    expect(replay.attempt).toBe(intent.attempt);
    expect(replay.body).toBe(intent.body);
    expect(replay.path).toBe(intent.path);
  });
  it("keeps successful or unreadable receipts and prevents any second write", async () => {
    vi.mocked(runIdempotentWrite).mockResolvedValueOnce({ kind: "applied_unreadable", error: { status: 201 } });
    const { result, reload } = setup();
    await act(async () => result.current.submit());
    await act(async () => result.current.submit());
    act(() => result.current.closeModal());
    act(() => result.current.openModal());
    await act(async () => result.current.retry());
    expect(result.current.appliedUnreadable).toEqual({ status: 201 });
    expect(result.current.isDirty).toBe(false);
    expect(runIdempotentWrite).toHaveBeenCalledOnce();
    expect(reload).toHaveBeenCalledOnce();
  });
  it("allows a changed intent only after a definite rejection", async () => {
    vi.mocked(runIdempotentWrite).mockResolvedValueOnce({ kind: "failed", error: { status: 422 } }).mockResolvedValueOnce(success());
    const { result } = setup();
    await act(async () => result.current.submit());
    await act(async () => result.current.submit());
    act(() => result.current.setField("displayName", "Corrected name"));
    await act(async () => result.current.submit());
    await act(async () => result.current.submit());
    const [first, second] = vi.mocked(runIdempotentWrite).mock.calls.map(([options]) => options);
    expect(second.attempt.idempotencyKey).not.toBe(first.attempt.idempotencyKey);
    expect(second.body).toMatchObject({ displayName: "Corrected name" });
  });
  it("checks conversion permission again after review", async () => {
    const { result, rerender } = setup();
    await act(async () => result.current.submit());
    rerender({ ...defaults, canConvert: false });
    await act(async () => result.current.submit());
    expect(runIdempotentWrite).not.toHaveBeenCalled();
  });
  it("requires independent opportunity permission", async () => {
    const { result } = setup({ capability: null });
    act(() => result.current.setField("createOpportunity", true));
    await act(async () => result.current.submit());
    expect(result.current.errors.createOpportunity).toBe(en.crmLeadConvert.opportunityNotPermitted);
    expect(result.current.reviewing).toBe(false);
  });
  it.each(["displayName", "companyName"] as const)("requires an explicit %s for individual-to-company conversion", async (field) => {
    vi.mocked(runIdempotentWrite).mockResolvedValue(success());
    const { result } = setup({ lead: individualLead });
    expect(result.current.form?.profileType).toBe("INDIVIDUAL");
    act(() => result.current.setField("profileType", "CORPORATE"));
    expect(result.current.form).toMatchObject({ displayName: "", companyName: "", newContact: false });
    act(() => result.current.setField(field, "  "));
    await act(async () => result.current.submit());
    expect(result.current.errors.companyName).toBe(en.crmLeadConvert.serverErrors.LEAD_CONVERSION_COMPANY_NAME_REQUIRED);
    expect(result.current.reviewing).toBe(false);
    expect(runIdempotentWrite).not.toHaveBeenCalled();
    act(() => result.current.setField(field, " New Company "));
    await act(async () => result.current.submit());
    expect(result.current.reviewing).toBe(true);
    await act(async () => result.current.submit());
    expect(runIdempotentWrite).toHaveBeenCalledWith(expect.objectContaining({ body: {
      profileType: "CORPORATE", [field]: "New Company", keepLead: true, createOpportunity: false,
    } }));
  });
  it("converts a company to its primary person without sending company or drafted new-contact fields", async () => {
    vi.mocked(runIdempotentWrite).mockResolvedValue(success());
    const { result } = setup({ lead: corporateLead });
    act(() => { result.current.setField("newContact", true); result.current.setField("contactFullName", "Another person"); });
    act(() => result.current.setField("profileType", "INDIVIDUAL"));
    expect(result.current.form).toMatchObject({ profileType: "INDIVIDUAL", displayName: "", companyName: "", newContact: false });
    expect(result.current.primaryContact?.displayName).toBe("Noura Saleh");
    await act(async () => result.current.submit());
    expect(result.current.errors).toEqual({});
    expect(result.current.reviewing).toBe(true);
    await act(async () => result.current.submit());
    expect(runIdempotentWrite).toHaveBeenCalledWith(expect.objectContaining({ body: {
      profileType: "INDIVIDUAL", keepLead: true, createOpportunity: false,
    } }));
  });
  it("blocks company-to-individual conversion without this lead's primary contact", async () => {
    const { result } = setup({ lead: { ...corporateLead, contacts: corporateLead.contacts.map((contact) => ({ ...contact, isPrimary: false })) } });
    act(() => result.current.setField("profileType", "INDIVIDUAL"));
    await act(async () => result.current.submit());
    expect(result.current.errors.profileType).toBe(en.crmLeadConvert.serverErrors.LEAD_CONVERSION_CONTACT_REQUIRED);
    expect(result.current.reviewing).toBe(false);
    expect(runIdempotentWrite).not.toHaveBeenCalled();
  });
  it("restores source names when switching back and resets the target on reopen", () => {
    const { result } = setup();
    act(() => result.current.setField("profileType", "INDIVIDUAL"));
    act(() => result.current.setField("profileType", "CORPORATE"));
    expect(result.current.form).toMatchObject({ displayName: "Acme", companyName: "Acme Trading" });
    act(() => result.current.setField("profileType", "INDIVIDUAL"));
    act(() => result.current.closeModal());
    act(() => result.current.openModal());
    expect(result.current.form?.profileType).toBe("CORPORATE");
  });
  it("uses pipeline membership ids, excludes won/lost stages and clears stage on pipeline change", async () => {
    const { result } = setup();
    act(() => { result.current.setField("createOpportunity", true); result.current.setField("pipelineId", ids.pipeline); });
    expect(result.current.selectableStages.map(({ id }) => id)).toEqual([ids.membership]);
    act(() => result.current.setField("stageId", ids.party));
    await act(async () => result.current.submit());
    expect(result.current.errors.stageId).toBe(en.crmLeadConvert.stageHint);
    act(() => result.current.setField("pipelineId", ids.party));
    expect(result.current.form?.stageId).toBe("");
  });
  it("inherits the actor for an unassigned lead and waits for required custom fields", async () => {
    const { result } = setup({ lead: { ...conversionLead, ownerUserId: null }, capability: { scope: "own", ownerUserIds: [ids.owner] } });
    act(() => { result.current.setField("createOpportunity", true); result.current.setField("pipelineId", ids.pipeline); result.current.setField("stageId", ids.membership); });
    await act(async () => result.current.submit());
    expect(result.current.reviewing).toBe(true);
    act(() => result.current.back());
    vi.mocked(useCrmCreateCustomFields).mockReturnValue({ definitions: [], requiredFieldKeys: ["seats"], degraded: false, loading: true });
    act(() => result.current.setField("title", "New title"));
    await act(async () => result.current.submit());
    expect(result.current.errors.createOpportunity).toBe(en.crmLeadConvert.referencesLoading);
    expect(result.current.errors["customFields.seats"]).toBe(en.crmShared.fieldRequired);
    expect(runIdempotentWrite).not.toHaveBeenCalled();
  });
});
