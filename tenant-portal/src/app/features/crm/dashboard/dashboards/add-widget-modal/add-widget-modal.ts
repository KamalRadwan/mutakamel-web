import { Router } from '@angular/router';
import { can } from '../../../../../shared/widgets/dashboard/analytics-permissions';
import { dashboardWriteError } from '../../shared/write-state';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerChartDots3, tablerCheck, tablerPlus, tablerSearch } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Badge } from '../../../../../shared/ui/badge/badge';
import { Button } from '../../../../../shared/ui/button/button';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Segmented, type SegmentedOption } from '../../../../../shared/ui/segmented/segmented';
import { errorCodeOf } from '../../../../../shared/widgets/dashboard/analytics-api';
import { getCatalog } from '../../../../../shared/widgets/dashboard/analytics.api';
import type { Catalog } from '../../../../../shared/widgets/dashboard/analytics.model';
import { errorKey } from '../../../../../shared/widgets/dashboard/panel-state';
import { listAddableWidgets } from '../dashboards.api';
import type { EmbeddedWidget } from '../dashboards.model';

/** The pick made in the modal. Nothing is sent to the server: the page keeps it local until Save. */
export interface AddedWidgetResult {
  widget: EmbeddedWidget;
  versionMode: 'FOLLOW_ACTIVE' | 'PINNED';
  pinnedVersionNumber: number | null;
  size: { w: number; h: number };
}

type AddableWidget = EmbeddedWidget & { accessLevel: 'OWNER' | 'EDIT' | 'VIEW' };

let nextAddModalId = 0;

@Component({
  selector: 'app-add-widget-modal',
  imports: [FullState, NgIcon, TranslocoPipe, Badge, Button, Field, Modal, Segmented],
  viewProviders: [
    provideTranslocoScope(
      { scope: 'crm-dash-edit', alias: 'dashEdit' },
      { scope: 'analytics', alias: 'analytics' },
    ),
    provideIcons({ tablerPlus, tablerChartDots3, tablerSearch, tablerCheck }),
  ],
  templateUrl: './add-widget-modal.html',
})
export class AddWidgetModal {
  private readonly destroyRef = inject(DestroyRef);
  private readonly notify = inject(Notify);
  private readonly router = inject(Router);
  protected readonly canViewReadiness = can('crm.analytics.readiness.view');
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageState).current;
  private readonly i18n = translationEvents(this.transloco);

  private readonly modal = viewChild.required(Modal);
  private readonly rowButtons = viewChildren<ElementRef<HTMLButtonElement>>('rowBtn');

  private readonly uid = `add-widget-modal-${++nextAddModalId}`;
  protected readonly searchInputId = `${this.uid}-search`;
  protected readonly versionFieldId = `${this.uid}-version`;

  protected readonly searchText = signal('');
  protected readonly items = signal<AddableWidget[]>([]);
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadingMore = signal(false);
  protected readonly loadFailure = signal<ReturnType<typeof dashboardWriteError> | null>(null);
  protected readonly loadFailed = signal(false);
  protected readonly submitting = signal(false);
  protected readonly usedIds = signal<ReadonlySet<string>>(new Set());
  protected readonly selectedId = signal<string | null>(null);
  protected readonly versionMode = signal<'FOLLOW_ACTIVE' | 'PINNED'>('FOLLOW_ACTIVE');

  private dashboardId = '';
  private catalog: Catalog | null = null;
  private resolver: ((result: AddedWidgetResult | null) => void) | null = null;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private requestSeq = 0;

  protected readonly selectedWidget = computed<AddableWidget | null>(() => {
    const id = this.selectedId();
    if (!id || this.usedIds().has(id)) return null;
    return this.items().find((item) => item.id === id) ?? null;
  });

  protected readonly activeRowIndex = computed(() => {
    const list = this.items();
    const used = this.usedIds();
    const currentId = this.selectedId();
    if (currentId && !used.has(currentId)) {
      const idx = list.findIndex((item) => item.id === currentId);
      if (idx !== -1) return idx;
    }
    return list.findIndex((item) => !used.has(item.id));
  });

  protected readonly versionOptions = computed<SegmentedOption[]>(() => {
    this.language();
    this.i18n();
    const selected = this.selectedWidget();
    return [
      {
        value: 'FOLLOW_ACTIVE',
        label: this.transloco.translate('dashEdit.followActive'),
      },
      {
        value: 'PINNED',
        label: selected
          ? this.transloco.translate('dashEdit.pinVersion', { n: selected.versionNumber })
          : this.transloco.translate('dashEdit.pin'),
        disabled: !selected,
      },
    ];
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.clearSearchTimer();
      this.requestSeq++;
      this.settle(null);
    });
  }

  open(
    dashboardId: string,
    revision: number,
    usedWidgetIds: string[],
  ): Promise<AddedWidgetResult | null> {
    void revision;
    this.settle(null);
    this.clearSearchTimer();
    this.dashboardId = dashboardId;
    this.usedIds.set(new Set(usedWidgetIds));
    this.searchText.set('');
    this.items.set([]);
    this.nextCursor.set(null);
    this.selectedId.set(null);
    this.versionMode.set('FOLLOW_ACTIVE');
    this.loadFailed.set(false);
    this.loadFailure.set(null);
    this.submitting.set(false);

    this.modal().open();
    void this.ensureCatalog();
    void this.loadWidgets(true);

    return new Promise<AddedWidgetResult | null>((resolve) => {
      this.resolver = resolve;
    });
  }

  protected onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchText.set(value);
    this.clearSearchTimer();
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      void this.loadWidgets(true);
    }, 250);
  }

  protected onReadAction(): void {
    if (this.loadFailure()?.kind === 'provisioning' && this.canViewReadiness) {
      this.modal().close();
      void this.router.navigate(['/crm/settings/data-readiness']);
    } else this.retryLoad();
  }
  protected retryLoad(): void {
    void this.loadWidgets(true);
  }

  protected loadMore(): void {
    if (!this.nextCursor() || this.loading() || this.loadingMore()) return;
    void this.loadWidgets(false);
  }

  protected selectWidget(widget: AddableWidget): void {
    if (this.usedIds().has(widget.id)) return;
    this.selectedId.set(widget.id);
  }

  protected onRowKeydown(event: KeyboardEvent, index: number): void {
    const list = this.items();
    const used = this.usedIds();
    const enabledIndices = list.reduce<number[]>((acc, item, i) => {
      if (!used.has(item.id)) acc.push(i);
      return acc;
    }, []);
    if (enabledIndices.length === 0) return;

    const currentPos = enabledIndices.indexOf(index);
    const startPos = currentPos !== -1 ? currentPos : 0;
    let nextPos = -1;

    if (event.key === 'ArrowDown') {
      nextPos = (startPos + 1) % enabledIndices.length;
    } else if (event.key === 'ArrowUp') {
      nextPos = (startPos - 1 + enabledIndices.length) % enabledIndices.length;
    } else if (event.key === 'Home') {
      nextPos = 0;
    } else if (event.key === 'End') {
      nextPos = enabledIndices.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const targetIndex = enabledIndices[nextPos];
    const targetWidget = list[targetIndex];
    this.selectedId.set(targetWidget.id);
    this.rowButtons()[targetIndex]?.nativeElement.focus();
  }

  protected onVersionModeChange(next: string | null): void {
    if (next !== 'FOLLOW_ACTIVE' && next !== 'PINNED') return;
    if (next === 'PINNED' && !this.selectedWidget()) return;
    this.versionMode.set(next);
  }

  protected submit(): void {
    const widget = this.selectedWidget();
    if (!widget || this.submitting()) return;

    const maxWidgets = this.catalog?.grid.maxWidgets ?? 20;
    if (this.usedIds().size >= maxWidgets) {
      this.notify.error(this.transloco.translate(errorKey('CRM_DASHBOARD_WIDGET_LIMIT')));
      return;
    }

    const vizDefault = this.catalog?.visualizations.find(
      (v) => v.key === widget.visualizationType,
    )?.defaultSize;
    this.settle({
      widget,
      versionMode: this.versionMode(),
      pinnedVersionNumber: this.versionMode() === 'PINNED' ? widget.versionNumber : null,
      size: { w: vizDefault?.w ?? 16, h: vizDefault?.h ?? 37 },
    });
    this.modal().close();
  }

  protected cancel(): void {
    if (this.submitting()) return;
    this.modal().close();
  }

  protected onModalClosed(): void {
    this.clearSearchTimer();
    this.requestSeq++;
    this.settle(null);
  }

  private async ensureCatalog(): Promise<void> {
    if (this.catalog) return;
    try {
      this.catalog = await getCatalog();
    } catch {
      // Fallback maxWidgets (20) and default sizes remain active when catalog fails.
    }
  }

  private async loadWidgets(reset: boolean): Promise<void> {
    const seq = reset ? ++this.requestSeq : this.requestSeq;
    const cursor = reset ? null : this.nextCursor();
    if (reset) {
      this.loading.set(true);
      this.loadingMore.set(false);
      this.loadFailed.set(false);
      this.loadFailure.set(null);
    } else {
      this.loadingMore.set(true);
    }

    try {
      const search = this.searchText().trim();
      const page = await listAddableWidgets({
        search: search || undefined,
        cursor,
      });
      if (seq !== this.requestSeq) return;

      if (reset) {
        this.items.set(page.items);
        const currentSelected = this.selectedId();
        if (
          currentSelected &&
          !page.items.some((item) => item.id === currentSelected && !this.usedIds().has(item.id))
        ) {
          this.selectedId.set(null);
          this.versionMode.set('FOLLOW_ACTIVE');
        }
      } else {
        this.items.update((existing) => {
          const seen = new Set(existing.map((item) => item.id));
          const merged = [...existing];
          for (const item of page.items) {
            if (!seen.has(item.id)) {
              seen.add(item.id);
              merged.push(item);
            }
          }
          return merged;
        });
      }
      this.nextCursor.set(page.nextCursor);
    } catch (error) {
      if (seq !== this.requestSeq) return;
      if (reset) {
        this.loadFailed.set(true);
        this.loadFailure.set(dashboardWriteError(this.transloco, error, 'dashEdit', false));
      } else this.notify.error(this.transloco.translate(errorKey(errorCodeOf(error))));
    } finally {
      if (seq === this.requestSeq) {
        this.loading.set(false);
        this.loadingMore.set(false);
      }
    }
  }

  private clearSearchTimer(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
  }

  private settle(result: AddedWidgetResult | null): void {
    const resolve = this.resolver;
    this.resolver = null;
    resolve?.(result);
  }
}
