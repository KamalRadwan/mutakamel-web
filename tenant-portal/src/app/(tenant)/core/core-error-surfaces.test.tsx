// @vitest-environment jsdom

import type { ReactNode } from "react";
import { cleanup, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import type { NormalizedApiError } from "@/lib/api/errors";
import WorkspaceSettingsPage from "./settings/workspace/page";
import { EmailConfigWorkspace } from "./settings/email/components/email-workspace";
import { NotificationList } from "./notifications/components/NotificationList";
import { NotificationPreferencesPanel } from "./notifications/components/NotificationPreferencesPanel";
import NotificationDetailPage from "./notifications/[id]/page";
import AuditPage from "./audit/page";
import { ProfileSecurity } from "./profile/components/ProfileSecurity";
import { ActionTokenScreen } from "@/app/tenant/components/ActionTokenScreen";
import { useCoreErrorText } from "./hooks/useCoreErrorText";
import { describeEmailConfigApiError } from "./settings/email/email-config-messages";

const state = vi.hoisted(() => ({
  lang: "en" as "en" | "ar",
  error: null as NormalizedApiError | null,
  profileField: "name" as "name" | "password",
}));
const noop = () => undefined;
const dictionary = () => ({ en, ar })[state.lang];

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: dictionary(), lang: state.lang }),
}));
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "notification-id" }) }));
vi.mock("@/design-system", async () => {
  const Content = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const Empty = () => null;
  const swatchLib = await import("@/design-system/lib/swatch-palette");
  const cnLib = await import("@/design-system/lib/cn");
  return {
    ...await import("@/design-system/feedback/format-api-error"),
    ...swatchLib,
    ...cnLib,
    Button: Content, Card: Content, CardContent: Content, CardDescription: Content,
    CardFooter: Content, CardHeader: Content, CardTitle: Content,
    ConflictDialog: Empty, ConfirmActionModal: Empty, Dialog: Content, DialogContent: Content,
    DialogDescription: Content, DialogFooter: Content, DialogHeader: Content, DialogTitle: Content,
    DetailSection: Content, PermissionGate: Content,
    Sheet: Content, SheetContent: Content, SheetDescription: Content,
    SheetHeader: Content, SheetTitle: Content, Tabs: Content, TabsList: Content,
    TabsTrigger: Content, Table: Content, TableBody: Content, TableCell: Content,
    TableHead: Content, TableHeader: Content, TableRow: Content,
    Tooltip: Content, TooltipContent: Content, TooltipTrigger: Content,
    Badge: Content, IdentifierText: Content,
    Field: ({ children, error }: { children?: ReactNode; error?: string }) =>
      <div>{children}{error ? <span role="alert">{error}</span> : null}</div>,
    useFieldControl: () => ({}),
    Input: () => <input readOnly />,
    ErrorState: ({ description }: { description?: string }) => <div role="alert">{description}</div>,
    PageHeader: Empty, SubNav: Empty, EmptyState: Empty, Skeleton: Empty,
    NotFoundState: Empty, DateTime: Empty, Select: Empty, SelectContent: Empty,
    SelectItem: Empty, SelectTrigger: Empty, SelectValue: Empty, Combobox: Empty,
    Label: Content, Switch: Empty, LanguageToggle: Empty, ThemeToggle: Empty,
    MfaCodeStep: Empty, CORE_SETTINGS_NAV_ITEMS: [],
  };
});
vi.mock("./settings/workspace/hooks/useWorkspaceSettings", () => ({
  useWorkspaceSettings: () => ({
    t: dictionary(), lang: state.lang, canManage: false, draft: null, isLoading: false,
    isNotReady: false, isLoadForbidden: false,
    loadFailure: state.error ? { kind: "api", error: state.error } : null, reload: noop,
  }),
}));
vi.mock("./settings/workspace/hooks/useWorkspaceAuditPreview", () => ({
  useWorkspaceHistory: () => ({
    canReadAudit: false, isHistoryOpen: false, historyValueLabels: {},
    openHistory: noop, setHistoryOpen: noop,
  }),
}));
vi.mock("./settings/workspace/hooks/useTimezoneOptions", () => ({
  useTimezoneOptions: () => ({ hasZones: false }),
}));
vi.mock("./settings/email/hooks/useEmailConfig", () => ({
  useEmailConfig: () => ({
    t: dictionary(), lang: state.lang, canManage: false, config: null, baseline: null,
    draft: null, revision: null, activeModal: null, isLoading: false, pending: null,
    probeOutcome: null, isDirty: false, isDiscardOpen: false, isNotReady: false,
    isAccessBlocked: false, isForbidden: false, loadError: state.error,
    hasLoadError: state.error !== null,
    loadErrorMessage: describeEmailConfigApiError(state.error, dictionary()),
    fieldErrors: {}, formError: null, conflict: null, conflictReview: null,
    isConflictLoading: false, openModal: noop, closeModal: noop, discardDraft: noop,
    confirmDiscard: noop, cancelDiscard: noop, updateDraft: noop, resetConflict: noop,
    dismissConflict: noop, resolveConflict: () => Promise.resolve(),
    adoptConflictLatest: noop, discardConflictDraft: noop,
    setDeliveryStatus: () => Promise.resolve(), save: () => Promise.resolve(),
    verify: () => Promise.resolve(), verifyConnection: () => Promise.resolve(), reload: noop,
  }),
}));
vi.mock("./settings/email/components/EmailConflictDialog", () => ({ EmailConflictDialog: () => null }));
vi.mock("./notifications/hooks/useNotificationPreferences", () => ({
  useNotificationPreferences: () => ({
    canRead: true, canManage: false, preferences: [], channelConfig: null,
    isLoading: false, error: state.error, pendingType: null, reload: noop,
  }),
}));
vi.mock("./notifications/[id]/hooks/useNotificationDetail", () => ({
  useNotificationDetail: () => ({
    t: dictionary(), lang: state.lang, notification: null, status: "failed",
    error: state.error, isPending: false, reload: noop,
  }),
}));
vi.mock("./audit/hooks/useAuditLedger", () => ({
  useAuditLedger: () => ({
    t: dictionary(), lang: state.lang, canRead: true, error: state.error,
    events: [], isLoading: false, deletedOnly: false, filters: {}, selectedId: null,
    hasPrevious: false, hasNext: false, reload: noop,
  }),
}));
vi.mock("./audit/components/AuditFilterPanel", () => ({ AuditFilterPanel: () => null }));
vi.mock("@/components/audit/AuditEventDetail", () => ({ AuditEventDetail: () => null }));
vi.mock("./profile/hooks/useProfileSecurity", () => ({
  useProfileSecurity: () => ({
    t: dictionary(), pending: null, firstName: "", lastName: "", currentPassword: "",
    newPassword: "", confirmPassword: "", showPassword: false,
    nameError: state.profileField === "name" ? state.error : null,
    passwordError: state.profileField === "password" ? state.error : null,
    isNameValid: false, isPasswordValid: false, isConfirmed: false,
  }),
}));
vi.mock("@/app/tenant/hooks/useActionTokenPassword", () => ({
  NEW_PASSWORD_MAX_LENGTH: 128,
  useActionTokenPassword: () => ({
    t: dictionary(), mfa: { step: null }, state: "ready", error: state.error,
    newPassword: "", confirmPassword: "", showPassword: false,
    isPasswordValid: false, isConfirmed: false,
  }),
}));

const surfaces = [
  { name: "workspace settings", element: () => <WorkspaceSettingsPage /> },
  { name: "email settings", element: () => <EmailConfigWorkspace /> },
  { name: "notification inbox", element: () => <NotificationList
    items={[]} isLoading={false} isLoadingMore={false} hasMore={false}
    pendingId={null} error={state.error} onRetry={noop} onLoadMore={noop}
    onMarkRead={noop} onAcknowledge={noop} onDismiss={noop} /> },
  { name: "notification preferences", element: () => <NotificationPreferencesPanel /> },
  { name: "notification detail", element: () => <NotificationDetailPage /> },
  { name: "audit ledger", element: () => <AuditPage /> },
  { name: "profile name", element: () => <ProfileSecurity /> },
  { name: "profile password", element: () => {
    state.profileField = "password";
    return <ProfileSecurity />;
  } },
  { name: "accept invite", element: () => <ActionTokenScreen flow="accept-invite" /> },
  { name: "reset password", element: () => <ActionTokenScreen flow="reset-password" /> },
];

afterEach(cleanup);

describe.each(["en", "ar"] as const)("Core error surfaces in %s", (lang) => {
  it("keeps known code text and its support reference without the server message", () => {
    state.lang = lang;
    const { result } = renderHook(useCoreErrorText);
    expect(result.current({ status: 422, code: "WEAK_PASSWORD", message: "Internal policy failure", correlationId: "known-ref" }))
      .toBe(`${dictionary().coreIdentity.errors.WEAK_PASSWORD} — ${dictionary().errors.reference}: known-ref`);
    expect(result.current(null)).toBeUndefined();
  });

  it("keeps status-based rate-limit recovery ahead of a domain code", () => {
    state.lang = lang;
    const { result } = renderHook(useCoreErrorText);
    const t = dictionary();
    expect(result.current({ status: 429, code: "WEAK_PASSWORD", message: "Raw rate limit", correlationId: "rate-ref" }))
      .toBe(`${t.errors.rateLimitedTitle} — ${t.errors.rateLimitedDescription} — ${t.errors.reference}: rate-ref`);
  });

  describe.each(surfaces)("$name", ({ element }) => {
    it.each([
      { status: 0, message: "Network Error" },
      { status: 0, message: "INVALID_CORE_RESPONSE" },
      { status: 500, code: "UNMAPPED_SERVER_ERROR", message: "English server error: internal SQL failure" },
    ])("localizes a failure with status $status and message $message", (error) => {
      state.lang = lang;
      state.profileField = "name";
      state.error = { ...error, correlationId: "support-reference-123" };
      render(element());

      const t = dictionary();
      const expected = error.status === 0 ? t.coreIdentity.errors.OFFLINE : t.coreIdentity.errors.UNKNOWN;
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent(expected);
      expect(alert).toHaveTextContent(`${t.errors.reference}: support-reference-123`);
      expect(document.body).not.toHaveTextContent(error.message);
      expect(document.body).not.toHaveTextContent("UNMAPPED_SERVER_ERROR");
    });
  });

  it("keeps the localized password refusal in the field and form summary", () => {
    state.lang = lang;
    state.profileField = "password";
    state.error = { status: 422, code: "CURRENT_PASSWORD_INVALID", message: "Raw password refusal" };
    render(<ProfileSecurity />);

    expect(screen.getAllByRole("alert")).toHaveLength(2);
    for (const alert of screen.getAllByRole("alert")) {
      expect(alert).toHaveTextContent(dictionary().mfa.errors.currentPassword);
    }
    expect(document.body).not.toHaveTextContent("Raw password refusal");
  });
});
