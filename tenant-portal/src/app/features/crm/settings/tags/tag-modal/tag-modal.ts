import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerAlertTriangle, tablerCheck, tablerTag } from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { fieldErrorsOf, isValidationError } from '../../../../../core/api/api-errors';
import { errorCodeOf } from '../../shared/settings-api';
import { TAG_PRESETS, contrastRatio, isValidHexColor, normalizeHexColor, presetOf } from '../tag-colors';
import { createTag, tagErrorMessage, updateTag } from '../tags.api';
import { CreateTagInput, MAX_TAG_NAME_LENGTH, MIN_CONTRAST_RATIO, Tag, UpdateTagInput } from '../tags.model';

type ColorMode = 'none' | 'preset' | 'custom';

const DEFAULT_PRESET_KEY = 'blue';
const DEFAULT_CUSTOM_BG = '#DBEAFE';
const DEFAULT_CUSTOM_TEXT = '#1E40AF';

function normalizePrefixedHex(raw: string): string | null {
  const value = normalizeHexColor(raw);
  if (!value) return null;
  return /^[0-9A-F]{6}$/.test(value) ? `#${value}` : value;
}

@Component({
  selector: 'app-tag-modal',
  imports: [NgIcon, TranslocoPipe, Button, ConfirmDialog, Field, Modal],
  providers: [provideIcons({ tablerTag, tablerCheck, tablerAlertTriangle })],
  templateUrl: './tag-modal.html',
})
export class TagModal {
  private static nextId = 0;
  protected readonly uid = `tag-modal-${++TagModal.nextId}`;

  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly modal = viewChild.required<Modal>('modal');
  private readonly discardDialog = viewChild.required<ConfirmDialog>('discardDialog');

  readonly canManage = input(true);
  readonly saved = output<Tag>();
  readonly deletedRemotely = output<void>();
  readonly deleteRequested = output<Tag>();

  protected readonly presets = TAG_PRESETS;
  protected readonly maxNameLength = MAX_TAG_NAME_LENGTH;

  protected readonly editingTag = signal<Tag | null>(null);
  protected readonly name = signal('');
  protected readonly colorMode = signal<ColorMode>('none');
  protected readonly selectedPreset = signal<string>(DEFAULT_PRESET_KEY);
  protected readonly customBg = signal(DEFAULT_CUSTOM_BG);
  protected readonly customText = signal(DEFAULT_CUSTOM_TEXT);
  protected readonly touched = signal<{ name?: boolean; bg?: boolean; text?: boolean }>({});
  protected readonly submitAttempted = signal(false);
  protected readonly nameServerError = signal<string | null>(null);
  protected readonly saving = signal(false);

  private allowClose = false;
  private confirmingDiscard = false;

  protected readonly isEdit = computed(() => this.editingTag() !== null);
  protected readonly nameCount = computed(() => [...this.name()].length);

  protected readonly activePreset = computed(
    () => TAG_PRESETS.find((preset) => preset.key === this.selectedPreset()) ?? TAG_PRESETS[0],
  );

  protected readonly validCustomBg = computed(() => {
    const value = normalizePrefixedHex(this.customBg());
    return value && isValidHexColor(value) ? value : null;
  });

  protected readonly validCustomText = computed(() => {
    const value = normalizePrefixedHex(this.customText());
    return value && isValidHexColor(value) ? value : null;
  });

  protected readonly previewColors = computed<{ bg: string; text: string } | null>(() => {
    const mode = this.colorMode();
    if (mode === 'none') return null;
    if (mode === 'preset') {
      const preset = this.activePreset();
      return { bg: preset.bg, text: preset.text };
    }
    const bg = this.validCustomBg();
    const text = this.validCustomText();
    return bg && text ? { bg, text } : null;
  });

  protected readonly lowContrast = computed(() => {
    const colors = this.previewColors();
    return colors !== null && contrastRatio(colors.bg, colors.text) < MIN_CONTRAST_RATIO;
  });

  protected readonly dirty = computed(() => {
    const base = this.editingTag();
    const trimmedName = this.name().trim();
    if (!base) {
      return trimmedName.length > 0 || this.colorMode() !== 'none';
    }
    if (trimmedName !== base.name) {
      return true;
    }
    const current = this.currentColorValues();
    return current.backgroundColor !== base.backgroundColor || current.textColor !== base.textColor;
  });

  openCreate(): void {
    this.editingTag.set(null);
    this.name.set('');
    this.colorMode.set('none');
    this.selectedPreset.set(DEFAULT_PRESET_KEY);
    this.customBg.set(DEFAULT_CUSTOM_BG);
    this.customText.set(DEFAULT_CUSTOM_TEXT);
    this.resetValidation();
    this.allowClose = false;
    this.modal().open();
  }

  openEdit(tag: Tag): void {
    this.editingTag.set(tag);
    this.applyTagToForm(tag);
    this.resetValidation();
    this.allowClose = false;
    this.modal().open();
  }

  close(): void {
    this.allowClose = true;
    this.modal().close();
  }

  editingId(): string | null {
    return this.editingTag()?.id ?? null;
  }

  protected undo(): void {
    const base = this.editingTag();
    if (!base) return;
    this.applyTagToForm(base);
    this.resetValidation();
  }

  protected requestClose(): void {
    if (!this.canManage() || !this.dirty()) {
      this.close();
      return;
    }
    void this.confirmDiscardAndClose();
  }

  protected onModalClosed(): void {
    if (!this.allowClose && this.canManage() && this.dirty()) {
      this.modal().open();
      void this.confirmDiscardAndClose();
      return;
    }
    this.allowClose = false;
    this.editingTag.set(null);
    this.resetValidation();
  }

  protected onNameInput(event: Event): void {
    if (!this.canManage()) return;
    const inputEl = event.target as HTMLInputElement;
    this.name.set(inputEl.value);
    this.nameServerError.set(null);
  }

  protected selectNoColor(): void {
    if (!this.canManage()) return;
    this.colorMode.set('none');
  }

  protected selectPreset(key: string): void {
    if (!this.canManage()) return;
    this.selectedPreset.set(key);
    this.colorMode.set('preset');
  }

  protected selectCustom(): void {
    if (!this.canManage()) return;
    if (this.colorMode() === 'preset') {
      const preset = this.activePreset();
      this.customBg.set(preset.bg);
      this.customText.set(preset.text);
    }
    this.colorMode.set('custom');
  }

  protected onHexInput(field: 'bg' | 'text', event: Event): void {
    if (!this.canManage()) return;
    const inputEl = event.target as HTMLInputElement;
    const upper = inputEl.value.toUpperCase();
    if (field === 'bg') {
      this.customBg.set(upper);
    } else {
      this.customText.set(upper);
    }
  }

  protected onHexBlur(field: 'bg' | 'text'): void {
    this.markTouched(field);
    const current = field === 'bg' ? this.customBg() : this.customText();
    const formatted = normalizePrefixedHex(current) ?? '';
    if (field === 'bg') {
      this.customBg.set(formatted);
    } else {
      this.customText.set(formatted);
    }
  }

  protected markTouched(field: 'name' | 'bg' | 'text'): void {
    this.touched.update((current) => (current[field] ? current : { ...current, [field]: true }));
  }

  protected isPresetSelected(key: string): boolean {
    return this.colorMode() === 'preset' && this.selectedPreset() === key;
  }

  protected nameError(): string | null {
    this.i18n();
    const serverCode = this.nameServerError();
    if (serverCode) {
      return this.transloco.translate(`tags.errors.${serverCode}`);
    }
    if (!this.submitAttempted() && !this.touched().name) {
      return null;
    }
    const trimmed = this.name().trim();
    const length = [...trimmed].length;
    if (length === 0) {
      return this.transloco.translate('tags.validation.nameRequired');
    }
    if (length > MAX_TAG_NAME_LENGTH) {
      return this.transloco.translate('tags.validation.nameMaxLength', { max: MAX_TAG_NAME_LENGTH });
    }
    return null;
  }

  protected hexError(field: 'bg' | 'text'): string | null {
    this.i18n();
    if (this.colorMode() !== 'custom') return null;
    if (!this.submitAttempted() && !this.touched()[field]) {
      return null;
    }
    const normalized = normalizePrefixedHex(field === 'bg' ? this.customBg() : this.customText());
    if (!normalized) {
      return this.transloco.translate('tags.validation.hexRequired');
    }
    if (!isValidHexColor(normalized)) {
      return this.transloco.translate('tags.validation.invalidHex');
    }
    return null;
  }

  protected async save(): Promise<void> {
    if (this.saving() || !this.canManage()) return;

    this.submitAttempted.set(true);
    this.nameServerError.set(null);

    const trimmedName = this.name().trim();
    const nameLen = [...trimmedName].length;
    if (nameLen === 0 || nameLen > MAX_TAG_NAME_LENGTH) {
      return;
    }

    if (this.colorMode() === 'custom') {
      this.onHexBlur('bg');
      this.onHexBlur('text');
      if (!this.validCustomBg() || !this.validCustomText()) {
        return;
      }
    }

    const base = this.editingTag();
    const colors = this.currentColorValues();

    this.saving.set(true);
    try {
      let result: Tag;
      if (!base) {
        const payload: CreateTagInput = { name: trimmedName };
        if (colors.backgroundColor && colors.textColor) {
          payload.backgroundColor = colors.backgroundColor;
          payload.textColor = colors.textColor;
        }
        result = await createTag(payload);
        this.notify.success(this.transloco.translate('tags.toasts.created'));
      } else {
        const patch: UpdateTagInput = {};
        if (trimmedName !== base.name) {
          patch.name = trimmedName;
        }
        if (colors.backgroundColor !== base.backgroundColor || colors.textColor !== base.textColor) {
          patch.backgroundColor = colors.backgroundColor;
          patch.textColor = colors.textColor;
        }
        if (Object.keys(patch).length === 0) {
          this.saving.set(false);
          return;
        }
        result = await updateTag(base.id, patch);
        this.notify.success(this.transloco.translate('tags.toasts.saved'));
      }

      this.saved.emit(result);
      this.close();
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'CRM_TAG_NAME_TAKEN') {
        this.nameServerError.set(code);
        return;
      }
      // 400 CRM_VALIDATION_FAILED keyed by `name`: show it under the name field.
      if (isValidationError(error) && Object.keys(fieldErrorsOf(error)).includes('name')) {
        this.nameServerError.set('CRM_TAG_NAME_INVALID');
        return;
      }
      this.notify.error(tagErrorMessage(this.transloco, error));
      if (code === 'CRM_TAG_NOT_FOUND') {
        this.deletedRemotely.emit();
        this.close();
      }
    } finally {
      this.saving.set(false);
    }
  }

  private applyTagToForm(tag: Tag): void {
    this.name.set(tag.name);
    if (!tag.backgroundColor || !tag.textColor) {
      this.colorMode.set('none');
      this.selectedPreset.set(DEFAULT_PRESET_KEY);
      this.customBg.set(DEFAULT_CUSTOM_BG);
      this.customText.set(DEFAULT_CUSTOM_TEXT);
      return;
    }

    const preset = presetOf(tag.backgroundColor, tag.textColor);
    if (preset) {
      this.colorMode.set('preset');
      this.selectedPreset.set(preset);
      this.customBg.set(tag.backgroundColor);
      this.customText.set(tag.textColor);
      return;
    }

    this.colorMode.set('custom');
    this.selectedPreset.set(DEFAULT_PRESET_KEY);
    this.customBg.set(tag.backgroundColor);
    this.customText.set(tag.textColor);
  }

  private currentColorValues(): { backgroundColor: string | null; textColor: string | null } {
    const mode = this.colorMode();
    if (mode === 'none') {
      return { backgroundColor: null, textColor: null };
    }
    if (mode === 'preset') {
      const preset = this.activePreset();
      return { backgroundColor: preset.bg, textColor: preset.text };
    }
    return {
      backgroundColor: normalizePrefixedHex(this.customBg()),
      textColor: normalizePrefixedHex(this.customText()),
    };
  }

  private resetValidation(): void {
    this.touched.set({});
    this.submitAttempted.set(false);
    this.nameServerError.set(null);
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
}
