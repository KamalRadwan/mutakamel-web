// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import type { CustomerProfileDetail } from "../../customer-profile-contract";
import { useCustomerProfileDetail } from "../hooks/useCustomerProfileDetail";
import { CustomerProfileDetailWorkspace } from "./customer-profile-detail-workspace";

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/hooks/useAccessMode", () => ({
  useAccessMode: () => ({ canMutate: true }),
}));
vi.mock("../../../shared/hooks/useCrmErrorText", () => ({
  useCrmErrorText: () => () => null,
}));
vi.mock("../hooks/useCustomerProfileDetail", () => ({
  useCustomerProfileDetail: vi.fn(),
}));
vi.mock("../../hooks/useCustomerProfilesCapabilities", () => ({
  useCustomerProfilesCapabilities: () => ({ capabilities: {} }),
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
vi.mock("@/design-system", () => ({
  Button: ({ children, ...props }: { children: React.ReactNode }) => (
    <div role="button" tabIndex={0} {...props}>
      {children}
    </div>
  ),
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
}));
vi.mock("../../../shared/components/CrmScopeGate", () => ({
  CrmScopeGate: () => null,
}));
vi.mock("../../../shared/components/CustomFieldsCard", () => ({
  CustomFieldsCard: () => <div data-testid="custom-fields" />,
}));
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
  }: {
    profile: CustomerProfileDetail;
  }) => <div data-testid="identity-card">{profile.displayName}</div>,
}));
vi.mock("./CustomerProfileDetailSidePanel", () => ({
  CustomerProfileDetailSidePanel: () => <aside data-testid="side-panel" />,
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

afterEach(cleanup);

describe("CustomerProfileDetailWorkspace", () => {
  it("renders related nav, stage bar, cards, and side panel", () => {
    vi.mocked(useCustomerProfileDetail).mockReturnValue({
      profile: mockProfile,
      isLoading: false,
      isNotFound: false,
      isForbidden: false,
      error: null,
      reload: vi.fn(),
      setProfile: vi.fn(),
    });

    render(<CustomerProfileDetailWorkspace profileId={mockProfile.id} />);

    expect(screen.getByTestId("related-nav")).toBeInTheDocument();
    expect(screen.getByTestId("stage-bar")).toBeInTheDocument();
    expect(screen.getByTestId("company-card")).toBeInTheDocument();
    expect(screen.getByTestId("contacts-card")).toBeInTheDocument();
    expect(screen.getByTestId("identity-card")).toBeInTheDocument();
    expect(screen.getByTestId("custom-fields")).toBeInTheDocument();
    expect(screen.getByTestId("side-panel")).toBeInTheDocument();
  });
});
