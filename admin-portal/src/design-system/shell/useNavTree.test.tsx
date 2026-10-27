/* @vitest-environment jsdom */

import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useNavTree } from "./useNavTree";

const state = vi.hoisted(() => ({
  pathname: "/database-migrations",
  user: { isSuperAdmin: false, permissions: [] as string[] },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => state.pathname,
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: state.user }),
}));

describe("database migrations navigation", () => {
  beforeEach(() => {
    state.pathname = "/database-migrations";
    state.user = { isSuperAdmin: false, permissions: [] };
  });

  afterEach(cleanup);

  it("exposes a bilingual infrastructure destination with read permission alone", () => {
    state.user.permissions = ["admin.migrations.read"];

    const { result } = renderHook(() => useNavTree());
    const infrastructure = result.current.sections.find(
      (section) => section.key === "infrastructure",
    );

    expect(infrastructure?.items).toEqual([
      expect.objectContaining({
        key: "database-migrations",
        href: "/database-migrations",
        labelKey: { en: "Database Migrations", ar: "ترحيلات قواعد البيانات" },
        permission: { kind: "single", permission: "admin.migrations.read" },
        activePrefixes: ["/database-migrations"],
      }),
    ]);
  });

  it.each([
    { name: "no permissions", permissions: [] },
    { name: "unrelated read access", permissions: ["admin.database_servers.read"] },
    {
      name: "manage and critical without read",
      permissions: ["admin.migrations.manage", "admin.migrations.critical"],
    },
  ])("hides migrations for $name", ({ permissions }) => {
    state.user.permissions = permissions;

    const { result } = renderHook(() => useNavTree());

    expect(result.current.sections.flatMap((section) => section.items)).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ key: "database-migrations" })]),
    );
    expect(result.current.activeItem).toBeUndefined();
  });

  it.each(["/database-migrations", "/database-migrations/runs/run-123"])(
    "keeps migrations active at %s",
    (pathname) => {
      state.user.permissions = ["admin.migrations.read"];
      state.pathname = pathname;

      const { result } = renderHook(() => useNavTree());

      expect(result.current.activeItem?.key).toBe("database-migrations");
    },
  );
});

describe("settings navigation", () => {
  afterEach(cleanup);

  it.each([
    { permissions: [], visible: false },
    { permissions: ["admin.settings.update"], visible: false },
    { permissions: ["admin.provisioning.publisher-keys.read"], visible: false },
    { permissions: ["admin.settings.read"], visible: true },
  ])("filters Settings for $permissions", ({ permissions, visible }) => {
    state.user = { isSuperAdmin: false, permissions };
    state.pathname = "/settings/platform";
    const { result } = renderHook(() => useNavTree());
    const settings = result.current.sections.flatMap((section) => section.items)
      .find((item) => item.key === "settings");
    expect(Boolean(settings)).toBe(visible);
    expect(result.current.activeItem?.key).toBe(visible ? "settings" : undefined);
  });

  it("allows super admins without explicit permissions", () => {
    state.user = { isSuperAdmin: true, permissions: [] };
    state.pathname = "/settings";
    const { result } = renderHook(() => useNavTree());
    expect(result.current.activeItem?.key).toBe("settings");
  });
});
