// @vitest-environment jsdom

import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import type { NormalizedApiError } from "@/lib/api/errors";
import type { CustomFieldItem } from "../custom-field-contract";
import { useCustomFieldRecordValues } from "../hooks/useCustomFieldRecordValues";
import { CustomFieldValuesPanel } from "./CustomFieldValuesPanel";

const { router, ownerAccess } = vi.hoisted(() => ({
  router: { push: vi.fn() }, ownerAccess: { error: null as NormalizedApiError | null },
}));
const BRANCH = "0192f3a0-0000-7000-8000-000000000001";
const RECORD = "0192f3a0-0000-7000-8000-0000000000aa";

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/design-system", () => {
  const Wrapper = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const Content = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return {
    Badge: Wrapper, Skeleton: Wrapper, Field: Wrapper,
    PermissionGate: ({ denied, children }: { denied?: boolean; children?: ReactNode }) =>
      denied ? <div>Permission denied</div> : <>{children}</>,
    Button: ({ children, onClick, disabled, ...props }: {
      children?: ReactNode; onClick?: () => void; disabled?: boolean; "aria-label"?: string;
    }) => <button aria-label={props["aria-label"]} disabled={disabled} onClick={onClick}>{children}</button>,
    EmptyState: ({ title, description }: { title: string; description?: string }) => <div>{title}{description}</div>,
    ErrorState: Wrapper, DegradedBanner: ({ message }: { message: string }) => <div>{message}</div>,
    SelectContent: Content, SelectTrigger: () => null, SelectValue: () => null,
    Select: ({ value, onValueChange, children }: {
      value: string; onValueChange: (value: string) => void; children: ReactNode;
    }) => <select aria-label="Owner type" value={value} onChange={(event) => onValueChange(event.target.value)}>{children}</select>,
    SelectItem: ({ value, children }: { value: string; children: ReactNode }) => <option value={value}>{children}</option>,
    Combobox: ({ onValueChange }: { onValueChange: (value: string) => void }) =>
      <button onClick={() => onValueChange(RECORD)}>Pick record</button>,
    useToast: () => ({ success: vi.fn() }),
  };
});
vi.mock("@/components/tenant/TenantBranchSelect", () => ({ TenantBranchSelect: () => null }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: {} }) }));
vi.mock("@/i18n/I18nContext", async () => {
  const { en: dictionary } = await import("@/i18n/dictionaries/en");
  return { useI18n: () => ({ lang: "en", t: dictionary }) };
});
vi.mock("@/hooks/useTenantBranchSelection", () => ({
  useTenantBranchSelection: () => ({ branchIds: [BRANCH], branchId: BRANCH, selectBranch: vi.fn() }),
}));
vi.mock("@/hooks/useTenantBranchLabels", () => ({
  useTenantBranchLabels: () => new Map([[BRANCH, "Cairo Office"]]),
}));
vi.mock("@/hooks/useCrmRecordOptions", () => ({
  CRM_RECORD_SOURCE_TYPES: ["LEAD", "CUSTOMER_PROFILE", "OPPORTUNITY"],
  useCrmRecordOptions: () => ({ options: [{ value: RECORD, label: "Record" }], search: vi.fn(), error: null, isLoading: false }),
}));
vi.mock("../hooks/useCustomFieldOwnerAccess", () => ({
  useCustomFieldOwnerAccess: () => ({ canEdit: false, converted: false, isLoading: false,
    error: ownerAccess.error, retry: vi.fn() }),
}));
vi.mock("../hooks/useCustomFieldValues", () => ({
  useCustomFieldValues: () => ({ values: [{ fieldDefinitionId: "LEAD-true", ownerType: "LEAD", ownerId: RECORD, value: "Confirmed value" }],
    load: vi.fn(), reset: vi.fn(), isLoading: false,
    isSaving: false, hasLoaded: true, loadError: null, savingFieldId: null }),
}));
vi.mock("./CustomFieldRecordValueInput", () => ({
  CustomFieldRecordValueInput: ({ field, readOnly, value }: { field: CustomFieldItem; readOnly: boolean; value: unknown }) =>
    <input aria-label={field.fieldKey} readOnly={readOnly} value={typeof value === "string" ? value : ""} />,
}));

function definition(ownerType: CustomFieldItem["ownerType"], isActive = true): CustomFieldItem {
  return { id: `${ownerType}-${isActive}`, ownerType, fieldKey: `${ownerType}-${isActive}`,
    nameAr: "اسم", nameEn: "Name", type: "TEXT", optionsCount: 0, options: [],
    isSearchable: false, isActive, sortOrder: 1, requirements: [] };
}
function Harness({ definitions }: { definitions: CustomFieldItem[] }) {
  const state = useCustomFieldRecordValues(definitions, false);
  return <CustomFieldValuesPanel state={state} />;
}
const DEFINITIONS = [definition("LEAD"), definition("LEAD_AND_PARTY"), definition("CUSTOMER_PROFILE"),
  definition("OPPORTUNITY"), definition("PARTY"), definition("CUSTOMER_PROFILE", false)];

afterEach(() => { cleanup(); ownerAccess.error = null; });

describe("CustomFieldValuesPanel applicability", () => {
  it.each(["LEAD", "CUSTOMER_PROFILE"])("shows only applicable active fields for %s", (ownerType) => {
    render(<Harness definitions={DEFINITIONS} />);
    fireEvent.change(screen.getByLabelText("Owner type"), { target: { value: ownerType } });
    fireEvent.click(screen.getByText("Pick record"));
    const expected = ownerType === "LEAD" ? ["LEAD-true", "LEAD_AND_PARTY-true"] : ["CUSTOMER_PROFILE-true"];
    expect(screen.getAllByRole("textbox").map((input) => input.getAttribute("aria-label"))).toEqual(expected);
    expect(screen.getAllByRole("textbox").every((input) => (input as HTMLInputElement).readOnly)).toBe(true);
    expect(screen.getByText(en.crmCustomFields.valueAccessDenied)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Save:/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Clear value:/ })).not.toBeInTheDocument();
  });

  it("shows the record prerequisite before rendering any value controls", () => {
    render(<Harness definitions={DEFINITIONS} />);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText(en.crmCustomFields.pickOwnerTitle, { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Cairo Office")).toBeInTheDocument();
  });

  it("hides confirmed values after an authoritative owner or branch access denial", () => {
    const view = render(<Harness definitions={DEFINITIONS} />);
    fireEvent.click(screen.getByText("Pick record"));
    expect(screen.getByDisplayValue("Confirmed value")).toBeInTheDocument();
    ownerAccess.error = { status: 403, code: "CRM_SCOPED_PERMISSION_DENIED" };
    view.rerender(<Harness definitions={DEFINITIONS} />);
    expect(screen.getByText("Permission denied")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("Confirmed value")).not.toBeInTheDocument();
  });

  it("keeps confirmed values read-only during a network failure checking update access", () => {
    const view = render(<Harness definitions={DEFINITIONS} />);
    fireEvent.click(screen.getByText("Pick record"));
    ownerAccess.error = { status: 0 };
    view.rerender(<Harness definitions={DEFINITIONS} />);
    expect(screen.getByDisplayValue("Confirmed value")).toHaveAttribute("readonly");
    expect(screen.getByText(en.crmCustomFields.valueAccessUnavailable)).toBeInTheDocument();
    expect(screen.queryByText("Permission denied")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Save:/ })).not.toBeInTheDocument();
  });
});

