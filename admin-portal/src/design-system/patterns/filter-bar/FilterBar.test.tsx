// @vitest-environment jsdom

import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
  search: "",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigation.replace }),
  usePathname: () => "/records",
  useSearchParams: () => new URLSearchParams(navigation.search),
}));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en", dir: "ltr" }),
}));

import { FilterBar } from "./FilterBar";
import { readFilterParams, writeFilterParams } from "./useFilterBar";
import type { FilterField } from "./types";

const fields: FilterField[] = [
  {
    key: "search",
    type: "search",
    labelEn: "Search records",
    labelAr: "البحث في السجلات",
    placeholderEn: "Name or email",
    placeholderAr: "الاسم أو البريد",
  },
  {
    key: "status",
    type: "select",
    labelEn: "Status",
    labelAr: "الحالة",
    options: [
      { value: "ACTIVE", labelEn: "Active", labelAr: "نشط" },
      { value: "OFFLINE", labelEn: "Offline", labelAr: "غير متصل" },
    ],
  },
  {
    key: "created",
    type: "date-range",
    labelEn: "Created date",
    labelAr: "تاريخ الإنشاء",
    groupLabelEn: "Creation window",
    groupLabelAr: "نافذة الإنشاء",
    fromLabelEn: "Created from",
    fromLabelAr: "أُنشئ من",
    toLabelEn: "Created to",
    toLabelAr: "أُنشئ إلى",
    query: { fromKey: "createdFrom", toKey: "createdTo" },
    validation: [
      {
        kind: "date-order",
        messageEn: "Created from must not be after created to.",
        messageAr: "يجب ألا يكون تاريخ البداية بعد تاريخ النهاية.",
      },
    ],
  },
];

describe("FilterBar", () => {
  beforeEach(() => {
    navigation.replace.mockReset();
    navigation.search = "";
    vi.useRealTimers();
  });

  it("renders persistent labels and separately named dates", () => {
    render(
      <FilterBar
        labelEn="Record filters"
        labelAr="عوامل تصفية السجلات"
        fields={fields}
        values={{ search: "", status: "", created: { from: "", to: "" } }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("region", { name: "Record filters" })).toBeInTheDocument();
    expect(screen.getByLabelText("Search records")).toHaveAttribute("placeholder", "Name or email");
    expect(screen.getByRole("combobox", { name: "Status" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Creation window" })).toBeInTheDocument();
    expect(screen.getByLabelText("Created from")).toHaveAttribute("type", "date");
    expect(screen.getByLabelText("Created to")).toHaveAttribute("type", "date");
  });

  it("associates localized validation with every control in an invalid date group", () => {
    render(
      <FilterBar
        fields={fields}
        values={{
          search: "",
          status: "",
          created: { from: "2026-08-29", to: "2026-08-01" },
        }}
        onChange={vi.fn()}
      />,
    );

    const group = screen.getByRole("group", { name: "Creation window" });
    const from = screen.getByLabelText("Created from");
    const to = screen.getByLabelText("Created to");
    const error = screen.getByText("Created from must not be after created to.");

    expect(group).toHaveAttribute("aria-invalid", "true");
    expect(from).toHaveAttribute("aria-invalid", "true");
    expect(to).toHaveAttribute("aria-invalid", "true");
    expect(from.getAttribute("aria-describedby")).toContain(error.id);
    expect(to.getAttribute("aria-describedby")).toContain(error.id);
  });

  it("disables unmet dependencies and exposes a persistent localized reason", () => {
    const dependencyFields: FilterField[] = [
      {
        key: "scope",
        type: "select",
        labelEn: "Scope",
        labelAr: "النطاق",
        options: [
          { value: "GLOBAL", labelEn: "Global", labelAr: "عام" },
          { value: "TENANT", labelEn: "Tenant", labelAr: "مستأجر" },
        ],
      },
      {
        key: "tenant",
        type: "select",
        labelEn: "Tenant",
        labelAr: "المستأجر",
        dependencies: [
          {
            fieldKey: "scope",
            operator: "equals",
            value: "TENANT",
            reasonEn: "Choose Tenant scope before selecting a tenant.",
            reasonAr: "اختر نطاق المستأجر قبل تحديد مستأجر.",
          },
        ],
      },
    ];

    render(
      <FilterBar
        fields={dependencyFields}
        values={{ scope: "GLOBAL", tenant: "" }}
        onChange={vi.fn()}
      />,
    );

    const tenant = screen.getByRole("combobox", { name: "Tenant" });
    const reason = screen.getByText("Choose Tenant scope before selecting a tenant.");
    expect(tenant).toBeDisabled();
    expect(tenant.getAttribute("aria-describedby")).toContain(reason.id);
    expect(screen.getByText("Unavailable:")).toBeVisible();
  });

  it("keeps controls usable during a background refresh", () => {
    render(
      <FilterBar
        fields={fields}
        values={{ search: "", status: "", created: {} }}
        onChange={vi.fn()}
        isLoading
        isRefreshing
      />,
    );

    expect(screen.getByRole("region", { name: "Filters" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByLabelText("Search records")).not.toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Status" })).not.toBeDisabled();
  });

  it("debounces remote search and gives active chips a removal name", async () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(
      <FilterBar
        fields={fields}
        values={{ search: "alpha", status: "ACTIVE", created: {} }}
        onChange={onChange}
      />,
    );

    const removeStatus = screen.getByRole("button", { name: "Remove Status filter: Active" });
    expect(removeStatus).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search records"), { target: { value: "beta" } });
    expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ search: "beta" }));

    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ search: "beta", status: "ACTIVE" }));
    expect(navigation.replace).toHaveBeenCalledWith(expect.stringContaining("search=beta"), { scroll: false });

    fireEvent.click(removeStatus);
    expect(screen.getByRole("status")).toHaveTextContent("Filter removed");
  });

  it("resets documented defaults, writes the default URL contract, and announces the result", () => {
    navigation.search = "state=OFFLINE&unrelated=kept";
    const defaultFields: FilterField[] = [
      {
        key: "status",
        type: "select",
        labelEn: "Status",
        labelAr: "الحالة",
        defaultValue: "ACTIVE",
        query: { key: "state", serialization: "omit-default" },
        options: [
          { value: "ACTIVE", labelEn: "Active", labelAr: "نشط" },
          { value: "OFFLINE", labelEn: "Offline", labelAr: "غير متصل" },
        ],
      },
    ];
    const onChange = vi.fn();
    const onReset = vi.fn();

    render(
      <FilterBar
        fields={defaultFields}
        values={{ status: "OFFLINE" }}
        onChange={onChange}
        onReset={onReset}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    expect(onChange).toHaveBeenLastCalledWith({ status: "ACTIVE" });
    expect(onReset).toHaveBeenCalledOnce();
    expect(navigation.replace).toHaveBeenLastCalledWith("/records?unrelated=kept", { scroll: false });
    expect(screen.getByRole("status")).toHaveTextContent("Filters reset to defaults");
  });
});

describe("filter URL contract", () => {
  it("serializes date endpoints to explicit keys and restores typed values", () => {
    const written = writeFilterParams(new URLSearchParams("unrelated=kept"), fields, {
      search: "alpha",
      status: "ACTIVE",
      created: { from: "2026-08-01", to: "2026-08-29" },
    });

    expect(written.get("createdFrom")).toBe("2026-08-01");
    expect(written.get("createdTo")).toBe("2026-08-29");
    expect(written.toString()).not.toContain("%5Bobject+Object%5D");
    expect(written.get("unrelated")).toBe("kept");

    expect(readFilterParams(written, fields, {})).toEqual({
      search: "alpha",
      status: "ACTIVE",
      created: { from: "2026-08-01", to: "2026-08-29" },
    });
  });

  it("supports compact default serialization without losing refresh restoration", () => {
    const defaultFields: FilterField[] = [
      {
        key: "status",
        type: "select",
        labelEn: "Status",
        labelAr: "الحالة",
        defaultValue: "ACTIVE",
        query: { key: "state", serialization: "omit-default" },
      },
      {
        key: "archived",
        type: "boolean",
        labelEn: "Archived",
        labelAr: "مؤرشف",
        defaultValue: false,
        query: { serialization: "always" },
      },
    ];

    const written = writeFilterParams(new URLSearchParams("state=OFFLINE"), defaultFields, {
      status: "ACTIVE",
      archived: false,
    });

    expect(written.has("state")).toBe(false);
    expect(written.get("archived")).toBe("false");
    expect(readFilterParams(written, defaultFields, {})).toEqual({
      status: "ACTIVE",
      archived: false,
    });

    const legacyDefaultField: FilterField[] = [
      {
        key: "status",
        type: "select",
        defaultValue: "ACTIVE",
        query: { key: "state" },
      },
    ];
    expect(
      writeFilterParams(new URLSearchParams(), legacyDefaultField, { status: "ACTIVE" }).get("state"),
    ).toBe("ACTIVE");
  });
});
