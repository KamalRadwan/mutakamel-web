// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WebphoneProvider } from "../context/WebphoneContext";
import { webphoneCopy, type WebphoneLanguage } from "../copy";
import type { WebphoneHttpClient } from "../http";
import type { WebphoneSharedSnapshot, WebphoneTabRole } from "../tabs/leader";
import type {
  WebphoneConnectionState,
  WebphoneMediaNoticeCode,
  WebphoneStatus,
} from "../types";

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
    activeServerName: "Primary",
    activeServerIndex: 0,
    serverCount: 1,
    registrationAttempt: 1,
    activeTab: "phone" as "phone" | "log",
    setActiveTab: vi.fn(),
    callBusy: false,
    displayNumber: "",
    setDialTarget: vi.fn(),
    dialTarget: "",
    deleteLastDigit: vi.fn(),
    copyNumber: vi.fn(),
    incomingCallWaiting: false,
    // This tab owns the registration in every existing test. A mock without it
    // renders the follower pane instead of the phone, which is the correct
    // behaviour and a very confusing test failure.
    tabRole: 'leader' as WebphoneTabRole,
    isLeader: true,
    leaderSnapshot: null as WebphoneSharedSnapshot | null,
    requestLeaderFocus: vi.fn(),
    callQuality: null as { lossPct: number; jitterBufferMs: number; rttMs: number } | null,
    callActive: false,
    status: { code: "ready" } as WebphoneStatus,
    timerLabel: undefined as string | undefined,
    // Typed off the real union rather than a copy of it: an inline list
    // silently keeps compiling when a new notice code is added, which is
    // how `noMicrophone` could have shipped with no test able to name it.
    mediaNotice: undefined as WebphoneMediaNoticeCode | undefined,
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
      // Reset with everything else, or a test that steps down to follower
      // leaves every test after it rendering the wrong pane -- an order
      // dependency that surfaces as an unrelated failure somewhere else.
      tabRole: "leader" as WebphoneTabRole,
      isLeader: true,
      leaderSnapshot: null,
      callQuality: null,
      callActive: false,
      timerLabel: undefined,
      activeTab: "phone" as const,
      activeServerName: "Primary",
      activeServerIndex: 0,
      serverCount: 1,
      registrationAttempt: 1,
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

  it("says which server of how many the phone has worked its way to", () => {
    // A phone cycling through dead servers renders the same header as an idle
    // one — same dot, same name — unless the position in the list is on screen.
    phoneMock.expanded = true;
    phoneMock.activeServerName = "Backup DC";
    phoneMock.activeServerIndex = 2;
    phoneMock.serverCount = 3;
    render(widget());

    expect(screen.getByText("3/3")).toBeInTheDocument();
    expect(screen.getByLabelText("SIP server 3/3 · Backup DC")).toBeInTheDocument();
  });

  it("shows the position in the collapsed tab too, where the dock usually sits", () => {
    phoneMock.expanded = false;
    phoneMock.activeServerIndex = 1;
    phoneMock.serverCount = 2;
    render(widget());

    expect(screen.getByText("2/2")).toBeInTheDocument();
  });

  it("counts repeated attempts against a single server, which has no position to show", () => {
    phoneMock.expanded = true;
    phoneMock.serverCount = 1;
    phoneMock.registrationAttempt = 3;
    render(widget());

    expect(screen.getByText("×3")).toBeInTheDocument();
    expect(screen.getByLabelText("SIP server 1/1 · Primary · Attempt 3")).toBeInTheDocument();
  });

  it("keeps the badge out of the header when there is nothing to report", () => {
    phoneMock.expanded = true;
    phoneMock.serverCount = 1;
    phoneMock.registrationAttempt = 1;
    render(widget());

    expect(screen.queryByText("1/1")).not.toBeInTheDocument();
  });
  // A machine with no capture device fails every call inside getUserMedia,
  // before JsSIP builds an INVITE. That error name matched neither of the two
  // cases the classifier knew, so it fell through to the generic branch and
  // the only thing on screen was the browser's own English string. These pin
  // the notice that replaced it, in both languages, because a phone that says
  // nothing useful about why it will not dial is the actual defect.
  it("names a missing microphone rather than leaving the failure unexplained", () => {
    phoneMock.expanded = true;
    phoneMock.callBusy = true;
    phoneMock.mediaNotice = "noMicrophone";
    render(widget());

    expect(screen.getByText("No microphone found on this device")).toBeInTheDocument();
  });

  it("localizes the missing-microphone notice into Arabic", () => {
    phoneMock.expanded = true;
    phoneMock.callBusy = true;
    phoneMock.mediaNotice = "noMicrophone";
    render(widget("ar"));

    expect(screen.getByText("لا يوجد ميكروفون متصل بهذا الجهاز")).toBeInTheDocument();
  });
  // Every tab renders the same phone now: the hook hands a follower the
  // leader's state and turns its buttons into messages, so the widget cannot
  // tell the difference. What used to be a "the phone is elsewhere" pane would
  // today be a tab refusing to do something it is perfectly able to ask for.
  it('renders a working phone even when another tab owns the registration', () => {
    phoneMock.expanded = true;
    phoneMock.isLeader = false;
    phoneMock.tabRole = 'follower';
    render(widget());

    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter number...')).toBeInTheDocument();
  });

  it('shows the call the owning tab is on, on every tab', () => {
    phoneMock.expanded = true;
    phoneMock.isLeader = false;
    phoneMock.tabRole = 'follower';
    phoneMock.callBusy = true;
    phoneMock.callActive = true;
    phoneMock.callPeerName = 'Test caller';
    phoneMock.callPeerNumber = '+20 100 123 4567';
    render(widget());

    expect(screen.getByText(/Test caller/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hang up' })).toBeInTheDocument();
  });

  // Hover is not available on a touch screen, and colour alone fails anyone who
  // cannot distinguish it. The indicator therefore has to be reachable by
  // keyboard and readable as text, not just as a shade of green.
  it('opens the quality detail on keyboard focus, not only on hover', () => {
    phoneMock.expanded = true;
    phoneMock.callBusy = true;
    phoneMock.callActive = true;
    render(widget());

    const indicator = screen.getByRole('button', { name: /Call quality/ });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.focus(indicator);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.blur(indicator);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('names the state in text so the colour is never the only signal', () => {
    phoneMock.expanded = true;
    phoneMock.callBusy = true;
    phoneMock.callActive = true;
    phoneMock.callQuality = { lossPct: 2.4, jitterBufferMs: 35, rttMs: 80 };
    render(widget());

    expect(
      screen.getByRole('button', { name: 'Call quality: Packet loss: 2.4%' }),
    ).toBeInTheDocument();
  });

  // The opening seconds are noisy for reasons unrelated to the network, so the
  // indicator says it is not measuring instead of publishing a number it would
  // have to retract.
  it('says it is still measuring rather than reporting a number it does not have', () => {
    phoneMock.expanded = true;
    phoneMock.callBusy = true;
    phoneMock.callActive = true;
    phoneMock.callQuality = null;
    render(widget());

    expect(screen.getByRole('button', { name: 'Call quality: Measuring…' })).toBeInTheDocument();
  });

  it('shows the estimated MOS as estimated, not as a measurement', () => {
    phoneMock.expanded = true;
    phoneMock.callBusy = true;
    phoneMock.callActive = true;
    phoneMock.callQuality = { lossPct: 1, jitterBufferMs: 30, rttMs: 60 };
    render(widget());

    fireEvent.focus(screen.getByRole('button', { name: /Call quality/ }));

    expect(screen.getByText('MOS (estimated)')).toBeInTheDocument();
    expect(screen.getByText(/not measured directly/)).toBeInTheDocument();
  });

  // A stopped clock beside a live status reads as a running one. `timerLabel`
  // also carries the previous call's duration, so it is gated on the call.
  it('shows no timer once the call is over', () => {
    phoneMock.expanded = true;
    phoneMock.callBusy = true;
    phoneMock.callActive = false;
    phoneMock.timerLabel = '00:01:12';
    render(widget());

    expect(screen.queryByText('00:01:12')).not.toBeInTheDocument();
  });
  // The complaint that produced this: a header saying the extension was not
  // registered above a line saying "ready". Two state machines rendered side by
  // side will always be able to disagree, so outside a call there is now only
  // one of them.
  it('does not report a state the header contradicts', () => {
    phoneMock.expanded = true;
    phoneMock.callBusy = false;
    phoneMock.connectionState = 'error';
    phoneMock.status = { code: 'ready' } as WebphoneStatus;
    render(widget());

    // "Ready" belongs to the call machine and must not appear while the
    // connection machine is reporting a failure.
    expect(screen.queryByText('Ready')).not.toBeInTheDocument();
    expect(screen.getAllByText('Error').length).toBeGreaterThan(0);
  });

  it('keeps the dot red until a registration actually exists', () => {
    phoneMock.expanded = true;
    phoneMock.connectionState = 'idle';
    render(widget());

    const dot = screen.getByRole('button', { name: /Call quality/ });
    expect(dot).toHaveStyle({ backgroundColor: 'hsl(0 85% 45%)' });
  });

  it('turns green once registered', () => {
    phoneMock.expanded = true;
    phoneMock.connectionState = 'registered';
    render(widget());

    expect(screen.getByRole('button', { name: /Call quality/ })).toHaveStyle({
      backgroundColor: 'hsl(120 78% 40%)',
    });
  });
  // Every tab rings visually; one tab rings audibly. The popup is what a person
  // reacts to, so hiding it on the tab they happen to be looking at makes the
  // call unanswerable from there — but four tabs playing the same ringtone at
  // once is its own kind of broken.
  it('shows the incoming popup on a tab that does not hold the call', () => {
    phoneMock.expanded = true;
    phoneMock.isLeader = false;
    phoneMock.tabRole = 'follower';
    phoneMock.showIncomingPopup = true;
    phoneMock.callPeerNumber = '+20 100 123 4567';
    phoneMock.callPeerName = 'Test caller';
    render(widget());

    expect(screen.getByRole('button', { name: 'Answer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument();
  });

  it('sends answer to the tab that owns the call rather than acting locally', () => {
    phoneMock.expanded = true;
    phoneMock.isLeader = false;
    phoneMock.tabRole = 'follower';
    phoneMock.showIncomingPopup = true;
    render(widget());

    fireEvent.click(screen.getByRole('button', { name: 'Answer' }));

    // The hook routes this to a command when the tab is a follower; the widget
    // calls the same function either way and cannot tell the difference.
    expect(phoneMock.answerCall).toHaveBeenCalledTimes(1);
  });
  // The number of a finished call sitting in the dial box is one press away
  // from redialling somebody by accident, because the call button is live
  // again the moment the line frees up.
  it('empties the dial box once the call is over', () => {
    phoneMock.expanded = true;
    phoneMock.callBusy = false;
    phoneMock.displayNumber = '';
    render(widget());

    expect(screen.getByPlaceholderText('Enter number...')).toHaveValue('');
  });

  it('shows the far end while the call is up, and only then', () => {
    phoneMock.expanded = true;
    phoneMock.callBusy = true;
    phoneMock.callActive = true;
    phoneMock.displayNumber = '+20 100 123 4567';
    render(widget());

    const field = screen.getByRole('textbox');
    expect(field).toHaveValue('+20 100 123 4567');
    // Read-only rather than disabled: the number is there to be read and
    // copied, and a disabled field is skipped by the keyboard.
    expect(field).toHaveAttribute('readonly');
  });
});
