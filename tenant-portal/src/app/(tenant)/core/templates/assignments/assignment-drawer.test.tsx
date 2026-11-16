// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/I18nContext";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { setLanguage } from "@/i18n/useLanguage";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { formatTemplate } from "@/lib/format/template";
import { SALES_QUOTATION_SELECTOR, type AssignmentScope, type AssignmentSelector } from "../template-assignments-contract";
import TemplateAssignmentsPage from "./page";
import publicationPins from "./sales-quotation-publication.fixture.json";

const io = vi.hoisted(() => {
  const companyId = "019f0000-0000-7000-8000-000000000001";
  const branches = ["019f0000-0000-7000-8000-000000000002", "019f0000-0000-7000-8000-000000000003"];
  const permissions = ["templates.read", "templates.assignments.manage"];
  const grant = { tenantWide: false, companyIds: [], branchIds: branches };
  const user = {
    id: "actor", permissions, permissionScopes: Object.fromEntries(permissions.map(key => [key, grant])),
    accessibleBranchCompanies: branches.map(branchId => ({ companyId, branchId })),
  };
  const listeners = new Set<() => void>();
  let profile = { user, sessionRevision: "session-1", sequence: 1 };
  return {
    companyId, branches, get: vi.fn(), post: vi.fn(), patch: vi.fn(), remove: vi.fn(), success: vi.fn(),
    auth: {
      user, authState: "AUTHENTICATED", readReadyProfileCommit: () => profile,
      subscribeProfileReadiness(listener: () => void) {
        listeners.add(listener);
        return () => { listeners.delete(listener); };
      },
      replaceAuthority() {
        profile = { ...profile, sequence: profile.sequence + 1 };
        listeners.forEach(listener => listener());
      },
    },
  };
});

vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => io.auth }));
vi.mock("@/hooks/useTenantOrganizationOptions", () => ({
  useTenantOrganizationOptions: (kind: string, ids: string[]) => ids.map(value => ({
    value, label: kind === "company" ? "Company A" : value === io.branches[0] ? "Branch A" : "Branch B",
  })),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/core/templates/assignments" }));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("sonner", () => ({ toast: { custom: io.success, dismiss: vi.fn() } }));
vi.mock("../../core-api", () => ({
  coreGetResponse: io.get, corePostResponse: io.post, corePatchResponse: io.patch, coreDelete: io.remove,
}));

const dictionaries = { en, ar };
const definitionId = "019f0000-0000-7000-8000-000000000004";
const versionId = "019f0000-0000-7000-8000-000000000005";
const latestId = "019f0000-0000-7000-8000-000000000006";
const assignmentId = "019f0000-0000-7000-8000-000000000007";
const now = "2026-11-13T12:00:00.000Z";
const paths = {
  templates: "/api/tenant/core/v1/templates",
  assignments: "/api/tenant/core/v1/templates/assignments",
  versions: `/api/tenant/core/v1/templates/${definitionId}/versions`,
};

function branch(branchId = io.branches[0]): AssignmentScope {
  return { type: "BRANCH", companyId: io.companyId, branchId };
}

function cursorPage(items: unknown[]) {
  return { status: 200, data: { success: true, data: {
    items, pageInfo: { limit: 25, hasNextPage: false, nextCursor: null },
  } } };
}

function definition(locale: string, name = "Sales Quotation") {
  return {
    templateId: definitionId, definitionScope: { type: "COMPANY", companyId: io.companyId }, locale,
    name, code: "QUOTATION", documentType: "QUOTATION", outputChannel: "PRINT",
    layoutMode: "FLOW_DOCUMENT", lifecycleStatus: "ACTIVE", direction: "AUTO",
    draft: { draftId: definitionId, revision: 1, validationState: "PASSED" },
    currentPublishedVersion: { versionId: latestId, versionNumber: 2, publishedAt: now },
    definitionRevision: 2, definitionEtag: '"2"', updatedAt: now,
  };
}

function versions(locale: string) {
  return cursorPage([versionId, latestId].map((templateVersionId, index) => ({
    templateDefinitionId: definitionId, templateVersionId, versionNumber: index + 1,
    documentType: "QUOTATION", outputChannel: "PRINT", layoutMode: "FLOW_DOCUMENT",
    lifecycleStatus: "PUBLISHED", publishedAt: now, locale,
    dataSourceKey: SALES_QUOTATION_SELECTOR.adapterKey, templateContentChecksum: "a".repeat(64),
  })));
}

function assignmentRow(locale: string, branchId = io.branches[0]) {
  return {
    ...SALES_QUOTATION_SELECTOR, assignmentId, definitionId, versionId, versionNumber: 1,
    locale, scope: branch(branchId), priority: 100, isDefault: false, effectiveFrom: now, effectiveTo: null,
    status: "ACTIVE", revision: 1, etag: '"1"',
  };
}

function receipt(row: ReturnType<typeof assignmentRow>, etag = row.etag, status = 201) {
  return { status, headers: new Headers({ ETag: etag }), data: { success: true, data: { assignment: row } } };
}

type PublicationPin = (typeof publicationPins)[number];

function publishedDefinition(pin: PublicationPin) {
  return {
    ...definition(pin.locale, pin.name), templateId: pin.templateId, code: pin.starterKey,
    direction: pin.locale === "ar-EG" ? "RTL" : "LTR", layoutMode: pin.layoutMode,
    currentPublishedVersion: { versionId: pin.templateVersionId, versionNumber: pin.versionNumber, publishedAt: pin.publishedAt },
  };
}

function publishedVersion(pin: PublicationPin) {
  return {
    ...SALES_QUOTATION_SELECTOR, templateDefinitionId: pin.templateId, templateVersionId: pin.templateVersionId,
    versionNumber: pin.versionNumber, locale: pin.locale, layoutMode: pin.layoutMode, publishedAt: pin.publishedAt,
    lifecycleStatus: "PUBLISHED", dataSourceKey: SALES_QUOTATION_SELECTOR.adapterKey, templateContentChecksum: pin.draftChecksum,
  };
}

function resolution(selector: AssignmentSelector, matchedScope: AssignmentScope, pin: PublicationPin) {
  return { status: 200, data: { success: true, data: {
    selector, evaluatedAt: now, eligibleCandidateCount: 1,
    chosen: { assignmentId, matchedScope, localeMatch: "EXACT", priority: 100, version: {
      definitionId: pin.templateId, versionId: pin.templateVersionId, versionNumber: pin.versionNumber,
      locale: pin.locale, documentType: selector.documentType, outputChannel: selector.outputChannel, dataSourceKey: selector.adapterKey,
    } },
  } } };
}

function deferred() {
  let resolve!: (reply: unknown) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function pick(label: string, option: string | RegExp, area: ReturnType<typeof within> = screen) {
  const trigger = await area.findByRole("combobox", { name: label });
  await waitFor(() => expect(trigger).toBeEnabled());
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("option", { name: option }));
}

async function openDrawer(lang: "en" | "ar", beforeOpen?: () => Promise<void>) {
  const t = dictionaries[lang];
  const copy = t.coreOperations.templates;
  await act(async () => { await setLanguage(lang); });
  render(<I18nProvider initialLanguage={lang}><TemplateAssignmentsPage /></I18nProvider>);
  await pick(t.coreIdentity.cascade.branch, "Branch A");
  await beforeOpen?.();
  fireEvent.click(await screen.findByRole("button", { name: copy.assignmentCreate }));
  return within(await screen.findByRole("dialog", { name: copy.assignmentCreateTitle }));
}

async function selectVersion(drawer: ReturnType<typeof within>, lang: "en" | "ar", pin?: PublicationPin) {
  const t = dictionaries[lang];
  const copy = t.coreOperations.templates;
  await pick(t.crmOutboundEmails.template, new RegExp(pin?.name ?? "Sales Quotation"), drawer);
  await pick(copy.assignmentVersion, formatTemplate(copy.versionLabel, { number: String(pin?.versionNumber ?? 1) }), drawer);
  fireEvent.change(drawer.getByLabelText(copy.assignmentEffectiveFrom, { exact: false }), {
    target: { value: "2026-11-13T12:00" },
  });
}

beforeEach(() => {
  io.get.mockReset();
  io.post.mockReset();
  io.patch.mockReset();
  io.remove.mockReset();
  io.success.mockReset();
});
afterEach(cleanup);
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
Element.prototype.scrollIntoView ??= () => {};

it.each(publicationPins)(
  "keeps the captured definition/version pair through a competing resolver and a bad receipt for $caseKey",
  async pin => {
    const { locale, templateId, templateVersionId, versionNumber } = pin;
    const lang = locale === "ar-EG" ? "ar" : "en";
    const t = dictionaries[lang];
    const copy = t.coreOperations.templates;
    const sameLocale = publicationPins.filter(candidate => candidate.locale === locale);
    const competing = sameLocale.find(candidate => candidate.templateId !== templateId)!;
    const row = { ...assignmentRow(locale), definitionId: templateId, versionId: templateVersionId, versionNumber };
    let persisted = false;
    io.get.mockImplementation((path: string) => {
      const url = new URL(path, "http://portal.test");
      if (url.pathname === paths.assignments) return cursorPage(persisted ? [row] : []);
      if (url.pathname === paths.templates) return cursorPage(sameLocale.map(publishedDefinition));
      const versionsPath = `${paths.templates}/${templateId}/versions`;
      if (url.pathname === versionsPath) return cursorPage([publishedVersion(pin)]);
      if (url.pathname === `${versionsPath}/${templateVersionId}`) {
        return { status: 200, data: { success: true, data: { ...publishedVersion(pin), editorDocument: {} } } };
      }
      throw new Error(`Unexpected test route: ${path}`);
    });
    io.post.mockImplementationOnce((path: string, selector: AssignmentSelector) => {
      expect(path).toBe(`${paths.assignments}/resolve`);
      expect(selector.scope).toEqual(branch());
      return resolution(selector, { type: "COMPANY", companyId: io.companyId }, competing);
    });
    const rejectedReceipts = [
      receipt({ ...row, definitionId: competing.templateId }),
      receipt({ ...row, versionId: competing.templateVersionId }),
      receipt({ ...row, versionNumber: versionNumber + 1 }),
      receipt(row, '"2"'),
    ];
    for (const rejected of rejectedReceipts) io.post.mockResolvedValueOnce(rejected);
    io.post.mockImplementationOnce(() => {
      persisted = true;
      return receipt(row);
    }).mockImplementationOnce((path: string, selector: AssignmentSelector) => {
      expect(path).toBe(`${paths.assignments}/resolve`);
      expect(selector.scope).toEqual(branch());
      return resolution(selector, branch(), pin);
    });
    const drawer = await openDrawer(lang, async () => {
      fireEvent.click(screen.getByRole("button", { name: copy.resolveRun }));
      expect(await screen.findByText(competing.templateVersionId)).toBeVisible();
    });
    await selectVersion(drawer, lang, pin);
    const save = drawer.getByRole("button", { name: t.common.save });
    expect(drawer.getByRole("combobox", { name: copy.assignmentVersion })).toHaveAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    expect(drawer.getByText(templateVersionId)).toHaveAttribute("dir", "ltr");
    for (let rejected = 0; rejected < rejectedReceipts.length; rejected += 1) {
      await act(async () => { fireEvent.click(save); });
      expect(io.post).toHaveBeenCalledTimes(rejected + 2);
      expect(await drawer.findByRole("alert")).toHaveTextContent(copy.assignmentSaveFailed);
      expect(drawer.getByText(templateVersionId)).toBeVisible();
      expect(io.success).not.toHaveBeenCalled();
    }
    fireEvent.click(save);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const table = await screen.findByRole("table");
    const refreshed = within((await within(table).findByText(templateVersionId)).closest("tr")!);
    expect(refreshed.getByText(templateId)).toBeVisible();
    expect(refreshed.queryByText(competing.templateVersionId)).not.toBeInTheDocument();
    expect(io.success).toHaveBeenCalledTimes(1);
    const commands = io.post.mock.calls.filter(([path]) => path === paths.assignments);
    expect(commands).toHaveLength(rejectedReceipts.length + 1);
    for (const [, body, options] of commands) {
      expect(body).toMatchObject({ versionId: templateVersionId, scope: branch(), locale });
      expect(options.headers).toEqual(commands[0]?.[2].headers);
    }
    fireEvent.click(screen.getByRole("button", { name: copy.resolveRun }));
    const resolved = within(await screen.findByRole("status"));
    expect(resolved.getByText(templateVersionId)).toBeVisible();
    expect(resolved.getByText(templateId)).toBeVisible();
    expect(resolved.getByText(copy.scopeTypes.BRANCH)).toBeVisible();
  },
  15_000,
);

it("rejects a wrong retarget version number, then accepts the exact update and an empty 204 deactivation", async () => {
  const t = en;
  const copy = t.coreOperations.templates;
  const previous = assignmentRow("en-US");
  const edited = { ...previous, versionId: latestId, versionNumber: 2, revision: 2, etag: '"2"' };
  let stored = previous;
  io.get.mockImplementation((path: string) =>
    path.startsWith(paths.versions) ? versions("en-US") : cursorPage([stored]));
  io.patch.mockResolvedValueOnce(receipt({ ...edited, versionNumber: 1 }, edited.etag, 200)).mockImplementationOnce(() => {
    stored = edited;
    return receipt(edited, edited.etag, 200);
  });
  io.remove.mockImplementationOnce(() => {
    stored = { ...edited, status: "INACTIVE", revision: 3, etag: '"3"' };
    return { status: 204, headers: new Headers(), data: null };
  });
  await act(async () => { await setLanguage("en"); });
  render(<I18nProvider initialLanguage="en"><TemplateAssignmentsPage /></I18nProvider>);
  await pick(t.coreIdentity.cascade.branch, "Branch A");
  fireEvent.click(await screen.findByRole("button", { name: `${copy.assignmentEditTitle}: 1` }));
  const drawer = within(await screen.findByRole("dialog", { name: copy.assignmentEditTitle }));
  await pick(copy.assignmentVersion, formatTemplate(copy.versionLabel, { number: "2" }), drawer);
  const save = drawer.getByRole("button", { name: t.common.save });
  fireEvent.click(save);
  expect(await drawer.findByRole("alert")).toHaveTextContent(copy.assignmentSaveFailed);
  expect(drawer.getByText(latestId)).toBeVisible();
  expect(io.success).not.toHaveBeenCalled();
  fireEvent.click(save);
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  const disable = await screen.findByRole("button", { name: `${copy.assignmentDeactivate}: 2` });
  expect(io.patch).toHaveBeenCalledTimes(2);
  expect(io.patch.mock.calls[0]?.[2].headers).toEqual(io.patch.mock.calls[1]?.[2].headers);
  expect(io.patch.mock.calls[0]?.[1]).toMatchObject({ versionId: latestId });
  fireEvent.click(disable);
  const confirm = within(await screen.findByRole("alertdialog", { name: copy.assignmentDeactivateTitle }));
  fireEvent.click(confirm.getByRole("button", { name: copy.assignmentDeactivate }));
  expect(await screen.findByText(copy.assignmentStatuses.INACTIVE)).toBeVisible();
  expect(screen.getByText(latestId)).toBeVisible();
  expect(io.remove).toHaveBeenCalledWith(`${paths.assignments}/${assignmentId}`, expect.objectContaining({
    headers: { "If-Match": '"2"', "x-idempotency-key": expect.stringMatching(/^[0-9a-f-]{36}$/u) },
  }));
  expect(io.success).toHaveBeenCalledTimes(2);
}, 15_000);

async function openDeactivation() {
  await act(async () => { await setLanguage("en"); });
  render(<I18nProvider initialLanguage="en"><TemplateAssignmentsPage /></I18nProvider>);
  await pick(en.coreIdentity.cascade.branch, "Branch A");
  const copy = en.coreOperations.templates;
  fireEvent.click(await screen.findByRole("button", { name: `${copy.assignmentDeactivate}: 1` }));
  const dialog = within(await screen.findByRole("alertdialog", { name: copy.assignmentDeactivateTitle }));
  await act(async () => { fireEvent.click(dialog.getByRole("button", { name: copy.assignmentDeactivate })); });
  return dialog;
}

const assignmentReadPath = `${paths.assignments}/${assignmentId}`;
function assignmentRead(row: ReturnType<typeof assignmentRow>) {
  return { status: 200, headers: new Headers({ ETag: row.etag }), data: { success: true, data: row } };
}
function deactivationReply(replayed = false) {
  return { status: 204, data: null, headers: new Headers(replayed ? { "Idempotency-Replayed": "true" } : {}) };
}
function staleDeactivation() {
  return new TenantApiClientError("Stale revision", {
    status: 409, statusText: "Conflict", headers: new Headers(),
    data: { errorCode: "CORE.TEMPLATE.CONCURRENCY.STALE_REVISION" },
  });
}

it.each(["replay", "readback", "stale response"] as const)(
  "recovers a lost deactivation through authoritative %s",
  async (evidence) => {
    const row = assignmentRow("en-US");
    const inactive = { ...row, status: "INACTIVE", revision: 2, etag: '"2"' };
    let stored = row;
    io.get.mockImplementation((path: string) =>
      path === assignmentReadPath ? assignmentRead(stored) : cursorPage([stored]));
    io.remove.mockImplementationOnce(() => {
      if (evidence === "readback") stored = inactive;
      throw new Error("Lost deactivation response");
    }).mockImplementationOnce(() => {
      stored = inactive;
      if (evidence === "stale response") throw staleDeactivation();
      return deactivationReply(true);
    });
    const dialog = await openDeactivation();
    expect(await dialog.findByText(en.coreOperations.templates.assignmentDeactivateUncertain)).toBeVisible();
    expect(io.success).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(dialog.getByRole("button", { name: en.common.retry })); });
    expect(await screen.findByText(en.coreOperations.templates.assignmentStatuses.INACTIVE)).toBeVisible();
    expect(io.success).toHaveBeenCalledTimes(1);
    expect(io.remove).toHaveBeenCalledTimes(evidence === "readback" ? 1 : 2);
    const [originalPath, originalOptions] = io.remove.mock.calls[0]!;
    expect(originalPath).toBe(assignmentReadPath);
    expect(originalOptions.headers).toEqual({ "If-Match": '"1"', "x-idempotency-key": expect.stringMatching(/^[0-9a-f-]{36}$/u) });
    if (evidence !== "readback") {
      expect(io.remove.mock.calls[1]?.[0]).toBe(originalPath);
      expect(io.remove.mock.calls[1]?.[1].headers).toEqual(originalOptions.headers);
    }
  }, 15_000,
);

it("shows a conflict for a changed pinned version and reloads without resending DELETE", async () => {
  const row = assignmentRow("en-US");
  let stored = row;
  io.get.mockImplementation((path: string) =>
    path === assignmentReadPath ? assignmentRead(stored) : cursorPage([stored]));
  io.remove.mockRejectedValueOnce(new Error("Lost deactivation response"));
  const dialog = await openDeactivation();
  const copy = en.coreOperations.templates;
  await dialog.findByText(copy.assignmentDeactivateUncertain);
  stored = { ...row, versionId: latestId, versionNumber: 2, revision: 2, etag: '"2"' };
  await act(async () => { fireEvent.click(dialog.getByRole("button", { name: en.common.retry })); });
  expect(await dialog.findByText(copy.assignmentDeactivateConflict)).toBeVisible();
  expect(io.remove).toHaveBeenCalledTimes(1);
  expect(io.success).not.toHaveBeenCalled();
  await act(async () => { fireEvent.click(dialog.getByRole("button", { name: copy.conflictReload })); });
  expect(await screen.findByText(latestId)).toBeVisible();
  expect(io.remove).toHaveBeenCalledTimes(1);
}, 15_000);

it("requires readback when retry returns 204 without a replay marker", async () => {
  const row = assignmentRow("en-US");
  let stored = row;
  io.get.mockImplementation((path: string) =>
    path === assignmentReadPath ? assignmentRead(stored) : cursorPage([stored]));
  io.remove.mockRejectedValueOnce(new Error("Lost deactivation response")).mockResolvedValueOnce(deactivationReply());
  const dialog = await openDeactivation();
  const copy = en.coreOperations.templates;
  await dialog.findByText(copy.assignmentDeactivateUncertain);
  await act(async () => { fireEvent.click(dialog.getByRole("button", { name: en.common.retry })); });
  expect(await dialog.findByText(copy.assignmentDeactivateCheck)).toBeVisible();
  expect(io.success).not.toHaveBeenCalled();
  expect(io.get.mock.calls.filter(([path]) => path === assignmentReadPath)).toHaveLength(2);
  stored = { ...row, status: "INACTIVE", revision: 2, etag: '"2"' };
  await act(async () => { fireEvent.click(dialog.getByRole("button", { name: copy.assignmentCheckStatus })); });
  expect(await screen.findByText(copy.assignmentStatuses.INACTIVE)).toBeVisible();
  expect(io.remove).toHaveBeenCalledTimes(2);
  expect(io.success).toHaveBeenCalledTimes(1);
}, 15_000);

it.each(["session", "scope"] as const)("retires a late deactivation replay after a %s change", async (change) => {
  const late = deferred();
  const row = assignmentRow("en-US");
  io.get.mockImplementation((path: string) => {
    if (path === assignmentReadPath) return assignmentRead(row);
    const branchId = new URL(path, "http://portal.test").searchParams.get("branchId");
    return cursorPage(branchId === io.branches[0] ? [row] : []);
  });
  io.remove.mockRejectedValueOnce(new Error("Lost deactivation response")).mockReturnValueOnce(late.promise);
  const dialog = await openDeactivation();
  await dialog.findByText(en.coreOperations.templates.assignmentDeactivateUncertain);
  fireEvent.click(dialog.getByRole("button", { name: en.common.retry }));
  await waitFor(() => expect(io.remove).toHaveBeenCalledTimes(2));
  const request = io.remove.mock.calls[1]?.[1];
  if (change === "session") act(() => io.auth.replaceAuthority());
  else {
    const trigger = screen.getByRole("combobox", { name: en.coreIdentity.cascade.branch, hidden: true });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: "Branch B", hidden: true }));
  }
  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  expect(() => request.assertCurrent()).toThrow(/request retired/i);
  await act(async () => { late.resolve(deactivationReply(true)); });
  expect(io.success).not.toHaveBeenCalled();
  expect(io.remove).toHaveBeenCalledTimes(2);
}, 15_000);

it("discards a late list result when the branch changes and is revisited", async () => {
  const oldList = deferred();
  const currentList = deferred();
  const t = en;
  const copy = t.coreOperations.templates;
  io.get.mockReturnValueOnce(oldList.promise).mockResolvedValueOnce(cursorPage([])).mockReturnValueOnce(currentList.promise);
  await act(async () => { await setLanguage("en"); });
  render(<I18nProvider initialLanguage="en"><TemplateAssignmentsPage /></I18nProvider>);
  await pick(t.coreIdentity.cascade.branch, "Branch A");
  await waitFor(() => expect(io.get).toHaveBeenCalledTimes(1));
  const oldRequest = io.get.mock.calls[0]?.[1];
  await pick(t.coreIdentity.cascade.branch, "Branch B");
  await screen.findByRole("button", { name: copy.assignmentCreate });
  await pick(t.coreIdentity.cascade.branch, "Branch A");
  await waitFor(() => expect(io.get).toHaveBeenCalledTimes(3));
  expect(oldRequest.signal.aborted).toBe(true);
  expect(() => oldRequest.assertCurrent()).toThrow(/request retired/i);
  await act(async () => { oldList.resolve(cursorPage([assignmentRow("en-US")])); });
  expect(screen.queryByText(versionId)).not.toBeInTheDocument();
  await act(async () => { currentList.resolve(cursorPage([assignmentRow("en-US")])); });
  expect(await screen.findByText(versionId)).toBeVisible();
});

it("discards a retired locale error while showing the current catalogue", async () => {
  const oldCatalogue = deferred();
  io.get.mockResolvedValueOnce(cursorPage([])).mockReturnValueOnce(oldCatalogue.promise)
    .mockResolvedValueOnce(cursorPage([definition("ar-EG")]));
  const drawer = await openDrawer("en");
  await waitFor(() => expect(io.get).toHaveBeenCalledTimes(2));
  const oldRequest = io.get.mock.calls[1]?.[1];
  const copy = en.coreOperations.templates;
  await pick(copy.locale, copy.locales["ar-EG"], drawer);
  await waitFor(() => expect(drawer.getByRole("combobox", { name: en.crmOutboundEmails.template })).toBeEnabled());
  expect(oldRequest.signal.aborted).toBe(true);
  expect(() => oldRequest.assertCurrent()).toThrow(/request retired/i);
  await act(async () => { oldCatalogue.reject(new Error("late catalogue failure")); });
  expect(drawer.queryByText(copy.loadFailed)).not.toBeInTheDocument();
  await pick(en.crmOutboundEmails.template, /Sales Quotation/, drawer);
});

it("ignores an old resolver result after switching branches", async () => {
  const oldResolution = deferred();
  const currentResolution = deferred();
  const copy = en.coreOperations.templates;
  io.get.mockResolvedValue(cursorPage([]));
  io.post.mockReturnValueOnce(oldResolution.promise).mockReturnValueOnce(currentResolution.promise);
  await act(async () => { await setLanguage("en"); });
  render(<I18nProvider initialLanguage="en"><TemplateAssignmentsPage /></I18nProvider>);
  await pick(en.coreIdentity.cascade.branch, "Branch A");
  fireEvent.click(screen.getByRole("button", { name: copy.resolveRun }));
  const [, selector, request] = io.post.mock.calls[0]!;
  await pick(en.coreIdentity.cascade.branch, "Branch B");
  fireEvent.click(screen.getByRole("button", { name: copy.resolveRun }));
  const [, activeSelector] = io.post.mock.calls[1]!;
  expect(selector.scope).toEqual(branch());
  expect(activeSelector.scope).toEqual(branch(io.branches[1]));
  expect(request.signal.aborted).toBe(true);
  expect(() => request.assertCurrent()).toThrow(/request retired/i);
  const response = (requested: typeof selector, selectedVersion: string) => ({
    status: 200, data: { success: true, data: { selector: requested, evaluatedAt: now, eligibleCandidateCount: 1,
      chosen: { assignmentId, matchedScope: requested.scope, localeMatch: "EXACT", priority: 100, version: {
        definitionId, versionId: selectedVersion, versionNumber: 1, locale: requested.locale,
        documentType: requested.documentType, outputChannel: requested.outputChannel, dataSourceKey: requested.adapterKey,
      } },
    } },
  });
  await act(async () => { oldResolution.resolve(response(selector, versionId)); });
  expect(screen.queryByText(versionId)).not.toBeInTheDocument();
  await act(async () => { currentResolution.resolve(response(activeSelector, latestId)); });
  expect(await screen.findByText(latestId)).toBeVisible();
});

it("retires an in-flight save when the drawer loses its authenticated scope", async () => {
  const late = deferred();
  io.get.mockResolvedValueOnce(cursorPage([])).mockResolvedValueOnce(cursorPage([definition("en-US")]))
    .mockResolvedValueOnce(versions("en-US")).mockResolvedValue(cursorPage([]));
  io.post.mockReturnValueOnce(late.promise);
  const drawer = await openDrawer("en");
  await selectVersion(drawer, "en");
  fireEvent.click(drawer.getByRole("button", { name: en.common.save }));
  await waitFor(() => expect(io.post).toHaveBeenCalledTimes(1));
  const request = io.post.mock.calls[0]?.[2];
  act(() => io.auth.replaceAuthority());
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(() => request.assertCurrent()).toThrow(/request retired/i);
  await act(async () => { late.resolve(receipt(assignmentRow("en-US"))); });
  expect(io.success).not.toHaveBeenCalled();
  expect(screen.queryByText(versionId)).not.toBeInTheDocument();
  expect(io.get).toHaveBeenCalledTimes(3);
});
