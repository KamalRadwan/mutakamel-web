import { DOCUMENT } from '@angular/common';
import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerEye } from '@ng-icons/tabler-icons';
import { contrastInkFor } from '../../../../../shared/ui/color/contrast-ink';
import { Button } from '../../../../../shared/ui/button/button';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Field } from '../../../../../shared/ui/field/field';
import { Segmented, SegmentedOption } from '../../../../../shared/ui/segmented/segmented';
import { BrandingPreviewValues, normaliseHex } from '../branding.model';

const INITIAL_VALUES: BrandingPreviewValues = {
  appName: '',
  tabTitle: '',
  primary: '',
  secondary: '',
  logoUrl: null,
  iconUrl: null,
};

function monogramOf(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return 'M';
  return Array.from(trimmed)[0]?.toUpperCase() ?? 'M';
}

@Component({
  selector: 'app-branding-preview-modal',
  imports: [TranslocoPipe, Button, Modal, Field, Segmented],
  providers: [provideIcons({ tablerEye })],
  templateUrl: './branding-preview-modal.html',
})
export class BrandingPreviewModal {
  private readonly document = inject(DOCUMENT);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly modal = viewChild.required(Modal);

  protected readonly values = signal<BrandingPreviewValues>({ ...INITIAL_VALUES });
  protected readonly previewTheme = signal<'light' | 'dark'>('light');

  protected readonly themeOptions = computed<readonly SegmentedOption[]>(() => {
    this.i18n();
    return [
      { value: 'light', label: this.transloco.translate('wsBranding.preview.light') },
      { value: 'dark', label: this.transloco.translate('wsBranding.preview.dark') },
    ];
  });

  protected readonly validPrimary = computed(() => normaliseHex(this.values().primary));
  protected readonly validSecondary = computed(() => normaliseHex(this.values().secondary));
  protected readonly primaryContrastText = computed(() => {
    const primary = this.validPrimary();
    return primary ? contrastInkFor(primary) : null;
  });

  protected readonly effectiveAppName = computed(() => {
    this.i18n();
    const appName = this.values().appName.trim();
    return appName || this.transloco.translate('wsBranding.preview.defaultName');
  });

  protected readonly effectiveTabTitle = computed(() => {
    const tabTitle = this.values().tabTitle.trim();
    return tabTitle || this.effectiveAppName();
  });

  protected readonly appMonogram = computed(() => monogramOf(this.effectiveAppName()));
  protected readonly tabMonogram = computed(() => monogramOf(this.effectiveTabTitle()));

  open(values: BrandingPreviewValues): void {
    this.values.set({ ...values });
    const currentTheme = this.document.documentElement.getAttribute('data-theme');
    this.previewTheme.set(currentTheme === 'dark' ? 'dark' : 'light');
    this.modal().open();
  }

  protected close(): void {
    this.modal().close();
  }

  protected onThemeChange(value: string | null): void {
    if (value === 'light' || value === 'dark') {
      this.previewTheme.set(value);
    }
  }
}
