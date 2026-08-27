'use client';

import {
  ArrowDownLeft,
  ArrowUpRight,
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
} from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import { formatWebphoneLogTime, useWebRTCPhone } from './hooks/useWebRTCPhone';
import { IncomingCallPopup } from './IncomingCallPopup';
import type { WebphoneCallLogType, WebphoneConnectionState } from '@mutakamel/webphone';

const copy = {
  ar: {
    phone: 'الهاتف',
    calls: 'السجل',
    registered: 'مسجل',
    connecting: 'جارٍ الاتصال',
    error: 'خطأ',
    offline: 'غير متصل',
    ready: 'جاهز',
    enterNumber: 'أدخل الرقم...',
    copyNumber: 'نسخ الرقم',
    deleteDigit: 'حذف آخر رقم',
    incoming: 'مكالمة واردة',
    connected: 'متصل',
    answer: 'رد',
    decline: 'رفض',
    call: 'اتصال',
    hangup: 'إنهاء',
    hold: 'تعليق',
    resume: 'استئناف',
    mic: 'الميكروفون',
    speaker: 'السماعة',
    muteMic: 'كتم الميكروفون',
    unmuteMic: 'تشغيل الميكروفون',
    muteSpeaker: 'كتم السماعة',
    unmuteSpeaker: 'تشغيل السماعة',
    autoAnswer: 'رد تلقائي',
    dnd: 'عدم الإزعاج',
    loading: 'جارٍ تحميل سجل المكالمات',
    noCalls: 'لا توجد مكالمات مسجلة',
    unknown: 'غير معروف',
    showPhone: 'فتح هاتف WebRTC',
    foldPhone: 'تصغير هاتف WebRTC',
  },
  en: {
    phone: 'Phone',
    calls: 'Call log',
    registered: 'Registered',
    connecting: 'Connecting',
    error: 'Error',
    offline: 'Offline',
    ready: 'Ready',
    enterNumber: 'Enter number...',
    copyNumber: 'Copy number',
    deleteDigit: 'Delete last digit',
    incoming: 'Incoming call',
    connected: 'Connected',
    answer: 'Answer',
    decline: 'Decline',
    call: 'Call',
    hangup: 'Hang up',
    hold: 'Hold',
    resume: 'Resume',
    mic: 'Microphone',
    speaker: 'Speaker',
    muteMic: 'Mute microphone',
    unmuteMic: 'Unmute microphone',
    muteSpeaker: 'Mute speaker',
    unmuteSpeaker: 'Unmute speaker',
    autoAnswer: 'Auto answer',
    dnd: 'Do not disturb',
    loading: 'Loading call history',
    noCalls: 'No calls recorded',
    unknown: 'Unknown',
    showPhone: 'Open WebRTC phone',
    foldPhone: 'Collapse WebRTC phone',
  },
} as const;

export function WebRTCPhoneWidget() {
  const { lang } = useI18n();
  const labels = copy[lang];
  const [phone, remoteAudioRef] = useWebRTCPhone();

  if (!phone.shouldRender) return null;

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
      />

      <div className="fixed bottom-0 end-3 z-[70] select-none sm:end-5">
        <audio ref={remoteAudioRef} autoPlay playsInline />

        {!phone.expanded ? (
          <button
            type="button"
            className="flex h-8 items-center gap-2 rounded-t-xl border border-b-0 border-ink-700/80 bg-ink-950 px-3 text-start text-ink-50 shadow-2xl transition-colors hover:bg-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            aria-label={labels.showPhone}
            onClick={() => phone.setExpanded(true)}
          >
            <ConnectionDot state={phone.connectionState} />
            <strong className="truncate text-xs font-semibold">{phone.phoneDisplayName}</strong>
            <ChevronUp className="size-3.5 shrink-0 text-ink-400" aria-hidden="true" />
          </button>
        ) : (
          <section
            className="flex max-h-[calc(100svh-1rem)] w-[min(17.5rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-t-3xl border border-b-0 border-border bg-card shadow-2xl"
            aria-label={lang === 'ar' ? 'هاتف WebRTC' : 'WebRTC phone'}
          >
            <header className="flex h-9 items-center gap-2 border-b border-ink-800 bg-ink-950 px-3 text-ink-50">
              <ConnectionDot state={phone.connectionState} />
              <strong className="min-w-0 flex-1 truncate text-xs font-semibold">{phone.phoneDisplayName}</strong>
              <button
                type="button"
                className="grid size-7 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-50 focus-visible:outline-2 focus-visible:outline-brand-400"
                aria-label={labels.foldPhone}
                onClick={() => phone.setExpanded(false)}
              >
                <ChevronDown className="size-3.5" aria-hidden="true" />
              </button>
            </header>

            <div
              className="grid grid-cols-2 border-b border-border bg-muted p-1"
              role="tablist"
              aria-label={lang === 'ar' ? 'أقسام الهاتف' : 'Phone sections'}
            >
              <TabButton active={phone.activeTab === 'phone'} label={labels.phone} icon={<Phone className="size-3.5" aria-hidden="true" />} onClick={() => phone.setActiveTab('phone')} />
              <TabButton active={phone.activeTab === 'log'} label={labels.calls} icon={<History className="size-3.5" aria-hidden="true" />} onClick={() => phone.setActiveTab('log')} />
            </div>

            <div className="h-[24.5rem] overflow-hidden">
              {phone.activeTab === 'phone' ? (
                <div className="h-full overflow-y-auto p-2">
                  {!phone.callBusy ? (
                    <div className="flex h-9 items-center rounded-xl border border-border bg-muted px-2">
                      <input
                        type="text"
                        inputMode="tel"
                        value={phone.displayNumber}
                        onChange={(event) => phone.setDialTarget(event.currentTarget.value)}
                        placeholder={labels.enterNumber}
                        className="min-w-0 flex-1 bg-transparent px-1 font-mono text-sm font-semibold text-foreground outline-none placeholder:text-xs placeholder:text-muted-foreground"
                      />
                      <button
                        type="button"
                        className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-ink-200 hover:text-foreground disabled:opacity-30 dark:hover:bg-ink-800"
                        aria-label={labels.deleteDigit}
                        disabled={!phone.dialTarget}
                        onClick={phone.deleteLastDigit}
                      >
                        <Delete className="size-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-ink-200 hover:text-brand-600 disabled:opacity-30 dark:hover:bg-ink-800 dark:hover:text-brand-400"
                        aria-label={labels.copyNumber}
                        disabled={!phone.displayNumber.trim()}
                        onClick={phone.copyNumber}
                      >
                        <Copy className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                  ) : (
                    <div
                      className="grid min-h-24 content-center gap-1 rounded-xl border border-brand-500/30 bg-brand-500/5 p-3 text-center dark:bg-brand-500/10"
                      aria-live="polite"
                    >
                      <span className="flex items-center justify-center gap-2 text-xs font-semibold text-brand-700 dark:text-brand-400">
                        {phone.incomingCallWaiting ? <PhoneIncoming className="size-4" aria-hidden="true" /> : <PhoneCall className="size-4" aria-hidden="true" />}
                        {phone.callActive ? labels.connected : phone.status}
                      </span>
                      <strong className="truncate text-sm text-foreground">{phone.callPeerName || labels.unknown}</strong>
                      <span className="flex items-center justify-center gap-2 font-mono text-xs text-muted-foreground">
                        {phone.callPeerNumber}
                        {phone.timerLabel ? <time className="font-semibold text-brand-600 dark:text-brand-400">{phone.timerLabel}</time> : null}
                      </span>
                      {phone.mediaNotice ? <small className="text-xs font-semibold text-danger-600 dark:text-danger-400">{phone.mediaNotice}</small> : null}
                    </div>
                  )}

                  {phone.incomingCallWaiting ? (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <ActionButton tone="success" icon={<PhoneIncoming className="size-4" aria-hidden="true" />} label={labels.answer} onClick={phone.answerCall} />
                      <ActionButton tone="danger" icon={<PhoneOff className="size-4" aria-hidden="true" />} label={labels.decline} onClick={phone.declineCall} />
                    </div>
                  ) : null}

                  <div className="mt-2 grid grid-cols-3 gap-1">
                    {phone.keypad.map((key) => (
                      <button
                        key={key.value}
                        type="button"
                        className="grid min-h-9 place-content-center rounded-xl border border-border bg-muted text-foreground transition-all hover:border-brand-300 hover:bg-brand-500/5 active:scale-95 dark:hover:border-brand-800 dark:hover:bg-brand-500/10"
                        onClick={() => phone.pressDigit(key.value)}
                      >
                        <strong className="font-mono text-sm leading-none">{key.value}</strong>
                        <small className="mt-1 min-h-2 font-mono text-xs leading-none text-muted-foreground">{key.letters}</small>
                      </button>
                    ))}
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {!phone.callBusy ? (
                      <button
                        type="button"
                        className="col-span-2 flex min-h-9 items-center justify-center gap-2 rounded-xl bg-brand-600 px-3 text-xs font-semibold text-ink-950 shadow-lg shadow-brand-600/20 transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={!phone.canCall}
                        onClick={() => void phone.makeCall()}
                      >
                        <PhoneCall className="size-4" aria-hidden="true" />
                        {labels.call}
                      </button>
                    ) : null}
                    {phone.callActive ? (
                      <>
                        <ActionButton
                          tone={phone.held ? 'warning' : 'neutral'}
                          icon={<Pause className="size-4" aria-hidden="true" />}
                          label={phone.held ? labels.resume : labels.hold}
                          onClick={phone.toggleHold}
                        />
                        <ActionButton tone="danger" icon={<PhoneOff className="size-4" aria-hidden="true" />} label={labels.hangup} onClick={phone.hangupCall} />
                      </>
                    ) : null}
                    {phone.callBusy && !phone.callActive && !phone.incomingCallWaiting ? (
                      <button
                        type="button"
                        className="col-span-2 flex min-h-9 items-center justify-center gap-2 rounded-xl bg-danger-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-danger-500"
                        onClick={phone.hangupCall}
                      >
                        <PhoneOff className="size-4" aria-hidden="true" />
                        {labels.hangup}
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-2 grid gap-1.5 border-t border-border pt-2">
                    <AudioControl
                      label={labels.mic}
                      value={phone.micVolume}
                      level={phone.micLevel}
                      muted={phone.muted}
                      icon={phone.muted ? <MicOff className="size-4" aria-hidden="true" /> : <Mic className="size-4" aria-hidden="true" />}
                      toggleLabel={phone.muted ? labels.unmuteMic : labels.muteMic}
                      onToggle={phone.toggleMute}
                      onChange={phone.setMicVolumeLevel}
                    />
                    <AudioControl
                      label={labels.speaker}
                      value={phone.speakerVolume}
                      level={phone.speakerLevel}
                      muted={phone.speakerMuted}
                      icon={phone.speakerMuted ? <VolumeX className="size-4" aria-hidden="true" /> : <Volume2 className="size-4" aria-hidden="true" />}
                      toggleLabel={phone.speakerMuted ? labels.unmuteSpeaker : labels.muteSpeaker}
                      onToggle={phone.toggleSpeakerMute}
                      onChange={phone.setSpeakerVolumeLevel}
                    />
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <ModeButton active={phone.autoAnswer} label={labels.autoAnswer} shortLabel="AA" onClick={() => phone.setAutoAnswer(!phone.autoAnswer)} />
                    <ModeButton active={phone.doNotDisturb} label={labels.dnd} shortLabel="DND" onClick={() => phone.setDoNotDisturb(!phone.doNotDisturb)} />
                  </div>
                </div>
              ) : (
                <div className="h-full overflow-y-auto p-2">
                  {phone.logsLoading ? <EmptyLog label={labels.loading} /> : null}
                  {!phone.logsLoading && phone.callLogs.length === 0 ? <EmptyLog label={labels.noCalls} /> : null}
                  {!phone.logsLoading && phone.callLogs.length > 0 ? (
                    <div className="grid gap-2">
                      {phone.callLogs.map((log, index) => (
                        <article
                          key={log.id ?? `${log.type}-${log.phoneNumber}-${index}`}
                          className="grid min-h-10 grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-border bg-muted p-1.5"
                        >
                          <span className={`grid size-7 place-items-center rounded-lg ${callLogTone(log.type)}`}>
                            {log.type === 'OUT' ? <ArrowUpRight className="size-4" aria-hidden="true" /> : <ArrowDownLeft className="size-4" aria-hidden="true" />}
                          </span>
                          <span className="min-w-0">
                            <strong className="block truncate text-xs text-foreground">{log.displayName || labels.unknown}</strong>
                            <small className="block truncate font-mono text-xs text-muted-foreground">{log.phoneNumber}</small>
                          </span>
                          <time className="font-mono text-xs text-muted-foreground">{formatWebphoneLogTime(log.createdAt ?? log.startedAt)}</time>
                        </article>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

function ConnectionDot({ state }: { state: WebphoneConnectionState }) {
  const tone = state === 'registered' || state === 'ready' ? 'bg-brand-500' : state === 'connecting' || state === 'loading' ? 'bg-warn-400' : 'bg-danger-500';

  return (
    <span className="relative flex size-2.5 shrink-0">
      {state === 'registered' ? <span className={`absolute inline-flex size-full animate-ping rounded-full opacity-60 motion-reduce:animate-none ${tone}`} /> : null}
      <span className={`relative inline-flex size-2.5 rounded-full ${tone}`} />
    </span>
  );
}

function TabButton({ active, label, icon, onClick }: { active: boolean; label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`flex h-7 items-center justify-center gap-1.5 rounded-lg text-2xs font-semibold transition-colors ${
        active ? 'bg-card text-brand-700 shadow-sm dark:text-brand-400' : 'text-muted-foreground hover:text-foreground'
      }`}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}

function ActionButton({ tone, icon, label, onClick }: { tone: 'success' | 'danger' | 'warning' | 'neutral'; icon: React.ReactNode; label: string; onClick: () => void }) {
  const toneClass = {
    success: 'bg-brand-600 hover:bg-brand-500 text-ink-950',
    danger: 'bg-danger-600 hover:bg-danger-500 text-white',
    warning: 'bg-warn-500 hover:bg-warn-400 text-ink-950',
    neutral: 'border border-border bg-muted text-foreground hover:bg-ink-200 dark:hover:bg-ink-700',
  }[tone];

  return (
    <button type="button" className={`flex min-h-9 items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold transition-colors ${toneClass}`} onClick={onClick}>
      {icon}
      {label}
    </button>
  );
}

function AudioControl({
  label,
  value,
  level,
  muted,
  icon,
  toggleLabel,
  onToggle,
  onChange,
}: {
  label: string;
  value: number;
  level: number;
  muted: boolean;
  icon: React.ReactNode;
  toggleLabel: string;
  onToggle: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid min-h-8 grid-cols-[2rem_4rem_minmax(0,1fr)_2.25rem] items-center gap-1.5">
      <button
        type="button"
        className={`grid size-8 place-items-center rounded-lg transition-colors ${
          muted ? 'bg-danger-500/10 text-danger-600 dark:bg-danger-500/15 dark:text-danger-400' : 'bg-brand-500/10 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400'
        }`}
        aria-label={toggleLabel}
        onClick={onToggle}
      >
        {icon}
      </button>
      <span className="truncate text-xs font-semibold text-muted-foreground">{label}</span>
      <span className="relative grid h-6 items-center">
        <span className="absolute inset-x-0 h-1 rounded-full bg-ink-200 dark:bg-ink-800" />
        <span className="absolute start-0 h-1 rounded-full bg-brand-500/70" style={{ width: `${value}%` }} />
        <span className="absolute start-0 h-1 rounded-full bg-brand-400" style={{ width: `${muted ? 0 : level}%` }} />
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={value}
          disabled={muted}
          aria-label={label}
          className="relative z-10 w-full cursor-pointer opacity-0"
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      </span>
      <output className="text-end font-mono text-xs text-muted-foreground">{value}%</output>
    </div>
  );
}

function ModeButton({ active, label, shortLabel, onClick }: { active: boolean; label: string; shortLabel: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={label}
      className={`h-7 rounded-lg border px-2 text-2xs font-semibold transition-colors ${
        active
          ? 'border-brand-600 bg-brand-600 text-ink-950'
          : 'border-border bg-muted text-muted-foreground hover:border-brand-300'
      }`}
      onClick={onClick}
    >
      {shortLabel}
      <span className="ms-1.5 font-semibold opacity-80">{label}</span>
    </button>
  );
}

function EmptyLog({ label }: { label: string }) {
  return (
    <div className="grid min-h-52 place-items-center rounded-xl border border-dashed border-border text-center text-xs font-semibold text-muted-foreground">
      <span>
        <History className="mx-auto mb-2 size-5 opacity-60" aria-hidden="true" />
        {label}
      </span>
    </div>
  );
}

function callLogTone(type: WebphoneCallLogType) {
  if (type === 'OUT') {
    return 'bg-brand-500/10 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400';
  }
  if (type === 'IN_ANS') {
    return 'bg-brand-500/10 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400';
  }
  return 'bg-danger-500/10 text-danger-600 dark:bg-danger-500/15 dark:text-danger-400';
}
