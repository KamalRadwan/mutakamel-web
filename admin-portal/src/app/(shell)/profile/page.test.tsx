// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NormalizedApiError } from "@/shared/api/normalized-api-error";

const { hookMock } = vi.hoisted(() => ({ hookMock: vi.fn() }));

vi.mock("./hooks/useMyProfile", () => ({ useMyProfile: hookMock }));

import MyProfilePage from "./page";

function baseView() {
  return {
    lang: "en" as "ar" | "en",
    themeKey: "dark",
    setThemeKey: vi.fn(),
    language: "en",
    setLanguage: vi.fn(),
    tableDensity: "compact",
    setTableDensity: vi.fn(),
    isLoading: false,
    isSaving: false,
    loadError: null as NormalizedApiError | null,
    saveError: null as NormalizedApiError | null,
    hasChanges: false,
    saveProfile: vi.fn(),
    reload: vi.fn(),
  };
}

describe("MyProfilePage", () => {
  beforeEach(() => hookMock.mockReset().mockReturnValue(baseView()));

  it("renders a distinct unavailable state with safe evidence and retry", () => {
    const view = baseView();
    view.loadError = {
      isNormalized: true,
      httpStatus: 503,
      errorCode: "UPSTREAM_UNAVAILABLE",
      message: "raw upstream detail",
      correlationId: "019f0000-0000-7000-8000-000000000001",
    };
    hookMock.mockReturnValue(view);
    render(<MyProfilePage />);

    expect(
      screen.getByRole("heading", {
        name: "Profile is temporarily unavailable",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("UPSTREAM_UNAVAILABLE")).toBeInTheDocument();
    expect(screen.queryByText("raw upstream detail")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(view.reload).toHaveBeenCalledOnce();
  });

  it("renders forbidden without offering a misleading retry", () => {
    const view = baseView();
    view.loadError = {
      isNormalized: true,
      httpStatus: 403,
      errorCode: "FORBIDDEN",
      message: "Forbidden",
    };
    hookMock.mockReturnValue(view);
    render(<MyProfilePage />);

    expect(
      screen.getByRole("heading", { name: "Profile access is forbidden" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Retry" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the editable profile visible while reporting a failed save", () => {
    const view = baseView();
    view.saveError = {
      isNormalized: true,
      httpStatus: 409,
      errorCode: "PROFILE_CONFLICT",
      message: "Conflict",
      correlationId: "019f0000-0000-7000-8000-000000000002",
    };
    hookMock.mockReturnValue(view);
    render(<MyProfilePage />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Changes were not saved",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("PROFILE_CONFLICT");
    expect(screen.getByText("Color Theme Preference")).toBeInTheDocument();
  });

  it("renders Arabic in RTL for the loading boundary", () => {
    const view = baseView();
    view.lang = "ar";
    view.isLoading = true;
    hookMock.mockReturnValue(view);
    const { container } = render(<MyProfilePage />);

    expect(container.firstElementChild).toHaveAttribute("dir", "rtl");
    expect(screen.getByText("جارٍ تحميل التفضيلات...")).toBeInTheDocument();
  });
});
