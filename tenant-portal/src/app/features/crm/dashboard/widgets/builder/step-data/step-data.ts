import { Component, ElementRef, computed, inject, signal, viewChildren } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerChecklist,
  tablerFileInvoice,
  tablerTarget,
  tablerUserPlus,
  tablerUsers,
} from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LanguageState } from '../../../../../../core/i18n/language';
import { Dropdown, type DropdownOption } from '../../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../../shared/ui/field/field';
import { listWidgets } from '../../widgets.api';
import type { WidgetSummary } from '../../widgets.model';
import {
  BUILDER_SOURCES,
  inferSourceFromQuery,
  metricMatchesSource,
  type BuilderSource,
} from '../builder-schemas';
import { BuilderState } from '../builder-state';
import { selectScopeTranslation } from '../../../../../../shared/widgets/dashboard/scope-translation';

interface SourceTile {
  id: BuilderSource;
  icon: string;
  tileClass: string;
}

const SOURCE_TILES: readonly SourceTile[] = [
  { id: 'leads', icon: 'tablerUserPlus', tileClass: 'bg-icon-green' },
  { id: 'opportunities', icon: 'tablerTarget', tileClass: 'bg-icon-red' },
  { id: 'activities', icon: 'tablerChecklist', tileClass: 'bg-icon-orange' },
  { id: 'customer_profiles', icon: 'tablerUsers', tileClass: 'bg-icon-blue' },
  { id: 'documents', icon: 'tablerFileInvoice', tileClass: 'bg-icon-teal' },
] as const;

@Component({
  selector: 'app-step-data',
  imports: [TranslocoPipe, NgIcon, Field, Dropdown],
  providers: [
    provideIcons({
      tablerUserPlus,
      tablerTarget,
      tablerChecklist,
      tablerUsers,
      tablerFileInvoice,
    }),
  ],
  templateUrl: './step-data.html',
  host: { class: 'flex min-w-0 flex-col gap-8' },
})
export class StepData {
  protected readonly state = inject(BuilderState);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly language = inject(LanguageState).current;
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly builderScope = toSignal(selectScopeTranslation(this.transloco, 'crm-widget-builder', 'builder'));
  private readonly tileButtons = viewChildren<ElementRef<HTMLButtonElement>>('tileBtn');

  protected readonly sources = SOURCE_TILES;
  protected readonly selectedPreset = signal<string>('');
  private readonly publishedWidgets = signal<WidgetSummary[]>([]);

  protected readonly selectedSource = computed(() => this.state.draft().source);
  protected readonly sourceError = computed(() => this.state.errors().data?.['source'] ?? null);

  protected readonly activeTileIndex = computed(() => {
    const current = this.selectedSource();
    if (!current) return 0;
    const idx = this.sources.findIndex((s) => s.id === current);
    return idx >= 0 ? idx : 0;
  });

  protected readonly startFromOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    this.builderScope();
    const lang = this.language();
    const scratch = this.transloco.translate('builder.data.startFromScratch');
    const recipePrefix = this.transloco.translate('builder.data.recipePrefix');
    const widgetPrefix = this.transloco.translate('builder.data.widgetPrefix');

    const options: DropdownOption<string>[] = [{ value: '', label: scratch }];

    const recipes = this.state.catalog()?.widgetRecipes ?? [];
    for (const recipe of recipes) {
      const name = lang === 'ar' ? recipe.nameAr : recipe.nameEn;
      options.push({ value: `recipe:${recipe.key}`, label: `${recipePrefix}: ${name}` });
    }

    for (const widget of this.publishedWidgets()) {
      options.push({ value: `widget:${widget.id}`, label: `${widgetPrefix}: ${widget.name}` });
    }

    return options;
  });

  constructor() {
    void this.loadPublishedWidgets();
  }

  protected selectSource(source: BuilderSource): void {
    const current = this.state.draft();
    if (current.source === source) return;

    const cat = this.state.catalog();
    const seriesKeep = (current.querySpec.series ?? []).filter((s) => {
      const metric = cat?.metrics.find((m) => m.key === s.metricKey);
      return metric ? metricMatchesSource(metric, source) : false;
    });

    if (seriesKeep.length === (current.querySpec.series ?? []).length && seriesKeep.length > 0) {
      this.state.patch({ source });
      return;
    }

    this.state.patch({
      source,
      querySpec: {
        ...current.querySpec,
        series: [],
        dimension: undefined,
        breakdown: undefined,
      },
    });
  }

  protected onTileKeydown(event: KeyboardEvent, index: number): void {
    const count = this.sources.length;
    if (count === 0) return;

    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    const nextKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const prevKey = rtl ? 'ArrowRight' : 'ArrowLeft';

    let nextIndex = -1;
    if (event.key === nextKey || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % count;
    } else if (event.key === prevKey || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + count) % count;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = count - 1;
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.selectSource(this.sources[index].id);
      return;
    } else {
      return;
    }

    event.preventDefault();
    const nextSource = this.sources[nextIndex];
    this.selectSource(nextSource.id);
    this.tileButtons()[nextIndex]?.nativeElement.focus();
  }

  protected onStartFromChange(choice: string): void {
    const prevChoice = this.selectedPreset();
    this.selectedPreset.set(choice);

    if (!choice) {
      if (prevChoice) {
        this.state.patch({
          visualizationType: null,
          querySpec: {
            series: [],
            filters: { datePreset: 'CURRENT_MONTH' },
            comparison: { type: 'NONE' },
            scopeBinding: { kind: 'VIEWER_RELATIVE' },
          },
          displaySpec: {
            numberFormat: 'auto',
            legendPosition: 'top',
          },
        });
      }
      return;
    }

    const catalog = this.state.catalog();
    if (choice.startsWith('recipe:')) {
      const key = choice.slice('recipe:'.length);
      const recipe = catalog?.widgetRecipes.find((r) => r.key === key);
      if (!recipe) return;

      const queryCopy = structuredClone(recipe.querySpec);
      const displayCopy = structuredClone(recipe.displaySpec);
      const inferred =
        inferSourceFromQuery(queryCopy, catalog) ??
        this.firstValidSource(recipe.sourceResources);

      this.state.patch({
        source: inferred,
        visualizationType: recipe.visualizationType,
        querySpec: {
          ...queryCopy,
          filters: queryCopy.filters ?? { datePreset: 'CURRENT_MONTH' },
          comparison: queryCopy.comparison ?? { type: 'NONE' },
          scopeBinding: queryCopy.scopeBinding ?? { kind: 'VIEWER_RELATIVE' },
        },
        displaySpec: displayCopy,
      });
      return;
    }

    if (choice.startsWith('widget:')) {
      const id = choice.slice('widget:'.length);
      const widget = this.publishedWidgets().find((w) => w.id === id);
      if (!widget || !widget.querySpec) return;

      const queryCopy = structuredClone(widget.querySpec);
      const displayCopy = structuredClone(widget.displaySpec ?? {});
      const inferred =
        inferSourceFromQuery(queryCopy, catalog) ??
        this.firstValidSource(widget.sourceResources);

      this.state.patch({
        source: inferred,
        visualizationType: widget.visualizationType,
        querySpec: {
          ...queryCopy,
          filters: queryCopy.filters ?? { datePreset: 'CURRENT_MONTH' },
          comparison: queryCopy.comparison ?? { type: 'NONE' },
          scopeBinding: queryCopy.scopeBinding ?? { kind: 'VIEWER_RELATIVE' },
        },
        displaySpec: displayCopy,
      });
    }
  }

  private firstValidSource(resources: readonly string[]): BuilderSource | null {
    const match = resources.find((r) => (BUILDER_SOURCES as readonly string[]).includes(r));
    return (match as BuilderSource | undefined) ?? null;
  }

  private async loadPublishedWidgets(): Promise<void> {
    try {
      const page = await listWidgets({ status: 'PUBLISHED', limit: 50 });
      this.publishedWidgets.set(page.items.filter((w) => w.querySpec !== null));
    } catch {
      // Optional preset list; ignore if unavailable.
    }
  }
}
