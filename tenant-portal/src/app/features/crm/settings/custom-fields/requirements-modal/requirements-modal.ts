import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { errorCodeOf } from '../../shared/settings-api';
import { SettingsNotice } from '../../../../../shared/ui/settings-notice/settings-notice';
import { setRequirement } from '../custom-fields.api';
import {
  CREATABLE_OWNER_TYPES,
  CustomField,
  RequirementOperation,
  globalRequirement,
  localizedName,
  mergeRequirementRow,
  scopedRequirements,
} from '../custom-fields.model';

@Component({
  selector: 'app-requirements-modal',
  imports: [TranslocoPipe, Modal, Button, Field, Switch, SettingsNotice],
  templateUrl: './requirements-modal.html',
})
export class RequirementsModal {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly notify = inject(Notify);
  private readonly language = inject(LanguageState).current;
  private readonly modal = viewChild.required(Modal);

  readonly canManage = input(true);
  readonly updated = output<CustomField>();

  protected readonly field = signal<CustomField | null>(null);
  protected readonly pendingOp = signal<RequirementOperation | null>(null);
  protected readonly createRequired = signal(false);
  protected readonly updateRequired = signal(false);
  protected readonly convertRequired = signal(false);

  protected readonly title = computed(() => {
    this.i18n();
    const current = this.field();
    if (!current) return '';
    return this.transloco.translate('customFields.requirements.title', {
      name: localizedName(current, this.language()),
    });
  });

  protected readonly showConvert = computed(() => this.field()?.ownerType !== 'OPPORTUNITY');
  protected readonly isArchived = computed(() => {
    const current = this.field();
    return current ? !current.isActive : false;
  });
  protected readonly scopedRules = computed(() => {
    const current = this.field();
    return current ? scopedRequirements(current) : [];
  });

  open(field: CustomField): void {
    this.syncField(field);
    this.pendingOp.set(null);
    this.modal().open();
  }

  protected close(): void {
    this.modal().close();
  }

  protected scopeLabel(scope: string | null): string {
    if (!scope) return '';
    if ((CREATABLE_OWNER_TYPES as readonly string[]).includes(scope) || scope === 'LEAD_AND_PARTY') {
      return this.transloco.translate(`customFields.ownerTypes.${scope}`);
    }
    return scope;
  }

  protected async toggleRequirement(operation: RequirementOperation, nextValue: boolean): Promise<void> {
    const current = this.field();
    if (!current || !this.canManage() || !current.isActive || this.pendingOp() !== null) {
      this.setLocalFlag(operation, !nextValue);
      return;
    }

    this.setLocalFlag(operation, nextValue);
    this.pendingOp.set(operation);
    try {
      // The backend returns only the saved requirement row; merge it into the field.
      const row = await setRequirement(current.id, { operation, entityScope: null, isRequired: nextValue });
      const saved = mergeRequirementRow(this.field() ?? current, row);
      this.syncField(saved);
      this.updated.emit(saved);
      this.notify.success(this.transloco.translate('customFields.requirements.saved'));
    } catch (error) {
      this.setLocalFlag(operation, !nextValue);
      this.notify.error(this.resolveError(error));
    } finally {
      this.pendingOp.set(null);
    }
  }

  private syncField(field: CustomField): void {
    this.field.set(field);
    this.createRequired.set(globalRequirement(field, 'CREATE'));
    this.updateRequired.set(globalRequirement(field, 'UPDATE'));
    this.convertRequired.set(globalRequirement(field, 'CONVERT'));
  }

  private setLocalFlag(operation: RequirementOperation, value: boolean): void {
    if (operation === 'CREATE') this.createRequired.set(value);
    else if (operation === 'UPDATE') this.updateRequired.set(value);
    else this.convertRequired.set(value);
  }

  private resolveError(error: unknown): string {
    const code = errorCodeOf(error);
    if (code) {
      const key = `customFields.errors.${code}`;
      const translated = this.transloco.translate(key);
      if (translated !== key) return translated;
      if (code === 'CUSTOM_FIELD_NOT_FOUND') return this.transloco.translate('settings.errors.notFound');
    }
    return this.transloco.translate('settings.errors.generic');
  }
}
