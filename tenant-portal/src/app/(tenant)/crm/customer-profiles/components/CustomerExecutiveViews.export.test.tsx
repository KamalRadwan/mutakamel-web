// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import type { CustomerProfileItem } from "../hooks/useCustomerProfiles";
import { CustomerExecutiveCardView } from "./CustomerExecutiveCardView";
import { CustomerExecutiveTableView } from "./CustomerExecutiveTableView";

const session = vi.hoisted(() => ({ permissions: [] as string[], lang: "en" as "en" | "ar" }));
const dictionaries = { ar, en } as const;
const directions = { ar: "rtl", en: "ltr" } as const;
vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ user: { permissions: session.permissions } }),
}));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({
    t: dictionaries[session.lang],
    lang: session.lang,
    dir: directions[session.lang],
  }),
}));
vi.mock("@/design-system", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/design-system")>(),
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

const customer: CustomerProfileItem = {
  id: "0192f3a0-0000-7000-8000-000000000001",
  partyId: "0192f3a0-0000-7000-8000-000000000003",
  branchId: "0192f3a0-0000-7000-8000-000000000002",
  displayName: '=HYPERLINK("https://example.test","open")',
  profileType: "INDIVIDUAL",
  status: "PROSPECT",
  companyName: null,
  imageUrl: null,
  phone: "+201001234567",
  phones: ["+201001234567"],
  email: "-formula@example.test",
  companyWebsite: null,
  country: "@SUM(1)",
  city: " \rtext",
  primaryContactName: "Contact, with a comma",
  primaryContact: null,
  tags: [],
  ownerUserId: "0192f3a0-0000-7000-8000-000000000010",
  owner: {
    userId: "0192f3a0-0000-7000-8000-000000000010",
    firstName: " \ttext",
    lastName: "Owner",
    avatarUrl: null,
  },
  nextActivity: null,
  acquisitionSourceNameAr: null,
  acquisitionSourceNameEn: null,
  sourceIconUrl: null,
  rating: 0,
  cardColor: null,
};
const other = { ...customer, id: "other-customer", displayName: "Unselected customer" };
const createObjectURL = vi.fn<(blob: Blob) => string>(() => "blob:customers");
const revokeObjectURL = vi.fn();

function props(selectedIds: ReadonlySet<string>) {
  return {
    items: [customer, other],
    selectedIds,
    onSelectionChange: vi.fn(),
    canUpdate: () => false,
    canDelete: () => false,
    onOpen: vi.fn(),
    onOpenActivities: vi.fn(),
    onCardChange: vi.fn(),
    onMoveStatus: vi.fn(),
  };
}

async function readDownload() {
  const blob = createObjectURL.mock.calls[0]?.[0];
  if (!blob) throw new Error("No CSV download");
  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.readAsArrayBuffer(blob);
  });
}

beforeEach(() => {
  session.permissions = ["crm.customer_profiles.export"];
  session.lang = "en";
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL = createObjectURL;
    static revokeObjectURL = revokeObjectURL;
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

for (const [name, View] of [
  ["Card", CustomerExecutiveCardView],
  ["Table", CustomerExecutiveTableView],
] as const) {
  describe(`${name} customer CSV export`, () => {
    it("requires the dedicated export permission even with read access", () => {
      session.permissions = ["crm.customer_profiles.read.all"];
      render(<View {...props(new Set([customer.id]))} />);
      expect(screen.queryByRole("button", { name: /Export selected CSV/ })).toBeNull();
      expect(createObjectURL).not.toHaveBeenCalled();
    });

    it.each([new Set<string>(), new Set(["not-on-this-page"])])(
      "disables export when the selection contains no visible rows (%s)",
      (selection) => {
        render(<View {...props(selection)} />);
        const button = screen.getByRole("button", { name: "Export selected CSV (0)" });
        expect(button.hasAttribute("disabled")).toBe(true);
        fireEvent.click(button);
        expect(createObjectURL).not.toHaveBeenCalled();
      },
    );

    it("removes export when the permission is revoked", () => {
      const viewProps = props(new Set([customer.id]));
      const view = render(<View {...viewProps} />);
      expect(screen.getByRole("button", { name: "Export selected CSV (1)" })).toBeTruthy();

      session.permissions = [];
      view.rerender(<View {...viewProps} />);
      expect(screen.queryByRole("button", { name: /Export selected CSV/ })).toBeNull();
      expect(createObjectURL).not.toHaveBeenCalled();
    });

    it("excludes selected rows hidden by the local status filter", async () => {
      const hidden = { ...other, status: "INACTIVE" as const };
      render(<View {...props(new Set([customer.id, hidden.id]))} items={[customer, hidden]} />);
      fireEvent.click(screen.getByRole("button", {
        name: /Prospect\s*\(1\)/,
      }));
      fireEvent.click(screen.getByRole("button", { name: "Export selected CSV (1)" }));

      const csv = new TextDecoder().decode(await readDownload());
      expect(csv).toContain("HYPERLINK");
      expect(csv).not.toContain(hidden.displayName);
    });

    it("disables export after paging away from selected rows", () => {
      const viewProps = props(new Set([customer.id]));
      const view = render(<View {...viewProps} />);
      view.rerender(<View {...viewProps} items={[other]} />);

      const button = screen.getByRole("button", { name: "Export selected CSV (0)" });
      expect(button.hasAttribute("disabled")).toBe(true);
      fireEvent.click(button);
      expect(createObjectURL).not.toHaveBeenCalled();
    });

    it.each(["=HYPERLINK(1)", "+1", "-1", "@SUM(1)", "\ttext", "\rtext"])(
      "neutralises the leading spreadsheet character in %j",
      async (value) => {
        const rows = [
          { ...customer, displayName: value },
          { ...other, displayName: `  ${value}` },
        ];
        render(<View {...props(new Set(rows.map((row) => row.id)))} items={rows} />);
        fireEvent.click(screen.getByRole("button", { name: "Export selected CSV (2)" }));

        const csv = new TextDecoder().decode(await readDownload());
        expect(csv).toContain(`\n"'${value}",`);
        expect(csv).toContain(`\n"'  ${value}",`);
      },
    );

    it.each(["en", "ar"] as const)("exports only selected rows safely in %s", async (lang) => {
      session.lang = lang;
      const t = dictionaries[lang];
      const label = t.crmCustomerProfiles.csvExport.selected.replace("{count}", "1");
      render(<View {...props(new Set([customer.id]))} />);
      fireEvent.click(screen.getByRole("button", { name: label }));
      const bytes = await readDownload();
      expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
      const csv = new TextDecoder().decode(bytes);
      expect(csv.startsWith(`"${t.crmCustomerProfiles.csvExport.headers.name}",`)).toBe(true);
      expect(csv).toContain(`"${t.crmCustomerProfiles.profileTypes.INDIVIDUAL}"`);
      expect(csv).toContain(`"${t.statusValues["CustomerStatus.PROSPECT"]}"`);
      expect(csv).toContain('"\'=HYPERLINK(""https://example.test"",""open"")"');
      expect(csv).toContain('"\'+201001234567"');
      expect(csv).toContain('"\'-formula@example.test"');
      expect(csv).toContain('"\'@SUM(1)"');
      expect(csv).toContain('"\' \rtext"');
      expect(csv).toContain('"\' \ttext Owner"');
      expect(csv).toContain('"Contact, with a comma"');
      expect(csv).not.toContain("Unselected customer");
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:customers");
    });
  });
}
