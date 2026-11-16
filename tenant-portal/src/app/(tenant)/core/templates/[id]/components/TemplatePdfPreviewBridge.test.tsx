// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { templatePreviewMessages } from "@/i18n/dictionaries/template-preview";
import { useTemplatePdfSession, type TemplatePdfSessionInput } from "../hooks/useTemplatePdfSession";
import { currentPreviewCapabilities } from "../../template-preview-availability";
import { TemplatePdfPreviewBridge } from "./TemplatePdfPreviewBridge";

const { useI18n } = vi.hoisted(() => ({ useI18n: vi.fn() }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: null }) }));
vi.mock("../hooks/useTemplatePdfSession", () => ({ useTemplatePdfSession: vi.fn() }));

const templateId = "01900100-0000-7000-8000-000000000001";
const draftId = "01900100-0000-7000-8000-000000000002";
const draft = { draftId, revision: 3, validationState: "PASSED" } as const;
const input: TemplatePdfSessionInput = {
  template: {
    id: templateId, dataSourceKey: "TRADE_QUOTATION_PRINT_V1", outputChannel: "PRINT", layoutMode: "HYBRID_DOCUMENT",
    code: "QUOTE", name: "Quotation", description: null, documentType: "QUOTATION", lifecycleStatus: "ACTIVE",
    direction: "LTR", systemProtected: false, definitionRevision: 2, definitionEtag: '"2"', etag: '"2"',
    currentPublishedVersion: null, draft, createdAt: "2026-11-10T10:00:00.000Z", updatedAt: "2026-11-10T10:00:00.000Z",
    locale: "en-US", scope: { type: "TENANT" },
    currentDraft: { ...draft, contentChecksum: "a".repeat(64), etag: '"3"' },
  },
  draft: { templateId, draftId, revision: 3 },
  schema: { syntheticFixtures: [{ fixtureKey: "quotation-minimal-en", locale: "en-US" }] }, canPreview: true, blocked: false,
  current: () => true, reload: vi.fn(), lifetime: {},
};

const session: ReturnType<typeof useTemplatePdfSession> = {
  status: "idle", fixtures: [{ fixtureKey: "quotation-minimal-en", locale: "en-US" }],
  fixtureKey: "quotation-minimal-en", setFixture: vi.fn(), start: vi.fn(), recover: vi.fn(),
  resume: vi.fn(), stop: vi.fn(), download: vi.fn(), job: null, capabilities: currentPreviewCapabilities,
  refresh: vi.fn(), revision: 3, attempts: null, nextRetryAt: null, filename: null,
  canCreate: true, canResume: false, canRefresh: false, canChooseFixture: true,
};
const completedJob: NonNullable<typeof session.job> = {
  templateId, draftId, draftRevision: draft.revision, templateContentChecksum: input.template.currentDraft.contentChecksum,
  renderJobId: "01900100-0000-7000-8000-000000000003", status: "COMPLETED", lifecycleRevision: 2,
  compiledArtifactChecksum: "b".repeat(64), attemptCount: 1, failureCode: null, nextRetryAt: null,
  createdAt: "2026-11-10T10:00:00.000Z", expiresAt: "2026-11-10T10:15:00.000Z",
  artifact: {
    downloadUrl: "/api/tenant/core/v1/templates/preview-jobs/01900100-0000-7000-8000-000000000003/artifact",
    downloadUrlExpiresAt: "2026-11-10T11:00:00.000Z", checksum: "c".repeat(64), sizeBytes: 1200,
    pageCount: 1, rendererVersion: "renderer-1", browserBuildFingerprint: "chromium-pinned",
  },
};
const useSession = vi.mocked(useTemplatePdfSession);

afterEach(cleanup);

describe("Sales Quotation draft PDF focus", () => {
  it.each([["en", "ltr", en], ["ar", "rtl", ar]] as const)(
    "recovers displaced focus into a localized region in %s",
    (lang, dir, dictionary) => {
      const copy = templatePreviewMessages[lang];
      useI18n.mockReturnValue({ lang, dir, t: dictionary });
      useSession.mockReturnValue(session);
      const { rerender } = render(<TemplatePdfPreviewBridge {...input} />);
      const region = screen.getByRole("region", { name: copy.title });
      const create = screen.getByRole("button", { name: copy.create });
      create.focus();
      expect(create).toHaveFocus();

      useSession.mockReturnValue({ ...session, status: "pending", canCreate: false, canChooseFixture: false });
      rerender(<TemplatePdfPreviewBridge {...input} />);
      expect(create).toBeDisabled();
      expect(create).toHaveAccessibleName(copy.create);
      expect(screen.getByRole("status")).toHaveTextContent(copy.draftFeedback.pending);
      expect(region).toHaveFocus();
      expect(region).toHaveAttribute("tabindex", "-1");

      const stop = screen.getByRole("button", { name: copy.stop });
      stop.focus();
      useSession.mockReturnValue({ ...session, status: "paused", canCreate: false, canChooseFixture: false, canResume: true });
      rerender(<TemplatePdfPreviewBridge {...input} />);
      expect(stop).not.toBeInTheDocument();
      expect(region).toHaveFocus();
      expect(screen.getByRole("button", { name: copy.resume })).toBeEnabled();
    },
  );

  it("leaves focus outside the PDF preview when background status changes", () => {
    useI18n.mockReturnValue({ lang: "en", dir: "ltr", t: en });
    const pending = { ...session, status: "pending", canCreate: false, canChooseFixture: false } as const;
    useSession.mockReturnValue(pending);
    const view = () => <><button type="button">Outside preview</button><TemplatePdfPreviewBridge {...input} /></>;
    const { rerender } = render(view());
    const outside = screen.getByRole("button", { name: "Outside preview" });
    outside.focus();

    useSession.mockReturnValue({ ...pending, status: "paused", canResume: true });
    rerender(view());
    expect(screen.getByRole("button", { name: templatePreviewMessages.en.resume })).toBeEnabled();
    expect(outside).toHaveFocus();
  });

  it.each(["pending", "retrying"] as const)("moves focus from Stop to Download when %s finishes", status => {
    const copy = templatePreviewMessages.en;
    useI18n.mockReturnValue({ lang: "en", dir: "ltr", t: en });
    const polling = { ...session, status, canCreate: false, canChooseFixture: false };
    useSession.mockReturnValue(polling);
    const { rerender } = render(<TemplatePdfPreviewBridge {...input} />);
    screen.getByRole("button", { name: copy.stop }).focus();

    useSession.mockReturnValue({ ...polling, status: "completed", job: completedJob });
    rerender(<TemplatePdfPreviewBridge {...input} />);
    expect(screen.getByRole("button", { name: copy.download })).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent(copy.states.completed);
  });

  it.each([
    { lang: "en", failure: "expired" }, { lang: "ar", failure: "expired" },
    { lang: "en", failure: "invalid" }, { lang: "ar", failure: "invalid" },
    { lang: "en", failure: "denied" }, { lang: "ar", failure: "denied" },
  ] as const)("keeps focus during the download check and announces $failure in $lang", ({ lang, failure }) => {
    const copy = templatePreviewMessages[lang];
    const dictionary = { en, ar }[lang];
    const dir = { en: "ltr", ar: "rtl" }[lang];
    const download = vi.fn();
    const ready = { ...session, status: "completed", job: completedJob, canCreate: false, canChooseFixture: false, download } as const;
    useI18n.mockReturnValue({ lang, dir, t: dictionary });
    useSession.mockReturnValue(ready);
    const view = () => <div lang={lang} dir={dir}><TemplatePdfPreviewBridge {...input} /></div>;
    const { rerender } = render(view());
    const button = screen.getByRole("button", { name: copy.download });
    button.focus();
    fireEvent.click(button);
    expect(download).toHaveBeenCalledOnce();

    useSession.mockReturnValue({ ...ready, status: "checking" });
    rerender(view());
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(button);
    expect(download).toHaveBeenCalledOnce();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(copy.states.checking);
    expect(screen.queryByRole("alert")).toBeNull();

    useSession.mockReturnValue({ ...ready, status: failure, job: null, canCreate: failure !== "denied", canChooseFixture: failure !== "denied" });
    rerender(view());
    expect(button).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: copy.title })).toHaveFocus();
    expect(screen.queryByText(copy.states.checking)).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent(failure === "denied" ? dictionary.permissionGate.description : copy.states[failure]);
  });

  it("discards the old preview focus and announcement when the draft pin changes within the host", () => {
    const copy = templatePreviewMessages.en;
    useI18n.mockReturnValue({ lang: "en", dir: "ltr", t: en });
    useSession.mockReturnValue({ ...session, status: "pending", canCreate: false, canChooseFixture: false });
    const { rerender } = render(<TemplatePdfPreviewBridge {...input} />);
    screen.getByRole("button", { name: copy.stop }).focus();
    const announcement = screen.getByRole("status");
    expect(announcement).toHaveTextContent(copy.draftFeedback.pending);

    const nextDraft = { ...input.template.currentDraft, revision: 4, contentChecksum: "d".repeat(64) };
    useSession.mockReturnValue({ ...session, revision: nextDraft.revision });
    rerender(<TemplatePdfPreviewBridge {...input} template={{ ...input.template, currentDraft: nextDraft }}
      draft={{ templateId, draftId, revision: nextDraft.revision }} />);
    expect(screen.getByRole("status")).toBe(announcement);
    expect(announcement).toHaveTextContent(copy.states.idle);
    expect(announcement).not.toHaveTextContent(copy.draftFeedback.pending);
    expect(screen.getByRole("region", { name: copy.title })).not.toHaveFocus();
    expect(screen.queryByRole("button", { name: copy.download })).toBeNull();
  });

  it.each([
    { lifetime: {} },
    { current: () => false },
  ] satisfies Partial<TemplatePdfSessionInput>[])("requires the same current draft owner to restore focus (%o)", changedInput => {
    const copy = templatePreviewMessages.en;
    useI18n.mockReturnValue({ lang: "en", dir: "ltr", t: en });
    useSession.mockReturnValue({ ...session, status: "pending", canCreate: false });
    const { rerender } = render(<TemplatePdfPreviewBridge {...input} />);
    const stop = screen.getByRole("button", { name: copy.stop });
    stop.focus();
    expect(stop).toHaveFocus();

    useSession.mockReturnValue({ ...session, status: "preparing", canCreate: false });
    rerender(<TemplatePdfPreviewBridge {...input} {...changedInput} />);
    expect(stop).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: copy.title })).not.toHaveFocus();
  });
});
