import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ActionItem, ActionSelection, ActionsMenu } from './actions-menu';

const ITEMS: ActionItem[] = [
  { id: 'edit', title: 'Edit', icon: 'tablerEdit', tile: 'bg-icon-blue' },
  {
    id: 'stage',
    title: 'Change stage',
    icon: 'tablerArrowRight',
    tile: 'bg-icon-teal',
    choices: [
      { id: 'a', label: 'Stage A', selected: true },
      { id: 'b', label: 'Stage B' },
    ],
  },
  {
    id: 'color',
    title: 'Colour',
    icon: 'tablerPalette',
    tile: 'bg-icon-violet',
    swatches: [
      { id: 'red', label: 'Red', color: 'bg-icon-red' },
      { id: 'blue', label: 'Blue', color: 'bg-icon-blue', selected: true },
      { id: null, label: 'Clear colour', color: null },
    ],
  },
  { id: 'lock', title: 'Lock', icon: 'tablerLock', tile: 'bg-icon-gray', disabled: true, reason: 'Not allowed' },
  { id: 'delete', title: 'Delete', icon: 'tablerTrash', tile: 'bg-icon-red', danger: true },
];

@Component({
  imports: [ActionsMenu],
  template: `<div [attr.dir]="dir()"><ui-actions-menu [items]="items()" label="Row actions" noColorLabel="No colour" (selected)="picked.push($event)" /></div>`,
})
class Host {
  readonly items = signal<ActionItem[]>(ITEMS);
  readonly dir = signal<'ltr' | 'rtl'>('ltr');
  readonly picked: ActionSelection[] = [];
}

function setup() {
  const fixture = TestBed.createComponent(Host);
  document.body.appendChild(fixture.nativeElement);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const trigger = () => el.querySelector('button[aria-haspopup="menu"]') as HTMLButtonElement;
  const menu = () => el.querySelector('[role="menu"]') as HTMLElement | null;
  const rows = () => Array.from(el.querySelectorAll('[role="menu"] > div > button[role="menuitem"]')) as HTMLButtonElement[];
  const submenu = () => el.querySelector('[role="menu"] [role="menu"]') as HTMLElement | null;
  const tick = async () => {
    fixture.detectChanges();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
  };
  const key = async (target: Element, k: string) => {
    const event = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    await tick();
    return event;
  };
  const open = async () => {
    trigger().click();
    await tick();
  };
  return { fixture, host: fixture.componentInstance, el, trigger, menu, rows, submenu, tick, key, open };
}

describe('ActionsMenu', () => {
  it('renders a trigger button with an accessible name, title and menu popup', () => {
    const { trigger } = setup();
    expect(trigger().getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger().getAttribute('aria-label')).toBe('Row actions');
    expect(trigger().title).toBe('Row actions');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('is closed initially', () => {
    const { menu } = setup();
    expect(menu()).toBeNull();
  });

  it('opens a labelled menu on click and updates aria-expanded', async () => {
    const { open, menu, trigger } = setup();
    await open();
    expect(menu()?.getAttribute('aria-label')).toBe('Row actions');
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
  });

  it('renders one menuitem per action in order', async () => {
    const s = setup();
    await s.open();
    expect(s.rows().map((r) => r.textContent?.trim())).toEqual(['Edit', 'Change stage', 'Colour', 'Lock', 'Delete']);
  });

  it('places a separator before the danger action', async () => {
    const s = setup();
    await s.open();
    const separators = s.el.querySelectorAll('[role="separator"]');
    expect(separators.length).toBe(1);
    expect(separators[0].nextElementSibling?.textContent).toContain('Delete');
  });

  it('focuses the first enabled item once the menu is placed', async () => {
    const s = setup();
    await s.open();
    expect(document.activeElement).toBe(s.rows()[0]);
  });

  it('closes when the trigger is clicked again', async () => {
    const s = setup();
    await s.open();
    await s.open();
    expect(s.menu()).toBeNull();
  });

  it('marks disabled items with aria-disabled and links the reason via aria-describedby', async () => {
    const s = setup();
    await s.open();
    const row = s.rows()[3];
    expect(row.getAttribute('aria-disabled')).toBe('true');
    expect(row.disabled).toBe(false);
    const describedBy = row.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(row.parentElement?.querySelector(`[id="${describedBy}"]`)?.textContent?.trim()).toBe('Not allowed');
  });

  it('does not emit for a disabled item', async () => {
    const s = setup();
    await s.open();
    s.rows()[3].click();
    await s.tick();
    expect(s.host.picked).toEqual([]);
    expect(s.menu()).toBeTruthy();
  });

  it('emits the id and closes when a plain item is clicked', async () => {
    const s = setup();
    await s.open();
    s.rows()[0].click();
    await s.tick();
    expect(s.host.picked).toEqual([{ id: 'edit' }]);
    expect(s.menu()).toBeNull();
  });

  it('moves focus down and up through items with wrap-around', async () => {
    const s = setup();
    await s.open();
    await s.key(s.rows()[0], 'ArrowDown');
    expect(document.activeElement).toBe(s.rows()[1]);
    await s.key(s.rows()[1], 'ArrowUp');
    await s.key(s.rows()[0], 'ArrowUp');
    expect(document.activeElement).toBe(s.rows()[4]);
  });

  it('activates the focused item with Enter and returns focus to the trigger', async () => {
    const s = setup();
    await s.open();
    await s.key(s.rows()[0], 'Enter');
    expect(s.host.picked).toEqual([{ id: 'edit' }]);
    expect(document.activeElement).toBe(s.trigger());
  });

  it('activates the focused item with Space', async () => {
    const s = setup();
    await s.open();
    const event = await s.key(s.rows()[0], ' ');
    expect(event.defaultPrevented).toBe(true);
    expect(s.host.picked).toEqual([{ id: 'edit' }]);
  });

  it('closes on Escape, returns focus to the trigger and stops propagation', async () => {
    const s = setup();
    await s.open();
    const event = await s.key(s.rows()[0], 'Escape');
    expect(s.menu()).toBeNull();
    expect(document.activeElement).toBe(s.trigger());
    expect(event.defaultPrevented).toBe(true);
  });

  it('closes when clicking outside', async () => {
    const s = setup();
    await s.open();
    document.body.click();
    await s.tick();
    expect(s.menu()).toBeNull();
  });

  it('closes when any ancestor scrolls', async () => {
    const s = setup();
    await s.open();
    document.dispatchEvent(new Event('scroll'));
    await s.tick();
    expect(s.menu()).toBeNull();
  });

  it('flags items with choices or swatches as submenu parents', async () => {
    const s = setup();
    await s.open();
    expect(s.rows()[1].getAttribute('aria-haspopup')).toBe('menu');
    expect(s.rows()[1].getAttribute('aria-expanded')).toBe('false');
    expect(s.rows()[0].hasAttribute('aria-haspopup')).toBe(false);
  });

  it('does not treat a disabled item as a submenu parent', async () => {
    const s = setup();
    s.host.items.set([{ ...ITEMS[1], disabled: true }]);
    await s.open();
    expect(s.rows()[0].hasAttribute('aria-haspopup')).toBe(false);
  });

  it('opens the submenu on click and moves focus to its first enabled choice', async () => {
    const s = setup();
    await s.open();
    s.rows()[1].click();
    await s.tick();
    expect(s.submenu()?.getAttribute('aria-label')).toBe('Change stage');
    expect(s.rows()[1].getAttribute('aria-expanded')).toBe('true');
    const choices = Array.from(s.submenu()!.querySelectorAll('button')) as HTMLButtonElement[];
    expect(document.activeElement).toBe(choices[1]);
  });

  it('opens the submenu on pointer enter of the row', async () => {
    const s = setup();
    await s.open();
    s.rows()[1].parentElement!.dispatchEvent(new MouseEvent('mouseenter'));
    await s.tick();
    expect(s.submenu()).toBeTruthy();
  });

  it('closes the submenu when the pointer enters a row without a submenu', async () => {
    const s = setup();
    await s.open();
    s.rows()[1].parentElement!.dispatchEvent(new MouseEvent('mouseenter'));
    await s.tick();
    s.rows()[0].parentElement!.dispatchEvent(new MouseEvent('mouseenter'));
    await s.tick();
    expect(s.submenu()).toBeNull();
  });

  it('disables the already selected choice', async () => {
    const s = setup();
    await s.open();
    s.rows()[1].click();
    await s.tick();
    const choices = Array.from(s.submenu()!.querySelectorAll('button')) as HTMLButtonElement[];
    expect(choices[0].disabled).toBe(true);
    expect(choices[1].disabled).toBe(false);
  });

  it('emits id and value when a choice is picked', async () => {
    const s = setup();
    await s.open();
    s.rows()[1].click();
    await s.tick();
    (Array.from(s.submenu()!.querySelectorAll('button'))[1] as HTMLButtonElement).click();
    await s.tick();
    expect(s.host.picked).toEqual([{ id: 'stage', value: 'b' }]);
    expect(s.menu()).toBeNull();
  });

  it('collapses only the submenu on Escape, keeping the menu open and focusing the parent row', async () => {
    const s = setup();
    await s.open();
    s.rows()[1].click();
    await s.tick();
    const choice = s.submenu()!.querySelectorAll('button')[1];
    await s.key(choice, 'Escape');
    expect(s.submenu()).toBeNull();
    expect(s.menu()).toBeTruthy();
    expect(document.activeElement).toBe(s.rows()[1]);
  });

  it('moves between submenu items with ArrowDown and picks with Enter, restoring focus to the trigger', async () => {
    const s = setup();
    await s.open();
    s.rows()[1].click();
    await s.tick();
    const choices = () => Array.from(s.submenu()!.querySelectorAll('button')) as HTMLButtonElement[];
    await s.key(choices()[1], 'ArrowDown');
    expect(document.activeElement).toBe(choices()[1]);
    await s.key(choices()[1], 'Enter');
    expect(s.host.picked).toEqual([{ id: 'stage', value: 'b' }]);
    expect(document.activeElement).toBe(s.trigger());
  });

  it('renders colour swatches with accessible names and marks the selected one', async () => {
    const s = setup();
    await s.open();
    s.rows()[2].click();
    await s.tick();
    const swatches = Array.from(s.submenu()!.querySelectorAll('button[aria-label]')) as HTMLButtonElement[];
    expect(swatches.map((b) => b.getAttribute('aria-label'))).toEqual(['Red', 'Blue']);
    expect(swatches[1].className).toContain('ring-2');
  });

  it('emits a null value for the no-colour row and uses the swatch label for it', async () => {
    const s = setup();
    await s.open();
    s.rows()[2].click();
    await s.tick();
    const buttons = Array.from(s.submenu()!.querySelectorAll('button')) as HTMLButtonElement[];
    const noColor = buttons[buttons.length - 1];
    expect(noColor.textContent).toContain('Clear colour');
    noColor.click();
    await s.tick();
    expect(s.host.picked).toEqual([{ id: 'color', value: null }]);
  });

  it('opens the submenu toward the inline start and flips the arrow with rtl via a logical class', async () => {
    const s = setup();
    await s.open();
    const chevron = s.rows()[1].querySelector('span.rtl\\:-scale-x-100');
    expect(chevron).toBeTruthy();
    s.rows()[1].click();
    await s.tick();
    expect(s.submenu()?.className).toMatch(/end-full|start-full/);
  });

  it('positions the panel using a logical inline-end inset', async () => {
    const s = setup();
    s.host.dir.set('rtl');
    await s.open();
    expect(s.menu()!.style.getPropertyValue('inset-inline-end')).not.toBe('');
  });
});
