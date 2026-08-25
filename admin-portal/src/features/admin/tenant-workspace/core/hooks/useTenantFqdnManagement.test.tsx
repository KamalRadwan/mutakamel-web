// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CUSTOM_FQDN_ID,
  OTHER_TENANT_ID,
  PLATFORM_FQDN_ID,
  TENANT_ID,
  customFqdnFixture,
  tenantFixture,
} from "../__tests__/fixtures";
import type {
  FqdnAvailabilityResult,
  TenantFqdnView,
  TenantView,
} from "../types";

const api = vi.hoisted(() => ({
  listFqdns: vi.fn(),
  validateFqdn: vi.fn(),
  addFqdn: vi.fn(),
  removeFqdn: vi.fn(),
  promoteFqdn: vi.fn(),
}));

vi.mock("../api/tenant-core.api", () => ({ tenantCoreApi: api }));

import { useTenantFqdnManagement } from "./useTenantFqdnManagement";

const permissions = {
  canRead: true,
  canValidateFqdn: true,
  canManageFqdns: true,
};
const available: FqdnAvailabilityResult = {
  fqdn: "portal.example.com",
  valid: true,
  available: true,
  message: "Available",
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function renderFqdn(
  tenant: TenantView = tenantFixture(),
  overrides: Partial<{
    tenantId: string;
    permissions: typeof permissions;
    replaceTenant: (value: TenantView) => void;
    refreshTenant: () => Promise<TenantView | null>;
  }> = {},
) {
  const replaceTenant = overrides.replaceTenant ?? vi.fn();
  const refreshTenant =
    overrides.refreshTenant ?? vi.fn().mockResolvedValue(tenant);
  const rendered = renderHook(
    (props) =>
      useTenantFqdnManagement({
        tenantId: props.tenantId,
        tenant: props.tenant,
        permissions: props.permissions,
        replaceTenant,
        refreshTenant,
      }),
    {
      initialProps: {
        tenantId: overrides.tenantId ?? tenant.id,
        tenant,
        permissions: overrides.permissions ?? permissions,
      },
    },
  );
  return { ...rendered, replaceTenant, refreshTenant };
}

describe("useTenantFqdnManagement", () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    api.listFqdns.mockResolvedValue(tenantFixture().fqdns);
  });

  it("invalidates and aborts stale preflight evidence when input changes", async () => {
    const pending = deferred<FqdnAvailabilityResult>();
    api.validateFqdn.mockReturnValue(pending.promise);
    const { result } = renderFqdn();
    act(() => result.current.setCandidate("Portal.Example.com"));

    let request!: Promise<FqdnAvailabilityResult | null>;
    act(() => {
      request = result.current.preflight();
    });
    await waitFor(() => expect(api.validateFqdn).toHaveBeenCalledOnce());
    const signal = api.validateFqdn.mock.calls[0]?.[1] as AbortSignal;
    act(() => result.current.setCandidate("other.example.com"));
    expect(signal.aborted).toBe(true);
    await act(async () => pending.resolve(available));
    await expect(request).resolves.toBeNull();
    expect(result.current.evidence).toBeNull();
    expect(result.current.canAdd).toBe(false);
  });

  it("loads the exact FQDN collection and merges an authoritative add result", async () => {
    api.validateFqdn.mockResolvedValue(available);
    api.addFqdn.mockResolvedValue(customFqdnFixture());
    const replaceTenant = vi.fn();
    const { result } = renderFqdn(tenantFixture(), { replaceTenant });
    await waitFor(() =>
      expect(api.listFqdns).toHaveBeenCalledWith(
        TENANT_ID,
        expect.any(AbortSignal),
      ),
    );
    act(() => result.current.setCandidate(" Portal.Example.COM "));
    await act(async () => {
      await result.current.preflight();
    });
    expect(result.current.canAdd).toBe(true);

    await act(async () => {
      await result.current.add();
    });
    expect(api.addFqdn).toHaveBeenCalledWith(
      TENANT_ID,
      "portal.example.com",
      expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-7/i),
    );
    expect(replaceTenant).toHaveBeenCalledWith(
      expect.objectContaining({
        fqdns: expect.arrayContaining([
          expect.objectContaining({ id: CUSTOM_FQDN_ID }),
        ]),
      }),
    );
    expect(result.current.candidate).toBe("");
    expect(result.current.evidence).toBeNull();
  });

  it("does not reuse the embedded detail projection when the exact list fails", async () => {
    api.listFqdns.mockRejectedValue({
      isNormalized: true,
      httpStatus: 503,
      errorCode: "TENANT_FQDN_LIST_UNAVAILABLE",
      message: "Unavailable",
    });
    const { result } = renderFqdn();
    await waitFor(() =>
      expect(result.current.listError).toMatchObject({
        errorCode: "TENANT_FQDN_LIST_UNAVAILABLE",
      }),
    );
    expect(result.current.fqdns).toEqual([]);
  });

  it("allows an available DNS-not-ready result to attach as pending", async () => {
    api.validateFqdn.mockResolvedValue({
      ...available,
      valid: false,
      reason: "DNS_NOT_FOUND",
      message: "Prepare DNS",
    });
    const { result } = renderFqdn();
    act(() => result.current.setCandidate("portal.example.com"));
    await act(async () => {
      await result.current.preflight();
    });
    expect(result.current.canAdd).toBe(true);
  });

  it("requires current preflight evidence and ACTIVE state before add", async () => {
    const { result } = renderFqdn(tenantFixture("SUSPENDED"));
    act(() => result.current.setCandidate("portal.example.com"));

    await expect(result.current.add()).rejects.toMatchObject({
      errorCode: "TENANT_FQDN_STATE_INVALID",
    });
    expect(api.addFqdn).not.toHaveBeenCalled();
  });

  it("prevents primary removal locally and reconciles secondary removal via detail", async () => {
    const tenant = tenantFixture("ACTIVE", {
      fqdns: [tenantFixture().fqdns[0]!, customFqdnFixture()],
    });
    api.removeFqdn.mockResolvedValue(undefined);
    const refreshTenant = vi.fn().mockResolvedValue(tenant);
    const { result } = renderFqdn(tenant, { refreshTenant });

    await expect(result.current.remove(PLATFORM_FQDN_ID)).rejects.toMatchObject(
      {
        errorCode: "TENANT_FQDN_REMOVE_NOT_ALLOWED",
      },
    );
    expect(api.removeFqdn).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.remove(CUSTOM_FQDN_ID);
    });
    expect(api.removeFqdn).toHaveBeenCalledWith(
      TENANT_ID,
      CUSTOM_FQDN_ID,
      expect.any(String),
    );
    expect(refreshTenant).toHaveBeenCalledOnce();
  });

  it("reuses the remove intent key only for an ambiguous exact retry", async () => {
    const tenant = tenantFixture("ACTIVE", { fqdns: [customFqdnFixture()] });
    api.removeFqdn.mockRejectedValue({
      isNormalized: true,
      httpStatus: 503,
      errorCode: "TEMPORARY",
      message: "Try again",
    });
    const { result } = renderFqdn(tenant);

    await act(async () => {
      await result.current.remove(CUSTOM_FQDN_ID).catch(() => undefined);
      await result.current.remove(CUSTOM_FQDN_ID).catch(() => undefined);
    });
    expect(api.removeFqdn.mock.calls[0]?.[2]).toBe(
      api.removeFqdn.mock.calls[1]?.[2],
    );
  });

  it("blocks platform-era primary promotion and allows verified legacy promotion", async () => {
    const normal = tenantFixture("ACTIVE", {
      fqdns: [tenantFixture().fqdns[0]!, customFqdnFixture()],
    });
    const normalHook = renderFqdn(normal);
    await expect(
      normalHook.result.current.promote(CUSTOM_FQDN_ID),
    ).rejects.toMatchObject({ errorCode: "TENANT_FQDN_PROMOTION_NOT_ALLOWED" });
    expect(api.promoteFqdn).not.toHaveBeenCalled();
    normalHook.unmount();

    const legacy = tenantFixture("ACTIVE", { fqdns: [customFqdnFixture()] });
    api.promoteFqdn.mockResolvedValue(undefined);
    const refreshTenant = vi.fn().mockResolvedValue(legacy);
    const legacyHook = renderFqdn(legacy, { refreshTenant });
    await act(async () => {
      await legacyHook.result.current.promote(CUSTOM_FQDN_ID);
    });
    expect(api.promoteFqdn).toHaveBeenCalledWith(
      TENANT_ID,
      CUSTOM_FQDN_ID,
      expect.any(String),
    );
    expect(refreshTenant).toHaveBeenCalledOnce();
  });

  it("clears candidate/evidence and aborts on tenant identity change", async () => {
    api.validateFqdn.mockResolvedValue(available);
    const rendered = renderFqdn();
    act(() => rendered.result.current.setCandidate("portal.example.com"));
    await act(async () => rendered.result.current.preflight());
    expect(rendered.result.current.evidence).not.toBeNull();

    rendered.rerender({
      tenantId: OTHER_TENANT_ID,
      tenant: tenantFixture("ACTIVE", {
        id: OTHER_TENANT_ID,
        name: "other",
        fqdns: [],
      }),
      permissions,
    });
    await waitFor(() => expect(rendered.result.current.candidate).toBe(""));
    expect(rendered.result.current.evidence).toBeNull();
  });

  it("does not apply an add result after tenant identity changes", async () => {
    const addRequest = deferred<ReturnType<typeof customFqdnFixture>>();
    api.validateFqdn.mockResolvedValue(available);
    api.addFqdn.mockReturnValue(addRequest.promise);
    const replaceTenant = vi.fn();
    const rendered = renderFqdn(tenantFixture(), { replaceTenant });
    act(() => rendered.result.current.setCandidate("portal.example.com"));
    await act(async () => rendered.result.current.preflight());

    let addition!: Promise<TenantFqdnView>;
    act(() => {
      addition = rendered.result.current.add();
    });
    const additionOutcome = addition.catch((error: unknown) => error);
    rendered.rerender({
      tenantId: OTHER_TENANT_ID,
      tenant: tenantFixture("ACTIVE", {
        id: OTHER_TENANT_ID,
        name: "other",
        fqdns: [],
      }),
      permissions,
    });
    await act(async () => addRequest.resolve(customFqdnFixture()));
    await expect(additionOutcome).resolves.toMatchObject({
      errorCode: "TENANT_CONTEXT_CHANGED",
    });
    expect(replaceTenant).not.toHaveBeenCalled();
  });
});
