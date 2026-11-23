import { Injectable, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoLoader, TranslocoService, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../../../../../../public/i18n/en.json';
import enAnalytics from '../../../../../../../../public/i18n/analytics/en.json';
import enBuilder2 from '../../../../../../../../public/i18n/crm-widget-builder-2/en.json';
import { LanguageState } from '../../../../../../core/i18n/language';
import type { Catalog } from '../../../../../../shared/widgets/dashboard/analytics.model';
import type { BuilderDraft } from '../builder-schemas';
import { BuilderState } from '../builder-state';
import { StepPresentation } from './step-presentation';

@Injectable()
class StepLoader implements TranslocoLoader {
  getTranslation(path: string) {
    if (path.startsWith('crm-widget-builder-2/')) return of(enBuilder2);
    if (path.startsWith('analytics/')) return of(enAnalytics);
    return of(en);
  }
}

describe('StepPresentation series colours', () => {
  it('renders fixed design-system chart token display swatches without free colour inputs', async () => {
    const catalog = signal<Catalog | null>(null);
    const draft = signal<BuilderDraft>({
      source: 'leads',
      name: 'Leads trend',
      description: '',
      visualizationType: 'LINE',
      querySpec: {
        series: [
          { metricKey: 'crm.leads.created_count', label: 'Created' },
          { metricKey: 'crm.leads.converted_count', label: 'Converted' },
        ],
        dimension: { key: 'time', grain: 'MONTH' },
        filters: { datePreset: 'CURRENT_YEAR' },
      },
      displaySpec: { legendPosition: 'top', numberFormat: 'auto' },
    });
    const errors = signal<Record<string, Record<string, string>>>({});

    TestBed.configureTestingModule({
      imports: [StepPresentation],
      providers: [
        provideTransloco({
          config: { availableLangs: ['en'], defaultLang: 'en', prodMode: true },
          loader: StepLoader,
        }),
        { provide: LanguageState, useValue: { current: signal<'en' | 'ar'>('en') } },
        {
          provide: BuilderState,
          useValue: {
            catalog,
            draft,
            errors,
            patch: vi.fn(),
            patchQuery: vi.fn(),
            patchDisplay: vi.fn(),
            refreshPreview: vi.fn(),
          },
        },
      ],
    });

    TestBed.inject(TranslocoService).setTranslation(
      { ...en, builder2: enBuilder2, analytics: enAnalytics },
      'en',
    );

    const fixture = TestBed.createComponent(StepPresentation);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    const seriesContainer = host.querySelector('#presentation-series-colours');
    expect(seriesContainer).not.toBeNull();
    expect(seriesContainer?.querySelector('.bg-chart-1')).not.toBeNull();
    expect(seriesContainer?.querySelector('.bg-chart-2')).not.toBeNull();
    expect(host.querySelector('input[type="color"]')).toBeNull();

    fixture.destroy();
  });
});
