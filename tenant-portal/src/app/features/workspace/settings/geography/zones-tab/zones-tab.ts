import { Component, DestroyRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCloudOff, tablerPlus, tablerPolygon } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { errorCodeOf, errorMessage } from '../../../../../core/api/api-errors';
import { SettingsFrame } from '../../../../../shared/ui/settings-frame/settings-frame';
import { GEO_LIMITS, GeoZone, GeoZoneDetail, deleteZone, geoNameIn, listZones } from '../geo-admin.api';
import { ZoneModal } from '../zone-modal/zone-modal';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { ActionKeys } from '../../core-response.model';

const CAN_MANAGE = true; // later from geo.zones.manage
const SEARCH_DEBOUNCE_MS = 300;

/** Geography Zones tab: server-searched cursor pages, a CRUD modal and city assignment. */
@Component({
  selector: 'app-zones-tab',
  imports: [NgIcon, TranslocoPipe, ActionsMenu, Button, ConfirmDialog, SettingsFrame, ZoneModal],
  providers: [
    provideTranslocoScope({ scope: 'ws-geo', alias: 'wsGeo' }, 'settings', { scope: 'ws-geo-zones', alias: 'geoZones' }),
    provideIcons({ tablerPolygon, tablerPlus, tablerCloudOff }),
  ],
  templateUrl: './zones-tab.html',
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class ZonesTab {
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  private readonly zoneModal = viewChild.required(ZoneModal);
  private readonly deleteDialog = viewChild.required<ConfirmDialog>('deleteDialog');

  protected readonly canManage = CAN_MANAGE;
  protected readonly skeletonRows = [0, 1, 2, 3, 4];
  protected readonly gridColumns = CAN_MANAGE ? 'grid-cols-geo-zone-row-actions' : 'grid-cols-geo-zone-row';

  protected readonly zones = signal<GeoZone[]>([]);
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly debouncedSearch = signal('');
  protected readonly loading = signal(false);
  protected readonly loadingMore = signal(false);
  protected readonly loadError = signal(false);
  protected readonly deleting = signal(false);
  protected readonly pendingDeleteZone = signal<GeoZone | null>(null);

  private loadSeq = 0;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly actionKeys = new ActionKeys(newIdempotencyKey);

  protected readonly isSearching = computed(() => this.debouncedSearch().length > 0);

  /** The API filters by search (a substring of either name), so the page is already the result. */
  protected readonly filteredZones = this.zones.asReadonly();

  protected readonly rowActions = computed<ActionItem[]>(() => {
    this.i18n();
    return [
      { id: 'open', title: this.transloco.translate('geoZones.actions.open'), icon: 'tablerEye', tile: 'bg-icon-blue' },
      { id: 'edit', title: this.transloco.translate('geoZones.actions.edit'), icon: 'tablerEdit', tile: 'bg-icon-orange' },
      { id: 'delete', title: this.transloco.translate('geoZones.actions.delete'), icon: 'tablerTrash', tile: 'bg-icon-red', danger: true },
    ];
  });

  constructor() {
    effect(() => {
      const term = this.search().trim();
      if (this.searchTimer !== null) clearTimeout(this.searchTimer);
      this.searchTimer = null;
      if (term === untracked(() => this.debouncedSearch())) return;
      this.searchTimer = setTimeout(() => {
        this.searchTimer = null;
        this.debouncedSearch.set(term);
      }, SEARCH_DEBOUNCE_MS);
    });

    effect(() => {
      this.debouncedSearch();
      untracked(() => void this.load());
    });

    inject(DestroyRef).onDestroy(() => {
      if (this.searchTimer !== null) clearTimeout(this.searchTimer);
    });
  }

  protected async load(): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadError.set(false);
    try {
      const page = await listZones({ search: this.debouncedSearch() || undefined, limit: GEO_LIMITS.pageSize });
      if (seq !== this.loadSeq) return;
      this.zones.set(page.items);
      this.nextCursor.set(page.nextCursor);
    } catch {
      if (seq !== this.loadSeq) return;
      this.loadError.set(true);
    } finally {
      if (seq === this.loadSeq) this.loading.set(false);
    }
  }

  protected async loadMore(): Promise<void> {
    const cursor = this.nextCursor();
    if (!cursor || this.loading() || this.loadingMore()) return;
    const seq = this.loadSeq;
    this.loadingMore.set(true);
    try {
      const page = await listZones({ search: this.debouncedSearch() || undefined, cursor, limit: GEO_LIMITS.pageSize });
      if (seq !== this.loadSeq) return;
      this.zones.update((list) => {
        const seen = new Set(list.map((zone) => zone.id));
        return [...list, ...page.items.filter((zone) => !seen.has(zone.id))];
      });
      this.nextCursor.set(page.nextCursor);
    } catch (error) {
      if (seq === this.loadSeq) this.notify.error(errorMessage(error, 'geoZones', this.transloco));
    } finally {
      if (seq === this.loadSeq) this.loadingMore.set(false);
    }
  }

  protected openCreate(): void {
    if (!this.canManage) return;
    this.zoneModal().openCreate();
  }

  protected openZone(zone: GeoZone): void {
    this.zoneModal().openEdit(zone);
  }

  protected onZoneSaved(_event: { zone: GeoZoneDetail; isNew: boolean }): void {
    void this.load();
  }

  protected onZoneDeletedRemotely(): void {
    void this.load();
  }

  protected onRowAction(zone: GeoZone, selection: ActionSelection): void {
    if (selection.id === 'open' || selection.id === 'edit') {
      this.openZone(zone);
      return;
    }
    if (selection.id === 'delete') {
      void this.requestDelete(zone);
    }
  }

  protected displayName(zone: GeoZone): string {
    return geoNameIn(zone, this.language());
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

  protected clearSearch(): void {
    if (this.searchTimer !== null) clearTimeout(this.searchTimer);
    this.searchTimer = null;
    this.search.set('');
    this.debouncedSearch.set('');
  }

  protected async requestDelete(zone: GeoZone): Promise<void> {
    if (!this.canManage || this.deleting()) return;
    this.pendingDeleteZone.set(zone);
    const confirmed = await this.deleteDialog().open();
    if (!confirmed) {
      this.pendingDeleteZone.set(null);
      return;
    }

    this.deleting.set(true);
    try {
      const signature = `delete:${zone.id}`;
      await deleteZone(zone.id, this.actionKeys.keyFor(signature));
      this.actionKeys.done(signature);
      this.notify.success(this.transloco.translate('geoZones.delete.done'));
      if (this.zoneModal().editingId() === zone.id) this.zoneModal().closeImmediate();
      await this.load();
    } catch (error) {
      this.notify.error(errorMessage(error, 'geoZones', this.transloco));
      if (errorCodeOf(error) === 'GEO_ZONE_NOT_FOUND') {
        if (this.zoneModal().editingId() === zone.id) this.zoneModal().closeImmediate();
        await this.load();
      }
    } finally {
      this.deleting.set(false);
      this.pendingDeleteZone.set(null);
    }
  }
}
