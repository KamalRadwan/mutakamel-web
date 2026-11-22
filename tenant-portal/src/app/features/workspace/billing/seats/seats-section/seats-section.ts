import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerAlertTriangle, tablerArmchair, tablerCloudOff, tablerRefresh } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { seatErrorMessage } from '../../../seats/seat-errors';
import { getSeatUsage } from '../../../seats/seats.api';
import { ModuleUsage, SeatUsage } from '../../../seats/seats.model';
import { UsageBars } from '../../../seats/usage-bars/usage-bars';
import { errorMessage } from '../../../staff/shared/staff.api';
import { StaffSession } from '../../../staff/shared/staff-session';
import { formatBillingDate } from '../../overview/overview-dates';
import { loadSeatsChangeQueries } from '../../shared/change-link';
import { HoldersModal } from '../holders-modal/holders-modal';

@Component({
  selector: 'app-seats-section',
  imports: [NgIcon, RouterLink, TranslocoPipe, Button, UsageBars, HoldersModal],
  providers: [
    provideTranslocoScope('settings', 'seats', { scope: 'seats-billing', alias: 'sb' }),
    provideIcons({ tablerArmchair, tablerAlertTriangle, tablerRefresh, tablerCloudOff }),
  ],
  templateUrl: './seats-section.html',
  host: { class: 'block' },
})
export class SeatsSection {
  private static nextId = 0;
  protected readonly uid = `seats-section-${++SeatsSection.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly notify = inject(Notify);
  private readonly session = inject(StaffSession);
  protected readonly language = inject(LanguageState).current;
  private readonly holdersModal = viewChild.required(HoldersModal);

  protected get isOwner(): boolean {
    return this.session.isOwner();
  }
  protected readonly usage = signal<SeatUsage | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);

  protected readonly hasModules = computed(() => (this.usage()?.modules.length ?? 0) > 0);

  private loadSeq = 0;

  protected readonly changeQueries = signal<ReadonlyMap<string, { add: string }>>(new Map());

  constructor() {
    void loadSeatsChangeQueries().then((queries) => this.changeQueries.set(queries));
    void this.load();
  }

  reload(): void {
    void this.load();
  }

  protected async load(): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.failed.set(false);
    try {
      const data = await getSeatUsage();
      if (seq !== this.loadSeq) return;
      this.usage.set(data);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      this.failed.set(true);
      const msg =
        seatErrorMessage(this.transloco, error) ??
        errorMessage(error, 'sb', this.transloco);
      this.notify.error(msg);
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  protected moduleName(mod: ModuleUsage): string {
    return this.language() === 'ar' ? mod.nameI18n.ar : mod.nameI18n.en;
  }

  protected formatDate(iso: string): string {
    return formatBillingDate(iso, this.language());
  }

  protected openHolders(mod: ModuleUsage): void {
    this.holdersModal().open(mod.moduleKey, this.moduleName(mod));
  }
}
