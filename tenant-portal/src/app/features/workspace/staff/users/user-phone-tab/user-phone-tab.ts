import { Component, ElementRef, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { provideTranslocoScopeInherited } from '../../../../../core/i18n/transloco-scope';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerChevronDown,
  tablerChevronUp,
  tablerClock,
  tablerExclamationCircle,
  tablerLock,
  tablerPhone,
  tablerPlus,
  tablerRefresh,
  tablerServer,
  tablerTrash,
} from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { PhoneState } from '../../../../../core/phone/phone';
import { Button } from '../../../../../shared/ui/button/button';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { rectInPage, viewport } from '../../../../../shared/ui/overlay/zoom';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { ApiError, errorCodeOf } from '../../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { StaffPhoneApi } from '../../shared/staff-phone.api';
import {
  CALLER_ID_PATTERN,
  EXTENSION_PATTERN,
  PhoneSeats,
  STAFF_PHONE_LIMITS,
  StaffPhoneExtension,
  StaffPhoneChainLink,
  StaffPhoneServer,
  UpdateStaffPhoneExtensionPatch,
} from '../../shared/staff-phone.model';
import { StaffSession } from '../../shared/staff-session';
import { TenantUser } from '../../shared/staff.model';
import { resolveStaffError, userFullName } from '../users-page/users.model';
import { PhonePassword } from './phone-password/phone-password';
import { PhoneSeatImpact } from './phone-seat-impact/phone-seat-impact';

type TabFullState = 'notPurchased' | 'provisioning' | 'noServers' | 'loadFailed' | null;

const SKELETON_ROWS = [0, 1, 2] as const;

@Component({
  selector: 'app-user-phone-tab',
  imports: [
    RouterLink,
    NgIcon,
    TranslocoPipe,
    Button,
    Dropdown,
    Field,
    Switch,
    PhonePassword,
    PhoneSeatImpact,
  ],
  // viewProviders: this tab projects <ng-content>; keep the scope off the parent's host and projected pipes.
  viewProviders: [
    provideTranslocoScopeInherited(
      'settings',
      { scope: 'staff', alias: 'staff' },
      { scope: 'staff-users', alias: 'users' },
      { scope: 'seats', alias: 'seats' },
      { scope: 'staff-user-phone', alias: 'userPhone' },
    ),
  ],
  providers: [
    provideIcons({
      tablerPhone,
      tablerLock,
      tablerServer,
      tablerClock,
      tablerRefresh,
      tablerChevronUp,
      tablerChevronDown,
      tablerTrash,
      tablerPlus,
      tablerAlertTriangle,
      tablerExclamationCircle,
    }),
  ],
  templateUrl: './user-phone-tab.html',
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class UserPhoneTab {
  private static nextId = 0;
  protected readonly uid = `user-phone-tab-${++UserPhoneTab.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly session = inject(StaffSession);
  private readonly api = inject(StaffPhoneApi);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly phoneState = inject(PhoneState, { optional: true });

  private readonly passwordControl = viewChild(PhonePassword);
  private readonly serversTooltipRef = viewChild<ElementRef<HTMLElement>>('serversTooltip');

  readonly user = input.required<TenantUser>();
  readonly closeRequested = output<void>();

  protected readonly limits = STAFF_PHONE_LIMITS;
  protected readonly skeletonRows = SKELETON_ROWS;

  protected readonly loading = signal(false);
  protected readonly fullState = signal<TabFullState>(null);
  private readonly savingState = signal(false);
  readonly saving = this.savingState.asReadonly();

  protected readonly extension = signal<StaffPhoneExtension | null>(null);
  protected readonly scopeServers = signal<StaffPhoneServer[]>([]);
  protected readonly savedChainIds = signal<string[]>([]);
  private readonly savedChain = signal<StaffPhoneChainLink[]>([]);
  protected readonly seats = signal<PhoneSeats | null>(null);
  protected readonly seatsLoading = signal(false);
  protected readonly seatsError = signal(false);
  protected readonly seatBlocking = signal(false);

  protected readonly enabledDraft = signal(false);
  protected readonly extensionDraft = signal('');
  protected readonly sipUsernameDraft = signal('');
  protected readonly sipUsernameEdited = signal(false);
  protected readonly passwordDraft = signal<string | null>(null);
  protected readonly displayNameDraft = signal('');
  protected readonly callerIdDraft = signal('');
  protected readonly chainDraft = signal<string[]>([]);
  protected readonly addServerSelection = signal('');

  protected readonly touched = signal<Record<string, boolean>>({});
  protected readonly submitAttempted = signal(false);
  protected readonly enableInteracted = signal(false);

  private readonly extensionServerError = signal<{ value: string; message: string } | null>(null);
  private readonly usernameServerError = signal<{ value: string; message: string } | null>(null);
  private readonly passwordServerError = signal<string | null>(null);

  protected readonly serversTipPlace = signal({ top: 0, start: 0 });
  protected readonly serversTipPlaced = signal(false);

  protected readonly isOwner = computed(() => this.session.isOwner());
  protected readonly isReadonly = computed(() => {
    this.session.me();
    return !this.session.isTenantWide('webphone.extensions.manage');
  });

  protected readonly userDisplayPlaceholder = computed(() => userFullName(this.user()));
  protected readonly passwordConfigured = computed(() => this.extension()?.passwordConfigured ?? false);

  private readonly defaultAllServerIds = computed(() =>
    [...this.scopeServers()].sort((a, b) => a.priority - b.priority).map((s) => s.id),
  );

  private readonly baselineChainIds = computed(() =>
    this.extension() ? this.savedChainIds() : this.defaultAllServerIds(),
  );

  protected readonly chainChanged = computed(() => !arraysEqual(this.chainDraft(), this.baselineChainIds()));

  protected readonly serverMap = computed(
    () => new Map(this.scopeServers().map((s) => [s.id, s])),
  );

  protected readonly chainServers = computed(() => {
    const map = this.serverMap();
    return this.chainDraft()
      .map((id) => map.get(id))
      .filter((s): s is StaffPhoneServer => Boolean(s));
  });

  protected readonly availableServers = computed(() => {
    const inChain = new Set(this.chainDraft());
    return [...this.scopeServers()]
      .sort((a, b) => a.priority - b.priority)
      .filter((s) => !inChain.has(s.id));
  });

  protected readonly addServerOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const rest = this.availableServers().map((s) => ({ value: s.id, label: s.name }));
    if (rest.length === 0) return [];
    return [
      { value: '', label: this.transloco.translate('userPhone.servers.add'), disabled: true },
      ...rest,
    ];
  });

  protected readonly statusTile = computed(() => {
    const ext = this.extension();
    if (!ext) return { icon: 'tablerPhone', tile: 'bg-icon-gray' };
    if (ext.enabled && ext.accessState === 'OVER_CAPACITY') {
      return { icon: 'tablerLock', tile: 'bg-icon-orange' };
    }
    if (ext.enabled) return { icon: 'tablerPhone', tile: 'bg-icon-green' };
    return { icon: 'tablerPhone', tile: 'bg-icon-gray' };
  });

  protected readonly statusLine = computed(() => {
    this.i18n();
    const ext = this.extension();
    if (!ext) return this.transloco.translate('userPhone.status.notSetUp');
    if (ext.enabled) return this.transloco.translate('userPhone.status.enabled', { ext: ext.extension });
    return this.transloco.translate('userPhone.status.disabled');
  });

  protected readonly isOverCapacity = computed(() => {
    const ext = this.extension();
    return Boolean(ext && ext.enabled && ext.accessState === 'OVER_CAPACITY');
  });

  protected readonly seatDelta = computed<-1 | 0 | 1>(() => {
    if (this.isReadonly() || this.loading() || this.fullState() !== null) return 0;
    const savedEnabled = this.extension()?.enabled ?? false;
    const draftEnabled = this.enabledDraft();
    if (!savedEnabled && draftEnabled) return 1;
    if (savedEnabled && !draftEnabled) return -1;
    return 0;
  });

  protected readonly extensionCount = computed(() => Array.from(this.extensionDraft()).length);
  protected readonly sipUsernameCount = computed(() => Array.from(this.sipUsernameDraft()).length);
  protected readonly displayNameCount = computed(() => Array.from(this.displayNameDraft()).length);
  protected readonly callerIdCount = computed(() => Array.from(this.callerIdDraft()).length);

  private readonly rawExtensionError = computed(() => {
    this.i18n();
    const trimmed = this.extensionDraft().trim();
    const server = this.extensionServerError();
    if (server && server.value === trimmed) return server.message;
    if (!trimmed) return this.transloco.translate('userPhone.validation.extensionRequired');
    if (Array.from(trimmed).length > STAFF_PHONE_LIMITS.extension) {
      return this.transloco.translate('userPhone.validation.maxLength', { max: STAFF_PHONE_LIMITS.extension });
    }
    if (!EXTENSION_PATTERN.test(trimmed)) {
      return this.transloco.translate('userPhone.validation.extensionPattern');
    }
    return null;
  });

  private readonly rawSipUsernameError = computed(() => {
    this.i18n();
    const trimmed = this.sipUsernameDraft().trim();
    const server = this.usernameServerError();
    if (server && server.value === trimmed) return server.message;
    if (!trimmed) return this.transloco.translate('userPhone.validation.sipUsernameRequired');
    if (Array.from(trimmed).length > STAFF_PHONE_LIMITS.sipUsername) {
      return this.transloco.translate('userPhone.validation.maxLength', { max: STAFF_PHONE_LIMITS.sipUsername });
    }
    return null;
  });

  private readonly rawPasswordError = computed(() => {
    this.i18n();
    const server = this.passwordServerError();
    if (server) return server;
    if (this.enabledDraft() && !this.passwordConfigured() && !(this.passwordDraft() ?? '').trim()) {
      return this.transloco.translate('userPhone.validation.passwordRequiredToEnable');
    }
    return null;
  });

  private readonly rawDisplayNameError = computed(() => {
    this.i18n();
    const trimmed = this.displayNameDraft().trim();
    if (Array.from(trimmed).length > STAFF_PHONE_LIMITS.displayName) {
      return this.transloco.translate('userPhone.validation.maxLength', { max: STAFF_PHONE_LIMITS.displayName });
    }
    return null;
  });

  private readonly rawCallerIdError = computed(() => {
    this.i18n();
    const trimmed = this.callerIdDraft().trim();
    if (!trimmed) return null;
    if (Array.from(trimmed).length > STAFF_PHONE_LIMITS.outboundCallerId) {
      return this.transloco.translate('userPhone.validation.maxLength', { max: STAFF_PHONE_LIMITS.outboundCallerId });
    }
    if (!CALLER_ID_PATTERN.test(trimmed)) {
      return this.transloco.translate('userPhone.validation.callerIdPattern');
    }
    return null;
  });

  protected readonly extensionError = computed(() => {
    const raw = this.rawExtensionError();
    if (!raw) return null;
    if (this.extensionServerError()?.value === this.extensionDraft().trim()) return raw;
    return this.touched()['extension'] || this.submitAttempted() ? raw : null;
  });

  protected readonly sipUsernameError = computed(() => {
    const raw = this.rawSipUsernameError();
    if (!raw) return null;
    if (this.usernameServerError()?.value === this.sipUsernameDraft().trim()) return raw;
    return this.touched()['sipUsername'] || this.submitAttempted() ? raw : null;
  });

  protected readonly passwordError = computed(() => {
    const raw = this.rawPasswordError();
    if (!raw) return null;
    if (this.passwordServerError()) return raw;
    return this.touched()['sipPassword'] || this.submitAttempted() || this.enableInteracted() ? raw : null;
  });

  protected readonly displayNameError = computed(() => {
    const raw = this.rawDisplayNameError();
    if (!raw) return null;
    return this.touched()['displayName'] || this.submitAttempted() ? raw : null;
  });

  protected readonly callerIdError = computed(() => {
    const raw = this.rawCallerIdError();
    if (!raw) return null;
    return this.touched()['outboundCallerId'] || this.submitAttempted() ? raw : null;
  });

  protected readonly hasInvalidFields = computed(() =>
    Boolean(
      this.rawExtensionError() ||
        this.rawSipUsernameError() ||
        this.rawPasswordError() ||
        this.rawDisplayNameError() ||
        this.rawCallerIdError(),
    ),
  );

  readonly dirty = computed(() => {
    if (this.isReadonly() || this.loading() || this.fullState() !== null) return false;
    const ext = this.extension();
    const typedPwd = (this.passwordDraft() ?? '').length > 0;
    const displayVal = this.displayNameDraft().trim() || null;
    const callerVal = this.callerIdDraft().trim() || null;

    if (!ext) {
      return (
        this.enabledDraft() !== false ||
        this.extensionDraft().trim() !== '' ||
        this.sipUsernameDraft().trim() !== '' ||
        typedPwd ||
        displayVal !== null ||
        callerVal !== null ||
        this.chainChanged()
      );
    }

    return (
      this.enabledDraft() !== ext.enabled ||
      this.extensionDraft().trim() !== ext.extension ||
      this.sipUsernameDraft().trim() !== ext.sipUsername ||
      typedPwd ||
      displayVal !== ext.displayName ||
      callerVal !== ext.outboundCallerId ||
      this.chainChanged()
    );
  });

  private loadSeq = 0;
  private lastExtIdemFingerprint: string | null = null;
  private lastExtIdemKey: string | null = null;
  private lastChainIdemFingerprint: string | null = null;
  private lastChainIdemKey: string | null = null;

  constructor() {
    effect(() => {
      const ownerId = this.user().id;
      untracked(() => void this.load(ownerId));
    });
  }

  protected reload(): void {
    void this.load(this.user().id);
  }

  protected markTouched(field: string): void {
    this.touched.update((current) => (current[field] ? current : { ...current, [field]: true }));
  }

  protected onEnableChange(next: boolean): void {
    this.enableInteracted.set(true);
    this.enabledDraft.set(next);
    if (!next) {
      this.passwordServerError.set(null);
    }
  }

  protected onExtensionInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.extensionDraft.set(val);
    if (!this.extension() && !this.sipUsernameEdited()) {
      this.sipUsernameDraft.set(val);
    }
    if (this.extensionServerError()?.value !== val.trim()) {
      this.extensionServerError.set(null);
    }
  }

  protected onSipUsernameInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.sipUsernameEdited.set(true);
    this.sipUsernameDraft.set(val);
    if (this.usernameServerError()?.value !== val.trim()) {
      this.usernameServerError.set(null);
    }
  }

  protected onPasswordChange(next: string | null): void {
    this.passwordDraft.set(next);
    if ((next ?? '').trim().length > 0) {
      this.passwordServerError.set(null);
    }
  }

  protected onDisplayNameInput(event: Event): void {
    this.displayNameDraft.set((event.target as HTMLInputElement).value);
  }

  protected onCallerIdInput(event: Event): void {
    this.callerIdDraft.set((event.target as HTMLInputElement).value);
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
    this.callerIdDraft.set(next);
    queueMicrotask(() => {
      const pos = start + cleaned.length;
      inputEl.setSelectionRange(pos, pos);
    });
  }

  protected moveServerUp(index: number): void {
    if (this.isReadonly() || this.saving() || index <= 0) return;
    this.chainDraft.update((list) => {
      const next = [...list];
      const item = next[index];
      next[index] = next[index - 1];
      next[index - 1] = item;
      return next;
    });
  }

  protected moveServerDown(index: number): void {
    if (this.isReadonly() || this.saving()) return;
    this.chainDraft.update((list) => {
      if (index < 0 || index >= list.length - 1) return list;
      const next = [...list];
      const item = next[index];
      next[index] = next[index + 1];
      next[index + 1] = item;
      return next;
    });
  }

  protected removeServer(serverId: string): void {
    if (this.isReadonly() || this.saving()) return;
    this.chainDraft.update((list) => list.filter((id) => id !== serverId));
  }

  protected onAddServer(serverId: string): void {
    if (this.isReadonly() || this.saving() || !serverId) return;
    this.chainDraft.update((list) => (list.includes(serverId) ? list : [...list, serverId]));
    this.addServerSelection.set('');
  }

  protected placeServersTooltip(triggerEl: HTMLElement): void {
    const rect = rectInPage(triggerEl);
    const tipEl = this.serversTooltipRef()?.nativeElement;
    const tip = tipEl ? rectInPage(tipEl) : { width: 280, height: 20 };
    const { width } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';

    let start = (rtl ? width - rect.left : rect.right) + 6;
    if (start + tip.width > width - 8) {
      const altStart = (rtl ? width - rect.right : rect.left) - 6 - tip.width;
      start = altStart >= 8 ? altStart : Math.max(8, width - 8 - tip.width);
    }

    const top = Math.max(8, rect.bottom - tip.height);
    this.serversTipPlace.set({ top, start });
    this.serversTipPlaced.set(true);
  }

  protected hideServersTooltip(): void {
    this.serversTipPlaced.set(false);
  }

  undo(): void {
    this.applyToForm(this.extension(), this.savedChainIds(), this.scopeServers());
  }

  async save(event?: Event): Promise<boolean> {
    event?.preventDefault();
    if (this.isReadonly() || this.saving() || this.loading() || this.fullState() !== null) return false;
    if (!this.dirty()) return true;

    this.submitAttempted.set(true);
    if (this.seatBlocking() || this.hasInvalidFields()) return false;

    const ownerId = this.user().id;
    const extVal = this.extensionDraft().trim();
    const usernameVal = this.sipUsernameDraft().trim();
    const pwdVal = this.passwordDraft() ?? '';
    const hasTypedPwd = pwdVal.trim().length > 0;
    const displayNameVal = this.displayNameDraft().trim() || null;
    const callerIdVal = this.callerIdDraft().trim() || null;
    const enabledVal = this.enabledDraft();
    const chainIds = [...this.chainDraft()];
    const needsChainPut = this.chainChanged();

    this.savingState.set(true);
    try {
      let currentExt = this.extension();

      if (!currentExt) {
        const body = {
          ownerId,
          extension: extVal,
          sipUsername: usernameVal,
          ...(hasTypedPwd ? { sipPassword: pwdVal } : {}),
          ...(displayNameVal !== null ? { displayName: displayNameVal } : {}),
          ...(callerIdVal !== null ? { outboundCallerId: callerIdVal } : {}),
          enabled: enabledVal,
        };
        const extKey = this.idempotencyKeyFor('ext', body);
        currentExt = await this.api.createExtension(body, extKey);
        this.clearExtIdempotency();
        this.extension.set(currentExt);
        this.savedChainIds.set(this.defaultAllServerIds());
        this.savedChain.set([]);
        this.passwordDraft.set(null);
        this.passwordControl()?.reset();
      } else {
        const patch: UpdateStaffPhoneExtensionPatch = {};
        if (extVal !== currentExt.extension) patch.extension = extVal;
        if (usernameVal !== currentExt.sipUsername) patch.sipUsername = usernameVal;
        if (hasTypedPwd) patch.sipPassword = pwdVal;
        if (displayNameVal !== currentExt.displayName) patch.displayName = displayNameVal;
        if (callerIdVal !== currentExt.outboundCallerId) patch.outboundCallerId = callerIdVal;
        if (enabledVal !== currentExt.enabled) patch.enabled = enabledVal;

        if (Object.keys(patch).length > 0) {
          const extKey = this.idempotencyKeyFor('ext', { id: currentExt.id, patch });
          currentExt = await this.api.updateExtension(currentExt.id, patch, extKey);
          this.clearExtIdempotency();
          this.extension.set(currentExt);
          this.passwordDraft.set(null);
          this.passwordControl()?.reset();
        }
      }

      if (needsChainPut) {
        const savedLinks = new Map(this.savedChain().map((link) => [link.serverId, link]));
        const serversBody = {
          servers: chainIds.map((serverId) => ({
            serverId,
            timeoutSeconds: savedLinks.get(serverId)?.timeoutSeconds ?? null,
            maxRetries: savedLinks.get(serverId)?.maxRetries ?? null,
          })),
        };
        const chainKey = this.idempotencyKeyFor('chain', { id: currentExt.id, serversBody });
        const savedChain = await this.api.putExtensionServers(currentExt.id, serversBody, chainKey);
        this.clearChainIdempotency();
        this.savedChain.set(savedChain);
        this.savedChainIds.set(
          [...savedChain].sort((a, b) => a.priority - b.priority).map((l) => l.serverId),
        );
      }

      await this.reloadAfterSave(ownerId);
      this.notify.success(this.transloco.translate('userPhone.toast.saved'));
      if (this.session.me()?.id === ownerId) {
        void this.phoneState?.reload();
      }
      return true;
    } catch (error) {
      this.handleSaveError(error, extVal, usernameVal, ownerId);
      return false;
    } finally {
      this.savingState.set(false);
    }
  }

  private async load(ownerId: string): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.fullState.set(null);
    this.seatsError.set(false);
    this.seatsLoading.set(true);
    this.clearExtIdempotency();
    this.clearChainIdempotency();

    try {
      const [servers, extResult, seatsResult] = await Promise.all([
        this.api.listPhoneServers(),
        this.api.getExtensionByOwner(ownerId).catch((error: unknown) => {
          if (errorCodeOf(error) === 'WEBPHONE_EXTENSION_NOT_FOUND') {
            return null;
          }
          throw error;
        }),
        this.api.getPhoneSeats()
          .then((value) => ({ ok: true as const, value }))
          .catch((error: unknown) => ({ ok: false as const, error })),
      ]);

      if (seq !== this.loadSeq) return;

      if (servers.length === 0) {
        this.scopeServers.set([]);
        this.extension.set(extResult);
        this.fullState.set('noServers');
        return;
      }

      let chainIds: string[] = [];
      let chain: StaffPhoneChainLink[] = [];
      if (extResult) {
        chain = await this.api.getExtensionServers(extResult.id);
        if (seq !== this.loadSeq) return;
        chainIds = [...chain].sort((a, b) => a.priority - b.priority).map((l) => l.serverId);
      }

      if (seatsResult.ok) {
        this.seats.set(seatsResult.value);
        this.seatsError.set(false);
      } else {
        this.seats.set(null);
        this.seatsError.set(true);
      }

      this.scopeServers.set(servers);
      this.extension.set(extResult);
      this.savedChainIds.set(chainIds);
      this.savedChain.set(chain);
      this.applyToForm(extResult, chainIds, servers);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      const code = errorCodeOf(error);
      if (code === 'WEBPHONE_MODULE_NOT_PURCHASED') {
        this.fullState.set('notPurchased');
      } else if (code === 'WEBPHONE_PROVISIONING_PENDING') {
        this.fullState.set('provisioning');
      } else {
        this.fullState.set('loadFailed');
      }
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
        this.seatsLoading.set(false);
      }
    }
  }

  private async reloadAfterSave(ownerId: string): Promise<void> {
    let refreshError: unknown = null;
    const [extResult, seatsResult] = await Promise.all([
      this.api.getExtensionByOwner(ownerId).catch((error: unknown) => {
        refreshError = error;
        return this.extension();
      }),
      this.api.getPhoneSeats()
        .then((value) => ({ ok: true as const, value }))
        .catch(() => ({ ok: false as const })),
    ]);

    if (extResult) {
      const chain = await this.api.getExtensionServers(extResult.id).catch((error: unknown) => {
        refreshError = error;
        return null;
      });
      const chainIds = chain
        ? [...chain].sort((a, b) => a.priority - b.priority).map((l) => l.serverId)
        : this.savedChainIds();
      if (chain) this.savedChain.set(chain);
      this.extension.set(extResult);
      this.savedChainIds.set(chainIds);
      this.applyToForm(extResult, chainIds, this.scopeServers());
    }

    if (seatsResult.ok) {
      this.seats.set(seatsResult.value);
      this.seatsError.set(false);
    } else {
      this.seatsError.set(true);
    }
    if (refreshError) this.notify.error(resolveStaffError(refreshError, this.transloco));
  }

  private async refreshSeats(): Promise<void> {
    this.seatsLoading.set(true);
    try {
      const updated = await this.api.getPhoneSeats();
      this.seats.set(updated);
      this.seatsError.set(false);
    } catch {
      this.seatsError.set(true);
    } finally {
      this.seatsLoading.set(false);
    }
  }

  private applyToForm(
    ext: StaffPhoneExtension | null,
    savedChain: readonly string[],
    servers: readonly StaffPhoneServer[],
  ): void {
    this.touched.set({});
    this.submitAttempted.set(false);
    this.enableInteracted.set(false);
    this.extensionServerError.set(null);
    this.usernameServerError.set(null);
    this.passwordServerError.set(null);
    this.addServerSelection.set('');
    this.clearExtIdempotency();
    this.clearChainIdempotency();

    this.passwordDraft.set(null);
    this.passwordControl()?.reset();

    if (ext) {
      this.enabledDraft.set(ext.enabled);
      this.extensionDraft.set(ext.extension);
      this.sipUsernameDraft.set(ext.sipUsername);
      this.sipUsernameEdited.set(true);
      this.displayNameDraft.set(ext.displayName ?? '');
      this.callerIdDraft.set(ext.outboundCallerId ?? '');
      this.chainDraft.set([...savedChain]);
    } else {
      const allIds = [...servers].sort((a, b) => a.priority - b.priority).map((s) => s.id);
      this.enabledDraft.set(false);
      this.extensionDraft.set('');
      this.sipUsernameDraft.set('');
      this.sipUsernameEdited.set(false);
      this.displayNameDraft.set('');
      this.callerIdDraft.set('');
      this.chainDraft.set(allIds);
    }
  }

  private handleSaveError(
    error: unknown,
    extVal: string,
    usernameVal: string,
    ownerId: string,
  ): void {
    const code = errorCodeOf(error);
    if (code === 'WEBPHONE_EXTENSION_TAKEN') {
      this.extensionServerError.set({
        value: extVal,
        message: this.transloco.translate('userPhone.validation.extensionTaken'),
      });
      return;
    }
    if (code === 'WEBPHONE_SIP_USERNAME_TAKEN') {
      this.usernameServerError.set({
        value: usernameVal,
        message: this.transloco.translate('userPhone.validation.sipUsernameTaken'),
      });
      return;
    }
    if (code === 'WEBPHONE_CONFIG_INCOMPLETE') {
      this.passwordServerError.set(
        this.transloco.translate('userPhone.validation.passwordRequiredToEnable'),
      );
      return;
    }
    if (code === 'WEBPHONE_SEAT_LIMIT_REACHED') {
      const details = error instanceof ApiError ? error.details : undefined;
      const allowed = Number(details?.['allowed']);
      const occupied = Number(details?.['occupied']);
      const free = Number.isFinite(allowed) && Number.isFinite(occupied) ? Math.max(0, allowed - occupied) : 0;
      this.notify.error(this.transloco.translate('userPhone.toast.seatLimitReached', { free }));
      void this.refreshSeats();
      return;
    }
    if (code === 'WEBPHONE_MODULE_INACTIVE') {
      this.notify.error(this.transloco.translate('userPhone.toast.moduleInactive'));
      return;
    }
    if (code === 'WEBPHONE_OWNER_HAS_EXTENSION') {
      this.notify.info(this.transloco.translate('userPhone.toast.ownerHasExtension'));
      void this.load(ownerId);
      return;
    }
    this.notify.error(resolveStaffError(error, this.transloco));
  }

  private idempotencyKeyFor(kind: 'ext' | 'chain', payload: unknown): string {
    const fingerprint = JSON.stringify(payload);
    if (kind === 'ext') {
      if (fingerprint !== this.lastExtIdemFingerprint || !this.lastExtIdemKey) {
        this.lastExtIdemFingerprint = fingerprint;
        this.lastExtIdemKey = newIdempotencyKey();
      }
      return this.lastExtIdemKey;
    }
    if (fingerprint !== this.lastChainIdemFingerprint || !this.lastChainIdemKey) {
      this.lastChainIdemFingerprint = fingerprint;
      this.lastChainIdemKey = newIdempotencyKey();
    }
    return this.lastChainIdemKey;
  }

  private clearExtIdempotency(): void {
    this.lastExtIdemFingerprint = null;
    this.lastExtIdemKey = null;
  }

  private clearChainIdempotency(): void {
    this.lastChainIdemFingerprint = null;
    this.lastChainIdemKey = null;
  }
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
