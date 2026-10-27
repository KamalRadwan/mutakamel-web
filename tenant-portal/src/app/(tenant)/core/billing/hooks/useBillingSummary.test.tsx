// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TopupResult } from "../wallet-contract";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  uuid: vi.fn(),
  toast: { success: vi.fn(), outcomeFromApi: vi.fn(), errorFromApi: vi.fn() },
}));
vi.mock("@/design-system", () => ({ useToast: () => mocks.toast }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: { coreBilling: {} } }) }));
vi.mock("@/lib/uuid", () => ({ generateUUIDv7: mocks.uuid }));
vi.mock("../billing-contract", () => ({ fetchBillingSummary: vi.fn().mockResolvedValue(null) }));
vi.mock("../payment-contract", () => ({ fetchPaymentInputCurrencies: vi.fn().mockResolvedValue(null) }));
vi.mock("../wallet-contract", () => ({ createWalletTopup: mocks.create }));
const { useBillingSummary } = await import("./useBillingSummary");

const checkout: TopupResult = {
  paymentId: "01900000-0000-7000-8000-000000000001",
  checkoutUrl: "https://checkout.example/payment",
  replayed: false,
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.create.mockReset();
  mocks.uuid.mockReset().mockReturnValueOnce("key-one").mockReturnValueOnce("key-two");
});
afterEach(cleanup);

async function setup() {
  const hook = renderHook(() => useBillingSummary());
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  return hook;
}

describe("wallet top-up intent recovery", () => {
  it("recovers the original checkout after creation succeeds but its response is lost", async () => {
    const stored = new Map<string, TopupResult>();
    mocks.create.mockImplementation(async (_amount: string, _currency: string, key: string) => {
      const previous = stored.get(key);
      if (previous) return { ...previous, replayed: true };
      stored.set(key, checkout);
      throw new TypeError("Response lost");
    });
    const { result } = await setup();
    await act(async () => { expect(await result.current.submitTopup(" 25.0000 ", "USD")).toBe(false); });
    await act(async () => { expect(await result.current.submitTopup("25.0000", "USD")).toBe(true); });
    expect(mocks.create.mock.calls).toEqual([
      ["25.0000", "USD", "key-one"],
      ["25.0000", "USD", "key-one"],
    ]);
    expect(stored.size).toBe(1);
    expect(result.current.topup).toEqual({ ...checkout, replayed: true });
    expect(mocks.uuid).toHaveBeenCalledTimes(1);
  });

  it.each([["30", "USD"], ["25", "EGP"]])("creates a new key when the intent changes to %s %s", async (amount, currency) => {
    mocks.create.mockRejectedValueOnce(new TypeError("Response lost")).mockResolvedValueOnce(checkout);
    const { result } = await setup();
    await act(async () => { await result.current.submitTopup("25", "USD"); });
    await act(async () => { await result.current.submitTopup(amount, currency); });
    expect(mocks.create).toHaveBeenLastCalledWith(amount, currency, "key-two");
  });

  it("uses a fresh key for a new submission after a confirmed checkout is dismissed", async () => {
    mocks.create.mockResolvedValue(checkout);
    const { result } = await setup();
    await act(async () => { await result.current.submitTopup("25", "USD"); });
    act(() => result.current.dismissTopup());
    await act(async () => { await result.current.submitTopup("25", "USD"); });
    expect(mocks.create).toHaveBeenLastCalledWith("25", "USD", "key-two");
  });

  it("blocks concurrent submissions before the loading state rerenders", async () => {
    let resolve!: (value: TopupResult) => void;
    mocks.create.mockReturnValue(new Promise<TopupResult>((accept) => { resolve = accept; }));
    const { result } = await setup();
    await act(async () => {
      const first = result.current.submitTopup("25", "USD");
      expect(await result.current.submitTopup("30", "USD")).toBe(false);
      resolve(checkout);
      await first;
    });
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });
});
