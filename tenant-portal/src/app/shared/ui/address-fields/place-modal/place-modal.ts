import { Component, ElementRef, Injector, afterNextRender, computed, inject, output, signal, viewChild } from '@angular/core';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerMapPin } from '@ng-icons/tabler-icons';
import { createCity, createDistrict } from '../../../../core/geo/geo.api';
import { GeoCity, GeoDistrict, GeoDistrictKind } from '../../../../core/geo/geo.model';
import { Notify } from '../../../../core/notify/notify';
import { ApiError, errorCodeOf, newIdempotencyKey } from '../../../../features/crm/settings/shared/settings-api';
import { Button } from '../../button/button';
import { Field } from '../../field/field';
import { Modal } from '../../modal/modal';
import { Segmented, SegmentedOption } from '../../segmented/segmented';

export interface PlaceModalOpenParams {
  kind: 'city' | 'district';
  parentId: string;
  parentLabel: string;
  initialText: string;
}

export type PlaceSavedEvent =
  | { kind: 'city'; city: GeoCity }
  | { kind: 'district'; district: GeoDistrict };

const NAME_MAX_LENGTH = 120;
const ARABIC_LETTER = /[\u0600-\u06FF]/;

@Component({
  selector: 'app-place-modal',
  imports: [TranslocoPipe, Modal, Field, Button, Segmented],
  providers: [provideTranslocoScope({ scope: 'geo', alias: 'geo' }), provideIcons({ tablerMapPin })],
  templateUrl: './place-modal.html',
})
export class PlaceModal {
  private static nextId = 0;
  protected readonly uid = `ui-place-modal-${++PlaceModal.nextId}`;

  private readonly modal = viewChild.required(Modal);
  private readonly nameEnInput = viewChild<ElementRef<HTMLInputElement>>('nameEnInput');
  private readonly injector = inject(Injector);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);

  readonly saved = output<PlaceSavedEvent>();
  readonly closed = output<void>();

  protected readonly maxLength = NAME_MAX_LENGTH;
  protected readonly kind = signal<'city' | 'district'>('city');
  protected readonly parentId = signal('');
  protected readonly parentLabel = signal('');
  protected readonly districtKind = signal<GeoDistrictKind>('DISTRICT');
  protected readonly nameEn = signal('');
  protected readonly nameAr = signal('');
  protected readonly errors = signal<{ nameEn?: string; nameAr?: string }>({});
  protected readonly saving = signal(false);

  protected readonly kindOptions = computed<SegmentedOption[]>(() => [
    { value: 'DISTRICT', label: this.translate('geo.place.kindDistrict') },
    { value: 'VILLAGE', label: this.translate('geo.place.kindVillage') },
  ]);

  private lastSignature = '';
  private lastIdempotencyKey = '';

  open(params: PlaceModalOpenParams): void {
    const trimmed = params.initialText.trim().slice(0, NAME_MAX_LENGTH);
    const isArabic = ARABIC_LETTER.test(trimmed);

    this.kind.set(params.kind);
    this.parentId.set(params.parentId);
    this.parentLabel.set(params.parentLabel);
    this.districtKind.set('DISTRICT');
    this.nameAr.set(isArabic ? trimmed : '');
    this.nameEn.set(!isArabic ? trimmed : '');
    this.errors.set({});
    this.saving.set(false);
    this.lastSignature = '';
    this.lastIdempotencyKey = '';
    this.modal().open();
    afterNextRender(() => {
      this.nameEnInput()?.nativeElement.focus();
    }, { injector: this.injector });
  }

  protected onNameEnInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.nameEn.set(value);
    if (this.errors().nameEn) {
      this.errors.update((curr) => ({ ...curr, nameEn: undefined }));
    }
  }

  protected onNameArInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.nameAr.set(value);
    if (this.errors().nameAr) {
      this.errors.update((curr) => ({ ...curr, nameAr: undefined }));
    }
  }

  protected onDistrictKindChange(next: string | null): void {
    if (next === 'DISTRICT' || next === 'VILLAGE') {
      this.districtKind.set(next);
    }
  }

  protected cancel(): void {
    if (!this.saving()) {
      this.modal().close();
    }
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.saving()) return;

    const nameEn = this.nameEn().trim();
    const nameAr = this.nameAr().trim();
    const nextErrors: { nameEn?: string; nameAr?: string } = {};
    if (!nameEn) nextErrors.nameEn = this.translate('geo.errors.GEO_NAME_REQUIRED');
    if (!nameAr) nextErrors.nameAr = this.translate('geo.errors.GEO_NAME_REQUIRED');
    if (nextErrors.nameEn || nextErrors.nameAr) {
      this.errors.set(nextErrors);
      return;
    }

    const kind = this.kind();
    const parentId = this.parentId();
    const districtKind = this.districtKind();
    const signature = `${kind}|${parentId}|${kind === 'district' ? districtKind : ''}|${nameEn}|${nameAr}`;
    if (signature !== this.lastSignature || !this.lastIdempotencyKey) {
      this.lastSignature = signature;
      this.lastIdempotencyKey = newIdempotencyKey();
    }

    this.errors.set({});
    this.saving.set(true);
    try {
      if (kind === 'city') {
        const city = await createCity({ stateId: parentId, nameEn, nameAr }, this.lastIdempotencyKey);
        this.modal().close();
        this.saved.emit({ kind: 'city', city });
      } else {
        const district = await createDistrict(
          { cityId: parentId, nameEn, nameAr, kind: districtKind },
          this.lastIdempotencyKey,
        );
        this.modal().close();
        this.saved.emit({ kind: 'district', district });
      }
    } catch (error) {
      this.handleError(error, nameEn, nameAr);
    } finally {
      this.saving.set(false);
    }
  }

  private handleError(error: unknown, nameEn: string, nameAr: string): void {
    const code = errorCodeOf(error);
    const message = this.resolveErrorText(code);

    if (code === 'GEO_PLACE_NAME_TAKEN' || code === 'GEO_NAME_REQUIRED' || code === 'GEO_NAME_TOO_LONG') {
      const lang = error instanceof ApiError ? error.details?.['language'] : undefined;
      if (lang === 'ar') {
        this.errors.set({ nameAr: message });
      } else if (lang === 'en') {
        this.errors.set({ nameEn: message });
      } else {
        this.errors.set({
          nameEn: !nameEn ? message : undefined,
          nameAr: !nameAr ? message : undefined,
        });
      }
      return;
    }

    this.notify.error(message);
  }

  private resolveErrorText(code: string | null): string {
    if (code) {
      const key = `geo.errors.${code}`;
      const translated = this.transloco.translate(key);
      if (translated && translated !== key) {
        return translated;
      }
    }
    return this.transloco.translate('geo.errors.generic');
  }

  private translate(key: string): string {
    return this.transloco.translate(key);
  }
}
