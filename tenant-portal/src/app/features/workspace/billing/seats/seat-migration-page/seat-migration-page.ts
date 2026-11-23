import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerArrowLeft, tablerCloudOff } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { errorCodeOf, errorMessage, newIdempotencyKey } from '../../../staff/shared/staff.api';
import { SeatCascadeConfirm } from '../../../seats/cascade-confirm/cascade-confirm';
import { isCascadeRequired, seatErrorMessage, seatShortfallDetails } from '../../../seats/seat-errors';
import { SeatPreviewApi } from '../../../seats/seats.api';
import { SeatUsage } from '../../../seats/seats.model';
import { StaffSession } from '../../../staff/shared/staff-session';
import { loadSeatsChangeQueries } from '../../shared/change-link';
import { HoldersModal } from '../holders-modal/holders-modal';

const SKELETON_ROWS = [1, 2, 3, 4] as const;

interface MigrationModuleRow {
  moduleKey: string;
  nameI18n: { en: string; ar: string } | null;
  holders: number;
  seats: number;
  shortBy: number;
}

@Component({
  selector: 'app-seat-migration-page',
  imports: [NgIcon, RouterLink, TranslocoPipe, Button, HoldersModal],
  providers: [
    provideTranslocoScope('settings', 'seats', { scope: 'seats-billing', alias: 'sb' }),
    provideIcons({ tablerArrowLeft, tablerCloudOff }),
  ],
  templateUrl: './seat-migration-page.html',
  host: { class: 'flex flex-1 shrink-0 flex-col gap-10 p-12' },
})
export class SeatMigrationPage {
  private static nextId = 0;
  protected readonly uid = `seat-migration-${++SeatMigrationPage.nextId}`;

  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly notify = inject(Notify);
  private readonly session = inject(StaffSession);
  private readonly seatsApi = inject(SeatPreviewApi);
  private readonly cascadeConfirm = inject(SeatCascadeConfirm);
  protected readonly language = inject(LanguageState).current;
  private readonly holdersModal = viewChild.required(HoldersModal);

  protected get isOwner(): boolean {
    return this.session.isOwner();
  }
  protected readonly skeletonRows = SKELETON_ROWS;

  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly switching = signal(false);
  protected readonly usage = signal<SeatUsage | null>(null);
  protected readonly migrationNotReady = signal(false);
  private readonly shortfallRows = signal<MigrationModuleRow[]>([]);

  private loadSeq = 0;

  protected readonly tableColumns = computed(() =>
    this.isOwner
      ? 'grid-cols-ws-migration-row-owner'
      : 'grid-cols-ws-migration-row',
  );

  protected readonly rows = computed<MigrationModuleRow[]>(() => {
    const short = this.shortfallRows();
    if (short.length > 0) return short;
    const mods = this.usage()?.modules ?? [];
    return mods.map((mod) => ({
      moduleKey: mod.moduleKey,
      nameI18n: mod.nameI18n,
      holders: mod.used,
      seats: mod.capacity,
      shortBy: Math.max(0, mod.used - mod.capacity),
    }));
  });

  protected readonly hasShortfall = this.migrationNotReady.asReadonly();

  protected readonly changeQueries = signal<ReadonlyMap<string, { add: string }>>(new Map());

  constructor() {
    void loadSeatsChangeQueries().then((queries) => this.changeQueries.set(queries));
    void this.load();
  }

  protected async load(): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadFailed.set(false);
    try {
      const data = await this.seatsApi.getSeatUsage();
      if (seq !== this.loadSeq) return;
      this.usage.set(data);
      this.shortfallRows.set([]);
      this.migrationNotReady.set(false);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      this.loadFailed.set(true);
      this.showError(error);
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  protected moduleLabel(row: MigrationModuleRow): string {
    if (row.nameI18n) {
      return this.language() === 'ar' ? row.nameI18n.ar : row.nameI18n.en;
    }
    const key = `seats.module.${row.moduleKey}`;
    const translated = this.transloco.translate(key);
    return translated !== key ? translated : row.moduleKey;
  }

  protected openHolders(row: MigrationModuleRow): void {
    this.holdersModal().open(row.moduleKey, this.moduleLabel(row));
  }

  protected async switchNow(): Promise<void> {
    if (!this.isOwner || this.switching()) return;
    this.switching.set(true);
    try {
      await this.executeSwitch(false);
    } finally {
      this.switching.set(false);
    }
  }

  private async executeSwitch(confirmAddonCascade: boolean): Promise<void> {
    try {
      const updated = await this.seatsApi.switchToDerived(
        confirmAddonCascade ? { confirmAddonCascade: true } : {},
        newIdempotencyKey(),
      );
      this.usage.set(updated);
      this.shortfallRows.set([]);
      this.migrationNotReady.set(false);
      this.notify.success(this.transloco.translate('sb.mig.done'));
      void this.router.navigate(['/workspace/billing/subscription']);
    } catch (error) {
      if (!confirmAddonCascade) {
        const cascade = isCascadeRequired(error);
        if (cascade) {
          this.switching.set(false);
          const accepted = await this.cascadeConfirm.confirm(cascade.addons);
          if (!accepted) return;
          this.switching.set(true);
          await this.executeSwitch(true);
          return;
        }
      }
      if (errorCodeOf(error) === 'SEAT_MIGRATION_NOT_READY') {
        this.migrationNotReady.set(true);
        this.shortfallRows.set(this.rowsFromDetails(error));
      }
      this.showError(error);
    }
  }

  /** Rows from the error details when Core sends them; [] keeps the usage-read rows. */
  private rowsFromDetails(error: unknown): MigrationModuleRow[] {
    const byKey = new Map((this.usage()?.modules ?? []).map((mod) => [mod.moduleKey, mod]));
    return seatShortfallDetails(error).map((detail) => {
      const match = byKey.get(detail.moduleKey);
      const seats = detail.capacity ?? match?.capacity ?? 0;
      const shortBy = detail.shortfall ?? Math.max(0, detail.needed - detail.free);
      const holders = detail.usedAfter ?? seats + shortBy;
      return { moduleKey: detail.moduleKey, nameI18n: match?.nameI18n ?? null, holders, seats, shortBy };
    });
  }

  private showError(error: unknown): void {
    const msg =
      seatErrorMessage(this.transloco, error) ??
      errorMessage(error, 'sb', this.transloco);
    this.notify.error(msg);
  }
}
