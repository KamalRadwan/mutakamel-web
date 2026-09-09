// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";

const { useRegisterTenantMock } = vi.hoisted(() => ({
  useRegisterTenantMock: vi.fn(),
}));

vi.mock("./hooks/useRegisterTenant", () => ({
  useRegisterTenant: useRegisterTenantMock,
}));

vi.mock("@/i18n/I18nContext", async () => {
  const { en: dictionary } = await vi.importActual<
    typeof import("@/i18n/dictionaries/en")
  >("@/i18n/dictionaries/en");
  return {
    useI18n: () => ({ t: dictionary, lang: "en", dir: "ltr" }),
    // The map picker pulls in DialogContent, which reads this one.
    useOptionalI18n: () => ({ t: dictionary, lang: "en", dir: "ltr" }),
  };
});

import RegisterTenantWizardPage from "./page";

let currentStep = 1;

function hookState() {
  return {
    t: en,
    creationQuote: { quote: null, expired: false, canCreate: false, loading: false, error: null, errorRef: { current: null }, load: vi.fn() },
    currentStep,
    goToStep: vi.fn(),
    validationErrors: [],
    clearValidationError: vi.fn(),
    focusValidationField: vi.fn(),
    stepHeadingRef: { current: null },
    validationSummaryRef: { current: null },
    formData: {
      name: "",
      companyName: "",
      industry: "Retail & E-commerce",
      countryName: "",
      countryIsoCode: "",
      timezone: "",
      phoneCountryCode: "",
      phone: "",
      taxNumber: "",
      commercialRegistrationNumber: "",
      street: "",
      city: "",
      state: "",
      district: "",
      buildingNo: "",
      postalCode: "",
      landmark: "",
      formattedAddress: "",
      ownerEmail: "",
      ownerFirstName: "",
      ownerLastName: "",
      ownerPhoneCountryCode: "",
      ownerPhone: "",
      ownerJobTitle: "",
      ownerLanguage: "ar",
      sendInvitation: true,
      ownerActive: true,
      databaseServerId: "",
      storageServerId: "",
      billingCycle: "MONTHLY",
      trialDays: 14,
    },
    setFormData: vi.fn(),
    selectCountry: vi.fn(() => true),
    countryTimezoneOptions: [],
    applicationCandidates: [],
    applicationSelections: {},
    applicationState: "idle",
    applicationError: null,
    selectedApplicationLines: [],
    showApplicationSelectionError: false,
    loadApplicationCandidates: vi.fn(),
    toggleApplication: vi.fn(),
    updateApplicationSelection: vi.fn(),
    databasePlacementOptions: [],
    databasePlacementState: "idle",
    databasePlacementError: null,
    selectedDatabasePlacement: null,
    showDatabaseSelectionError: false,
    setShowDatabaseSelectionError: vi.fn(),
    loadDatabasePlacementOptions: vi.fn(),
    provisioningPreview: null,
    provisioningPreviewState: "idle",
    provisioningPreviewError: null,
    loadProvisioningPreview: vi.fn(),
    storagePlacementOptions: [],
    storagePlacementState: "empty",
    storagePlacementError: null,
    selectedStoragePlacement: null,
    showStorageSelectionError: false,
    setShowStorageSelectionError: vi.fn(),
    loadStoragePlacementOptions: vi.fn(),
    isSubmitting: false,
    pendingCreateRecovery: null,
    isRecoveringCreate: false,
    createRecoveryError: null,
    canReadTenants: true,
    isValidatingIdentity: false,
    identityValidationEvidence: null,
    identityValidationError: null,
    hasValidIdentityEvidence: false,
    recoverTenantCreateStatus: vi.fn(),
    handleValidateIdentity: vi.fn(),
    handleSubmit: vi.fn((event: React.FormEvent) => event.preventDefault()),
    nextStep: vi.fn(),
    prevStep: vi.fn(),
    onCancel: vi.fn(),
  };
}

describe("RegisterTenantWizardPage field associations", () => {
  it("associates localized labels and names with identity, address, and phone controls", () => {
    currentStep = 1;
    useRegisterTenantMock.mockImplementation(hookState);
    const { container } = render(<RegisterTenantWizardPage />);
    const labels = en.tenants.wizard.fieldLabels;

    expect(screen.getByLabelText(labels.tenantName)).toHaveAttribute("name", "name");
    expect(screen.getByLabelText(labels.companyName)).toHaveAttribute(
      "name",
      "companyName",
    );
    // The sector is a combobox now, so the submitted value rides a hidden
    // input rather than the labelled control itself.
    expect(screen.getByRole("combobox", { name: labels.industry })).toHaveAttribute(
      "id",
      "tenant-industry",
    );
    expect(container.querySelector('input[name="industry"]')).not.toBeNull();
    expect(screen.getByRole("combobox", { name: labels.country })).toHaveAttribute(
      "id",
      "tenant-country",
    );
    expect(screen.getByRole("combobox", { name: labels.timezone })).toHaveAttribute(
      "id",
      "tenant-timezone",
    );
    // The calling code moved into the phone control as its own combobox.
    expect(
      screen.getByRole("combobox", { name: labels.phoneCallingCode }),
    ).toHaveAttribute("id", "tenant-phone-code");
    expect(screen.getByLabelText(labels.companyPhone)).toHaveAttribute("name", "phone");

    const addressFields = [
      [labels.street, "street"],
      [labels.buildingNumber, "buildingNo"],
      [labels.city, "city"],
      [labels.stateProvince, "state"],
      [labels.district, "district"],
      [labels.postalCode, "postalCode"],
      [labels.landmark, "landmark"],
      [labels.taxNumber, "taxNumber"],
      [labels.commercialRegistrationNumber, "commercialRegistrationNumber"],
      [labels.formattedAddress, "formattedAddress"],
    ] as const;
    for (const [label, name] of addressFields) {
      expect(screen.getByLabelText(label)).toHaveAttribute("name", name);
    }
    // Coordinates are chosen on a map now, not typed.
    expect(screen.queryByLabelText(/Latitude/u)).toBeNull();
    expect(screen.queryByLabelText(/Longitude/u)).toBeNull();
    expect(
      screen.getByRole("button", { name: en.tenants.wizard.pickOnMap }),
    ).toBeInTheDocument();
  });

  it("associates localized labels, names, and required semantics with owner phone subfields", () => {
    currentStep = 2;
    useRegisterTenantMock.mockImplementation(hookState);
    const { container } = render(<RegisterTenantWizardPage />);
    const labels = en.tenants.wizard.fieldLabels;
    const ownerFields = [
      [labels.ownerEmail, "ownerEmail"],
      [labels.firstName, "ownerFirstName"],
      [labels.lastName, "ownerLastName"],
      [labels.ownerPhone, "ownerPhone"],
    ] as const;

    for (const [label, name] of ownerFields) {
      const input = screen.getByLabelText(label);
      expect(input).toHaveAttribute("name", name);
      expect(input).toBeRequired();
    }

    // The job title is a catalogue combobox now, and the owner's calling code
    // folded into the phone control as its own combobox -- both post their
    // value through a companion input rather than the labelled control.
    expect(screen.getByRole("combobox", { name: labels.jobTitle })).toHaveAttribute(
      "id",
      "tenant-owner-job-title",
    );
    expect(container.querySelector('input[name="ownerJobTitle"]')).not.toBeNull();
    expect(
      screen.getByRole("combobox", { name: labels.phoneCallingCode }),
    ).toHaveAttribute("id", "tenant-owner-phone-code");
  });
});
