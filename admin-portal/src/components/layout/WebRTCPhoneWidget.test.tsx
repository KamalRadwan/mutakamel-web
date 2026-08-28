// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WebphoneConnectionState, WebphoneStatus } from "@mutakamel/webphone";

const { langMock } = vi.hoisted(() => ({ langMock: { lang: "en" as "en" | "ar" } }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => langMock,
}));

const { phoneMock } = vi.hoisted(() => ({
  phoneMock: {
    shouldRender: true,
    showIncomingPopup: false,
    callPeerNumber: "",
    callPeerName: "",
    expanded: false,
    setExpanded: vi.fn(),
    connectionState: "ready" as WebphoneConnectionState,
    phoneDisplayName: "Admin Phone",
    activeTab: "phone" as "phone" | "log",
    setActiveTab: vi.fn(),
    callBusy: false,
    displayNumber: "",
    setDialTarget: vi.fn(),
    dialTarget: "",
    deleteLastDigit: vi.fn(),
    copyNumber: vi.fn(),
    incomingCallWaiting: false,
    callActive: false,
    status: { code: "ready" } as WebphoneStatus,
    timerLabel: undefined as string | undefined,
    mediaNotice: undefined as "requiresHttps" | "unavailable" | "stopped" | "muted" | "clickToAllow" | "permissionDenied" | undefined,
    answerCall: vi.fn(),
    declineCall: vi.fn(),
    keypad: [{ value: "1", letters: "" }],
    pressDigit: vi.fn(),
    canCall: false,
    makeCall: vi.fn(),
    retryConnection: vi.fn(),
    held: false,
    toggleHold: vi.fn(),
    hangupCall: vi.fn(),
    muted: false,
    micVolume: 70,
    micLevel: 0,
    toggleMute: vi.fn(),
    setMicVolumeLevel: vi.fn(),
    speakerMuted: false,
    speakerVolume: 60,
    speakerLevel: 0,
    toggleSpeakerMute: vi.fn(),
    setSpeakerVolumeLevel: vi.fn(),
    autoAnswer: false,
    setAutoAnswer: vi.fn(),
    doNotDisturb: false,
    setDoNotDisturb: vi.fn(),
    logsLoading: false,
    callLogs: [] as unknown[],
    dismissIncomingPopup: vi.fn(),
  },
}));

vi.mock("./hooks/useWebRTCPhone", async () => {
  const actual = await vi.importActual<typeof import("./hooks/useWebRTCPhone")>("./hooks/useWebRTCPhone");
  return {
    formatWebphoneLogTime: actual.formatWebphoneLogTime,
    useWebRTCPhone: () => [phoneMock, { current: null }] as const,
  };
});

import { WebRTCPhoneWidget } from "./WebRTCPhoneWidget";

describe("WebRTCPhoneWidget", () => {
  beforeEach(() => {
    langMock.lang = "en";
    Object.assign(phoneMock, {
      shouldRender: true,
      expanded: false,
      connectionState: "ready" as WebphoneConnectionState,
      callBusy: false,
      status: { code: "ready" } as WebphoneStatus,
      mediaNotice: undefined,
    });
    phoneMock.retryConnection.mockReset();
  });

  it("renders nothing when the phone should not render", () => {
    phoneMock.shouldRender = false;
    const { container } = render(<WebRTCPhoneWidget />);
    expect(container).toBeEmptyDOMElement();
  });

  it("gives the connection dot an accessible status label matching the current language", () => {
    phoneMock.connectionState = "registered";
    render(<WebRTCPhoneWidget />);
    expect(screen.getByRole("status")).toHaveTextContent("Registered");
  });

  it("localizes the connection status label into Arabic", () => {
    langMock.lang = "ar";
    phoneMock.connectionState = "connecting";
    render(<WebRTCPhoneWidget />);
    expect(screen.getByRole("status")).toHaveTextContent("جارٍ الاتصال");
  });

  it("shows a retry control only once the connection has errored, and wires it to retryConnection", () => {
    phoneMock.expanded = true;
    phoneMock.connectionState = "ready";
    const { rerender } = render(<WebRTCPhoneWidget />);
    expect(screen.queryByLabelText("Retry connection")).not.toBeInTheDocument();

    phoneMock.connectionState = "error";
    rerender(<WebRTCPhoneWidget />);
    const retryButton = screen.getByLabelText("Retry connection");
    fireEvent.click(retryButton);
    expect(phoneMock.retryConnection).toHaveBeenCalledTimes(1);
  });

  it("shows the localized call status instead of a raw status code while a call is in progress", () => {
    phoneMock.expanded = true;
    phoneMock.callBusy = true;
    phoneMock.status = { code: "ringing" };
    render(<WebRTCPhoneWidget />);
    expect(screen.getByText("Ringing")).toBeInTheDocument();
  });

  it("appends the raw SIP detail alongside the localized status label", () => {
    phoneMock.expanded = true;
    phoneMock.callBusy = true;
    phoneMock.status = { code: "callFailed", detail: "Timeout" };
    render(<WebRTCPhoneWidget />);
    expect(screen.getByText("Call failed (Timeout)")).toBeInTheDocument();
  });
});
