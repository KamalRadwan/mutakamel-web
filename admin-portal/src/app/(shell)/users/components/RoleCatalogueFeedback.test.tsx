// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";

const locale = vi.hoisted(() => ({ lang: "en" as "en" | "ar" }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: locale.lang, t: locale.lang === "ar" ? ar : en }),
}));

import { RoleCatalogueFeedback } from "./RoleCatalogueFeedback";

describe("role catalogue feedback", () => {
  it.each(["en", "ar"] as const)("explains assignable-role prerequisites and empty results in %s", (lang) => {
    locale.lang = lang;
    const t = lang === "ar" ? ar : en;
    const retry = vi.fn();
    const { rerender } = render(<RoleCatalogueFeedback assignable status="unavailable" empty onRetry={retry} />);
    expect(screen.getByRole("status")).toHaveTextContent(t.users.assignableRolesPrerequisite);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    rerender(<RoleCatalogueFeedback assignable status="forbidden" empty onRetry={retry} />);
    expect(screen.getByRole("alert")).toHaveTextContent(t.users.assignableRolesForbidden);
    rerender(<RoleCatalogueFeedback assignable status="success" empty onRetry={retry} />);
    expect(screen.getByRole("status")).toHaveTextContent(t.users.assignableRolesEmpty);
  });
  it.each(["en", "ar"] as const)("distinguishes loading, empty, forbidden and error in %s", (lang) => {
    locale.lang = lang;
    const t = lang === "ar" ? ar : en;
    const retry = vi.fn();
    const { rerender } = render(<RoleCatalogueFeedback status="loading" empty onRetry={retry} />);
    expect(screen.getByRole("status")).toHaveTextContent(t.users.rolesLoading);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    rerender(<RoleCatalogueFeedback status="success" empty onRetry={retry} />);
    expect(screen.getByRole("status")).toHaveTextContent(t.users.rolesEmpty);
    rerender(<RoleCatalogueFeedback status="forbidden" empty onRetry={retry} />);
    expect(screen.getByRole("alert")).toHaveTextContent(t.users.rolesUnavailable);
    rerender(<RoleCatalogueFeedback status="error" empty onRetry={retry} />);
    expect(screen.getByRole("alert")).toHaveTextContent(t.users.rolesLoadFailed);
    expect(screen.queryByText(t.users.rolesEmpty)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t.common.retry }));
    expect(retry).toHaveBeenCalledOnce();
    rerender(<RoleCatalogueFeedback status="success" empty={false} onRetry={retry} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
