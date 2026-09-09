// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: { permissions: ["applications.activation.read"] } }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en }) }));
const { PermissionGate } = await import("./PermissionGate");
afterEach(cleanup);

describe("authoritative PermissionGate denial", () => {
  it("keeps existing advisory behavior unchanged", () => {
    render(<PermissionGate require="applications.activation.read">Visible facts</PermissionGate>);
    expect(screen.getByText("Visible facts")).toBeInTheDocument();
  });
  it.each([{ required: [] }, { required: ["applications.activation.read"] }])("a403 wins over advisory permission %j", ({ required }) => {
    render(<PermissionGate require={required} denied>Private facts</PermissionGate>);
    expect(screen.queryByText("Private facts")).not.toBeInTheDocument();
    expect(screen.getByText(en.permissionGate.title)).toBeInTheDocument();
  });
});
