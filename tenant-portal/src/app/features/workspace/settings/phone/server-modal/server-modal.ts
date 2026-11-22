import { Component, ElementRef, computed, inject, input, output, signal, viewChild, viewChildren } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAdjustmentsHorizontal,
  tablerAlertTriangle,
  tablerBroadcast,
  tablerLink,
  tablerPlus,
  tablerServer,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Segmented, SegmentedOption } from '../../../../../shared/ui/segmented/segmented';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { ApiError, errorCodeOf } from '../../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { IceEntryRow } from '../ice-entry-row/ice-entry-row';
import { CoreFieldErrors, coreFieldErrors } from '../../core-response.model';
import {
  createIceServer,
  deleteIceServer,
  listPhoneServers,
  updateIceServer,
  updatePhoneServer,
} from '../phone-servers.api';
import {
  CALLER_ID_PATTERN,
  ICE_URL_PATTERN,
  IceEntry,
  IceEntryDraft,
  IceEntryValidationErrors,
  IceTransportPolicy,
  MAX_RETRIES_DEFAULT,
  MAX_RETRIES_MAX,
  MAX_RETRIES_MIN,
  PHONE_SERVER_NAME_MAX,
  PhoneServer,
  REGISTER_EXPIRES_DEFAULT,
  REGISTER_EXPIRES_MAX,
  REGISTER_EXPIRES_MIN,
  SIP_DOMAIN_PATTERN,
  SIP_URI_PATTERN,
  TIMEOUT_SECONDS_DEFAULT,
  TIMEOUT_SECONDS_MAX,
  TIMEOUT_SECONDS_MIN,
  UpdateIceEntryPatch,
  UpdatePhoneServerPatch,
  WEBSOCKET_URL_PATTERN,
  WebsocketProtocol,
  hasEnabledTurn,
  parseIceUrls,
  protocolOfUrl,
  rewriteUrlScheme,
} from '../phone-servers.model';

type ServerModalTab = 'connection' | 'advanced' | 'ice';
type StringDraftField =
  | 'realm'
  | 'fromDomain'
  | 'registrarServer'
  | 'outboundProxy'
  | 'contactUri'
  | 'defaultCallerId'
  | 'registerExpires'
  | 'defaultTimeoutSeconds'
  | 'defaultMaxRetries';

/** The original write is still running (gateway GW.IDEM.IN_FLIGHT is a 409): not a data conflict. */
const IN_FLIGHT_CODES: ReadonlySet<string> = new Set(['GW.IDEM.IN_FLIGHT', 'IDEM_IN_FLIGHT']);

/** 409 answers that are not an edit conflict, so they never open the conflict dialog. */
const NOT_A_CONFLICT_CODES: ReadonlySet<string> = new Set([
  'WEBPHONE_PROVISIONING_PENDING',
  'WEBPHONE_SERVER_LIMIT_REACHED',
]);

const ICE_ROW_FIELDS = ['urls', 'username', 'credential'] as const;
type IceRowField = (typeof ICE_ROW_FIELDS)[number];

const SERVER_FIELD_NAMES: ReadonlySet<string> = new Set([
  'name',
  'websocketUrl',
  'sipDomain',
  'registrarServer',
  'outboundProxy',
  'contactUri',
  'defaultCallerId',
  'registerExpires',
  'defaultTimeoutSeconds',
  'defaultMaxRetries',
]);

const TABS: readonly { id: ServerModalTab; icon: string; labelKey: string }[] = [
  { id: 'connection', icon: 'tablerLink', labelKey: 'wsPhone.modal.tabs.connection' },
  { id: 'advanced', icon: 'tablerAdjustmentsHorizontal', labelKey: 'wsPhone.modal.tabs.advanced' },
  { id: 'ice', icon: 'tablerBroadcast', labelKey: 'wsPhone.modal.tabs.ice' },
];

let nextIceDraftUid = 0;

function toIceDraft(entry: IceEntry): IceEntryDraft {
  return {
    uid: `ice-draft-${++nextIceDraftUid}`,
    id: entry.id,
    kind: entry.kind,
    urlsText: entry.urls.join('\n'),
    username: entry.username ?? '',
    credentialConfigured: entry.credentialConfigured,
    credentialAction: 'keep',
    credentialValue: '',
    enabled: entry.enabled,
  };
}

function emptyIceDraft(): IceEntryDraft {
  return {
    uid: `ice-draft-${++nextIceDraftUid}`,
    id: null,
    kind: 'STUN',
    urlsText: '',
    username: '',
    credentialConfigured: false,
    credentialAction: 'keep',
    credentialValue: '',
    enabled: true,
  };
}

function normalizeNullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseOptionalInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return Number.NaN;
  return Number(trimmed);
}

function parseRequiredInt(value: string): number {
  const trimmed = value.trim();
  if (!trimmed || !/^\d+$/.test(trimmed)) return Number.NaN;
  return Number(trimmed);
}

function iceEntriesEqual(drafts: readonly IceEntryDraft[], base: readonly IceEntry[]): boolean {
  if (drafts.length !== base.length) return false;
  return drafts.every((draft, index) => {
    const original = base[index];
    if (!original || draft.id !== original.id) return false;
    if (draft.kind !== original.kind || draft.enabled !== original.enabled) return false;
    const draftUrls = parseIceUrls(draft.urlsText);
    if (draftUrls.length !== original.urls.length) return false;
    if (draftUrls.some((url, i) => url !== original.urls[i])) return false;
    const draftUsername = draft.kind === 'TURN' ? normalizeNullableText(draft.username) : null;
    if (draftUsername !== original.username) return false;
    if (draft.kind === 'TURN') {
      if (draft.credentialAction === 'clear' && original.credentialConfigured) return false;
      if (draft.credentialAction === 'set' && draft.credentialValue.trim().length > 0) return false;
    }
    return true;
  });
}

@Component({
  selector: 'app-server-modal',
  imports: [
    NgIcon,
    TranslocoPipe,
    Button,
    ConfirmDialog,
    Field,
    IceEntryRow,
    Modal,
    Segmented,
    Switch,
  ],
  providers: [
    provideIcons({
      tablerServer,
      tablerLink,
      tablerAdjustmentsHorizontal,
      tablerBroadcast,
      tablerPlus,
      tablerAlertTriangle,
    }),
  ],
  templateUrl: './server-modal.html',
})
export class ServerModal {
  private static nextId = 0;
  protected readonly uid = `phone-server-modal-${++ServerModal.nextId}`;

  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;

  private readonly modal = viewChild.required<Modal>('mainModal');
  private readonly conflictModal = viewChild.required<Modal>('conflictModal');
  private readonly discardDialog = viewChild.required<ConfirmDialog>('discardDialog');
  private readonly tabButtons = viewChildren<ElementRef<HTMLButtonElement>>('tabBtn');

  readonly canManage = input(true);

  readonly saved = output<PhoneServer>();
  readonly serverPatched = output<PhoneServer>();
  readonly deleteRequested = output<PhoneServer>();
  readonly deletedRemotely = output<string>();

  protected readonly tabs = TABS;
  protected readonly maxNameLength = PHONE_SERVER_NAME_MAX;
  protected readonly timeoutDefault = String(TIMEOUT_SECONDS_DEFAULT);
  protected readonly retriesDefault = String(MAX_RETRIES_DEFAULT);

  protected readonly baselineServer = signal<PhoneServer | null>(null);
  protected readonly activeTab = signal<ServerModalTab>('connection');
  protected readonly saving = signal(false);
  protected readonly togglingIceEnabled = signal(false);
  protected readonly conflictBusy = signal(false);

  protected readonly nameDraft = signal('');
  protected readonly websocketUrlDraft = signal('');
  protected readonly sipDomainDraft = signal('');
  protected readonly enabledDraft = signal(false);

  protected readonly realmDraft = signal('');
  protected readonly fromDomainDraft = signal('');
  protected readonly registrarServerDraft = signal('');
  protected readonly outboundProxyDraft = signal('');
  protected readonly contactUriDraft = signal('');
  protected readonly defaultCallerIdDraft = signal('');
  protected readonly registerExpiresDraft = signal(String(REGISTER_EXPIRES_DEFAULT));
  protected readonly sessionTimersDraft = signal(true);
  protected readonly defaultTimeoutDraft = signal('');
  protected readonly defaultMaxRetriesDraft = signal('');
  protected readonly traceSipDraft = signal(false);
  protected readonly allowInvalidTlsDraft = signal(false);

  protected readonly iceEnabledDraft = signal(false);
  protected readonly iceTransportPolicyDraft = signal<IceTransportPolicy>('all');
  protected readonly iceEntries = signal<IceEntryDraft[]>([]);

  protected readonly touched = signal<Record<string, boolean>>({});
  protected readonly iceTouchedUids = signal<ReadonlySet<string>>(new Set());
  protected readonly submitted = signal(false);
  protected readonly serverFieldErrors = signal<Record<string, string>>({});
  protected readonly iceServerErrors = signal<Record<string, IceEntryValidationErrors>>({});
  protected readonly relayServerError = signal(false);

  private allowClose = false;
  private confirmingDiscard = false;
  private readonly opKeys = new Map<string, { fingerprint: string; key: string }>();
  /** The ICE row whose create/update call is in progress during save, so its field errors land on it. */
  private savingIceUid: string | null = null;

  protected readonly isReadonly = computed(() => !this.canManage());

  protected readonly modalTitle = computed(() => {
    const liveName = this.nameDraft().trim();
    if (liveName) return liveName;
    return this.baselineServer()?.name ?? '';
  });

  protected readonly protocolValue = computed<WebsocketProtocol>(() => protocolOfUrl(this.websocketUrlDraft()));

  protected readonly protocolOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    const ro = this.isReadonly() || this.saving();
    return [
      { value: 'wss', label: this.transloco.translate('wsPhone.modal.fields.protocolWss'), disabled: ro },
      { value: 'ws', label: this.transloco.translate('wsPhone.modal.fields.protocolWs'), disabled: ro },
    ];
  });

  protected readonly iceTransportOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    const ro = this.isReadonly() || this.saving();
    return [
      { value: 'all', label: this.transloco.translate('wsPhone.modal.fields.iceAll'), disabled: ro },
      { value: 'relay', label: this.transloco.translate('wsPhone.modal.fields.iceRelay'), disabled: ro },
    ];
  });

  protected readonly nameError = computed(() => {
    this.i18n();
    const server = this.serverFieldErrors()['name'];
    if (server) return server;
    if (!this.submitted() && !this.touched()['name']) return null;
    const trimmed = this.nameDraft().trim();
    if (!trimmed) return this.transloco.translate('wsPhone.validation.nameRequired');
    if (trimmed.length > PHONE_SERVER_NAME_MAX) {
      return this.transloco.translate('wsPhone.validation.nameMax', { max: PHONE_SERVER_NAME_MAX });
    }
    return null;
  });

  protected readonly websocketUrlError = computed(() => {
    this.i18n();
    const server = this.serverFieldErrors()['websocketUrl'];
    if (server) return server;
    if (!this.submitted() && !this.touched()['websocketUrl']) return null;
    const trimmed = this.websocketUrlDraft().trim();
    if (!trimmed) return this.transloco.translate('wsPhone.validation.websocketUrlRequired');
    if (!WEBSOCKET_URL_PATTERN.test(trimmed)) {
      return this.transloco.translate('wsPhone.validation.websocketUrlPattern');
    }
    return null;
  });

  protected readonly sipDomainError = computed(() => {
    this.i18n();
    const server = this.serverFieldErrors()['sipDomain'];
    if (server) return server;
    if (!this.submitted() && !this.touched()['sipDomain']) return null;
    const trimmed = this.sipDomainDraft().trim();
    if (!trimmed) return this.transloco.translate('wsPhone.validation.sipDomainRequired');
    if (!SIP_DOMAIN_PATTERN.test(trimmed)) {
      return this.transloco.translate('wsPhone.validation.sipDomainPattern');
    }
    return null;
  });

  protected readonly registrarServerError = computed(() => {
    this.i18n();
    const server = this.serverFieldErrors()['registrarServer'];
    if (server) return server;
    if (!this.submitted() && !this.touched()['registrarServer']) return null;
    const trimmed = this.registrarServerDraft().trim();
    if (trimmed && !SIP_URI_PATTERN.test(trimmed)) {
      return this.transloco.translate('wsPhone.validation.sipUriPattern');
    }
    return null;
  });

  protected readonly outboundProxyError = computed(() => {
    this.i18n();
    const server = this.serverFieldErrors()['outboundProxy'];
    if (server) return server;
    if (!this.submitted() && !this.touched()['outboundProxy']) return null;
    const trimmed = this.outboundProxyDraft().trim();
    if (trimmed && !SIP_URI_PATTERN.test(trimmed)) {
      return this.transloco.translate('wsPhone.validation.sipUriPattern');
    }
    return null;
  });

  protected readonly contactUriError = computed(() => {
    this.i18n();
    const server = this.serverFieldErrors()['contactUri'];
    if (server) return server;
    if (!this.submitted() && !this.touched()['contactUri']) return null;
    const trimmed = this.contactUriDraft().trim();
    if (trimmed && /\s/.test(trimmed)) {
      return this.transloco.translate('wsPhone.validation.contactUriPattern');
    }
    return null;
  });

  protected readonly defaultCallerIdError = computed(() => {
    this.i18n();
    const server = this.serverFieldErrors()['defaultCallerId'];
    if (server) return server;
    if (!this.submitted() && !this.touched()['defaultCallerId']) return null;
    const trimmed = this.defaultCallerIdDraft().trim();
    if (trimmed && !CALLER_ID_PATTERN.test(trimmed)) {
      return this.transloco.translate('wsPhone.validation.callerIdPattern');
    }
    return null;
  });

  protected readonly registerExpiresError = computed(() => {
    this.i18n();
    const server = this.serverFieldErrors()['registerExpires'];
    if (server) return server;
    if (!this.submitted() && !this.touched()['registerExpires']) return null;
    const parsed = parseRequiredInt(this.registerExpiresDraft());
    if (!Number.isInteger(parsed) || parsed < REGISTER_EXPIRES_MIN || parsed > REGISTER_EXPIRES_MAX) {
      return this.transloco.translate('wsPhone.validation.registerExpiresRange');
    }
    return null;
  });

  protected readonly defaultTimeoutError = computed(() => {
    this.i18n();
    const server = this.serverFieldErrors()['defaultTimeoutSeconds'];
    if (server) return server;
    if (!this.submitted() && !this.touched()['defaultTimeoutSeconds']) return null;
    const parsed = parseOptionalInt(this.defaultTimeoutDraft());
    if (parsed !== null && (!Number.isInteger(parsed) || parsed < TIMEOUT_SECONDS_MIN || parsed > TIMEOUT_SECONDS_MAX)) {
      return this.transloco.translate('wsPhone.validation.timeoutRange');
    }
    return null;
  });

  protected readonly defaultMaxRetriesError = computed(() => {
    this.i18n();
    const server = this.serverFieldErrors()['defaultMaxRetries'];
    if (server) return server;
    if (!this.submitted() && !this.touched()['defaultMaxRetries']) return null;
    const parsed = parseOptionalInt(this.defaultMaxRetriesDraft());
    if (parsed !== null && (!Number.isInteger(parsed) || parsed < MAX_RETRIES_MIN || parsed > MAX_RETRIES_MAX)) {
      return this.transloco.translate('wsPhone.validation.retriesRange');
    }
    return null;
  });

  protected readonly iceTransportError = computed(() => {
    this.i18n();
    if (this.relayServerError()) {
      return this.transloco.translate('wsPhone.validation.relayWithoutTurn');
    }
    if (!this.submitted() && !this.touched()['iceTransportPolicy']) return null;
    if (
      this.iceTransportPolicyDraft() === 'relay' &&
      (!this.iceEnabledDraft() || !hasEnabledTurn(this.iceEntries()))
    ) {
      return this.transloco.translate('wsPhone.validation.relayWithoutTurn');
    }
    return null;
  });

  protected readonly iceRowErrorsMap = computed<Record<string, IceEntryValidationErrors>>(() => {
    this.i18n();
    const result: Record<string, IceEntryValidationErrors> = {};
    const serverMap = this.iceServerErrors();
    const submitted = this.submitted();
    const touchedSet = this.iceTouchedUids();

    for (const draft of this.iceEntries()) {
      const serverErr = serverMap[draft.uid];
      const showClient = submitted || touchedSet.has(draft.uid);
      const rowErr: IceEntryValidationErrors = { ...serverErr };

      if (showClient) {
        const urls = parseIceUrls(draft.urlsText);
        if (!rowErr.urls) {
          if (urls.length === 0) {
            rowErr.urls = this.transloco.translate('wsPhone.validation.iceUrlsRequired');
          } else if (urls.some((u) => !ICE_URL_PATTERN.test(u))) {
            rowErr.urls = this.transloco.translate('wsPhone.validation.iceUrlsPattern');
          }
        }

        if (draft.kind === 'TURN') {
          const hasUser = draft.username.trim().length > 0;
          const willHaveCred =
            draft.credentialAction === 'set'
              ? draft.credentialValue.trim().length > 0
              : draft.credentialAction === 'keep' && draft.credentialConfigured;

          if (!rowErr.username && willHaveCred && !hasUser) {
            rowErr.username = this.transloco.translate('wsPhone.validation.turnUsernameRequired');
          }
          if (!rowErr.credential && hasUser && !willHaveCred) {
            rowErr.credential = this.transloco.translate('wsPhone.validation.turnCredentialRequired');
          }
        } else {
          const hasStunAuth =
            draft.username.trim().length > 0 ||
            draft.credentialValue.trim().length > 0 ||
            draft.credentialConfigured;
          if (!rowErr.entry && hasStunAuth) {
            rowErr.entry = this.transloco.translate('wsPhone.validation.stunNoAuth');
          }
        }
      }

      result[draft.uid] = rowErr;
    }
    return result;
  });

  protected readonly dirty = computed(() => {
    const base = this.baselineServer();
    if (!base || this.isReadonly()) return false;

    const regExp = parseRequiredInt(this.registerExpiresDraft());
    const timeoutVal = parseOptionalInt(this.defaultTimeoutDraft());
    const retriesVal = parseOptionalInt(this.defaultMaxRetriesDraft());

    return (
      this.nameDraft().trim() !== base.name ||
      this.websocketUrlDraft().trim() !== base.websocketUrl ||
      this.sipDomainDraft().trim() !== base.sipDomain ||
      this.enabledDraft() !== base.enabled ||
      normalizeNullableText(this.realmDraft()) !== base.realm ||
      normalizeNullableText(this.fromDomainDraft()) !== base.fromDomain ||
      normalizeNullableText(this.registrarServerDraft()) !== base.registrarServer ||
      normalizeNullableText(this.outboundProxyDraft()) !== base.outboundProxy ||
      normalizeNullableText(this.contactUriDraft()) !== base.contactUri ||
      normalizeNullableText(this.defaultCallerIdDraft()) !== base.defaultCallerId ||
      (Number.isNaN(regExp) ? true : regExp !== base.registerExpires) ||
      this.sessionTimersDraft() !== base.sessionTimers ||
      (Number.isNaN(timeoutVal) ? true : timeoutVal !== base.defaultTimeoutSeconds) ||
      (Number.isNaN(retriesVal) ? true : retriesVal !== base.defaultMaxRetries) ||
      this.traceSipDraft() !== base.traceSip ||
      this.allowInvalidTlsDraft() !== base.allowInvalidTlsCertificate ||
      this.iceTransportPolicyDraft() !== base.iceTransportPolicy ||
      !iceEntriesEqual(this.iceEntries(), base.iceServers)
    );
  });

  open(server: PhoneServer): void {
    this.allowClose = false;
    this.opKeys.clear();
    this.baselineServer.set(structuredClone(server));
    this.applyServerToDraft(server);
    this.activeTab.set('connection');
    this.modal().open();
  }

  close(): void {
    this.allowClose = true;
    this.modal().close();
  }

  editingId(): string | null {
    return this.baselineServer()?.id ?? null;
  }

  protected selectTab(tab: ServerModalTab): void {
    this.activeTab.set(tab);
  }

  protected onTabKeydown(event: KeyboardEvent, index: number): void {
    const rtl = this.language() === 'ar';
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') {
      nextIndex = rtl ? (index - 1 + TABS.length) % TABS.length : (index + 1) % TABS.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = rtl ? (index + 1) % TABS.length : (index - 1 + TABS.length) % TABS.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = TABS.length - 1;
    }
    if (nextIndex === null) return;
    event.preventDefault();
    const target = TABS[nextIndex];
    if (!target) return;
    this.activeTab.set(target.id);
    this.tabButtons()[nextIndex]?.nativeElement.focus();
  }

  protected markTouched(field: string): void {
    this.touched.update((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  }

  protected onTextInput(field: StringDraftField, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    switch (field) {
      case 'realm':
        this.realmDraft.set(value);
        break;
      case 'fromDomain':
        this.fromDomainDraft.set(value);
        break;
      case 'registrarServer':
        this.registrarServerDraft.set(value);
        break;
      case 'outboundProxy':
        this.outboundProxyDraft.set(value);
        break;
      case 'contactUri':
        this.contactUriDraft.set(value);
        break;
      case 'defaultCallerId':
        this.defaultCallerIdDraft.set(value);
        break;
      case 'registerExpires':
        this.registerExpiresDraft.set(value);
        break;
      case 'defaultTimeoutSeconds':
        this.defaultTimeoutDraft.set(value);
        break;
      case 'defaultMaxRetries':
        this.defaultMaxRetriesDraft.set(value);
        break;
    }
    this.clearServerFieldError(field);
  }

  protected onNameInput(event: Event): void {
    this.nameDraft.set((event.target as HTMLInputElement).value);
    this.clearServerFieldError('name');
  }

  protected onProtocolChange(value: string | null): void {
    if (this.isReadonly() || this.saving()) return;
    if (value !== 'wss' && value !== 'ws') return;
    this.websocketUrlDraft.set(rewriteUrlScheme(this.websocketUrlDraft(), value));
    this.clearServerFieldError('websocketUrl');
  }

  protected onWebsocketUrlInput(event: Event): void {
    this.websocketUrlDraft.set((event.target as HTMLInputElement).value);
    this.clearServerFieldError('websocketUrl');
  }

  protected onSipDomainInput(event: Event): void {
    this.sipDomainDraft.set((event.target as HTMLInputElement).value);
    this.clearServerFieldError('sipDomain');
  }

  protected onCallerIdPaste(event: ClipboardEvent): void {
    if (this.isReadonly() || this.saving()) return;
    const pasted = event.clipboardData?.getData('text');
    if (!pasted) return;
    const cleaned = pasted.replace(/[\s-]+/g, '');
    if (cleaned === pasted) return;
    event.preventDefault();
    const inputEl = event.target as HTMLInputElement;
    const start = inputEl.selectionStart ?? inputEl.value.length;
    const end = inputEl.selectionEnd ?? inputEl.value.length;
    const next = inputEl.value.slice(0, start) + cleaned + inputEl.value.slice(end);
    this.defaultCallerIdDraft.set(next);
    queueMicrotask(() => {
      const pos = start + cleaned.length;
      inputEl.setSelectionRange(pos, pos);
    });
  }

  protected async onIceEnabledToggle(next: boolean): Promise<void> {
    const base = this.baselineServer();
    if (!base || this.isReadonly() || this.saving() || this.togglingIceEnabled()) return;
    if (next === base.iceEnabled) return;

    const prev = base.iceEnabled;
    this.relayServerError.set(false);
    this.iceEnabledDraft.set(next);
    if (!next && this.iceTransportPolicyDraft() === 'relay') {
      this.markTouched('iceTransportPolicy');
    }
    this.togglingIceEnabled.set(true);

    try {
      const key = newIdempotencyKey();
      const updated = await updatePhoneServer(base.id, { iceEnabled: next }, key);
      this.baselineServer.update((current) => (current ? { ...current, iceEnabled: updated.iceEnabled } : current));
      this.iceEnabledDraft.set(updated.iceEnabled);
      this.notify.success(
        this.transloco.translate(updated.iceEnabled ? 'wsPhone.toasts.iceEnabled' : 'wsPhone.toasts.iceDisabled'),
      );
      this.serverPatched.emit(updated);
    } catch (error) {
      this.iceEnabledDraft.set(prev);
      const code = errorCodeOf(error);
      if (code === 'WEBPHONE_RELAY_WITHOUT_TURN') {
        this.relayServerError.set(true);
      } else if (code === 'WEBPHONE_SERVER_NOT_FOUND') {
        this.notify.error(this.resolveError(error));
        this.deletedRemotely.emit(base.id);
        this.close();
      } else {
        this.notify.error(this.resolveError(error));
      }
    } finally {
      this.togglingIceEnabled.set(false);
    }
  }

  protected onIceTransportPolicyChange(value: string | null): void {
    if (this.isReadonly() || this.saving()) return;
    if (value !== 'all' && value !== 'relay') return;
    this.iceTransportPolicyDraft.set(value);
    this.relayServerError.set(false);
    this.markTouched('iceTransportPolicy');
  }

  protected addIceEntry(): void {
    if (this.isReadonly() || this.saving()) return;
    this.iceEntries.update((list) => [...list, emptyIceDraft()]);
    this.relayServerError.set(false);
  }

  protected updateIceEntry(index: number, next: IceEntryDraft): void {
    this.iceEntries.update((list) => list.map((item, i) => (i === index ? next : item)));
    this.relayServerError.set(false);
    this.iceServerErrors.update((prev) => {
      if (!prev[next.uid]) return prev;
      const copy = { ...prev };
      delete copy[next.uid];
      return copy;
    });
  }

  protected removeIceEntry(index: number): void {
    if (this.isReadonly() || this.saving()) return;
    const target = this.iceEntries()[index];
    this.iceEntries.update((list) => list.filter((_, i) => i !== index));
    this.relayServerError.set(false);
    if (target) {
      this.iceServerErrors.update((prev) => {
        if (!prev[target.uid]) return prev;
        const copy = { ...prev };
        delete copy[target.uid];
        return copy;
      });
    }
  }

  protected markIceRowTouched(uid: string): void {
    this.iceTouchedUids.update((prev) => {
      if (prev.has(uid)) return prev;
      const next = new Set(prev);
      next.add(uid);
      return next;
    });
  }

  protected undo(): void {
    const base = this.baselineServer();
    if (!base) return;
    this.opKeys.clear();
    this.applyServerToDraft(base);
  }

  protected requestDelete(): void {
    const base = this.baselineServer();
    if (!base || this.isReadonly() || this.saving()) return;
    this.deleteRequested.emit(base);
  }

  protected requestClose(): void {
    if (this.saving()) return;
    if (this.dirty()) {
      void this.confirmDiscardAndClose();
      return;
    }
    this.close();
  }

  protected onModalClosed(): void {
    if (!this.allowClose && this.saving()) {
      this.modal().open();
      return;
    }
    if (!this.allowClose && this.dirty()) {
      this.modal().open();
      void this.confirmDiscardAndClose();
      return;
    }
    this.allowClose = false;
    this.baselineServer.set(null);
    this.opKeys.clear();
  }

  protected async reloadFromConflict(): Promise<void> {
    const base = this.baselineServer();
    if (!base || this.conflictBusy()) return;
    this.conflictBusy.set(true);
    try {
      const list = await listPhoneServers();
      const fresh = list.find((s) => s.id === base.id);
      if (!fresh) {
        this.conflictModal().close();
        this.notify.error(this.transloco.translate('wsPhone.errors.WEBPHONE_SERVER_NOT_FOUND'));
        this.deletedRemotely.emit(base.id);
        this.close();
        return;
      }
      this.baselineServer.set(structuredClone(fresh));
      this.applyServerToDraft(fresh);
      this.opKeys.clear();
      this.conflictModal().close();
      this.serverPatched.emit(fresh);
    } catch (error) {
      this.notify.error(this.resolveError(error));
    } finally {
      this.conflictBusy.set(false);
    }
  }

  protected keepMyChangesAfterConflict(): void {
    if (this.conflictBusy()) return;
    this.opKeys.clear();
    this.conflictModal().close();
  }

  protected async save(event?: Event): Promise<void> {
    event?.preventDefault();
    const base = this.baselineServer();
    if (!base || this.isReadonly() || this.saving() || !this.dirty()) return;

    this.submitted.set(true);
    this.serverFieldErrors.set({});
    this.iceServerErrors.set({});
    this.relayServerError.set(false);

    const firstInvalidTab = this.findFirstInvalidTab();
    if (firstInvalidTab) {
      this.activeTab.set(firstInvalidTab);
      return;
    }

    const serverPatch = this.buildServerPatch(base);
    const { created, updated, deletedIds } = this.diffIceEntries(base.iceServers);

    this.saving.set(true);
    try {
      const switchingToAll = serverPatch.iceTransportPolicy === 'all' && base.iceTransportPolicy === 'relay';

      if (switchingToAll && Object.keys(serverPatch).length > 0) {
        const patched = await updatePhoneServer(
          base.id,
          serverPatch,
          this.keyFor('patch-server', { id: base.id, serverPatch }),
        );
        this.mergeServerScalarBaseline(patched);
      }

      // Create new ICE entries and apply updates that enable or switch to TURN before enforcing relay / deleting old entries
      const enableFirst = updated.filter((item) => item.draft.enabled || item.patch.kind === 'TURN');
      const restUpdates = updated.filter((item) => !enableFirst.includes(item));

      for (const draft of created) {
        this.savingIceUid = draft.uid;
        const body = this.toCreateIceBody(draft);
        const createdIce = await createIceServer(
          base.id,
          body,
          this.keyFor(`create-ice:${draft.uid}`, body),
        );
        this.recordCreatedIceBaseline(draft.uid, createdIce);
      }

      for (const item of enableFirst) {
        this.savingIceUid = item.draft.uid;
        const savedIce = await updateIceServer(
          base.id,
          item.id,
          item.patch,
          this.keyFor(`update-ice:${item.id}`, item.patch),
        );
        this.recordUpdatedIceBaseline(item.draft.uid, savedIce);
      }
      this.savingIceUid = null;

      if (!switchingToAll && Object.keys(serverPatch).length > 0) {
        const patched = await updatePhoneServer(
          base.id,
          serverPatch,
          this.keyFor('patch-server', { id: base.id, serverPatch }),
        );
        this.mergeServerScalarBaseline(patched);
      }

      for (const item of restUpdates) {
        this.savingIceUid = item.draft.uid;
        const savedIce = await updateIceServer(
          base.id,
          item.id,
          item.patch,
          this.keyFor(`update-ice:${item.id}`, item.patch),
        );
        this.recordUpdatedIceBaseline(item.draft.uid, savedIce);
      }

      this.savingIceUid = null;

      for (const iceId of deletedIds) {
        await deleteIceServer(base.id, iceId, this.keyFor(`delete-ice:${iceId}`, { iceId }));
        this.recordDeletedIceBaseline(iceId);
      }

      const freshList = await listPhoneServers();
      const fresh = freshList.find((s) => s.id === base.id) ?? this.baselineServer()!;
      this.opKeys.clear();
      this.notify.success(this.transloco.translate('wsPhone.toasts.saved'));
      this.saved.emit(fresh);
      this.close();
    } catch (error) {
      this.handleSaveError(error, base.id);
    } finally {
      this.savingIceUid = null;
      this.saving.set(false);
    }
  }

  private findFirstInvalidTab(): ServerModalTab | null {
    if (this.nameError() || this.websocketUrlError() || this.sipDomainError()) {
      return 'connection';
    }
    if (
      this.registrarServerError() ||
      this.outboundProxyError() ||
      this.contactUriError() ||
      this.defaultCallerIdError() ||
      this.registerExpiresError() ||
      this.defaultTimeoutError() ||
      this.defaultMaxRetriesError()
    ) {
      return 'advanced';
    }
    if (this.iceTransportError()) {
      return 'ice';
    }
    const rowMap = this.iceRowErrorsMap();
    for (const draft of this.iceEntries()) {
      const err = rowMap[draft.uid];
      if (err && (err.urls || err.username || err.credential || err.entry)) {
        return 'ice';
      }
    }
    return null;
  }

  private buildServerPatch(base: PhoneServer): UpdatePhoneServerPatch {
    const patch: UpdatePhoneServerPatch = {};
    const name = this.nameDraft().trim();
    const websocketUrl = this.websocketUrlDraft().trim();
    const sipDomain = this.sipDomainDraft().trim();
    const enabled = this.enabledDraft();
    const realm = normalizeNullableText(this.realmDraft());
    const fromDomain = normalizeNullableText(this.fromDomainDraft());
    const registrarServer = normalizeNullableText(this.registrarServerDraft());
    const outboundProxy = normalizeNullableText(this.outboundProxyDraft());
    const contactUri = normalizeNullableText(this.contactUriDraft());
    const defaultCallerId = normalizeNullableText(this.defaultCallerIdDraft());
    const registerExpires = parseRequiredInt(this.registerExpiresDraft());
    const sessionTimers = this.sessionTimersDraft();
    const defaultTimeoutSeconds = parseOptionalInt(this.defaultTimeoutDraft());
    const defaultMaxRetries = parseOptionalInt(this.defaultMaxRetriesDraft());
    const iceTransportPolicy = this.iceTransportPolicyDraft();
    const traceSip = this.traceSipDraft();
    const allowInvalidTlsCertificate = this.allowInvalidTlsDraft();

    if (name !== base.name) patch.name = name;
    if (websocketUrl !== base.websocketUrl) patch.websocketUrl = websocketUrl;
    if (sipDomain !== base.sipDomain) patch.sipDomain = sipDomain;
    if (enabled !== base.enabled) patch.enabled = enabled;
    if (realm !== base.realm) patch.realm = realm;
    if (fromDomain !== base.fromDomain) patch.fromDomain = fromDomain;
    if (registrarServer !== base.registrarServer) patch.registrarServer = registrarServer;
    if (outboundProxy !== base.outboundProxy) patch.outboundProxy = outboundProxy;
    if (contactUri !== base.contactUri) patch.contactUri = contactUri;
    if (defaultCallerId !== base.defaultCallerId) patch.defaultCallerId = defaultCallerId;
    if (registerExpires !== base.registerExpires) patch.registerExpires = registerExpires;
    if (sessionTimers !== base.sessionTimers) patch.sessionTimers = sessionTimers;
    if (defaultTimeoutSeconds !== base.defaultTimeoutSeconds) patch.defaultTimeoutSeconds = defaultTimeoutSeconds;
    if (defaultMaxRetries !== base.defaultMaxRetries) patch.defaultMaxRetries = defaultMaxRetries;
    if (iceTransportPolicy !== base.iceTransportPolicy) patch.iceTransportPolicy = iceTransportPolicy;
    if (traceSip !== base.traceSip) patch.traceSip = traceSip;
    if (allowInvalidTlsCertificate !== base.allowInvalidTlsCertificate) {
      patch.allowInvalidTlsCertificate = allowInvalidTlsCertificate;
    }

    return patch;
  }

  private diffIceEntries(baseEntries: readonly IceEntry[]): {
    created: IceEntryDraft[];
    updated: { id: string; draft: IceEntryDraft; patch: UpdateIceEntryPatch }[];
    deletedIds: string[];
  } {
    const baseById = new Map(baseEntries.map((item) => [item.id, item]));
    const keptIds = new Set<string>();
    const created: IceEntryDraft[] = [];
    const updated: { id: string; draft: IceEntryDraft; patch: UpdateIceEntryPatch }[] = [];

    for (const draft of this.iceEntries()) {
      if (!draft.id) {
        created.push(draft);
        continue;
      }
      keptIds.add(draft.id);
      const original = baseById.get(draft.id);
      if (!original) continue;

      const patch: UpdateIceEntryPatch = {};
      const urls = parseIceUrls(draft.urlsText);
      if (draft.kind !== original.kind) patch.kind = draft.kind;
      if (urls.length !== original.urls.length || urls.some((u, i) => u !== original.urls[i])) {
        patch.urls = urls;
      }
      if (draft.enabled !== original.enabled) patch.enabled = draft.enabled;

      if (draft.kind === 'TURN') {
        const nextUser = normalizeNullableText(draft.username);
        if (nextUser !== original.username) patch.username = nextUser;
        if (draft.credentialAction === 'clear' && original.credentialConfigured) {
          patch.credential = null;
        } else if (draft.credentialAction === 'set' && draft.credentialValue.trim().length > 0) {
          patch.credential = draft.credentialValue;
        }
      } else if (original.kind === 'TURN') {
        patch.username = null;
        patch.credential = null;
      }

      if (Object.keys(patch).length > 0) {
        updated.push({ id: draft.id, draft, patch });
      }
    }

    const deletedIds = baseEntries.filter((e) => !keptIds.has(e.id)).map((e) => e.id);
    return { created, updated, deletedIds };
  }

  private toCreateIceBody(draft: IceEntryDraft) {
    const urls = parseIceUrls(draft.urlsText);
    if (draft.kind === 'STUN') {
      return { kind: 'STUN' as const, urls, enabled: draft.enabled };
    }
    const username = normalizeNullableText(draft.username);
    const cred = draft.credentialValue.trim().length > 0 ? draft.credentialValue : undefined;
    return {
      kind: 'TURN' as const,
      urls,
      ...(username !== null ? { username } : {}),
      ...(cred !== undefined ? { credential: cred } : {}),
      enabled: draft.enabled,
    };
  }

  private mergeServerScalarBaseline(patched: PhoneServer): void {
    this.baselineServer.update((current) =>
      current
        ? {
            ...patched,
            iceServers: current.iceServers,
          }
        : patched,
    );
    this.serverPatched.emit(patched);
  }

  private recordCreatedIceBaseline(draftUid: string, created: IceEntry): void {
    this.iceEntries.update((list) =>
      list.map((item) =>
        item.uid === draftUid
          ? {
              ...item,
              id: created.id,
              credentialConfigured: created.credentialConfigured,
              credentialAction: 'keep',
              credentialValue: '',
            }
          : item,
      ),
    );
    this.baselineServer.update((current) =>
      current ? { ...current, iceServers: [...current.iceServers, created] } : current,
    );
  }

  private recordUpdatedIceBaseline(draftUid: string, saved: IceEntry): void {
    this.iceEntries.update((list) =>
      list.map((item) =>
        item.uid === draftUid
          ? {
              ...item,
              id: saved.id,
              kind: saved.kind,
              urlsText: saved.urls.join('\n'),
              username: saved.username ?? '',
              credentialConfigured: saved.credentialConfigured,
              credentialAction: 'keep',
              credentialValue: '',
              enabled: saved.enabled,
            }
          : item,
      ),
    );
    this.baselineServer.update((current) =>
      current
        ? {
            ...current,
            iceServers: current.iceServers.map((e) => (e.id === saved.id ? saved : e)),
          }
        : current,
    );
  }

  private recordDeletedIceBaseline(iceId: string): void {
    this.baselineServer.update((current) =>
      current
        ? {
            ...current,
            iceServers: current.iceServers.filter((e) => e.id !== iceId),
          }
        : current,
    );
  }

  private handleSaveError(error: unknown, serverId: string): void {
    const code = errorCodeOf(error);
    if (code === 'WEBPHONE_RELAY_WITHOUT_TURN') {
      this.relayServerError.set(true);
      this.activeTab.set('ice');
      return;
    }

    if (code === 'WEBPHONE_SERVER_NOT_FOUND') {
      this.notify.error(this.resolveError(error));
      this.deletedRemotely.emit(serverId);
      this.close();
      return;
    }

    if (code && IN_FLIGHT_CODES.has(code)) {
      this.notify.error(this.resolveError(error));
      return;
    }

    if (error instanceof ApiError && error.status === 409 && !(code && NOT_A_CONFLICT_CODES.has(code))) {
      this.conflictModal().open();
      return;
    }

    const fieldErrors = coreFieldErrors(error);
    if (fieldErrors) {
      this.applyFieldErrors(fieldErrors);
      return;
    }

    this.notify.error(this.resolveError(error));
  }

  /**
   * 400 CORE_VALIDATION_FAILED: server fields go to their tab; ICE fields (urls, username,
   * credential) go to the ICE row whose call failed. Anything else falls back to a toast.
   */
  private applyFieldErrors(errors: CoreFieldErrors): void {
    const fields = Object.keys(errors);
    const iceUid = this.savingIceUid;
    const iceFields = fields.filter((field): field is IceRowField => (ICE_ROW_FIELDS as readonly string[]).includes(field));
    if (iceUid && iceFields.length > 0) {
      const rowErrors: IceEntryValidationErrors = {};
      for (const field of iceFields) rowErrors[field] = this.iceFieldMessage(field);
      this.iceServerErrors.update((prev) => ({ ...prev, [iceUid]: { ...prev[iceUid], ...rowErrors } }));
      this.activeTab.set('ice');
      return;
    }
    const field = fields.find((name) => SERVER_FIELD_NAMES.has(name));
    if (field) {
      this.applyServerFieldValidation(field);
      return;
    }
    this.notify.error(this.transloco.translate('wsPhone.errors.generic'));
  }

  private iceFieldMessage(field: IceRowField): string {
    switch (field) {
      case 'urls':
        return this.transloco.translate('wsPhone.validation.iceUrlsPattern');
      case 'username':
        return this.transloco.translate('wsPhone.validation.turnUsernameRequired');
      case 'credential':
        return this.transloco.translate('wsPhone.validation.turnCredentialRequired');
    }
  }

  private applyServerFieldValidation(field: string): void {
    const fieldKeyMap: Readonly<Record<string, string>> = {
      name: 'wsPhone.validation.nameMax',
      websocketUrl: 'wsPhone.validation.websocketUrlPattern',
      sipDomain: 'wsPhone.validation.sipDomainPattern',
      registrarServer: 'wsPhone.validation.sipUriPattern',
      outboundProxy: 'wsPhone.validation.sipUriPattern',
      contactUri: 'wsPhone.validation.contactUriPattern',
      defaultCallerId: 'wsPhone.validation.callerIdPattern',
      registerExpires: 'wsPhone.validation.registerExpiresRange',
      defaultTimeoutSeconds: 'wsPhone.validation.timeoutRange',
      defaultMaxRetries: 'wsPhone.validation.retriesRange',
    };
    const connectionFields = new Set(['name', 'websocketUrl', 'sipDomain']);
    const advancedFields = new Set([
      'registrarServer',
      'outboundProxy',
      'contactUri',
      'defaultCallerId',
      'registerExpires',
      'defaultTimeoutSeconds',
      'defaultMaxRetries',
    ]);
    const msgKey = fieldKeyMap[field];
    const message = msgKey
      ? this.transloco.translate(msgKey, { max: PHONE_SERVER_NAME_MAX })
      : this.transloco.translate('wsPhone.errors.generic');

    if (connectionFields.has(field)) {
      this.serverFieldErrors.update((prev) => ({ ...prev, [field]: message }));
      this.activeTab.set('connection');
      return;
    }
    if (advancedFields.has(field)) {
      this.serverFieldErrors.update((prev) => ({ ...prev, [field]: message }));
      this.activeTab.set('advanced');
      return;
    }
    this.notify.error(this.transloco.translate('wsPhone.errors.generic'));
  }

  private applyServerToDraft(server: PhoneServer): void {
    this.nameDraft.set(server.name);
    this.websocketUrlDraft.set(server.websocketUrl);
    this.sipDomainDraft.set(server.sipDomain);
    this.enabledDraft.set(server.enabled);

    this.realmDraft.set(server.realm ?? '');
    this.fromDomainDraft.set(server.fromDomain ?? '');
    this.registrarServerDraft.set(server.registrarServer ?? '');
    this.outboundProxyDraft.set(server.outboundProxy ?? '');
    this.contactUriDraft.set(server.contactUri ?? '');
    this.defaultCallerIdDraft.set(server.defaultCallerId ?? '');
    this.registerExpiresDraft.set(String(server.registerExpires));
    this.sessionTimersDraft.set(server.sessionTimers);
    this.defaultTimeoutDraft.set(server.defaultTimeoutSeconds !== null ? String(server.defaultTimeoutSeconds) : '');
    this.defaultMaxRetriesDraft.set(server.defaultMaxRetries !== null ? String(server.defaultMaxRetries) : '');
    this.traceSipDraft.set(server.traceSip);
    this.allowInvalidTlsDraft.set(server.allowInvalidTlsCertificate);

    this.iceEnabledDraft.set(server.iceEnabled);
    this.iceTransportPolicyDraft.set(server.iceTransportPolicy);
    this.iceEntries.set(server.iceServers.map(toIceDraft));

    this.touched.set({});
    this.iceTouchedUids.set(new Set());
    this.submitted.set(false);
    this.serverFieldErrors.set({});
    this.iceServerErrors.set({});
    this.relayServerError.set(false);
  }

  private clearServerFieldError(field: string): void {
    if (!this.serverFieldErrors()[field]) return;
    this.serverFieldErrors.update((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  private keyFor(op: string, payload: unknown): string {
    const fingerprint = JSON.stringify(payload);
    const existing = this.opKeys.get(op);
    if (existing && existing.fingerprint === fingerprint) {
      return existing.key;
    }
    const key = newIdempotencyKey();
    this.opKeys.set(op, { fingerprint, key });
    return key;
  }

  private async confirmDiscardAndClose(): Promise<void> {
    if (this.confirmingDiscard) return;
    this.confirmingDiscard = true;
    try {
      if (await this.discardDialog().open()) {
        this.close();
      }
    } finally {
      this.confirmingDiscard = false;
    }
  }

  private resolveError(error: unknown): string {
    const code = errorCodeOf(error);
    if (code && IN_FLIGHT_CODES.has(code)) {
      return this.transloco.translate('wsPhone.errors.stillProcessing');
    }
    if (code) {
      const key = `wsPhone.errors.${code}`;
      const translated = this.transloco.translate(key);
      if (translated !== key) return translated;
    }
    return this.transloco.translate('wsPhone.errors.generic');
  }
}
