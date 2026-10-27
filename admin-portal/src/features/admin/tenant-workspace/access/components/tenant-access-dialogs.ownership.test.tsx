// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { TransferOwnershipDialog } from "./tenant-access-dialogs";
import { tenantAccessCopy } from "../copy";
import { useOwnershipTransferCandidates } from "../use-ownership-transfer-candidates";
import type { TenantAccessController } from "../use-tenant-access";
import type { PageResult, TenantUserView } from "../types";
import { TENANT_ID, pageFixture, userFixture } from "../__tests__/fixtures";

const mocks = vi.hoisted(() => ({ listUsers: vi.fn() }));
vi.mock("../api", () => ({ tenantAccessApi: { listUsers: mocks.listUsers } }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en", dir: "ltr", t: { common: { close: "Close" } } }),
  useOptionalI18n: () => ({ lang: "en", dir: "ltr", t: { common: { close: "Close" } } }),
}));

const owner = userFixture({ isTenantOwner: true, email: "owner@example.test" });
const target = userFixture({
  id: "019ff251-1000-7000-8000-000000000099",
  firstName: "Zara",
  email: "zara@example.test",
});
const expectedQuery = {
  page: 1, limit: 20, status: "ACTIVE", visibility: "ACTIVE",
  sortBy: "email", sortDir: "ASC",
};

function makeController(overrides: Partial<TenantAccessController> = {}) {
  return {
    tenantId: TENANT_ID,
    enabled: true,
    ready: true,
    isAuthLoading: false,
    permissions: { canRead: true, canTransferOwnership: true },
    query: { page: 3, limit: 20, q: owner.email, status: "SUSPENDED", role: "directory-role", branchId: "directory-branch" },
    directory: { status: "ready", data: pageFixture([owner]), error: null },
    command: { pending: false, error: null },
    transferOwnership: vi.fn().mockResolvedValue(target),
    ...overrides,
  } as unknown as TenantAccessController;
}

function setup(locale: "en" | "ar" = "en", controller = makeController()) {
  const copy = tenantAccessCopy(locale);
  const onSuccess = vi.fn();
  const onClose = vi.fn();
  const view = render(
    <TransferOwnershipDialog controller={controller} copy={copy} locale={locale}
      user={owner} onClose={onClose} onSuccess={onSuccess} />,
  );
  return { ...view, controller, copy, onSuccess, onClose };
}

// Radix scrolls the focused option into view. jsdom has no layout scrolling;
// retain the real Select and Dialog handlers and supply only that missing API.
const scrollDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
beforeAll(() => {
  if (!scrollDescriptor) {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: () => {} });
  }
});
afterAll(() => {
  if (!scrollDescriptor) Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});

beforeEach(() => { mocks.listUsers.mockReset(); });
afterEach(cleanup);

describe.each(["en", "ar"] as const)("ownership candidates (%s)", (locale) => {
  it("selects a user beyond page one while the directory is filtered to the owner", async () => {
    const firstPage = [owner, ...Array.from({ length: 19 }, (_, index) =>
      userFixture({ id: `member-${index}`, email: `member-${index}@example.test` }),
    )];
    mocks.listUsers
      .mockResolvedValueOnce(pageFixture(firstPage, { total: 21, totalPages: 2, hasNext: true }))
      .mockResolvedValueOnce(pageFixture([target], { page: 2, total: 21, totalPages: 2, hasPrev: true }));
    const { copy, controller, onSuccess } = setup(locale);
    expect(screen.getByText(copy.transferCandidatesLoading)).toBeInTheDocument();
    expect(screen.queryByText(copy.transferOwnershipEmpty)).not.toBeInTheDocument();
    await screen.findByText(`${copy.page} 1 ${copy.of} 2`);
    expect(mocks.listUsers).toHaveBeenCalledWith(TENANT_ID, expectedQuery, expect.any(AbortSignal));
    fireEvent.click(screen.getByRole("button", { name: copy.next }));
    await screen.findByText(`${copy.page} 2 ${copy.of} 2`);
    fireEvent.click(screen.getByRole("combobox", { name: copy.newOwner }));
    const option = await screen.findByRole("option", { name: "Zara Ali · zara@example.test" });
    await act(async () => { fireEvent.click(option); });
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    expect(await screen.findByRole("combobox", { name: copy.newOwner })).toHaveTextContent("Zara Ali · zara@example.test");
    fireEvent.click(await screen.findByRole("button", { name: copy.transferOwnership }));
    await waitFor(() => expect(controller.transferOwnership).toHaveBeenCalledWith(owner, target.id));
    expect(onSuccess).toHaveBeenCalledWith(copy.transferOwnershipSucceeded);
    expect(controller.directory.data?.items).toEqual([owner]);
  });

  it("distinguishes loading, failed/retry and genuinely empty results", async () => {
    mocks.listUsers
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(pageFixture([owner]));
    const { copy } = setup(locale);
    expect(screen.getByText(copy.transferCandidatesLoading)).toBeInTheDocument();
    await screen.findByText(copy.transferCandidatesError);
    expect(screen.queryByText(copy.transferOwnershipEmpty)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: copy.transferOwnership })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: copy.retry }));
    await screen.findByText(copy.transferOwnershipEmpty);
    expect(screen.queryByText(copy.transferCandidatesError)).not.toBeInTheDocument();
  });
});

it("keeps paging available when a page has no eligible candidates", async () => {
  mocks.listUsers.mockResolvedValueOnce(pageFixture([
    owner,
    userFixture({ id: "inactive", status: "SUSPENDED" }),
    userFixture({ id: "deleted", deletedAt: "2026-10-18T00:00:00Z" }),
    userFixture({ id: "other-owner", isTenantOwner: true }),
  ], { total: 21, totalPages: 2, hasNext: true }));
  const { copy } = setup();
  await screen.findByText(copy.transferCandidatesPageEmpty);
  expect(screen.getByRole("button", { name: copy.next })).toBeEnabled();
  expect(screen.queryByRole("combobox", { name: copy.newOwner })).not.toBeInTheDocument();
  expect(screen.queryByText(copy.transferOwnershipEmpty)).not.toBeInTheDocument();
});

it("resets search to page one and preserves the selected destination label", async () => {
  mocks.listUsers
    .mockResolvedValueOnce(pageFixture([owner], { total: 21, totalPages: 2, hasNext: true }))
    .mockResolvedValueOnce(pageFixture([target], { page: 2, total: 21, totalPages: 2, hasPrev: true }))
    .mockResolvedValueOnce(pageFixture([]))
    .mockResolvedValueOnce(pageFixture([owner]));
  const { copy } = setup();
  await screen.findByText(copy.transferCandidatesPageEmpty);
  fireEvent.click(screen.getByRole("button", { name: copy.next }));
  await screen.findByText(`${copy.page} 2 ${copy.of} 2`);
  fireEvent.click(screen.getByRole("combobox", { name: copy.newOwner }));
  const option = await screen.findByRole("option", { name: "Zara Ali · zara@example.test" });
  await act(async () => { fireEvent.click(option); });
  await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
  expect(await screen.findByRole("combobox", { name: copy.newOwner })).toHaveTextContent("Zara Ali · zara@example.test");
  const search = await screen.findByRole("searchbox", { name: copy.transferCandidatesSearch });
  fireEvent.change(search, { target: { value: "  missing  " } });
  await screen.findByText(copy.transferCandidatesNoMatches);
  expect(mocks.listUsers).toHaveBeenLastCalledWith(TENANT_ID, { ...expectedQuery, q: "missing" }, expect.any(AbortSignal));
  expect(screen.getByRole("combobox", { name: copy.newOwner })).toHaveTextContent("Zara Ali · zara@example.test");
  expect(screen.getByText("Mona Ali · owner@example.test")).toBeInTheDocument();
  fireEvent.change(search, { target: { value: "" } });
  await screen.findByText(copy.transferOwnershipEmpty);
  expect(mocks.listUsers).toHaveBeenLastCalledWith(TENANT_ID, expectedQuery, expect.any(AbortSignal));
});

it.each(["canRead", "canTransferOwnership"] as const)("does not read candidates without %s", async (permission) => {
  const controller = makeController();
  controller.permissions[permission] = false;
  const { copy } = setup("en", controller);
  expect(screen.getByRole("alert")).toHaveTextContent(copy.transferCandidatesForbidden);
  expect(mocks.listUsers).not.toHaveBeenCalled();
});

it("treats a server 403 as forbidden instead of empty", async () => {
  mocks.listUsers.mockRejectedValueOnce({
    isNormalized: true, httpStatus: 403, errorCode: "FORBIDDEN", message: "Forbidden",
  });
  const { copy } = setup();
  await screen.findByText(copy.transferCandidatesForbidden);
  expect(screen.queryByText(copy.transferOwnershipEmpty)).not.toBeInTheDocument();
});

it("ignores superseded responses and aborts on dialog cleanup", async () => {
  let resolveOld!: (value: PageResult<TenantUserView>) => void;
  mocks.listUsers
    .mockImplementationOnce(() => new Promise<PageResult<TenantUserView>>((resolve) => { resolveOld = resolve; }))
    .mockResolvedValueOnce(pageFixture([target]));
  const controller = makeController();
  const { result, unmount } = renderHook(() => useOwnershipTransferCandidates(controller, owner.id));
  await waitFor(() => expect(mocks.listUsers).toHaveBeenCalledTimes(1));
  const oldSignal = mocks.listUsers.mock.calls[0][2] as AbortSignal;
  act(() => result.current.setSearch("zara"));
  await waitFor(() => expect(result.current.resource.data?.items).toEqual([target]));
  expect(oldSignal.aborted).toBe(true);
  await act(async () => resolveOld(pageFixture([])));
  expect(result.current.resource.data?.items).toEqual([target]);
  const latestSignal = mocks.listUsers.mock.calls[1][2] as AbortSignal;
  unmount();
  expect(latestSignal.aborted).toBe(true);
});
