// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { axiosMock, authMock, themeMock } = vi.hoisted(() => ({
  axiosMock: { get: vi.fn() },
  authMock: { user: null as { id: string } | null, isLoading: false },
  themeMock: { setTheme: vi.fn() },
}));

vi.mock("@/lib/api/axiosClient", () => ({ axiosClient: axiosMock }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => authMock }));
vi.mock("next-themes", () => ({ useTheme: () => themeMock }));

import {
  PreferencesProvider,
  useTableDensity,
} from "./PreferencesContext";

/**
 * UI-010. The profile form saved `themeKey` and `tableDensity` and nothing read
 * them back: an administrator could set a preference, watch it persist, sign in
 * again, and find the portal exactly as it was. A source-wide search found the
 * two names only in the form, its hook, the API types and a read-only card.
 */

function DensityProbe() {
  return <span data-testid="density">{useTableDensity()}</span>;
}

const profile = (overrides: Record<string, unknown> = {}) => ({
  data: {
    data: {
      themeKey: "light",
      extensions: { tableDensity: "comfortable" },
      ...overrides,
    },
  },
});

describe("saved profile preferences", () => {
  beforeEach(() => {
    axiosMock.get.mockReset();
    themeMock.setTheme.mockReset();
    authMock.user = { id: "admin-1" };
    axiosMock.get.mockResolvedValue(profile());
  });

  it("applies the saved theme and density once the session is authenticated", async () => {
    render(
      <PreferencesProvider>
        <DensityProbe />
      </PreferencesProvider>,
    );

    await waitFor(() => expect(themeMock.setTheme).toHaveBeenCalledWith("light"));
    await waitFor(() =>
      expect(screen.getByTestId("density")).toHaveTextContent("comfortable"),
    );
  });

  it("reads nothing while there is no session", async () => {
    authMock.user = null;

    render(
      <PreferencesProvider>
        <DensityProbe />
      </PreferencesProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("density")).toHaveTextContent("compact"),
    );
    expect(axiosMock.get).not.toHaveBeenCalled();
    expect(themeMock.setTheme).not.toHaveBeenCalled();
  });

  /**
   * The precedence, which had to be decided rather than discovered: the saved
   * profile is an account preference and the header toggle is a this-browser,
   * now override. Applying the profile on every read would fight the toggle,
   * so it is applied when it changes - which includes the first load.
   */
  it("does not re-apply the same saved theme over a local toggle", async () => {
    const { rerender } = render(
      <PreferencesProvider>
        <DensityProbe />
      </PreferencesProvider>,
    );
    await waitFor(() => expect(themeMock.setTheme).toHaveBeenCalledTimes(1));

    rerender(
      <PreferencesProvider>
        <DensityProbe />
      </PreferencesProvider>,
    );

    await waitFor(() => expect(axiosMock.get).toHaveBeenCalled());
    expect(themeMock.setTheme).toHaveBeenCalledTimes(1);
  });

  it("ignores a stored value the portal cannot render", async () => {
    axiosMock.get.mockResolvedValue(
      profile({ themeKey: "midnight", extensions: { tableDensity: "huge" } }),
    );

    render(
      <PreferencesProvider>
        <DensityProbe />
      </PreferencesProvider>,
    );

    await waitFor(() => expect(axiosMock.get).toHaveBeenCalled());
    expect(themeMock.setTheme).not.toHaveBeenCalled();
    expect(screen.getByTestId("density")).toHaveTextContent("compact");
  });

  it("leaves the portal usable when the profile cannot be read", async () => {
    axiosMock.get.mockRejectedValue(new Error("offline"));

    render(
      <PreferencesProvider>
        <DensityProbe />
      </PreferencesProvider>,
    );

    await waitFor(() => expect(axiosMock.get).toHaveBeenCalled());
    expect(screen.getByTestId("density")).toHaveTextContent("compact");
    expect(themeMock.setTheme).not.toHaveBeenCalled();
  });
});
