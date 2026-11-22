import { Component, input, model, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerPlus, tablerRefresh, tablerSearch, tablerX } from '@ng-icons/tabler-icons';

let nextFrameId = 0;

@Component({
  selector: 'app-settings-frame',
  imports: [NgIcon, TranslocoPipe],
  providers: [provideIcons({ tablerPlus, tablerRefresh, tablerSearch, tablerX })],
  templateUrl: './settings-frame.html',
  host: { class: 'flex min-h-0 flex-1 flex-col gap-8 p-12' },
})
export class SettingsFrame {
  protected readonly uid = `settings-frame-${++nextFrameId}`;

  readonly addLabel = input.required<string>();
  readonly addDisabled = input(false);
  readonly addHint = input<string | null>(null);
  readonly searchPlaceholder = input.required<string>();
  readonly loading = input(false);
  readonly showAdd = input(true);
  readonly search = model('');

  readonly add = output<void>();
  readonly reload = output<void>();

  protected onAddClick() {
    if (!this.addDisabled()) {
      this.add.emit();
    }
  }

  protected onSearchInput(event: Event) {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected clearSearch() {
    this.search.set('');
  }
}
