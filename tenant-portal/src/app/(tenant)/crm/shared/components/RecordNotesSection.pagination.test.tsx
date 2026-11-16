// @vitest-environment jsdom

import type { ButtonHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { useCrmNotes } from "../hooks/useCrmNotes";
import { RecordNotesSection } from "./RecordNotesSection";

const mocks = vi.hoisted(() => ({ get: vi.fn(), write: vi.fn() }));
vi.mock("@/lib/api/axiosClient", () => ({ axiosClient: { get: mocks.get } }));
vi.mock("@/lib/api/errors", () => ({
  normalizeApiError: () => ({ status: 0 }),
}));
vi.mock("@/lib/api/idempotent-write", () => ({
  createWriteAttempt: () => ({ idempotencyKey: "attempt" }),
  expectNoContent: () => undefined,
  runIdempotentWrite: mocks.write,
}));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("../hooks/useCrmErrorText", () => ({ useCrmErrorText: () => () => null }));
vi.mock("../hooks/useAmbiguousOutcomeLabels", () => ({
  useAmbiguousOutcomeLabels: () => ({}), useAppliedUnreadableLabels: () => ({}),
}));
vi.mock("./CrmScopeGate", () => ({ CrmScopeGate: () => <div>Forbidden</div> }));
vi.mock("./NoteRow", () => ({ NoteRow: ({ note }: { note: { body: string } }) => <li>{note.body}</li> }));
vi.mock("@/design-system", () => ({
  PermissionGate: ({ children }: { children: ReactNode }) => <>{children}</>,
  DetailSection: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  Button: ({ children, variant: _variant, size: _size, ...props }:
    ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => <button {...props}>{children}</button>,
  Textarea: (props: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
  DateTime: () => null, AmbiguousOutcomePanel: () => null,
  EmptyState: () => null, ErrorState: () => <div>Load failed</div>, Skeleton: () => null,
}));

const branchId = "01900000-0000-7000-8000-000000000001";
const sourceId = "01900000-0000-7000-8000-000000000002";
const source = { branchId, sourceId, sourceType: "LEAD" as const };
function note(index: number, recordId = sourceId) {
  return {
    id: `01900000-0000-7000-8000-${String(index + 100).padStart(12, "0")}`,
    branchId, sourceType: "LEAD", sourceId: recordId, body: `Note ${index}`,
    createdByUserId: null, canEdit: false, canDelete: false,
    createdAt: "2026-10-30T00:00:00Z", updatedAt: "2026-10-30T00:00:00Z",
  };
}
function page(number: number, indices: number[], recordId = sourceId) {
  return { data: {
    items: indices.map((index) => note(index, recordId)), total: 60,
    page: number, limit: 25, totalPages: 3, hasNext: number < 3, hasPrev: number > 1,
  } };
}
const range = (start: number, count: number) => Array.from({ length: count }, (_, i) => start + i);

beforeEach(() => {
  mocks.get.mockReset();
  mocks.write.mockReset().mockResolvedValue({ kind: "success" });
});
afterEach(cleanup);

describe("record notes pagination", () => {
  it("shows 25 of 60, appends pages, deduplicates IDs and resets after create", async () => {
    mocks.get.mockImplementation(async (path: string) => {
      const number = Number(new URL(path, "http://test").searchParams.get("page"));
      return page(number, number === 1 ? range(1, 25) : number === 2 ? range(26, 25) : [50, ...range(51, 10)]);
    });
    render(<RecordNotesSection {...source} sourceOwnerUserId={null}
      createCapability={{ scope: "all", ownerUserIds: null }} />);
    await screen.findByText("Showing 25 of 60");
    expect(screen.getAllByRole("listitem")).toHaveLength(25);
    fireEvent.click(screen.getByRole("button", { name: en.crmNotes.loadMore }));
    await screen.findByText("Showing 50 of 60");
    expect(screen.getAllByRole("listitem")).toHaveLength(50);
    fireEvent.click(screen.getByRole("button", { name: en.crmNotes.loadMore }));
    await screen.findByText("Showing 60 of 60");
    expect(screen.getAllByRole("listitem")).toHaveLength(60);
    expect(screen.queryByRole("button", { name: en.crmNotes.loadMore })).toBeNull();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "New note" } });
    fireEvent.click(screen.getByRole("button", { name: en.crmNotes.add }));
    await screen.findByText("Showing 25 of 60");
    expect(screen.getAllByRole("listitem")).toHaveLength(25);
    expect(mocks.get.mock.calls.map(([path]) => new URL(path, "http://test").searchParams.get("page")))
      .toEqual(["1", "2", "3", "1"]);
  });

  it.each(["update", "delete"] as const)("resets after %s", async (operation) => {
    mocks.get.mockResolvedValueOnce(page(1, range(1, 25)))
      .mockResolvedValueOnce(page(2, range(26, 25)))
      .mockResolvedValueOnce(page(1, range(1, 25)));
    const { result } = renderHook(() => useCrmNotes(source));
    await waitFor(() => expect(result.current.notes).toHaveLength(25));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.notes).toHaveLength(50));
    await act(async () => {
      if (operation === "update") await result.current.update(note(1).id, "Edited");
      else await result.current.remove(note(1).id);
    });
    expect(result.current.notes).toHaveLength(25);
    expect(mocks.get.mock.calls[2][0]).toContain("page=1");
  });

  it("retains loaded notes after a page failure and retries the same page", async () => {
    mocks.get.mockResolvedValueOnce(page(1, range(1, 25)))
      .mockRejectedValueOnce(new Error("Unavailable"))
      .mockResolvedValueOnce(page(2, range(26, 25)));
    const { result } = renderHook(() => useCrmNotes(source));
    await waitFor(() => expect(result.current.notes).toHaveLength(25));
    act(() => { result.current.loadMore(); result.current.loadMore(); });
    await waitFor(() => expect(result.current.loadError).not.toBeNull());
    expect(result.current.notes).toHaveLength(25);
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.notes).toHaveLength(50));
    expect(mocks.get.mock.calls.slice(1).map(([path]) => new URL(path, "http://test").searchParams.get("page")))
      .toEqual(["2", "2"]);
  });

  it("aborts a pending next page and ignores its late response after switching records", async () => {
    let finish: (value: ReturnType<typeof page>) => void = () => undefined;
    const pending = new Promise<ReturnType<typeof page>>((resolve) => { finish = resolve; });
    const otherId = "01900000-0000-7000-8000-000000000003";
    mocks.get.mockResolvedValueOnce(page(1, range(1, 25)))
      .mockReturnValueOnce(pending).mockResolvedValueOnce(page(1, [90], otherId));
    const { result, rerender } = renderHook(({ id }) => useCrmNotes({ ...source, sourceId: id }),
      { initialProps: { id: sourceId } });
    await waitFor(() => expect(result.current.notes).toHaveLength(25));
    act(() => result.current.loadMore());
    const signal = mocks.get.mock.calls[1][1].signal as AbortSignal;
    rerender({ id: otherId });
    await waitFor(() => expect(result.current.notes[0]?.body).toBe("Note 90"));
    expect(signal.aborted).toBe(true);
    await act(async () => { finish(page(2, range(26, 25))); await pending; });
    expect(result.current.notes.map((item) => item.body)).toEqual(["Note 90"]);
  });

  it("has matching Arabic and English pagination keys and placeholders", () => {
    for (const dictionary of [ar, en]) {
      expect(dictionary.crmNotes.loadMore).toBeTruthy();
      expect(dictionary.crmNotes.loadingMore).toBeTruthy();
      expect(dictionary.crmNotes.showing).toContain("{shown}");
      expect(dictionary.crmNotes.showing).toContain("{total}");
    }
  });
});
