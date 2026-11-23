import { Component, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { fieldErrorsOf } from '../../../../../core/api/api-errors';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerCalculator,
  tablerCloudOff,
  tablerLock,
  tablerPlus,
  tablerShoppingCart,
  tablerTrash,
  tablerUsers,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { ApiError, errorCodeOf, newIdempotencyKey, staffErrorMessage } from '../../shared/staff.api';
import { StaffUserAccessApi } from '../user-access.api';
import { SeatPreviewApi } from '../../../seats/seats.api';
import { SeatAccessState, SeatHolder, SeatMode } from '../../../seats/seats.model';
import { StaffSession } from '../../shared/staff-session';
import { ModuleAssignment, TenantUser } from '../../shared/staff.model';

interface UserAppItem extends ModuleAssignment {
  accessState: SeatAccessState;
  source: 'ROLE' | 'MANUAL';
}

const MODULE_LOOK: Record<string, { icon: string; tile: string }> = {
  crm: { icon: 'tablerUsers', tile: 'bg-icon-blue' },
  trade: { icon: 'tablerShoppingCart', tile: 'bg-icon-orange' },
  accounting: { icon: 'tablerCalculator', tile: 'bg-icon-green' },
};

const DEFAULT_LOOK = { icon: 'tablerUsers', tile: 'bg-icon-gray' };
const SKELETON_ROWS = [0, 1] as const;

@Component({
  selector: 'app-user-apps-tab',
  imports: [RouterLink, TranslocoPipe, NgIcon, Button, ConfirmDialog, Dropdown, Field, Modal],
  viewProviders: [
    provideTranslocoScope(
      'staff',
      'settings',
      { scope: 'staff-user-access', alias: 'access' },
      { scope: 'seats', alias: 'seats' },
    ),
  ],
  providers: [
    provideIcons({
      tablerLock,
      tablerUsers,
      tablerShoppingCart,
      tablerCalculator,
      tablerTrash,
      tablerPlus,
      tablerAlertTriangle,
      tablerCloudOff,
    }),
  ],
  templateUrl: './user-apps-tab.html',
  host: { class: 'flex flex-col gap-12' },
})
export class UserAppsTab {
  private static nextId = 0;
  protected readonly uid = `user-apps-tab-${++UserAppsTab.nextId}`;

  private readonly session = inject(StaffSession);
  private readonly api = inject(StaffUserAccessApi);
  private readonly seatsApi = inject(SeatPreviewApi);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;

  private readonly removeAppConfirm = viewChild.required<ConfirmDialog>('removeAppConfirm');
  private readonly addonsModal = viewChild.required<Modal>('addonsModal');

  readonly user = input.required<TenantUser>();
  readonly readonly = input(false);
  readonly readonlyReason = input<string | null>(null);
  readonly changed = output<void>();

  protected readonly validationErrors = signal<Record<string, string[]>>({});
  protected fieldError(field: string): string | null {
    const messages = Object.entries(this.validationErrors())
      .filter(([path]) => path === field || path.startsWith(field + '.'))
      .flatMap(([, messages]) => messages);
    return messages.length ? messages.join(' ') : null;
  }

  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly seatMode = signal<SeatMode>('MANUAL');
  protected readonly subscribedModules = signal<string[]>([]);
  protected readonly assignments = signal<UserAppItem[]>([]);
  protected readonly selectedModule = signal('');
  protected readonly assigning = signal(false);
  protected readonly removingModuleKey = signal<string | null>(null);
  protected readonly pendingRemove = signal<UserAppItem | null>(null);

  protected readonly isSelf = computed(() => this.session.me()?.id === this.user().id);
  protected readonly isDerivedMode = computed(() => this.seatMode() === 'DERIVED');
  protected readonly effectiveReadonly = computed(
    () => this.isDerivedMode() || this.readonly() || this.isSelf() || this.user().isTenantOwner ||
      this.loading() || this.loadFailed() || !this.session.can('users.user.manage_modules', this.user()),
  );
  protected readonly effectiveReadonlyReason = computed(() => {
    this.i18n();
    if (this.isDerivedMode()) return this.transloco.translate('access.apps.fromRoles');
    const external = this.readonlyReason();
    if (external) return external;
    if (this.isSelf()) return this.transloco.translate('access.apps.selfReadonly');
    if (this.user().isTenantOwner) return this.transloco.translate('staff.protected.owner');
    if (!this.session.can('users.user.manage_modules', this.user())) return this.transloco.translate('staff.protected.scope');
    return null;
  });

  protected readonly availableModules = computed(() => {
    const assigned = new Set(this.assignments().map((item) => item.moduleKey));
    return this.subscribedModules().filter((key) => !assigned.has(key));
  });

  protected readonly availableModuleOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    return this.availableModules().map((key) => ({
      value: key,
      label: this.moduleLabel(key),
    }));
  });

  protected readonly gridColumns = computed(() => {
    if (this.isDerivedMode()) {
      return 'grid-cols-staff-user-app-derived-row';
    }
    return this.effectiveReadonly()
      ? 'grid-cols-staff-user-app-row'
      : 'grid-cols-staff-user-app-row-actions';
  });

  protected readonly pendingRemoveName = computed(() => {
    const row = this.pendingRemove();
    return row ? this.moduleLabel(row.moduleKey) : '';
  });

  private loadSeq = 0;
  private actionUserId: string | null = null;
  private assignKeyCache: { moduleKey: string; key: string } | null = null;
  private removeKeyCache: { moduleKey: string; key: string } | null = null;

  constructor() {
    effect(() => {
      const userId = this.user().id;
      if (this.actionUserId !== userId) {
        this.actionUserId = userId;
        this.assignKeyCache = null;
        this.removeKeyCache = null;
        this.validationErrors.set({});
      }
      if (!this.session.me()) {
        void this.session.load();
      }
      void this.load(userId);
    });

    effect(() => {
      const available = this.availableModules();
      const current = this.selectedModule();
      if (!available.length) {
        if (current) this.selectedModule.set('');
      } else if (!available.includes(current)) {
        this.selectedModule.set(available[0]);
      }
    });
  }

  protected reload(): void {
    void this.load(this.user().id);
  }

  protected lookFor(moduleKey: string): { icon: string; tile: string } {
    return MODULE_LOOK[moduleKey] ?? DEFAULT_LOOK;
  }

  protected moduleLabel(moduleKey: string): string {
    const key = `access.apps.module.${moduleKey}`;
    const translated = this.transloco.translate(key);
    return translated !== key ? translated : moduleKey;
  }

  protected formatDate(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return new Intl.DateTimeFormat(`${this.language()}-u-nu-latn`, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  protected async assign(): Promise<void> {
    if (this.effectiveReadonly() || this.assigning()) return;
    const moduleKey = this.selectedModule();
    if (!moduleKey) return;

    const key =
      this.assignKeyCache?.moduleKey === moduleKey
        ? this.assignKeyCache.key
        : newIdempotencyKey();
    this.assignKeyCache = { moduleKey, key };

    this.validationErrors.set({});
    this.assigning.set(true);
    try {
      await this.api.assignModule(this.user().id, moduleKey, key);
      this.assignKeyCache = null;
      await this.load(this.user().id);
      this.changed.emit();
      this.notify.success(this.transloco.translate('access.common.saved'));
    } catch (error) {
      await this.handleWriteError(error, moduleKey);
    } finally {
      this.assigning.set(false);
    }
  }

  protected async requestRemove(row: UserAppItem): Promise<void> {
    if (this.effectiveReadonly() || this.removingModuleKey()) return;
    const userId = this.user().id;
    this.pendingRemove.set(row);
    const confirmed = await this.removeAppConfirm().open();
    if (!confirmed || this.effectiveReadonly() || this.user().id !== userId) {
      this.pendingRemove.set(null);
      return;
    }

    const key =
      this.removeKeyCache?.moduleKey === row.moduleKey
        ? this.removeKeyCache.key
        : newIdempotencyKey();
    this.removeKeyCache = { moduleKey: row.moduleKey, key };

    this.removingModuleKey.set(row.moduleKey);
    try {
      await this.api.unassignModule(this.user().id, row.moduleKey, key);
      this.removeKeyCache = null;
      await this.load(this.user().id);
      this.changed.emit();
      this.notify.success(this.transloco.translate('access.common.removed'));
    } catch (error) {
      if (errorCodeOf(error) === 'ADDON_ASSIGNMENTS_EXIST') {
        this.addonsModal().open();
      } else {
        await this.handleWriteError(error, row.moduleKey);
      }
    } finally {
      this.removingModuleKey.set(null);
      this.pendingRemove.set(null);
    }
  }

  private async load(userId: string): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadFailed.set(false);
    try {
      const [rawModules, usage] = await Promise.all([
        this.api.listModules(userId),
        this.seatsApi.getSeatUsage(),
      ]);
      if (seq !== this.loadSeq) return;

      const mode = usage.mode;
      this.subscribedModules.set(usage.modules.map((mod) => mod.moduleKey));
      this.seatMode.set(mode);

      if (mode !== 'DERIVED') {
        this.assignments.set(
          rawModules.map((row) => ({
            ...row,
            accessState: row.accessState ?? 'ACTIVE',
            source: row.source ?? 'MANUAL',
          })),
        );
        return;
      }

      const moduleKeys = usage.modules.map((mod) => mod.moduleKey);
      const holderEntries = await Promise.all(
        moduleKeys.map(async (moduleKey) => {
          const holder = await this.findHolderForUser(moduleKey, userId);
          return [moduleKey, holder] as const;
        }),
      );
      if (seq !== this.loadSeq) return;

      const holderByModule = new Map<string, SeatHolder>();
      for (const [moduleKey, holder] of holderEntries) {
        if (holder) {
          holderByModule.set(moduleKey, holder);
        }
      }

      const rawByModule = new Map<string, ModuleAssignment>();
      for (const row of rawModules) {
        rawByModule.set(row.moduleKey, row);
      }

      const orderedKeys = Array.from(new Set([...moduleKeys, ...rawByModule.keys()]));
      const merged: UserAppItem[] = [];
      for (const moduleKey of orderedKeys) {
        const raw = rawByModule.get(moduleKey);
        const holder = holderByModule.get(moduleKey);
        if (!raw && !holder) continue;
        merged.push({
          id: raw?.id ?? `seat-${userId}-${moduleKey}`,
          userId,
          moduleKey,
          createdAt: raw?.grantedAt ?? holder?.grantedAt ?? raw?.createdAt ?? '',
          updatedAt: raw?.updatedAt ?? holder?.grantedAt ?? '',
          accessState: raw?.accessState ?? holder?.accessState ?? 'ACTIVE',
          source:
            raw?.source ??
            (holder && holder.roles.length > 0 ? 'ROLE' : 'MANUAL'),
        });
      }
      this.assignments.set(merged);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      this.loadFailed.set(!(error instanceof ApiError && error.status === 0 && this.assignments().length));
      if (!(error instanceof ApiError && error.status === 0)) this.notify.error(this.resolveError(error));
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  private async findHolderForUser(
    moduleKey: string,
    userId: string,
  ): Promise<SeatHolder | null> {
    let page = 1;
    while (true) {
      const res = await this.seatsApi.listSeatHolders(moduleKey, { page, limit: 100 });
      const match = res.data.find((item) => item.userId === userId);
      if (match) return match;
      if (!res.meta.hasNext || res.data.length === 0) break;
      page += 1;
    }
    return null;
  }

  private async handleWriteError(error: unknown, moduleKey: string): Promise<void> {
    const fields = fieldErrorsOf(error);
    this.validationErrors.set(fields);
    if (Object.keys(fields).length) {
      if (fields['_']?.length) this.notify.error(fields['_'].join(' '));
      return;
    }
    const code = errorCodeOf(error);
    if (code === 'GW.IDEM.IN_FLIGHT') this.notify.info(this.resolveError(error, moduleKey, true));
    else if (code === 'GW.IDEM.MISMATCH') {
      this.notify.warning(this.resolveError(error, moduleKey, true));
      this.assignKeyCache = this.removeKeyCache = null;
      await this.load(this.user().id);
    } else if (!(error instanceof ApiError && error.status === 0)) this.notify.error(this.resolveError(error, moduleKey, true));
    if (code === 'SEATS_MANAGED_BY_ROLES' || code === 'TENANT_USER_CHANGED') await this.load(this.user().id);
    if (code === 'TENANT_USER_CHANGED' || code === 'TENANT_USER_NOT_FOUND') this.changed.emit();
  }

  private resolveError(error: unknown, moduleKey?: string, write = false): string {
    if (errorCodeOf(error) === 'SEAT_LIMIT_REACHED') {
      return this.transloco.translate('access.apps.noSeats', { module: moduleKey ? this.moduleLabel(moduleKey) : '' });
    }
    return staffErrorMessage(error, 'access', this.transloco, write ? 'write' : 'read');
  }
}
