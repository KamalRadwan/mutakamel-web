import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { NgIcon } from '@ng-icons/core';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'none' | 'tag' | 'brand' | 'count';

const TONES: Record<BadgeTone, string> = {
  success: 'px-8 bg-success text-on-success',
  warning: 'px-8 bg-warning text-on-warning',
  danger: 'px-8 bg-danger text-on-danger',
  none: 'px-8 bg-status-none text-text',
  tag: 'px-8 bg-neutral-soft text-on-neutral-soft',
  brand: 'px-8 bg-brand-soft text-on-brand-soft',
  count: 'min-w-badge px-6 bg-neutral-soft text-text tabular-nums',
};

@Component({
  selector: 'ui-badge',
  imports: [NgIcon, NgTemplateOutlet],
  host: {
    class:
      'inline-flex h-badge shrink-0 items-center justify-center gap-4 rounded-8 text-12 font-medium whitespace-nowrap',
    '[class]': 'toneClass()',
  },
  template: `
    <ng-template #content><ng-content /></ng-template>
    @if (icon(); as iconName) {
      <ng-icon [name]="iconName" size="12" class="shrink-0" aria-hidden="true" />
    }
    @if (tone() === 'count') {
      <bdi dir="ltr"><ng-container [ngTemplateOutlet]="content" /></bdi>
    } @else {
      <ng-container [ngTemplateOutlet]="content" />
    }
  `,
})
export class Badge {
  readonly tone = input<BadgeTone>('tag');
  readonly icon = input('');

  protected readonly toneClass = computed(() => TONES[this.tone()]);
}
