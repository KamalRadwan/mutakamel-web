import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  afterRenderEffect,
  computed,
  inject,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowBackUp,
  tablerArrowForwardUp,
  tablerBraces,
  tablerCheck,
  tablerChevronDown,
  tablerClick,
  tablerDots,
  tablerFileDescription,
  tablerFiles,
  tablerLayoutAlignBottom,
  tablerLayoutAlignCenter,
  tablerLayoutAlignLeft,
  tablerLayoutAlignMiddle,
  tablerLayoutAlignRight,
  tablerLayoutAlignTop,
  tablerLine,
  tablerLink,
  tablerMail,
  tablerMathFunction,
  tablerMaximize,
  tablerPhoto,
  tablerPointer,
  tablerStack2,
  tablerStackBack,
  tablerStackBackward,
  tablerStackForward,
  tablerStackFront,
  tablerSum,
  tablerTable,
  tablerTypography,
  tablerZoomIn,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Menu, MenuItem } from '../../../../../shared/ui/menu/menu';
import { overflowFit } from '../../../../../shared/ui/overflow/overflow-fit';
import { rectInPage, viewport } from '../../../../../shared/ui/overlay/zoom';
import { Field } from '../../../../../shared/ui/field/field';
import { Segmented, SegmentedOption } from '../../../../../shared/ui/segmented/segmented';
import { templateLayoutMeta } from '../../shared/template-family';
import { DesignerState, DesignerTool } from '../designer-state';

type RibbonMenuKind = 'table' | 'align' | 'arrange' | 'zoom';
type OverflowToolId =
  | 'align'
  | 'arrange'
  | 'layers'
  | 'pages'
  | 'layoutTag'
  | 'pageSetup'
  | 'emailSettings'
  | 'emailWidth'
  | 'zoom'
  | 'fit';

interface RibbonMenuItem {
  id: string;
  label: string;
  icon?: string;
  selected?: boolean;
  disabled?: boolean;
  tooltip?: string;
  divider?: boolean;
  mirrorRtl?: boolean;
}

interface MenuPlace {
  top: number;
  start: number | null;
  end: number | null;
  minWidth: number;
  maxHeight: number;
}

const ZOOM_PRESETS = [25, 50, 60, 75, 100, 125, 150, 200, 300, 400] as const;

@Component({
  selector: 'app-tpl-ribbon',
  imports: [NgIcon, TranslocoPipe, Field, Menu, Segmented],
  providers: [
    provideIcons({
      tablerPointer,
      tablerTypography,
      tablerPhoto,
      tablerBraces,
      tablerTable,
      tablerSum,
      tablerMathFunction,
      tablerLine,
      tablerClick,
      tablerLink,
      tablerArrowBackUp,
      tablerArrowForwardUp,
      tablerLayoutAlignLeft,
      tablerLayoutAlignCenter,
      tablerLayoutAlignRight,
      tablerLayoutAlignTop,
      tablerLayoutAlignMiddle,
      tablerLayoutAlignBottom,
      tablerStack2,
      tablerStackFront,
      tablerStackForward,
      tablerStackBackward,
      tablerStackBack,
      tablerFiles,
      tablerFileDescription,
      tablerMail,
      tablerZoomIn,
      tablerMaximize,
      tablerDots,
      tablerChevronDown,
      tablerCheck,
    }),
  ],
  templateUrl: './ribbon.html',
  host: {
    class: 'block min-w-0',
    '(document:click)': 'closeMenuIfOutside($event)',
    '(window:resize)': 'closeMenu()',
  },
})
export class Ribbon {
  private static nextId = 0;
  protected readonly uid = `tpl-ribbon-${++Ribbon.nextId}`;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly state = inject(DesignerState);
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageState).current;
  private readonly i18n = translationEvents(this.transloco);

  private readonly toolbarRef = viewChild<ElementRef<HTMLElement>>('toolbar');
  private readonly overflowAreaRef = viewChild<ElementRef<HTMLElement>>('overflowArea');
  private readonly menuListRef = viewChild<ElementRef<HTMLElement>>('menuList');
  private readonly menuRows = viewChildren<ElementRef<HTMLButtonElement>>('menuRow');

  private menuTriggerEl: HTMLElement | null = null;
  protected readonly activeToolKey = signal('select');
  protected readonly openMenu = signal<RibbonMenuKind | null>(null);
  protected readonly menuPlace = signal<MenuPlace>({
    top: 0,
    start: 0,
    end: null,
    minWidth: 160,
    maxHeight: 320,
  });

  protected readonly isEmail = computed(
    () => this.state.channel() === 'EMAIL' || this.state.layoutMode() === 'EMAIL_FLOW',
  );

  protected readonly textState = computed(() => this.state.toolState('TEXT'));
  protected readonly imageState = computed(() => this.state.toolState('IMAGE'));
  protected readonly dataFieldState = computed(() => this.state.toolState('DATA_FIELD'));
  protected readonly tableStaticState = computed(() => this.state.toolState('TABLE_STATIC'));
  protected readonly tableDynamicState = computed(() => this.state.toolState('TABLE_DYNAMIC'));
  protected readonly totalsState = computed(() => this.state.toolState('TOTALS'));
  protected readonly formulaState = computed(() => this.state.toolState('FORMULA'));
  protected readonly lineState = computed(() => this.state.toolState('LINE'));
  protected readonly buttonState = computed(() => this.state.toolState('BUTTON'));
  protected readonly linkState = computed(() => this.state.toolState('LINK'));
  protected readonly alignState = computed(() => this.state.toolState('ALIGN'));
  protected readonly arrangeState = computed(() => this.state.toolState('ARRANGE'));
  protected readonly layersState = computed(() => this.state.toolState('LAYERS'));
  protected readonly pagesState = computed(() => this.state.toolState('PAGES'));
  protected readonly pageSetupState = computed(() => this.state.toolState('PAGE_SETUP'));
  protected readonly emailSettingsState = computed(() => this.state.toolState('EMAIL_SETTINGS'));

  protected readonly tableMenuDisabled = computed(() => {
    const items = [this.tableStaticState(), this.tableDynamicState(), this.totalsState()].filter(
      (s) => s.state !== 'HIDDEN',
    );
    return items.length === 0 || items.every((s) => s.state !== 'ENABLED');
  });

  protected readonly tableMenuReason = computed(() => {
    if (!this.tableMenuDisabled()) return null;
    const first = [this.tableStaticState(), this.tableDynamicState(), this.totalsState()].find(
      (s) => s.state === 'DISABLED',
    );
    return this.reasonText(first?.reasonKey ?? null);
  });

  protected readonly layoutLabel = computed(() => {
    this.language();
    this.i18n();
    const mode = this.state.layoutMode();
    if (!mode) return '';
    return this.transloco.translate(templateLayoutMeta(mode).shortLabelKey);
  });

  protected readonly pageSetupLabel = computed(() => {
    this.language();
    this.i18n();
    const page = this.state.currentPage();
    if (!page) return this.transloco.translate('tplTools.ribbon.pageSetup');
    const ori = this.transloco.translate(
      page.orientation === 'LANDSCAPE' ? 'tplTools.ribbon.landscape' : 'tplTools.ribbon.portrait',
    );
    const preset =
      page.preset === 'CUSTOM'
        ? this.transloco.translate('tplTools.status.custom', { w: page.widthMm, h: page.heightMm })
        : page.preset === 'LETTER'
          ? this.transloco.translate('tplTools.ribbon.paperLetter')
          : page.preset;
    return `${preset} ${ori}`;
  });

  protected readonly zoomPercent = computed(() => Math.round(this.state.zoom() * 100));
  protected readonly zoomLabel = computed(() => `${this.zoomPercent()}%`);

  protected readonly fitTitle = computed(() => {
    this.language();
    this.i18n();
    const target =
      this.state.zoomMode() === 'FIT_WIDTH' ? 'tplTools.ribbon.fitPage' : 'tplTools.ribbon.fitWidth';
    return `${this.transloco.translate('tplTools.ribbon.fit')} (${this.transloco.translate(target)})`;
  });

  protected readonly emailWidthStr = computed(() => String(this.state.emailWidthPx()));
  protected readonly emailWidthOptions = computed<SegmentedOption[]>(() => [
    { value: '600', label: '600' },
    { value: '320', label: '320' },
  ]);

  protected readonly overflowTools = computed<OverflowToolId[]>(() => {
    const tools: OverflowToolId[] = [];
    if (this.alignState().state !== 'HIDDEN') tools.push('align');
    if (this.arrangeState().state !== 'HIDDEN') tools.push('arrange');
    if (this.layersState().state !== 'HIDDEN') tools.push('layers');
    if (this.pagesState().state !== 'HIDDEN') tools.push('pages');
    if (this.layoutLabel()) tools.push('layoutTag');
    if (this.pageSetupState().state !== 'HIDDEN') tools.push('pageSetup');
    if (this.emailSettingsState().state !== 'HIDDEN') tools.push('emailSettings');
    if (this.isEmail()) tools.push('emailWidth');
    tools.push('zoom', 'fit');
    return tools;
  });

  protected readonly firstGroup5Id = computed<OverflowToolId | null>(() => {
    const tools = this.overflowTools();
    return tools.find(
      (id) => id === 'layoutTag' || id === 'pageSetup' || id === 'emailSettings' || id === 'emailWidth' || id === 'zoom',
    ) ?? null;
  });

  protected readonly hasGroup4Tools = computed(() =>
    this.overflowTools().some((id) => id === 'align' || id === 'arrange' || id === 'layers' || id === 'pages'),
  );

  protected readonly visibleOverflow = overflowFit(
    this.overflowAreaRef,
    computed(() => [
      this.overflowTools(),
      this.language(),
      this.i18n(),
      this.layoutLabel(),
      this.pageSetupLabel(),
      this.zoomLabel(),
    ]),
  );

  protected readonly hasOverflow = computed(() => this.moreItems().length > 0);

  protected readonly tableMenuItems = computed<RibbonMenuItem[]>(() => {
    this.language();
    this.i18n();
    const list: RibbonMenuItem[] = [];
    const sStatic = this.tableStaticState();
    if (sStatic.state !== 'HIDDEN') {
      list.push({
        id: 'STATIC',
        label: this.transloco.translate('tplTools.ribbon.tableStatic'),
        icon: 'tablerTable',
        disabled: sStatic.state !== 'ENABLED',
        tooltip: this.reasonText(sStatic.reasonKey) ?? undefined,
      });
    }
    const sDynamic = this.tableDynamicState();
    if (sDynamic.state !== 'HIDDEN') {
      list.push({
        id: 'DYNAMIC',
        label: this.transloco.translate('tplTools.ribbon.tableDynamic'),
        icon: 'tablerTable',
        disabled: sDynamic.state !== 'ENABLED',
        tooltip: this.reasonText(sDynamic.reasonKey) ?? undefined,
      });
    }
    const sTotals = this.totalsState();
    if (sTotals.state !== 'HIDDEN') {
      list.push({
        id: 'TOTALS',
        label: this.transloco.translate('tplTools.ribbon.totals'),
        icon: 'tablerSum',
        disabled: sTotals.state !== 'ENABLED',
        tooltip: this.reasonText(sTotals.reasonKey) ?? undefined,
      });
    }
    return list;
  });

  protected readonly alignMenuItems = computed<RibbonMenuItem[]>(() => {
    this.language();
    this.i18n();
    return [
      { id: 'START', label: this.transloco.translate('tplTools.align.start'), icon: 'tablerLayoutAlignLeft', mirrorRtl: true },
      { id: 'CENTER_H', label: this.transloco.translate('tplTools.align.centerH'), icon: 'tablerLayoutAlignCenter' },
      { id: 'END', label: this.transloco.translate('tplTools.align.end'), icon: 'tablerLayoutAlignRight', mirrorRtl: true },
      { id: 'TOP', label: this.transloco.translate('tplTools.align.top'), icon: 'tablerLayoutAlignTop', divider: true },
      { id: 'CENTER_V', label: this.transloco.translate('tplTools.align.centerV'), icon: 'tablerLayoutAlignMiddle' },
      { id: 'BOTTOM', label: this.transloco.translate('tplTools.align.bottom'), icon: 'tablerLayoutAlignBottom' },
    ];
  });

  protected readonly arrangeMenuItems = computed<RibbonMenuItem[]>(() => {
    this.language();
    this.i18n();
    return [
      { id: 'FRONT', label: this.transloco.translate('tplTools.arrange.front'), icon: 'tablerStackFront' },
      { id: 'FORWARD', label: this.transloco.translate('tplTools.arrange.forward'), icon: 'tablerStackForward' },
      { id: 'BACKWARD', label: this.transloco.translate('tplTools.arrange.backward'), icon: 'tablerStackBackward' },
      { id: 'BACK', label: this.transloco.translate('tplTools.arrange.back'), icon: 'tablerStackBack' },
    ];
  });

  protected readonly zoomMenuItems = computed<RibbonMenuItem[]>(() => {
    this.language();
    this.i18n();
    const mode = this.state.zoomMode();
    const pct = this.zoomPercent();
    return [
      {
        id: 'FIT_WIDTH',
        label: this.transloco.translate('tplTools.ribbon.fitWidth'),
        selected: mode === 'FIT_WIDTH',
      },
      {
        id: 'FIT_PAGE',
        label: this.transloco.translate('tplTools.ribbon.fitPage'),
        selected: mode === 'FIT_PAGE',
      },
      ...ZOOM_PRESETS.map((value, idx) => ({
        id: `PCT:${value}`,
        label: `${value}%`,
        selected: mode === 'MANUAL' && pct === value,
        divider: idx === 0,
      })),
    ];
  });

  protected readonly activeMenuItems = computed<RibbonMenuItem[]>(() => {
    switch (this.openMenu()) {
      case 'table':
        return this.tableMenuItems();
      case 'align':
        return this.alignMenuItems();
      case 'arrange':
        return this.arrangeMenuItems();
      case 'zoom':
        return this.zoomMenuItems();
      default:
        return [];
    }
  });

  protected readonly activeMenuLabel = computed(() => {
    this.language();
    this.i18n();
    switch (this.openMenu()) {
      case 'table':
        return this.transloco.translate('tplTools.ribbon.table');
      case 'align':
        return this.transloco.translate('tplTools.ribbon.align');
      case 'arrange':
        return this.transloco.translate('tplTools.ribbon.arrange');
      case 'zoom':
        return this.transloco.translate('tplTools.ribbon.zoom');
      default:
        return '';
    }
  });

  protected readonly moreItems = computed<MenuItem[]>(() => {
    this.language();
    this.i18n();
    const tools = this.overflowTools();
    const cut = this.visibleOverflow();
    if (cut >= tools.length) return [];

    const items: MenuItem[] = [];
    for (const toolId of tools.slice(cut)) {
      switch (toolId) {
        case 'align':
          if (this.alignState().state === 'ENABLED') {
            items.push({
              id: 'align',
              label: this.transloco.translate('tplTools.ribbon.align'),
              icon: 'tablerLayoutAlignLeft',
              children: this.alignMenuItems().map((c) => ({
                id: `align:${c.id}`,
                label: c.label,
                icon: c.icon,
                divider: c.divider,
              })),
            });
          }
          break;
        case 'arrange':
          if (this.arrangeState().state === 'ENABLED') {
            items.push({
              id: 'arrange',
              label: this.transloco.translate('tplTools.ribbon.arrange'),
              icon: 'tablerStack2',
              children: this.arrangeMenuItems().map((c) => ({
                id: `arrange:${c.id}`,
                label: c.label,
                icon: c.icon,
              })),
            });
          }
          break;
        case 'layers':
          if (this.layersState().state === 'ENABLED') {
            items.push({
              id: 'layers',
              label: this.transloco.translate('tplTools.ribbon.layers'),
              icon: 'tablerStack2',
            });
          }
          break;
        case 'pages':
          if (this.pagesState().state === 'ENABLED') {
            items.push({
              id: 'pages',
              label: this.transloco.translate('tplTools.ribbon.pages'),
              icon: 'tablerFiles',
            });
          }
          break;
        case 'pageSetup':
          if (this.pageSetupState().state === 'ENABLED') {
            items.push({
              id: 'pageSetup',
              label: `${this.transloco.translate('tplTools.ribbon.pageSetup')} (${this.pageSetupLabel()})`,
              icon: 'tablerFileDescription',
            });
          }
          break;
        case 'emailSettings':
          if (this.emailSettingsState().state === 'ENABLED') {
            items.push({
              id: 'emailSettings',
              label: this.transloco.translate('tplTools.ribbon.emailSettings'),
              icon: 'tablerMail',
            });
          }
          break;
        case 'emailWidth':
          items.push({
            id: 'emailWidth',
            label: this.transloco.translate('tplTools.ribbon.previewWidth'),
            children: [
              {
                id: 'emailWidth:600',
                label: this.transloco.translate('tplTools.ribbon.widthPx', { w: 600 }),
                selected: this.state.emailWidthPx() === 600,
              },
              {
                id: 'emailWidth:320',
                label: this.transloco.translate('tplTools.ribbon.widthPx', { w: 320 }),
                selected: this.state.emailWidthPx() === 320,
              },
            ],
          });
          break;
        case 'zoom':
          items.push({
            id: 'zoom',
            label: `${this.transloco.translate('tplTools.ribbon.zoom')} (${this.zoomLabel()})`,
            icon: 'tablerZoomIn',
            children: this.zoomMenuItems().map((c) => ({
              id: `zoom:${c.id}`,
              label: c.label,
              selected: c.selected,
              divider: c.divider,
            })),
          });
          break;
        case 'fit':
          items.push({
            id: 'fit',
            label: this.fitTitle(),
            icon: 'tablerMaximize',
          });
          break;
        case 'layoutTag':
          break;
      }
    }
    return items;
  });

  constructor() {
    const closeOnScroll = (event: Event) => {
      if (!this.openMenu()) return;
      const target = event.target;
      const listEl = this.menuListRef()?.nativeElement;
      if (target instanceof Node && listEl?.contains(target)) return;
      this.closeMenu();
    };
    document.addEventListener('scroll', closeOnScroll, { capture: true, passive: true });
    this.destroyRef.onDestroy(() => document.removeEventListener('scroll', closeOnScroll, { capture: true }));

    const onHostKeydownCapture = (event: KeyboardEvent) => {
      if (event.defaultPrevented || this.openMenu()) return;
      const target = event.target;
      if (!(target instanceof HTMLButtonElement) || target.getAttribute('role') !== 'radio') return;
      const seg = target.closest<HTMLElement>('[data-ribbon-segmented]');
      if (!seg) return;

      const radios = Array.from(seg.querySelectorAll<HTMLButtonElement>('button[role="radio"]:not(:disabled)'));
      const radioIdx = radios.indexOf(target);
      if (radioIdx < 0) return;

      const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
      const nextKey = rtl ? 'ArrowLeft' : 'ArrowRight';
      const prevKey = rtl ? 'ArrowRight' : 'ArrowLeft';

      let dir: 'next' | 'prev' | 'first' | 'last' | null = null;
      if (event.key === nextKey && radioIdx === radios.length - 1) {
        dir = 'next';
      } else if (event.key === prevKey && radioIdx === 0) {
        dir = 'prev';
      } else if (event.key === 'Home') {
        dir = 'first';
      } else if (event.key === 'End') {
        dir = 'last';
      }
      if (!dir) return;

      event.preventDefault();
      event.stopPropagation();
      this.moveToolbarFocusFrom(target, dir);
    };
    this.host.nativeElement.addEventListener('keydown', onHostKeydownCapture, { capture: true });
    this.destroyRef.onDestroy(() =>
      this.host.nativeElement.removeEventListener('keydown', onHostKeydownCapture, { capture: true }),
    );

    afterRenderEffect(() => {
      const toolbar = this.toolbarRef()?.nativeElement;
      const activeKey = this.effectiveActiveToolKey();
      this.emailWidthStr();
      this.visibleOverflow();
      this.hasOverflow();
      this.isEmail();
      if (!toolbar) return;

      const seg = toolbar.querySelector<HTMLElement>('[data-ribbon-segmented]');
      if (seg) {
        const radios = Array.from(seg.querySelectorAll<HTMLButtonElement>('button[role="radio"]'));
        const checked = radios.find((btn) => btn.getAttribute('aria-checked') === 'true') ?? radios[0];
        for (const btn of radios) {
          if (btn === checked) {
            btn.dataset['ribbonTool'] = 'emailWidth';
            btn.tabIndex = activeKey === 'emailWidth' ? 0 : -1;
          } else {
            delete btn.dataset['ribbonTool'];
            btn.tabIndex = -1;
          }
        }
      }

      const moreBtn = toolbar.querySelector<HTMLButtonElement>('[data-ribbon-more] > button');
      if (moreBtn) {
        moreBtn.dataset['ribbonTool'] = 'more';
        moreBtn.tabIndex = activeKey === 'more' ? 0 : -1;
      }
    });
  }

  protected readonly effectiveActiveToolKey = computed(() => {
    const key = this.activeToolKey();
    if (key === 'select') return 'select';
    const visibleSet = new Set(this.overflowTools().slice(0, this.visibleOverflow()));
    switch (key) {
      case 'text':
        return this.textState().state !== 'HIDDEN' ? key : 'select';
      case 'image':
        return this.imageState().state !== 'HIDDEN' ? key : 'select';
      case 'dataField':
        return this.dataFieldState().state !== 'HIDDEN' ? key : 'select';
      case 'table':
        return this.isEmail() ? (this.tableStaticState().state !== 'HIDDEN' ? key : 'select') : key;
      case 'formula':
        return this.formulaState().state !== 'HIDDEN' ? key : 'select';
      case 'line':
        return this.lineState().state !== 'HIDDEN' ? key : 'select';
      case 'button':
        return this.isEmail() && this.buttonState().state !== 'HIDDEN' ? key : 'select';
      case 'link':
        return this.isEmail() && this.linkState().state !== 'HIDDEN' ? key : 'select';
      case 'undoStep':
      case 'redoStep':
        return key;
      case 'align':
      case 'arrange':
      case 'layers':
      case 'pages':
      case 'pageSetup':
      case 'emailSettings':
      case 'emailWidth':
      case 'zoom':
      case 'fit':
        return visibleSet.has(key) ? key : 'select';
      case 'more':
        return this.hasOverflow() ? key : 'select';
      default:
        return 'select';
    }
  });

  protected tabIndexFor(key: string): number {
    return this.effectiveActiveToolKey() === key ? 0 : -1;
  }

  protected toolButtonClass(enabled: boolean, active = false): string {
    if (active) return 'cursor-pointer bg-neutral-soft text-text';
    return enabled
      ? 'cursor-pointer text-text hover:bg-neutral-soft active:bg-border'
      : 'cursor-not-allowed text-text-placeholder';
  }

  protected onSegmentedFocusIn(): void {
    this.activeToolKey.set('emailWidth');
  }

  protected onMoreFocusIn(event: FocusEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.dataset['ribbonTool'] === 'more') {
      this.activeToolKey.set('more');
    }
  }

  protected reasonText(reasonKey: string | null): string | null {
    this.language();
    this.i18n();
    if (!reasonKey) return null;
    const fullKey = `tplDesigner.reason.${reasonKey}`;
    const translated = this.transloco.translate(fullKey);
    return translated && translated !== fullKey ? translated : null;
  }

  protected insertText(): void {
    if (this.textState().state !== 'ENABLED') return;
    this.state.insertNode({
      type: 'text',
      props: { text: this.transloco.translate('tplTools.defaults.text') },
    });
  }

  protected insertLine(): void {
    if (this.lineState().state !== 'ENABLED') return;
    this.state.insertNode({
      type: 'divider',
      props: { thicknessPx: 1, style: 'SOLID', color: '#3c4257' },
    });
  }

  protected runToolCommand(tool: DesignerTool, kind: 'insertImage' | 'insertDataField' | 'insertFormula' | 'insertButton' | 'insertLink' | 'openLayers' | 'openPages' | 'openPageSetup' | 'openEmailSettings'): void {
    if (this.state.toolState(tool).state !== 'ENABLED') return;
    this.state.run({ kind });
  }

  protected insertStaticTable(): void {
    if (this.tableStaticState().state !== 'ENABLED') return;
    this.state.run({ kind: 'insertTable', tableKind: 'STATIC' });
  }

  protected setEmailWidth(value: string | null): void {
    if (value === '600' || value === '320') {
      this.state.emailWidthPx.set(Number(value) as 600 | 320);
    }
  }

  protected undoStep(): void {
    if (!this.state.canUndo()) return;
    this.state.undo();
  }

  protected redoStep(): void {
    if (!this.state.canRedo()) return;
    this.state.redo();
  }

  protected toggleFit(): void {
    const next = this.state.zoomMode() === 'FIT_WIDTH' ? 'FIT_PAGE' : 'FIT_WIDTH';
    this.state.zoomMode.set(next);
  }

  protected toggleMenu(kind: RibbonMenuKind, event: Event): void {
    event.stopPropagation();
    if (kind === 'table' && this.tableMenuDisabled()) return;
    if (kind === 'align' && this.alignState().state !== 'ENABLED') return;
    if (kind === 'arrange' && this.arrangeState().state !== 'ENABLED') return;
    const triggerEl = event.currentTarget as HTMLElement;
    if (this.openMenu() === kind) {
      this.closeMenu();
      return;
    }
    this.menuTriggerEl = triggerEl;
    this.menuPlace.set(this.measureMenu(triggerEl, kind));
    this.openMenu.set(kind);
    afterNextRender(() => this.focusFirstEnabledMenuItem(), { injector: this.injector });
  }

  protected closeMenu(): void {
    this.openMenu.set(null);
  }

  protected closeMenuIfOutside(event: Event): void {
    if (this.openMenu() && !this.host.nativeElement.contains(event.target as Node)) {
      this.closeMenu();
    }
  }

  protected onMenuRowClick(item: RibbonMenuItem): void {
    if (item.disabled) return;
    const kind = this.openMenu();
    this.closeMenu();
    if (!kind) return;

    if (kind === 'table') {
      if (item.id === 'STATIC' && this.tableStaticState().state === 'ENABLED') {
        this.state.run({ kind: 'insertTable', tableKind: 'STATIC' });
      } else if (item.id === 'DYNAMIC' && this.tableDynamicState().state === 'ENABLED') {
        this.state.run({ kind: 'insertTable', tableKind: 'DYNAMIC' });
      } else if (item.id === 'TOTALS' && this.totalsState().state === 'ENABLED') {
        this.state.run({ kind: 'insertTotals' });
      }
      return;
    }

    if (kind === 'align' && this.alignState().state === 'ENABLED') {
      this.state.align(
        this.state.selectedIds(),
        item.id as 'START' | 'CENTER_H' | 'END' | 'TOP' | 'CENTER_V' | 'BOTTOM',
      );
      return;
    }

    if (kind === 'arrange' && this.arrangeState().state === 'ENABLED') {
      this.state.arrange(this.state.selectedIds(), item.id as 'FRONT' | 'BACK' | 'FORWARD' | 'BACKWARD');
      return;
    }

    if (kind === 'zoom') {
      this.applyZoomChoice(item.id);
    }
  }

  protected onMoreSelected(id: string): void {
    if (id.startsWith('align:')) {
      if (this.alignState().state !== 'ENABLED') return;
      const edge = id.slice('align:'.length) as 'START' | 'CENTER_H' | 'END' | 'TOP' | 'CENTER_V' | 'BOTTOM';
      this.state.align(this.state.selectedIds(), edge);
      return;
    }
    if (id.startsWith('arrange:')) {
      if (this.arrangeState().state !== 'ENABLED') return;
      const op = id.slice('arrange:'.length) as 'FRONT' | 'BACK' | 'FORWARD' | 'BACKWARD';
      this.state.arrange(this.state.selectedIds(), op);
      return;
    }
    if (id.startsWith('zoom:')) {
      this.applyZoomChoice(id.slice('zoom:'.length));
      return;
    }
    if (id.startsWith('emailWidth:')) {
      this.setEmailWidth(id.slice('emailWidth:'.length));
      return;
    }
    switch (id) {
      case 'layers':
        this.runToolCommand('LAYERS', 'openLayers');
        break;
      case 'pages':
        this.runToolCommand('PAGES', 'openPages');
        break;
      case 'pageSetup':
        this.runToolCommand('PAGE_SETUP', 'openPageSetup');
        break;
      case 'emailSettings':
        this.runToolCommand('EMAIL_SETTINGS', 'openEmailSettings');
        break;
      case 'fit':
        this.toggleFit();
        break;
    }
  }

  protected onToolbarKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented || this.openMenu()) return;

    const target = event.target as HTMLElement | null;
    if (!target?.matches('[data-ribbon-tool]')) return;
    if (target.closest('[data-ribbon-more]')?.querySelector('button[aria-expanded="true"]')) return;

    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    const nextKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const prevKey = rtl ? 'ArrowRight' : 'ArrowLeft';

    let dir: 'next' | 'prev' | 'first' | 'last' | null = null;
    if (event.key === nextKey) {
      dir = 'next';
    } else if (event.key === prevKey) {
      dir = 'prev';
    } else if (event.key === 'Home') {
      dir = 'first';
    } else if (event.key === 'End') {
      dir = 'last';
    } else {
      return;
    }

    event.preventDefault();
    this.moveToolbarFocusFrom(target, dir);
  }

  private moveToolbarFocusFrom(fromEl: HTMLElement, dir: 'next' | 'prev' | 'first' | 'last'): void {
    const toolbar = this.toolbarRef()?.nativeElement;
    if (!toolbar) return;

    const buttons = Array.from(toolbar.querySelectorAll<HTMLButtonElement>('[data-ribbon-tool]'));
    if (buttons.length === 0) return;

    const currentToolEl = fromEl.matches('[data-ribbon-tool]')
      ? (fromEl as HTMLButtonElement)
      : (fromEl.closest('[data-ribbon-segmented]')?.querySelector<HTMLButtonElement>('[data-ribbon-tool]') ?? null);
    const idx = currentToolEl ? buttons.indexOf(currentToolEl) : -1;
    if (idx < 0 && (dir === 'next' || dir === 'prev')) return;

    let nextIdx = 0;
    if (dir === 'next') {
      nextIdx = (idx + 1) % buttons.length;
    } else if (dir === 'prev') {
      nextIdx = (idx - 1 + buttons.length) % buttons.length;
    } else if (dir === 'first') {
      nextIdx = 0;
    } else {
      nextIdx = buttons.length - 1;
    }

    const nextBtn = buttons[nextIdx];
    const key = nextBtn.dataset['ribbonTool'];
    if (key) this.activeToolKey.set(key);
    nextBtn.focus();
  }

  protected onMenuKeydown(event: KeyboardEvent): void {
    if (!this.openMenu()) return;

    if (event.key === 'Tab') {
      this.closeMenu();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.closeMenu();
      this.menuTriggerEl?.focus();
      return;
    }

    const enabledButtons = this.menuRows()
      .map((r) => r.nativeElement)
      .filter((btn) => !btn.disabled);
    if (enabledButtons.length === 0) return;

    const target = event.target as HTMLElement | null;
    const idx = target ? enabledButtons.indexOf(target as HTMLButtonElement) : -1;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      enabledButtons[(idx + 1) % enabledButtons.length]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      enabledButtons[(idx - 1 + enabledButtons.length) % enabledButtons.length]?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      enabledButtons[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      enabledButtons[enabledButtons.length - 1]?.focus();
    } else if ((event.key === 'Enter' || event.key === ' ') && target instanceof HTMLButtonElement && !target.disabled) {
      event.preventDefault();
      target.click();
    }
  }

  private applyZoomChoice(id: string): void {
    if (id === 'FIT_WIDTH' || id === 'FIT_PAGE') {
      this.state.zoomMode.set(id);
      return;
    }
    if (id.startsWith('PCT:')) {
      const pct = Number(id.slice('PCT:'.length));
      if (Number.isFinite(pct) && pct >= 25 && pct <= 400) {
        this.state.zoomMode.set('MANUAL');
        this.state.zoom.set(pct / 100);
      }
    }
  }

  private focusFirstEnabledMenuItem(): void {
    if (!this.openMenu()) return;
    const first = this.menuRows().find((row) => !row.nativeElement.disabled)?.nativeElement;
    first?.focus();
  }

  private measureMenu(triggerEl: HTMLElement, kind: RibbonMenuKind): MenuPlace {
    const rect = rectInPage(triggerEl);
    const { width, height } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    const fromStart = rtl ? width - rect.right : rect.left;
    const fromEnd = rtl ? rect.left : width - rect.right;
    const alignEnd = kind === 'zoom' || fromStart > width * 0.65;
    const top = rect.bottom + 4;
    const maxHeight = Math.max(120, height - 8 - top);

    return {
      top,
      start: alignEnd ? null : Math.max(8, fromStart),
      end: alignEnd ? Math.max(8, fromEnd) : null,
      minWidth: Math.max(rect.width, 160),
      maxHeight,
    };
  }
}
