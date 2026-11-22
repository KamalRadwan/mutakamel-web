import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { FormField, form, readonly } from '@angular/forms/signals';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCheck, tablerFileDescription, tablerTrash } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../../core/i18n/language';
import { Button } from '../../../../../../shared/ui/button/button';
import { Checkbox } from '../../../../../../shared/ui/checkbox/checkbox';
import { Dropdown, DropdownOption } from '../../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../../shared/ui/field/field';
import { Modal } from '../../../../../../shared/ui/modal/modal';
import type {
  TemplatePageBackground,
  TemplatePageConfig,
  TemplatePageOrientation,
  TemplatePagePreset,
} from '../../../templates.model';
import { TemplatePageDiagram } from '../../../create/page-diagram/page-diagram';
import { DesignerState } from '../../designer-state';
import { PRESET_DIMENSIONS_MM, isValidSafeColor, normalizeSafeColor } from '../field-helpers';

type BgMode = 'NONE' | 'SOLID';

interface PageSetupFormModel {
  customWidthMm: number | null;
  customHeightMm: number | null;
  marginTopMm: number | null;
  marginEndMm: number | null;
  marginBottomMm: number | null;
  marginStartMm: number | null;
  bgColor: string;
  applyAllPages: boolean;
}

@Component({
  selector: 'app-tpl-page-setup-modal',
  imports: [FormField, NgIcon, TranslocoPipe, Button, Checkbox, Dropdown, Field, Modal, TemplatePageDiagram],
  providers: [provideIcons({ tablerCheck, tablerFileDescription, tablerTrash })],
  templateUrl: './page-setup-modal.html',
  host: { class: 'contents' },
})
export class PageSetupModal {
  protected readonly state = inject(DesignerState);
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageState).current;
  private readonly i18n = translationEvents(this.transloco);

  private readonly modal = viewChild.required<Modal>('pageModal');

  protected readonly preset = signal<TemplatePagePreset>('A4');
  protected readonly orientation = signal<TemplatePageOrientation>('PORTRAIT');
  protected readonly bgMode = signal<BgMode>('NONE');
  protected readonly hasAssetBg = signal(false);

  protected readonly pageModel = signal<PageSetupFormModel>({
    customWidthMm: 210,
    customHeightMm: 297,
    marginTopMm: 12,
    marginEndMm: 12,
    marginBottomMm: 12,
    marginStartMm: 12,
    bgColor: '#FFFFFF',
    applyAllPages: false,
  });

  protected readonly pageForm = form(this.pageModel, (p) => {
    readonly(p, () => this.state.readOnly());
  });

  private preservedAssetBg: TemplatePageBackground | null = null;

  open(): void {
    const doc = this.state.document();
    const page = this.state.currentPage();
    if (!doc || !page || this.state.channel() !== 'PRINT') return;

    this.preset.set(page.preset);
    this.orientation.set(page.orientation);

    let bgColor = '#FFFFFF';
    if (page.background?.kind === 'ASSET') {
      this.hasAssetBg.set(true);
      this.preservedAssetBg = structuredClone(page.background);
      this.bgMode.set('NONE');
    } else if (page.background?.kind === 'SOLID') {
      this.hasAssetBg.set(false);
      this.preservedAssetBg = null;
      this.bgMode.set('SOLID');
      bgColor = page.background.color;
    } else {
      this.hasAssetBg.set(false);
      this.preservedAssetBg = null;
      this.bgMode.set('NONE');
    }

    this.pageModel.set({
      customWidthMm: page.widthMm,
      customHeightMm: page.heightMm,
      marginTopMm: page.marginMm.top,
      marginEndMm: page.marginMm.end,
      marginBottomMm: page.marginMm.bottom,
      marginStartMm: page.marginMm.start,
      bgColor,
      applyAllPages: false,
    });

    this.modal().open();
  }

  protected readonly presetOptions = computed<DropdownOption<TemplatePagePreset>[]>(() => {
    this.language();
    this.i18n();
    return (['A4', 'A5', 'LETTER', 'CUSTOM'] as const).map((p) => ({
      value: p,
      label: this.transloco.translate(`tplFields.pageSetup.presets.${p}`),
    }));
  });

  protected readonly orientationOptions = computed<DropdownOption<TemplatePageOrientation>[]>(() => {
    this.language();
    this.i18n();
    return (['PORTRAIT', 'LANDSCAPE'] as const).map((o) => ({
      value: o,
      label: this.transloco.translate(`tplFields.pageSetup.orientations.${o}`),
    }));
  });

  protected readonly bgModeOptions = computed<DropdownOption<BgMode>[]>(() => {
    this.language();
    this.i18n();
    return (['NONE', 'SOLID'] as const).map((m) => ({
      value: m,
      label: this.transloco.translate(`tplFields.pageSetup.backgrounds.${m}`),
    }));
  });

  protected readonly showApplyAll = computed(() => {
    const doc = this.state.document();
    return Boolean(doc?.layoutMode === 'FIXED_CANVAS' && doc.canvasPages && doc.canvasPages.length > 1);
  });

  protected readonly docIsRtl = computed(() => {
    const doc = this.state.document();
    if (!doc) return false;
    if (doc.direction === 'RTL') return true;
    if (doc.direction === 'LTR') return false;
    return doc.locale.startsWith('ar');
  });

  protected readonly effectiveWidthMm = computed(() => {
    const p = this.preset();
    if (p === 'CUSTOM') return this.pageModel().customWidthMm ?? Number.NaN;
    const base = PRESET_DIMENSIONS_MM[p];
    return this.orientation() === 'LANDSCAPE' ? base.height : base.width;
  });

  protected readonly effectiveHeightMm = computed(() => {
    const p = this.preset();
    if (p === 'CUSTOM') return this.pageModel().customHeightMm ?? Number.NaN;
    const base = PRESET_DIMENSIONS_MM[p];
    return this.orientation() === 'LANDSCAPE' ? base.width : base.height;
  });

  protected readonly marginTopMm = computed(() => this.pageModel().marginTopMm ?? Number.NaN);
  protected readonly marginEndMm = computed(() => this.pageModel().marginEndMm ?? Number.NaN);
  protected readonly marginBottomMm = computed(() => this.pageModel().marginBottomMm ?? Number.NaN);
  protected readonly marginStartMm = computed(() => this.pageModel().marginStartMm ?? Number.NaN);

  private readonly reservedZoneHeightMm = computed(() => {
    const doc = this.state.document();
    if (!doc || doc.layoutMode === 'FIXED_CANVAS') return 0;
    let total = 0;
    for (const rootId of doc.rootNodeIds) {
      const node = doc.nodes[rootId];
      if (node && (node.type === 'header' || node.type === 'footer')) {
        total += node.props.heightMm;
      }
    }
    return total;
  });

  protected readonly widthError = computed<string | null>(() => {
    this.language();
    this.i18n();
    if (this.preset() !== 'CUSTOM') return null;
    const hasParse = this.pageForm.customWidthMm().errors().some((e) => e.kind === 'parse');
    const w = this.pageModel().customWidthMm;
    if (hasParse || w === null || !Number.isFinite(w) || w < 50 || w > 500) {
      return this.transloco.translate('tplFields.pageSetup.widthRange');
    }
    return null;
  });

  protected readonly heightError = computed<string | null>(() => {
    this.language();
    this.i18n();
    if (this.preset() !== 'CUSTOM') return null;
    const hasParse = this.pageForm.customHeightMm().errors().some((e) => e.kind === 'parse');
    const h = this.pageModel().customHeightMm;
    if (hasParse || h === null || !Number.isFinite(h) || h < 50 || h > 1000) {
      return this.transloco.translate('tplFields.pageSetup.heightRange');
    }
    return null;
  });

  protected readonly bodyHeightOverflowError = computed<string | null>(() => {
    this.language();
    this.i18n();
    const h = this.effectiveHeightMm();
    const top = this.marginTopMm();
    const bottom = this.marginBottomMm();
    if ([h, top, bottom].some((v) => !Number.isFinite(v))) return null;
    return h - top - bottom - this.reservedZoneHeightMm() <= 0
      ? this.transloco.translate('tplFields.noBodyHeightRoom')
      : null;
  });

  protected readonly bodyWidthOverflowError = computed<string | null>(() => {
    this.language();
    this.i18n();
    const w = this.effectiveWidthMm();
    const start = this.marginStartMm();
    const end = this.marginEndMm();
    if ([w, start, end].some((v) => !Number.isFinite(v))) return null;
    return w - start - end <= 0 ? this.transloco.translate('tplFields.noBodyWidthRoom') : null;
  });

  protected readonly marginTopError = computed(() =>
    this.marginFieldError(this.pageModel().marginTopMm, this.pageForm.marginTopMm),
  );
  protected readonly marginEndError = computed(() =>
    this.marginFieldError(this.pageModel().marginEndMm, this.pageForm.marginEndMm),
  );
  protected readonly marginBottomError = computed(() => {
    const baseErr = this.marginFieldError(this.pageModel().marginBottomMm, this.pageForm.marginBottomMm);
    if (baseErr) return baseErr;
    return this.bodyHeightOverflowError();
  });
  protected readonly marginStartError = computed(() => {
    const baseErr = this.marginFieldError(this.pageModel().marginStartMm, this.pageForm.marginStartMm);
    if (baseErr) return baseErr;
    return this.bodyWidthOverflowError();
  });

  protected readonly bgColorError = computed<string | null>(() => {
    this.language();
    this.i18n();
    if (this.hasAssetBg() || this.bgMode() !== 'SOLID') return null;
    return isValidSafeColor(this.pageModel().bgColor) ? null : this.transloco.translate('tplFields.colourInvalid');
  });

  protected readonly canApply = computed(() => {
    if (this.state.readOnly()) return false;
    if (this.widthError() || this.heightError()) return false;
    if (this.marginTopError() || this.marginEndError() || this.marginBottomError() || this.marginStartError()) {
      return false;
    }
    if (this.bodyHeightOverflowError() || this.bodyWidthOverflowError() || this.bgColorError()) return false;
    return true;
  });

  protected swatchBg(): string | null {
    const norm = normalizeSafeColor(this.pageModel().bgColor);
    return isValidSafeColor(norm) ? norm : null;
  }

  protected onPresetChange(next: TemplatePagePreset): void {
    this.preset.set(next);
    this.syncCustomDimensionsFromPreset();
  }

  protected onOrientationChange(next: TemplatePageOrientation): void {
    this.orientation.set(next);
    this.syncCustomDimensionsFromPreset();
  }

  private syncCustomDimensionsFromPreset(): void {
    const p = this.preset();
    if (p !== 'CUSTOM') {
      const base = PRESET_DIMENSIONS_MM[p];
      const w = this.orientation() === 'LANDSCAPE' ? base.height : base.width;
      const h = this.orientation() === 'LANDSCAPE' ? base.width : base.height;
      this.pageModel.update((m) => ({ ...m, customWidthMm: w, customHeightMm: h }));
    }
  }

  protected onBgColorBlur(): void {
    this.pageModel.update((m) => ({ ...m, bgColor: normalizeSafeColor(m.bgColor) }));
  }

  protected removeAssetBackground(): void {
    if (this.state.readOnly()) return;
    this.hasAssetBg.set(false);
    this.preservedAssetBg = null;
    this.bgMode.set('NONE');
  }

  protected apply(): void {
    if (!this.canApply()) return;
    const w = this.effectiveWidthMm();
    const h = this.effectiveHeightMm();

    let background: TemplatePageBackground | undefined;
    if (this.hasAssetBg() && this.preservedAssetBg) {
      background = structuredClone(this.preservedAssetBg);
    } else if (this.bgMode() === 'SOLID') {
      background = { kind: 'SOLID', color: normalizeSafeColor(this.pageModel().bgColor) };
    }

    const nextPage: TemplatePageConfig = {
      unit: 'MM',
      preset: this.preset(),
      orientation: this.orientation(),
      widthMm: w,
      heightMm: h,
      marginMm: {
        top: this.marginTopMm(),
        end: this.marginEndMm(),
        bottom: this.marginBottomMm(),
        start: this.marginStartMm(),
      },
      bleedMm: 0,
      ...(background ? { background } : {}),
    };

    const pageIdx = this.state.pageIndex();
    const allPages = this.pageModel().applyAllPages;

    this.state.apply('updatePageSetup', (doc) => {
      if (doc.layoutMode === 'FIXED_CANVAS' && doc.canvasPages && doc.canvasPages.length > 0) {
        if (allPages) {
          for (const cp of doc.canvasPages) {
            cp.page = structuredClone(nextPage);
          }
        } else {
          const safeIdx = Math.max(0, Math.min(pageIdx, doc.canvasPages.length - 1));
          doc.canvasPages[safeIdx].page = nextPage;
        }
      } else {
        doc.page = nextPage;
      }
    });

    this.modal().close();
  }

  protected cancel(): void {
    this.modal().close();
  }

  private marginFieldError(
    value: number | null,
    field: () => { errors(): readonly { kind: string }[] },
  ): string | null {
    this.language();
    this.i18n();
    const hasParse = field().errors().some((e) => e.kind === 'parse');
    if (hasParse || value === null || !Number.isFinite(value) || value < 0 || value > 100) {
      return this.transloco.translate('tplFields.pageSetup.marginRange');
    }
    return null;
  }
}
