// @vitest-environment jsdom
import { createHash } from "node:crypto";
import { createElement, type ReactNode } from "react";
import { TemplateReleasePanel } from "../components/TemplateReleasePanel";
import { TemplateDetailWorkspace } from "../components/template-detail-workspace";
import { canonicalJson, resolveTemplateTextDirection } from "@mutakamel/template-schema/browser-safe";
import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TenantProfileCommit } from "@/context/AuthContext";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { subscribePermissionDenials, TenantApiClientError } from "@/lib/api/axiosClient";
import { SALES_PUBLISH_RECOVERY_PREFIX } from "@/lib/safeStorage";
import { isUUIDv7 } from "@/lib/uuid";
import { STALE_REVISION_CODE } from "../../template-lifecycle-contract";
import type { TemplateValidationRun, TemplateVersion } from "../../template-lifecycle-contract";
import type { TemplateDetail } from "../../templates-contract";
import type { TemplateGrants } from "./useTemplateDetail";
import type { VersionAuthority } from "./useTemplateVersionAuthority";
import { useTemplateRelease } from "./useTemplateRelease";

const { io, toast } = vi.hoisted(() => ({
  io: { versions: vi.fn(), view: vi.fn(), validate: vi.fn(), validateGeneric: vi.fn(), post: vi.fn(), publish: vi.fn(), restore: vi.fn(), detail: vi.fn(), panel: vi.fn() },
  toast: { success: vi.fn(), info: vi.fn(), errorFromApi: vi.fn(), outcomeFromApi: vi.fn() },
}));
vi.mock("../../../core-api", async importOriginal => ({
  ...await importOriginal<typeof import("../../../core-api")>(),
  corePostResponse: (path: string, body: unknown, config: unknown) =>
    path.endsWith("/validate") ? io.validate(path, body, config) : io.post(path, body, config),
}));
let arabicFeedback = false;
let schemaControlProbe = false;
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: arabicFeedback ? ar : en }) }));
vi.mock("@/design-system", () => {
  const Empty = () => null;
  const Section = ({ children, action }: { children?: ReactNode; action?: ReactNode }) =>
    schemaControlProbe ? createElement("section", null, action, children) : children ?? null;
  const ProbeButton = ({ children, onClick, disabled, loading }: {
    children?: ReactNode; onClick?: () => void; disabled?: boolean; loading?: boolean;
  }) => schemaControlProbe ? createElement("button", { onClick, disabled: disabled || loading }, children) : null;
  const ProbeBadge = ({children}: {children?: ReactNode}) => schemaControlProbe ? createElement("span", null, children) : null;
  return {
    useToast: () => toast, Badge: ProbeBadge, Button: ProbeButton, Field: Section, Input: Empty, ConflictDialog: Empty, DegradedBanner: Empty,
    DetailHeader: Empty, DetailSection: Section, ErrorState: Empty, IdentifierText: ProbeBadge,
    NotFoundState: Empty, PermissionGate: Section, Skeleton: Empty, UnavailableState: Empty,
  };
});
vi.mock("./useTemplateDetail", () => ({ useTemplateDetail: io.detail }));
vi.mock("./useTemplatePreview", () => ({ useTemplatePreview: () => null }));
vi.mock("./useTemplateRecovery", () => ({ useTemplateRecovery: () => null }));
vi.mock("./useDraftPdfRecovery", () => ({ useDraftPdfRecovery: () => null }));
vi.mock("../feedback/published-preview-focus", () => ({ usePublishedPreviewReturnFocus: () => {} }));
vi.mock("../../../hooks/useCoreOperationsErrorText", () => ({ useCoreOperationsErrorText: () => () => "" }));
vi.mock("@/components/audit/RecordHistoryTab", () => ({ RecordHistoryTab: () => null }));
vi.mock("../components/EditTemplateDrawer", () => ({ EditTemplateDrawer: () => null }));
vi.mock("../components/TemplatePreviewPanel", () => ({ TemplatePreviewPanel: () => null }));
vi.mock("../components/TemplateDetailPdfPort", () => ({ TemplateDetailPdfPort: () => null }));
vi.mock("../components/TemplateRecoveryPanel", () => ({ TemplateRecoveryPanel: () => null }));
vi.mock("../components/TemplateVersionsPanel", () => ({ TemplateVersionsPanel: () => null }));
vi.mock("../components/TemplateReleasePanel", async importOriginal => {
  const actual = await importOriginal<typeof import("../components/TemplateReleasePanel")>();
  return {TemplateReleasePanel: (props: Parameters<typeof actual.TemplateReleasePanel>[0]) => {
    if (schemaControlProbe) return createElement(actual.TemplateReleasePanel, props);
    io.panel(props.release);
    return null;
  }};
});

const profile = { sessionRevision: "inert-release-test", sequence: 1 } as TenantProfileCommit;
let readyProfile: TenantProfileCommit | null = profile;
let localSession: string | null = null;
const profileListeners = new Set<() => void>();
const readReadyProfileCommit = () => readyProfile;
const subscribeProfileReadiness = (listener: () => void) => {
  profileListeners.add(listener);
  return () => { profileListeners.delete(listener); };
};
vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({
    readReadyProfileCommit, subscribeProfileReadiness, user: readyProfile?.user,
    authState: localSession ? "AUTHENTICATED" : undefined,
    realtimeAuthGeneration: localSession && readyProfile?.user ? `tenant:${localSession}:${readyProfile.user.id}` : null,
  }),
}));
vi.mock("../../template-lifecycle-api", () => ({
  fetchTemplateVersions: io.versions,
  fetchTemplateVersion: io.view,
  publishTemplate: io.publish,
  restoreTemplateVersion: io.restore,
  retireTemplateVersion: vi.fn(),
  validateTemplateDraft: io.validateGeneric,
}));

const TEMPLATE_ID = "01900100-0000-7000-8000-000000000001";
const DRAFT_ID = "01900100-0000-7000-8000-000000000002";
const RUN_ID = "01900100-0000-7000-8000-000000000003";
const VERSION_ID = "01900100-0000-7000-8000-000000000004";
const OTHER_VERSION_ID = "01900100-0000-7000-8000-000000000005";
const grants: TemplateGrants = {
  canRead: true, canUpdate: true, canPublish: true, canArchive: true,
  canRestore: true, canPreview: true, canManageAssets: true, canManageAssignments: true,
};

function detail(definitionRevision = 1, draftRevision = 1): TemplateDetail {
  const draft = { draftId: DRAFT_ID, revision: draftRevision, validationState: "PASSED" as const };
  return {
    id: TEMPLATE_ID, code: "QUOTE", name: "Quotation", description: null,
    documentType: "QUOTATION", outputChannel: "PRINT", layoutMode: "HYBRID_DOCUMENT",
    lifecycleStatus: "ACTIVE", locale: "en-US", direction: "LTR",
    dataSourceKey: "TRADE_QUOTATION_PRINT_V1", scope: { type: "TENANT" },
    systemProtected: false, definitionRevision,
    definitionEtag: `"${definitionRevision}"`, etag: `"${definitionRevision}"`,
    draft, currentDraft: { ...draft, contentChecksum: "a".repeat(64), etag: `"${draftRevision}"` },
    currentPublishedVersion: null,
    createdAt: "2026-10-17T00:00:00.000Z", updatedAt: "2026-10-17T00:00:00.000Z",
  };
}

function validationRun(draftRevision: number): TemplateValidationRun {
  return {
    id: RUN_ID, draftId: DRAFT_ID, draftRevision, status: "PASSED",
    rendererTargets: ["HTML", "PDF"], issues: [], completedAt: "2026-10-17T00:00:00.000Z",
  };
}

function validationResponse(template: TemplateDetail, run = validationRun(template.currentDraft.revision)) {
  const origin = "http://tenant.example.test:5002";
  const endpoint = `/api/tenant/core/v1/templates/${template.id}/validate`;
  const { id, ...result } = run;
  return {
    status: 200, provenance: "http", headers: new Headers(),
    request: { origin, method: "POST", endpoint, finalUrl: `${origin}${endpoint}`, redirected: false },
    data: { success: true, data: {
      ...result, validationRunId: id, templateId: template.id,
      candidateChecksum: template.currentDraft.contentChecksum, dataSourceKey: template.dataSourceKey,
    } },
  };
}

function mockValidation(template: TemplateDetail, run?: TemplateValidationRun) {
  io.validate.mockResolvedValue(validationResponse(template, run));
}

type SavedSalesDraft = Pick<TemplateDetail, "code" | "locale" | "layoutMode" | "definitionRevision"> & {
  caseKey: string;
  templateId: string;
  draftId: string;
  draftRevision: number;
  draftChecksum: string;
  priorValidation: { validationRunId: string } | null;
};

// The acceptance runner can supply its offline plan without adding private receipts to the test checkout.
const acceptancePlan = process.env.SALES_QUOTATION_ACCEPTANCE_PLAN;
const savedSalesDrafts: SavedSalesDraft[] = acceptancePlan
  ? (JSON.parse(acceptancePlan) as { drafts: SavedSalesDraft[] }).drafts
  : [{
    caseKey: "saved Sales draft", templateId: TEMPLATE_ID, draftId: DRAFT_ID, code: "QUOTE",
    locale: "en-US", layoutMode: "HYBRID_DOCUMENT", definitionRevision: 4,
    draftRevision: 7, draftChecksum: "a".repeat(64), priorValidation: null,
  }];

const previousRow: TemplateVersion = {
  id: OTHER_VERSION_ID, versionNumber: 1, lifecycleStatus: "PUBLISHED", locale: "en-US",
  publishedAt: "2026-10-17T00:00:00.000Z", retiredAt: null, changeNote: null,
  templateContentChecksum: "a".repeat(64), dataSourceKey: "TRADE_QUOTATION_PRINT_V1",
  compilerVersion: null, validationRunId: null, rendererTargets: [],
};
const versionSummary = (row: TemplateVersion) => ({
  versionId: row.id, versionNumber: row.versionNumber, publishedAt: row.publishedAt,
});
const versionPage = (items: TemplateVersion[], nextCursor: string | null = null) => ({
  items, nextCursor, hasNextPage: nextCursor !== null, limit: 25, totalCount: null,
});

function versionAuthority(key: string): VersionAuthority {
  return { key, scope: { headers: {}, locale: "en-US" }, isCurrent: () => true, onRetire: () => () => {} };
}

const publishPath = `/api/tenant/core/v1/templates/${TEMPLATE_ID}/publish`;
const publishOptions = (template: TemplateDetail) => expect.objectContaining({
  headers: { "If-Match": template.currentDraft.etag, "x-idempotency-key": expect.any(String) },
  assertCurrent: expect.any(Function), nonReplayable: true, requireExactResponseTarget: true, redirect: "error",
});

function publication(
  template: TemplateDetail,
  direction: "LTR" | "RTL" | "AUTO" = "LTR",
  changeNote: string | null = null,
) {
  const { documentType, outputChannel, layoutMode, locale, dataSourceKey } = template;
  const editorDocument = { schemaVersion: 1, documentType, outputChannel, layoutMode, locale, dataSourceKey, direction };
  const checksum = createHash("sha256").update(canonicalJson(editorDocument), "utf8").digest("hex");
  const draft: TemplateDetail = { ...template, direction, currentDraft: { ...template.currentDraft, contentChecksum: checksum } };
  const row: TemplateVersion = { ...previousRow, id: VERSION_ID, versionNumber: 2, templateContentChecksum: checksum, changeNote };
  const version = {
    templateDefinitionId: template.id, templateVersionId: row.id, versionNumber: row.versionNumber,
    lifecycleStatus: row.lifecycleStatus, publishedAt: row.publishedAt, retiredAt: row.retiredAt, changeNote: row.changeNote,
    documentType, outputChannel, layoutMode, locale, dataSourceKey, direction: resolveTemplateTextDirection(direction, locale),
    editorDocument, editorSchemaVersion: 1, templateContentChecksum: checksum,
    compilerVersion: "template-engine-v1", validationRunId: RUN_ID, rendererTargets: ["HTML", "PDF"],
  };
  const origin = "http://tenant.example.test:5002";
  const definitionRevision = template.definitionRevision + 1;
  const definitionEtag = `"${definitionRevision}"`;
  const response = {
    status: 201, provenance: "http", headers: new Headers({
      etag: definitionEtag,
      location: `/api/tenant/core/v1/templates/${template.id}/versions/${row.id}`,
    }),
    request: { origin, method: "POST", endpoint: publishPath, finalUrl: `${origin}${publishPath}`, redirected: false },
    data: { success: true, data: {
      version, definitionRevision, definitionEtag, consumedDraftRevision: template.currentDraft.revision,
      draftEtag: `"${template.currentDraft.revision + 1}"`,
    } },
  };
  return {
    template: draft,
    row,
    versionDetail: { ...row, compilerVersion: version.compilerVersion, validationRunId: RUN_ID, rendererTargets: version.rendererTargets },
    response,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  arabicFeedback = false;
  readyProfile = profile;
  io.versions.mockResolvedValue(versionPage([]));
  io.publish.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  if (localSession) sessionStorage.clear();
  localSession = null;
  vi.unstubAllGlobals();
});

it.each([
  ["PURCHASE_QUOTATION", "TRADE_PURCHASE_QUOTATION_PRINT_V1"],
  ["PURCHASE_ORDER", "TRADE_PURCHASE_ORDER_PRINT_V1"],
  ["SALES_ORDER", "TRADE_SALES_ORDER_PRINT_V1"],
  ["INVOICE", "TRADE_INVOICE_PRINT_V1"],
  ["CONTRACT", "TRADE_CONTRACT_PRINT_V1"],
] as const)("binds %s publication to the current company and version", async (documentType, dataSourceKey) => {
  const companyId = "01900100-0000-7000-8000-00000000000a";
  const owner = {
    ...versionAuthority("print"),
    scope: { headers: { "x-mutakamel-company-id": companyId }, locale: "en-US" },
  };
  const template: TemplateDetail = {
    ...detail(4, 7), documentType, dataSourceKey, scope: { type: "COMPANY", companyId },
    currentPublishedVersion: versionSummary(previousRow),
  };
  io.validateGeneric.mockResolvedValue(validationRun(7));
  const { result } = renderHook(() => useTemplateRelease(template, grants, vi.fn(), owner));
  await act(async () => { await result.current.validate(); });
  await act(async () => { await result.current.publish(""); });
  expect(io.publish).toHaveBeenCalledExactlyOnceWith(TEMPLATE_ID, {
    definitionRevision: 4, draftRevision: 7, validationRunId: RUN_ID, setAsDefinitionPublished: true,
  }, '"7"', {
    scope: owner.scope, dataSourceKey, currentVersionId: previousRow.id, assertCurrent: expect.any(Function),
  });
});

describe("Sales Quotation company-to-branch Recover", () => {
  const companyA = OTHER_VERSION_ID;
  const companyB = VERSION_ID;
  const branchB = RUN_ID;
  const note = "Exact recovery";
  const actor: TenantProfileCommit["user"] = {
    id: DRAFT_ID, email: "fixture@example.test", firstName: "Sales", lastName: "Fixture",
    isTenantOwner: false, status: "ACTIVE", accessibleBranches: [branchB],
    accessibleCompanies: [companyA, companyB], accessibleBranchCompanies: [{ companyId: companyB, branchId: branchB }],
    permissions: ["templates.read", "templates.update", "templates.publish"], featureEntitlements: {},
    permissionScopes: Object.fromEntries(["templates.read", "templates.update", "templates.publish"].map(permission =>
      [permission, { tenantWide: false, companyIds: [companyA], branchIds: [branchB] }])),
    teamMemberships: [], accessScope: {
      mode: "FULL", branchesTruncated: false, companiesTruncated: false,
      teamMembershipsTruncated: false, teamMembershipsTotal: 0,
    },
  };

  const panel = () => io.panel.mock.lastCall![0] as ReturnType<typeof useTemplateRelease>;
  const setProfile = (next: TenantProfileCommit | null) => {
    readyProfile = next;
    profileListeners.forEach(listener => listener());
  };

  async function setup() {
    const company = publication({ ...detail(4, 7), scope: { type: "COMPANY", companyId: companyA } }, "LTR", note);
    const branch: TemplateDetail = { ...detail(8, 12), id: OTHER_VERSION_ID,
      scope: { type: "BRANCH", companyId: companyB, branchId: branchB } };
    const onReload = vi.fn();
    const show = (template: TemplateDetail, currentGrants: TemplateGrants = grants) =>
      io.detail.mockReturnValue({ template, grants: currentGrants, lang: "en", t: en, reload: onReload });
    localSession = "sales-cross-scope";
    sessionStorage.setItem("tenant_session_meta", JSON.stringify({
      sessionId: localSession, savedAt: Date.now(), expiresIn: 300, sessionExpiresIn: 300,
      tokenType: "Bearer", remember: false, authorizationVersion: 3, profileVersion: 1, authEventId: "sales-cross-scope",
    }));
    setProfile({ user: actor, sessionRevision: "same-authorized-session", sequence: 1 });
    show(company.template);
    mockValidation(company.template);
    const view = render(createElement(TemplateDetailWorkspace, { id: company.template.id }));
    await act(async () => { await panel().validate(); });
    expect(panel().canPublish).toBe(true);
    return { company, branch, view, show, onReload };
  }

  it.each([
    "missing immutable version", "wrong validation pin", "Gateway 502 Problem Details",
    "Gateway 502 Problem Details after authority retirement",
  ] as const)(
    "keeps a same-key 201 replay pending until its exact immutable GET succeeds (%s)",
    async failure => {
      const sample = publication({ ...detail(4, 7), scope: { type: "COMPANY", companyId: companyA } }, "LTR", "Release");
      const template = sample.template;
      const immutablePath = `/api/tenant/core/v1/templates/${template.id}/versions/${sample.row.id}`;
      const onReload = vi.fn();
      const retireBefore502 = failure === "Gateway 502 Problem Details after authority retirement";
      let retired = false;
      const owner = { ...versionAuthority("replay-readback"), isCurrent: () => !retired };
      localSession = "sales-replay-readback";
      sessionStorage.setItem("tenant_session_meta", JSON.stringify({
        sessionId: localSession, savedAt: Date.now(), expiresIn: 300, sessionExpiresIn: 300,
        tokenType: "Bearer", remember: false, authorizationVersion: 1, profileVersion: 1, authEventId: "replay-readback",
      }));
      setProfile({ user: actor, sessionRevision: "same-session", sequence: 1 });
      const actualCore = await vi.importActual<typeof import("../../../core-api")>("../../../core-api");
      const lifecycle = await vi.importActual<typeof import("../../template-lifecycle-api")>("../../template-lifecycle-api");
      io.post.mockImplementation((...args: Parameters<typeof actualCore.corePostResponse>) => actualCore.corePostResponse(...args));
      io.view.mockImplementation(lifecycle.fetchTemplateVersion);
      mockValidation(template);
      let posts = 0;
      let immutableReads = 0;
      let release502!: () => void;
      let deliveredRetired502 = false;
      const json = (url: RequestInfo | URL, payload: unknown, init?: ResponseInit) => {
        const response = Response.json(payload, init);
        Object.defineProperty(response, "url", { value: new URL(String(url), window.location.origin).href });
        return response;
      };
      const wireVersion = sample.response.data.data.version;
      const transport = vi.fn<typeof fetch>(async (url, request) => {
        const path = new URL(String(url), window.location.origin).pathname;
        if (path === publishPath && request?.method === "POST") {
          if (++posts === 1) throw new TypeError("Simulated lost Publish response");
          const headers = new Headers(sample.response.headers);
          headers.set("idempotency-replayed", "true");
          return json(url, sample.response.data, { status: 201, headers });
        }
        if (path === immutablePath && request?.method === "GET") {
          if (++immutableReads === 1) {
            if (failure === "missing immutable version") {
              return json(url, { success: false, errorCode: "COMMON.GENERIC.NOT_FOUND" }, { status: 404 });
            }
            if (failure === "Gateway 502 Problem Details" || retireBefore502) {
              const correlationId = "01900100-0000-7000-8000-000000000050";
              const response = json(url, {
                type: "https://errors.mutakamel.ai/gw/upstream/unavailable",
                title: "Upstream service unavailable",
                status: 502,
                code: "GW.UPSTREAM.UNAVAILABLE",
                correlationId,
                instance: immutablePath,
              }, { status: 502, headers: {
                "Content-Type": "application/json; charset=utf-8", "Retry-After": "9", "X-Correlation-Id": correlationId,
              } });
              if (retireBefore502) {
                await new Promise<void>(resolve => { release502 = resolve; });
                deliveredRetired502 = retired;
              }
              return response;
            }
            return json(url, { success: true, data: { ...wireVersion, validationRunId: OTHER_VERSION_ID } });
          }
          return json(url, { success: true, data: wireVersion });
        }
        throw new Error(`Unexpected transport ${request?.method} ${path}`);
      });
      vi.stubGlobal("fetch", transport);
      const { result, rerender } = renderHook(({ current, activeOwner }) =>
        useTemplateRelease(current, grants, onReload, activeOwner), {
        initialProps: { current: template, activeOwner: owner },
      });
      await act(async () => { await result.current.validate(); });
      expect(result.current.canPublish).toBe(true);
      onReload.mockClear();
      toast.success.mockClear();
      await act(async () => { await result.current.publish("Release"); });
      expect(posts).toBe(1);
      const first = transport.mock.calls[0][1]!;
      const key = new Headers(first.headers).get("x-idempotency-key");
      expect(isUUIDv7(key)).toBe(true);
      const stored = () => Object.entries(sessionStorage).filter(([name]) => name.startsWith(SALES_PUBLISH_RECOVERY_PREFIX));
      expect(stored()).toHaveLength(1);

      toast.errorFromApi.mockClear();
      toast.outcomeFromApi.mockClear();
      let replayFlight!: Promise<void>;
      await act(async () => {
        replayFlight = result.current.publish("Release");
        if (!retireBefore502) await replayFlight;
      });
      if (retireBefore502) await waitFor(() => expect(release502).toBeTypeOf("function"));
      expect(posts).toBe(2);
      const replay = transport.mock.calls[1][1]!;
      expect(replay.body).toBe(first.body);
      expect(new Headers(replay.headers).get("if-match")).toBe(template.currentDraft.etag);
      expect(new Headers(replay.headers).get("x-idempotency-key")).toBe(key);
      expect(toast.success).not.toHaveBeenCalled();
      expect(immutableReads).toBe(1);
      expect(transport).toHaveBeenCalledTimes(3);
      expect(onReload).not.toHaveBeenCalled();
      expect(result.current.versionDetail).toBeNull();
      expect(result.current.canPublish).toBe(true);
      expect(stored()).toHaveLength(1);
      expect(JSON.parse(stored()[0][1]).idempotencyKey).toBe(key);
      if (retireBefore502) {
        const recoveryBeforeRetirement = stored();
        act(() => {
          retired = true;
          setProfile({ user: actor, sessionRevision: "renewed-session", sequence: 2 });
        });
        rerender({ current: template, activeOwner: versionAuthority("renewed-readback") });
        expect(result.current.canPublish).toBe(false);
        expect(result.current.isPublishing).toBe(false);
        await act(async () => { release502(); await replayFlight; });
        expect(deliveredRetired502).toBe(true);
        expect(transport).toHaveBeenCalledTimes(3);
        expect(result.current.canPublish).toBe(false);
        expect(result.current.isPublishing).toBe(false);
        expect(result.current.versionDetail).toBeNull();
        expect(stored()).toEqual(recoveryBeforeRetirement);
        expect(onReload).not.toHaveBeenCalled();
        expect(toast.success).not.toHaveBeenCalled();
        expect(toast.errorFromApi).not.toHaveBeenCalled();
        expect(toast.outcomeFromApi).not.toHaveBeenCalled();
        return;
      }
      expect(toast.errorFromApi).toHaveBeenCalledWith(en.coreOperations.templates.publishOutcomeUnconfirmed, expect.any(Object));

      const beforeRetry = transport.mock.calls.length;
      await act(async () => { await result.current.publish("Release"); });
      expect(posts).toBe(2);
      expect(immutableReads).toBe(2);
      const readbackCalls = transport.mock.calls.slice(beforeRetry);
      expect(readbackCalls).toHaveLength(1);
      const [readbackUrl, readbackRequest] = readbackCalls[0];
      expect(new URL(String(readbackUrl), window.location.origin).href)
        .toBe(new URL(immutablePath, window.location.origin).href);
      expect(readbackRequest?.method).toBe("GET");
      expect(readbackRequest?.body).toBeUndefined();
      expect(readbackRequest?.cache).toBe("no-store");
      const readbackHeaders = new Headers(readbackRequest?.headers);
      expect(readbackHeaders.get("x-mutakamel-company-id")).toBe(companyA);
      expect(readbackHeaders.get("x-mutakamel-branch-id")).toBeNull();
      expect(readbackHeaders.get("if-match")).toBeNull();
      expect(readbackHeaders.get("x-idempotency-key")).toBeNull();
      expect(toast.success).toHaveBeenCalledExactlyOnceWith(en.coreOperations.templates.savedTitle, en.coreOperations.templates.published);
      expect(onReload).toHaveBeenCalledOnce();
      expect(stored()).toHaveLength(0);
      expect(result.current.versionDetail).toBeNull();
      io.versions.mockResolvedValue(versionPage([sample.row]));
      rerender({
        current: { ...template, definitionRevision: template.definitionRevision + 1, currentPublishedVersion: versionSummary(sample.row) },
        activeOwner: versionAuthority("settled-readback"),
      });
      await waitFor(() => expect(result.current.versionDetail).toMatchObject({
        state: "ready", version: { id: sample.row.id, validationRunId: RUN_ID, compilerVersion: wireVersion.compilerVersion },
      }));
    },
  );


  function regrant() {
    setProfile({ user: actor, sessionRevision: "same-authorized-session", sequence: 2 });
  }

it("ignores a queued 409 from the previous session before reloading the current draft", async () => {
    const previous = { ...detail(4, 7), scope: { type: "COMPANY" as const, companyId: companyA } };
    const draft = { ...previous.currentDraft, revision: 8, etag: '"8"', contentChecksum: "b".repeat(64) };
    const newer = { ...previous, currentDraft: draft, draft };
    const onReload = vi.fn();
    const owner = versionAuthority("stable");
    const stale = () => new TenantApiClientError("Stale revision", {
      status: 409, statusText: "Conflict", headers: new Headers(), data: { errorCode: STALE_REVISION_CODE },
    });
    readyProfile = { user: actor, sessionRevision: "stable-profile", sequence: 1 };
    localSession = "queued-validate-a";
    let rejectOld!: (error: Error) => void;
    io.validate.mockReturnValueOnce(new Promise((_resolve, reject) => { rejectOld = reject; }));
    const { result, rerender } = renderHook(
      ({ template }) => useTemplateRelease(template, grants, onReload, owner),
      { initialProps: { template: previous } },
    );
    const oldValidate = result.current.validate;
    let oldFlight!: Promise<void>;
    act(() => { oldFlight = oldValidate(); });
    localSession = "queued-validate-b";
    rerender({ template: previous });
    await act(async () => { rejectOld(stale()); await oldFlight; });

    expect(onReload).not.toHaveBeenCalled();
    expect(toast.errorFromApi).not.toHaveBeenCalled();
    expect(result.current.validationNeedsReload).toBe(false);
    expect(io.validate.mock.calls[0][2].assertCurrent).toThrow(expect.objectContaining({ name: "AbortError" }));

    io.validate.mockRejectedValueOnce(stale());
    await act(async () => { await result.current.validate(); });
    expect(onReload).toHaveBeenCalledOnce();
    expect(result.current.validationNeedsReload).toBe(true);

    act(() => { result.current.reloadValidationDraft(); });
    rerender({ template: structuredClone(previous) });
    await act(async () => { await result.current.validate(); });
    expect(onReload).toHaveBeenCalledTimes(2);
    expect(io.validate).toHaveBeenCalledTimes(2);
    expect(result.current.validationNeedsReload).toBe(true);

    act(() => { result.current.reloadValidationDraft(); });
    mockValidation(newer);
    rerender({ template: newer });
    expect(result.current.validationNeedsReload).toBe(false);
    await act(async () => { await oldValidate(); });
    expect(io.validate).toHaveBeenCalledTimes(2);
    await act(async () => { await result.current.validate(); });
    const [, body, options] = io.validate.mock.calls[2];
    expect(body.draftRevision).toBe(8);
    expect(options.headers["If-Match"]).toBe(newer.currentDraft.etag);
    expect(options.headers["x-idempotency-key"]).not.toBe(io.validate.mock.calls[1][2].headers["x-idempotency-key"]);
    expect(result.current.canPublish).toBe(true);
  });


  it.each([201, 403])("fences late HTTP %i after moving to another branch and regranting", async status => {
    const { company, branch, view, show, onReload } = await setup();
    const real = await vi.importActual<typeof import("../../../core-api")>("../../../core-api");
    io.post.mockImplementation((...args: Parameters<typeof real.corePostResponse>) => real.corePostResponse(...args));
    let finishOld!: (response: Response) => void;
    let loseBranch!: (error: Error) => void;
    const transport = vi.fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("First outcome lost"))
      .mockReturnValueOnce(new Promise(resolve => { finishOld = resolve; }))
      .mockReturnValueOnce(new Promise((_, reject) => { loseBranch = reject; }))
      .mockRejectedValueOnce(new TypeError("Branch retry outcome lost"))
      .mockImplementationOnce(async url => {
        const response = Response.json(company.response.data, { status: 201, headers: company.response.headers });
        Object.defineProperty(response, "url", { value: new URL(String(url), window.location.origin).href });
        return response;
      });
    vi.stubGlobal("fetch", transport);
    const notifications = vi.fn();
    const unsubscribe = subscribePermissionDenials(notifications);
    window.addEventListener("global-toast", notifications);
    try {
      await act(async () => { await panel().publish(note); });
      const oldPublish = panel().publish;
      let oldFlight!: Promise<void>;
      act(() => { oldFlight = oldPublish(note); });
      await waitFor(() => expect(transport).toHaveBeenCalledTimes(2));
      const key = (index: number) => new Headers(transport.mock.calls[index][1]?.headers).get("x-idempotency-key");
      expect(key(1)).toBe(key(0));
      expect(isUUIDv7(key(0))).toBe(true);
      expect(transport.mock.calls[1][1]?.body).toBe(transport.mock.calls[0][1]?.body);

      act(() => setProfile(null));
      show(branch, { ...grants, canRead: false, canUpdate: false, canPublish: false });
      view.rerender(createElement(TemplateDetailWorkspace, { id: branch.id }));
      show(branch);
      act(regrant);
      view.rerender(createElement(TemplateDetailWorkspace, { id: branch.id }));
      mockValidation(branch);
      await act(async () => { await panel().validate(); });
      expect(panel().canPublish).toBe(true);
      toast.success.mockClear();
      toast.errorFromApi.mockClear();
      toast.outcomeFromApi.mockClear();
      onReload.mockClear();

      let branchFlight!: Promise<void>;
      act(() => { branchFlight = panel().publish(note); });
      await waitFor(() => expect(transport).toHaveBeenCalledTimes(3));
      const before = Object.entries(sessionStorage).filter(([name]) => name.startsWith(SALES_PUBLISH_RECOVERY_PREFIX));
      expect(before.some(([, value]) => value.includes(key(0)!))).toBe(true);
      if (status === 201) {
        company.response.headers.set("idempotency-replayed", "true");
        const response = Response.json(company.response.data, { status, headers: company.response.headers });
        Object.defineProperty(response, "url", { value: new URL(String(transport.mock.calls[1][0]), window.location.origin).href });
        finishOld(response);
      } else {
        finishOld(Response.json({ success: false, errorCode: "GW.AUTH.FORBIDDEN" }, { status }));
      }
      await act(async () => { await oldFlight; });

      expect(panel().isPublishing).toBe(true);
      expect(panel().run?.draftRevision).toBe(12);
      expect(panel().versionDetail).toBeNull();
      expect(onReload).not.toHaveBeenCalled();
      expect(io.view).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.errorFromApi).not.toHaveBeenCalled();
      expect(toast.outcomeFromApi).not.toHaveBeenCalled();
      expect(notifications).not.toHaveBeenCalled();
      expect(Object.entries(sessionStorage).filter(([name]) => name.startsWith(SALES_PUBLISH_RECOVERY_PREFIX))).toEqual(before);

      await act(async () => { loseBranch(new TypeError("Branch outcome lost")); await branchFlight; });
      await act(async () => { await panel().publish(note); });
      expect(key(2)).not.toBe(key(0));
      expect(key(3)).toBe(key(2));

      show(company.template);
      view.rerender(createElement(TemplateDetailWorkspace, { id: company.template.id }));
      mockValidation(company.template);
      io.view.mockResolvedValue(company.versionDetail);
      await act(async () => { await panel().validate(); });
      await act(async () => { await panel().publish(note); });
      expect(key(4)).toBe(key(0));
      expect(transport.mock.calls[4][1]?.body).toBe(transport.mock.calls[0][1]?.body);
      expect(toast.success).toHaveBeenLastCalledWith(en.coreOperations.templates.savedTitle, en.coreOperations.templates.published);
    } finally {
      unsubscribe();
      window.removeEventListener("global-toast", notifications);
    }
  });

  it("does not re-admit the previous company definition on an unresolved branch route after regrant", async () => {
    const { company, branch, view, show } = await setup();
    io.post.mockRejectedValue(new TypeError("Outcome lost"));
    await act(async () => { await panel().publish(note); });
    const oldPublish = panel().publish;
    expect(io.post).toHaveBeenCalledOnce();

    act(() => setProfile(null));
    act(regrant);
    // The detail GET has not yet replaced the old definition after navigation.
    show(company.template);
    io.panel.mockClear();
    view.rerender(createElement(TemplateDetailWorkspace, { id: branch.id }));
    const stalePanel = io.panel.mock.lastCall?.[0] as ReturnType<typeof useTemplateRelease> | undefined;
    if (stalePanel) {
      await act(async () => { await stalePanel.validate(); });
      await act(async () => { await panel().publish(note); });
    }
    await act(async () => { await oldPublish(note); });
    expect(io.post).toHaveBeenCalledOnce();
    expect(io.validate).toHaveBeenCalledOnce();
    expect(io.panel).not.toHaveBeenCalled();
  });
});

describe("template publish concurrency", () => {
  it.each([
    { change: "a metadata-only rename", definitionRevision: 2, draftRevision: 1 },
    { change: "a draft save", definitionRevision: 1, draftRevision: 3 },
  ])("publishes after $change with independent revisions", async ({ definitionRevision, draftRevision }) => {
    const onReload = vi.fn();
    const { result, rerender } = renderHook(
      ({ template }) => useTemplateRelease(template, grants, onReload, null),
      { initialProps: { template: detail() } },
    );
    const { template: loaded, response } = publication(
      { ...detail(definitionRevision, draftRevision), name: "Renamed quotation" }, "LTR", "Release",
    );
    rerender({ template: loaded });
    mockValidation(loaded);
    io.post.mockResolvedValue(response);

    await act(async () => { await result.current.validate(); });
    expect(io.validate).toHaveBeenCalledWith(`/api/tenant/core/v1/templates/${TEMPLATE_ID}/validate`,
      { draftRevision, rendererTargets: ["HTML", "PDF"] }, publishOptions(loaded));
    expect(result.current.canPublish).toBe(true);
    onReload.mockClear();
    toast.success.mockClear();

    await act(async () => { await result.current.publish(" Release "); });
    expect(io.post).toHaveBeenCalledWith(publishPath, {
      definitionRevision, draftRevision, validationRunId: RUN_ID,
      changeNote: "Release", setAsDefinitionPublished: true,
    }, publishOptions(loaded));
    expect(toast.success).toHaveBeenCalledWith(en.coreOperations.templates.savedTitle, en.coreOperations.templates.published);
    expect(onReload).toHaveBeenCalledOnce();
    expect(result.current.run).toBeNull();
  });

  it("surfaces a server rejection when the validated draft became stale", async () => {
    const onReload = vi.fn();
    const loaded = detail(2, 1);
    const run = validationRun(1);
    mockValidation(loaded, run);
    const { result } = renderHook(() => useTemplateRelease(loaded, grants, onReload, null));
    await act(async () => { await result.current.validate(); });
    onReload.mockClear();
    toast.success.mockClear();
    io.post.mockRejectedValue(new TenantApiClientError("Stale revision", {
      status: 409, statusText: "Conflict", headers: new Headers(),
      data: { errorCode: STALE_REVISION_CODE, message: "Stale revision" },
    }));

    await act(async () => { await result.current.publish(""); });
    expect(io.post).toHaveBeenCalledWith(publishPath, expect.objectContaining({
      definitionRevision: 2, draftRevision: 1,
    }), publishOptions(loaded));
    expect(toast.errorFromApi).toHaveBeenCalledWith(en.coreOperations.templates.publishFailed,
      expect.objectContaining({ status: 409, code: STALE_REVISION_CODE }));
    expect(toast.success).not.toHaveBeenCalled();
    expect(onReload).not.toHaveBeenCalled();
    expect(result.current.run).toEqual(run);
    expect(result.current.isPublishing).toBe(false);
  });

  it.each(["draft ID", "checksum"])("rejects validation evidence for a different %s at the same revision", async mismatch => {
    const loaded = detail();
    const response = validationResponse(loaded);
    if (mismatch === "draft ID") response.data.data.draftId = OTHER_VERSION_ID;
    else response.data.data.candidateChecksum = "b".repeat(64);
    response.headers.set("idempotency-replayed", "true");
    io.validate.mockResolvedValue(response);
    const { result } = renderHook(() => useTemplateRelease(loaded, grants, vi.fn(), null));

    await act(async () => { await result.current.validate(); });
    expect(result.current.canPublish).toBe(false);
    await act(async () => { await result.current.publish(""); });
    expect(io.post).not.toHaveBeenCalled();
  });

  it("reloads after stale validation and waits for a fresh explicit Validate", async () => {
    const loaded = detail(4, 7);
    const saved = detail(4, 8);
    saved.currentDraft.contentChecksum = "b".repeat(64);
    const path = `/api/tenant/core/v1/templates/${loaded.id}/validate`;
    const onReload = vi.fn();
    io.validate.mockRejectedValueOnce(new TenantApiClientError("Stale revision", {
      status: 409, statusText: "Conflict", headers: new Headers(),
      data: { errorCode: STALE_REVISION_CODE, message: "Stale revision" },
    }));
    const { result, rerender } = renderHook(({ template }) => useTemplateRelease(template, grants, onReload, null), {
      initialProps: { template: loaded },
    });
    const validateOldDraft = result.current.validate;

    await act(async () => { await validateOldDraft(); });
    expect(io.validate).toHaveBeenCalledExactlyOnceWith(path, {
      draftRevision: 7, rendererTargets: ["HTML", "PDF"],
    }, expect.objectContaining({ headers: expect.objectContaining({ "If-Match": '"7"' }) }));
    expect(result.current.canPublish).toBe(false);
    expect(toast.errorFromApi).toHaveBeenCalledWith(en.coreOperations.templates.validationRunFailed,
      expect.objectContaining({ status: 409, code: STALE_REVISION_CODE }));
    expect(onReload).toHaveBeenCalledOnce();

    rerender({ template: saved });
    await act(async () => { await validateOldDraft(); });
    expect(io.validate).toHaveBeenCalledTimes(1);
    expect(result.current.run).toBeNull();
    expect(result.current.canPublish).toBe(false);

    mockValidation(saved, { ...validationRun(8), id: OTHER_VERSION_ID });
    await act(async () => { await result.current.validate(); });
    expect(io.validate).toHaveBeenNthCalledWith(2, path, {
      draftRevision: 8, rendererTargets: ["HTML", "PDF"],
    }, expect.objectContaining({ headers: expect.objectContaining({ "If-Match": '"8"' }) }));
    const [[, , oldConfig], [, , freshConfig]] = io.validate.mock.calls;
    expect(isUUIDv7(freshConfig.headers["x-idempotency-key"])).toBe(true);
    expect(freshConfig.headers["x-idempotency-key"]).not.toBe(oldConfig.headers["x-idempotency-key"]);
    expect(result.current.run).toMatchObject({ id: OTHER_VERSION_ID, draftRevision: 8 });
    expect(result.current.canPublish).toBe(true);
    expect(io.post).not.toHaveBeenCalled();
  });

  it("shows issues from a replayed failed validation and keeps publish disabled", async () => {
    const template = detail();
    const response = validationResponse(template, { ...validationRun(1), status: "FAILED" });
    response.headers.set("idempotency-replayed", "true");
    io.validate.mockResolvedValue({ ...response, data: { ...response.data, data: { ...response.data.data, issues: [{
      severity: "ERROR", code: "CORE.TEMPLATE.VALIDATION.FAILED", nodeId: null,
      messageKey: "template.validation.failed", jsonPointer: "", params: {},
    }] } } });
    const { result } = renderHook(() => useTemplateRelease(template, grants, vi.fn(), null));

    await act(async () => { await result.current.validate(); });
    expect(result.current.run).toMatchObject({ status: "FAILED", issues: [{
      code: "CORE.TEMPLATE.VALIDATION.FAILED", message: en.coreOperations.errors["CORE.TEMPLATE.VALIDATION.FAILED"],
    }] });
    expect(result.current.canPublish).toBe(false);
  });

  it.each([
    { status: 403, code: "CORE.TEMPLATE.FEATURE.DISABLED" },
    { status: 409, code: STALE_REVISION_CODE },
  ])("blocks publish after a lost revalidation is retried and refused with $code", async ({ status, code }) => {
    const template = detail(4, 7);
    const accepted = validationResponse(template);
    const replay = validationResponse(template, { ...validationRun(7), id: VERSION_ID });
    replay.headers.set("idempotency-replayed", "true");
    const onReload = vi.fn();
    const { result } = renderHook(() => useTemplateRelease(template, grants, onReload, null));
    io.validate.mockResolvedValueOnce(accepted).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    io.validate.mockRejectedValueOnce(new TenantApiClientError("Validation refused", {
      status, statusText: status === 403 ? "Forbidden" : "Conflict", headers: new Headers(), data: { errorCode: code },
    }));
    await act(async () => { await result.current.validate(); });
    expect(result.current.canPublish).toBe(true);
    onReload.mockClear();
    toast.success.mockClear();

    await act(async () => { await result.current.validate(); });
    const publishBeforeDenial = result.current.publish;
    await act(async () => { await result.current.validate(); });
    expect(result.current.canPublish).toBe(false);
    expect(result.current.run).toBeNull();
    await act(async () => {
      await publishBeforeDenial("");
      await result.current.publish("");
    });
    expect(io.post).not.toHaveBeenCalled();
    expect(onReload).toHaveBeenCalledTimes(status === 409 ? 1 : 0);
    expect(toast.success).not.toHaveBeenCalled();

    // Only a currently authorized receipt for this draft can re-enable publish.
    if (status === 403) io.validate.mockResolvedValueOnce(replay);
    else io.validate.mockRejectedValueOnce(new TenantApiClientError("Stale revision", {
      status, statusText: "Conflict", headers: new Headers(), data: { errorCode: code },
    }));
    await act(async () => { await result.current.validate(); });
    expect(io.validate).toHaveBeenCalledTimes(4);
    const [[, , first], ...retryCalls] = io.validate.mock.calls;
    const [path, body, { headers }] = retryCalls[0];
    expect(headers["x-idempotency-key"]).not.toBe(first.headers["x-idempotency-key"]);
    for (const [retryPath, retryBody, retry] of retryCalls) {
      expect([retryPath, retryBody, retry.headers]).toEqual([path, body, headers]);
    }
    expect(result.current.run?.id).toBe(status === 403 ? VERSION_ID : undefined);
    expect(result.current.canPublish).toBe(status === 403);
  });

  it("ignores a validation that settles after switching templates", async () => {
    const original = detail();
    const response = validationResponse(original);
    let resolveValidation!: (response: ReturnType<typeof validationResponse>) => void;
    io.validate.mockReturnValue(new Promise<ReturnType<typeof validationResponse>>(resolve => { resolveValidation = resolve; }));
    const onReload = vi.fn();
    const { result, rerender } = renderHook(({ template }) => useTemplateRelease(template, grants, onReload, null), {
      initialProps: { template: original },
    });
    let pending!: Promise<void>;
    act(() => { pending = result.current.validate(); });
    rerender({ template: { ...detail(), id: OTHER_VERSION_ID } });
    await act(async () => {
      resolveValidation(response);
      await pending;
    });

    expect(result.current.run).toBeNull();
    expect(result.current.isValidating).toBe(false);
    expect(onReload).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it.each(["draft edit", "scope change"])("rejects the old validation command and receipt after a %s", async change => {
    const original = detail(4, 7);
    const editedDraft = { ...original.currentDraft, revision: 8, etag: '"8"', contentChecksum: "b".repeat(64) };
    const next: TemplateDetail = change === "draft edit"
      ? { ...original, draft: editedDraft, currentDraft: editedDraft }
      : { ...original, scope: { type: "COMPANY", companyId: OTHER_VERSION_ID } };
    const oldReceipt = validationResponse(original);
    const nextRun = { ...validationRun(next.currentDraft.revision), id: VERSION_ID };
    let resolveOldReplay!: (value: typeof oldReceipt) => void;
    io.validate.mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockReturnValueOnce(new Promise<typeof oldReceipt>(resolve => { resolveOldReplay = resolve; }))
      .mockResolvedValueOnce(validationResponse(next, nextRun));
    const owner = versionAuthority("original");
    const onReload = vi.fn();
    const { result, rerender } = renderHook(({ template }) => useTemplateRelease(template, grants, onReload, owner),
      { initialProps: { template: original } });
    const staleValidate = result.current.validate;
    await act(async () => { await staleValidate(); });
    let oldReplay!: Promise<void>;
    act(() => { oldReplay = staleValidate(); });
    rerender({ template: next });
    toast.errorFromApi.mockClear();
    await act(async () => {
      await staleValidate();
      resolveOldReplay(oldReceipt);
      await oldReplay;
    });

    expect(io.validate).toHaveBeenCalledTimes(2);
    const originalHeaders = io.validate.mock.calls[0][2].headers;
    expect(io.validate.mock.calls[1][2].headers).toEqual(originalHeaders);
    expect(io.validate.mock.calls[1][2].assertCurrent).toThrow(expect.objectContaining({ name: "AbortError" }));
    expect(result.current.run).toBeNull();
    expect(result.current.canPublish).toBe(false);
    expect(onReload).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.errorFromApi).not.toHaveBeenCalled();

    await act(async () => { await result.current.validate(); });
    expect(io.validate).toHaveBeenCalledTimes(3);
    const [, body, { headers }] = io.validate.mock.calls[2];
    expect(body).toEqual({ draftRevision: next.currentDraft.revision, rendererTargets: ["HTML", "PDF"] });
    expect(headers).toEqual({
      "If-Match": next.currentDraft.etag, "x-idempotency-key": expect.any(String),
      ...(next.scope.companyId ? { "x-mutakamel-company-id": next.scope.companyId } : {}),
    });
    expect(headers["x-idempotency-key"]).not.toBe(originalHeaders["x-idempotency-key"]);
    expect(result.current.run).toEqual(nextRun);
    expect(result.current.canPublish).toBe(true);
  });
});

describe("sales quotation publication readback", () => {
  it.each(savedSalesDrafts)("reuses the release command for $caseKey after reconnect and fences a later edit", async saved => {
    const { templateId, draftId, draftRevision, draftChecksum, definitionRevision, locale, layoutMode, code } = saved;
    const base = detail(definitionRevision, draftRevision);
    const draft = { ...base.draft, draftId, validationState: "STALE" as const };
    const template: TemplateDetail = {
      ...base, id: templateId, code, locale, layoutMode, direction: locale === "ar-EG" ? "RTL" : "LTR", draft,
      currentDraft: { ...base.currentDraft, ...draft, contentChecksum: draftChecksum },
    };
    const run = { ...validationRun(draftRevision), id: saved.priorValidation?.validationRunId ?? RUN_ID, draftId };
    const stored = validationResponse(template, run);
    stored.headers.set("idempotency-replayed", "true");
    io.validate.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(stored);
    io.post.mockRejectedValue(new TypeError("Failed to fetch"));
    const owner = versionAuthority(templateId);
    const onReload = vi.fn();
    const { result, rerender } = renderHook(({ selected }) => useTemplateRelease(selected, grants, onReload, owner),
      { initialProps: { selected: template } });

    await act(async () => { await result.current.validate(); });
    expect(result.current.run).toBeNull();
    expect(result.current.canPublish).toBe(false);
    act(() => { window.dispatchEvent(new Event("online")); });
    rerender({ selected: { ...template, currentDraft: { ...template.currentDraft } } });
    await act(async () => { await result.current.validate(); });
    const submitBeforeEdit = result.current.publish;
    await act(async () => { await submitBeforeEdit(""); });
    act(() => { window.dispatchEvent(new Event("online")); });
    const reloadedDraft = { ...template.currentDraft, validationState: "PASSED" as const };
    rerender({ selected: { ...template, draft: { ...reloadedDraft }, currentDraft: reloadedDraft } });
    expect(result.current.run).toEqual(run);
    expect(result.current.canPublish).toBe(true);
    await act(async () => { await result.current.publish(""); });

    expect(io.validate).toHaveBeenCalledTimes(2);
    const validationHeaders = io.validate.mock.calls[0][2].headers;
    expect(validationHeaders["If-Match"]).toBe(`"${draftRevision}"`);
    expect(isUUIDv7(validationHeaders["x-idempotency-key"])).toBe(true);
    for (const [path, body, options] of io.validate.mock.calls) {
      expect([path, body, options.headers]).toEqual([`/api/tenant/core/v1/templates/${templateId}/validate`,
        { draftRevision, rendererTargets: ["HTML", "PDF"] }, validationHeaders]);
    }
    const path = `/api/tenant/core/v1/templates/${templateId}/publish`;
    const body = { definitionRevision, draftRevision, validationRunId: run.id, setAsDefinitionPublished: true };
    const headers = io.post.mock.calls[0][2].headers;
    expect(headers["If-Match"]).toBe(`"${draftRevision}"`);
    expect(isUUIDv7(headers["x-idempotency-key"])).toBe(true);
    expect(io.post).toHaveBeenCalledTimes(2);
    for (const [sentPath, sentBody, options] of io.post.mock.calls) {
      expect([sentPath, sentBody, options.headers]).toEqual([path, body, headers]);
    }

    const editedRevision = draftRevision + 1;
    const editedDraft = {
      ...draft, revision: editedRevision, etag: `"${editedRevision}"`,
      contentChecksum: createHash("sha256").update(draftChecksum + " edited").digest("hex"),
    };
    rerender({ selected: { ...template, draft: editedDraft, currentDraft: editedDraft } });
    expect(result.current.isRunCurrent).toBe(false);
    expect(result.current.canPublish).toBe(false);
    await act(async () => {
      await submitBeforeEdit("");
      await result.current.publish("");
    });
    expect(io.post).toHaveBeenCalledTimes(2);

    mockValidation({ ...template, draft: editedDraft, currentDraft: editedDraft }, { ...run, id: VERSION_ID, draftRevision: editedRevision });
    await act(async () => { await result.current.validate(); });
    await act(async () => { await result.current.publish(""); });
    expect(io.post).toHaveBeenLastCalledWith(path, {
      ...body, draftRevision: editedRevision, validationRunId: VERSION_ID,
    }, expect.objectContaining({ headers: { ...headers, "If-Match": editedDraft.etag,
      "x-idempotency-key": expect.any(String) } }));
    expect(io.post.mock.calls[2][2].headers["x-idempotency-key"]).not.toBe(headers["x-idempotency-key"]);
  });

  it.each([
    ["HYBRID_DOCUMENT", "LTR"], ["FLOW_DOCUMENT", "RTL"], ["FIXED_CANVAS", "AUTO"],
  ] as const)(
    "reopens the published %s with %s direction after a refresh and a subsequent direction edit",
    async (layoutMode, direction) => {
      const { template: loaded, row, versionDetail, response } = publication({
        ...detail(4, 7), layoutMode, currentPublishedVersion: versionSummary(previousRow),
      }, direction, "Release");
      const publishedDirection = response.data.data.version.direction;
      const initialOwner = versionAuthority("original");
      const refreshedOwner = versionAuthority("refreshed");
      const onReload = vi.fn();
      const { result, rerender } = renderHook(({ template, owner }: { template: TemplateDetail; owner: VersionAuthority }) =>
        useTemplateRelease(template, grants, onReload, owner), {
        initialProps: { template: loaded, owner: initialOwner },
      });
      io.versions.mockResolvedValue(versionPage([previousRow], "older"));
      mockValidation(loaded);
      io.post.mockResolvedValue(response);
      io.view.mockResolvedValue(versionDetail);

      await waitFor(() => expect(result.current.hasNextVersionPage).toBe(true));
      act(() => { result.current.nextVersionPage(); });
      await waitFor(() => expect(result.current.hasPreviousVersionPage).toBe(true));
      await act(async () => { await result.current.validate(); });
      onReload.mockClear();

      await act(async () => { await result.current.publish(" Release "); });
      expect(io.post).toHaveBeenCalledExactlyOnceWith(publishPath, {
        definitionRevision: 4, draftRevision: 7, validationRunId: RUN_ID,
        changeNote: "Release", setAsDefinitionPublished: true,
      }, publishOptions(loaded));
      expect(onReload).toHaveBeenCalledOnce();
      expect(io.view).not.toHaveBeenCalled();

      io.versions.mockResolvedValue(versionPage([row, previousRow]));
      rerender({
        owner: refreshedOwner,
        template: { ...loaded, ...detail(5, 8), layoutMode, direction, currentPublishedVersion: versionSummary(row) },
      });

      await waitFor(() => expect(result.current.versionDetail).toMatchObject({
        state: "ready", version: { id: VERSION_ID, validationRunId: RUN_ID, direction: publishedDirection },
      }));
      expect(io.versions).toHaveBeenLastCalledWith(TEMPLATE_ID, expect.objectContaining({
        cursor: undefined, scope: refreshedOwner.scope,
      }));
      expect(io.view).toHaveBeenCalledExactlyOnceWith(TEMPLATE_ID, VERSION_ID, expect.any(AbortSignal),
        expect.objectContaining({ selected: row, scope: refreshedOwner.scope }));

      const editedOwner = versionAuthority("edited");
      rerender({
        owner: editedOwner,
        template: {
          ...detail(6, 9), layoutMode, direction: publishedDirection === "LTR" ? "RTL" : "LTR",
          currentPublishedVersion: versionSummary(row),
        },
      });

      await waitFor(() => expect(result.current.versionDetail).toMatchObject({
        state: "ready", version: { id: VERSION_ID, direction: publishedDirection, templateContentChecksum: row.templateContentChecksum },
      }));
      expect(io.view).toHaveBeenCalledTimes(2);
      expect(io.view).toHaveBeenLastCalledWith(TEMPLATE_ID, VERSION_ID, expect.any(AbortSignal),
        expect.objectContaining({ selected: row, scope: editedOwner.scope }));
    },
  );

  it("rejects compiler drift on the published version readback and manual retry", async () => {
    const { template, row, versionDetail, response } = publication({
      ...detail(4, 7), layoutMode: "FLOW_DOCUMENT",
    }, "RTL");
    const refreshedOwner = versionAuthority("refreshed");
    const onReload = vi.fn();
    io.versions.mockResolvedValue(versionPage([]));
    mockValidation(template);
    io.post.mockResolvedValue(response);
    io.view.mockResolvedValue({ ...versionDetail, compilerVersion: "different-compiler" });
    const { result, rerender } = renderHook(
      ({ template, owner }: { template: TemplateDetail; owner: VersionAuthority }) =>
        useTemplateRelease(template, grants, onReload, owner), {
        initialProps: { template, owner: versionAuthority("original") },
      },
    );

    await act(async () => { await result.current.validate(); });
    await act(async () => { await result.current.publish(""); });
    expect(io.post).toHaveBeenCalledOnce();

    io.versions.mockResolvedValue(versionPage([row]));
    rerender({
      template: { ...template, ...detail(5, 8), currentPublishedVersion: versionSummary(row) },
      owner: refreshedOwner,
    });
    await waitFor(() => expect(result.current.versionDetail?.state).toBe("failed"));
    expect(io.view).toHaveBeenCalledOnce();

    await act(async () => { await result.current.openVersion(row); });
    expect(result.current.versionDetail?.state).toBe("failed");
    expect(io.view).toHaveBeenCalledTimes(2);

    io.view.mockResolvedValue(versionDetail);
    await act(async () => { await result.current.openVersion(row); });
    expect(result.current.versionDetail).toMatchObject({
      state: "ready", version: { compilerVersion: versionDetail.compilerVersion },
    });
  });

  it("recovers a lost publish receipt after a changed note is rejected as stale", async () => {
    const note = "Café";
    const changedNote = "Updated note";
    const { template: loaded, row, response, versionDetail } = publication(detail(4, 7), "RTL", note);
    let committed: { key: string; fingerprint: string } | undefined;
    let loseResponse!: () => void;
    io.post.mockImplementation(async (path, body, { headers }) => {
      const key: string = headers["x-idempotency-key"];
      const fingerprint = canonicalJson([path, headers["If-Match"], body]);
      if (!committed) {
        committed = { key, fingerprint };
        return new Promise<typeof response>((_, reject) => {
          loseResponse = () => reject(new TenantApiClientError("Publish timed out", {
            status: 504, statusText: "Gateway Timeout", headers: new Headers(),
            data: { errorCode: "CLIENT_REQUEST_TIMEOUT", idempotencyKey: key },
          }, "client"));
        });
      }
      if (key !== committed.key) {
        throw new TenantApiClientError("The resource changed after it was opened.", {
          status: 409, statusText: "Conflict", headers: new Headers(), data: { errorCode: STALE_REVISION_CODE },
        });
      }
      if (fingerprint !== committed.fingerprint) {
        throw new TenantApiClientError("The idempotency key belongs to a different request intent.", {
          status: 422, statusText: "Unprocessable Entity", headers: new Headers(),
          data: { errorCode: "CORE.TEMPLATE.IDEMPOTENCY.MISMATCH" },
        });
      }
      const replayHeaders = new Headers(response.headers);
      replayHeaders.set("idempotency-replayed", "true");
      return { ...response, headers: replayHeaders };
    });
    mockValidation(loaded);
    io.view.mockResolvedValue(versionDetail);
    const onReload = vi.fn();
    const { result, rerender } = renderHook(({ template, owner }) => useTemplateRelease(template, grants, onReload, owner),
      { initialProps: { template: loaded, owner: versionAuthority("original") } });
    await act(async () => { await result.current.validate(); });
    toast.success.mockClear();
    onReload.mockClear();
    const submit = result.current.publish;
    let first!: Promise<void>;
    await act(async () => {
      first = submit(" Cafe\u0301 ");
      await submit(changedNote);
    });
    expect(result.current.isPublishing).toBe(true);
    await act(async () => {
      await result.current.publish(changedNote);
      await result.current.validate();
    });
    expect(io.post).toHaveBeenCalledOnce();
    expect(io.validate).toHaveBeenCalledOnce();
    await act(async () => {
      loseResponse();
      await first;
    });
    await act(async () => { await result.current.publish(changedNote); });

    expect(toast.errorFromApi).toHaveBeenLastCalledWith(en.coreOperations.templates.publishFailed,
      expect.objectContaining({ status: 409, code: STALE_REVISION_CODE }));
    expect(result.current.canPublish).toBe(true);
    expect(toast.success).not.toHaveBeenCalled();
    expect(onReload).not.toHaveBeenCalled();
    expect(io.view).not.toHaveBeenCalled();
    await act(async () => { await result.current.publish(note); });

    expect(io.post).toHaveBeenCalledTimes(3);
    const [[firstPath, firstBody, firstConfig], [changedPath, changedBody, changedConfig],
      [retryPath, retryBody, retryConfig]] = io.post.mock.calls;
    expect(changedPath).toBe(firstPath);
    expect(changedBody).toEqual({ ...firstBody, changeNote: changedNote });
    expect(changedConfig.headers["If-Match"]).toBe(firstConfig.headers["If-Match"]);
    expect(changedConfig.headers["x-idempotency-key"]).not.toBe(firstConfig.headers["x-idempotency-key"]);
    expect(isUUIDv7(changedConfig.headers["x-idempotency-key"])).toBe(true);
    expect(retryPath).toBe(firstPath);
    expect(retryBody).toEqual(firstBody);
    expect(firstBody.changeNote).toBe(note);
    expect(retryConfig.headers).toEqual(firstConfig.headers);
    expect(isUUIDv7(firstConfig.headers["x-idempotency-key"])).toBe(true);
    expect(toast.success).toHaveBeenCalledExactlyOnceWith(en.coreOperations.templates.savedTitle, en.coreOperations.templates.published);
    expect(onReload).toHaveBeenCalledOnce();

    const later = { ...previousRow, versionNumber: 3 };
    io.versions.mockResolvedValue(versionPage([later, row]));
    rerender({
      template: { ...detail(6, 9), currentPublishedVersion: versionSummary(later) },
      owner: versionAuthority("later"),
    });

    await waitFor(() => expect(result.current.versionDetail).toMatchObject({
      state: "ready", version: { id: VERSION_ID, direction: "RTL" },
    }));
    expect(io.view).toHaveBeenCalledTimes(2);
    expect(io.view).toHaveBeenNthCalledWith(1, TEMPLATE_ID, VERSION_ID, undefined, expect.any(Object));
    expect(io.view).toHaveBeenNthCalledWith(2, TEMPLATE_ID, VERSION_ID, expect.any(AbortSignal), expect.any(Object));
  });

  it("keeps an in-flight key through a Gateway rate limit on the retry", async () => {
    const { template: loaded } = publication(detail(4, 7));
    mockValidation(loaded);
    const inFlight = new TenantApiClientError("Publish in flight", {
      status: 409, statusText: "Conflict", headers: new Headers(),
      data: { errorCode: "CORE.TEMPLATE.IDEMPOTENCY.IN_FLIGHT" },
    });
    io.post.mockRejectedValue(inFlight).mockRejectedValueOnce(inFlight)
      .mockRejectedValueOnce(new TenantApiClientError("Rate limited", {
        status: 429, statusText: "Too Many Requests", headers: new Headers(), data: { errorCode: "GW.RATE.LIMIT_EXCEEDED" },
      }));
    const { result } = renderHook(() => useTemplateRelease(loaded, grants, vi.fn(), null));
    await act(async () => { await result.current.validate(); });
    for (let request = 0; request < 3; request += 1) {
      await act(async () => { await result.current.publish("Original"); });
    }

    const keys = io.post.mock.calls.map(([, , config]) => config.headers["x-idempotency-key"]);
    expect(isUUIDv7(keys[0])).toBe(true);
    expect(keys).toEqual([keys[0], keys[0], keys[0]]);
  });

  it.each(["template switch", "unmount", "a second tab's draft revision change"])("isolates a pending publish replay after %s", async boundary => {
    const note = "Release";
    const { template: loaded, response } = publication(detail(4, 7), "LTR", note);
    response.headers.set("idempotency-replayed", "true");
    const sameTemplate = boundary === "a second tab's draft revision change";
    const otherDraft = sameTemplate
      ? { ...loaded.currentDraft, revision: 8, etag: '"8"', contentChecksum: "b".repeat(64) }
      : { ...loaded.currentDraft, draftId: OTHER_VERSION_ID };
    const next = { ...loaded, id: sameTemplate ? loaded.id : OTHER_VERSION_ID, draft: otherDraft, currentDraft: otherDraft };
    const networkLoss = new TypeError("Failed to fetch");
    let resolveReplay!: (value: typeof response) => void;
    let loseNextResponse!: (reason: unknown) => void;
    io.post.mockRejectedValueOnce(networkLoss)
      .mockReturnValueOnce(new Promise(resolve => { resolveReplay = resolve; }))
      .mockReturnValueOnce(new Promise((_, reject) => { loseNextResponse = reject; }))
      .mockRejectedValueOnce(networkLoss);
    io.validate.mockResolvedValueOnce(validationResponse(loaded)).mockResolvedValueOnce(validationResponse(next, {
      ...validationRun(otherDraft.revision), id: VERSION_ID, draftId: otherDraft.draftId,
    }));

    const onReload = vi.fn();
    const render = (template: TemplateDetail, owner: VersionAuthority) => renderHook(
      ({ template, owner }) => useTemplateRelease(template, grants, onReload, owner),
      { initialProps: { template, owner } },
    );
    const originalOwner = versionAuthority("original");
    const original = render(loaded, originalOwner);
    await act(async () => { await original.result.current.validate(); });
    await act(async () => { await original.result.current.publish(note); });
    const staleSubmit = original.result.current.publish;
    let replay!: Promise<void>;
    act(() => { replay = staleSubmit(note); });

    const nextOwner = sameTemplate ? originalOwner : versionAuthority("next");
    let nextResult = original.result;
    if (boundary === "unmount") {
      original.unmount();
      nextResult = render(next, nextOwner).result;
    } else {
      original.rerender({ template: next, owner: nextOwner });
    }
    expect(nextResult.current.canPublish).toBe(false);
    await act(async () => { await staleSubmit(note); });
    expect(io.post).toHaveBeenCalledTimes(2);
    expect(io.post.mock.calls[1][2].assertCurrent).toThrow(expect.objectContaining({ name: "AbortError" }));

    await act(async () => { await nextResult.current.validate(); });
    onReload.mockClear();
    toast.success.mockClear();
    toast.errorFromApi.mockClear();
    let nextPublish!: Promise<void>;
    act(() => { nextPublish = nextResult.current.publish(note); });
    await act(async () => {
      resolveReplay(response);
      await replay;
    });
    expect(nextResult.current.isPublishing).toBe(true);
    expect(onReload).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.errorFromApi).not.toHaveBeenCalled();
    expect(io.view).not.toHaveBeenCalled();

    await act(async () => {
      loseNextResponse(networkLoss);
      await nextPublish;
      await nextResult.current.publish(note);
    });
    expect(io.post.mock.calls.map(([path]) => path)).toEqual([
      publishPath, publishPath,
      `/api/tenant/core/v1/templates/${next.id}/publish`, `/api/tenant/core/v1/templates/${next.id}/publish`,
    ]);
    const keys = io.post.mock.calls.map(([, , config]) => config.headers["x-idempotency-key"]);
    expect(keys).toEqual([keys[0], keys[0], keys[2], keys[2]]);
    expect(keys[2]).not.toBe(keys[0]);
    expect(io.post.mock.calls.map(([, body, config]) => [body.draftRevision, config.headers["If-Match"]])).toEqual([
      [7, '"7"'], [7, '"7"'], [otherDraft.revision, otherDraft.etag], [otherDraft.revision, otherDraft.etag],
    ]);
  });

  it("uses the direction of a saved restored draft even when the definition has a different direction", async () => {
    const { template, row, response, versionDetail } = publication(detail(4, 7), "RTL");
    const loaded = { ...template, direction: "LTR" };
    io.post.mockResolvedValue(response);
    mockValidation(loaded);
    io.view.mockResolvedValue(versionDetail);
    const { result, rerender } = renderHook(({ template, owner }) => useTemplateRelease(template, grants, vi.fn(), owner),
      { initialProps: { template: loaded, owner: versionAuthority("original") } });
    await act(async () => { await result.current.validate(); });
    await act(async () => { await result.current.publish(""); });

    io.versions.mockResolvedValue(versionPage([row]));
    rerender({
      owner: versionAuthority("published"),
      template: { ...detail(5, 8), currentPublishedVersion: versionSummary(row) },
    });
    await waitFor(() => expect(result.current.versionDetail).toMatchObject({
      state: "ready", version: { id: VERSION_ID, direction: "RTL" },
    }));
  });

  it.each([
    "direction", "version checksum", "consumed revision", "change note",
    "missing change note", "missing retiredAt", "missing compiler version", "missing Location", "mismatched Location", "multiple Locations",
  ])("rejects a replay with invalid %s", async mismatch => {
    const { template: loaded, response } = publication(detail(4, 7), "RTL");
    response.headers.set("idempotency-replayed", "true");
    if (mismatch === "direction") response.data.data.version.direction = "LTR";
    if (mismatch === "version checksum") Object.assign(response.data.data.version.editorDocument, { title: "Changed content" });
    if (mismatch === "consumed revision") response.data.data.consumedDraftRevision = 6;
    if (mismatch === "change note") response.data.data.version.changeNote = "Different intent";
    if (mismatch === "missing change note") Reflect.deleteProperty(response.data.data.version, "changeNote");
    if (mismatch === "missing retiredAt") Reflect.deleteProperty(response.data.data.version, "retiredAt");
    if (mismatch === "missing compiler version") Reflect.deleteProperty(response.data.data.version, "compilerVersion");
    if (mismatch === "missing Location") response.headers.delete("location");
    if (mismatch === "mismatched Location") {
      response.headers.set("location", `/api/tenant/core/v1/templates/${loaded.id}/versions/${previousRow.id}`);
    }
    if (mismatch === "multiple Locations") response.headers.append("location", response.headers.get("location")!);
    io.post.mockResolvedValue(response);
    mockValidation(loaded);
    const onReload = vi.fn();
    const owner = versionAuthority("original");
    const { result } = renderHook(() => useTemplateRelease(loaded, grants, onReload, owner));
    await act(async () => { await result.current.validate(); });
    onReload.mockClear();
    toast.success.mockClear();

    await act(async () => { await result.current.publish(""); });

    expect(toast.errorFromApi).toHaveBeenCalledWith(en.coreOperations.templates.publishFailed, expect.any(Object));
    expect(toast.success).not.toHaveBeenCalled();
    expect(onReload).not.toHaveBeenCalled();
    expect(io.view).not.toHaveBeenCalled();
    expect(result.current.run).toEqual(validationRun(7));
  });

  it("ignores a publication that settles after profile authority is lost", async () => {
    const { template: loaded, response } = publication(detail(4, 7));
    let resolvePublication!: (value: typeof response) => void;
    io.post.mockReturnValue(new Promise<typeof response>(resolve => { resolvePublication = resolve; }));
    const owner = versionAuthority("original");
    const onReload = vi.fn();
    mockValidation(loaded);
    const { result } = renderHook(() => useTemplateRelease(loaded, grants, onReload, owner));
    await act(async () => { await result.current.validate(); });
    onReload.mockClear();
    toast.success.mockClear();

    let pending!: Promise<void>;
    act(() => { pending = result.current.publish(""); });
    act(() => {
      readyProfile = null;
      profileListeners.forEach(listener => listener());
    });
    await act(async () => {
      resolvePublication(response);
      await pending;
    });

    expect(result.current.canPublish).toBe(false);
    expect(result.current.isPublishing).toBe(false);
    expect(onReload).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(io.view).not.toHaveBeenCalled();
  });
});

it.each([false, true])("blocks repeat Validate before a definite stale 409 refresh completes (earlier validation: %s)", async earlierValidation => {
  const previous = detail(4, 7);
  const refreshed = detail(4, 8);
  refreshed.currentDraft.contentChecksum = "b".repeat(64);
  const onReload = vi.fn();
  const { result, rerender } = renderHook(
    ({ template }) => useTemplateRelease(template, grants, onReload, null),
    { initialProps: { template: previous } },
  );
  if (earlierValidation) {
    mockValidation(previous);
    await act(async () => { await result.current.validate(); });
    expect(result.current.canPublish).toBe(true);
    io.validate.mockClear();
    onReload.mockClear();
  }

  io.validate.mockRejectedValue(new TenantApiClientError("Stale revision", {
    status: 409, statusText: "Conflict", headers: new Headers(), data: { errorCode: STALE_REVISION_CODE },
  }));
  const retainedValidate = result.current.validate;
  await act(async () => { await retainedValidate(); });
  expect(onReload).toHaveBeenCalledOnce();
  expect(result.current.canPublish).toBe(false);

  await act(async () => { await retainedValidate(); });
  expect(io.validate).toHaveBeenCalledOnce();
  rerender({ template: structuredClone(previous) });
  await act(async () => { await result.current.validate(); });
  expect(io.validate).toHaveBeenCalledOnce();
  expect(onReload).toHaveBeenCalledOnce();

  io.validate.mockReset();
  mockValidation(refreshed, { ...validationRun(8), id: OTHER_VERSION_ID });
  rerender({ template: refreshed });
  await act(async () => { await retainedValidate(); });
  expect(io.validate).not.toHaveBeenCalled();
  expect(result.current.canPublish).toBe(false);

  await act(async () => { await result.current.validate(); });
  expect(io.validate).toHaveBeenCalledExactlyOnceWith(
    `/api/tenant/core/v1/templates/${TEMPLATE_ID}/validate`,
    expect.objectContaining({ draftRevision: 8 }),
    expect.objectContaining({ headers: expect.objectContaining({ "If-Match": refreshed.currentDraft.etag }) }),
  );
  expect(result.current.canPublish).toBe(true);
});

it("retains one Validate intent through a lost reply and a transient 503", async () => {
  const template = detail(4, 7);
  const onReload = vi.fn();
  const { result } = renderHook(() => useTemplateRelease(template, grants, onReload, null));
  mockValidation(template);
  io.validate.mockRejectedValueOnce(new TypeError("Failed to fetch"));
  io.validate.mockRejectedValueOnce(new TenantApiClientError("Service unavailable", {
    status: 503, statusText: "Service Unavailable", headers: new Headers(), data: {},
  }));

  await act(async () => { await result.current.validate(); });
  await act(async () => { await result.current.validate(); });
  expect(onReload).not.toHaveBeenCalled();
  expect(result.current.canPublish).toBe(false);
  await act(async () => { await result.current.validate(); });

  expect(io.validate).toHaveBeenCalledTimes(3);
  const [[path, body, { headers }], ...retries] = io.validate.mock.calls;
  expect(isUUIDv7(headers["x-idempotency-key"])).toBe(true);
  for (const [retryPath, retryBody, retry] of retries) {
    expect([retryPath, retryBody, retry.headers]).toEqual([path, body, headers]);
  }
  expect(onReload).toHaveBeenCalledOnce();
  expect(result.current.canPublish).toBe(true);
});

it("keeps a rejected revision fenced when release authority renews and offers reload until a newer draft arrives", async () => {
  const original = detail(4, 7);
  const newer = detail(4, 8);
  newer.currentDraft.contentChecksum = "b".repeat(64);
  const onReload = vi.fn();
  const { result, rerender } = renderHook(
    ({ template, owner }) => useTemplateRelease(template, grants, onReload, owner),
    { initialProps: { template: original, owner: versionAuthority("original") } },
  );
  io.validate.mockRejectedValueOnce(new TenantApiClientError("Stale revision", {
    status: 409, statusText: "Conflict", headers: new Headers(), data: { errorCode: STALE_REVISION_CODE },
  }));
  const oldValidate = result.current.validate;
  await act(async () => { await oldValidate(); });
  expect(result.current.validationNeedsReload).toBe(true);
  expect(onReload).toHaveBeenCalledOnce();

  const renewed = versionAuthority("renewed");
  rerender({ template: structuredClone(original), owner: renewed });
  expect(result.current.validationNeedsReload).toBe(true);
  await act(async () => { await result.current.validate(); });
  expect(io.validate).toHaveBeenCalledOnce();
  act(() => { result.current.reloadValidationDraft(); });
  expect(onReload).toHaveBeenCalledTimes(2);
  rerender({ template: detail(4, 6), owner: renewed });
  expect(result.current.validationNeedsReload).toBe(true);

  mockValidation(newer, { ...validationRun(8), id: OTHER_VERSION_ID });
  rerender({ template: newer, owner: renewed });
  expect(result.current.validationNeedsReload).toBe(false);
  await act(async () => { await oldValidate(); });
  expect(io.validate).toHaveBeenCalledOnce();
  await act(async () => { await result.current.validate(); });
  expect(io.validate).toHaveBeenCalledTimes(2);
  const [, body, options] = io.validate.mock.calls[1];
  expect(body.draftRevision).toBe(8);
  expect(options.headers["If-Match"]).toBe(newer.currentDraft.etag);
  expect(options.headers["x-idempotency-key"]).not.toBe(io.validate.mock.calls[0][2].headers["x-idempotency-key"]);
  expect(result.current.canPublish).toBe(true);
});

const restoreCorrelationId = "01900100-0000-7000-8000-000000000050";
const restoreMismatches = ["wrong template owner", "wrong draft owner", "wrong source owner",
  "wrong draft revision", "wrong body ETag", "weak header ETag", "missing header ETag",
  "wrong restored checksum", "old validation state", "retained validation run", "retained validated revision"] as const;

async function mockActualVersionRestore() {
  const lifecycle = await vi.importActual<typeof import("../../template-lifecycle-api")>("../../template-lifecycle-api");
  const core = await vi.importActual<typeof import("../../../core-api")>("../../../core-api");
  io.restore.mockImplementation(lifecycle.restoreTemplateVersion);
  io.post.mockImplementation(core.corePostResponse);
}

function restoreWire(url: URL, template: TemplateDetail, revision: number,
  mismatch?: typeof restoreMismatches[number] | "denied", replayed = false) {
  const etag = `"${revision}"`;
  const headers = new Headers({ ETag: etag, "X-Correlation-Id": restoreCorrelationId });
  const document = {
    schemaVersion: 1, documentType: template.documentType, dataSourceKey: template.dataSourceKey,
    layoutMode: template.layoutMode, outputChannel: template.outputChannel, locale: template.locale,
    direction: template.direction, theme: {}, rootNodeIds: [], nodes: {},
  };
  const draft = {
    templateId: mismatch === "wrong template owner" ? OTHER_VERSION_ID : template.id,
    draftId: mismatch === "wrong draft owner" ? OTHER_VERSION_ID : template.currentDraft.draftId,
    restoreSourceVersionId: mismatch === "wrong source owner" ? VERSION_ID : previousRow.id,
    revision: mismatch === "wrong draft revision" ? revision + 1 : revision,
    etag: mismatch === "wrong body ETag" ? `"${revision + 1}"` : etag,
    editorDocument: document,
    schemaVersion: 1, baseVersionId: null,
    contentChecksum: mismatch === "wrong restored checksum" ? "0".repeat(64)
      : createHash("sha256").update(canonicalJson(document)).digest("hex"),
    validation: {
      state: mismatch === "old validation state" ? "PASSED" : "STALE",
      lastValidationRunId: mismatch === "retained validation run" ? VERSION_ID : null,
      validatedDraftRevision: mismatch === "retained validated revision" ? template.currentDraft.revision : null,
      errorCount: 0, warningCount: 0,
    },
    updatedAt: template.updatedAt, updatedBy: { kind: "USER", actorId: TEMPLATE_ID, displayName: "Operator" },
  };
  if (mismatch === "weak header ETag") headers.set("ETag", "W/" + etag);
  if (replayed) headers.set("Idempotency-Replayed", "true");
  if (mismatch === "missing header ETag") {
    headers.delete("ETag");
    headers.delete("X-Correlation-Id");
  }
  const response = mismatch === "denied"
    ? Response.json({ success: false, statusCode: 403, errorCode: "GW.AUTH.FORBIDDEN" }, { status: 403, headers })
    : Response.json({ success: true, correlationId: restoreCorrelationId, data: { draft, migrationRecovery: null } },
      { status: 200, headers });
  Object.defineProperty(response, "url", { value: url.href });
  return response;
}

it("accepts an exact Sales Quotation Version Restore receipt on replay", async () => {
  const template = detail(4, 7);
  const owner = versionAuthority("restore-replay-owner");
  const onReload = vi.fn();
  await mockActualVersionRestore();
  const fetchRestore = vi.fn<typeof fetch>(async (input, init) => {
    expect(new Headers(init?.headers).get("if-match")).toBe('"7"');
    return restoreWire(new URL(String(input), window.location.origin), template, 8, undefined, true);
  });
  vi.stubGlobal("fetch", fetchRestore);
  const { result } = renderHook(() => useTemplateRelease(template, grants, onReload, owner));
  act(() => { result.current.openRestore(previousRow); });
  await act(async () => { await result.current.restoreVersion("Restore historical version"); });
  expect(fetchRestore).toHaveBeenCalledOnce();
  expect(toast.info).toHaveBeenCalledExactlyOnceWith("Earlier restore confirmed", "Loading the current draft.");
  expect(toast.success).not.toHaveBeenCalled();
  expect(onReload).toHaveBeenCalledOnce();
  expect(toast.errorFromApi).not.toHaveBeenCalled();
});

it.each([...restoreMismatches, "denied"] as const)(
  "rejects a Sales Quotation Version Restore receipt with %s",
  async failure => {
    arabicFeedback = failure === "wrong template owner";
    const template = detail(4, 7);
    const owner = versionAuthority("restore-owner");
    const onReload = vi.fn();
    await mockActualVersionRestore();
    const fetchRestore = vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input), window.location.origin);
      expect(url.pathname).toBe(`/api/tenant/core/v1/templates/${template.id}/versions/${previousRow.id}/restore`);
      expect(init?.method).toBe("POST");
      expect(new Headers(init?.headers).get("if-match")).toBe('"7"');
      expect(JSON.parse(String(init?.body))).toEqual({ reason: "Restore historical version", discardCurrentDraft: true });
      return restoreWire(url, template, 8, failure);
    });
    vi.stubGlobal("fetch", fetchRestore);
    const { result } = renderHook(() => useTemplateRelease(template, grants, onReload, owner));
    act(() => { result.current.openRestore(previousRow); });
    expect(result.current.restoring?.id).toBe(previousRow.id);
    await act(async () => { await result.current.restoreVersion("Restore historical version"); });
    expect(fetchRestore).toHaveBeenCalledOnce();
    expect(toast.success).not.toHaveBeenCalled();
    expect(onReload).not.toHaveBeenCalled();
    expect(result.current.restoring).toBeNull();
    expect(result.current.pendingVersionId).toBeNull();
    if (failure === "denied") {
      expect(toast.errorFromApi).not.toHaveBeenCalled();
    } else {
      const copy = (arabicFeedback ? ar : en).coreOperations.templates;
      expect(toast.errorFromApi).toHaveBeenCalledExactlyOnceWith(copy.versionRestoreFailed, {
        status: 0, message: copy.invalidLifecycleReply, correlationId: restoreCorrelationId,
      });
    }
  },
);

it.each(["before confirmation", "before acknowledgement", "before malformed acknowledgement", "before denied acknowledgement"] as const)(
  "binds a Sales Quotation version restore to the draft shown at confirmation (%s)",
  async timing => {
    const original = detail(4, 7);
    const inFlight = timing !== "before confirmation";
    const nextRevision = timing === "before acknowledgement" ? 9 : 8;
    const changedDraft = { ...original.currentDraft, revision: nextRevision, etag: `"${nextRevision}"`, contentChecksum: "b".repeat(64) };
    const next = { ...original, currentDraft: changedDraft, draft: changedDraft };
    const owner = versionAuthority("stable-definition");
    const onReload = vi.fn();
    await mockActualVersionRestore();
    const path = `/api/tenant/core/v1/templates/${original.id}/versions/${previousRow.id}/restore`;
    let finishOld!: (response: Response) => void;
    const url = new URL(path, window.location.origin);
    let restoreRequests = 0;
    const transport = vi.fn<typeof fetch>(async (input, init) => {
      const target = new URL(String(input), window.location.origin).pathname;
      if (target !== path || init?.method !== "POST") throw new Error(`Unexpected ${init?.method} ${target}`);
      return inFlight && ++restoreRequests === 1
        ? new Promise(resolve => { finishOld = resolve; })
        : restoreWire(url, next, nextRevision + 1);
    });
    vi.stubGlobal("fetch", transport);
    const { result, rerender } = renderHook(({ template }) => useTemplateRelease(template, grants, onReload, owner), {
      initialProps: { template: original },
    });
    act(() => { result.current.openRestore(previousRow); });
    expect(result.current.restoring?.id).toBe(previousRow.id);
    const retainedConfirm = result.current.restoreVersion;

    let oldRequest: Promise<void> | undefined;
    if (inFlight) {
      act(() => { oldRequest = retainedConfirm("Restore the selected version"); });
      await waitFor(() => expect(transport).toHaveBeenCalledOnce());
      expect(new Headers(transport.mock.calls[0][1]?.headers).get("if-match")).toBe('"7"');
    }
    rerender({ template: next });
    if (timing === "before confirmation") {
      await act(async () => { await result.current.restoreVersion("Restore the selected version"); });
      expect(transport).not.toHaveBeenCalled();
      await act(async () => { await retainedConfirm("Restore the selected version"); });
    } else {
      const mismatch = timing === "before malformed acknowledgement" ? "wrong template owner"
        : timing === "before denied acknowledgement" ? "denied" : undefined;
      const permissionDenial = vi.fn();
      const unsubscribe = subscribePermissionDenials(permissionDenial);
      try {
        await act(async () => { finishOld(restoreWire(url, original, 8, mismatch, !mismatch)); await oldRequest; });
        expect(permissionDenial).not.toHaveBeenCalled();
      } finally {
        unsubscribe();
      }
    }
    const priorCalls = inFlight ? 1 : 0;
    expect(transport).toHaveBeenCalledTimes(priorCalls);
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();
    expect(toast.errorFromApi).not.toHaveBeenCalled();
    expect(onReload).not.toHaveBeenCalled();
    expect(result.current.restoring).toBeNull();
    expect(result.current.pendingVersionId).toBeNull();

    act(() => { result.current.openRestore(previousRow); });
    await act(async () => { await result.current.restoreVersion("Confirm the new draft"); });
    expect(transport).toHaveBeenCalledTimes(priorCalls + 1);
    const [, request] = transport.mock.calls.at(-1)!;
    expect(new Headers(request?.headers).get("if-match")).toBe(changedDraft.etag);
    expect(JSON.parse(String(request?.body))).toEqual({ reason: "Confirm the new draft", discardCurrentDraft: true });
    expect(toast.success).toHaveBeenCalledExactlyOnceWith(en.coreOperations.templates.savedTitle, en.coreOperations.templates.versionRestored);
    expect(onReload).toHaveBeenCalledOnce();
  },
);

const schemaPublicationCode = "CORE.TEMPLATE.PUBLISH.VALIDATION_STALE";
const expectedSchemaPublicationCopy = {
  en: "The draft or its validation inputs changed. Validate the draft again before publishing.",
  ar: "تغيّرت المسودة أو أحد مدخلات التحقق. أعد التحقق من المسودة قبل النشر.",
};

describe("isolated schema dependency release controls", () => {
  beforeEach(() => { schemaControlProbe = true; });
  afterEach(() => { schemaControlProbe = false; });

  it.each([
    { lang: "en", status: 409 }, { lang: "ar", status: 409 },
    { lang: "en", status: 422 }, { lang: "ar", status: 422 },
  ] as const)("schema dependency Publish $lang $status blocks repeat Publish and leaves Validate ready", async ({ lang, status }) => {
    arabicFeedback = lang === "ar";
    const dictionary = arabicFeedback ? ar : en;
    const copy = dictionary.coreOperations.templates;
    const template = detail(4, 7);
    const onReload = vi.fn();
    mockValidation(template);
    function Panel() {
      const release = useTemplateRelease(template, grants, onReload, null);
      return createElement(TemplateReleasePanel, {template, release, canUpdate: true, canPublish: true});
    }
    render(createElement(Panel));
    const validate = screen.getByRole("button", { name: copy.validate }) as HTMLButtonElement;
    const publish = screen.getByRole("button", { name: copy.publish }) as HTMLButtonElement;
    expect(publish.disabled).toBe(true);
    await act(async () => { validate.click(); });
    expect(publish.disabled).toBe(false);
    toast.success.mockClear();
    onReload.mockClear();

    const rawMessage = status === 422 ? "The current draft no longer validates."
      : "The exact schema, compiler, renderer, or asset evidence changed after validation.";
    io.post.mockRejectedValue(new TenantApiClientError(rawMessage, {
      status, statusText: "Rejected", headers: new Headers(),
      data: { errorCode: schemaPublicationCode, correlationId: "schema-publication-fixture",
        message: rawMessage },
    }));
    await act(async () => { publish.click(); });
    expect.soft(publish.disabled).toBe(true);
    expect.soft(toast.errorFromApi).toHaveBeenCalledExactlyOnceWith(copy.publishFailed, expect.objectContaining({
      status, code: schemaPublicationCode, message: expectedSchemaPublicationCopy[lang], correlationId: "schema-publication-fixture",
    }));
    expect(toast.success).not.toHaveBeenCalled();
    expect(validate.disabled).toBe(false);
    expect(onReload).not.toHaveBeenCalled();
    await act(async () => { publish.click(); });
    expect.soft(io.post).toHaveBeenCalledOnce();
    expect(io.post).toHaveBeenNthCalledWith(1, `/api/tenant/core/v1/templates/${template.id}/publish`, {
      definitionRevision: template.definitionRevision, draftRevision: template.currentDraft.revision,
      validationRunId: validationRun(7).id, setAsDefinitionPublished: true,
    }, expect.any(Object));
    expect(new Headers(io.post.mock.calls[0][2].headers).get("If-Match")).toBe(template.currentDraft.etag);

    mockValidation(template, { ...validationRun(7), id: OTHER_VERSION_ID });
    await act(async () => { validate.click(); });
    expect(publish.disabled).toBe(false);
  });

  it.each(["en", "ar"] as const)("schema dependency Validate %s shows localized failed diagnostics and disables Publish", async lang => {
    arabicFeedback = lang === "ar";
    const dictionary = arabicFeedback ? ar : en;
    const copy = dictionary.coreOperations.templates;
    const template = detail(4, 7);
    const onReload = vi.fn();
    mockValidation(template);
    function Panel() {
      const release = useTemplateRelease(template, grants, onReload, null);
      return createElement(TemplateReleasePanel, {template, release, canUpdate: true, canPublish: true});
    }
    render(createElement(Panel));
    const validate = screen.getByRole("button", {name: copy.validate}) as HTMLButtonElement;
    const publish = screen.getByRole("button", {name: copy.publish}) as HTMLButtonElement;
    await act(async () => { validate.click(); });
    expect(publish.disabled).toBe(false);

    const code = "CORE.TEMPLATE.VALIDATION.FAILED";
    const failed = validationResponse(template, { ...validationRun(7), id: OTHER_VERSION_ID, status: "FAILED" });
    io.validate.mockResolvedValue({ ...failed, data: { ...failed.data, data: { ...failed.data.data, issues: [{
      severity: "ERROR", code, nodeId: null, messageKey: "template.validation.failed", jsonPointer: "", params: {},
    }] } } });
    await act(async () => { validate.click(); });
    expect(screen.getByText(dictionary.coreOperations.errors[code])).toBeVisible();
    expect(publish.disabled).toBe(true);
    expect(validate.disabled).toBe(false);
    expect(io.post).not.toHaveBeenCalled();
  });
});
