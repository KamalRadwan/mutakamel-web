// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/design-system";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import type { EmailConflictReview } from "../email-config-conflict";
import {
  buildPatchEmailConfigRequest,
  toEmailConfigForm,
  type EmailConfig,
  type EmailConfigFormValues,
} from "../email-config-contract";
import type { EmailConfigFieldErrors } from "../email-config-messages";
import type { EmailModalKind } from "../email-form-navigation";
import type { EmailConflictKind } from "../hooks/useEmailConfig";
import { EmailConfigWorkspace } from "./email-workspace";

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
if (typeof Element.prototype.scrollIntoView === "undefined") {
  Element.prototype.scrollIntoView = () => {};
}

const baseConfig: EmailConfig = {
  revision: 5,
  fromAddress: "noreply@acme.example",
  fromName: "Acme",
  replyTo: null,
  senderDomain: "acme.example",
  providerDriver: "smtp",
  credentialsMode: "TENANT_ENCRYPTED_SMTP",
  providerCredentialsConfigured: true,
  providerCredentialsVersion: 1,
  providerCredentialsRefFingerprint: "fp-internal-secret-id",
  smtpHost: "smtp.acme.example",
  smtpPort: 587,
  smtpSecure: true,
  smtpProtocol: "smtp",
  smtpUsername: "mailer",
  smtpPasswordConfigured: true,
  feedbackProfile: "CRM_FEEDBACK_V1",
  dkimSelector: "s1",
  dkimVerified: false,
  verifiedAt: null,
  planDailyQuota: 2000,
  planRateLimitPerMin: 120,
  planQuotaRevision: 1,
  dailyQuota: 1000,
  rateLimitPerMin: 60,
  effectiveDailyQuota: 1000,
  effectiveRateLimitPerMin: 60,
  status: "SUSPENDED",
  updatedAt: "2026-10-20T10:00:00.000Z",
};

const state = vi.hoisted(() => ({
  lang: "en" as "en" | "ar",
  canManage: true,
  activeModal: null as EmailModalKind | null,
  pending: null as "save" | "verify" | "probe" | null,
  probeOutcome: null as { status: "succeeded" | "failed"; message: string } | null,
  isDirty: false,
  isDiscardOpen: false,
  isNotReady: false,
  isAccessBlocked: false,
  isForbidden: false,
  conflict: null as EmailConflictKind | null,
  conflictReview: null as EmailConflictReview | null,
  isConflictLoading: false,
  config: null as EmailConfig | null,
  draft: null as EmailConfigFormValues | null,
  fieldErrors: {} as EmailConfigFieldErrors,
  formError: null as string | null,
  router: {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  },
  openModal: vi.fn(),
  closeModal: vi.fn(),
  updateDraft: vi.fn(),
  discardDraft: vi.fn(),
  confirmDiscard: vi.fn(),
  cancelDiscard: vi.fn(),
  save: vi.fn(),
  setDeliveryStatus: vi.fn(),
  verify: vi.fn(),
  verifyConnection: vi.fn(),
  reload: vi.fn(),
  resolveConflict: vi.fn(),
  adoptConflictLatest: vi.fn(),
  discardConflictDraft: vi.fn(),
  dismissConflict: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => state.router,
}));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({
    lang: state.lang,
    dir: ({ en: "ltr", ar: "rtl" } as const)[state.lang],
    t: ({ en, ar })[state.lang],
    setLang: vi.fn(),
    toggleLang: vi.fn(),
  }),
}));

vi.mock("@/i18n/useLanguage", () => ({
  useDictionary: () => ({ en, ar })[state.lang],
  useLanguage: () => state.lang,
  useDirection: () => ({ en: "ltr", ar: "rtl" } as const)[state.lang],
}));

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({
    user: { permissions: ["workspace.email.read", "workspace.email.manage"] },
  }),
}));

vi.mock("../hooks/useEmailConfig", () => ({
  useEmailConfig: () => ({
    t: ({ en, ar })[state.lang],
    lang: state.lang,
    canManage: state.canManage,
    config: state.config,
    baseline: state.config,
    draft: state.draft,
    revision: state.config?.revision ?? null,
    activeModal: state.activeModal,
    isLoading: false,
    pending: state.pending,
    probeOutcome: state.probeOutcome,
    isDirty: state.isDirty,
    isDiscardOpen: state.isDiscardOpen,
    isNotReady: state.isNotReady,
    isAccessBlocked: state.isAccessBlocked,
    isForbidden: state.isForbidden,
    loadError: null,
    hasLoadError: false,
    loadErrorMessage: undefined,
    fieldErrors: state.fieldErrors,
    formError: state.formError,
    conflict: state.conflict,
    conflictReview: state.conflictReview,
    isConflictLoading: state.isConflictLoading,
    openModal: state.openModal,
    closeModal: state.closeModal,
    updateDraft: state.updateDraft,
    discardDraft: state.discardDraft,
    confirmDiscard: state.confirmDiscard,
    cancelDiscard: state.cancelDiscard,
    dismissConflict: state.dismissConflict,
    resolveConflict: state.resolveConflict,
    adoptConflictLatest: state.adoptConflictLatest,
    discardConflictDraft: state.discardConflictDraft,
    setDeliveryStatus: state.setDeliveryStatus,
    save: state.save,
    verify: state.verify,
    verifyConnection: state.verifyConnection,
    reload: state.reload,
  }),
}));

vi.mock("@/design-system", async () => ({
  ...(await import("@/design-system/lib/cn")),
  ...(await import("@/design-system/lib/icons")),
  ...(await import("@/design-system/lib/variants")),
  ...(await import("@/design-system/primitives/Badge")),
  ...(await import("@/design-system/primitives/Button")),
  ...(await import("@/design-system/primitives/Card")),
  ...(await import("@/design-system/primitives/CopyButton")),
  ...(await import("@/design-system/primitives/DateTime")),
  ...(await import("@/design-system/primitives/Dialog")),
  ...(await import("@/design-system/primitives/Field")),
  ...(await import("@/design-system/primitives/IdentifierText")),
  ...(await import("@/design-system/primitives/Input")),
  ...(await import("@/design-system/primitives/Select")),
  ...(await import("@/design-system/primitives/Skeleton")),
  ...(await import("@/design-system/primitives/Switch")),
  ...(await import("@/design-system/primitives/Table")),
  ...(await import("@/design-system/primitives/Tooltip")),
  ...(await import("@/design-system/patterns/confirm-action/ConfirmActionModal")),
  ...(await import("@/design-system/patterns/conflict-dialog/ConflictDialog")),
  ...(await import("@/design-system/patterns/empty-state/EmptyState")),
  ...(await import("@/design-system/patterns/error-state/ErrorState")),
  ...(await import("@/design-system/patterns/form-modal/FormModal")),
  ...(await import("@/design-system/patterns/permission-gate/PermissionGate")),
  PageHeader: ({
    primaryAction,
    secondaryActions,
  }: {
    primaryAction?: { label: string; onClick: () => void; disabled?: boolean };
    secondaryActions?: ReactNode;
  }) => (
    <div>
      {primaryAction ? (
        <button
          type="button"
          onClick={primaryAction.onClick}
          disabled={primaryAction.disabled}
        >
          {primaryAction.label}
        </button>
      ) : null}
      {secondaryActions}
    </div>
  ),
}));

function renderWorkspace() {
  return render(
    <TooltipProvider>
      <EmailConfigWorkspace />
    </TooltipProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  state.lang = "en";
  state.canManage = true;
  state.activeModal = null;
  state.pending = null;
  state.probeOutcome = null;
  state.isDirty = false;
  state.isDiscardOpen = false;
  state.isNotReady = false;
  state.isAccessBlocked = false;
  state.isForbidden = false;
  state.conflict = null;
  state.conflictReview = null;
  state.isConflictLoading = false;
  state.config = baseConfig;
  state.draft = toEmailConfigForm(baseConfig);
  state.fieldErrors = {};
  state.formError = null;
});

afterEach(cleanup);

describe.each(["en", "ar"] as const)("EmailConfigWorkspace in %s", (lang) => {
  it("renders 5 compact summary rows without inline forms or developer credential/feedback leaks and opens matching modals", () => {
    state.lang = lang;
    const t = ({ en, ar })[lang];

    renderWorkspace();

    expect(screen.getByRole("region", { name: t.coreSettings.emailSenderTitle })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: t.coreSettings.emailProviderTitle })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: t.coreSettings.emailVerificationTitle })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: t.coreSettings.emailDeliveryStatusTitle })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: t.coreSettings.emailLimitsTitle })).toBeInTheDocument();

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(
      screen.queryByText(t.coreSettings.emailCredentialsModes.TENANT_ENCRYPTED_SMTP),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("CRM_FEEDBACK_V1")).not.toBeInTheDocument();
    expect(screen.queryByText("fp-internal-secret-id")).not.toBeInTheDocument();
    expect(screen.getByText("1,000")).toBeInTheDocument();
    expect(screen.getByText("60")).toBeInTheDocument();

    // Header primary action opens Sender modal.
    fireEvent.click(screen.getByRole("button", { name: t.coreSettings.emailEditSettings }));
    expect(state.openModal).toHaveBeenCalledWith("sender");

    // Provider row Edit opens SMTP modal when providerDriver is smtp.
    const providerRow = screen.getByRole("region", { name: t.coreSettings.emailProviderTitle });
    fireEvent.click(within(providerRow).getByRole("button", { name: t.coreSettings.emailEditAction }));
    expect(state.openModal).toHaveBeenCalledWith("smtp");

    // Verification row DNS details opens DNS modal.
    const verificationRow = screen.getByRole("region", { name: t.coreSettings.emailVerificationTitle });
    fireEvent.click(
      within(verificationRow).getByRole("button", { name: t.coreSettings.emailDnsDetailsAction }),
    );
    expect(state.openModal).toHaveBeenCalledWith("dns");
  });

  it("renders compact Sender, SMTP, Existing Provider, and DNS modals with one primary action and truthful password/DNS states", () => {
    state.lang = lang;
    const t = ({ en, ar })[lang];

    // 1. Sender modal: compact fields, no extra status selector, PageHeader primary hidden.
    state.activeModal = "sender";
    state.fieldErrors = { fromAddress: t.coreSettings.emailFormFromAddress };
    const { rerender } = renderWorkspace();

    expect(screen.queryByRole("button", { name: t.coreSettings.emailEditSettings })).not.toBeInTheDocument();
    const senderDialog = screen.getByRole("dialog", { name: t.coreSettings.emailSenderModalTitle });
    expect(within(senderDialog).getByLabelText(new RegExp(t.coreSettings.emailFromName))).toBeInTheDocument();
    expect(within(senderDialog).getByLabelText(new RegExp(t.coreSettings.emailSenderDomain))).toBeInTheDocument();
    expect(within(senderDialog).getByRole("combobox", { name: t.coreSettings.emailProvider })).toBeInTheDocument();
    expect(within(senderDialog).queryByLabelText(new RegExp(t.common.status))).not.toBeInTheDocument();
    expect(within(senderDialog).getByRole("alert")).toHaveTextContent(t.coreSettings.emailFormFromAddress);

    // 2. SMTP modal: 6 connection controls only, Configured badge + blank password, saved-only probe.
    state.activeModal = "smtp";
    state.fieldErrors = {};
    rerender(<TooltipProvider><EmailConfigWorkspace /></TooltipProvider>);

    const smtpDialog = screen.getByRole("dialog", { name: t.coreSettings.emailSmtpModalTitle });
    expect(within(smtpDialog).queryByRole("combobox", { name: t.coreSettings.emailProvider })).not.toBeInTheDocument();
    expect(within(smtpDialog).getByLabelText(new RegExp(t.coreSettings.emailSmtpHost))).toBeInTheDocument();
    const passwordInput = within(smtpDialog).getByLabelText(new RegExp(t.coreSettings.emailSmtpPassword));
    expect(passwordInput).toHaveValue("");
    expect(passwordInput).toHaveAttribute(
      "placeholder",
      t.coreSettings.emailPasswordKeepSavedPlaceholder,
    );
    expect(within(smtpDialog).getByText(t.coreSettings.emailConfigured)).toBeInTheDocument();
    const probeButton = within(smtpDialog).getByRole("button", {
      name: t.coreSettings.emailVerifyConnection,
    });
    expect(probeButton).not.toBeDisabled();

    state.isDirty = true;
    rerender(<TooltipProvider><EmailConfigWorkspace /></TooltipProvider>);
    expect(
      within(screen.getByRole("dialog", { name: t.coreSettings.emailSmtpModalTitle })).getByRole(
        "button",
        { name: t.coreSettings.emailVerifyConnection },
      ),
    ).toBeDisabled();

    // 3. Existing/legacy provider modal (SES): readable, no credential editor, Activate switch gated by DKIM.
    state.isDirty = false;
    state.config = { ...baseConfig, providerDriver: "ses", dkimVerified: false, status: "SUSPENDED" };
    state.draft = toEmailConfigForm(state.config);
    state.activeModal = "provider";
    rerender(<TooltipProvider><EmailConfigWorkspace /></TooltipProvider>);

    const providerDialog = screen.getByRole("dialog", {
      name: t.coreSettings.emailExistingProviderModalTitle,
    });
    expect(within(providerDialog).getByText(t.coreSettings.emailExistingProviderNotice)).toBeInTheDocument();
    expect(within(providerDialog).queryByLabelText(new RegExp(t.coreSettings.emailSmtpPassword))).not.toBeInTheDocument();
    expect(
      within(providerDialog).getByRole("switch", { name: t.coreSettings.emailDeliveryStatusTitle }),
    ).toBeDisabled();

    // 4. DNS modal: derived host copyable, explicit unavailable TXT value notice, no SPF claim.
    state.config = baseConfig;
    state.draft = toEmailConfigForm(baseConfig);
    state.activeModal = "dns";
    rerender(<TooltipProvider><EmailConfigWorkspace /></TooltipProvider>);

    const dnsDialog = screen.getByRole("dialog", { name: t.coreSettings.emailDnsTitle });
    const hostElement = within(dnsDialog).getByText("s1._domainkey.acme.example");
    expect(hostElement.tagName.toLowerCase()).toBe("bdi");
    expect(hostElement).toHaveAttribute("dir", "ltr");
    expect(
      within(dnsDialog).getByRole("button", {
        name: `${t.coreSettings.emailCopyValue}: ${t.coreSettings.emailDkimHost}`,
      }),
    ).toBeInTheDocument();
    expect(
      within(dnsDialog).getByText(t.coreSettings.emailDnsValueUnavailableNote),
    ).toBeInTheDocument();
    expect(within(dnsDialog).queryByText(/SPF/u)).not.toBeInTheDocument();
  });

  it("wires dirty Discard/Reload actions, delivery status kill-switch, read-only mode, and 428/409 conflict review", () => {
    state.lang = lang;
    const t = ({ en, ar })[lang];

    // Active verified config allows emergency suspension via Delivery Status switch.
    state.config = { ...baseConfig, dkimVerified: true, status: "ACTIVE" };
    state.draft = toEmailConfigForm(state.config);
    const { rerender } = renderWorkspace();

    const statusRow = screen.getByRole("region", { name: t.coreSettings.emailDeliveryStatusTitle });
    fireEvent.click(within(statusRow).getByRole("switch", { name: t.coreSettings.emailDeliveryStatusTitle }));
    expect(state.setDeliveryStatus).toHaveBeenCalledWith("SUSPENDED");

    // Read-only mode hides write actions while keeping DNS details accessible.
    state.canManage = false;
    rerender(<TooltipProvider><EmailConfigWorkspace /></TooltipProvider>);
    expect(screen.getByText(t.common.readOnly)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.coreSettings.emailEditSettings })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.coreSettings.emailVerify })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.coreSettings.emailDnsDetailsAction })).toBeInTheDocument();

    // Dirty state on summary shows Discard, save-before-verify hint, and ConfirmActionModal.
    state.canManage = true;
    state.isDirty = true;
    rerender(<TooltipProvider><EmailConfigWorkspace /></TooltipProvider>);
    expect(screen.getByText(t.coreSettings.emailSaveBeforeVerifyHint)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.coreSettings.emailVerify })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: t.coreSettings.workspaceUi.discard }));
    expect(state.discardDraft).toHaveBeenCalledTimes(1);

    state.isDiscardOpen = true;
    rerender(<TooltipProvider><EmailConfigWorkspace /></TooltipProvider>);
    expect(screen.getByRole("alertdialog", { name: t.common.discardTitle })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t.common.discardConfirm }));
    expect(state.confirmDiscard).toHaveBeenCalledTimes(1);

    // 409 Stale revision review dialog shows changed-field comparison and explicit adoption CTA.
    state.isDiscardOpen = false;
    state.conflict = "staleRevision";
    rerender(<TooltipProvider><EmailConfigWorkspace /></TooltipProvider>);
    const initialConflictDialog = screen.getByRole("dialog", { name: t.coreSettings.emailStaleTitle });
    fireEvent.click(
      within(initialConflictDialog).getByRole("button", {
        name: t.coreSettings.emailConflictReviewAction,
      }),
    );
    expect(state.resolveConflict).toHaveBeenCalledTimes(1);

    state.conflictReview = {
      latestConfig: { ...baseConfig, revision: 12, fromName: "Server Updated" },
      latestRevision: 12,
      diffRows: [
        {
          key: "fromName",
          label: t.coreSettings.emailFromName,
          draftValue: "My Draft",
          latestValue: "Server Updated",
        },
      ],
    };
    rerender(<TooltipProvider><EmailConfigWorkspace /></TooltipProvider>);
    const reviewDialog = screen.getByRole("dialog", { name: t.coreSettings.emailStaleTitle });
    expect(within(reviewDialog).getByText("My Draft")).toBeInTheDocument();
    expect(within(reviewDialog).getByText("Server Updated")).toBeInTheDocument();
    fireEvent.click(
      within(reviewDialog).getByRole("button", { name: t.coreSettings.emailConflictAdoptAction }),
    );
    expect(state.adoptConflictLatest).toHaveBeenCalledTimes(1);

    // 428 Precondition Required stays distinct from 409.
    state.conflict = "preconditionRequired";
    state.conflictReview = null;
    rerender(<TooltipProvider><EmailConfigWorkspace /></TooltipProvider>);
    expect(
      screen.getByRole("dialog", { name: t.coreSettings.emailPreconditionTitle }),
    ).toBeInTheDocument();
  });

  it("surfaces localized conflict fetch errors inside the open dialog and keeps 403 PermissionGate distinct from ACCESS_POLICY_BLOCKED and NOT_READY", () => {
    state.lang = lang;
    const t = ({ en, ar })[lang];

    // Ordinary latest-review fetch error surfaces inside open 409 dialog while retaining draft.
    state.conflict = "staleRevision";
    state.formError = `${t.coreSettings.emailLoadFailed} — ${t.coreIdentity.errors.UNKNOWN}`;
    const { rerender } = renderWorkspace();

    const conflictDialog = screen.getByRole("dialog", { name: t.coreSettings.emailStaleTitle });
    expect(within(conflictDialog).getByRole("alert")).toHaveTextContent(
      t.coreSettings.emailLoadFailed,
    );

    // 403 config-read denial renders PermissionGate and hides private config.
    state.conflict = null;
    state.formError = null;
    state.config = null;
    state.draft = null;
    state.isForbidden = true;
    rerender(<TooltipProvider><EmailConfigWorkspace /></TooltipProvider>);

    expect(screen.getByText(t.permissionGate.title)).toBeInTheDocument();
    expect(screen.getByText(t.permissionGate.description)).toBeInTheDocument();
    expect(screen.queryByText("noreply@acme.example")).not.toBeInTheDocument();
    expect(screen.queryByText(t.coreSettings.emailAccessBlocked)).not.toBeInTheDocument();
    expect(screen.queryByText(t.coreSettings.emailNotReadyTitle)).not.toBeInTheDocument();

    // ACCESS_POLICY_BLOCKED and NOT_READY remain distinct from 403 PermissionGate.
    state.isForbidden = false;
    state.isAccessBlocked = true;
    rerender(<TooltipProvider><EmailConfigWorkspace /></TooltipProvider>);
    expect(screen.getByText(t.coreSettings.emailAccessBlocked)).toBeInTheDocument();
    expect(screen.queryByText(t.permissionGate.title)).not.toBeInTheDocument();

    state.isAccessBlocked = false;
    state.isNotReady = true;
    rerender(<TooltipProvider><EmailConfigWorkspace /></TooltipProvider>);
    expect(screen.getByText(t.coreSettings.emailNotReadyTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.permissionGate.title)).not.toBeInTheDocument();
  });

  it("turns inherited plan limits off into explicit cap-valued overrides and keeps each field independent", () => {
    state.lang = lang;
    const t = ({ en, ar })[lang];
    const inheritedConfig = { ...baseConfig, dailyQuota: null, rateLimitPerMin: null };
    state.config = inheritedConfig;
    state.draft = toEmailConfigForm(inheritedConfig);
    state.activeModal = "limits";
    const { rerender } = renderWorkspace();

    const fields = [
      { key: "dailyQuota", section: t.coreSettings.emailDailyLimitLabel, input: t.coreSettings.emailCustomDailyLimitLabel, value: "2000" },
      { key: "rateLimitPerMin", section: t.coreSettings.emailPerMinuteLimitLabel, input: t.coreSettings.emailCustomPerMinuteLimitLabel, value: "120" },
    ] as const;
    for (const field of fields) {
      const dialog = screen.getByRole("dialog", { name: t.coreSettings.emailLimitsTitle });
      const switchName = `${field.section}: ${t.coreSettings.emailUsePlanLimits}`;
      expect(within(dialog).getByRole("switch", { name: switchName })).toBeChecked();
      state.updateDraft.mockClear();
      fireEvent.click(within(dialog).getByRole("switch", { name: switchName }));
      expect(state.updateDraft).toHaveBeenCalledWith({ [field.key]: field.value });
      state.draft = { ...state.draft!, [field.key]: field.value };
      state.isDirty = true;
      rerender(<TooltipProvider><EmailConfigWorkspace /></TooltipProvider>);
      expect(within(dialog).getByRole("switch", { name: switchName })).not.toBeChecked();
      expect(within(dialog).getByRole("textbox", { name: field.input })).toHaveValue(field.value);
    }

    expect(buildPatchEmailConfigRequest(inheritedConfig, state.draft!)).toEqual({
      dailyQuota: 2000,
      rateLimitPerMin: 120,
      smtpSecure: true,
      smtpProtocol: "smtp",
    });
    const dialog = screen.getByRole("dialog", { name: t.coreSettings.emailLimitsTitle });
    state.updateDraft.mockClear();
    fireEvent.click(within(dialog).getByRole("switch", {
      name: `${t.coreSettings.emailDailyLimitLabel}: ${t.coreSettings.emailUsePlanLimits}`,
    }));
    expect(state.updateDraft).toHaveBeenCalledWith({ dailyQuota: "" });
    state.draft = { ...state.draft!, dailyQuota: "" };
    expect(buildPatchEmailConfigRequest(inheritedConfig, state.draft)).toEqual({
      rateLimitPerMin: 120,
      smtpSecure: true,
      smtpProtocol: "smtp",
    });
  });

  it("wires Row 5 Edit limits modal with server plan caps, independent Use plan limits switches, and centered SMTP probe states", () => {
    state.lang = lang;
    const t = ({ en, ar })[lang];

    const { rerender } = renderWorkspace();

    // Row 5 Edit limits opens limits modal; external overlay prop hides PageHeader primary action.
    const limitsRow = screen.getByRole("region", { name: t.coreSettings.emailLimitsTitle });
    fireEvent.click(within(limitsRow).getByRole("button", { name: t.coreSettings.emailEditLimitsAction }));
    expect(state.openModal).toHaveBeenCalledWith("limits");

    rerender(<TooltipProvider><EmailConfigWorkspace hasExternalOverlay /></TooltipProvider>);
    expect(screen.queryByRole("button", { name: t.coreSettings.emailEditSettings })).not.toBeInTheDocument();

    // Limits modal displays actual server plan caps (2,000 / 120), not effective overrides (1,000 / 60).
    state.activeModal = "limits";
    const expectedLimitError = t.coreSettings.emailFormLimitWholeNumber.replace("{max}", "2,000");
    state.fieldErrors = { dailyQuota: expectedLimitError };
    rerender(<TooltipProvider><EmailConfigWorkspace /></TooltipProvider>);

    const limitsDialog = screen.getByRole("dialog", { name: t.coreSettings.emailLimitsTitle });
    expect(
      within(limitsDialog).getByText(
        t.coreSettings.emailPlanLimitsSummary
          .replace("{daily}", "2,000")
          .replace("{perMin}", "120"),
      ),
    ).toBeInTheDocument();
    expect(within(limitsDialog).getAllByRole("alert")[0]).toHaveTextContent(expectedLimitError);

    const switches = within(limitsDialog).getAllByRole("switch");
    expect(switches).toHaveLength(2);
    // Toggling Daily Use plan limits ON clears dailyQuota to "" independently of rateLimitPerMin.
    fireEvent.click(switches[0]!);
    expect(state.updateDraft).toHaveBeenCalledWith({ dailyQuota: "" });

    // Centered SMTP probe modal: checking (busy lock), succeeded, and failed alternate states.
    state.fieldErrors = {};
    state.activeModal = "probe";
    state.pending = "probe";
    rerender(<TooltipProvider><EmailConfigWorkspace /></TooltipProvider>);

    const checkingDialog = screen.getByRole("dialog", { name: t.coreSettings.emailProbeModalTitle });
    expect(within(checkingDialog).getByText(t.coreSettings.emailProbeCheckingTitle)).toBeInTheDocument();
    expect(within(checkingDialog).getByText(t.coreSettings.emailProbeScopeNote)).toBeInTheDocument();
    expect(within(checkingDialog).getByRole("button", { name: t.common.close })).toBeDisabled();
    fireEvent.keyDown(checkingDialog, { key: "Escape" });
    expect(state.closeModal).not.toHaveBeenCalled();

    state.pending = null;
    state.probeOutcome = { status: "succeeded", message: t.coreSettings.emailProbeMessage };
    rerender(<TooltipProvider><EmailConfigWorkspace /></TooltipProvider>);
    const successDialog = screen.getByRole("dialog", { name: t.coreSettings.emailProbeModalTitle });
    expect(within(successDialog).getByText(t.coreSettings.emailProbeMessage)).toBeInTheDocument();
    expect(within(successDialog).queryByText(t.coreSettings.emailProbeCheckingTitle)).not.toBeInTheDocument();

    state.probeOutcome = { status: "failed", message: t.coreSettings.emailSmtpConnectionFailed };
    rerender(<TooltipProvider><EmailConfigWorkspace /></TooltipProvider>);
    const failedDialog = screen.getByRole("dialog", { name: t.coreSettings.emailProbeModalTitle });
    expect(within(failedDialog).getByRole("alert")).toHaveTextContent(
      t.coreSettings.emailSmtpConnectionFailed,
    );
    fireEvent.click(within(failedDialog).getByRole("button", { name: t.common.retry }));
    expect(state.verifyConnection).toHaveBeenCalledTimes(1);
    fireEvent.click(
      within(failedDialog).getByRole("button", { name: t.coreSettings.emailProbeBackToSmtp }),
    );
    expect(state.openModal).toHaveBeenCalledWith("smtp");
  });
});
