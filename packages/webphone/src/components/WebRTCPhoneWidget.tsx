'use client';

import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Copy,
  Delete,
  FlaskConical,
  History,
  Mic,
  MicOff,
  Pause,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOff,
  RotateCw,
  Shuffle,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { callQualityHue, estimateMos } from '../quality/callQuality';
import type { WebphoneCopy } from '../copy';
import { useWebphoneContext } from '../context/WebphoneContext';
import { formatWebphoneLogTime, useWebRTCPhone } from '../hooks/useWebRTCPhone';
import { IncomingCallPopup } from './IncomingCallPopup';
import type {
  WebphoneCallLogType,
  WebphoneConnectionState,
  WebphoneMediaNoticeCode,
  WebphoneStatus,
} from '../types';

function statusText(labels: WebphoneCopy, status: WebphoneStatus) {
  const base = labels.status[status.code];
  return status.detail ? `${base} (${status.detail})` : base;
}

function mediaNoticeLabel(labels: WebphoneCopy, code?: WebphoneMediaNoticeCode) {
  return code ? labels.mediaNoticeText[code] : undefined;
}

type ServerProgress = {
  activeServerName: string;
  activeServerIndex: number;
  serverCount: number;
  registrationAttempt: number;
};

/**
 * The whole story in the space of a badge: which server of how many, and how
 * many times this one has been asked.
 *
 * A phone quietly working down a list of dead servers produces exactly the
 * same header as a phone with nothing to do — same grey dot, same name — so
 * the one thing an operator needs during an outage ("it is trying, and it is
 * on the third one") has no way to reach them. The digits carry it at a
 * glance; the tooltip spells it out for anyone who stops to look.
 */
function serverProgressLabel(labels: WebphoneCopy, phone: ServerProgress) {
  const parts = [`${labels.sipServer} ${phone.activeServerIndex + 1}/${phone.serverCount}`];
  if (phone.activeServerName) parts.push(phone.activeServerName);
  if (phone.registrationAttempt > 1) parts.push(`${labels.attempt} ${phone.registrationAttempt}`);
  return parts.join(' · ');
}

function ServerProgressChip({ labels, phone }: { labels: WebphoneCopy; phone: ServerProgress }) {
  // A single server that answered on the first ask has nothing to report, and
  // a permanent badge in a 36px header is worth less than the space it takes.
  const failingOver = phone.serverCount > 1;
  const retrying = phone.registrationAttempt > 1;
  if (!failingOver && !retrying) return null;

  const label = serverProgressLabel(labels, phone);

  return (
    <span
      className="shrink-0 rounded-md bg-slate-800/80 px-1.5 py-0.5 font-mono text-[10px] font-bold leading-none text-slate-300"
      title={label}
      aria-label={label}
    >
      {failingOver ? `${phone.activeServerIndex + 1}/${phone.serverCount}` : null}
      {retrying ? <span className={`text-amber-400 ${failingOver ? 'ms-1' : ''}`}>{`×${phone.registrationAttempt}`}</span> : null}
    </span>
  );
}

export function WebRTCPhoneWidget() {
  const { copy: labels } = useWebphoneContext();
  const [phone, remoteAudioRef] = useWebRTCPhone();

  if (!phone.shouldRender) return null;

  const connectionLabel =
    phone.connectionState === 'registered'
      ? labels.registered
      : phone.connectionState === 'connecting' || phone.connectionState === 'loading'
        ? labels.connecting
        : phone.connectionState === 'error'
          ? labels.error
          : phone.connectionState === 'offline'
            ? labels.offline
            : labels.ready;

  return (
    <>
      <IncomingCallPopup
        open={phone.showIncomingPopup}
        phoneNumber={phone.callPeerNumber || labels.unknown}
        displayName={phone.callPeerName !== phone.callPeerNumber ? phone.callPeerName : undefined}
        onAnswer={phone.answerCall}
        onDecline={phone.declineCall}
        onTransfer={() => {
          phone.answerCall();
          phone.beginTransfer();
        }}
        onClose={phone.dismissIncomingPopup}
      />

      <div className="fixed bottom-0 end-3 z-[70] select-none sm:end-5">
        <audio ref={remoteAudioRef} autoPlay playsInline />

        {/* Collapsed: the same width as the open panel, fixed 30px tall.
            Sizing the tab to its own label made the dock change width whenever
            the extension or the connection label changed length. */}
        {!phone.expanded ? (
          <button
            type="button"
            className="flex h-[30px] w-[min(17.5rem,calc(100vw-1.5rem))] items-center gap-2 rounded-t-xl border border-b-0 border-slate-700/80 bg-slate-950 px-3 text-start text-white shadow-2xl transition-colors hover:bg-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            aria-label={labels.showPhone}
            onClick={() => phone.setExpanded(true)}
          >
            <ConnectionDot state={phone.connectionState} label={connectionLabel} />
            <strong className="min-w-0 flex-1 truncate text-xs font-extrabold">{phone.phoneDisplayName}</strong>
            <ServerProgressChip labels={labels} phone={phone} />
            <ChevronUp className="size-3.5 shrink-0 text-slate-400" />
          </button>
        ) : (
          <section
            className="flex max-h-[calc(100svh-1rem)] w-[min(17.5rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-t-3xl border border-b-0 border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950"
            aria-label={labels.phoneRegion}
          >
            <header className="flex h-9 items-center gap-2 border-b border-slate-800 bg-slate-950 px-3 text-white">
              <ConnectionDot state={phone.connectionState} label={connectionLabel} />
              <strong className="min-w-0 flex-1 truncate text-xs font-extrabold">{phone.phoneDisplayName}</strong>
              <ServerProgressChip labels={labels} phone={phone} />
              {/* Rings the phone with no SIP session behind it, so the incoming
                  call surface can be reviewed before a server ever accepts a
                  registration. Press again to clear it. */}
              <button
                type="button"
                className={`grid size-7 place-items-center rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-blue-400 ${
                  phone.simulatedIncoming
                    ? 'bg-violet-600 text-white hover:bg-violet-500'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
                aria-label={labels.testIncomingCall}
                aria-pressed={phone.simulatedIncoming}
                title={labels.testIncomingCall}
                onClick={phone.toggleTestIncomingCall}
              >
                <FlaskConical className="size-3.5" />
              </button>
              {phone.connectionState === 'error' ? (
                <button
                  type="button"
                  className="grid size-7 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-2 focus-visible:outline-blue-400"
                  aria-label={labels.retryConnection}
                  title={labels.retryConnection}
                  onClick={phone.retryConnection}
                >
                  <RotateCw className="size-3.5" />
                </button>
              ) : null}
              <button
                type="button"
                className="grid size-7 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-2 focus-visible:outline-blue-400"
                aria-label={labels.foldPhone}
                onClick={() => phone.setExpanded(false)}
              >
                <ChevronDown className="size-3.5" />
              </button>
            </header>

            <div
              className="grid grid-cols-2 border-b border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-900"
              role="tablist"
              aria-label={labels.phoneSections}
            >
              <TabButton active={phone.activeTab === 'phone'} label={labels.phone} icon={<Phone className="size-3.5" />} onClick={() => phone.setActiveTab('phone')} />
              <TabButton active={phone.activeTab === 'log'} label={labels.calls} icon={<History className="size-3.5" />} onClick={() => phone.setActiveTab('log')} />
            </div>

            {/* `shrink-0` and `min-h-0` are what actually hold the height: a
                flex item defaults to `min-height:auto`, so the body would
                otherwise settle at its own content's height — tall on the
                dial pad, short on an empty log — and the panel would resize
                as you switched tabs. */}
            <div className="h-[28rem] min-h-0 shrink-0 overflow-hidden">
              {/* Every tab renders the same phone. A follower has no SIP stack
                  of its own, so the hook feeds it the leader's state and turns
                  its buttons into messages — the widget cannot tell which kind
                  of tab it is in, and does not need to. What a follower cannot
                  borrow is the audio: that is in the tab holding the call, so
                  answering from here brings that tab forward rather than
                  pretending the sound will follow. */}
              {phone.activeTab === 'phone' ? (
                <div className="flex h-full flex-col overflow-y-auto p-2">  {/* A column, so the keypad below can take the slack. Holding a fixed height for every state leaves the quiet ones short of content, and the gap all landed at the bottom. */}
                  {/* One field, in and out of a call. `displayNumber` is already
                      `remoteParty || dialTarget`, so during a call it holds the
                      far end's number and the copy control beside it copies
                      exactly that — which is the point: the card this replaced
                      printed the number as plain text, where it could only be
                      selected by hand. The field goes read-only rather than
                      disabled, because a disabled input is skipped by the
                      keyboard and its text stops being selectable, and reading
                      the number back is the whole reason it is there. Where the
                      call stands, and for how long, now sits under the AA/DND
                      row. */}
                  <div className="flex h-9 items-center rounded-xl border border-slate-200 bg-slate-50 px-2 dark:border-slate-700 dark:bg-slate-900">
                    <input
                      type="text"
                      inputMode="tel"
                      value={phone.displayNumber}
                      readOnly={phone.callBusy}
                      aria-label={phone.callBusy ? labels.connected : labels.enterNumber}
                      onChange={(event) => phone.setDialTarget(event.currentTarget.value)}
                      placeholder={labels.enterNumber}
                      className="min-w-0 flex-1 bg-transparent px-1 font-mono text-sm font-bold text-slate-900 outline-none placeholder:text-xs placeholder:text-slate-400 read-only:cursor-default dark:text-slate-100"
                    />
                    <button
                      type="button"
                      className="grid size-9 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 disabled:opacity-30 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      aria-label={labels.deleteDigit}
                      disabled={phone.callBusy || !phone.dialTarget}
                      onClick={phone.deleteLastDigit}
                    >
                      <Delete className="size-4" />
                    </button>
                    <button
                      type="button"
                      className="grid size-9 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200 hover:text-blue-600 disabled:opacity-30 dark:hover:bg-slate-800 dark:hover:text-blue-400"
                      aria-label={labels.copyNumber}
                      disabled={!phone.displayNumber.trim()}
                      onClick={phone.copyNumber}
                    >
                      <Copy className="size-4" />
                    </button>
                  </div>

                  {/* Answer and decline live in the incoming-call popup, and
                      only there. They used to be duplicated here as well, which
                      put the same two decisions in two places at once and made
                      the phone body look like it had swallowed the popup. The
                      popup is a portal over the whole page and is the thing a
                      person actually reacts to; the body stays a dial pad. */}

                  {/* A key sounds on the way down, not on the way up. `click`
                      does not fire until the button is released, so holding a
                      key — which is what anyone does on a dial pad — left the
                      tone trailing the press by however long the finger stayed
                      down. `pointerdown` is the press itself. The click handler
                      stays for keyboard activation only: Enter and Space raise
                      a click with `detail === 0` and no pointer event at all,
                      while a real pointer click always reports a detail of at
                      least 1 and has already been handled below. */}
                  <div className="mt-2 grid min-h-0 flex-1 grid-cols-3 gap-1">
                    {phone.keypad.map((key) => (
                      <button
                        key={key.value}
                        type="button"
                        className="grid min-h-9 place-content-center rounded-xl border border-slate-200 bg-slate-50 text-slate-900 transition-all hover:border-blue-300 hover:bg-blue-50 active:scale-95 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-blue-800 dark:hover:bg-blue-950/40"
                        onPointerDown={(event) => {
                          if (event.button !== 0) return;
                          phone.pressDigit(key.value);
                        }}
                        onClick={(event) => {
                          if (event.detail !== 0) return;
                          phone.pressDigit(key.value);
                        }}
                      >
                        <strong className="font-mono text-sm leading-none">{key.value}</strong>
                        <small className="mt-1 min-h-2 font-mono text-[8px] leading-none text-slate-400">{key.letters}</small>
                      </button>
                    ))}
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {/* One control, three states, read straight off the line:
                        grey while there is nothing to dial, green once a
                        number is entered, and — during a call — split into a
                        red hang-up and a violet transfer. Colour follows the
                        typed number rather than `canCall`, so a phone that is
                        merely still registering does not look empty-handed. */}
                    {!phone.callBusy ? (
                      <button
                        type="button"
                        className={`col-span-2 flex min-h-9 items-center justify-center gap-2 rounded-xl px-3 text-xs font-extrabold transition-colors disabled:cursor-not-allowed ${
                          phone.hasDialTarget
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 disabled:opacity-60'
                            : 'bg-slate-200 text-slate-500 disabled:opacity-100 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                        disabled={!phone.canCall}
                        onClick={() => void phone.makeCall()}
                      >
                        <PhoneCall className="size-4" />
                        {labels.call}
                      </button>
                    ) : null}
                    {/* Three controls, one row. Hold used to span both columns
                        and drop onto a second row of its own, which cost 42px —
                        two thirds of the overflow that put a scrollbar inside a
                        dock whose whole point is that it does not move. A lone
                        button on its own full-width row also read as more
                        important than the two above it, which it is not. */}
                    {phone.callActive && !phone.transferring ? (
                      <div className="col-span-2 grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          className="flex min-h-9 items-center justify-center gap-1 rounded-xl bg-rose-600 px-1 text-[11px] font-extrabold text-white transition-colors hover:bg-rose-500"
                          onClick={phone.hangupCall}
                        >
                          <PhoneOff className="size-3.5 shrink-0" />
                          <span className="truncate">{labels.hangup}</span>
                        </button>
                        <button
                          type="button"
                          className="flex min-h-9 items-center justify-center gap-1 rounded-xl bg-violet-600 px-1 text-[11px] font-extrabold text-white transition-colors hover:bg-violet-500"
                          onClick={phone.beginTransfer}
                        >
                          <Shuffle className="size-3.5 shrink-0" />
                          <span className="truncate">{labels.transfer}</span>
                        </button>
                        <button
                          type="button"
                          className={`flex min-h-9 items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-extrabold transition-colors ${
                            phone.held
                              ? 'bg-amber-500 text-white hover:bg-amber-400'
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                          }`}
                          onClick={phone.toggleHold}
                        >
                          <Pause className="size-3.5 shrink-0" />
                          <span className="truncate">{phone.held ? labels.resume : labels.hold}</span>
                        </button>
                      </div>
                    ) : null}
                    {phone.callActive && phone.transferring ? (
                      <>
                        <div className="col-span-2 flex h-9 items-center rounded-xl border border-violet-300 bg-violet-50 px-2 dark:border-violet-800 dark:bg-violet-950/40">
                          <input
                            type="text"
                            inputMode="tel"
                            autoFocus
                            value={phone.transferTarget}
                            onChange={(event) => phone.setTransferTarget(event.currentTarget.value)}
                            placeholder={labels.transferTo}
                            aria-label={labels.transferTo}
                            className="min-w-0 flex-1 bg-transparent px-1 font-mono text-sm font-bold text-slate-900 outline-none placeholder:text-xs placeholder:text-violet-400 dark:text-slate-100"
                          />
                        </div>
                        <button
                          type="button"
                          className="flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-slate-200 px-2 text-xs font-extrabold text-slate-600 transition-colors hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300"
                          onClick={phone.cancelTransfer}
                        >
                          {labels.cancelTransfer}
                        </button>
                        <button
                          type="button"
                          className="flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-2 text-xs font-extrabold text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
                          disabled={!phone.canTransfer}
                          onClick={() => phone.confirmTransfer()}
                        >
                          <Shuffle className="size-4" />
                          {labels.confirmTransfer}
                        </button>
                      </>
                    ) : null}
                    {/* Only while transferring: the non-transferring case now
                        carries hold in the three-up row above, and rendering it
                        here as well would put two of the same control on screen. */}
                    {phone.callActive && phone.transferring ? (
                      <ActionButton
                        tone={phone.held ? 'warning' : 'neutral'}
                        icon={<Pause className="size-4" />}
                        label={phone.held ? labels.resume : labels.hold}
                        onClick={phone.toggleHold}
                        className="col-span-2"
                      />
                    ) : null}
                    {phone.callBusy && !phone.callActive && !phone.incomingCallWaiting ? (
                      <button
                        type="button"
                        className="col-span-2 flex min-h-9 items-center justify-center gap-2 rounded-xl bg-rose-600 px-3 text-xs font-extrabold text-white transition-colors hover:bg-rose-500"
                        onClick={phone.hangupCall}
                      >
                        <PhoneOff className="size-4" />
                        {labels.hangup}
                      </button>
                    ) : null}
                  </div>

                  {/* Speaker above microphone: what you hear is the first thing
                      you reach for when a call goes wrong, and it is the control
                      that gets touched on calls where the mic is never adjusted
                      at all. */}
                  <div className="mt-2 grid gap-1.5 border-t border-slate-200 pt-2 dark:border-slate-800">
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
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <ModeButton active={phone.autoAnswer} label={labels.autoAnswer} shortLabel="AA" onClick={() => phone.setAutoAnswer(!phone.autoAnswer)} />
                    <ModeButton active={phone.doNotDisturb} label={labels.dnd} shortLabel="DND" onClick={() => phone.setDoNotDisturb(!phone.doNotDisturb)} />
                  </div>

                  {/* Where the call stands, and for how long — the two facts the
                      removed card carried that the number field cannot. It sits
                      last so the controls above never shift position when a call
                      arrives; the row appears in space the dial pad already
                      reserved. The peer's name rides along only when it differs
                      from the number now shown in the field, so an anonymous
                      caller does not get a line repeating itself. The media
                      notice stays here too: it is the one place the phone says
                      why it will not dial. */}
                  {/* Always on screen, not only during a call. The dot is the
                      phone's own state — green when it is working, violet while
                      something is ringing, red when it is not connected — and a
                      status line that appears only when it has bad news is a
                      status line nobody learns to read. The timer is the part
                      that is call-only. */}
                  <div
                    className="mt-2 grid gap-0.5 border-t border-slate-200 pt-2 text-start dark:border-slate-800"
                    aria-live="polite"
                  >
                    <span className="flex items-center justify-start gap-1.5 text-[11px] font-bold text-blue-700 dark:text-blue-300">
                        <CallQualityIndicator labels={labels} phone={phone} connectionLabel={connectionLabel} />
                        {/* Outside a call this shows the connection, from the
                            same value as the dot in the header — not the call
                            status machine, which tracks something else and
                            drifts. `status` could sit at "ready" while the
                            header said the phone was not registered, because
                            the two are set from different places and nothing
                            made them agree. Now the two labels cannot disagree,
                            because outside a call there is only one of them. */}
                        <span className="truncate">
                          {phone.callBusy
                            ? phone.callActive
                              ? labels.connected
                              : statusText(labels, phone.status)
                            : connectionLabel}
                        </span>
                        {phone.callBusy && phone.callPeerName && phone.callPeerName !== phone.callPeerNumber ? (
                          <span className="truncate font-medium text-slate-500 dark:text-slate-400">· {phone.callPeerName}</span>
                        ) : null}
                        {/* Only while a call is actually up. `timerLabel` also
                            carries the last call's duration once one ends, and
                            a stopped clock next to a live status reads as a
                            running one. */}
                        {phone.callActive && phone.timerLabel ? (
                          <time className="ms-auto font-mono font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                            {phone.timerLabel}
                          </time>
                        ) : null}
                    </span>
                    {phone.mediaNotice ? (
                      <small className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">{mediaNoticeLabel(labels, phone.mediaNotice)}</small>
                    ) : null}
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
                          className="grid min-h-10 grid-cols-[1.75rem_minmax(0,1fr)_auto_auto] items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1.5 dark:border-slate-800 dark:bg-slate-900"
                        >
                          <span className={`grid size-7 place-items-center rounded-lg ${callLogTone(log.type)}`}>
                            {isOutgoingLog(log.type) ? <ArrowUpRight className="size-4" /> : <ArrowDownLeft className="size-4" />}
                          </span>
                          <span className="min-w-0">
                            <strong className="block truncate text-xs text-slate-900 dark:text-slate-100">{log.displayName || labels.unknown}</strong>
                            <small className="block truncate font-mono text-[10px] text-slate-500 dark:text-slate-400">{log.phoneNumber}</small>
                          </span>
                          <time className="font-mono text-[10px] text-slate-400">{formatWebphoneLogTime(log.createdAt ?? log.startedAt)}</time>
                          {/* Redial. It fills the dial box and switches back to
                              the keypad rather than dialling on the spot: the
                              number lands where it can be read and corrected
                              before it goes anywhere, and a log entry is a
                              place people scroll, which is the wrong place for
                              a control that would place a real call on one
                              stray tap. */}
                          <button
                            type="button"
                            className="grid size-7 place-items-center rounded-lg bg-emerald-600 text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                            aria-label={`${labels.callThisNumber}: ${log.phoneNumber}`}
                            title={labels.callThisNumber}
                            disabled={!log.phoneNumber || phone.callBusy}
                            onClick={() => {
                              phone.setDialTarget(log.phoneNumber);
                              phone.setActiveTab('phone');
                            }}
                          >
                            <PhoneCall className="size-3.5" />
                          </button>
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

/**
 * Green means one thing: the phone holds a live SIP registration.
 *
 * `ready` used to share that green, and it is not the same claim — it is set
 * the moment `/me` says the configuration is complete, before any REGISTER has
 * been attempted. A phone that had never reached its SIP server therefore
 * looked connected, while the call button stayed disabled (it requires a real
 * registration), so the dock said "working" and refused to dial. Ready is now
 * neutral: nothing has failed, nothing has connected yet.
 */
/**
 * The state of the call in one dot, and the numbers behind it on demand.
 *
 * ## Why the colour is computed rather than chosen
 *
 * Idle, ringing and disconnected are three discrete facts, so they get three
 * fixed colours. A call in progress is not discrete — it degrades — so its
 * colour is interpolated from measured loss. Green, yellow, orange and red are
 * what a single hue sweep from 120° to 0° produces on its way down, which is
 * why there is no palette here: the colours are the arc.
 *
 * ## Why the numbers are not hover-only
 *
 * Hover does not exist on a touch screen, and a colour on its own fails anyone
 * who cannot distinguish it — so the dot is a button that opens the detail on
 * focus and on tap as well as on hover, and every state is also written out in
 * the label beside it. The colour is the fast path, never the only one.
 */
function CallQualityIndicator({
  labels,
  phone,
  connectionLabel,
}: {
  labels: WebphoneCopy;
  phone: ReturnType<typeof useWebRTCPhone>[0];
  connectionLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const quality = phone.callQuality;

  // Ringing is its own state, not a degraded one -- nothing is flowing yet to
  // measure. Violet says "waiting on a person", which is what it is.
  const ringing = phone.incomingCallWaiting || phone.status.code === 'ringing';
  const settling = phone.connectionState === 'connecting' || phone.connectionState === 'loading';
  // Green means the phone can carry a call, and only a registration makes that
  // true. It used to mean "not visibly broken", so an extension that had never
  // registered showed the same green as one mid-conversation -- which is how a
  // phone ends up reporting itself unregistered and fine at the same time.
  const registered = phone.connectionState === 'registered';

  const style = ringing
    ? { backgroundColor: 'hsl(265 85% 58%)' }
    : settling
      ? { backgroundColor: 'hsl(38 92% 50%)' }
      : !registered
        ? { backgroundColor: 'hsl(0 85% 45%)' }
        : quality
          ? { backgroundColor: `hsl(${callQualityHue(quality.lossPct)} 78% 40%)` }
          : { backgroundColor: 'hsl(120 78% 40%)' };

  // Outside a call the useful summary is the connection, not a measurement
  // there is nothing to measure for.
  const summary = !phone.callBusy
    ? connectionLabel
    : quality
      ? `${labels.qualityLoss}: ${quality.lossPct.toFixed(1)}%`
      : labels.qualityMeasuring;

  return (
    <span className="relative flex shrink-0 items-center">
      <button
        type="button"
        className="grid size-3.5 place-items-center rounded-full text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        style={style}
        aria-label={`${labels.qualityTitle}: ${summary}`}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((current) => !current)}
      >
        {phone.incomingCallWaiting ? (
          <PhoneIncoming className="size-2.5" />
        ) : (
          <PhoneCall className="size-2.5" />
        )}
      </button>

      {open ? (
        <span
          role="tooltip"
          className="absolute bottom-full start-0 z-10 mb-1 grid w-44 gap-1 rounded-xl border border-slate-200 bg-white p-2 text-start shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          <strong className="text-[11px] font-extrabold text-slate-900 dark:text-white">{labels.qualityTitle}</strong>
          {quality ? (
            <>
              <QualityRow label={labels.qualityLoss} value={`${quality.lossPct.toFixed(1)}%`} />
              <QualityRow label={labels.qualityJitter} value={`${Math.round(quality.jitterBufferMs)} ms`} />
              <QualityRow label={labels.qualityRtt} value={`${Math.round(quality.rttMs)} ms`} />
              <QualityRow label={labels.qualityMos} value={estimateMos(quality).toFixed(1)} />
              <small className="text-[10px] leading-4 text-slate-400">{labels.qualityEstimated}</small>
            </>
          ) : (
            <small className="text-[11px] text-slate-500 dark:text-slate-400">{labels.qualityMeasuring}</small>
          )}
        </span>
      ) : null}
    </span>
  );
}

function QualityRow({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-center justify-between gap-2 text-[11px]">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-white">{value}</span>
    </span>
  );
}

function ConnectionDot({ state, label }: { state: WebphoneConnectionState; label: string }) {
  const tone =
    state === 'registered'
      ? 'bg-emerald-500'
      : state === 'connecting' || state === 'loading'
        ? 'bg-amber-400'
        : state === 'ready' || state === 'idle'
          ? 'bg-slate-400'
          : 'bg-rose-500';

  return (
    <span className="relative flex size-2.5 shrink-0" role="status">
      {state === 'registered' ? <span className={`absolute inline-flex size-full animate-ping rounded-full opacity-60 ${tone}`} /> : null}
      <span className={`relative inline-flex size-2.5 rounded-full ${tone}`} />
      <span className="sr-only">{label}</span>
    </span>
  );
}

function TabButton({ active, label, icon, onClick }: { active: boolean; label: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`flex h-7 items-center justify-center gap-1.5 rounded-lg text-[11px] font-bold transition-colors ${
        active ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-800 dark:text-blue-400' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
      }`}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}

function ActionButton({ tone, icon, label, onClick, className = '' }: { tone: 'success' | 'danger' | 'warning' | 'neutral'; icon: ReactNode; label: string; onClick: () => void; className?: string }) {
  const toneClass = {
    success: 'bg-emerald-600 hover:bg-emerald-500 text-white',
    danger: 'bg-rose-600 hover:bg-rose-500 text-white',
    warning: 'bg-amber-500 hover:bg-amber-400 text-slate-950',
    neutral: 'border border-slate-200 bg-slate-100 text-slate-800 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
  }[tone];

  return (
    <button type="button" className={`flex min-h-9 items-center justify-center gap-2 rounded-xl px-3 text-xs font-extrabold transition-colors ${toneClass} ${className}`} onClick={onClick}>
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
  icon: ReactNode;
  toggleLabel: string;
  onToggle: () => void;
  onChange: (value: string) => void;
}) {
  // The icon already says which channel this is, so the written label is
  // dropped and the slider takes the width back. `label` stays on the range's
  // aria-label, which is what a screen reader announces.
  return (
    <div className="grid min-h-8 grid-cols-[2rem_minmax(0,1fr)_2.25rem] items-center gap-1.5">
      <button
        type="button"
        className={`grid size-8 place-items-center rounded-lg transition-colors ${
          muted ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
        }`}
        aria-label={toggleLabel}
        title={label}
        onClick={onToggle}
      >
        {icon}
      </button>
      <span className="relative grid h-6 items-center">
        {/* Green is reserved for sound that is actually moving.
            The setting has no colour of its own: it is a knob you drag along a
            neutral track, which is what a volume control looks like everywhere
            else. Filling the track green up to the setting meant a phone in
            silence showed the same green bar as one carrying audio, so the one
            thing worth glancing at — is anything coming through — was buried
            under a value that had not changed in an hour.
            Muting drops the meter to nothing while the knob stays where it is,
            so the level waiting to be restored is still readable. */}
        <span className="absolute inset-x-0 h-1 rounded-full bg-slate-200 dark:bg-slate-800" />
        <span
          className="absolute start-0 h-1 rounded-full bg-emerald-500 transition-[width] duration-75"
          style={{ width: `${muted ? 0 : level}%` }}
        />
        {/* The knob. `-translate-x-1/2` on an `start`-anchored element would
            move it the wrong way in RTL, so the offset is applied through the
            inset property that already flips with direction. */}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute size-3 rounded-full border-2 border-white shadow-sm dark:border-slate-900 ${
            muted ? 'bg-slate-400 dark:bg-slate-600' : 'bg-slate-600 dark:bg-slate-300'
          }`}
          style={{ insetInlineStart: `calc(${value}% - 0.375rem)` }}
        />
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
      className={`h-7 rounded-lg border px-2 text-[10px] font-extrabold transition-colors ${
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

/** Outgoing covers the legacy `OUT` as well as the split values that replaced it. */
function isOutgoingLog(type: WebphoneCallLogType): boolean {
  return type.startsWith('OUT');
}

/**
 * Outcome, not direction.
 *
 * The arrow already says which way the call went, so repeating that in the
 * colour wastes the only other channel this row has. What a person scanning a
 * log actually wants is which ones connected — so green means answered, red
 * means it did not, and violet means the far end was busy, in both directions.
 * Busy is deliberately not red: nobody failed to reach anybody, the line was
 * simply occupied, and an operator triaging a red list should not have to
 * re-read each one to find that out.
 */
function callLogTone(type: WebphoneCallLogType) {
  switch (type) {
    case 'IN_ANS':
    case 'OUT_ANS':
      return 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400';
    case 'IN_BUSY':
      return 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400';
    case 'OUT_BUSY':
      // Lighter than the incoming busy: same fact, and the direction is the
      // arrow's job, but the pair reads as related rather than identical.
      return 'bg-violet-50 text-violet-400 dark:bg-violet-950/20 dark:text-violet-300';
    case 'IN_NOANS':
    case 'OUT_NOANS':
      return 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400';
    default:
      // `OUT` from before the outcomes were split. Its result is unknown, and
      // colouring it as any of them would be a guess.
      return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
  }
}

