// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { runIdempotentWrite } from "@/lib/api/idempotent-write";
import type { LeadDetail } from "../../lead-contract";
import { useLeadCardEdit } from "./useLeadCardEdit";

const { warning } = vi.hoisted(() => ({ warning: vi.fn() }));
vi.mock("@/design-system", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/design-system")>()),
  useToast: () => ({ warning }),
}));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en }) }));
vi.mock("@/lib/api/idempotent-write", () => ({ createWriteAttempt: vi.fn(() => ({})), runIdempotentWrite: vi.fn() }));

const lead = { id: "01900100-0000-7000-8000-000000000001", updatedAt: "2026-10-26T10:00:00.123Z" } as LeadDetail;

describe("useLeadCardEdit", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([{ status: 409 }, { status: 422, code: "CRM.LEAD.CONCURRENT_UPDATE" }])("reconciles a conflict before the next card save: %j", async (error) => {
    const onSaved = vi.fn();
    const onReconcile = vi.fn();
    const { result, rerender } = renderHook(({ subject }) => useLeadCardEdit(subject, true, onSaved, onReconcile), { initialProps: { subject: lead } });
    vi.mocked(runIdempotentWrite).mockResolvedValueOnce({ kind: "failed", error });
    await act(() => result.current.save({ rating: 3 }));
    expect(warning).toHaveBeenCalledExactlyOnceWith(en.crmShared.refusals["CRM.LEAD.CONCURRENT_UPDATE"], undefined, 0, { label: en.crmLeadDetail.reloadLead, onClick: onReconcile });
    expect(warning.mock.invocationCallOrder[0]).toBeLessThan(onReconcile.mock.invocationCallOrder[0]);
    expect(onReconcile).toHaveBeenCalledOnce();
    expect(result.current.error).toEqual(error);
    expect(onSaved).not.toHaveBeenCalled();
    await act(() => result.current.save({ rating: 2 }));
    expect(runIdempotentWrite).toHaveBeenCalledOnce();
    const refreshed = { ...lead, updatedAt: "2026-10-26T10:01:00.123Z" };
    rerender({ subject: refreshed });
    const card = { rating: 2, cardColor: null };
    vi.mocked(runIdempotentWrite).mockResolvedValueOnce({ kind: "success", value: { lead: refreshed, card }, replayed: false });
    await act(() => result.current.save({ rating: 2 }));
    expect(runIdempotentWrite).toHaveBeenLastCalledWith(expect.objectContaining({ body: { rating: 2, expectedUpdatedAt: refreshed.updatedAt } }));
    expect(onSaved).toHaveBeenCalledWith(refreshed, card);
  });
});
