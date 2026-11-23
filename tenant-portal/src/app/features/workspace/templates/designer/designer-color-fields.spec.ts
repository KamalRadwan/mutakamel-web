import { computed, signal, type Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../../public/i18n/en.json';
import ar from '../../../../../../public/i18n/ar.json';
import fieldsEn from '../../../../../../public/i18n/templates-designer-fields/en.json';
import fieldsAr from '../../../../../../public/i18n/templates-designer-fields/ar.json';
import tablesEn from '../../../../../../public/i18n/templates-designer-tables/en.json';
import tablesAr from '../../../../../../public/i18n/templates-designer-tables/ar.json';
import emailEn from '../../../../../../public/i18n/templates-designer-email/en.json';
import emailAr from '../../../../../../public/i18n/templates-designer-email/ar.json';
import { LanguageState } from '../../../../core/i18n/language';
import { ColorPicker } from '../../../../shared/ui/color-picker/color-picker';
import { Modal } from '../../../../shared/ui/modal/modal';
import type {
  TemplateDocumentV1,
  TemplateNodeBase,
  TemplateStaticTableNode,
} from '../templates.model';
import { designerColorSwatches } from './designer-color-swatches';
import { DesignerState } from './designer-state';
import { EmailSettingsModal } from './email/email-settings-modal/email-settings-modal';
import { PageSetupModal } from './fields/page-setup-modal/page-setup-modal';
import { PropertiesModal } from './fields/properties-modal/properties-modal';
import { TableSettingsModal } from './tables/table-settings-modal/table-settings-modal';

class Loader {
  getTranslation() {
    return of({});
  }
}

function makeDocument(): TemplateDocumentV1 {
  const base: TemplateNodeBase = {
    id: 'text',
    parentId: null,
    childIds: [],
    hidden: false,
    locked: false,
    layout: { kind: 'FLOW', order: 0 },
    style: {
      color: '#12345680',
      backgroundColor: '#ABCDEF',
      border: { widthPx: 1, style: 'SOLID', color: '#112233' },
    },
  };
  const table: TemplateStaticTableNode = {
    ...base,
    id: 'table',
    type: 'staticTable',
    props: {
      columns: [
        {
          id: 'column',
          width: { value: 100, unit: 'PERCENT' },
          align: 'START',
          visible: true,
          headerStyle: { color: '#12345680' },
          cellStyle: { backgroundColor: '#ABCDEF' },
        },
      ],
      rows: [{ id: 'row', cells: [{ id: 'cell', columnId: 'column', value: { kind: 'TEXT', value: 'Value' } }] }],
      repeatHeader: 'EVERY_PAGE',
      keepRowsTogether: false,
      rowSplit: 'ALLOW',
      stripedRows: false,
    },
  };
  return {
    schemaVersion: 1,
    documentType: 'QUOTATION',
    outputChannel: 'PRINT',
    layoutMode: 'FLOW_DOCUMENT',
    dataSourceKey: 'TRADE_QUOTATION_PRINT_V1',
    locale: 'en-US',
    direction: 'LTR',
    page: {
      unit: 'MM',
      preset: 'A4',
      orientation: 'PORTRAIT',
      widthMm: 210,
      heightMm: 297,
      marginMm: { top: 12, end: 12, bottom: 12, start: 12 },
      background: { kind: 'SOLID', color: '#44556680' },
    },
    email: {
      subject: { segments: [{ kind: 'TEXT', value: 'Subject' }] },
      maxWidthPx: 600,
      backgroundColor: '#ABCDEF80',
    },
    theme: {
      fontFamilyToken: 'SYSTEM_SANS',
      baseFontSizePx: 12,
      textColor: '#12141C',
      lineHeight: 1.4,
    },
    rootNodeIds: ['text', 'divider', 'table'],
    nodes: {
      text: { ...base, type: 'text', props: { text: 'Text' } },
      divider: {
        ...base,
        id: 'divider',
        type: 'divider',
        style: {},
        props: { thicknessPx: 1, style: 'SOLID', color: '#55667780' },
      },
      table,
    },
  };
}

function element<T extends Element>(host: ParentNode, selector: string): T {
  const found = host.querySelector<T>(selector);
  if (found === null) throw new Error(`Missing ${selector}`);
  return found;
}

function inputColor(host: ParentNode, selector: string, value: string): void {
  const input = element<HTMLInputElement>(host, `${selector} input`);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('Designer colour fields', () => {
  beforeEach(() => {
    vi.spyOn(Modal.prototype, 'open').mockImplementation(() => {});
    vi.spyOn(Modal.prototype, 'close').mockImplementation(() => {});
    document.documentElement.style.setProperty('--brand', '#1D56C9');
  });
  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.style.removeProperty('--brand');
    delete document.documentElement.dataset['theme'];
    document.documentElement.removeAttribute('dir');
  });

  async function setup<T>(component: Type<T>, language = 'en', theme = 'light') {
    const doc = signal(makeDocument());
    const readOnly = signal(false);
    const state = {
      document: doc,
      readOnly,
      channel: computed(() => doc().outputChannel),
      layoutMode: computed(() => doc().layoutMode),
      currentPage: computed(() => doc().page),
      pageIndex: signal(0),
      schema: signal(null),
      schemaFailed: signal(false),
      fieldLabel: (path: string) => path,
      updateNode: vi.fn(),
      apply: vi.fn((_label: string, mutate: (value: TemplateDocumentV1) => void) => {
        const next = structuredClone(doc());
        mutate(next);
        doc.set(next);
      }),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: DesignerState, useValue: state },
        { provide: LanguageState, useValue: { current: signal(language) } },
        provideTransloco({
          config: { availableLangs: ['en', 'ar'], defaultLang: language, prodMode: true },
          loader: Loader,
        }),
      ],
    });
    const transloco = TestBed.inject(TranslocoService);
    transloco.setTranslation(
      { ...en, tplFields: fieldsEn, tplTables: tablesEn, tplEmail: emailEn },
      'en',
    );
    transloco.setTranslation(
      { ...ar, tplFields: fieldsAr, tplTables: tablesAr, tplEmail: emailAr },
      'ar',
    );
    document.documentElement.dataset['theme'] = theme;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    const fixture = TestBed.createComponent(component);
    const modal = fixture.componentInstance;
    if (modal instanceof TableSettingsModal) {
      fixture.componentRef.setInput('pickField', async () => null);
      fixture.componentRef.setInput('editCellFn', async () => null);
    } else if (modal instanceof EmailSettingsModal) {
      fixture.componentRef.setInput('pickField', async () => null);
    }
    fixture.detectChanges();
    await fixture.whenStable();
    if (modal instanceof PropertiesModal) modal.open('text');
    else if (modal instanceof TableSettingsModal) {
      modal.open('table');
      modal['activeTab'].set('options');
    } else if (modal instanceof EmailSettingsModal || modal instanceof PageSetupModal) modal.open();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, state, host: fixture.nativeElement as HTMLElement };
  }

  it('collects nested document colours before brand, including canvas pages and table styles', () => {
    const doc = makeDocument();
    doc.canvasPages = [
      {
        id: 'page',
        name: 'Page',
        rootNodeIds: [],
        page: {
          ...doc.page,
          unit: 'MM',
          preset: 'A4',
          orientation: 'PORTRAIT',
          widthMm: 210,
          heightMm: 297,
          marginMm: { top: 12, end: 12, bottom: 12, start: 12 },
          background: { kind: 'SOLID', color: '#AABBCC80' },
        },
      },
    ];
    const swatches = designerColorSwatches(doc) ?? [];
    expect(swatches.slice(0, 3)).toEqual(['#44556680', '#AABBCC80', '#ABCDEF80']);
    expect(swatches).toContain('#55667780');
    expect(swatches.filter((color) => color === '#12345680')).toHaveLength(1);
    expect(swatches.at(-1)).toBe('#1D56C9');
  });

  for (const language of ['en', 'ar']) {
    for (const theme of ['light', 'dark']) {
      it(`keeps translated labels, hints, alpha, palettes and readonly fields in ${language}/${theme}`, async () => {
        const { fixture, state, host } = await setup(PropertiesModal, language, theme);
        const pickers = fixture.debugElement.queryAll(By.directive(ColorPicker));
        expect(pickers).toHaveLength(3);
        for (const debug of pickers) {
          const picker: ColorPicker = debug.componentInstance;
          expect(picker.allowAlpha()).toBe(true);
          expect(picker.nullable()).toBe(true);
          expect(picker.swatches()).toContain('#44556680');
          expect(picker.swatches()?.at(-1)).toBe('#1D56C9');
          const input = element<HTMLInputElement>(debug.nativeElement, 'input');
          expect(input.getAttribute('aria-describedby')).toContain(`${input.id}-hint`);
          const field = input.closest('ui-field');
          if (field === null) throw new Error('Missing field wrapper');
          expect(element<HTMLLabelElement>(field, 'label').htmlFor).toBe(input.id);
          const hint = element<HTMLElement>(field, '[data-ui-hint]');
          expect(hint.getAttribute('aria-describedby')).toBe(`${input.id}-hint`);
          expect(element<HTMLElement>(field, '[role="tooltip"]').textContent?.trim()).toBeTruthy();
          expect(element<HTMLElement>(hint, 'ng-icon').getAttribute('name')).toBe('tablerExclamationCircle');
          expect(picker.ariaLabel()).not.toContain('tplFields.');
        }
        state.readOnly.set(true);
        fixture.detectChanges();
        const input = element<HTMLInputElement>(host, 'ui-color-picker input');
        expect(input.readOnly).toBe(true);
        inputColor(host, 'ui-color-picker', '#000000');
        expect(fixture.componentInstance['propModel']().textColor).toBe('#12345680');
      });
    }
  }

  it('saves alpha colours, reports invalid drafts, and restores on Escape', async () => {
    const { fixture, state, host } = await setup(PropertiesModal);
    const picker = element<HTMLElement>(host, 'ui-color-picker');
    element<HTMLElement>(picker, '[data-color-trigger]').click();
    fixture.detectChanges();
    inputColor(picker, '', '#bad');
    fixture.detectChanges();
    expect(fixture.componentInstance['canApply']()).toBe(true);
    inputColor(picker, '', '#invalid');
    fixture.detectChanges();
    expect(fixture.componentInstance['canApply']()).toBe(false);
    expect(element<HTMLInputElement>(picker, 'input').getAttribute('aria-describedby')).toContain(
      'tpl-prop-text-color-error',
    );
    element<HTMLInputElement>(picker, 'input').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    fixture.detectChanges();
    expect(fixture.componentInstance['propModel']().textColor).toBe('#12345680');
    inputColor(picker, '', '#AABBCC80');
    fixture.detectChanges();
    fixture.componentInstance['apply']();
    expect(state.updateNode).toHaveBeenCalledWith(
      'text',
      expect.objectContaining({ style: expect.objectContaining({ color: '#AABBCC80' }) }),
      'updateProperties',
    );
  });

  it('allows no background or border while retaining required line validation', async () => {
    const { fixture, state, host } = await setup(PropertiesModal);
    for (const id of ['tpl-prop-bg-color', 'tpl-prop-border-color']) {
      const picker = element<HTMLElement>(host, `ui-color-picker[id="${id}"]`);
      element<HTMLElement>(picker, '[data-color-trigger]').click();
      fixture.detectChanges();
      element<HTMLButtonElement>(picker, '[data-no-color]').click();
      fixture.detectChanges();
      document.body.click();
      fixture.detectChanges();
    }
    expect(fixture.componentInstance['borderStyle']()).toBe('NONE');
    fixture.componentInstance['apply']();
    const patch = state.updateNode.mock.calls.at(-1)?.[1];
    expect(patch?.style.backgroundColor).toBeUndefined();
    expect(patch?.style.border).toBeUndefined();
    fixture.componentInstance.open('divider');
    fixture.detectChanges();
    const line: ColorPicker = fixture.debugElement.query(
      By.directive(ColorPicker),
    ).componentInstance;
    expect(line.nullable()).toBe(false);
    expect(line.allowAlpha()).toBe(true);
    inputColor(host, 'ui-color-picker', '');
    fixture.detectChanges();
    expect(fixture.componentInstance['lineColorError']()).toBeTruthy();
    expect(fixture.componentInstance['canApply']()).toBe(false);
  });

  it('saves page alpha and removes a nullable page background on dismissal', async () => {
    const { fixture, state, host } = await setup(PageSetupModal);
    inputColor(host, 'ui-color-picker', '#12345680');
    fixture.detectChanges();
    fixture.componentInstance['apply']();
    expect(state.document().page?.background).toEqual({ kind: 'SOLID', color: '#12345680' });
    fixture.componentInstance.open();
    fixture.detectChanges();
    element<HTMLElement>(host, '[data-color-trigger]').click();
    fixture.detectChanges();
    element<HTMLButtonElement>(host, '[data-no-color]').click();
    fixture.detectChanges();
    document.body.click();
    fixture.detectChanges();
    expect(fixture.componentInstance['bgMode']()).toBe('NONE');
    fixture.componentInstance['apply']();
    expect(state.document().page?.background).toBeUndefined();
  });

  it('uses alpha-enabled pickers for both header and cell table styles and preserves required border errors', async () => {
    const { fixture, state, host } = await setup(TableSettingsModal);
    expect(fixture.debugElement.queryAll(By.directive(ColorPicker))).toHaveLength(6);
    const pickers = Array.from(host.querySelectorAll<HTMLElement>('ui-color-picker'));
    for (const picker of pickers) inputColor(picker, '', '#AABBCC80');
    fixture.detectChanges();
    fixture.componentInstance['apply']();
    expect(state.updateNode).toHaveBeenCalledWith(
      'table',
      expect.objectContaining({
        props: expect.objectContaining({
          columns: [
            expect.objectContaining({
              headerStyle: expect.objectContaining({
                color: '#AABBCC80',
                backgroundColor: '#AABBCC80',
              }),
              cellStyle: expect.objectContaining({
                color: '#AABBCC80',
                backgroundColor: '#AABBCC80',
              }),
            }),
          ],
        }),
      }),
      'updateTable',
    );
    fixture.componentInstance['updateHeaderStyle']('borderWidthPx', '1');
    fixture.componentInstance['onStyleColorInput']('header', 'borderColor', '');
    expect(
      fixture.componentInstance['borderColorError'](
        fixture.componentInstance['headerStyleDraft'](),
      ),
    ).toBeTruthy();
    fixture.componentInstance['normalizeColorField']('header', 'borderColor');
    expect(
      fixture.componentInstance['borderColorError'](
        fixture.componentInstance['headerStyleDraft'](),
      ),
    ).toBeNull();
  });

  it('keeps email invalid-draft errors and saves optional alpha backgrounds', async () => {
    const { fixture, state, host } = await setup(EmailSettingsModal);
    inputColor(host, 'ui-color-picker', '#invalid');
    fixture.componentInstance['onBackgroundBlur']();
    fixture.detectChanges();
    expect(fixture.componentInstance['backgroundError']()).toBeTruthy();
    fixture.componentInstance['submit']();
    expect(state.apply).not.toHaveBeenCalled();
    inputColor(host, 'ui-color-picker', '#AABBCC80');
    fixture.detectChanges();
    fixture.componentInstance['submit']();
    expect(state.document().email?.backgroundColor).toBe('#AABBCC80');
    fixture.componentInstance['onBackgroundInput'](null);
    fixture.detectChanges();
    fixture.componentInstance['submit']();
    expect(state.document().email?.backgroundColor).toBeUndefined();
  });
});
