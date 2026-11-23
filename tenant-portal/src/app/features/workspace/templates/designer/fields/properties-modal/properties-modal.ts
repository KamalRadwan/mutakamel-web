import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { FormField, disabled, form, readonly } from '@angular/forms/signals';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerAdjustmentsHorizontal, tablerCheck } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../../core/i18n/language';
import { Button } from '../../../../../../shared/ui/button/button';
import { Checkbox } from '../../../../../../shared/ui/checkbox/checkbox';
import { Dropdown, DropdownOption } from '../../../../../../shared/ui/dropdown/dropdown';
import { ColorPicker } from '../../../../../../shared/ui/color-picker/color-picker';
import { designerColorSwatches } from '../../designer-color-swatches';
import { Field } from '../../../../../../shared/ui/field/field';
import { Modal } from '../../../../../../shared/ui/modal/modal';
import { Switch } from '../../../../../../shared/ui/switch/switch';
import type {
  TemplateBorderStyle,
  TemplateBoxSpacing,
  TemplateDividerNode,
  TemplateFontFamilyToken,
  TemplateFontWeight,
  TemplateNodeBase,
  TemplateNodeStyle,
  TemplateNodeType,
  TemplateObjectFit,
  TemplateOverflowMode,
  TemplateSpacerNode,
  TemplateTextAlign,
  TemplateVerticalAlign,
} from '../../../templates.model';
import { DesignerState } from '../../designer-state';
import { isValidSafeColor, normalizeSafeColor } from '../field-helpers';

type InheritOr<T extends string> = 'INHERIT' | T;
type StyleKey = keyof TemplateNodeStyle;

const DEFAULT_STROKE_COLOR = '#E4E7EC';

const TEXT_STYLE_KEYS: readonly StyleKey[] = [
  'fontFamilyToken',
  'fontSizePx',
  'fontWeight',
  'fontStyle',
  'textDecoration',
  'color',
  'lineHeight',
  'letterSpacingPx',
  'textAlign',
  'verticalAlign',
];

const FULL_BOX_KEYS: readonly StyleKey[] = [
  'backgroundColor',
  'border',
  'borderRadiusPx',
  'opacity',
  'padding',
  'overflow',
  'margin',
];

const BAND_BOX_KEYS: readonly StyleKey[] = [
  'backgroundColor',
  'border',
  'opacity',
  'padding',
  'margin',
  'gapPx',
];

const TABLE_BOX_KEYS: readonly StyleKey[] = ['backgroundColor', 'border', 'opacity', 'margin'];

const SECTION_BOX_KEYS: readonly StyleKey[] = [
  'backgroundColor',
  'border',
  'borderRadiusPx',
  'opacity',
  'padding',
  'overflow',
];

const ALLOWED_STYLE_KEYS: Record<TemplateNodeType, ReadonlySet<StyleKey>> = {
  text: new Set([...TEXT_STYLE_KEYS, ...FULL_BOX_KEYS]),
  richText: new Set([...TEXT_STYLE_KEYS, ...FULL_BOX_KEYS]),
  dataField: new Set([...TEXT_STYLE_KEYS, ...FULL_BOX_KEYS]),
  link: new Set([...TEXT_STYLE_KEYS, ...FULL_BOX_KEYS]),
  button: new Set([...TEXT_STYLE_KEYS, ...FULL_BOX_KEYS]),
  totals: new Set([...TEXT_STYLE_KEYS, ...FULL_BOX_KEYS]),
  formula: new Set(FULL_BOX_KEYS),
  image: new Set<StyleKey>(['objectFit', ...FULL_BOX_KEYS]),
  container: new Set<StyleKey>([...FULL_BOX_KEYS, 'gapPx']),
  row: new Set(BAND_BOX_KEYS),
  column: new Set(BAND_BOX_KEYS),
  header: new Set(BAND_BOX_KEYS),
  footer: new Set(BAND_BOX_KEYS),
  staticTable: new Set(TABLE_BOX_KEYS),
  dynamicTable: new Set(TABLE_BOX_KEYS),
  group: new Set(),
  divider: new Set(),
  spacer: new Set(),
  pageBreak: new Set(),
};

interface PropFormModel {
  nodeName: string;
  nodeHidden: boolean;
  nodeLocked: boolean;
  fontSize: number | null;
  italic: boolean;
  underline: boolean;
  textColor: string;
  lineHeight: number | null;
  letterSpacing: number | null;
  backgroundColor: string;
  borderWidth: number | null;
  borderColor: string;
  borderRadius: number | null;
  opacity: number | null;
  padTop: number | null;
  padEnd: number | null;
  padBottom: number | null;
  padStart: number | null;
  lineThickness: number | null;
  lineColor: string;
  spacerHeight: number | null;
}

function finiteOrNull(val: number | undefined): number | null {
  return val !== undefined && Number.isFinite(val) ? val : null;
}

@Component({
  selector: 'app-tpl-properties-modal',
  imports: [
    ColorPicker,
    FormField,
    TranslocoPipe,
    Button,
    Checkbox,
    Dropdown,
    Field,
    Modal,
    Switch,
  ],
  providers: [provideIcons({ tablerAdjustmentsHorizontal, tablerCheck })],
  templateUrl: './properties-modal.html',
  host: { class: 'contents' },
})
export class PropertiesModal {
  protected readonly state = inject(DesignerState);
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageState).current;
  private readonly i18n = translationEvents(this.transloco);

  private readonly modal = viewChild.required<Modal>('propModal');

  private readonly targetNodeId = signal<string | null>(null);
  private readonly targetNodeType = signal<TemplateNodeType>('text');

  // Non-Signal-Forms dropdown state
  protected readonly fontFamily = signal<InheritOr<TemplateFontFamilyToken>>('INHERIT');
  protected readonly fontWeight = signal<InheritOr<TemplateFontWeight>>('INHERIT');
  protected readonly textAlign = signal<InheritOr<TemplateTextAlign>>('INHERIT');
  protected readonly verticalAlign = signal<InheritOr<TemplateVerticalAlign>>('INHERIT');
  protected readonly borderStyle = signal<TemplateBorderStyle>('NONE');
  protected readonly paddingUnit = signal<'PX' | 'MM'>('PX');
  protected readonly overflow = signal<InheritOr<TemplateOverflowMode>>('INHERIT');
  protected readonly objectFit = signal<TemplateObjectFit>('CONTAIN');
  protected readonly lineStyle = signal<'SOLID' | 'DASHED' | 'DOTTED'>('SOLID');

  protected readonly propModel = signal<PropFormModel>({
    nodeName: '',
    nodeHidden: false,
    nodeLocked: false,
    fontSize: null,
    italic: false,
    underline: false,
    textColor: '',
    lineHeight: null,
    letterSpacing: null,
    backgroundColor: '',
    borderWidth: null,
    borderColor: '',
    borderRadius: null,
    opacity: null,
    padTop: null,
    padEnd: null,
    padBottom: null,
    padStart: null,
    lineThickness: 1,
    lineColor: DEFAULT_STROKE_COLOR,
    spacerHeight: 12,
  });

  protected readonly propForm = form(this.propModel, (p) => {
    readonly(p, () => this.state.readOnly());
    disabled(p.nodeHidden, () => this.state.readOnly());
    disabled(p.nodeLocked, () => this.state.readOnly());
  });

  private preservedGapPx: number | undefined;
  private preservedMargin: TemplateBoxSpacing | undefined;

  protected readonly colorSwatches = signal<readonly string[] | null>(null);

  open(nodeId: string): void {
    this.colorSwatches.set(designerColorSwatches(this.state.document()));
    const doc = this.state.document();
    const node = doc?.nodes[nodeId];
    if (!node) return;

    this.targetNodeId.set(nodeId);
    this.targetNodeType.set(node.type);

    const s = node.style ?? {};
    this.preservedGapPx = s.gapPx;
    this.preservedMargin = s.margin ? structuredClone(s.margin) : undefined;

    this.fontFamily.set(s.fontFamilyToken ?? 'INHERIT');
    this.fontWeight.set(s.fontWeight ?? 'INHERIT');
    this.textAlign.set(s.textAlign ?? 'INHERIT');
    this.verticalAlign.set(s.verticalAlign ?? 'INHERIT');
    this.borderStyle.set(s.border?.style ?? 'NONE');
    this.paddingUnit.set(s.padding?.unit ?? (this.state.channel() === 'PRINT' ? 'MM' : 'PX'));
    this.overflow.set(s.overflow ?? 'INHERIT');
    this.objectFit.set(s.objectFit ?? 'CONTAIN');
    if (node.type === 'divider') {
      this.lineStyle.set(node.props.style);
    }

    this.propModel.set({
      nodeName: node.name ?? '',
      nodeHidden: node.hidden,
      nodeLocked: node.locked,
      fontSize: finiteOrNull(s.fontSizePx),
      italic: s.fontStyle === 'ITALIC',
      underline: s.textDecoration === 'UNDERLINE',
      textColor: s.color ?? '',
      lineHeight: finiteOrNull(s.lineHeight),
      letterSpacing: finiteOrNull(s.letterSpacingPx),
      backgroundColor: s.backgroundColor ?? '',
      borderWidth: finiteOrNull(s.border?.widthPx),
      borderColor: s.border?.color ?? '',
      borderRadius: finiteOrNull(s.borderRadiusPx),
      opacity: finiteOrNull(s.opacity),
      padTop: finiteOrNull(s.padding?.blockStart),
      padEnd: finiteOrNull(s.padding?.inlineEnd),
      padBottom: finiteOrNull(s.padding?.blockEnd),
      padStart: finiteOrNull(s.padding?.inlineStart),
      lineThickness: node.type === 'divider' ? (finiteOrNull(node.props.thicknessPx) ?? 1) : 1,
      lineColor: node.type === 'divider' ? node.props.color : DEFAULT_STROKE_COLOR,
      spacerHeight: node.type === 'spacer' ? (finiteOrNull(node.props.heightPx) ?? 0) : 12,
    });

    this.modal().open();
  }

  protected allowsStyle(key: StyleKey): boolean {
    return ALLOWED_STYLE_KEYS[this.targetNodeType()].has(key);
  }

  protected readonly showTextSection = computed(() =>
    TEXT_STYLE_KEYS.some((k) => ALLOWED_STYLE_KEYS[this.targetNodeType()].has(k)),
  );
  protected readonly showBoxSection = computed(() =>
    SECTION_BOX_KEYS.some((k) => ALLOWED_STYLE_KEYS[this.targetNodeType()].has(k)),
  );
  protected readonly showImageSection = computed(() => this.allowsStyle('objectFit'));
  protected readonly showLineSection = computed(() => this.targetNodeType() === 'divider');
  protected readonly showSpacerSection = computed(() => this.targetNodeType() === 'spacer');
  protected readonly isPrint = computed(() => this.state.channel() === 'PRINT');

  // Options
  protected readonly fontOptions = computed<DropdownOption<InheritOr<TemplateFontFamilyToken>>[]>(() => {
    this.language();
    this.i18n();
    return (['INHERIT', 'SYSTEM_SANS', 'ARABIC_SANS', 'SYSTEM_SERIF'] as const).map((v) => ({
      value: v,
      label: this.transloco.translate(`tplFields.properties.text.fonts.${v}`),
    }));
  });

  protected readonly weightOptions = computed<DropdownOption<InheritOr<TemplateFontWeight>>[]>(() => {
    this.language();
    this.i18n();
    return (['INHERIT', 'NORMAL', 'MEDIUM', 'SEMIBOLD', 'BOLD'] as const).map((v) => ({
      value: v,
      label: this.transloco.translate(`tplFields.properties.text.weights.${v}`),
    }));
  });

  protected readonly alignOptions = computed<DropdownOption<InheritOr<TemplateTextAlign>>[]>(() => {
    this.language();
    this.i18n();
    return (['INHERIT', 'START', 'CENTER', 'END', 'JUSTIFY'] as const).map((v) => ({
      value: v,
      label: this.transloco.translate(`tplFields.properties.text.aligns.${v}`),
    }));
  });

  protected readonly verticalAlignOptions = computed<DropdownOption<InheritOr<TemplateVerticalAlign>>[]>(() => {
    this.language();
    this.i18n();
    return (['INHERIT', 'TOP', 'MIDDLE', 'BOTTOM'] as const).map((v) => ({
      value: v,
      label: this.transloco.translate(`tplFields.properties.text.verticalAligns.${v}`),
    }));
  });

  protected readonly borderStyleOptions = computed<DropdownOption<TemplateBorderStyle>[]>(() => {
    this.language();
    this.i18n();
    return (['NONE', 'SOLID', 'DASHED', 'DOTTED'] as const).map((v) => ({
      value: v,
      label: this.transloco.translate(`tplFields.properties.box.borderStyles.${v}`),
    }));
  });

  protected readonly lineStyleOptions = computed<DropdownOption<'SOLID' | 'DASHED' | 'DOTTED'>[]>(() => {
    this.language();
    this.i18n();
    return (['SOLID', 'DASHED', 'DOTTED'] as const).map((v) => ({
      value: v,
      label: this.transloco.translate(`tplFields.properties.box.borderStyles.${v}`),
    }));
  });

  protected readonly overflowOptions = computed<DropdownOption<InheritOr<TemplateOverflowMode>>[]>(() => {
    this.language();
    this.i18n();
    return (['INHERIT', 'VISIBLE', 'HIDDEN', 'WRAP'] as const).map((v) => ({
      value: v,
      label: this.transloco.translate(`tplFields.properties.box.overflows.${v}`),
    }));
  });

  protected readonly paddingUnitOptions = computed<DropdownOption<'PX' | 'MM'>[]>(() => {
    this.language();
    this.i18n();
    const px = { value: 'PX' as const, label: this.transloco.translate('tplFields.properties.box.units.PX') };
    const mm = { value: 'MM' as const, label: this.transloco.translate('tplFields.properties.box.units.MM') };
    return this.isPrint() ? [px, mm] : [px];
  });

  protected readonly fitOptions = computed<DropdownOption<TemplateObjectFit>[]>(() => {
    this.language();
    this.i18n();
    return (['CONTAIN', 'COVER', 'FILL'] as const).map((v) => ({
      value: v,
      label: this.transloco.translate(`tplFields.properties.image.fits.${v}`),
    }));
  });

  // Errors
  protected readonly nameError = computed<string | null>(() => {
    this.language();
    this.i18n();
    return this.propModel().nodeName.trim().length > 120
      ? this.transloco.translate('tplFields.properties.object.nameTooLong')
      : null;
  });

  protected readonly fontSizeError = computed(() =>
    this.optionalRangeError(this.propModel().fontSize, this.propForm.fontSize, 8, 96, 'tplFields.properties.text.sizeRange'),
  );
  protected readonly lineHeightError = computed(() =>
    this.optionalRangeError(this.propModel().lineHeight, this.propForm.lineHeight, 1, 2.5, 'tplFields.properties.text.lineHeightRange'),
  );
  protected readonly letterSpacingError = computed(() =>
    this.optionalRangeError(this.propModel().letterSpacing, this.propForm.letterSpacing, -2, 10, 'tplFields.properties.text.letterSpacingRange'),
  );
  protected readonly textColorError = computed(() => this.colorError(this.propModel().textColor, false));

  protected readonly bgColorError = computed(() => this.colorError(this.propModel().backgroundColor, false));
  protected readonly borderWidthError = computed(() =>
    this.optionalRangeError(this.propModel().borderWidth, this.propForm.borderWidth, 0, 12, 'tplFields.properties.box.borderWidthRange'),
  );
  protected readonly borderColorError = computed(() =>
    this.colorError(this.propModel().borderColor, this.borderStyle() !== 'NONE'),
  );
  protected readonly borderRadiusError = computed(() =>
    this.optionalRangeError(this.propModel().borderRadius, this.propForm.borderRadius, 0, 100, 'tplFields.properties.box.borderRadiusRange'),
  );
  protected readonly opacityError = computed(() =>
    this.optionalRangeError(this.propModel().opacity, this.propForm.opacity, 0, 1, 'tplFields.properties.box.opacityRange'),
  );
  protected readonly padTopError = computed(() =>
    this.optionalRangeError(this.propModel().padTop, this.propForm.padTop, 0, 200, 'tplFields.properties.box.paddingRange'),
  );
  protected readonly padEndError = computed(() =>
    this.optionalRangeError(this.propModel().padEnd, this.propForm.padEnd, 0, 200, 'tplFields.properties.box.paddingRange'),
  );
  protected readonly padBottomError = computed(() =>
    this.optionalRangeError(this.propModel().padBottom, this.propForm.padBottom, 0, 200, 'tplFields.properties.box.paddingRange'),
  );
  protected readonly padStartError = computed(() =>
    this.optionalRangeError(this.propModel().padStart, this.propForm.padStart, 0, 200, 'tplFields.properties.box.paddingRange'),
  );

  protected readonly lineThicknessError = computed(() => {
    this.language();
    this.i18n();
    if (!this.showLineSection()) return null;
    const hasParse = this.propForm.lineThickness().errors().some((e) => e.kind === 'parse');
    const val = this.propModel().lineThickness;
    if (hasParse || val === null || !Number.isFinite(val) || val < 0.1 || val > 12) {
      return this.transloco.translate('tplFields.properties.line.thicknessRange');
    }
    return null;
  });

  protected readonly lineColorError = computed(() => {
    if (!this.showLineSection()) return null;
    return this.colorError(this.propModel().lineColor, true);
  });

  protected readonly spacerHeightError = computed(() => {
    this.language();
    this.i18n();
    if (!this.showSpacerSection()) return null;
    const hasParse = this.propForm.spacerHeight().errors().some((e) => e.kind === 'parse');
    const val = this.propModel().spacerHeight;
    if (hasParse || val === null || !Number.isFinite(val) || val < 0 || val > 200) {
      return this.transloco.translate('tplFields.properties.spacer.heightRange');
    }
    return null;
  });

  protected readonly canApply = computed(() => {
    if (this.state.readOnly() || this.nameError()) return false;
    if (this.showTextSection()) {
      if (this.fontSizeError() || this.lineHeightError() || this.letterSpacingError() || this.textColorError()) {
        return false;
      }
    }
    if (this.showBoxSection()) {
      if (
        (this.allowsStyle('backgroundColor') && this.bgColorError()) ||
        (this.allowsStyle('border') && (this.borderWidthError() || this.borderColorError())) ||
        (this.allowsStyle('borderRadiusPx') && this.borderRadiusError()) ||
        (this.allowsStyle('opacity') && this.opacityError()) ||
        (this.allowsStyle('padding') && (this.padTopError() || this.padEndError() || this.padBottomError() || this.padStartError()))
      ) {
        return false;
      }
    }
    if (this.showLineSection() && (this.lineThicknessError() || this.lineColorError())) return false;
    if (this.showSpacerSection() && this.spacerHeightError()) return false;
    return true;
  });

  protected onColorInput(
    key: 'textColor' | 'backgroundColor' | 'borderColor' | 'lineColor',
    value: string | null,
  ): void {
    if (this.state.readOnly()) return;
    this.propModel.update((m) => ({ ...m, [key]: value ?? '' }));
  }

  protected onColorBlur(target: 'text' | 'bg' | 'border' | 'line'): void {
    if (this.state.readOnly()) return;
    if (target === 'border' && this.propModel().borderColor.trim() === '') {
      this.borderStyle.set('NONE');
    }
    this.propModel.update((m) => {
      switch (target) {
        case 'text':
          return { ...m, textColor: normalizeSafeColor(m.textColor) };
        case 'bg':
          return { ...m, backgroundColor: normalizeSafeColor(m.backgroundColor) };
        case 'border':
          return { ...m, borderColor: normalizeSafeColor(m.borderColor) };
        case 'line':
          return { ...m, lineColor: normalizeSafeColor(m.lineColor) };
      }
    });
  }

  protected onBorderStyleChange(next: TemplateBorderStyle): void {
    this.borderStyle.set(next);
    if (next !== 'NONE') {
      this.propModel.update((m) => ({
        ...m,
        borderWidth: m.borderWidth === null ? 1 : m.borderWidth,
        borderColor: !m.borderColor.trim() ? DEFAULT_STROKE_COLOR : m.borderColor,
      }));
    }
  }

  protected apply(): void {
    if (!this.canApply()) return;
    const id = this.targetNodeId();
    const doc = this.state.document();
    const existing = id && doc ? doc.nodes[id] : undefined;
    if (!id || !existing) return;

    const m = this.propModel();
    const style: TemplateNodeStyle = {};

    if (this.showTextSection()) {
      const ff = this.fontFamily();
      if (this.allowsStyle('fontFamilyToken') && ff !== 'INHERIT') style.fontFamilyToken = ff;
      if (this.allowsStyle('fontSizePx') && m.fontSize !== null) style.fontSizePx = m.fontSize;
      const fw = this.fontWeight();
      if (this.allowsStyle('fontWeight') && fw !== 'INHERIT') style.fontWeight = fw;
      if (this.allowsStyle('fontStyle') && m.italic) style.fontStyle = 'ITALIC';
      if (this.allowsStyle('textDecoration') && m.underline) style.textDecoration = 'UNDERLINE';
      const tc = normalizeSafeColor(m.textColor);
      if (this.allowsStyle('color') && tc) style.color = tc;
      if (this.allowsStyle('lineHeight') && m.lineHeight !== null) style.lineHeight = m.lineHeight;
      if (this.allowsStyle('letterSpacingPx') && m.letterSpacing !== null) style.letterSpacingPx = m.letterSpacing;
      const ta = this.textAlign();
      if (this.allowsStyle('textAlign') && ta !== 'INHERIT') style.textAlign = ta;
      const va = this.verticalAlign();
      if (this.allowsStyle('verticalAlign') && va !== 'INHERIT') style.verticalAlign = va;
    }

    if (this.showBoxSection()) {
      const bg = normalizeSafeColor(m.backgroundColor);
      if (this.allowsStyle('backgroundColor') && bg) style.backgroundColor = bg;

      if (this.allowsStyle('border')) {
        const bStyle = this.borderStyle();
        const bw = m.borderWidth;
        const bc = normalizeSafeColor(m.borderColor);
        if (bStyle !== 'NONE' && (bw ?? 0) > 0) {
          style.border = {
            widthPx: bw ?? 1,
            style: bStyle,
            color: bc || DEFAULT_STROKE_COLOR,
          };
        }
      }

      if (this.allowsStyle('borderRadiusPx') && m.borderRadius !== null) style.borderRadiusPx = m.borderRadius;
      if (this.allowsStyle('opacity') && m.opacity !== null) style.opacity = m.opacity;

      if (
        this.allowsStyle('padding') &&
        (m.padTop !== null || m.padEnd !== null || m.padBottom !== null || m.padStart !== null)
      ) {
        style.padding = {
          unit: this.isPrint() ? this.paddingUnit() : 'PX',
          blockStart: m.padTop ?? 0,
          inlineEnd: m.padEnd ?? 0,
          blockEnd: m.padBottom ?? 0,
          inlineStart: m.padStart ?? 0,
        };
      }

      const ov = this.overflow();
      if (this.allowsStyle('overflow') && ov !== 'INHERIT') style.overflow = ov;
      if (this.allowsStyle('gapPx') && this.preservedGapPx !== undefined) style.gapPx = this.preservedGapPx;
      if (this.allowsStyle('margin') && this.preservedMargin) style.margin = this.preservedMargin;
    }

    if (this.showImageSection()) {
      style.objectFit = this.objectFit();
    }

    const trimmedName = m.nodeName.trim();
    const basePatch: Pick<TemplateNodeBase, 'name' | 'hidden' | 'locked' | 'style'> = {
      name: trimmedName || undefined,
      hidden: m.nodeHidden,
      locked: m.nodeLocked,
      style,
    };

    if (existing.type === 'divider') {
      const dividerPatch: Partial<TemplateDividerNode> = {
        ...basePatch,
        props: {
          thicknessPx: m.lineThickness ?? 1,
          style: this.lineStyle(),
          color: normalizeSafeColor(m.lineColor) || DEFAULT_STROKE_COLOR,
        },
      };
      this.state.updateNode(id, dividerPatch, 'updateProperties');
    } else if (existing.type === 'spacer') {
      const spacerPatch: Partial<TemplateSpacerNode> = {
        ...basePatch,
        props: {
          heightPx: m.spacerHeight ?? 0,
        },
      };
      this.state.updateNode(id, spacerPatch, 'updateProperties');
    } else {
      this.state.updateNode(id, basePatch, 'updateProperties');
    }

    this.modal().close();
  }

  protected cancel(): void {
    this.modal().close();
  }

  private optionalRangeError(
    val: number | null,
    field: () => { errors(): readonly { kind: string }[] },
    minVal: number,
    maxVal: number,
    msgKey: string,
  ): string | null {
    this.language();
    this.i18n();
    if (field().errors().some((e) => e.kind === 'parse')) {
      return this.transloco.translate(msgKey);
    }
    if (val === null) return null;
    if (!Number.isFinite(val) || val < minVal || val > maxVal) {
      return this.transloco.translate(msgKey);
    }
    return null;
  }

  private colorError(raw: string, required: boolean): string | null {
    this.language();
    this.i18n();
    const trimmed = raw.trim();
    if (!trimmed) {
      return required ? this.transloco.translate('tplFields.colourInvalid') : null;
    }
    return isValidSafeColor(trimmed) ? null : this.transloco.translate('tplFields.colourInvalid');
  }
}
