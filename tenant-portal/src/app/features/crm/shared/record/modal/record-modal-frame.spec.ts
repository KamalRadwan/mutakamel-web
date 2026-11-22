import { Component, Injectable, computed, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoLoader, TranslocoService, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { RecordModalFrame } from './record-modal-frame';

/** Answers synchronously, so translationLoadSuccess fires while the template is rendering. */
@Injectable()
class SyncLoader implements TranslocoLoader {
  getTranslation(path: string) {
    const ar = path.endsWith('/ar');
    if (!path.startsWith('record-modal/')) return of({});
    return of({ footer: { create: ar ? 'إنشاء' : 'Create', cancel: ar ? 'إلغاء' : 'Cancel' } });
  }
}

const dialogProto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
const originalDialog = { showModal: dialogProto['showModal'], close: dialogProto['close'] };

/**
 * Like the record modals that host the frame: the host re-translates from Transloco events, so the
 * frame's `| transloco` pipes loading the record-modal scope during render reach the host's signal.
 */
@Component({
  imports: [RecordModalFrame],
  template: `<app-record-modal-frame [(open)]="open" mode="create" [typeTitle]="title()" [showFullPage]="false" />`,
})
class Host {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  readonly open = signal(true);
  readonly title = computed(() => {
    this.i18n();
    return this.transloco.translate('lead');
  });
}

describe('RecordModalFrame with a synchronous translation loader', () => {
  beforeEach(() => {
    dialogProto['showModal'] = function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    dialogProto['close'] = function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    };
  });

  afterEach(() => {
    dialogProto['showModal'] = originalDialog.showModal;
    dialogProto['close'] = originalDialog.close;
  });

  it('renders the footer without NG0600 and re-translates on language change', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['ar', 'en'], defaultLang: 'en', reRenderOnLangChange: true },
          loader: SyncLoader,
        }),
      ],
    });
    const fixture = TestBed.createComponent(Host);
    expect(() => fixture.detectChanges()).not.toThrow();
    await fixture.whenStable();
    const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text()).toContain('Create');
    expect(text()).toContain('Cancel');

    TestBed.inject(TranslocoService).setActiveLang('ar');
    await fixture.whenStable();
    expect(() => fixture.detectChanges()).not.toThrow();
    expect(text()).toContain('إنشاء');
    expect(text()).toContain('إلغاء');
    fixture.destroy();
  });
});
