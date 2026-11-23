import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoService, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../../../public/i18n/staff/en.json';
import ar from '../../../../../../../public/i18n/staff/ar.json';
import { BlockersDialog } from './blockers-dialog';

class EmptyLoader { getTranslation() { return of({}); } }

describe('BlockersDialog', () => {
  let fixture: ComponentFixture<BlockersDialog>;
  const dialog = HTMLDialogElement.prototype;
  const { showModal, close } = dialog;

  beforeEach(() => {
    dialog.showModal = function () { this.setAttribute('open', ''); };
    dialog.close = function () {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
    TestBed.configureTestingModule({ providers: [
      provideRouter([]),
      provideTransloco({
        config: { availableLangs: ['en', 'ar'], defaultLang: 'en', reRenderOnLangChange: true, missingHandler: { logMissingKey: false } },
        loader: EmptyLoader,
      }),
    ] });
    const transloco = TestBed.inject(TranslocoService);
    transloco.setTranslation({ staff: en }, 'en');
    transloco.setTranslation({ staff: ar }, 'ar');
    fixture = TestBed.createComponent(BlockersDialog);
    fixture.detectChanges();
  });

  afterEach(() => { dialog.showModal = showModal; dialog.close = close; vi.restoreAllMocks(); });

  it.each(['en', 'ar'])('one blocker uses introOne in %s', (lang) => {
    TestBed.inject(TranslocoService).setActiveLang(lang);
    void fixture.componentInstance.open({ blockers: ['team has memberships'] });
    fixture.detectChanges();
    const texts = lang === 'en' ? en : ar;
    expect(fixture.nativeElement.querySelector('p').textContent.trim()).toBe(texts.blockers.introOne);
    expect(fixture.nativeElement.textContent).toContain(texts.blockers.teamHasMemberships);
  });

  it('two blockers use intro', () => {
    void fixture.componentInstance.open({ blockers: ['team has memberships', 'team has placed users'] });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('p').textContent.trim()).toBe(en.blockers.intro);
  });

  it('an unknown blocker phrase shows as is', () => {
    void fixture.componentInstance.open({ blockers: ['A new server blocker'] });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('li').textContent.trim()).toBe('A new server blocker');
  });

  it('primaryAction runs and closes', async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const closed = fixture.componentInstance.open({ blockers: ['branch has references; deactivate the branch instead'], primaryAction: { label: 'Deactivate', run } });
    fixture.detectChanges();
    const button = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find((element) => element.textContent.trim() === 'Deactivate')!;
    button.click();
    await closed;
    fixture.detectChanges();
    expect(run).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.querySelector('dialog').hasAttribute('open')).toBe(false);
  });
});
