import { DOCUMENT } from '@angular/common';
import { Component, ElementRef, computed, inject, viewChildren } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerBuildingCommunity,
  tablerFlag,
  tablerHome,
  tablerMap,
  tablerPolygon,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';

interface GeographyTabItem {
  id: 'countries' | 'states' | 'cities' | 'districts' | 'zones';
  icon: string;
  labelKey: string;
}

const GEOGRAPHY_TABS: readonly GeographyTabItem[] = [
  { id: 'countries', icon: 'tablerFlag', labelKey: 'wsGeo.tabs.countries' },
  { id: 'states', icon: 'tablerMap', labelKey: 'wsGeo.tabs.states' },
  { id: 'cities', icon: 'tablerBuildingCommunity', labelKey: 'wsGeo.tabs.cities' },
  { id: 'districts', icon: 'tablerHome', labelKey: 'wsGeo.tabs.districts' },
  { id: 'zones', icon: 'tablerPolygon', labelKey: 'wsGeo.tabs.zones' },
];

@Component({
  selector: 'app-geography-page',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, NgIcon, TranslocoPipe],
  providers: [
    provideIcons({
      tablerFlag,
      tablerMap,
      tablerBuildingCommunity,
      tablerHome,
      tablerPolygon,
    }),
  ],
  templateUrl: './geography-page.html',
  host: { class: 'flex flex-1 shrink-0 flex-col' },
})
export class GeographyPage {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly routerEvents = toSignal(this.router.events);
  private readonly language = inject(LanguageState).current;
  private readonly tabLinks = viewChildren<ElementRef<HTMLAnchorElement>>('tabLink');

  protected readonly tabs = GEOGRAPHY_TABS;

  protected readonly activeTabId = computed<GeographyTabItem['id']>(() => {
    this.routerEvents();
    const path = this.router.url.split(/[?#]/)[0] ?? '';
    return GEOGRAPHY_TABS.find((tab) => path.endsWith(`/${tab.id}`))?.id ?? 'countries';
  });

  protected onTabKeydown(event: KeyboardEvent): void {
    const links = this.tabLinks();
    if (!links.length) return;

    const activeEl = this.document.activeElement;
    let currentIdx = links.findIndex((ref) => ref.nativeElement === activeEl);
    if (currentIdx < 0) {
      currentIdx = links.findIndex((ref) => ref.nativeElement.getAttribute('aria-selected') === 'true');
    }
    if (currentIdx < 0) currentIdx = 0;

    const rtl = this.language() === 'ar';
    const nextKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const prevKey = rtl ? 'ArrowRight' : 'ArrowLeft';

    let nextIdx = -1;
    if (event.key === nextKey) nextIdx = (currentIdx + 1) % links.length;
    else if (event.key === prevKey) nextIdx = (currentIdx - 1 + links.length) % links.length;
    else if (event.key === 'Home') nextIdx = 0;
    else if (event.key === 'End') nextIdx = links.length - 1;
    else return;

    event.preventDefault();
    const target = links[nextIdx]?.nativeElement;
    if (target) {
      target.focus();
      target.click();
    }
  }
}
