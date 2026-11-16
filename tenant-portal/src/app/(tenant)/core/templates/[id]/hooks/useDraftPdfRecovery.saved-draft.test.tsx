// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { createDesignerCommandStore } from "../../designer-command-store";
import { createDesignerLocalSessions } from "../../designer-local-sessions";
import { createDesignerInteractionExit } from "../../designer-interaction-exit";
import type { AcceptedPdfPreview } from "../../template-preview-session-contract";
import { useDraftPdfRecovery } from "./useDraftPdfRecovery";
import { useTemplateDesignPdfPort, type TemplateDesignPdfPortInput } from "./useTemplateDesignPdfPort";
import { useTemplatePdfSession } from "./useTemplatePdfSession";

const io = vi.hoisted(() => ({
  profile: { user: { id: "actor" }, sequence: 1 }, notify: new Set<() => void>(),
  create: vi.fn(), read: vi.fn(), definition: vi.fn(),
}));
vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ authState: "AUTHENTICATED", user: io.profile.user, realtimeAuthGeneration: "tenant:session:actor",
    readProfileCommit: () => io.profile, readReadyProfileCommit: () => io.profile,
    subscribeProfileReadiness: (listener: () => void) => {
      io.notify.add(listener);
      return () => io.notify.delete(listener);
    },
  }),
}));
vi.mock("@/lib/api/axiosClient", () => ({ getStoredTenantSessionMeta: () => ({ sessionId: "session" }) }));
vi.mock("@/lib/auth/permission-scope", () => ({ can: () => true }));
vi.mock("@/lib/api/errors", () => ({ normalizeApiError: (error: unknown) => error }));
vi.mock("../../templates-api", () => ({ fetchTemplate: io.definition }));
vi.mock("../../template-preview-session-api", () => ({
  createPinnedPdfPreview: io.create, readPinnedPdfPreview: io.read, fetchPinnedPdfArtifact: vi.fn(),
}));

it("blocks the held job while draft-save recovery is unresolved and resumes only after the fresh pin and profile", async () => {
  const id = "01900100-0000-7000-8000-000000000001";
  const draftId = "01900100-0000-7000-8000-000000000002";
  const jobId = "01900100-0000-7000-8000-000000000003";
  const pin = { draftId, revision: 4, validationState: "PASSED", contentChecksum: "a".repeat(64), etag: '"4"' } as const;
  const template: TemplateDesignPdfPortInput["template"] = {
    id, code: "QUOTE", name: "Quotation", description: null, documentType: "QUOTATION", outputChannel: "PRINT",
    layoutMode: "HYBRID_DOCUMENT", lifecycleStatus: "ACTIVE", locale: "en-US", direction: "LTR",
    dataSourceKey: "TRADE_QUOTATION_PRINT_V1", scope: { type: "TENANT" }, systemProtected: false,
    definitionRevision: 2, definitionEtag: '"2"', etag: '"2"', draft: pin, currentPublishedVersion: null,
    currentDraft: pin, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  const accepted: AcceptedPdfPreview = {
    templateId: id, draftId, draftRevision: 4, templateContentChecksum: pin.contentChecksum,
    compiledArtifactChecksum: "b".repeat(64), renderJobId: jobId, status: "PENDING",
    createdAt: template.createdAt, expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
  const commandStore = createDesignerCommandStore();
  const localSessions = createDesignerLocalSessions("test-editor");
  const draft: NonNullable<TemplateDesignPdfPortInput["editor"]["draft"]> = {
    draftId, templateId: id, revision: pin.revision, etag: pin.etag,
    editorDocument: { schemaVersion: 1, rootNodeIds: [], nodes: {}, theme: {}, direction: "LTR" },
  };
  commandStore.reset(draft.editorDocument);
  const ticket = { bridgeKey: "test-editor", generation: commandStore.getSnapshot().generation };
  const interactionExit = createDesignerInteractionExit(ticket, () => ticket);
  const editor: TemplateDesignPdfPortInput["editor"] = {
    draft, schema: { syntheticFixtures: [{ fixtureKey: "quotation-minimal-en", locale: "en-US" }] },
    loading: false, dirty: false, hasPending: false, conflict: false, gestureActive: false,
    isCurrentAuthority: () => true, commandStore, localSessions, localPending: false, localSessionEpoch: 0,
    interactionExit, interactionBridge: { context: () => ({ key: "test-editor", canRead: true }) },
  };
  io.definition.mockResolvedValue(template);
  io.create.mockResolvedValue(accepted);
  io.read.mockRejectedValueOnce({ status: 403 }).mockResolvedValue({ ...accepted,
    lifecycleRevision: 1, attemptCount: 0, artifact: null, nextRetryAt: null, failureCode: null });
  const route = renderHook(() => useDraftPdfRecovery(id));
  const openPort = (hasPending: boolean) => renderHook(({ pending }) => useTemplatePdfSession(useTemplateDesignPdfPort({
    template, editor: { ...editor, hasPending: pending }, canPreview: true, reload: vi.fn(),
    draftPdfRecovery: route.result.current,
  })), { initialProps: { pending: hasPending } });

  const original = openPort(false);
  await waitFor(() => expect(original.result.current.canCreate).toBe(true));
  await act(async () => { await original.result.current.start(); });
  expect(original.result.current.status).toBe("denied");
  original.unmount();

  const remounted = openPort(true);
  act(() => {
    io.profile = { ...io.profile, sequence: 2 };
    io.notify.forEach(listener => listener());
  });
  expect(remounted.result.current.canResume).toBe(false);
  await act(async () => { await remounted.result.current.resume(); });
  expect(io.read).toHaveBeenCalledTimes(1);

  remounted.rerender({ pending: false });
  await waitFor(() => expect(remounted.result.current.canResume).toBe(true));
  await act(async () => { await remounted.result.current.resume(); });
  expect(io.read).toHaveBeenLastCalledWith(accepted, expect.any(AbortSignal));
  expect(io.read).toHaveBeenCalledTimes(2);
  expect(io.create).toHaveBeenCalledTimes(1);
  remounted.unmount();
  route.unmount();
});
