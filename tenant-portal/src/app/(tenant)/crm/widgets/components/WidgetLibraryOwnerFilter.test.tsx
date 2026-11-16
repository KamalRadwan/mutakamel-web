// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { WIDGET_OWNER_OPTIONS_PATH } from "../../dashboards/widget-library-contract";
import { WidgetLibraryOwnerFilter } from "./WidgetLibraryOwnerFilter";

const mocks = vi.hoisted(() => ({ get: vi.fn(), startRead: () => ({}), currentRead: () => true }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: null }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en }) }));
vi.mock("@/lib/api/axiosClient", () => ({ axiosClient: { get: mocks.get } }));
vi.mock("../hooks/useWidgetSafety", () => ({ useWidgetSafety: () => ({ startRead: mocks.startRead, currentRead: mocks.currentRead }) }));

afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("widget owner filter", () => {
  it("loads owners only when opened, requests the scoped cursor and selects the current option", async () => {
    const recent = "018f0000-0000-7000-8000-000000000102";
    const older = "018f0000-0000-7000-8000-000000000101";
    mocks.get.mockResolvedValueOnce({ status: 200, data: { items: [{ id: recent, name: "Recent owner" }], nextCursor: recent } })
      .mockResolvedValueOnce({ status: 200, data: { items: [{ id: older, name: "Older owner" }], nextCursor: null } });
    const onChange = vi.fn();
    render(<WidgetLibraryOwnerFilter access="TEAM" value={null} onChange={onChange} disabled={false} />);
    expect(mocks.get).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: en.crmWidgets.owner }));
    expect(await screen.findByRole("option", { name: "Recent owner" })).toBeVisible();
    expect(mocks.get).toHaveBeenCalledWith(`${WIDGET_OWNER_OPTIONS_PATH}?access=TEAM`, expect.anything());
    fireEvent.click(screen.getByRole("button", { name: en.common.nextPage }));
    const option = await screen.findByRole("option", { name: "Older owner" });
    expect(screen.queryByRole("option", { name: "Recent owner" })).toBeNull();
    expect(mocks.get).toHaveBeenLastCalledWith(`${WIDGET_OWNER_OPTIONS_PATH}?access=TEAM&cursor=${recent}`, expect.anything());
    fireEvent.click(option);
    expect(onChange).toHaveBeenCalledExactlyOnceWith(older);
  });
});
