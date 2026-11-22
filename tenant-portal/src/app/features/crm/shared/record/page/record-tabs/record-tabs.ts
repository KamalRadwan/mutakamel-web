import { Component, ElementRef, computed, inject, input, model, viewChildren } from '@angular/core';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerCalendarEvent,
  tablerHistory,
  tablerLayoutList,
  tablerPaperclip,
  tablerPhoneCall,
} from '@ng-icons/tabler-icons';

export interface RecordTab {
  id: string;
  icon: string;
  label: string;
  count?: number | null;
  alert?: string | null;
  errorDot?: boolean;
  disabled?: boolean;
}

/** Underline tablist with roving tabindex, counters, alerts, error dot, and RTL arrow navigation. */
@Component({
  selector: 'app-record-tabs',
  imports: [NgIcon, TranslocoPipe],
  viewProviders: [provideTranslocoScope({ scope: 'record-page', alias: 'recordPage' })],
  providers: [
    provideIcons({
      tablerLayoutList,
      tablerCalendarEvent,
      tablerPhoneCall,
      tablerPaperclip,
      tablerHistory,
    }),
  ],
  templateUrl: './record-tabs.html',
  host: { class: 'block min-w-0' },
})
export class RecordTabs {
  private static nextId = 0;
  private readonly fallbackPrefix = `record-tabs-${++RecordTabs.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly tabButtons = viewChildren<ElementRef<HTMLButtonElement>>('tabBtn');

  readonly tabs = input.required<readonly RecordTab[]>();
  readonly active = model.required<string>();
  readonly idPrefix = input('');
  readonly label = input<string | null>(null);

  protected readonly prefix = computed(() => this.idPrefix() || this.fallbackPrefix);

  protected readonly focusableIndex = computed(() => {
    const list = this.tabs();
    const current = this.active();
    const selectedIdx = list.findIndex((item) => !item.disabled && item.id === current);
    if (selectedIdx >= 0) return selectedIdx;
    return list.findIndex((item) => !item.disabled);
  });

  protected select(tab: RecordTab): void {
    if (tab.disabled) return;
    this.active.set(tab.id);
  }

  protected onTabKeydown(event: KeyboardEvent, index: number): void {
    const list = this.tabs();
    const enabledIndices: number[] = [];
    for (let i = 0; i < list.length; i++) {
      if (!list[i].disabled) enabledIndices.push(i);
    }
    if (enabledIndices.length === 0) return;

    const rtl = this.isRtl();
    const nextKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const prevKey = rtl ? 'ArrowRight' : 'ArrowLeft';

    const currentPos = enabledIndices.indexOf(index);
    const startPos = currentPos >= 0 ? currentPos : 0;
    let targetPos: number | null = null;

    if (event.key === nextKey) {
      targetPos = (startPos + 1) % enabledIndices.length;
    } else if (event.key === prevKey) {
      targetPos = (startPos - 1 + enabledIndices.length) % enabledIndices.length;
    } else if (event.key === 'Home') {
      targetPos = 0;
    } else if (event.key === 'End') {
      targetPos = enabledIndices.length - 1;
    }

    if (targetPos === null) return;
    event.preventDefault();
    const targetIndex = enabledIndices[targetPos];
    const targetTab = list[targetIndex];
    if (!targetTab) return;
    this.tabButtons()[targetIndex]?.nativeElement.focus();
    this.active.set(targetTab.id);
  }

  private isRtl(): boolean {
    const element = this.host.nativeElement;
    const dirAttr = element.closest('[dir]')?.getAttribute('dir')?.toLowerCase();
    if (dirAttr === 'rtl' || dirAttr === 'ltr') {
      return dirAttr === 'rtl';
    }
    return getComputedStyle(element).direction === 'rtl';
  }
}
