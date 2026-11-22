import { Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerAlertTriangle, tablerCircleCheck } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { ApiError } from '../../../../core/api/api-errors';
import { seatErrorMessage } from '../seat-errors';
import { SeatImpact } from '../seat-impact/seat-impact';
import { ImportResult, ImportRowResult, SeatPreview, importOk } from '../seats.model';

const STATUS_BADGE_CLASSES: Record<ImportRowResult['status'], string> = {
  CREATED: 'bg-success-soft text-on-success-soft',
  WOULD_CREATE: 'bg-brand-soft text-on-brand-soft',
  ROLES_SKIPPED: 'bg-warning text-on-warning',
  ERROR: 'bg-danger-soft text-on-danger-soft',
};

function isImportResult(value: ImportResult | SeatPreview): value is ImportResult {
  return 'results' in value && 'seats' in value;
}

@Component({
  selector: 'app-dry-run-report',
  imports: [NgIcon, TranslocoPipe, SeatImpact],
  providers: [
    provideTranslocoScope({ scope: 'seats', alias: 'seats' }),
    provideIcons({ tablerCircleCheck, tablerAlertTriangle }),
  ],
  templateUrl: './dry-run-report.html',
  host: { class: 'flex flex-col gap-8' },
})
export class DryRunReport {
  private readonly transloco = inject(TranslocoService);
  private readonly seatsTranslation = toSignal(this.transloco.selectTranslation('seats'));
  private readonly language = inject(LanguageState).current;

  readonly result = input.required<ImportResult | SeatPreview>();
  readonly kind = input.required<'import' | 'bulk'>();
  readonly roleLabels = input<Readonly<Record<string, string>>>({});

  protected readonly preview = computed<SeatPreview>(() => {
    const current = this.result();
    return isImportResult(current) ? current.seats : current;
  });

  protected readonly isOk = computed<boolean>(() => {
    const current = this.result();
    return isImportResult(current) ? importOk(current) : current.ok;
  });

  protected readonly importRows = computed<ImportRowResult[]>(() => {
    if (this.kind() !== 'import') return [];
    const current = this.result();
    return isImportResult(current) ? current.results : [];
  });

  protected statusClass(status: ImportRowResult['status']): string {
    return STATUS_BADGE_CLASSES[status];
  }

  protected skippedText(skipped: readonly { roleId: string; branchId: string }[]): string {
    this.seatsTranslation();
    const base = this.transloco.translate('seats.dry.skippedCount', { n: skipped.length });
    const labels = this.roleLabels();
    const names = Array.from(
      new Set(
        skipped
          .map((item) => labels[item.roleId]?.trim())
          .filter((name): name is string => Boolean(name)),
      ),
    );
    if (names.length === 0) return base;
    const sep = this.language() === 'ar' ? '، ' : ', ';
    return `${base}: ${names.join(sep)}`;
  }

  protected codeMessage(code: string): string {
    this.seatsTranslation();
    const seatMessage = seatErrorMessage(this.transloco, new ApiError(422, code));
    if (seatMessage) return seatMessage;
    if (code === 'TENANT_EMAIL_TAKEN') {
      const key = `seats.errors.${code}`;
      const translated = this.transloco.translate(key);
      if (translated && translated !== key) {
        return translated;
      }
    }
    return code;
  }
}
