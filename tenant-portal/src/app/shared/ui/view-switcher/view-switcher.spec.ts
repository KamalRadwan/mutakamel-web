import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideIcons } from '@ng-icons/core';
import { tablerLayoutGrid, tablerList } from '@ng-icons/tabler-icons';
import { describe, expect, it } from 'vitest';
import { ViewOption, ViewSwitcher } from './view-switcher';

const OPTIONS: ViewOption[] = [
  { id: 'list', icon: 'tablerList', label: 'List view' },
  { id: 'grid', icon: 'tablerLayoutGrid', label: 'Grid view' },
];

@Component({
  imports: [ViewSwitcher],
  providers: [provideIcons({ tablerList, tablerLayoutGrid })],
  template: `<ui-view-switcher [options]="options" label="View" [(value)]="value" />`,
})
class Host {
  readonly options = OPTIONS;
  readonly value = signal('list');
}

function setup() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const buttons = () => Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
  return { fixture, host: fixture.componentInstance, buttons };
}

describe('ViewSwitcher', () => {
  it('renders the host as a labelled radiogroup', () => {
    const { fixture } = setup();
    const el = fixture.nativeElement.querySelector('ui-view-switcher') as HTMLElement;
    expect(el.getAttribute('role')).toBe('radiogroup');
    expect(el.getAttribute('aria-label')).toBe('View');
  });

  it('renders one radio button per option', () => {
    const { buttons } = setup();
    expect(buttons().length).toBe(2);
    expect(buttons().every((b) => b.getAttribute('role') === 'radio')).toBe(true);
  });

  it('gives icon-only buttons an accessible name and a title from the option label', () => {
    const { buttons } = setup();
    expect(buttons().map((b) => b.getAttribute('aria-label'))).toEqual(['List view', 'Grid view']);
    expect(buttons().map((b) => b.title)).toEqual(['List view', 'Grid view']);
  });

  it('hides the decorative icons from assistive tech', () => {
    const { fixture } = setup();
    const icons = Array.from(fixture.nativeElement.querySelectorAll('ng-icon')) as HTMLElement[];
    expect(icons.every((i) => i.getAttribute('aria-hidden') === 'true')).toBe(true);
  });

  it('marks only the active option as aria-checked', () => {
    const { buttons } = setup();
    expect(buttons().map((b) => b.getAttribute('aria-checked'))).toEqual(['true', 'false']);
  });

  it('switches the value when another option is clicked', () => {
    const { fixture, host, buttons } = setup();
    buttons()[1].click();
    fixture.detectChanges();
    expect(host.value()).toBe('grid');
    expect(buttons().map((b) => b.getAttribute('aria-checked'))).toEqual(['false', 'true']);
  });

  it('reflects an externally changed value', () => {
    const { fixture, host, buttons } = setup();
    host.value.set('grid');
    fixture.detectChanges();
    expect(buttons()[1].getAttribute('aria-checked')).toBe('true');
  });
});
