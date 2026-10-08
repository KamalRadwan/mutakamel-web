// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkerEventKeysSettings } from "./WorkerEventKeysSettings";

const context = vi.hoisted(() => ({ permissions: [] as string[], lang: "en" as "en" | "ar" }));
const api = vi.hoisted(() => ({ list: vi.fn(), configured: vi.fn(), adopt: vi.fn() }));
vi.mock("../api", () => ({ workerEventKeysApi: api }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: { id: "admin", isSuperAdmin: false, permissions: context.permissions }, isLoading: false }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ lang: context.lang, dir: context.lang === "ar" ? "rtl" : "ltr" }) }));
const read = "admin.provisioning.publisher-keys.read";
const manage = "admin.provisioning.publisher-keys.manage";
const critical = "admin.provisioning.critical";
const current = { trustSlot: "ACTIVE", issuer: "worker", keyId: "worker.1", algorithm: "RS256", publicKeyFingerprint: "a".repeat(64) };

describe("Worker key settings", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    context.lang = "en";
    context.permissions = [read, manage, critical];
    api.list.mockResolvedValue([]);
    api.configured.mockResolvedValue([current]);
  });
  afterEach(cleanup);

  it.each([{ permissions: [read] }, { permissions: [read, manage] }, { permissions: [read, critical] }])("requires both write permissions", async ({ permissions }) => {
    context.permissions = permissions;
    render(<WorkerEventKeysSettings />);
    await screen.findByText("worker.1 · RS256");
    expect(screen.queryByRole("button", { name: "Register current key" })).toBeNull();
  });

  it("loads identity without input and confirms before writing", async () => {
    render(<WorkerEventKeysSettings />);
    const register = screen.getByRole("button", { name: "Register current key" });
    await waitFor(() => expect(register).toBeEnabled());
    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.click(register);
    expect(screen.getByRole("alertdialog")).toHaveTextContent(current.publicKeyFingerprint);
    expect(api.adopt).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(api.adopt).not.toHaveBeenCalled();
  });

  it("supports Arabic labels and direction", async () => {
    context.lang = "ar";
    const { container } = render(<WorkerEventKeysSettings />);
    await waitFor(() => expect(screen.getByRole("button", { name: "تسجيل المفتاح الحالي" })).toBeEnabled());
    expect(container.firstChild).toHaveAttribute("dir", "rtl");
  });

  it("shows forbidden reads as errors rather than an empty registry", async () => {
    api.list.mockRejectedValue({ response: { status: 403, data: { errorCode: "FORBIDDEN", success: false, message: "Denied" } } });
    render(<WorkerEventKeysSettings />);
    await screen.findByRole("alert");
    expect(screen.queryByText(/No Worker verification key is registered/)).toBeNull();
  });
});
