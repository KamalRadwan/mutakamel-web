// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider, useI18n } from "@/i18n/I18nContext";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";

const { showAppToastMock } = vi.hoisted(() => ({ showAppToastMock: vi.fn() }));

vi.mock("sonner", () => ({ Toaster: () => null }));
vi.mock("./toast-bridge", () => ({
  GLOBAL_TOAST_EVENT: "global-toast",
  showAppToast: showAppToastMock,
}));

import { ToastProvider } from "./ToastProvider";
import { GLOBAL_TOAST_EVENT, type GlobalToastEventDetail } from "./toast-bridge";

function LanguageToggle() {
  const { toggleLang } = useI18n();
  return <button onClick={toggleLang}>Switch language</button>;
}

function dispatchAuthorizationToast() {
  const detail: GlobalToastEventDetail = {
    type: "error",
    localizationKey: "authorizationDenied",
  };
  act(() => { window.dispatchEvent(new CustomEvent(GLOBAL_TOAST_EVENT, { detail })); });
}

describe("global authorization toast localization", () => {
  beforeEach(() => {
    showAppToastMock.mockReset();
    localStorage.clear();
  });
  afterEach(cleanup);

  it.each(["ar", "en"] as const)("uses %s and follows a language switch without duplicate listeners", (lang) => {
    localStorage.setItem("app_lang", lang);
    const initial = lang === "ar" ? ar : en;
    const switched = lang === "ar" ? en : ar;
    const { unmount } = render(
      <I18nProvider>
        <ToastProvider><LanguageToggle /></ToastProvider>
      </I18nProvider>,
    );

    dispatchAuthorizationToast();
    expect(showAppToastMock).toHaveBeenCalledExactlyOnceWith(
      "error", initial.globalToast.authorizationDenied.title,
      initial.globalToast.authorizationDenied.message, undefined,
      lang === "ar" ? "إغلاق الإشعار" : "Dismiss notification",
    );

    fireEvent.click(screen.getByRole("button", { name: "Switch language" }));
    dispatchAuthorizationToast();
    expect(showAppToastMock).toHaveBeenCalledTimes(2);
    expect(showAppToastMock).toHaveBeenLastCalledWith(
      "error", switched.globalToast.authorizationDenied.title,
      switched.globalToast.authorizationDenied.message, undefined,
      lang === "ar" ? "Dismiss notification" : "إغلاق الإشعار",
    );

    unmount();
    dispatchAuthorizationToast();
    expect(showAppToastMock).toHaveBeenCalledTimes(2);
  });
});
