"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Copy,
  Delete,
  History,
  Mic,
  MicOff,
  Pause,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOff,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  Button,
  Input,
  Range,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  cn,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatWebphoneLogTime, useWebRTCPhone } from "./hooks/useWebRTCPhone";
import { IncomingCallPopup } from "./IncomingCallPopup";
import type {
  WebphoneCallLogType,
  WebphoneCallState,
  WebphoneConnectionState,
  WebphoneTab,
} from "@mutakamel/webphone";

const copy = {
  ar: {
    webRtcPhone: "هاتف WebRTC",
    phoneSections: "أقسام الهاتف",
    phone: "الهاتف",
    calls: "السجل",
    registered: "مسجل",
    connecting: "جارٍ الاتصال",
    error: "خطأ",
    offline: "غير متصل",
    ready: "جاهز",
    dialNumber: "رقم الهاتف",
    enterNumber: "أدخل الرقم",
    dialDigit: "طلب الرقم",
    copyNumber: "نسخ الرقم",
    deleteDigit: "حذف آخر رقم",
    incoming: "مكالمة واردة",
    calling: "جارٍ طلب المكالمة",
    connected: "متصل",
    callEnded: "انتهت المكالمة",
    callFailed: "تعذر الاتصال",
    answer: "رد",
    decline: "رفض",
    call: "اتصال",
    hangup: "إنهاء",
    hold: "تعليق",
    resume: "استئناف",
    mic: "الميكروفون",
    speaker: "السماعة",
    micVolume: "مستوى صوت الميكروفون",
    speakerVolume: "مستوى صوت السماعة",
    muteMic: "كتم الميكروفون",
    unmuteMic: "تشغيل الميكروفون",
    muteSpeaker: "كتم السماعة",
    unmuteSpeaker: "تشغيل السماعة",
    autoAnswer: "رد تلقائي",
    dnd: "عدم الإزعاج",
    loading: "جارٍ تحميل سجل المكالمات",
    noCalls: "لا توجد مكالمات مسجلة",
    unknown: "غير معروف",
    outgoingCall: "مكالمة صادرة",
    answeredIncomingCall: "مكالمة واردة مجابة",
    missedIncomingCall: "مكالمة واردة فائتة",
    showPhone: "فتح هاتف WebRTC",
    foldPhone: "تصغير هاتف WebRTC",
  },
  en: {
    webRtcPhone: "WebRTC phone",
    phoneSections: "Phone sections",
    phone: "Phone",
    calls: "Call log",
    registered: "Registered",
    connecting: "Connecting",
    error: "Error",
    offline: "Offline",
    ready: "Ready",
    dialNumber: "Phone number",
    enterNumber: "Enter number",
    dialDigit: "Dial digit",
    copyNumber: "Copy number",
    deleteDigit: "Delete last digit",
    incoming: "Incoming call",
    calling: "Calling",
    connected: "Connected",
    callEnded: "Call ended",
    callFailed: "Call failed",
    answer: "Answer",
    decline: "Decline",
    call: "Call",
    hangup: "Hang up",
    hold: "Hold",
    resume: "Resume",
    mic: "Microphone",
    speaker: "Speaker",
    micVolume: "Microphone volume",
    speakerVolume: "Speaker volume",
    muteMic: "Mute microphone",
    unmuteMic: "Unmute microphone",
    muteSpeaker: "Mute speaker",
    unmuteSpeaker: "Unmute speaker",
    autoAnswer: "Auto answer",
    dnd: "Do not disturb",
    loading: "Loading call history",
    noCalls: "No calls recorded",
    unknown: "Unknown",
    outgoingCall: "Outgoing call",
    answeredIncomingCall: "Answered incoming call",
    missedIncomingCall: "Missed incoming call",
    showPhone: "Open WebRTC phone",
    foldPhone: "Collapse WebRTC phone",
  },
} as const;

type PhoneCopy = (typeof copy)[keyof typeof copy];

export function WebRTCPhoneWidget() {
  const { lang, dir } = useI18n();
  const labels = copy[lang];
  const [phone, remoteAudioRef] = useWebRTCPhone();
  const dockRef = useRef<HTMLDivElement>(null);
  const widgetFocusFallbackRef = useRef<HTMLButtonElement>(null);
  const focusDockControlAfterToggleRef = useRef(false);
  const phoneExpanded = phone.expanded;
  const setPhoneExpanded = phone.setExpanded;

  const togglePhoneFromDockControl = (expanded: boolean) => {
    focusDockControlAfterToggleRef.current = true;
    setPhoneExpanded(expanded);
  };

  useEffect(() => {
    if (!focusDockControlAfterToggleRef.current) return;
    focusDockControlAfterToggleRef.current = false;
    widgetFocusFallbackRef.current?.focus({ preventScroll: true });
  }, [phoneExpanded]);

  useEffect(() => {
    if (!phoneExpanded) return;

    const collapseBeforePageFocusIsObscured = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (dockRef.current?.contains(target) || target.closest('[role="alertdialog"]')) return;
      setPhoneExpanded(false);
    };

    document.addEventListener("focusin", collapseBeforePageFocusIsObscured, true);
    return () => document.removeEventListener("focusin", collapseBeforePageFocusIsObscured, true);
  }, [phoneExpanded, setPhoneExpanded]);

  if (!phone.shouldRender) return null;

  const connectionLabel = localizedConnectionLabel(phone.connectionState, labels);

  return (
    <>
      <IncomingCallPopup
        open={phone.showIncomingPopup}
        phoneNumber={phone.callPeerNumber || labels.unknown}
        displayName={phone.callPeerName !== phone.callPeerNumber ? phone.callPeerName : undefined}
        lang={lang}
        onAnswer={phone.answerCall}
        onDecline={phone.declineCall}
        onClose={phone.dismissIncomingPopup}
        fallbackFocusRef={widgetFocusFallbackRef}
      />

      <div
        ref={dockRef}
        className="fixed z-40 select-none"
        dir={dir}
        style={{
          insetBlockEnd: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
          insetInlineEnd:
            dir === "rtl"
              ? "max(0.75rem, env(safe-area-inset-left, 0px))"
              : "max(0.75rem, env(safe-area-inset-right, 0px))",
        }}
      >
        <audio ref={remoteAudioRef} autoPlay playsInline />

        {!phone.expanded ? (
          <Button
            ref={widgetFocusFallbackRef}
            type="button"
            variant="outline"
            size="xs"
            className="min-h-(--size-control-md) max-w-[min(17.5rem,calc(100vw-1.5rem))] justify-start gap-2 whitespace-normal rounded-lg px-3 py-1.5 text-start text-card-foreground shadow-pop"
            aria-label={`${labels.showPhone}: ${connectionLabel}`}
            onClick={() => togglePhoneFromDockControl(true)}
          >
            <ConnectionDot state={phone.connectionState} />
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-xs font-semibold">{phone.phoneDisplayName}</strong>
              <span className="block truncate text-xs text-muted-foreground">{connectionLabel}</span>
            </span>
            <ChevronUp className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </Button>
        ) : (
          <section
            className="flex w-[min(19rem,calc(100vw-1.5rem))] max-w-full flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-pop"
            aria-label={labels.webRtcPhone}
          >
            <header className="flex min-h-(--size-control-xl) items-center gap-2 border-b border-border bg-info-subtle px-3 py-1.5 text-info-subtle-foreground">
              <ConnectionDot state={phone.connectionState} />
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-xs font-semibold">{phone.phoneDisplayName}</strong>
                <span className="block truncate text-xs">{connectionLabel}</span>
              </span>
              <Button
                ref={widgetFocusFallbackRef}
                type="button"
                variant="ghost"
                size="md"
                className="size-8 shrink-0 p-0 text-info-subtle-foreground hover:bg-info/10"
                aria-label={labels.foldPhone}
                onClick={() => togglePhoneFromDockControl(false)}
              >
                <ChevronDown className="size-4" aria-hidden="true" />
              </Button>
            </header>

            <Tabs
              value={phone.activeTab}
              onValueChange={(value) => phone.setActiveTab(value as WebphoneTab)}
              dir={dir}
              activationMode="automatic"
              className="flex min-h-0 flex-1 flex-col"
            >
              <TabsList
                className="grid w-full grid-cols-2 bg-muted px-1"
                aria-label={labels.phoneSections}
              >
                <TabsTrigger value="phone" className="justify-center gap-1.5 px-2">
                  <Phone className="size-4" aria-hidden="true" />
                  {labels.phone}
                </TabsTrigger>
                <TabsTrigger value="log" className="justify-center gap-1.5 px-2">
                  <History className="size-4" aria-hidden="true" />
                  {labels.calls}
                </TabsTrigger>
              </TabsList>

              <div className="h-[min(24.5rem,58svh)] min-h-0 overflow-hidden sm:h-[24.5rem]">
                <TabsContent value="phone" className="mt-0 h-full overflow-y-auto p-2">
                  {!phone.callBusy ? (
                    <div>
                      <label
                        htmlFor="webphone-dial-number"
                        className="mb-1 block text-xs font-medium text-foreground"
                      >
                        {labels.dialNumber}
                      </label>
                      <div className="flex min-h-(--size-control-lg) items-center rounded-lg border border-input bg-card px-1">
                        <Input
                          id="webphone-dial-number"
                          type="text"
                          inputMode="tel"
                          autoComplete="off"
                          value={phone.displayNumber}
                          onChange={(event) => phone.setDialTarget(event.currentTarget.value)}
                          placeholder={labels.enterNumber}
                          className="min-w-0 flex-1 rounded-lg border-0 bg-transparent px-2 font-mono text-base font-semibold text-foreground placeholder:text-xs placeholder:text-muted-foreground sm:text-sm"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="lg"
                          className="size-9 p-0 text-muted-foreground hover:text-foreground disabled:opacity-30"
                          aria-label={labels.deleteDigit}
                          disabled={!phone.dialTarget}
                          onClick={phone.deleteLastDigit}
                        >
                          <Delete className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="lg"
                          className="size-9 p-0 text-muted-foreground hover:text-info disabled:opacity-30"
                          aria-label={labels.copyNumber}
                          disabled={!phone.displayNumber.trim()}
                          onClick={phone.copyNumber}
                        >
                          <Copy className="size-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="grid min-h-24 content-center gap-1 rounded-lg border border-info/30 bg-info-subtle p-3 text-center"
                      aria-live="polite"
                    >
                      <span className="flex items-center justify-center gap-2 text-xs font-semibold text-info-subtle-foreground">
                        {phone.incomingCallWaiting ? (
                          <PhoneIncoming className="size-4" aria-hidden="true" />
                        ) : (
                          <PhoneCall className="size-4" aria-hidden="true" />
                        )}
                        {localizedCallState(phone.callState, labels, phone.status)}
                      </span>
                      <strong className="truncate text-sm text-foreground">
                        {phone.callPeerName || labels.unknown}
                      </strong>
                      <span className="flex items-center justify-center gap-2 font-mono text-xs text-muted-foreground">
                        <bdi dir="ltr">{phone.callPeerNumber}</bdi>
                        {phone.timerLabel ? (
                          <time className="font-semibold text-info">{phone.timerLabel}</time>
                        ) : null}
                      </span>
                      {phone.mediaNotice ? (
                        <small className="text-xs font-semibold text-destructive-subtle-foreground">
                          {phone.mediaNotice}
                        </small>
                      ) : null}
                    </div>
                  )}

                  {phone.incomingCallWaiting ? (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <ActionButton
                        tone="primary"
                        icon={<PhoneIncoming className="size-4" aria-hidden="true" />}
                        label={labels.answer}
                        onClick={phone.answerCall}
                      />
                      <ActionButton
                        tone="danger"
                        icon={<PhoneOff className="size-4" aria-hidden="true" />}
                        label={labels.decline}
                        onClick={phone.declineCall}
                      />
                    </div>
                  ) : null}

                  <div className="mt-2 grid grid-cols-3 gap-1">
                    {phone.keypad.map((key) => (
                      <Button
                        key={key.value}
                        type="button"
                        variant="outline"
                        size="lg"
                        className="h-auto min-h-(--size-control-lg) flex-col gap-0 rounded-lg bg-muted px-2 py-1 text-foreground hover:border-primary/40"
                        aria-label={`${labels.dialDigit} ${key.value}${key.letters ? `, ${key.letters}` : ""}`}
                        onClick={() => phone.pressDigit(key.value)}
                      >
                        <strong className="font-mono text-sm leading-none">{key.value}</strong>
                        <small className="mt-1 min-h-2 font-mono text-xs leading-none text-muted-foreground">
                          {key.letters}
                        </small>
                      </Button>
                    ))}
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {!phone.callBusy ? (
                      <ActionButton
                        className="col-span-2"
                        tone="primary"
                        icon={<PhoneCall className="size-4" aria-hidden="true" />}
                        label={labels.call}
                        disabled={!phone.canCall}
                        onClick={() => void phone.makeCall()}
                      />
                    ) : null}
                    {phone.callActive ? (
                      <>
                        <ActionButton
                          tone={phone.held ? "warning" : "neutral"}
                          icon={<Pause className="size-4" aria-hidden="true" />}
                          label={phone.held ? labels.resume : labels.hold}
                          onClick={phone.toggleHold}
                        />
                        <ActionButton
                          tone="danger"
                          icon={<PhoneOff className="size-4" aria-hidden="true" />}
                          label={labels.hangup}
                          onClick={phone.hangupCall}
                        />
                      </>
                    ) : null}
                    {phone.callBusy && !phone.callActive && !phone.incomingCallWaiting ? (
                      <ActionButton
                        className="col-span-2"
                        tone="danger"
                        icon={<PhoneOff className="size-4" aria-hidden="true" />}
                        label={labels.hangup}
                        onClick={phone.hangupCall}
                      />
                    ) : null}
                  </div>

                  <div className="mt-2 grid gap-1.5 border-t border-border pt-2">
                    <AudioControl
                      label={labels.mic}
                      sliderLabel={labels.micVolume}
                      value={phone.micVolume}
                      level={phone.micLevel}
                      muted={phone.muted}
                      icon={
                        phone.muted ? (
                          <MicOff className="size-4" aria-hidden="true" />
                        ) : (
                          <Mic className="size-4" aria-hidden="true" />
                        )
                      }
                      toggleLabel={phone.muted ? labels.unmuteMic : labels.muteMic}
                      onToggle={phone.toggleMute}
                      onChange={phone.setMicVolumeLevel}
                    />
                    <AudioControl
                      label={labels.speaker}
                      sliderLabel={labels.speakerVolume}
                      value={phone.speakerVolume}
                      level={phone.speakerLevel}
                      muted={phone.speakerMuted}
                      icon={
                        phone.speakerMuted ? (
                          <VolumeX className="size-4" aria-hidden="true" />
                        ) : (
                          <Volume2 className="size-4" aria-hidden="true" />
                        )
                      }
                      toggleLabel={phone.speakerMuted ? labels.unmuteSpeaker : labels.muteSpeaker}
                      onToggle={phone.toggleSpeakerMute}
                      onChange={phone.setSpeakerVolumeLevel}
                    />
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <ModeButton
                      active={phone.autoAnswer}
                      label={labels.autoAnswer}
                      shortLabel="AA"
                      tone="info"
                      onClick={() => phone.setAutoAnswer(!phone.autoAnswer)}
                    />
                    <ModeButton
                      active={phone.doNotDisturb}
                      label={labels.dnd}
                      shortLabel="DND"
                      tone="warning"
                      onClick={() => phone.setDoNotDisturb(!phone.doNotDisturb)}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="log" className="mt-0 h-full overflow-y-auto p-2">
                  {phone.logsLoading ? <EmptyLog label={labels.loading} /> : null}
                  {!phone.logsLoading && phone.callLogs.length === 0 ? (
                    <EmptyLog label={labels.noCalls} />
                  ) : null}
                  {!phone.logsLoading && phone.callLogs.length > 0 ? (
                    <div className="grid gap-2">
                      {phone.callLogs.map((log, index) => {
                        const typeLabel = callLogLabel(log.type, labels);
                        const timestamp = log.createdAt ?? log.startedAt;

                        return (
                          <article
                            key={log.id ?? `${log.type}-${log.phoneNumber}-${index}`}
                            className="grid min-h-10 grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-border bg-muted p-1.5"
                          >
                            <span
                              className={cn(
                                "grid size-7 place-items-center rounded-lg",
                                callLogTone(log.type),
                              )}
                              title={typeLabel}
                              aria-label={typeLabel}
                            >
                              {log.type === "OUT" ? (
                                <ArrowUp className="size-4" aria-hidden="true" />
                              ) : (
                                <ArrowDown className="size-4" aria-hidden="true" />
                              )}
                            </span>
                            <span className="min-w-0">
                              <strong className="block truncate text-xs text-foreground">
                                {log.displayName || labels.unknown}
                              </strong>
                              <small className="block truncate text-xs text-muted-foreground">
                                {typeLabel} · <bdi dir="ltr" className="font-mono">{log.phoneNumber}</bdi>
                              </small>
                            </span>
                            <time dateTime={timestamp ?? undefined} className="font-mono text-xs text-muted-foreground">
                              {formatWebphoneLogTime(timestamp, lang === "ar" ? "ar-EG" : "en-US")}
                            </time>
                          </article>
                        );
                      })}
                    </div>
                  ) : null}
                </TabsContent>
              </div>
            </Tabs>
          </section>
        )}
      </div>
    </>
  );
}

function ConnectionDot({ state }: { state: WebphoneConnectionState }) {
  const tone =
    state === "registered"
      ? "bg-success"
      : state === "ready"
        ? "bg-info"
        : state === "connecting" || state === "loading"
          ? "bg-warning"
          : state === "error" || state === "offline"
            ? "bg-destructive"
            : "bg-muted-foreground";

  return (
    <span className="relative flex size-2.5 shrink-0" aria-hidden="true">
      {state === "registered" ? (
        <span
          className={cn(
            "absolute inline-flex size-full animate-ping rounded-full opacity-50 motion-reduce:animate-none",
            tone,
          )}
        />
      ) : null}
      <span className={cn("relative inline-flex size-2.5 rounded-full", tone)} />
    </span>
  );
}

function ActionButton({
  tone,
  icon,
  label,
  onClick,
  disabled,
  className,
}: {
  tone: "primary" | "danger" | "warning" | "neutral";
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const variant = tone === "primary" ? "primary" : tone === "danger" ? "destructive" : "secondary";
  const toneClass = tone === "warning" ? "bg-warning text-warning-foreground hover:bg-warning/90" : undefined;

  return (
    <Button
      type="button"
      variant={variant}
      size="lg"
      className={cn(
        "min-h-(--size-control-lg) rounded-lg px-3 text-xs disabled:opacity-40",
        toneClass,
        className,
      )}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
      {label}
    </Button>
  );
}

function AudioControl({
  label,
  sliderLabel,
  value,
  level,
  muted,
  icon,
  toggleLabel,
  onToggle,
  onChange,
}: {
  label: string;
  sliderLabel: string;
  value: number;
  level: number;
  muted: boolean;
  icon: ReactNode;
  toggleLabel: string;
  onToggle: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid min-h-8 grid-cols-[auto_4rem_minmax(0,1fr)_2.25rem] items-center gap-1.5">
      <Button
        type="button"
        variant="ghost"
        size="md"
        className={cn(
          "size-8 p-0",
          muted
            ? "bg-destructive-subtle text-destructive-subtle-foreground"
            : "bg-info-subtle text-info-subtle-foreground",
        )}
        aria-label={toggleLabel}
        onClick={onToggle}
      >
        {icon}
      </Button>
      <span className="truncate text-xs font-semibold text-muted-foreground">{label}</span>
      <span className="relative grid min-h-6 items-center rounded-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
        <span className="pointer-events-none absolute inset-x-0 h-1 rounded-full bg-muted" aria-hidden="true" />
        <span
          className="pointer-events-none absolute start-0 h-1 rounded-full bg-info/65"
          style={{ inlineSize: `${value}%` }}
          aria-hidden="true"
        />
        <span
          className="pointer-events-none absolute start-0 h-1 rounded-full bg-success motion-reduce:hidden"
          style={{ inlineSize: `${muted ? 0 : level}%` }}
          aria-hidden="true"
        />
        <Range
          min={0}
          max={100}
          step={5}
          value={value}
          disabled={muted}
          aria-label={sliderLabel}
          className="relative z-10 cursor-pointer opacity-0"
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      </span>
      <output className="text-end font-mono text-xs text-muted-foreground">{value}%</output>
    </div>
  );
}

function ModeButton({
  active,
  label,
  shortLabel,
  tone,
  onClick,
}: {
  active: boolean;
  label: string;
  shortLabel: string;
  tone: "info" | "warning";
  onClick: () => void;
}) {
  const activeClass =
    tone === "warning"
      ? "border-warning/40 bg-warning-subtle text-warning-subtle-foreground"
      : "border-info/40 bg-info-subtle text-info-subtle-foreground";

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-pressed={active}
      aria-label={label}
      className={cn(
        "min-h-(--size-control-sm) rounded-lg border px-2 text-xs",
        active ? activeClass : "border-border bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
      onClick={onClick}
    >
      {shortLabel}
      <span className="ms-1.5 font-semibold opacity-80">{label}</span>
    </Button>
  );
}

function EmptyLog({ label }: { label: string }) {
  return (
    <div
      className="grid min-h-52 place-items-center rounded-lg border border-dashed border-border text-center text-xs font-semibold text-muted-foreground"
      role="status"
    >
      <span>
        <History className="mx-auto mb-2 size-5 opacity-60" aria-hidden="true" />
        {label}
      </span>
    </div>
  );
}

function localizedConnectionLabel(state: WebphoneConnectionState, labels: PhoneCopy) {
  if (state === "registered") return labels.registered;
  if (state === "connecting" || state === "loading") return labels.connecting;
  if (state === "error") return labels.error;
  if (state === "offline") return labels.offline;
  return labels.ready;
}

function localizedCallState(state: WebphoneCallState, labels: PhoneCopy, fallback: string) {
  if (state === "incoming") return labels.incoming;
  if (state === "active") return labels.connected;
  if (state === "calling" || state === "ringing") return labels.calling;
  if (state === "ended") return labels.callEnded;
  if (state === "failed") return labels.callFailed;
  return fallback;
}

function callLogLabel(type: WebphoneCallLogType, labels: PhoneCopy) {
  if (type === "OUT") return labels.outgoingCall;
  if (type === "IN_ANS") return labels.answeredIncomingCall;
  return labels.missedIncomingCall;
}

function callLogTone(type: WebphoneCallLogType) {
  if (type === "OUT") return "bg-info-subtle text-info-subtle-foreground";
  if (type === "IN_ANS") return "bg-success-subtle text-success-subtle-foreground";
  return "bg-destructive-subtle text-destructive-subtle-foreground";
}
