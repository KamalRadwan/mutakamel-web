// @vitest-environment jsdom

import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { RecordNotesSection } from "./RecordNotesSection";
import { RecordAttachmentsSection } from "./RecordAttachmentsSection";

const state = vi.hoisted(() => ({
  permissions: [] as string[],
  lang: "en" as "ar" | "en",
  notes: vi.fn(),
  attachments: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ user: { permissions: state.permissions } }),
}));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: state.lang === "ar" ? ar : en, lang: state.lang }),
}));
vi.mock("../hooks/useCrmNotes", () => ({ useCrmNotes: state.notes }));
vi.mock("../hooks/useCrmAttachments", () => ({ useCrmAttachments: state.attachments }));
vi.mock("../hooks/useCrmErrorText", () => ({ useCrmErrorText: () => () => null }));
vi.mock("../hooks/useAmbiguousOutcomeLabels", () => ({
  useAmbiguousOutcomeLabels: () => ({}),
  useAppliedUnreadableLabels: () => ({}),
}));
vi.mock("./CrmScopeGate", () => ({
  CrmScopeGate: () => <p>{en.crmShared.scopeDeniedTitle}</p>,
}));
vi.mock("./NoteRow", () => ({ NoteRow: () => null }));
vi.mock("@/design-system", async (importOriginal) => {
  const { PermissionGate } = await importOriginal<typeof import("@/design-system")>();
  return {
    PermissionGate,
    DetailSection: ({ children }: { children: ReactNode }) => <section>{children}</section>,
    ConfirmActionModal: () => null,
    AmbiguousOutcomePanel: () => null,
    AttachmentList: () => null,
    Button: () => null,
    DateTime: () => null,
    EmptyState: () => null,
    ErrorState: () => null,
    Skeleton: () => null,
    Textarea: () => null,
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  state.permissions = [];
  state.lang = "en";
  state.notes.mockReturnValue({ loadError: { status: 403 }, writeError: null });
  state.attachments.mockReturnValue({
    loadError: { status: 403 }, writeError: null, attachments: [],
  });
});
afterEach(cleanup);

const props = {
  branchId: "0199f1ab-0000-7000-8000-000000000001",
  sourceId: "0199f1ab-0000-7000-8000-000000000002",
  sourceType: "LEAD" as const,
  sourceOwnerUserId: null,
  createCapability: null,
  deleteCapability: null,
};

describe.each([
  { resource: "notes", Component: RecordNotesSection },
  { resource: "attachments", Component: RecordAttachmentsSection },
])("$resource read admission", ({ resource, Component }) => {
  it.each(["en", "ar"] as const)("shows the %s permission state without mounting data hooks", (lang) => {
    state.lang = lang;
    state.permissions = [`crm.${resource}.create.all`];
    render(<Component {...props} />);
    const dictionary = lang === "ar" ? ar : en;
    expect(screen.getByText(dictionary.permissionGate.title)).toBeTruthy();
    expect(screen.getByText(dictionary.permissionGate.description)).toBeTruthy();
    expect(state.notes).not.toHaveBeenCalled();
    expect(state.attachments).not.toHaveBeenCalled();
    expect(screen.queryByText(en.crmShared.scopeDeniedTitle)).toBeNull();
  });

  it.each(["own", "team", "all"])("keeps the scope state for a 403 with read.%s", (scope) => {
    state.permissions = [`crm.${resource}.read.${scope}`];
    render(<Component {...props} />);
    expect(resource === "notes" ? state.notes : state.attachments).toHaveBeenCalled();
    expect(screen.getByText(en.crmShared.scopeDeniedTitle)).toBeTruthy();
    expect(screen.queryByText(en.permissionGate.title)).toBeNull();
  });
});
