import {
  Component,
  DOCUMENT,
  afterRenderEffect,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Translation, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import type { ECElementEvent, EChartsOption } from 'echarts';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { LanguageState } from '../../../core/i18n/language';
import { ThemeState } from '../../../core/theme/theme';
import { buildChartOption } from './chart-options';
import { OTHER_SERIES_KEY, readChartColors } from './chart-theme';
import type { ChartColors, ChartContext, ChartKind, WidgetExecution } from './chart.model';

function lookupTranslation(dict: Translation, key: string): string | null {
  const flat = dict[key];
  if (typeof flat === 'string') return flat;

  const segments = key.split('.');
  let current: unknown = dict;
  for (const segment of segments) {
    if (!current || typeof current !== 'object') return null;
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === 'string' ? current : null;
}

function interpolateParams(template: string, params?: Record<string, unknown>): string {
  if (!params) return template;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, name: string) => {
    const val = params[name];
    return val == null ? '' : String(val);
  });
}

function createChartTranslator(dict: Translation): ChartContext['t'] {
  return (key: string, params?: Record<string, unknown>) => {
    const resolved = lookupTranslation(dict, key);
    return resolved !== null ? interpolateParams(resolved, params) : key;
  };
}

@Component({
  selector: 'ui-chart',
  imports: [NgxEchartsDirective],
  providers: [
    provideEchartsCore({ echarts: () => import('./chart-echarts').then((m) => m.echarts) }),
    provideTranslocoScope({ scope: 'chart', alias: 'chart' }),
  ],
  templateUrl: './chart.html',
  host: { class: 'block size-full min-h-0' },
})
export class Chart {
  private readonly document = inject(DOCUMENT);
  private readonly theme = inject(ThemeState).current;
  private readonly language = inject(LanguageState).current;
  private readonly transloco = inject(TranslocoService);
  private readonly dictionary = toSignal(this.transloco.selectTranslation('chart'), {
    initialValue: {} as Translation,
  });

  readonly kind = input.required<ChartKind>();
  readonly execution = input.required<WidgetExecution>();
  readonly ariaLabel = input('');

  readonly pointClick = output<{ pointKey: string; seriesKey?: string }>();

  protected readonly initOpts = { renderer: 'svg' as const };
  private readonly colors = signal<ChartColors>(
    readChartColors(this.document.documentElement),
  );

  constructor() {
    afterRenderEffect(() => {
      this.theme();
      this.colors.set(readChartColors(this.document.documentElement));
    });
  }

  protected readonly label = computed(() => {
    const given = this.ariaLabel();
    if (given) return given;
    this.dictionary();
    const key = `analytics.visualization.${this.kind()}`;
    const translated = this.transloco.translate(key);
    return translated === key ? this.kind() : translated;
  });

  protected readonly options = computed<EChartsOption>(() => {
    const lang = this.language();
    const ctx: ChartContext = {
      lang,
      dir: lang === 'ar' ? 'rtl' : 'ltr',
      colors: this.colors(),
      t: createChartTranslator(this.dictionary()),
    };
    return buildChartOption(this.kind(), this.execution(), ctx);
  });

  protected onClick(event: ECElementEvent): void {
    const data = event.data;
    let pointKey = '';
    let seriesKey: string | undefined;

    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const item = data as Record<string, unknown>;
      if (typeof item['key'] === 'string') {
        pointKey = item['key'];
      }
      if (typeof item['seriesKey'] === 'string') {
        seriesKey = item['seriesKey'];
      }
    }

    if (!pointKey && typeof event.name === 'string' && event.name) {
      pointKey = event.name;
    }

    if (!pointKey || pointKey === OTHER_SERIES_KEY) return;
    this.pointClick.emit(seriesKey !== undefined ? { pointKey, seriesKey } : { pointKey });
  }
}
