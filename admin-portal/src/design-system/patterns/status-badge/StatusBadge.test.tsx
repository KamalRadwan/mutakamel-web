// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const i18n = vi.hoisted(() => ({ lang: "en" as "en" | "ar" }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ lang: i18n.lang }) }));

import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("uses the selected authoritative domain vocabulary", () => {
    const { rerender } = render(<StatusBadge status="PENDING" enumType="db-server" />);
    expect(screen.getByText("Pending").parentElement).toHaveClass("border-dashed");

    rerender(<StatusBadge status="ACTIVE" enumType="invoice" />);
    expect(screen.getByText("Unknown status")).toBeInTheDocument();
  });

  it("renders a deleted database server with its localized domain label", () => {
    const { rerender } = render(<StatusBadge status="DELETED" enumType="db-server" />);

    expect(screen.getByText("Deleted")).toBeInTheDocument();
    expect(screen.queryByText("Unknown status")).not.toBeInTheDocument();

    i18n.lang = "ar";
    rerender(<StatusBadge status="DELETED" enumType="db-server" />);

    expect(screen.getByText("محذوف")).toBeInTheDocument();
    expect(screen.queryByText("حالة غير معروفة")).not.toBeInTheDocument();
    i18n.lang = "en";
  });

  it("renders a localized unknown label and isolates the raw wire code", () => {
    i18n.lang = "ar";
    render(<StatusBadge status="FUTURE_STATE" enumType="tenant" />);

    expect(screen.getByText("حالة غير معروفة")).toBeInTheDocument();
    const raw = screen.getByText("FUTURE_STATE");
    expect(raw.tagName).toBe("BDI");
    expect(raw).toHaveAttribute("dir", "ltr");
    i18n.lang = "en";
  });

  it("localizes authoritative application and backup-artifact states", () => {
    const { rerender } = render(
      <>
        <StatusBadge status="DEPRECATED" enumType="application" />
        <StatusBadge status="SKIPPED" enumType="backup-artifact" />
      </>,
    );

    expect(screen.getByText("Deprecated")).toBeInTheDocument();
    expect(screen.getByText("Skipped")).toBeInTheDocument();

    i18n.lang = "ar";
    rerender(
      <>
        <StatusBadge status="DEPRECATED" enumType="application" />
        <StatusBadge status="SKIPPED" enumType="backup-artifact" />
      </>,
    );

    expect(screen.getByText("متقادم")).toBeInTheDocument();
    expect(screen.getByText("تم التخطي")).toBeInTheDocument();
    i18n.lang = "en";
  });

  it("does not reuse valid states across unrelated domain vocabularies", () => {
    const { rerender } = render(
      <StatusBadge status="DEPRECATED" enumType="backup-artifact" />,
    );
    expect(screen.getByText("Unknown status")).toBeInTheDocument();

    rerender(<StatusBadge status="SKIPPED" enumType="application" />);
    expect(screen.getByText("Unknown status")).toBeInTheDocument();
  });
});
