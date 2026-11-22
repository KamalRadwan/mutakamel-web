import { Component, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerBuildingStore, tablerCloudOff, tablerEye, tablerLock, tablerWorld } from '@ng-icons/tabler-icons';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { ActionItem, ActionsMenu } from '../../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../../shared/ui/button/button';
import { errorMessage } from '../../shared/staff.api';
import { StaffSession } from '../../shared/staff-session';
import { StaffList } from '../../shared/staff-list/staff-list';
import type { Role } from '../../shared/staff.model';
import { RolesApi } from '../roles.api';
import { RoleModal } from '../role-modal/role-modal';

const DEFAULT_PAGE_SIZE = 20;

@Component({
  selector: 'app-roles-page',
  imports: [TranslocoPipe, NgIcon, ActionsMenu, Button, RoleModal, StaffList],
  providers: [
    provideTranslocoScope('staff', 'settings', { scope: 'staff-roles', alias: 'roles' }),
    provideIcons({ tablerLock, tablerWorld, tablerBuildingStore, tablerEye, tablerCloudOff }),
  ],
  templateUrl: './roles-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class RolesPage {
  private readonly route = inject(ActivatedRoute);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  private readonly session = inject(StaffSession);
  private readonly api = inject(RolesApi);
  private readonly roleModal = viewChild(RoleModal);
  private readonly readScope = computed(() => this.session.can('roles.role.read') ? this.session.scopeRevision() : null);
  private readonly refreshes = signal(0);

  private readonly queryParams = toSignal(this.route.queryParamMap);

  protected readonly skeletonRows = [1, 2, 3, 4, 5];
  protected readonly gridColumns = 'grid-cols-staff-role-row-actions';

  protected readonly search = signal('');
  protected readonly page = signal(1);
  protected readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  protected readonly sort = signal('name');
  protected readonly filterValues = signal<Record<string, string | null>>({ type: null });

  protected readonly roles = signal<Role[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly loadError = signal(false);
  private loadSeq = 0;
  private loadedScope: string | null = null;
  private deepLinkHandled = '';
  protected readonly canCreate = computed(() =>
    Boolean(this.readScope()) && this.session.isTenantWide('roles.role.create'),
  );

  protected readonly filters = computed(() => {
    this.i18n();
    const typeValue = this.filterValues()['type'] ?? null;
    return [
      {
        id: 'type',
        label: this.transloco.translate('roles.filters.type'),
        value: typeValue,
        options: [
          { value: 'custom', label: this.transloco.translate('roles.type.custom') },
          { value: 'system', label: this.transloco.translate('roles.type.system') },
        ],
      },
    ];
  });

  protected readonly sortOptions = computed(() => {
    this.i18n();
    return [
      { value: 'name', label: this.transloco.translate('roles.sort.name') },
      { value: 'newest', label: this.transloco.translate('roles.sort.newest') },
    ];
  });

  protected readonly hasActiveFilters = computed(
    () => this.search().trim().length > 0 || Boolean(this.filterValues()['type']),
  );

  constructor() {
    if (!this.session.me()) {
      void this.session.load().catch(() => undefined);
    }

    effect(() => {
      this.readScope();
      this.refreshes();
      this.search();
      this.page();
      this.pageSize();
      this.sort();
      this.filterValues();
      untracked(() => {
        void this.load();
      });
    });

    effect(() => {
      const modal = this.roleModal();
      const params = this.queryParams();
      const scope = this.readScope();
      const allowCreate = this.canCreate();
      if (!modal || !params || !scope) {
        this.deepLinkHandled = '';
        return;
      }
      const openId = params.get('open');
      const isNew = params.get('new') === '1';
      if ((isNew && !allowCreate) || (!openId && !isNew)) {
        this.deepLinkHandled = '';
        return;
      }
      const key = JSON.stringify([scope, openId, isNew]);
      if (key === this.deepLinkHandled) return;
      this.deepLinkHandled = key;
      untracked(() => void this.handleDeepLink(openId, isNew, key));
    });
  }

  protected async load(): Promise<void> {
    const seq = ++this.loadSeq;
    const scope = this.readScope();
    if (scope !== this.loadedScope) {
      if (this.loadedScope) this.roleModal()?.closeImmediate();
      this.loadedScope = scope;
      this.roles.set([]);
      this.total.set(0);
    }
    if (!scope) {
      this.loading.set(false);
      this.loadError.set(false);
      return;
    }
    this.loading.set(true);
    this.loadError.set(false);

    const typeFilter = this.filterValues()['type'];
    const isSystem = typeFilter === 'system' ? true : typeFilter === 'custom' ? false : undefined;
    const sortBy = this.sort() === 'newest' ? 'createdAt' : 'name';
    const sortDir = this.sort() === 'newest' ? 'DESC' : 'ASC';

    try {
      const res = await this.api.list({
        page: this.page(),
        limit: this.pageSize(),
        search: this.search().trim() || undefined,
        sortBy,
        sortDir,
        ...(isSystem !== undefined ? { isSystem } : {}),
      });
      if (seq !== this.loadSeq || scope !== this.readScope()) return;
      this.roles.set(res.data);
      this.total.set(res.meta.total);
    } catch {
      if (seq !== this.loadSeq || scope !== this.readScope()) return;
      this.loadError.set(true);
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  protected onSearchChange(value: string): void {
    this.search.set(value);
    if (this.page() !== 1) this.page.set(1);
  }

  protected onPageSizeChange(value: number): void {
    if (value === this.pageSize()) return;
    this.pageSize.set(value);
    if (this.page() !== 1) this.page.set(1);
  }

  protected onSortChange(value: string): void {
    this.sort.set(value);
    if (this.page() !== 1) this.page.set(1);
  }

  protected onFilterValuesChange(value: Record<string, string | null>): void {
    this.filterValues.set(value);
    if (this.page() !== 1) this.page.set(1);
  }

  protected isAdminRole(role: Role): boolean {
    return (
      role.isSystem &&
      (role.name.toLowerCase() === 'admin' ||
        role.nameI18n?.en?.toLowerCase() === 'admin' ||
        role.id === 'role-admin')
    );
  }

  protected roleName(role: Role): string {
    const localized = this.language() === 'ar' ? role.nameI18n?.ar : role.nameI18n?.en;
    return localized?.trim() || role.name;
  }

  protected roleDescription(role: Role): string | null {
    const localized = this.language() === 'ar' ? role.descriptionI18n?.ar : role.descriptionI18n?.en;
    return localized?.trim() || role.description || null;
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

  protected openCreate(): void {
    if (!this.canCreate()) return;
    this.roleModal()?.openCreate();
  }

  protected openRole(role: Role): void {
    if (this.loadedScope && this.readScope() === this.loadedScope) this.roleModal()?.openDetails(role);
  }

  protected readonly rowActions = computed<ActionItem[]>(() => {
    this.i18n();
    return [{
      id: 'open',
      title: this.transloco.translate('roles.actions.open'),
      icon: 'tablerEye',
      tile: 'bg-icon-blue',
    }];
  });

  protected onRoleCreated(): void {
    this.search.set('');
    this.filterValues.set({ type: null });
    this.sort.set('newest');
    this.page.set(1);
    this.refreshes.update((value) => value + 1);
  }

  private async handleDeepLink(openId: string | null, isNew: boolean, key: string): Promise<void> {
    if (isNew) {
      this.openCreate();
      return;
    }
    if (!openId) return;
    const scope = this.readScope();
    const existing = scope === this.loadedScope ? this.roles().find((role) => role.id === openId) : undefined;
    if (existing) {
      this.openRole(existing);
      return;
    }

    try {
      const role = await this.api.get(openId);
      if (key === this.deepLinkHandled && scope === this.readScope()) this.openRole(role);
    } catch (error) {
      if (key === this.deepLinkHandled && scope === this.readScope()) {
        this.notify.error(errorMessage(error, 'staff', this.transloco));
      }
    }
  }
}
