import { Component, ElementRef, computed, inject, input, model, viewChildren } from '@angular/core';
import { NgIcon } from '@ng-icons/core';

export interface TabItem {
  id: string;
  label: string;
  icon?: string;
  color?: string;
  count?: number | null;
  disabled?: boolean;
}

export function tabButtonId(tabId: string): string {
  return `ui-tab-${tabId}`;
}

export function tabPanelId(tabId: string): string {
  return `ui-tabpanel-${tabId}`;
}

@Component({
  selector: 'ui-tabs',
  imports: [NgIcon],
  templateUrl: './tabs.html',
  host: { class: 'block min-w-0' },
})
export class Tabs {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly tabButtons = viewChildren<ElementRef<HTMLButtonElement>>('tabBtn');

  readonly tabs = input.required<readonly TabItem[]>();
  readonly label = input('');
  readonly active = model<string>('');

  protected readonly tabButtonId = tabButtonId;
  protected readonly tabPanelId = tabPanelId;

  protected readonly focusableIndex = computed(() => {
    const items = this.tabs();
    const current = this.active();
    const selectedIndex = items.findIndex((item) => !item.disabled && item.id === current);
    if (selectedIndex !== -1) return selectedIndex;
    return items.findIndex((item) => !item.disabled);
  });

  protected select(tab: TabItem): void {
    if (tab.disabled) return;
    this.active.set(tab.id);
  }

  protected onKeydown(event: KeyboardEvent, index: number): void {
    const items = this.tabs();
    const enabledIndices = items.reduce<number[]>((acc, item, i) => {
      if (!item.disabled) acc.push(i);
      return acc;
    }, []);
    if (enabledIndices.length === 0) return;

    const rtl = this.isRtl();
    const nextKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const prevKey = rtl ? 'ArrowRight' : 'ArrowLeft';

    const currentPos = enabledIndices.indexOf(index);
    const startPos = currentPos !== -1 ? currentPos : 0;
    let targetPos = -1;

    if (event.key === nextKey) {
      targetPos = (startPos + 1) % enabledIndices.length;
    } else if (event.key === prevKey) {
      targetPos = (startPos - 1 + enabledIndices.length) % enabledIndices.length;
    } else if (event.key === 'Home') {
      targetPos = 0;
    } else if (event.key === 'End') {
      targetPos = enabledIndices.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const targetIndex = enabledIndices[targetPos];
    this.active.set(items[targetIndex].id);
    this.tabButtons()[targetIndex]?.nativeElement.focus();
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
