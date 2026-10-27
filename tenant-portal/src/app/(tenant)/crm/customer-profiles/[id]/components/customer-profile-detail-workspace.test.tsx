// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { runIdempotentWrite } from "@/lib/api/idempotent-write";
import type { CustomerProfileDetail } from "../../customer-profile-contract";
import { useCustomerProfileDetail } from "../hooks/useCustomerProfileDetail";
import { CustomerProfileDetailWorkspace } from "./customer-profile-detail-workspace";

const feedback = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("@/lib/api/idempotent-write", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api/idempotent-write")>(),
  createWriteAttempt: vi.fn(() => ({ idempotencyKey: "test-attempt" })),
  runIdempotentWrite: vi.fn(),
}));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/hooks/useAccessMode", () => ({
  useAccessMode: () => ({ canMutate: true }),
}));
vi.mock("../hooks/useCustomerProfileDetail", () => ({
  useCustomerProfileDetail: vi.fn(),
}));
vi.mock("../../hooks/useCustomerProfilesCapabilities", () => ({
  useCustomerProfilesCapabilities: () => ({
    capabilities: { update: { scope: "all", ownerUserIds: null } },
  }),
}));
vi.mock("../../../shared/hooks/useCrmRecordCapabilities", () => ({
  useCrmRecordCapabilities: () => ({ capabilities: {} }),
}));
vi.mock("../../../shared/hooks/useCrmAcquisitionSources", () => ({
  useCrmAcquisitionSources: () => ({ items: [] }),
}));
vi.mock("../hooks/useCustomerProfileActions", () => ({
  useCustomerProfileActions: () => ({
    busy: null,
    error: null,
    openEdit: vi.fn(),
    openContact: vi.fn(),
    requestDelete: vi.fn(),
    requestStatus: vi.fn(),
    submitStatus: vi.fn(),
  }),
}));
vi.mock("@/design-system", async () => {
  const tokens = await import(
    "@/design-system/patterns/dossier-modal/dossier-modal-tokens"
  );
  const cnMod = await import("@/design-system/lib/cn");
  const cardColorMod = await import("@/design-system/views/card-color");
  const errorFormatting = await import("@/design-system/feedback/format-api-error");
  const buttonMod = await import("@/design-system/primitives/Button");
  return {
    ...tokens,
    ...cnMod,
    ...cardColorMod,
    ...errorFormatting,
    ...buttonMod,
    useToast: () => feedback,
    ConfirmActionModal: () => null,
    DegradedBanner: () => null,
    DetailHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
    ErrorState: () => null,
    NotFoundState: () => null,
    PageActions: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    Skeleton: () => null,
    StageBar: () => <div data-testid="stage-bar" />,
    StatusBadge: () => null,
  };
});
vi.mock("../../../shared/components/CrmScopeGate", () => ({
  CrmScopeGate: () => null,
}));
vi.mock("../../../shared/components/CustomFieldsCard", () => ({
  CustomFieldsCard: () => <div data-testid="custom-fields" />,
}));
vi.mock("../../../shared/components/RecordAttachmentsSection", () => ({
  RecordAttachmentsSection: () => <section aria-label="Inline attachments" />,
}));
vi.mock("../../../shared/components/RecordNotesSection", () => ({
  RecordNotesSection: () => <section aria-label="Standalone notes" />,
}));
vi.mock("@/components/activities/RecordActivitiesPanel", () => ({
  RecordActivitiesPanel: () => <section aria-label="Inline activities" />,
}));
vi.mock("@/components/audit/RecordHistoryTab", () => ({
  RecordHistoryTab: () => <section aria-label="Inline audit history" />,
}));
vi.mock("@/components/audit/hooks/useAuditAccess", () => ({ useAuditAccess: () => true }));
vi.mock("./CustomerProfileRelatedNav", () => ({
  CustomerProfileRelatedNav: () => <nav data-testid="related-nav" />,
}));
vi.mock("./CustomerCompanyCard", () => ({
  CustomerCompanyCard: ({ profile }: { profile: CustomerProfileDetail }) => (
    <div data-testid="company-card">{profile.companyName}</div>
  ),
}));
vi.mock("./CustomerContactsCard", () => ({
  CustomerContactsCard: ({ profile }: { profile: CustomerProfileDetail }) => (
    <div data-testid="contacts-card">{profile.displayName}</div>
  ),
}));
vi.mock("./CustomerProfileIdentityCard", () => ({
  CustomerProfileIdentityCard: ({
    profile,
    customFieldsSlot,
  }: {
    profile: CustomerProfileDetail;
    customFieldsSlot?: React.ReactNode;
  }) => (
    <div data-testid="identity-card">
      {profile.displayName}
      {customFieldsSlot}
    </div>
  ),
}));
vi.mock("./CustomerProfileActionDialogs", () => ({
  CustomerProfileActionDialogs: () => null,
}));

const mockProfile: CustomerProfileDetail = {
  id: "0192f3a0-0000-7000-8000-000000000001",
  branchId: "0192f3a0-0000-7000-8000-000000000002",
  partyId: "0192f3a0-0000-7000-8000-000000000003",
  profileType: "CORPORATE",
  status: "ACTIVE_CUSTOMER",
  displayName: "Al-Amal Hospital",
  companyName: "Al-Amal Healthcare Co.",
  companyEmail: "info@alamal.med.sa",
  companyPhone: "+966112345678",
  companyWebsite: "https://alamal.med.sa",
  email: "info@alamal.med.sa",
  primaryMobile: "+966501234567",
  phones: ["+966112345678"],
  address: { country: "Saudi Arabia", city: "Riyadh", area: null, street: null },
  contacts: [],
  taxNumber: "300123456700003",
  commercialRegistrationNumber: "1010123456",
  legalName: "Al-Amal Medical Services LLC",
  description: "Specialized healthcare provider",
  ownerUserId: "0192f3a0-0000-7000-8000-000000000010",
  sourceLeadId: null,
  acquisitionSourceId: null,
  acquisitionSourceNameAr: null,
  acquisitionSourceNameEn: null,
  createdAt: "2026-09-01T10:00:00Z",
  updatedAt: "2026-09-10T12:00:00Z",
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CustomerProfileDetailWorkspace", () => {
  it.each(["rating", "colour"])("shows translated feedback after a forbidden %s save", async (field) => {
    const setProfile = vi.fn();
    const setCard = vi.fn();
    const reload = vi.fn();
    vi.mocked(useCustomerProfileDetail).mockReturnValue({
      profile: mockProfile,
      card: { rating: 2, cardColor: "TEAL" },
      isLoading: false,
      isNotFound: false,
      isForbidden: false,
      error: null,
      reload,
      setProfile,
      setCard,
    });
    vi.mocked(runIdempotentWrite).mockResolvedValue({
      kind: "failed",
      error: { status: 403, message: "Internal permission detail" },
    });
    render(<CustomerProfileDetailWorkspace profileId={mockProfile.id} />);
    const group = screen.getByRole("group", {
      name: field === "rating" ? en.crmLeads.card.rating : en.crmLeads.card.cardColor,
    });
    fireEvent.click(group.querySelectorAll("button")[0]);

    await waitFor(() => expect(feedback.error).toHaveBeenCalledWith(en.crmShared.errorForbidden));
    expect(runIdempotentWrite).toHaveBeenCalledTimes(1);
    expect(setProfile).not.toHaveBeenCalled();
    expect(setCard).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    expect(group.querySelectorAll("button")[0]).not.toBeDisabled();
  });

  it("renders Dossier 360 hero, related nav, status pipeline, cards, and inline 4-tab workspace", () => {
    vi.mocked(useCustomerProfileDetail).mockReturnValue({
      profile: mockProfile,
      card: { rating: 2, cardColor: "TEAL" },
      isLoading: false,
      isNotFound: false,
      isForbidden: false,
      error: null,
      reload: vi.fn(),
      setProfile: vi.fn(),
      setCard: vi.fn(),
    });

    render(<CustomerProfileDetailWorkspace profileId={mockProfile.id} />);

    expect(screen.getByTestId("related-nav")).toBeInTheDocument();
    expect(
      screen.getByRole("group", {
        name: en.crmCustomerProfileActions.changeStatus,
      }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("company-card")).toBeInTheDocument();
    expect(screen.getByTestId("contacts-card")).toBeInTheDocument();
    expect(screen.getByTestId("identity-card")).toBeInTheDocument();
    expect(screen.getByTestId("custom-fields")).toBeInTheDocument();

    const colorGroup = screen.getByRole("group", {
      name: en.crmLeads.card.cardColor,
    });
    const colorButtons = colorGroup.querySelectorAll("button");
    expect(colorButtons).toHaveLength(6);
    expect(colorButtons[0]).toHaveAttribute(
      "aria-label",
      en.crmLeads.card.colorNone,
    );

    expect(
      screen.getByRole("region", { name: "Inline activities" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: en.crmLeadDetail.notes }));
    expect(
      screen.getByRole("region", { name: "Standalone notes" }),
    ).toBeInTheDocument();
  });
});
