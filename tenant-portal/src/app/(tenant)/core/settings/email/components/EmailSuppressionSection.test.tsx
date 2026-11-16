// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import type { EmailSuppressionLookup } from "../email-suppression-contract";
import { EmailSuppressionSection } from "./EmailSuppressionSection";

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

const state = vi.hoisted(() => ({
  user: {
    id: "actor",
    isSuperAdmin: false,
    permissions: [] as string[],
    permissionScopes: {} as Record<
      string,
      { tenantWide: boolean; companyIds: string[]; branchIds: string[] }
    >,
  },
  locale: "en" as "en" | "ar",
  address: "private@example.com",
  pending: false,
  denied: false,
  isLookupModalOpen: true,
  confirming: false,
  error: undefined as string | undefined,
  notice: null as string | null,
  noticeKind: null as "lifted" | "alreadyAbsent" | null,
  result: {
    suppressed: true,
    reasonCode: "COMPLAINT",
    firstOccurredAt: "first",
    lastOccurredAt: "last",
  } as EmailSuppressionLookup | null,
  updateAddress: vi.fn(),
  lookup: vi.fn(),
  lift: vi.fn(),
  confirm: vi.fn(),
  closeLookupModal: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ user: state.user, realtimeAuthGeneration: "session" }),
}));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({
    lang: state.locale,
    dir: ({ en: "ltr", ar: "rtl" } as const)[state.locale],
    t: ({ en, ar })[state.locale],
    setLang: vi.fn(),
    toggleLang: vi.fn(),
  }),
}));

vi.mock("@/i18n/useLanguage", () => ({
  useDictionary: () => ({ en, ar })[state.locale],
  useLanguage: () => state.locale,
  useDirection: () => ({ en: "ltr", ar: "rtl" } as const)[state.locale],
}));

vi.mock("../hooks/useEmailSuppression", () => ({
  useEmailSuppression: () => ({
    copy: ({ en, ar })[state.locale].emailSuppression,
    address: state.address,
    updateAddress: state.updateAddress,
    pending: state.pending,
    denied: state.denied,
    result: state.result,
    confirming: state.confirming,
    setConfirming: state.confirm,
    isLookupModalOpen: state.isLookupModalOpen,
    closeLookupModal: state.closeLookupModal,
    error: state.error,
    notice: state.notice,
    noticeKind: state.noticeKind,
    date: (value: string) => value,
    lookup: state.lookup,
    lift: state.lift,
  }),
}));

function grantTenantWideManage() {
  state.user.permissions = ["workspace.email.manage"];
  state.user.permissionScopes = {
    "workspace.email.manage": { tenantWide: true, companyIds: [], branchIds: [] },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  state.user.permissions = [];
  state.user.permissionScopes = {};
  state.locale = "en";
  state.address = "private@example.com";
  state.pending = false;
  state.denied = false;
  state.isLookupModalOpen = true;
  state.confirming = false;
  state.error = undefined;
  state.notice = null;
  state.noticeKind = null;
  state.result = {
    suppressed: true,
    reasonCode: "COMPLAINT",
    firstOccurredAt: "first",
    lastOccurredAt: "last",
  };
});

afterEach(cleanup);

describe("suppression section access and evidence", () => {
  it("hides commands without tenant-wide management permission including branch-only grants", () => {
    const { rerender } = render(<EmailSuppressionSection />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(state.lookup).not.toHaveBeenCalled();

    // Branch-scoped workspace.email.manage has no tenant-wide authority and renders zero dead controls.
    state.user.permissions = ["workspace.email.manage"];
    state.user.permissionScopes = {
      "workspace.email.manage": { tenantWide: false, companyIds: [], branchIds: ["branch-1"] },
    };
    rerender(<EmailSuppressionSection />);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it.each(["en", "ar"] as const)("renders translated evidence and requests confirmation in %s", (locale) => {
    grantTenantWideManage();
    state.locale = locale;
    const copy = ({ en, ar })[locale].emailSuppression;

    render(<EmailSuppressionSection />);
    expect(screen.getByText(copy.privacy)).toBeInTheDocument();

    const lookupDialog = screen.getByRole("dialog", { name: copy.lookupModalTitle });
    expect(within(lookupDialog).getByText(copy.reasons.COMPLAINT)).toBeInTheDocument();
    expect(within(lookupDialog).getByText("first")).toBeInTheDocument();
    expect(within(lookupDialog).getByText("last")).toBeInTheDocument();

    fireEvent.click(within(lookupDialog).getByRole("button", { name: copy.lift }));
    expect(state.confirm).toHaveBeenCalledWith(true);
    expect(state.lift).not.toHaveBeenCalled();
  });

  it.each(["en", "ar"] as const)(
    "keeps lookup and lift confirmation modals mutually exclusive, states workspace-only/no-resend once, blocks busy dismissal, and distinguishes lifted vs already-absent in %s",
    (locale) => {
      grantTenantWideManage();
      state.locale = locale;
      const t = ({ en, ar })[locale];
      const copy = t.emailSuppression;

      // 1. Compact inline state without open modal shows zero inline evidence duplication.
      state.isLookupModalOpen = false;
      const { rerender } = render(<EmailSuppressionSection />);
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.queryByText(copy.reasons.COMPLAINT)).toBeNull();

      // 2. Confirming transitions to a single centered confirmation dialog (never stacked).
      state.isLookupModalOpen = true;
      state.confirming = true;
      rerender(<EmailSuppressionSection />);
      const dialogs = screen.getAllByRole("dialog");
      expect(dialogs).toHaveLength(1);
      const confirmDialog = screen.getByRole("dialog", { name: copy.confirmTitle });
      expect(within(confirmDialog).getAllByText(copy.confirmDescription)).toHaveLength(1);
      expect(within(confirmDialog).getByText("private@example.com")).toBeInTheDocument();

      // 3. Busy lift disables Cancel and blocks Escape dismissal while surfacing retry errors inline.
      state.pending = true;
      state.error = copy.errors.failed;
      rerender(<EmailSuppressionSection />);
      const busyDialog = screen.getByRole("dialog", { name: copy.confirmTitle });
      expect(within(busyDialog).getByRole("alert")).toHaveTextContent(copy.errors.failed);
      expect(within(busyDialog).getByRole("button", { name: copy.cancel })).toBeDisabled();
      fireEvent.keyDown(busyDialog, { key: "Escape" });
      expect(state.confirm).not.toHaveBeenCalled();

      // 4. Lifted vs alreadyAbsent render distinct workspace-scoped notices in the result modal.
      state.pending = false;
      state.confirming = false;
      state.error = undefined;
      state.result = { suppressed: false };
      state.notice = copy.lifted;
      state.noticeKind = "lifted";
      rerender(<EmailSuppressionSection />);
      expect(
        within(screen.getByRole("dialog", { name: copy.lookupModalTitle })).getByText(copy.lifted),
      ).toBeInTheDocument();

      state.notice = copy.alreadyAbsent;
      state.noticeKind = "alreadyAbsent";
      rerender(<EmailSuppressionSection />);
      expect(
        within(screen.getByRole("dialog", { name: copy.lookupModalTitle })).getByText(
          copy.alreadyAbsent,
        ),
      ).toBeInTheDocument();
    },
  );

  it("renders PermissionGate when server denies access", () => {
    grantTenantWideManage();
    state.denied = true;
    render(<EmailSuppressionSection />);
    expect(screen.getByText(en.permissionGate.title)).toBeInTheDocument();
    expect(screen.getByText(en.permissionGate.description)).toBeInTheDocument();
  });
});
