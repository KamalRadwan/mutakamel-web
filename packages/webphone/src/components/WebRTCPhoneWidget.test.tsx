// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WebphoneProvider } from "../context/WebphoneContext";
import { webphoneCopy, type WebphoneLanguage } from "../copy";
import type { WebphoneHttpClient } from "../http";
import type { WebphoneConnectionState, WebphoneStatus } from "../types";

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

vi.mock("../hooks/useWebRTCPhone", async () => {
  const actual = await vi.importActual<typeof import("../hooks/useWebRTCPhone")>("../hooks/useWebRTCPhone");
  return {
    formatWebphoneLogTime: actual.formatWebphoneLogTime,
    useWebRTCPhone: () => [phoneMock, { current: null }] as const,
  };
});

import { WebRTCPhoneWidget } from "./WebRTCPhoneWidget";

const httpStub = { get: vi.fn(), post: vi.fn() } as unknown as WebphoneHttpClient;

function widget(lang: WebphoneLanguage = "en") {
  return (
    <WebphoneProvider
      basePath="/api/admin/webphone/v1"
      http={httpStub}
      active
      copy={webphoneCopy[lang]}
    >
      <WebRTCPhoneWidget />
    </WebphoneProvider>
  );
}

describe("WebRTCPhoneWidget", () => {
  beforeEach(() => {
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
    const { container } = render(widget());
    expect(container).toBeEmptyDOMElement();
  });

  it("gives the connection dot an accessible status label from the injected copy", () => {
    phoneMock.connectionState = "registered";
    render(widget());
    expect(screen.getByRole("status")).toHaveTextContent("Registered");
  });

  it("localizes the connection status label into Arabic", () => {
    phoneMock.connectionState = "connecting";
    render(widget("ar"));
    expect(screen.getByRole("status")).toHaveTextContent("جارٍ الاتصال");
  });

  it("shows a retry control only once the connection has errored, and wires it to retryConnection", () => {
    phoneMock.expanded = true;
    phoneMock.connectionState = "ready";
    const { rerender } = render(widget());
    expect(screen.queryByLabelText("Retry connection")).not.toBeInTheDocument();

    phoneMock.connectionState = "error";
    rerender(widget());
    const retryButton = screen.getByLabelText("Retry connection");
    fireEvent.click(retryButton);
    expect(phoneMock.retryConnection).toHaveBeenCalledTimes(1);
  });

  it("shows the localized call status instead of a raw status code while a call is in progress", () => {
    phoneMock.expanded = true;
    phoneMock.callBusy = true;
    phoneMock.status = { code: "ringing" };
    render(widget());
    expect(screen.getByText("Ringing")).toBeInTheDocument();
  });

  it("appends the raw SIP detail alongside the localized status label", () => {
    phoneMock.expanded = true;
    phoneMock.callBusy = true;
    phoneMock.status = { code: "callFailed", detail: "Timeout" };
    render(widget());
    expect(screen.getByText("Call failed (Timeout)")).toBeInTheDocument();
  });
});
