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
import { tablerBuildingCommunity, tablerHome } from '@ng-icons/tabler-icons';
import { errorCodeOf } from '../../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { AuthSession } from '../../../../../core/auth/auth-session';
import { GeoCity, GeoDistrict, GeoDistrictKind } from '../../../../../core/geo/geo.model';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Segmented, SegmentedOption } from '../../../../../shared/ui/segmented/segmented';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { coreFieldErrors, fieldMessages, hasOtherFields } from '../../core-response.model';
import {
  GEO_LIMITS,
  GeoAdminApi,
  UpdateGeoCityBody,
  UpdateGeoDistrictBody,
} from '../geo-admin.api';
import { geoErrorMessage, placesEditable } from '../geo-admin.model';

export type PlaceEntityType = 'city' | 'district';

interface ServerFieldError {
  en?: string;
  ar?: string;
}

@Component({
  selector: 'app-place-form-modal',
  imports: [TranslocoPipe, Button, ConfirmDialog, Field, Modal, Segmented, Switch],
  viewProviders: [
    provideTranslocoScope({ scope: 'ws-geo', alias: 'wsGeo' }, 'settings', {
      scope: 'ws-geo-places',
      alias: 'geoPlaces',
    }),
    provideIcons({ tablerBuildingCommunity, tablerHome }),
  ],
  templateUrl: './place-form-modal.html',
})
export class PlaceFormModal {
  private readonly api = inject(GeoAdminApi);
  private static nextId = 0;
  protected readonly uid = `place-form-modal-${++PlaceFormModal.nextId}`;

  private readonly injector = inject(Injector);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly modal = viewChild.required(Modal);
  private readonly deactivateDialog = viewChild.required<ConfirmDialog>('deactivateDialog');
  private readonly discardDialog = viewChild.required<ConfirmDialog>('discardDialog');
  private readonly nameEnInput = viewChild<ElementRef<HTMLInputElement>>('nameEnInput');

  readonly canManage = input(true);
  private readonly session = inject(AuthSession);
  protected readonly editable = computed(
    () => this.canManage() && placesEditable(this.session.me()) && !this.api.placesDenied(),
  );
  readonly locationPath = input('');

  readonly citySaved = output<{ city: GeoCity; isNew: boolean }>();
  readonly districtSaved = output<{ district: GeoDistrict; isNew: boolean }>();
  readonly cityDeleteRequested = output<GeoCity>();
  readonly districtDeleteRequested = output<GeoDistrict>();
  readonly notFound = output<string>();

  protected readonly maxNameLength = GEO_LIMITS.name;
  protected readonly entityType = signal<PlaceEntityType>('city');
  protected readonly mode = signal<'create' | 'edit'>('create');
  protected readonly parentId = signal('');
  protected readonly contextLocationPath = signal('');
  protected readonly city = signal<GeoCity | null>(null);
  protected readonly district = signal<GeoDistrict | null>(null);
  protected readonly initialCreateKind = signal<GeoDistrictKind>('DISTRICT');

  protected readonly kind = signal<GeoDistrictKind>('DISTRICT');
  protected readonly nameEn = signal('');
  protected readonly nameAr = signal('');
  protected readonly isActive = signal(true);
  protected readonly touched = signal<{ en?: boolean; ar?: boolean }>({});
  protected readonly submitted = signal(false);
  protected readonly saving = signal(false);
  protected readonly parentError = signal<string | null>(null);
  protected readonly serverErrors = signal<ServerFieldError>({});

  private allowClose = false;
  private confirmingDiscard = false;
  private pendingWrite: { key: string; bodyJson: string } | null = null;

  protected readonly isReadOnly = computed(() => !this.editable());

  protected readonly resolvedLocationPath = computed(
    () => this.locationPath() || this.contextLocationPath(),
  );

  protected readonly modalIcon = computed(() =>
    this.entityType() === 'city' ? 'tablerBuildingCommunity' : 'tablerHome',
  );

  protected readonly modalTitle = computed(() => {
    this.i18n();
    const isCity = this.entityType() === 'city';
    const isCreate = this.mode() === 'create';
    const key = isCity
      ? isCreate
        ? 'geoPlaces.modal.newCity'
        : 'geoPlaces.modal.city'
      : isCreate
        ? 'geoPlaces.modal.newDistrict'
        : 'geoPlaces.modal.district';
    return this.transloco.translate(key);
  });

  protected readonly kindOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    const locked = this.isReadOnly() || this.saving();
    return [
      {
        value: 'DISTRICT',
        label: this.transloco.translate('geoPlaces.kind.DISTRICT'),
        disabled: locked,
      },
      {
        value: 'VILLAGE',
        label: this.transloco.translate('geoPlaces.kind.VILLAGE'),
        disabled: locked,
      },
    ];
  });

  protected readonly dirty = computed(() => {
    const trimmedEn = this.nameEn().trim();
    const trimmedAr = this.nameAr().trim();
    if (this.mode() === 'create') {
      if (trimmedEn.length > 0 || trimmedAr.length > 0) return true;
      return this.entityType() === 'district' && this.kind() !== this.initialCreateKind();
    }
    if (this.isReadOnly()) return false;
    if (this.entityType() === 'city') {
      const current = this.city();
      if (!current) return false;
      return (
        trimmedEn !== current.nameEn ||
        trimmedAr !== current.nameAr ||
        this.isActive() !== current.isActive
      );
    }
    const current = this.district();
    if (!current) return false;
    return (
      this.kind() !== current.kind ||
      trimmedEn !== current.nameEn ||
      trimmedAr !== current.nameAr ||
      this.isActive() !== current.isActive
    );
  });

  protected readonly isValid = computed(() => {
    const trimmedEn = this.nameEn().trim();
    const trimmedAr = this.nameAr().trim();
    return (
      trimmedEn.length > 0 &&
      trimmedEn.length <= this.maxNameLength &&
      trimmedAr.length > 0 &&
      trimmedAr.length <= this.maxNameLength
    );
  });

  protected readonly nameEnError = computed(() => this.resolveFieldError('en', this.nameEn()));
  protected readonly nameArError = computed(() => this.resolveFieldError('ar', this.nameAr()));

  openCreateCity(context: { stateId: string; locationPath?: string }): void {
    this.entityType.set('city');
    this.mode.set('create');
    this.parentId.set(context.stateId);
    this.contextLocationPath.set(context.locationPath ?? '');
    this.city.set(null);
    this.district.set(null);
    this.resetCreateFields('DISTRICT');
    this.openDialogAndFocus();
  }

  openEditCity(city: GeoCity, context?: { locationPath?: string }): void {
    this.entityType.set('city');
    this.mode.set('edit');
    this.parentId.set(city.stateId);
    this.contextLocationPath.set(context?.locationPath ?? '');
    this.city.set(city);
    this.district.set(null);
    this.resetFromCity(city);
    this.openDialogAndFocus();
  }

  openCreateDistrict(context: {
    cityId: string;
    locationPath?: string;
    defaultKind?: GeoDistrictKind;
  }): void {
    const defaultKind = context.defaultKind ?? 'DISTRICT';
    this.entityType.set('district');
    this.mode.set('create');
    this.parentId.set(context.cityId);
    this.contextLocationPath.set(context.locationPath ?? '');
    this.city.set(null);
    this.district.set(null);
    this.resetCreateFields(defaultKind);
    this.openDialogAndFocus();
  }

  openEditDistrict(district: GeoDistrict, context?: { locationPath?: string }): void {
    this.entityType.set('district');
    this.mode.set('edit');
    this.parentId.set(district.cityId);
    this.contextLocationPath.set(context?.locationPath ?? '');
    this.city.set(null);
    this.district.set(district);
    this.resetFromDistrict(district);
    this.openDialogAndFocus();
  }

  close(): void {
    this.allowClose = true;
    this.modal().close();
  }

  protected undo(): void {
    if (this.saving()) return;
    if (this.mode() === 'create') {
      this.resetCreateFields(this.initialCreateKind());
      return;
    }
    if (this.entityType() === 'city') {
      const current = this.city();
      if (current) this.resetFromCity(current);
      return;
    }
    const current = this.district();
    if (current) this.resetFromDistrict(current);
  }

  protected markTouched(field: 'en' | 'ar'): void {
    this.touched.update((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  }

  protected onNameInput(field: 'en' | 'ar', event: Event): void {
    if (this.isReadOnly()) return;
    const value = (event.target as HTMLInputElement).value;
    if (field === 'en') this.nameEn.set(value);
    else this.nameAr.set(value);
    this.serverErrors.update((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  protected onKindChange(next: string | null): void {
    if (this.isReadOnly() || this.saving()) return;
    if (next === 'DISTRICT' || next === 'VILLAGE') {
      this.kind.set(next);
    }
  }

  protected async save(event?: Event): Promise<void> {
    event?.preventDefault();
    if (this.saving() || this.isReadOnly()) return;

    this.submitted.set(true);
    if (!this.isValid()) return;
    if (this.mode() === 'edit' && !this.dirty()) return;

    if (
      this.entityType() === 'city' &&
      this.mode() === 'edit' &&
      this.city()?.isActive &&
      !this.isActive()
    ) {
      if (!(await this.deactivateDialog().open())) return;
      if (this.isReadOnly()) return;
    }
    const trimmedEn = this.nameEn().trim();
    const trimmedAr = this.nameAr().trim();
    this.serverErrors.set({});
    this.parentError.set(null);
    this.saving.set(true);

    try {
      if (this.entityType() === 'city') {
        await this.saveCity(trimmedEn, trimmedAr);
      } else {
        await this.saveDistrict(trimmedEn, trimmedAr);
      }
    } catch (error) {
      this.handleSaveError(error);
    } finally {
      this.saving.set(false);
    }
  }

  protected requestDelete(): void {
    if (this.saving() || this.isReadOnly() || this.mode() !== 'edit') return;
    if (this.entityType() === 'city') {
      const current = this.city();
      if (current) this.cityDeleteRequested.emit(current);
      return;
    }
    const current = this.district();
    if (current) this.districtDeleteRequested.emit(current);
  }

  protected requestClose(): void {
    if (this.saving()) return;
    if (this.dirty() && !this.isReadOnly()) {
      void this.confirmDiscardAndClose();
      return;
    }
    this.close();
  }

  protected onModalClosed(): void {
    if (!this.allowClose && this.dirty() && !this.isReadOnly()) {
      this.modal().open();
      void this.confirmDiscardAndClose();
      return;
    }
    this.allowClose = false;
  }

  private openDialogAndFocus(): void {
    this.allowClose = false;
    this.pendingWrite = null;
    this.parentError.set(null);
    this.modal().open();
    if (!this.isReadOnly()) {
      afterNextRender(() => this.nameEnInput()?.nativeElement.focus(), { injector: this.injector });
    }
  }

  private async saveCity(trimmedEn: string, trimmedAr: string): Promise<void> {
    if (this.mode() === 'create') {
      const stateId = this.parentId();
      const body = { stateId, nameEn: trimmedEn, nameAr: trimmedAr, isActive: this.isActive() };
      const key = this.keyForBody(body);
      const created = await this.api.createCity(body, key);
      this.pendingWrite = null;
      this.notify.success(this.transloco.translate('geoPlaces.created'));
      this.citySaved.emit({ city: created, isNew: true });
      this.close();
      return;
    }

    const current = this.city();
    if (!current) return;
    const patch: UpdateGeoCityBody = {};
    if (trimmedEn !== current.nameEn) patch.nameEn = trimmedEn;
    if (trimmedAr !== current.nameAr) patch.nameAr = trimmedAr;
    if (this.isActive() !== current.isActive) patch.isActive = this.isActive();
    if (Object.keys(patch).length === 0) return;

    const updated = await this.api.updateCity(current.id, patch, this.keyForBody(patch));
    this.pendingWrite = null;
    this.notify.success(this.transloco.translate('geoPlaces.saved'));
    this.citySaved.emit({ city: updated, isNew: false });
    this.close();
  }

  private async saveDistrict(trimmedEn: string, trimmedAr: string): Promise<void> {
    if (this.mode() === 'create') {
      const cityId = this.parentId();
      const kind = this.kind();
      const body = {
        cityId,
        kind,
        nameEn: trimmedEn,
        nameAr: trimmedAr,
        isActive: this.isActive(),
      };
      const key = this.keyForBody(body);
      const created = await this.api.createDistrict(body, key);
      this.pendingWrite = null;
      this.notify.success(this.transloco.translate('geoPlaces.created'));
      this.districtSaved.emit({ district: created, isNew: true });
      this.close();
      return;
    }

    const current = this.district();
    if (!current) return;
    const patch: UpdateGeoDistrictBody = {};
    if (this.kind() !== current.kind) patch.kind = this.kind();
    if (trimmedEn !== current.nameEn) patch.nameEn = trimmedEn;
    if (trimmedAr !== current.nameAr) patch.nameAr = trimmedAr;
    if (this.isActive() !== current.isActive) patch.isActive = this.isActive();
    if (Object.keys(patch).length === 0) return;

    const updated = await this.api.updateDistrict(current.id, patch, this.keyForBody(patch));
    this.pendingWrite = null;
    this.notify.success(this.transloco.translate('geoPlaces.saved'));
    this.districtSaved.emit({ district: updated, isNew: false });
    this.close();
  }

  private keyForBody(body: unknown): string {
    const bodyJson = JSON.stringify(body);
    if (this.pendingWrite?.bodyJson !== bodyJson)
      this.pendingWrite = { key: newIdempotencyKey(), bodyJson };
    return this.pendingWrite.key;
  }

  private handleSaveError(error: unknown): void {
    const code = errorCodeOf(error);
    if (code === 'GEO_PARENT_INACTIVE') {
      this.parentError.set(geoErrorMessage(error, 'geoPlaces', this.transloco, true));
      return;
    }

    // The backend sends no language detail: either name may be the one taken.
    if (code === 'GEO_CITY_NAME_TAKEN' || code === 'GEO_DISTRICT_NAME_TAKEN') {
      const taken = this.transloco.translate('geoPlaces.nameTaken');
      this.serverErrors.set({ en: taken, ar: taken });
      return;
    }

    const fields = coreFieldErrors(error);
    if (fields) {
      const messages = fieldMessages(fields, ['nameEn', 'nameAr'] as const);
      this.serverErrors.set({ en: messages.nameEn, ar: messages.nameAr });
      if (hasOtherFields(fields, ['nameEn', 'nameAr']))
        this.notify.error(this.resolveToastError(error));
      return;
    }

    this.notify.error(this.resolveToastError(error));
    const parentMissing =
      (code === 'GEO_STATE_NOT_FOUND' &&
        this.entityType() === 'city' &&
        this.mode() === 'create') ||
      (code === 'GEO_CITY_NOT_FOUND' && this.entityType() === 'district');
    const selfMissing = code === 'GEO_CITY_NOT_FOUND' || code === 'GEO_DISTRICT_NOT_FOUND';
    if (parentMissing || selfMissing) {
      const missingId = parentMissing
        ? this.parentId()
        : (this.city()?.id ?? this.district()?.id ?? this.parentId());
      if (missingId) this.notFound.emit(missingId);
      this.close();
    }
  }

  private resolveToastError(error: unknown): string {
    return geoErrorMessage(error, 'geoPlaces', this.transloco, true);
  }

  private async confirmDiscardAndClose(): Promise<void> {
    if (this.confirmingDiscard) return;
    this.confirmingDiscard = true;
    try {
      if (await this.discardDialog().open()) {
        this.close();
      }
    } finally {
      this.confirmingDiscard = false;
    }
  }

  private resetCreateFields(defaultKind: GeoDistrictKind): void {
    this.initialCreateKind.set(defaultKind);
    this.kind.set(defaultKind);
    this.nameEn.set('');
    this.nameAr.set('');
    this.isActive.set(true);
    this.touched.set({});
    this.submitted.set(false);
    this.serverErrors.set({});
  }

  private resetFromCity(city: GeoCity): void {
    this.kind.set('DISTRICT');
    this.nameEn.set(city.nameEn);
    this.nameAr.set(city.nameAr);
    this.isActive.set(city.isActive);
    this.touched.set({});
    this.submitted.set(false);
    this.serverErrors.set({});
  }

  private resetFromDistrict(district: GeoDistrict): void {
    this.kind.set(district.kind);
    this.nameEn.set(district.nameEn);
    this.nameAr.set(district.nameAr);
    this.isActive.set(district.isActive);
    this.touched.set({});
    this.submitted.set(false);
    this.serverErrors.set({});
  }

  private resolveFieldError(field: 'en' | 'ar', raw: string): string | null {
    this.i18n();
    const server = this.serverErrors()[field];
    if (server) return server;

    const show = this.submitted() || Boolean(this.touched()[field]);
    if (!show) return null;

    const trimmed = raw.trim();
    if (!trimmed) return this.transloco.translate('geoPlaces.required');
    if (trimmed.length > this.maxNameLength)
      return this.transloco.translate('geoPlaces.errors.GEO_NAME_TOO_LONG');
    return null;
  }
}
