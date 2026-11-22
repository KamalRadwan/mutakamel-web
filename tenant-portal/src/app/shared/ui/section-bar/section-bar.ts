import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, model } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerChevronDown } from '@ng-icons/tabler-icons';

export type SectionBarTone = 'gradient' | 'navy' | 'blue' | 'violet' | 'orange';

const TONE_CLASSES: Record<SectionBarTone, string> = {
  gradient: 'bg-nav-gradient',
  navy: 'bg-icon-navy',
  blue: 'bg-icon-blue',
  violet: 'bg-icon-violet',
  // orange only where the dark-mode-safe value is approved
  orange: 'bg-icon-orange',
};

@Component({
  selector: 'ui-section-bar',
  imports: [NgTemplateOutlet, NgIcon],
  providers: [provideIcons({ tablerChevronDown })],
  templateUrl: './section-bar.html',
  host: { class: 'contents' },
})
export class SectionBar {
  readonly tone = input.required<SectionBarTone>();
  readonly icon = input.required<string>();
  readonly title = input.required<string>();
  readonly headingLevel = input<2 | 3>(2);
  readonly expandable = input(false);
  readonly expanded = model(false);
  readonly controls = input<string | null>(null);

  protected readonly toneClass = computed(() => TONE_CLASSES[this.tone()]);

  protected toggle(): void {
    this.expanded.update((open) => !open);
  }
}
