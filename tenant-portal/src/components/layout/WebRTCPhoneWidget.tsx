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
import type { WebphoneCallLogType, WebphoneConnectionState } from './webphone/types';

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
  const labels = copy[lang] || copy.en;
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
            className="flex h-8 items-center gap-2 rounded-t-xl border border-b-0 border-slate-700/80 bg-slate-950 px-3 text-start text-white shadow-2xl transition-colors hover:bg-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 cursor-pointer"
            aria-label={labels.showPhone}
            onClick={() => phone.setExpanded(true)}
          >
            <ConnectionDot state={phone.connectionState} />
            <strong className="truncate text-xs font-extrabold">{phone.phoneDisplayName}</strong>
            <ChevronUp className="size-3.5 shrink-0 text-slate-400" />
          </button>
        ) : (
          <section
            className="flex max-h-[calc(100svh-1rem)] w-[min(17.5rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-t-3xl border border-b-0 border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950"
            aria-label={lang === 'ar' ? 'هاتف WebRTC' : 'WebRTC phone'}
          >
            <header className="flex h-9 items-center gap-2 border-b border-slate-800 bg-slate-950 px-3 text-white">
              <ConnectionDot state={phone.connectionState} />
              <strong className="min-w-0 flex-1 truncate text-xs font-extrabold">{phone.phoneDisplayName}</strong>
              <button
                type="button"
                className="grid size-7 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-2 focus-visible:outline-blue-400 cursor-pointer"
                aria-label={labels.foldPhone}
                onClick={() => phone.setExpanded(false)}
              >
                <ChevronDown className="size-3.5" />
              </button>
            </header>

            <div
              className="grid grid-cols-2 border-b border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-900"
              role="tablist"
              aria-label={lang === 'ar' ? 'أقسام الهاتف' : 'Phone sections'}
            >
              <TabButton active={phone.activeTab === 'phone'} label={labels.phone} icon={<Phone className="size-3.5" />} onClick={() => phone.setActiveTab('phone')} />
              <TabButton active={phone.activeTab === 'log'} label={labels.calls} icon={<History className="size-3.5" />} onClick={() => phone.setActiveTab('log')} />
            </div>

            <div className="h-[24.5rem] overflow-hidden">
              {phone.activeTab === 'phone' ? (
                <div className="h-full overflow-y-auto p-2">
                  {!phone.callBusy ? (
                    <div className="flex h-9 items-center rounded-xl border border-slate-200 bg-slate-50 px-2 dark:border-slate-700 dark:bg-slate-900">
                      <input
                        type="text"
                        inputMode="tel"
                        value={phone.displayNumber}
                        onChange={(event) => phone.setDialTarget(event.currentTarget.value)}
                        placeholder={labels.enterNumber}
                        className="min-w-0 flex-1 bg-transparent px-1 font-mono text-sm font-bold text-slate-900 outline-none placeholder:text-xs placeholder:text-slate-400 dark:text-slate-100"
                      />
                      <button
                        type="button"
                        className="grid size-9 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 disabled:opacity-30 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
                        aria-label={labels.deleteDigit}
                        disabled={!phone.dialTarget}
                        onClick={phone.deleteLastDigit}
                      >
                        <Delete className="size-4" />
                      </button>
                      <button
                        type="button"
                        className="grid size-9 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200 hover:text-blue-600 disabled:opacity-30 dark:hover:bg-slate-800 dark:hover:text-blue-400 cursor-pointer"
                        aria-label={labels.copyNumber}
                        disabled={!phone.displayNumber.trim()}
                        onClick={phone.copyNumber}
                      >
                        <Copy className="size-4" />
                      </button>
                    </div>
                  ) : (
                    <div
                      className="grid min-h-24 content-center gap-1 rounded-2xl border border-blue-200 bg-blue-50/70 p-3 text-center dark:border-blue-900 dark:bg-blue-950/30"
                      aria-live="polite"
                    >
                      <span className="flex items-center justify-center gap-2 text-[11px] font-bold text-blue-700 dark:text-blue-300">
                        {phone.incomingCallWaiting ? <PhoneIncoming className="size-4" /> : <PhoneCall className="size-4" />}
                        {phone.callActive ? labels.connected : phone.status}
                      </span>
                      <strong className="truncate text-sm text-slate-900 dark:text-white">{phone.callPeerName || labels.unknown}</strong>
                      <span className="flex items-center justify-center gap-2 font-mono text-xs text-slate-500 dark:text-slate-400">
                        {phone.callPeerNumber}
                        {phone.timerLabel ? <time className="font-bold text-emerald-600 dark:text-emerald-400">{phone.timerLabel}</time> : null}
                      </span>
                      {phone.mediaNotice ? <small className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">{phone.mediaNotice}</small> : null}
                    </div>
                  )}

                  {phone.incomingCallWaiting ? (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <ActionButton tone="success" icon={<PhoneIncoming className="size-4" />} label={labels.answer} onClick={phone.answerCall} />
                      <ActionButton tone="danger" icon={<PhoneOff className="size-4" />} label={labels.decline} onClick={phone.declineCall} />
                    </div>
                  ) : null}

                  <div className="mt-2 grid grid-cols-3 gap-1">
                    {phone.keypad.map((key) => (
                      <button
                        key={key.value}
                        type="button"
                        className="grid min-h-9 place-content-center rounded-xl border border-slate-200 bg-slate-50 text-slate-900 transition-all hover:border-blue-300 hover:bg-blue-50 active:scale-95 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-blue-800 dark:hover:bg-blue-950/40 cursor-pointer"
                        onClick={() => phone.pressDigit(key.value)}
                      >
                        <strong className="font-mono text-sm leading-none">{key.value}</strong>
                        <small className="mt-1 min-h-2 font-mono text-[8px] leading-none text-slate-400">{key.letters}</small>
                      </button>
                    ))}
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {!phone.callBusy ? (
                      <button
                        type="button"
                        className="col-span-2 flex min-h-9 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 text-xs font-extrabold text-white shadow-lg shadow-blue-600/20 transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                        disabled={!phone.canCall}
                        onClick={() => void phone.makeCall()}
                      >
                        <PhoneCall className="size-4" />
                        {labels.call}
                      </button>
                    ) : null}
                    {phone.callActive ? (
                      <>
                        <ActionButton
                          tone={phone.held ? 'warning' : 'neutral'}
                          icon={<Pause className="size-4" />}
                          label={phone.held ? labels.resume : labels.hold}
                          onClick={phone.toggleHold}
                        />
                        <ActionButton tone="danger" icon={<PhoneOff className="size-4" />} label={labels.hangup} onClick={phone.hangupCall} />
                      </>
                    ) : null}
                    {phone.callBusy && !phone.callActive && !phone.incomingCallWaiting ? (
                      <button
                        type="button"
                        className="col-span-2 flex min-h-9 items-center justify-center gap-2 rounded-xl bg-rose-600 px-3 text-xs font-extrabold text-white transition-colors hover:bg-rose-500 cursor-pointer"
                        onClick={phone.hangupCall}
                      >
                        <PhoneOff className="size-4" />
                        {labels.hangup}
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-2 grid gap-1.5 border-t border-slate-200 pt-2 dark:border-slate-800">
                    <AudioControl
                      label={labels.mic}
                      value={phone.micVolume}
                      level={phone.micLevel}
                      muted={phone.muted}
                      icon={phone.muted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                      toggleLabel={phone.muted ? labels.unmuteMic : labels.muteMic}
                      onToggle={phone.toggleMute}
                      onChange={phone.setMicVolumeLevel}
                    />
                    <AudioControl
                      label={labels.speaker}
                      value={phone.speakerVolume}
                      level={phone.speakerLevel}
                      muted={phone.speakerMuted}
                      icon={phone.speakerMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
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
                          className="grid min-h-10 grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1.5 dark:border-slate-800 dark:bg-slate-900"
                        >
                          <span className={`grid size-7 place-items-center rounded-lg ${callLogTone(log.type)}`}>
                            {log.type === 'OUT' ? <ArrowUpRight className="size-4" /> : <ArrowDownLeft className="size-4" />}
                          </span>
                          <span className="min-w-0">
                            <strong className="block truncate text-xs text-slate-900 dark:text-slate-100">{log.displayName || labels.unknown}</strong>
                            <small className="block truncate font-mono text-[10px] text-slate-500 dark:text-slate-400">{log.phoneNumber}</small>
                          </span>
                          <time className="font-mono text-[10px] text-slate-400">{formatWebphoneLogTime(log.createdAt ?? log.startedAt)}</time>
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
  const tone = state === 'registered' || state === 'ready' ? 'bg-emerald-500' : state === 'connecting' || state === 'loading' ? 'bg-amber-400' : 'bg-rose-500';

  return (
    <span className="relative flex size-2.5 shrink-0">
      {state === 'registered' ? <span className={`absolute inline-flex size-full animate-ping rounded-full opacity-60 ${tone}`} /> : null}
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
      className={`flex h-7 items-center justify-center gap-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
        active ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-800 dark:text-blue-400' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
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
    success: 'bg-emerald-600 hover:bg-emerald-500 text-white',
    danger: 'bg-rose-600 hover:bg-rose-500 text-white',
    warning: 'bg-amber-500 hover:bg-amber-400 text-slate-950',
    neutral: 'border border-slate-200 bg-slate-100 text-slate-800 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
  }[tone];

  return (
    <button type="button" className={`flex min-h-9 items-center justify-center gap-2 rounded-xl px-3 text-xs font-extrabold transition-colors cursor-pointer ${toneClass}`} onClick={onClick}>
      {icon}
      {label}
    </button>
  );
}

function AudioControl({
  label,
  value,
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
        className={`grid size-8 place-items-center rounded-lg transition-colors cursor-pointer ${
          muted ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
        }`}
        aria-label={toggleLabel}
        onClick={onToggle}
      >
        {icon}
      </button>
      <span className="truncate text-[10px] font-bold text-slate-600 dark:text-slate-300">{label}</span>
      <span className="relative grid h-6 items-center">
        <span className="absolute inset-x-0 h-1 rounded-full bg-slate-200 dark:bg-slate-800" />
        <span className="absolute start-0 h-1 rounded-full bg-blue-500/70" style={{ width: `${value}%` }} />
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
      <output className="text-end font-mono text-[10px] text-slate-500">{value}%</output>
    </div>
  );
}

function ModeButton({ active, label, shortLabel, onClick }: { active: boolean; label: string; shortLabel: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={label}
      className={`h-7 rounded-lg border px-2 text-[10px] font-extrabold transition-colors cursor-pointer ${
        active
          ? 'border-blue-600 bg-blue-600 text-white'
          : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
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
    <div className="grid min-h-52 place-items-center rounded-2xl border border-dashed border-slate-300 text-center text-xs font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-400">
      <span>
        <History className="mx-auto mb-2 size-5 opacity-60" />
        {label}
      </span>
    </div>
  );
}

function callLogTone(type: WebphoneCallLogType) {
  if (type === 'OUT') {
    return 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400';
  }
  if (type === 'IN_ANS') {
    return 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400';
  }
  return 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400';
}
