// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readCoreData } from "@/lib/api/envelope";
import { createWriteAttempt, runIdempotentWrite } from "@/lib/api/idempotent-write";
import { OPPORTUNITIES_PATH } from "../opportunity-contract";
import type { OpportunityCreateMessages } from "../opportunity-create-validation";
import { useCreateOpportunity, useOpportunityCurrencyOptions } from "./useCreateOpportunity";

const auth = vi.hoisted(() => ({ permissions: [] as string[] }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: auth }) }));
vi.mock("@/lib/api/envelope", () => ({ readCoreData: vi.fn() }));
vi.mock("@/lib/api/idempotent-write", () => ({
  createWriteAttempt: vi.fn(), runIdempotentWrite: vi.fn(),
}));

const branchId = "01900100-0000-7000-8000-000000000099";
const draft = {
  title: "ERP rollout",
  customerProfileId: "01900100-0000-7000-8000-000000000001",
  pipelineId: "01900100-0000-7000-8000-000000000002",
  stageId: "01900100-0000-7000-8000-000000000003",
  amount: "12.34",
};
const messages: OpportunityCreateMessages = {
  required: "Required", email: "Email", maxLength: "Max {max}",
  duplicatePhone: "Duplicate", phone: "Invalid phone", url: "URL", amountInvalid: "Amount",
  outOfRange: "Range", currencyLength: "Currency",
};

beforeEach(() => {
  auth.permissions = [];
  vi.mocked(readCoreData).mockReset();
  vi.mocked(createWriteAttempt).mockReset().mockImplementation(() => ({
    idempotencyKey: `01900100-0000-7000-8000-${String(vi.mocked(createWriteAttempt).mock.calls.length).padStart(12, "0")}`,
  }));
  vi.mocked(runIdempotentWrite).mockReset().mockResolvedValue({
    kind: "success", value: { id: draft.customerProfileId }, replayed: false,
  });
});
afterEach(cleanup);

describe("opportunity creation currency", () => {
  function setup() {
    return renderHook(() => useCreateOpportunity(branchId, [], messages, [], vi.fn(), vi.fn()));
  }

  it("omits untouched currency so CRM resolves the workspace default", async () => {
    const { result } = setup();
    act(() => result.current.openModal(null, draft));
    expect(result.current.form.currencyCode).toBe("");
    await act(async () => { expect(await result.current.submit()).toBe(true); });
    expect(runIdempotentWrite).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.objectContaining({ title: draft.title, amount: 12.34 }),
    }));
    expect(vi.mocked(runIdempotentWrite).mock.calls[0][0].body).not.toHaveProperty("currencyCode");
  });

  it("keeps an explicit currency in a Board draft and resets it after Create another", async () => {
    const { result } = setup();
    act(() => result.current.openModal(null, { ...draft, currencyCode: "KWD" }));
    await act(async () => { expect(await result.current.submit({ keepOpenAfterSuccess: true })).toBe(true); });
    expect(runIdempotentWrite).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.objectContaining({ currencyCode: "KWD" }),
    }));
    expect(result.current.open).toBe(true);
    expect(result.current.form.currencyCode).toBe("");
    act(() => {
      result.current.setField("title", draft.title);
      result.current.setField("customerProfileId", draft.customerProfileId);
    });
    await act(async () => { expect(await result.current.submit()).toBe(true); });
    expect(vi.mocked(runIdempotentWrite).mock.calls[1][0].body).not.toHaveProperty("currencyCode");
  });

  it("does not carry a previous currency into a reopened create form", () => {
    const { result } = setup();
    act(() => result.current.openModal(null, { ...draft, currencyCode: "JPY" }));
    act(() => result.current.closeModal());
    act(() => result.current.openModal(null, draft));
    expect(result.current.form.currencyCode).toBe("");
  });
});

describe("opportunity create recovery", () => {
  function setup() {
    const onCreated = vi.fn();
    const onReconcile = vi.fn();
    const hook = renderHook(() => useCreateOpportunity(branchId, [], messages, [], onCreated, onReconcile));
    act(() => hook.result.current.openModal(null, draft));
    return { ...hook, onCreated, onReconcile };
  }

  it.each([false, true])("replays one committed create after a lost response (create another: %s)", async (keepOpenAfterSuccess) => {
    const records = new Map<string, string>();
    vi.mocked(runIdempotentWrite).mockImplementation(async ({ attempt }) => {
      const existing = records.get(attempt.idempotencyKey);
      if (existing) return { kind: "success", value: { id: existing }, replayed: true };
      records.set(attempt.idempotencyKey, draft.customerProfileId);
      return { kind: "ambiguous", error: { status: 0 } };
    });
    const { result, onCreated, onReconcile } = setup();
    const staleSubmit = result.current.submit;
    await act(async () => { expect(await staleSubmit({ keepOpenAfterSuccess })).toBe(false); });
    const original = vi.mocked(runIdempotentWrite).mock.calls[0][0];
    const replay = result.current.ambiguity!.replay;
    act(() => {
      result.current.setField("title", "Changed after the uncertain request");
      result.current.selectCustomer(draft.customerProfileId, "Original customer");
    });
    act(() => result.current.closeModal());
    act(() => result.current.openModal(null, { ...draft, title: "A fresh intent" }));
    expect(result.current.open).toBe(true);
    expect(result.current.form.title).toBe("Changed after the uncertain request");
    expect(result.current.customerLabel).toBe("Original customer");
    expect(result.current.ambiguity?.attempt).toBe(original.attempt);
    await act(async () => {
      expect(await result.current.submit()).toBe(false);
      expect(await result.current.submit({ keepOpenAfterSuccess: true })).toBe(false);
      expect(await staleSubmit()).toBe(false);
    });
    expect(runIdempotentWrite).toHaveBeenCalledOnce();
    expect(createWriteAttempt).toHaveBeenCalledOnce();
    await act(async () => { await result.current.ambiguity!.replay(); });
    const retried = vi.mocked(runIdempotentWrite).mock.calls[1][0];
    expect(retried.attempt).toBe(original.attempt);
    expect(retried.body).toBe(original.body);
    expect(records.size).toBe(1);
    expect(result.current.ambiguity).toBeNull();
    expect(result.current.open).toBe(keepOpenAfterSuccess);
    expect(onCreated).toHaveBeenCalledTimes(keepOpenAfterSuccess ? 0 : 1);
    expect(onReconcile).toHaveBeenCalledTimes(keepOpenAfterSuccess ? 1 : 0);
    await act(async () => { await replay(); });
    expect(runIdempotentWrite).toHaveBeenCalledTimes(2);
  });

  it("blocks same-tick submissions and concurrent retries", async () => {
    let finish = () => {};
    const pending = new Promise<{ kind: "ambiguous"; error: { status: number } }>((resolve) => {
      finish = () => resolve({ kind: "ambiguous", error: { status: 0 } });
    });
    vi.mocked(runIdempotentWrite).mockReturnValue(pending);
    const { result } = setup();
    await act(async () => {
      const first = result.current.submit();
      expect(await result.current.submit({ keepOpenAfterSuccess: true })).toBe(false);
      finish();
      await first;
    });
    expect(runIdempotentWrite).toHaveBeenCalledOnce();
    let finishRetry = () => {};
    vi.mocked(runIdempotentWrite).mockReturnValueOnce(new Promise((resolve) => {
      finishRetry = () => resolve({ kind: "success", value: { id: draft.customerProfileId }, replayed: true });
    }));
    const replay = result.current.ambiguity!.replay;
    await act(async () => {
      const retry = replay();
      await replay();
      expect(runIdempotentWrite).toHaveBeenCalledTimes(2);
      finishRetry();
      await retry;
    });
    expect(result.current.ambiguity).toBeNull();
  });

  it("retains the original attempt when a replay is refused", async () => {
    vi.mocked(runIdempotentWrite)
      .mockResolvedValueOnce({ kind: "ambiguous", error: { status: 0 } })
      .mockResolvedValueOnce({ kind: "failed", error: { status: 403 } });
    const { result } = setup();
    await act(async () => { await result.current.submit(); });
    const attempt = result.current.ambiguity!.attempt;
    await act(async () => { await result.current.ambiguity!.replay(); });
    expect(result.current.ambiguity?.attempt).toBe(attempt);
    expect(result.current.ambiguity?.error.status).toBe(403);
    await act(async () => { expect(await result.current.submit()).toBe(false); });
    expect(createWriteAttempt).toHaveBeenCalledOnce();
    await act(async () => { await result.current.ambiguity!.replay(); });
    expect(result.current.ambiguity).toBeNull();
  });

  it("allows a fresh attempt after a definite initial refusal", async () => {
    vi.mocked(runIdempotentWrite).mockResolvedValueOnce({ kind: "failed", error: { status: 422 } });
    const { result } = setup();
    await act(async () => { expect(await result.current.submit()).toBe(false); });
    await act(async () => { expect(await result.current.submit()).toBe(true); });
    expect(createWriteAttempt).toHaveBeenCalledTimes(2);
  });

  it.each([403, 422])("keeps the created ID and retries only tag attachment after %s", async (status) => {
    vi.mocked(runIdempotentWrite)
      .mockResolvedValueOnce({ kind: "success", value: { id: draft.customerProfileId }, replayed: false })
      .mockResolvedValueOnce({ kind: "failed", error: { status } })
      .mockResolvedValueOnce({ kind: "success", value: {}, replayed: false });
    const { result, onCreated, onReconcile } = setup();
    act(() => result.current.setField("tagIds", ["01900100-0000-7000-8000-000000000004"]));

    await act(async () => { expect(await result.current.submit()).toBe(true); });
    expect(result.current.tagRecovery).toMatchObject({
      opportunityId: draft.customerProfileId,
      status: "failed",
      error: { status },
    });
    expect(onCreated).not.toHaveBeenCalled();
    expect(onReconcile).toHaveBeenCalledOnce();

    await act(async () => { await result.current.retryTagAttachment(); });
    expect(result.current.tagRecovery).toBeNull();
    expect(vi.mocked(runIdempotentWrite).mock.calls.map(([request]) => request.path)).toEqual([
      OPPORTUNITIES_PATH,
      `${OPPORTUNITIES_PATH}/${draft.customerProfileId}/tags`,
      `${OPPORTUNITIES_PATH}/${draft.customerProfileId}/tags`,
    ]);
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("reconciles an uncertain tag attachment with the same attempt", async () => {
    vi.mocked(runIdempotentWrite)
      .mockResolvedValueOnce({ kind: "success", value: { id: draft.customerProfileId }, replayed: false })
      .mockResolvedValueOnce({ kind: "ambiguous", error: { status: 0 } })
      .mockResolvedValueOnce({ kind: "success", value: {}, replayed: true });
    const { result } = setup();
    act(() => result.current.setField("tagIds", ["01900100-0000-7000-8000-000000000004"]));
    await act(async () => { await result.current.submit(); });
    const tagAttempt = result.current.tagRecovery!.attempt;
    await act(async () => { await result.current.retryTagAttachment(); });

    expect(vi.mocked(runIdempotentWrite).mock.calls[2][0].attempt).toBe(tagAttempt);
    expect(vi.mocked(runIdempotentWrite).mock.calls[2][0].path).toBe(
      `${OPPORTUNITIES_PATH}/${draft.customerProfileId}/tags`,
    );
    expect(result.current.tagRecovery).toBeNull();
  });
});

describe("active tenant currency choices", () => {
  it("uses validated tenant codes instead of a built-in list", async () => {
    auth.permissions = ["currencies.currency.read"];
    vi.mocked(readCoreData).mockResolvedValue({ items: [{ code: "KWD" }, { code: "JPY" }] });
    const { result } = renderHook(() => useOpportunityCurrencyOptions(true));
    await waitFor(() => expect(result.current).toEqual(["KWD", "JPY"]));
    expect(readCoreData).toHaveBeenCalledWith(
      "/api/tenant/core/v1/currencies?status=ACTIVE&limit=100&sortBy=code&sortDir=ASC&page=1",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("loads subsequent pages rather than truncating the choices", async () => {
    auth.permissions = ["currencies.currency.read"];
    vi.mocked(readCoreData)
      .mockResolvedValueOnce(Array.from({ length: 100 }, () => ({ code: "KWD" })))
      .mockResolvedValueOnce([{ code: "JPY" }]);
    const { result } = renderHook(() => useOpportunityCurrencyOptions(true));
    await waitFor(() => expect(result.current).toEqual(["KWD", "JPY"]));
    expect(readCoreData).toHaveBeenCalledTimes(2);
  });

  it("does not require a currency read grant to create with the default", () => {
    const { result } = renderHook(() => useOpportunityCurrencyOptions(true));
    expect(result.current).toEqual([]);
    expect(readCoreData).not.toHaveBeenCalled();
  });

  it.each(["failed", "invalid"])(
    "provides no invented choices on a failed or invalid read",
    async (scenario) => {
      auth.permissions = ["currencies.currency.read"];
      vi.mocked(readCoreData).mockImplementation(async () => {
        if (scenario === "failed") throw new Error("Unavailable");
        return { items: [{ code: 42 }] };
      });
      const { result } = renderHook(() => useOpportunityCurrencyOptions(true));
      await act(async () => { await Promise.resolve(); });
      expect(readCoreData).toHaveBeenCalledOnce();
      expect(result.current).toEqual([]);
    },
  );
});
