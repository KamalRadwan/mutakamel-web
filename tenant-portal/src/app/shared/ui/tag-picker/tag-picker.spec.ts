import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TRANSLOCO_LOADER, provideTransloco } from '@jsverse/transloco';
import { delay, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../features/crm/settings/shared/settings-api';
import { TagOption, TagPicker, tagCreateErrorKey } from './tag-picker';

const OPTIONS: TagOption[] = [
  { id: '1', name: 'Hot', backgroundColor: '#ff0000', textColor: '#ffffff' },
  { id: '2', name: 'Cold', backgroundColor: null, textColor: null },
  { id: '3', name: 'Warm', backgroundColor: null, textColor: null },
  { id: '4', name: 'مُتَابَعَة', backgroundColor: null, textColor: null },
];

@Component({
  imports: [TagPicker],
  template: `
    <div [attr.dir]="dir()">
      <ui-tag-picker
        label="Tags"
        inputId="tags-input"
        [options]="options()"
        [(value)]="value"
        [canCreate]="canCreate()"
        [createTag]="createTag()"
        [max]="max()"
        [disabled]="disabled()"
        [readonly]="readonly()"
        (created)="createdTags.push($event)"
      />
    </div>
  `,
})
class Host {
  readonly options = signal<TagOption[]>(OPTIONS);
  readonly value = signal<string[]>([]);
  readonly canCreate = signal(false);
  readonly createTag = signal<((name: string) => Promise<TagOption>) | null>(null);
  readonly max = signal(50);
  readonly disabled = signal(false);
  readonly readonly = signal(false);
  readonly dir = signal<'ltr' | 'rtl'>('ltr');
  readonly createdTags: TagOption[] = [];
}

async function setup(init?: (host: Host) => void) {
  // jsdom does not implement scrollIntoView.
  Element.prototype.scrollIntoView = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideTransloco({ config: { availableLangs: ['en'], defaultLang: 'en', prodMode: true } }),
      { provide: TRANSLOCO_LOADER, useValue: { getTranslation: () => of({}).pipe(delay(0)) } },
    ],
  });
  const fixture = TestBed.createComponent(Host);
  document.body.appendChild(fixture.nativeElement);
  init?.(fixture.componentInstance);
  fixture.detectChanges();
  await new Promise((resolve) => setTimeout(resolve, 20));
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const input = () => el.querySelector('input') as HTMLInputElement;
  const list = () => el.querySelector('[role="listbox"]') as HTMLElement | null;
  const options = () => Array.from(el.querySelectorAll('[role="option"]')) as HTMLElement[];
  const chips = () => Array.from(el.querySelectorAll('button[aria-label="tagPicker.remove"]')) as HTMLButtonElement[];
  const tick = async () => {
    fixture.detectChanges();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
  };
  const type = async (text: string) => {
    input().value = text;
    input().dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
  };
  const key = async (k: string) => {
    const event = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
    input().dispatchEvent(event);
    await tick();
    return event;
  };
  const open = async () => {
    (el.querySelector('input') as HTMLInputElement).closest('div')!.click();
    await tick();
  };
  return { fixture, host: fixture.componentInstance, el, input, list, options, chips, type, key, open, tick };
}

describe('TagPicker', () => {
  it('renders a combobox input named by the label', async () => {
    const { input } = await setup();
    expect(input().getAttribute('role')).toBe('combobox');
    expect(input().getAttribute('aria-label')).toBe('Tags');
    expect(input().id).toBe('tags-input');
    expect(input().getAttribute('aria-expanded')).toBe('false');
  });

  it('is closed initially', async () => {
    const { list } = await setup();
    expect(list()).toBeNull();
  });

  it('opens the listbox on field click and wires aria-controls', async () => {
    const { open, list, input } = await setup();
    await open();
    expect(list()).toBeTruthy();
    expect(input().getAttribute('aria-expanded')).toBe('true');
    expect(input().getAttribute('aria-controls')).toBe(list()!.id);
    expect(list()!.getAttribute('aria-multiselectable')).toBe('true');
  });

  it('lists every option when open and the query is empty', async () => {
    const { open, options } = await setup();
    await open();
    expect(options().length).toBe(4);
  });

  it('filters options case-insensitively by the typed text', async () => {
    const { type, options } = await setup();
    await type('HO');
    expect(options().map((o) => o.textContent?.trim())).toEqual(['Hot']);
  });

  it('matches Arabic text ignoring diacritics', async () => {
    const { type, options } = await setup();
    await type('متابعة');
    expect(options().length).toBe(1);
  });

  it('shows a no-matches row when nothing matches and creation is off', async () => {
    const { type, el } = await setup();
    await type('zzz');
    expect(el.textContent).toContain('tagPicker.noMatches');
  });

  it('selects an option on click and renders it as a chip', async () => {
    const { open, options, host, tick, el } = await setup();
    await open();
    options()[1].click();
    await tick();
    expect(host.value()).toEqual(['2']);
    expect(el.querySelector('.inline-flex.h-chip')?.textContent).toContain('Cold');
  });

  it('marks selected options with aria-selected', async () => {
    const { open, options } = await setup((h) => h.value.set(['1']));
    await open();
    expect(options().map((o) => o.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false', 'false']);
  });

  it('deselects a selected option when clicked again', async () => {
    const { open, options, host, tick } = await setup((h) => h.value.set(['1']));
    await open();
    options()[0].click();
    await tick();
    expect(host.value()).toEqual([]);
  });

  it('applies API-provided colours inline and the neutral style otherwise', async () => {
    const { chips, el } = await setup((h) => h.value.set(['1', '2']));
    expect(chips().length).toBe(2);
    const spans = Array.from(el.querySelectorAll('span.h-chip')) as HTMLElement[];
    expect(spans[0].style.backgroundColor).not.toBe('');
    expect(spans[1].className).toContain('bg-neutral-soft');
  });

  it('removes a tag through its remove button, which has an accessible name', async () => {
    const { chips, host, tick } = await setup((h) => h.value.set(['1', '2']));
    expect(chips()[0].getAttribute('aria-label')).toBe('tagPicker.remove');
    chips()[0].click();
    await tick();
    expect(host.value()).toEqual(['2']);
  });

  it('removes the last tag with Backspace on an empty input', async () => {
    const { key, host } = await setup((h) => h.value.set(['1', '2']));
    await key('Backspace');
    expect(host.value()).toEqual(['1']);
  });

  it('moves the active option with ArrowDown and exposes it via aria-activedescendant', async () => {
    const { open, key, input, options } = await setup();
    await open();
    await key('ArrowDown');
    expect(input().getAttribute('aria-activedescendant')).toBe(options()[1].id);
  });

  it('wraps ArrowUp from the first option to the last', async () => {
    const { open, key, input, options } = await setup();
    await open();
    await key('ArrowUp');
    expect(input().getAttribute('aria-activedescendant')).toBe(options()[3].id);
  });

  it('opens the list with ArrowDown when closed and prevents default', async () => {
    const { key, list } = await setup();
    const event = await key('ArrowDown');
    expect(event.defaultPrevented).toBe(true);
    expect(list()).toBeTruthy();
  });

  it('selects the active option with Enter', async () => {
    const { open, key, host } = await setup();
    await open();
    await key('ArrowDown');
    await key('Enter');
    expect(host.value()).toEqual(['2']);
  });

  it('closes with Escape and stops the event from reaching a parent modal', async () => {
    const { open, key, list } = await setup();
    await open();
    const event = await key('Escape');
    expect(list()).toBeNull();
    expect(event.defaultPrevented).toBe(true);
  });

  it('lets Escape through when the list is already closed', async () => {
    const { key } = await setup();
    const event = await key('Escape');
    expect(event.defaultPrevented).toBe(false);
  });

  it('closes on Tab', async () => {
    const { open, key, list } = await setup();
    await open();
    await key('Tab');
    expect(list()).toBeNull();
  });

  it('closes when clicking outside the component', async () => {
    const { open, list, tick } = await setup();
    await open();
    document.body.click();
    await tick();
    expect(list()).toBeNull();
  });

  it('does not open and ignores keys when disabled', async () => {
    const { open, key, list, input } = await setup((h) => h.disabled.set(true));
    await open();
    await key('ArrowDown');
    expect(list()).toBeNull();
    expect(input().disabled).toBe(true);
  });

  it('is read-only without remove buttons or a list', async () => {
    const { open, chips, list, input } = await setup((h) => {
      h.readonly.set(true);
      h.value.set(['1']);
    });
    await open();
    expect(chips().length).toBe(0);
    expect(list()).toBeNull();
    expect(input().readOnly).toBe(true);
  });

  it('shows a dash for an empty read-only value', async () => {
    const { input } = await setup((h) => h.readonly.set(true));
    expect(input().value).toBe('—');
  });

  it('offers a create row when allowed and no exact match exists', async () => {
    const { type, el } = await setup((h) => {
      h.canCreate.set(true);
      h.createTag.set(async (name) => ({ id: '9', name, backgroundColor: null, textColor: null }));
    });
    await type('Brand new');
    expect(el.textContent).toContain('tagPicker.create');
  });

  it('hides the create row on an exact (case-insensitive) match', async () => {
    const { type, el } = await setup((h) => {
      h.canCreate.set(true);
      h.createTag.set(async (name) => ({ id: '9', name, backgroundColor: null, textColor: null }));
    });
    await type('hot');
    expect(el.textContent).not.toContain('tagPicker.create');
  });

  it('creates a tag, selects it and emits created', async () => {
    const create = vi.fn(async (name: string) => ({ id: '9', name, backgroundColor: null, textColor: null }));
    const { type, options, host, tick } = await setup((h) => {
      h.canCreate.set(true);
      h.createTag.set(create);
    });
    await type('Brand new');
    options()[options().length - 1].click();
    await tick();
    await tick();
    expect(create).toHaveBeenCalledWith('Brand new');
    expect(host.value()).toEqual(['9']);
    expect(host.createdTags.map((t) => t.id)).toEqual(['9']);
  });

  it('shows the taken error with role alert and links it via aria-describedby when creation fails', async () => {
    const { type, options, tick, el, input } = await setup((h) => {
      h.canCreate.set(true);
      h.createTag.set(async () => {
        throw new ApiError(409, 'CRM_TAG_NAME_TAKEN');
      });
    });
    await type('Brand new');
    options()[options().length - 1].click();
    await tick();
    await tick();
    const alert = el.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.textContent).toContain('tagPicker.errors.taken');
    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(input().getAttribute('aria-describedby')).toBe(alert.id);
  });

  it('maps 400 CRM_VALIDATION_FAILED {name} to the name message when creation fails', async () => {
    const { type, options, tick, el } = await setup((h) => {
      h.canCreate.set(true);
      h.createTag.set(async () => {
        throw new ApiError(400, 'CRM_VALIDATION_FAILED', { name: ['max_length'] });
      });
    });
    await type('Brand new');
    options()[options().length - 1].click();
    await tick();
    await tick();
    expect(el.textContent).toContain('tagPicker.errors.nameInvalid');
  });

  it('maps tag creation errors: colour keys, name, legacy codes and other validation', () => {
    expect(tagCreateErrorKey(new ApiError(400, 'CRM_VALIDATION_FAILED', { backgroundColor: ['matches'] }))).toBe(
      'tagPicker.errors.colorInvalid',
    );
    expect(tagCreateErrorKey(new ApiError(400, 'CRM_VALIDATION_FAILED', { textColor: ['matches'], name: ['x'] }))).toBe(
      'tagPicker.errors.colorInvalid',
    );
    expect(tagCreateErrorKey(new ApiError(400, 'CRM_VALIDATION_FAILED', { name: ['is_not_empty'] }))).toBe(
      'tagPicker.errors.nameInvalid',
    );
    expect(tagCreateErrorKey(new ApiError(400, 'CRM_VALIDATION_FAILED', { other: ['x'] }))).toBe('tagPicker.errors.failed');
    expect(tagCreateErrorKey(new ApiError(400, 'CRM_TAG_NAME_INVALID'))).toBe('tagPicker.errors.failed');
    expect(tagCreateErrorKey(new ApiError(422, 'CRM_TAG_LIMIT_EXCEEDED'))).toBe('tagPicker.errors.limit');
  });

  it('maps an unknown creation failure to the generic failed message', async () => {
    const { type, options, tick, el } = await setup((h) => {
      h.canCreate.set(true);
      h.createTag.set(async () => {
        throw new Error('boom');
      });
    });
    await type('Brand new');
    options()[options().length - 1].click();
    await tick();
    await tick();
    expect(el.textContent).toContain('tagPicker.errors.failed');
  });

  it('disables the create row when the name is longer than 60 characters', async () => {
    const { type, options } = await setup((h) => {
      h.canCreate.set(true);
      h.createTag.set(async (name) => ({ id: '9', name, backgroundColor: null, textColor: null }));
    });
    await type('x'.repeat(61));
    const row = options()[options().length - 1];
    expect(row.getAttribute('aria-disabled')).toBe('true');
  });

  it('does not open the list once the max is reached', async () => {
    const { open, options, host, tick } = await setup((h) => {
      h.max.set(1);
      h.value.set(['1']);
    });
    expect(host.value()).toEqual(['1']);
    await open();
    expect(options().length).toBe(0);
    await tick();
  });

  it('explains the limit with a title and makes the input read-only at the max', async () => {
    const { input } = await setup((h) => {
      h.max.set(1);
      h.value.set(['1']);
    });
    expect(input().readOnly).toBe(true);
    expect(input().title).toBe('tagPicker.maxReached');
    expect(input().getAttribute('aria-disabled')).toBe('true');
  });

  it('positions the list with a logical inline-start inset so it follows rtl', async () => {
    const { open, list } = await setup((h) => h.dir.set('rtl'));
    await open();
    expect(list()!.style.getPropertyValue('inset-inline-start')).not.toBe('');
  });
});
