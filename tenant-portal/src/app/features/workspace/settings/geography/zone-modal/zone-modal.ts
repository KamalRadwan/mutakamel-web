import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerPolygon } from '@ng-icons/tabler-icons';
import { ApiError, errorCodeOf } from '../../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { AuthSession } from '../../../../../core/auth/auth-session';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { coreFieldErrors, fieldMessages, hasOtherFields } from '../../core-response.model';
import { CityPicker } from '../city-picker/city-picker';
import {
  GEO_LIMITS,
  GeoAdminApi,
  GeoZone,
  GeoZoneDetail,
  UpdateGeoZoneBody,
  invalidCityIdsOf,
  zoneConflictsOf,
} from '../geo-admin.api';
import { geoErrorMessage, zonesEditable } from '../geo-admin.model';

const ZONE_FIELDS = ['nameEn', 'nameAr', 'description', 'cityIds'] as const;

function cityIdsOf(zone: GeoZoneDetail): string[] {
  return zone.cities.map((city) => city.id);
}

function sameCitySet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((id) => setB.has(id));
}

/** View-is-edit modal for creating, viewing, updating, and deleting geography zones. */
@Component({
  selector: 'app-zone-modal',
  imports: [TranslocoPipe, Button, ConfirmDialog, Field, Modal, Switch, CityPicker],
  viewProviders: [
    provideTranslocoScope(
      'settings',
      { scope: 'ws-geo', alias: 'wsGeo' },
      { scope: 'ws-geo-zones', alias: 'geoZones' },
    ),
  ],
  providers: [provideIcons({ tablerPolygon })],
  templateUrl: './zone-modal.html',
})
export class ZoneModal {
  private readonly api = inject(GeoAdminApi);
  private static nextId = 0;
  protected readonly uid = `zone-modal-${++ZoneModal.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly modal = viewChild.required(Modal);
  private readonly discardDialog = viewChild.required<ConfirmDialog>('discardDialog');
  private readonly cityPicker = viewChild.required(CityPicker);

  readonly canManage = input(true);
  private readonly session = inject(AuthSession);
  protected readonly editable = computed(
    () => this.canManage() && zonesEditable(this.session.me()) && !this.api.zonesDenied(),
  );
  readonly saved = output<{ zone: GeoZoneDetail; isNew: boolean }>();
  readonly deletedRemotely = output<string>();
  readonly deleteRequested = output<GeoZoneDetail>();

  protected readonly nameMax = GEO_LIMITS.name;
  protected readonly descriptionMax = GEO_LIMITS.description;

  protected readonly mode = signal<'create' | 'edit'>('create');
  protected readonly editingZone = signal<GeoZoneDetail | null>(null);
  protected readonly loadingDetail = signal(false);
  protected readonly isActive = signal(true);
  protected readonly nameEn = signal('');
  protected readonly nameAr = signal('');
  protected readonly description = signal('');
  protected readonly cityIds = signal<string[]>([]);
  protected readonly saving = signal(false);

  protected readonly touched = signal<{
    nameEn?: boolean;
    nameAr?: boolean;
    description?: boolean;
  }>({});
  protected readonly submitted = signal(false);
  /** Already translated: our own keys, or the messages of CORE_VALIDATION_FAILED. */
  protected readonly serverErrors = signal<{
    nameEn?: string;
    nameAr?: string;
    description?: string;
    cityIds?: string;
  }>({});

  private allowClose = false;
  private confirmingDiscard = false;
  private pendingWrite: { key: string; bodyJson: string } | null = null;

  protected readonly nameEnCount = computed(() => this.nameEn().trim().length);
  protected readonly nameArCount = computed(() => this.nameAr().trim().length);
  protected readonly descriptionCount = computed(() => this.description().trim().length);

  protected readonly dirty = computed(() => {
    if (!this.editable()) return false;
    const en = this.nameEn().trim();
    const ar = this.nameAr().trim();
    const desc = this.description().trim();
    const cities = this.cityIds();

    if (this.mode() === 'create') {
      return (
        en.length > 0 || ar.length > 0 || desc.length > 0 || cities.length > 0 || !this.isActive()
      );
    }
    const base = this.editingZone();
    if (!base) return false;
    return (
      en !== base.nameEn ||
      ar !== base.nameAr ||
      (desc || null) !== (base.description || null) ||
      this.isActive() !== base.isActive ||
      !sameCitySet(cities, cityIdsOf(base))
    );
  });

  protected readonly isFormValid = computed(() => {
    const en = this.nameEn().trim();
    const ar = this.nameAr().trim();
    const desc = this.description().trim();
    return (
      en.length > 0 &&
      en.length <= this.nameMax &&
      ar.length > 0 &&
      ar.length <= this.nameMax &&
      desc.length <= this.descriptionMax &&
      this.cityIds().length <= GEO_LIMITS.zoneCities
    );
  });

  protected readonly nameEnError = computed(() => this.resolveNameError('nameEn', this.nameEn()));
  protected readonly nameArError = computed(() => this.resolveNameError('nameAr', this.nameAr()));
  protected readonly descriptionError = computed(() => {
    this.i18n();
    const server = this.serverErrors().description;
    if (server) return server;
    if (!this.submitted() && !this.touched().description) return null;
    if (this.description().trim().length > this.descriptionMax) {
      return this.transloco.translate('geoZones.maxLength', { max: this.descriptionMax });
    }
    return null;
  });

  openCreate(): void {
    this.allowClose = false;
    this.mode.set('create');
    this.editingZone.set(null);
    this.pendingWrite = null;
    this.resetFields({ nameEn: '', nameAr: '', description: '', isActive: true, cityIds: [] });
    this.modal().open();
    this.cityPicker().clearConflicts();
    this.focusNameEnAndReloadPicker();
  }

  /** The list row has no cities, so the modal loads GET zones/:id before it can be edited. */
  async openEdit(zone: GeoZone): Promise<void> {
    this.allowClose = false;
    this.mode.set('edit');
    this.pendingWrite = null;
    this.editingZone.set(null);
    this.resetFields({
      nameEn: zone.nameEn,
      nameAr: zone.nameAr,
      description: zone.description ?? '',
      isActive: zone.isActive,
      cityIds: [],
    });
    this.modal().open();
    this.cityPicker().clearConflicts();
    this.loadingDetail.set(true);
    try {
      const detail = await this.api.getZone(zone.id);
      this.editingZone.set(detail);
      this.resetFields({
        nameEn: detail.nameEn,
        nameAr: detail.nameAr,
        description: detail.description ?? '',
        isActive: detail.isActive,
        cityIds: cityIdsOf(detail),
      });
      this.focusNameEnAndReloadPicker();
    } catch (error) {
      this.notify.error(geoErrorMessage(error, 'geoZones', this.transloco));
      if (errorCodeOf(error) === 'GEO_ZONE_NOT_FOUND') this.deletedRemotely.emit(zone.id);
      this.closeImmediate();
    } finally {
      this.loadingDetail.set(false);
    }
  }

  closeImmediate(): void {
    this.allowClose = true;
    this.modal().close();
  }

  editingId(): string | null {
    return this.editingZone()?.id ?? null;
  }

  protected onNameInput(field: 'nameEn' | 'nameAr', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (field === 'nameEn') this.nameEn.set(value);
    else this.nameAr.set(value);
    if (this.serverErrors()[field]) {
      this.serverErrors.update((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  protected onDescriptionInput(event: Event): void {
    this.description.set((event.target as HTMLTextAreaElement).value);
    if (this.serverErrors().description) {
      this.serverErrors.update((prev) => ({ ...prev, description: undefined }));
    }
  }

  protected markTouched(field: 'nameEn' | 'nameAr' | 'description'): void {
    this.touched.update((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  }

  protected undo(): void {
    this.cityPicker().clearConflicts();
    if (this.mode() === 'create') {
      this.resetFields({ nameEn: '', nameAr: '', description: '', isActive: true, cityIds: [] });
      return;
    }
    const base = this.editingZone();
    if (!base) return;
    this.resetFields({
      nameEn: base.nameEn,
      nameAr: base.nameAr,
      description: base.description ?? '',
      isActive: base.isActive,
      cityIds: cityIdsOf(base),
    });
  }

  protected async requestClose(): Promise<void> {
    if (this.saving()) return;
    if (this.dirty() && !(await this.confirmDiscard())) return;
    this.closeImmediate();
  }

  protected requestDelete(): void {
    const base = this.editingZone();
    if (!base || this.saving() || !this.editable()) return;
    this.deleteRequested.emit(base);
  }

  protected onModalClosed(): void {
    if (!this.allowClose && this.saving()) {
      this.modal().open();
      return;
    }
    if (!this.allowClose && this.dirty()) {
      this.modal().open();
      void this.confirmDiscardAndClose();
      return;
    }
    this.allowClose = false;
    this.editingZone.set(null);
    this.cityPicker().clearConflicts();
  }

  protected async save(event?: Event): Promise<void> {
    event?.preventDefault();
    if (!this.editable() || this.saving() || this.loadingDetail()) return;

    this.submitted.set(true);
    this.serverErrors.set({});
    this.cityPicker().clearConflicts();

    const nameEn = this.nameEn().trim();
    const nameAr = this.nameAr().trim();
    const rawDescription = this.description().trim();
    const cityIds = Array.from(new Set(this.cityIds())).sort();

    if (!this.isFormValid()) return;

    this.saving.set(true);
    try {
      if (this.mode() === 'create') {
        const body = {
          nameEn,
          nameAr,
          description: rawDescription || null,
          isActive: this.isActive(),
          cityIds,
        };
        const key = this.keyForBody(body);
        const created = await this.api.createZone(body, key);
        this.pendingWrite = null;
        this.notify.success(this.transloco.translate('geoZones.created'));
        this.saved.emit({ zone: created, isNew: true });
        this.closeImmediate();
        return;
      }

      const base = this.editingZone();
      if (!base) return;

      const patch: UpdateGeoZoneBody = {};
      if (nameEn !== base.nameEn) patch.nameEn = nameEn;
      if (nameAr !== base.nameAr) patch.nameAr = nameAr;
      const nextDesc = rawDescription || null;
      if (nextDesc !== (base.description || null)) patch.description = nextDesc;
      if (this.isActive() !== base.isActive) patch.isActive = this.isActive();
      if (!sameCitySet(cityIds, cityIdsOf(base))) patch.cityIds = cityIds;

      if (Object.keys(patch).length === 0) return;

      const updated = await this.api.updateZone(base.id, patch, this.keyForBody(patch));
      this.pendingWrite = null;
      this.notify.success(this.transloco.translate('geoZones.saved'));
      this.saved.emit({ zone: updated, isNew: false });
      this.closeImmediate();
    } catch (error) {
      await this.handleSaveError(error);
    } finally {
      this.saving.set(false);
    }
  }

  private async handleSaveError(error: unknown): Promise<void> {
    const code = errorCodeOf(error);
    const details = error instanceof ApiError ? error.details : undefined;

    // GeoService sends no language detail: either name may be the one taken.
    if (code === 'GEO_ZONE_NAME_TAKEN') {
      const taken = this.transloco.translate('geoZones.nameTaken');
      this.serverErrors.set({ nameEn: taken, nameAr: taken });
      return;
    }

    const fields = coreFieldErrors(error);
    if (fields) {
      const messages = fieldMessages(fields, ZONE_FIELDS);
      this.serverErrors.set(messages);
      if (messages.cityIds) this.notify.error(messages.cityIds);
      if (hasOtherFields(fields, ZONE_FIELDS))
        this.notify.error(geoErrorMessage(error, 'geoZones', this.transloco, true));
      return;
    }

    if (code === 'GEO_ZONE_CITY_CONFLICT') {
      const conflicts = zoneConflictsOf(details);
      for (const conflict of conflicts)
        this.cityPicker().markConflict(conflict.cityId, conflict.zoneId);
      const first = conflicts[0];
      if (first) {
        const names = await this.cityPicker().resolveConflictNames(first.cityId, first.zoneId);
        void this.cityPicker().reloadContext();
        const key = names.zone
          ? 'geoZones.errors.GEO_ZONE_CITY_CONFLICT'
          : 'geoZones.errors.GEO_ZONE_CITY_CONFLICT_OTHER';
        this.notify.error(
          this.transloco.translate(key, {
            city: names.city,
            zone: names.zone ?? '',
            count: conflicts.length,
          }),
        );
        return;
      }
    }

    if (code === 'GEO_ZONE_CITY_INVALID') {
      for (const cityId of invalidCityIdsOf(details)) this.cityPicker().markInvalid(cityId);
      void this.cityPicker().reloadContext();
      this.notify.error(this.transloco.translate('geoZones.errors.GEO_ZONE_CITY_INVALID'));
      return;
    }

    this.notify.error(geoErrorMessage(error, 'geoZones', this.transloco, true));
    if (code === 'GEO_ZONE_NOT_FOUND') {
      const id = this.editingZone()?.id;
      if (id) this.deletedRemotely.emit(id);
      this.closeImmediate();
    }
  }

  private resolveNameError(field: 'nameEn' | 'nameAr', raw: string): string | null {
    this.i18n();
    const server = this.serverErrors()[field];
    if (server) return server;
    if (!this.submitted() && !this.touched()[field]) return null;
    const trimmed = raw.trim();
    if (!trimmed) return this.transloco.translate('geoZones.required');
    if (trimmed.length > this.nameMax) {
      return this.transloco.translate('geoZones.maxLength', { max: this.nameMax });
    }
    return null;
  }

  private resetFields(values: {
    nameEn: string;
    nameAr: string;
    description: string;
    isActive: boolean;
    cityIds: string[];
  }): void {
    this.isActive.set(values.isActive);
    this.nameEn.set(values.nameEn);
    this.nameAr.set(values.nameAr);
    this.description.set(values.description);
    this.cityIds.set(values.cityIds);
    this.touched.set({});
    this.submitted.set(false);
    this.serverErrors.set({});
  }

  private keyForBody(body: unknown): string {
    const bodyJson = JSON.stringify(body);
    if (this.pendingWrite?.bodyJson !== bodyJson)
      this.pendingWrite = { key: newIdempotencyKey(), bodyJson };
    return this.pendingWrite.key;
  }

  private focusNameEnAndReloadPicker(): void {
    afterNextRender(
      () => {
        this.host.nativeElement.querySelector<HTMLInputElement>(`#${this.uid}-name-en`)?.focus();
        void this.cityPicker().reloadContext();
      },
      { injector: this.injector },
    );
  }

  private async confirmDiscardAndClose(): Promise<void> {
    if (await this.confirmDiscard()) {
      this.closeImmediate();
    }
  }

  private async confirmDiscard(): Promise<boolean> {
    if (this.confirmingDiscard) return false;
    this.confirmingDiscard = true;
    try {
      return await this.discardDialog().open();
    } finally {
      this.confirmingDiscard = false;
    }
  }
}
