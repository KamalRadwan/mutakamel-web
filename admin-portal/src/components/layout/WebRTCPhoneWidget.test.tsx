// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { i18nMock, phoneMock } = vi.hoisted(() => ({
  i18nMock: {
    lang: "en" as "ar" | "en",
    dir: "ltr" as "rtl" | "ltr",
  },
  phoneMock: {
    shouldRender: true,
    expanded: true,
    setExpanded: vi.fn(),
    activeTab: "phone" as "phone" | "log",
    setActiveTab: vi.fn(),
    connectionState: "registered" as const,
    callState: "idle" as const,
    status: "Ready",
    dialTarget: "",
    setDialTarget: vi.fn(),
    displayNumber: "",
    phoneDisplayName: "Admin Phone",
    callBusy: false,
    callActive: false,
    incomingCallWaiting: false,
    callPeerNumber: "",
    callPeerName: "",
    timerLabel: undefined as string | undefined,
    mediaNotice: undefined as string | undefined,
    canCall: false,
    keypad: [{ value: "1", letters: "" }] as const,
    makeCall: vi.fn(async () => undefined),
    answerCall: vi.fn(),
    declineCall: vi.fn(),
    hangupCall: vi.fn(),
    dismissIncomingPopup: vi.fn(),
    showIncomingPopup: false,
    copyNumber: vi.fn(),
    deleteLastDigit: vi.fn(),
    pressDigit: vi.fn(),
    muted: false,
    toggleMute: vi.fn(),
    speakerMuted: false,
    toggleSpeakerMute: vi.fn(),
    held: false,
    toggleHold: vi.fn(),
    micLevel: 0,
    speakerLevel: 0,
    micVolume: 70,
    speakerVolume: 60,
    setMicVolumeLevel: vi.fn(),
    setSpeakerVolumeLevel: vi.fn(),
    autoAnswer: false,
    setAutoAnswer: vi.fn(),
    doNotDisturb: false,
    setDoNotDisturb: vi.fn(),
    callLogs: [],
    logsLoading: false,
  },
}));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({
    lang: i18nMock.lang,
    dir: i18nMock.dir,
  }),
}));

vi.mock("./hooks/useWebRTCPhone", () => ({
  useWebRTCPhone: () => [phoneMock, { current: null }] as const,
  formatWebphoneLogTime: () => "10:00",
}));

import { WebRTCPhoneWidget } from "./WebRTCPhoneWidget";

describe("WebRTCPhoneWidget", () => {
  beforeEach(() => {
    i18nMock.lang = "en";
    i18nMock.dir = "ltr";
    phoneMock.expanded = true;
    phoneMock.activeTab = "phone";
    phoneMock.setExpanded.mockReset();
    phoneMock.setActiveTab.mockReset();
  });

  it("exposes labelled tabs and implements Arrow, Home, and End navigation", async () => {
    const { rerender } = render(<WebRTCPhoneWidget />);

    expect(screen.getByRole("tablist", { name: "Phone sections" })).toBeInTheDocument();
    const phoneTab = screen.getByRole("tab", { name: "Phone" });
    const logTab = screen.getByRole("tab", { name: "Call log" });

    expect(phoneTab).toHaveAttribute("aria-selected", "true");
    expect(phoneTab).toHaveAttribute("aria-controls");
    expect(screen.getByRole("tabpanel", { name: "Phone" })).toBeInTheDocument();

    phoneTab.focus();
    fireEvent.keyDown(phoneTab, { key: "ArrowRight" });
    await waitFor(() => expect(logTab).toHaveFocus());
    expect(phoneMock.setActiveTab).toHaveBeenCalledWith("log");

    phoneMock.activeTab = "log";
    rerender(<WebRTCPhoneWidget />);
    phoneMock.setActiveTab.mockClear();
    fireEvent.keyDown(logTab, { key: "Home" });
    await waitFor(() => expect(phoneTab).toHaveFocus());
    expect(phoneMock.setActiveTab).toHaveBeenCalledWith("phone");

    phoneMock.activeTab = "phone";
    rerender(<WebRTCPhoneWidget />);
    fireEvent.keyDown(phoneTab, { key: "End" });
    await waitFor(() => expect(logTab).toHaveFocus());
  });

  it("keeps a persistent localized label on the dial field", () => {
    render(<WebRTCPhoneWidget />);

    expect(screen.getByLabelText("Phone number")).toHaveAttribute("inputmode", "tel");
    expect(screen.getByRole("button", { name: "Dial digit 1" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Microphone volume" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Speaker volume" })).toBeInTheDocument();
  });

  it("uses the current Arabic locale and RTL directional arrow behavior", async () => {
    i18nMock.lang = "ar";
    i18nMock.dir = "rtl";
    render(<WebRTCPhoneWidget />);

    const phoneTab = screen.getByRole("tab", { name: "الهاتف" });
    const logTab = screen.getByRole("tab", { name: "السجل" });
    expect(screen.getByLabelText("رقم الهاتف")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "طلب الرقم 1" })).toBeInTheDocument();

    phoneTab.focus();
    fireEvent.keyDown(phoneTab, { key: "ArrowLeft" });
    await waitFor(() => expect(logTab).toHaveFocus());
    expect(phoneMock.setActiveTab).toHaveBeenCalledWith("log");
  });

  it("collapses before page focus can be obscured by the expanded dock", () => {
    render(
      <>
        <button type="button">Page action</button>
        <WebRTCPhoneWidget />
      </>,
    );

    screen.getByRole("button", { name: "Page action" }).focus();
    expect(phoneMock.setExpanded).toHaveBeenCalledWith(false);
  });
});
