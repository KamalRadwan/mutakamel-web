import { Component, ElementRef, computed, inject, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerActivityHeartbeat, tablerExclamationCircle } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Badge, type BadgeTone } from '../../../../../shared/ui/badge/badge';
import { Button } from '../../../../../shared/ui/button/button';
import { DASH, formatDateTime, formatNumber } from '../../../../../shared/ui/chart/chart-format';
import { DataCell, DataColumn, DataTable } from '../../../../../shared/ui/data-table/data-table';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { rectInPage, viewport } from '../../../../../shared/ui/overlay/zoom';
import { getReadiness, type ReadinessDetail } from '../readiness.api';
import type { SourceReadiness } from '../../../../../shared/widgets/dashboard/analytics.model';
import { ApiError, errorCodeOf } from '../../../../../core/api/api-errors';
import { readinessError } from '../readiness-error';
import { readinessReasonKey } from '../readiness-reasons';

type AffectedItem = ReadinessDetail['affected'][number];

const KNOWN_FAMILIES = new Set([
  'CRM_CURRENT',
  'CRM_HISTORY',
  'CRM_CONFIG',
  'CORE',
  'TRADE',
  'FINANCE',
  'MARKETING',
  'HR',
  'WORKFLOW',
  'EMAIL',
  'CONTRACTS',
  'RECOMMENDATIONS',
  'PLATFORM',
]);

let nextModalId = 0;

@Component({
  selector: 'app-readiness-modal',
  imports: [RouterLink, TranslocoPipe, NgIcon, Badge, Button, DataTable, DataCell, Modal],
  providers: [provideIcons({ tablerActivityHeartbeat, tablerExclamationCircle })],
  templateUrl: './readiness-modal.html',
})
export class ReadinessModal {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  private readonly modal = viewChild.required(Modal);

  protected readonly uid = `readiness-modal-${++nextModalId}`;
  protected readonly sourceKey = signal('');
  protected readonly loading = signal(false);
  protected readonly loadingMore = signal(false);
  protected readonly detail = signal<ReadinessDetail | null>(null);
  protected readonly affected = signal<AffectedItem[]>([]);
  protected readonly pageInfo = signal<ReadinessDetail['pageInfo'] | null>(null);
  protected readonly activeHintKey = signal<string | null>(null);
  protected readonly hintPlace = signal({ top: 0, start: 0 });
  protected readonly skeletonFields = [0, 1, 2, 3, 4, 5, 6, 7];

  readonly closed = output<void>();

  private loadSeq = 0;
  private suppressCloseEmit = false;

  protected readonly affectedColumns = computed<DataColumn[]>(() => {
    this.i18n();
    return [
      { key: 'kind', label: this.transloco.translate('readiness.affected.kind'), width: 0.9 },
      { key: 'name', label: this.transloco.translate('readiness.affected.name'), width: 2.2 },
      { key: 'action', label: this.transloco.translate('readiness.affected.actions'), width: 0.8, align: 'end' },
    ];
  });

  protected readonly affectedRowKey = (row: AffectedItem): string => `${row.kind}:${row.id}`;

  open(sourceKey: string): void {
    const seq = ++this.loadSeq;
    this.sourceKey.set(sourceKey);
    this.detail.set(null);
    this.affected.set([]);
    this.pageInfo.set(null);
    this.activeHintKey.set(null);
    this.loading.set(true);
    this.loadingMore.set(false);
    this.modal().open();
    void this.fetchInitial(sourceKey, seq);
  }

  close(): void {
    this.loadSeq++;
    this.activeHintKey.set(null);
    this.modal().close();
  }

  protected onModalClosed(): void {
    this.loadSeq++;
    this.activeHintKey.set(null);
    this.loading.set(false);
    this.loadingMore.set(false);
    if (!this.suppressCloseEmit) {
      this.closed.emit();
    }
  }

  protected onNavigateToReport(event: MouseEvent): void {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    this.suppressCloseEmit = true;
    try {
      this.close();
    } finally {
      this.suppressCloseEmit = false;
    }
  }

  protected async loadMore(): Promise<void> {
    const current = this.detail();
    const cursor = this.pageInfo()?.nextCursor;
    if (!current || !cursor || this.loadingMore()) return;

    const seq = this.loadSeq;
    this.loadingMore.set(true);
    try {
      const nextPage = await getReadiness(current.sourceKey, { cursor, limit: 20 });
      if (seq !== this.loadSeq) return;
      this.affected.update((items) => [...items, ...nextPage.affected]);
      this.pageInfo.set(nextPage.pageInfo);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      if (error instanceof ApiError && error.status === 400 && errorCodeOf(error) === 'CRM_DASHBOARD_LIST_CURSOR_INVALID') {
        this.open(current.sourceKey);
      } else {
        this.notify.error(readinessError(this.transloco, error).message);
        if (error instanceof ApiError && error.status === 404) this.close();
      }
    } finally {
      if (seq === this.loadSeq) {
        this.loadingMore.set(false);
      }
    }
  }

  protected uiStateTone(uiState: SourceReadiness['uiState']): BadgeTone {
    switch (uiState) {
      case 'AVAILABLE':
        return 'success';
      case 'EXPERIMENTAL':
      case 'SETUP_INCOMPLETE':
        return 'warning';
      case 'NOT_CONNECTED':
      default:
        return 'none';
    }
  }

  protected familyKey(family: string): string {
    return KNOWN_FAMILIES.has(family) ? `readiness.family.${family}` : 'readiness.family.OTHER';
  }

  protected reasonText(code: string | null): string {
    if (!code) return DASH;
    return this.transloco.translate(readinessReasonKey(code));
  }

  protected formatLag(lagSeconds: number | null): string {
    if (lagSeconds === null) return DASH;
    const lang = this.language();
    const plural = new Intl.PluralRules(lang);
    if (lagSeconds > 0 && lagSeconds < 60) {
      return this.transloco.translate(`readiness.behindSeconds.${plural.select(lagSeconds)}`, {
        n: formatNumber(lagSeconds, lang, 0),
      });
    }
    const minutes = Math.round(lagSeconds / 60);
    return this.transloco.translate(`readiness.behind.${plural.select(minutes)}`, {
      n: formatNumber(minutes, lang, 0),
    });
  }

  protected formatTarget(sloSeconds: number | null): string | null {
    if (sloSeconds === null) return null;
    const lang = this.language();
    const plural = new Intl.PluralRules(lang);
    if (sloSeconds > 0 && sloSeconds < 60) {
      return this.transloco.translate(`readiness.withinSeconds.${plural.select(sloSeconds)}`, {
        n: formatNumber(sloSeconds, lang, 0),
      });
    }
    const minutes = Math.round(sloSeconds / 60);
    return this.transloco.translate(`readiness.within.${plural.select(minutes)}`, {
      n: formatNumber(minutes, lang, 0),
    });
  }

  protected formatTimestamp(iso: string | null): string {
    return iso ? formatDateTime(iso, this.language()) : DASH;
  }

  protected placeHint(key: string, triggerEl: HTMLElement, labelRowEl: HTMLElement, tipEl: HTMLElement): void {
    const rect = rectInPage(triggerEl);
    const labelRow = rectInPage(labelRowEl);
    const tip = rectInPage(tipEl);
    const { width } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';

    let start = (rtl ? width - rect.left : rect.right) + 6;
    if (start + tip.width > width - 8) {
      const altStart = (rtl ? width - rect.right : rect.left) - 6 - tip.width;
      start = altStart >= 8 ? altStart : Math.max(8, width - 8 - tip.width);
    }

    const top = Math.max(8, labelRow.bottom - tip.height);
    this.hintPlace.set({ top, start });
    this.activeHintKey.set(key);
  }

  protected hideHint(): void {
    this.activeHintKey.set(null);
  }

  private async fetchInitial(sourceKey: string, seq: number): Promise<void> {
    try {
      const result = await getReadiness(sourceKey, { limit: 20 });
      if (seq !== this.loadSeq) return;
      this.detail.set(result);
      this.affected.set(result.affected);
      this.pageInfo.set(result.pageInfo);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      this.notify.error(readinessError(this.transloco, error).message);
      this.close();
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }
}
