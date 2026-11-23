import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCloudOff, tablerLock, tablerSearch, tablerUsers, tablerX } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Button } from '../../../../../shared/ui/button/button';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Pagination } from '../../../../../shared/ui/pagination/pagination';
import { SeatPreviewApi } from '../../../seats/seats.api';
import { SeatHolder, SeatHolderRole, holderRoleLabel } from '../../../seats/seats.model';
import { listAllPages } from '../../../staff/shared/staff.api';
import { OrganizationReadApi } from '../../../staff/shared/organization-read.api';
import { formatBillingDate } from '../../overview/overview-dates';

const SKELETON_ROWS = [1, 2, 3, 4, 5] as const;
const HOLDERS_COLUMNS = 'grid-cols-ws-holder-row';

const STATUS_BADGE: Record<SeatHolder['status'], string> = {
  ACTIVE: 'bg-success text-on-success',
  INVITED: 'bg-brand-soft text-on-brand-soft',
  SUSPENDED: 'bg-warning text-on-warning',
  DEACTIVATED: 'bg-warning text-on-warning',
};

@Component({
  selector: 'app-holders-modal',
  imports: [NgIcon, TranslocoPipe, Button, Modal, Pagination],
  providers: [
    provideTranslocoScope('settings', 'seats', { scope: 'seats-billing', alias: 'sb' }),
    provideIcons({ tablerUsers, tablerSearch, tablerX, tablerLock, tablerCloudOff }),
  ],
  templateUrl: './holders-modal.html',
})
export class HoldersModal {
  private readonly transloco = inject(TranslocoService);
  private readonly seatsApi = inject(SeatPreviewApi);
  private readonly organizationApi = inject(OrganizationReadApi);
  private readonly seatsTranslation = toSignal(this.transloco.selectTranslation('seats'));
  private readonly language = inject(LanguageState).current;
  private readonly modal = viewChild.required(Modal);

  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly tableColumns = HOLDERS_COLUMNS;
  protected readonly statusBadge = STATUS_BADGE;

  protected readonly moduleKey = signal('');
  protected readonly moduleName = signal('');
  protected readonly search = signal('');
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly holders = signal<SeatHolder[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);
  private readonly companyNames = signal<ReadonlyMap<string, string>>(new Map());
  private readonly branchNames = signal<ReadonlyMap<string, string>>(new Map());

  private loadSeq = 0;
  private lookupsLoaded = false;

  protected readonly resolvedModuleName = computed(() => {
    const explicit = this.moduleName().trim();
    if (explicit) return explicit;
    const key = this.moduleKey();
    if (!key) return '';
    const translated = this.transloco.translate(`seats.module.${key}`);
    return translated !== `seats.module.${key}` ? translated : key;
  });

  open(moduleKey: string, moduleName = ''): void {
    this.moduleKey.set(moduleKey);
    this.moduleName.set(moduleName);
    this.search.set('');
    this.page.set(1);
    this.holders.set([]);
    this.total.set(0);
    this.failed.set(false);
    this.modal().open();
    void this.ensureScopeLookups();
    void this.load();
  }

  close(): void {
    this.loadSeq++;
    this.loading.set(false);
    this.modal().close();
  }

  protected onSearchInput(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
    this.page.set(1);
    void this.load();
  }

  protected clearSearch(): void {
    if (!this.search()) return;
    this.search.set('');
    this.page.set(1);
    void this.load();
  }

  protected onPageChange(nextPage: number): void {
    this.page.set(nextPage);
    void this.load();
  }

  protected onPageSizeChange(nextSize: number): void {
    this.pageSize.set(nextSize);
    this.page.set(1);
    void this.load();
  }

  protected formatDate(iso: string): string {
    return formatBillingDate(iso, this.language());
  }

  protected displayStatus(status: SeatHolder['status']): 'ACTIVE' | 'INVITED' | 'SUSPENDED' {
    return status === 'DEACTIVATED' ? 'SUSPENDED' : status;
  }

  protected roleLabel(role: SeatHolderRole): string {
    this.seatsTranslation();
    return holderRoleLabel(role, {
      companies: this.companyNames(),
      branches: this.branchNames(),
      scopeLabels: {
        TENANT: this.transloco.translate('seats.holders.scope.TENANT'),
        COMPANY: this.transloco.translate('seats.holders.scope.COMPANY'),
        BRANCH: this.transloco.translate('seats.holders.scope.BRANCH'),
      },
    });
  }

  private async ensureScopeLookups(): Promise<void> {
    if (this.lookupsLoaded) return;
    this.lookupsLoaded = true;
    const [companiesRes, branchesRes] = await Promise.allSettled([
      listAllPages((q) => this.organizationApi.listCompanies(q)),
      listAllPages((q) => this.organizationApi.listBranches(q)),
    ]);
    if (companiesRes.status === 'fulfilled') {
      this.companyNames.set(new Map(companiesRes.value.map((c) => [c.id, c.name])));
    }
    if (branchesRes.status === 'fulfilled') {
      this.branchNames.set(new Map(branchesRes.value.map((b) => [b.id, b.name])));
    }
    this.lookupsLoaded = companiesRes.status === 'fulfilled' && branchesRes.status === 'fulfilled';
  }

  protected async load(): Promise<void> {
    const key = this.moduleKey();
    if (!key) return;
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.failed.set(false);
    try {
      const term = this.search().trim();
      const result = await this.seatsApi.listSeatHolders(key, {
        page: this.page(),
        limit: this.pageSize(),
        ...(term ? { search: term } : {}),
      });
      if (seq !== this.loadSeq) return;
      this.holders.set(result.data);
      this.total.set(result.meta.total);
    } catch {
      if (seq !== this.loadSeq) return;
      this.failed.set(true);
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }
}
