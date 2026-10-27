// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMfaChallenge } from "@/lib/auth/useMfaChallenge";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { MfaCodeStep } from "./MfaCodeStep";

const locale = vi.hoisted(() => ({ lang: "en" as "ar" | "en" }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: locale.lang, t: locale.lang === "ar" ? ar : en }),
}));
afterEach(cleanup);

describe.each(["ar", "en"] as const)("tenant MFA input in %s", (lang) => {
  it("labels a paste/autofill-capable text code and keeps its leading zeroes in a POST body", async () => {
    locale.lang = lang;
    const copy = (lang === "ar" ? ar : en).mfa;
    const verify = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useMfaChallenge(verify));
    act(() => result.current.start({ mfaRequired: true, challengeId: "a".repeat(43), expiresIn: 600, resendAfterSeconds: 60 }));
    const view = render(<MfaCodeStep flow={result.current} onRestart={result.current.reset} />);
    const input = screen.getByRole("textbox", { name: new RegExp(copy.codeLabel) });
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveAttribute("inputmode", "numeric");
    expect(input).toHaveAttribute("autocomplete", "one-time-code");
    expect(input).toHaveAttribute("dir", "ltr");
    expect(input.closest("form")?.method).toBe("post");
    fireEvent.change(input, { target: { value: "012345" } });
    view.rerender(<MfaCodeStep flow={result.current} onRestart={result.current.reset} />);
    await act(async () => { fireEvent.submit(input.closest("form")!); });
    expect(verify).toHaveBeenCalledWith("a".repeat(43), "012345");
    expect(result.current.code).toBe("");
    expect(screen.getByRole("button", { name: copy.resendWait.replace("{seconds}", "60") })).toBeDisabled();
  });
});
