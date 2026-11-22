import { Component, input, output, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerUpload } from '@ng-icons/tabler-icons';
import { Button } from '../button/button';

@Component({
  selector: 'ui-file-drop',
  imports: [NgIcon, TranslocoPipe, Button],
  providers: [provideIcons({ tablerUpload })],
  templateUrl: './file-drop.html',
  host: { class: 'block' },
})
export class FileDrop {
  readonly accept = input('');
  readonly maxBytes = input(0);
  readonly title = input('');
  readonly hint = input('');
  readonly disabled = input(false);
  readonly browseLabel = input('');
  readonly id = input<string | null>(null);
  readonly describedBy = input<string | null>(null);

  readonly picked = output<File>();
  readonly rejected = output<'type' | 'size'>();

  protected readonly dragging = signal(false);

  protected onDragOver(event: DragEvent) {
    event.preventDefault();
    if (this.disabled()) {
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'none';
      }
      return;
    }
    this.dragging.set(true);
  }

  protected onDragLeave(event: DragEvent) {
    event.preventDefault();
    if ((event.currentTarget as Node | null)?.contains(event.relatedTarget as Node | null)) return;
    this.dragging.set(false);
  }

  protected onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragging.set(false);
    if (this.disabled()) return;
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.handleFile(file);
    }
  }

  protected onFileSelected(event: Event) {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    inputEl.value = '';
    if (file && !this.disabled()) {
      this.handleFile(file);
    }
  }

  private handleFile(file: File) {
    if (!this.matchesAccept(file, this.accept())) {
      this.rejected.emit('type');
      return;
    }
    const max = this.maxBytes();
    if (max > 0 && file.size > max) {
      this.rejected.emit('size');
      return;
    }
    this.picked.emit(file);
  }

  /** Requires both any extension tokens and any MIME tokens in `accept` to match (AND semantics); mixed shorthand like `image/*,.ico` would reject `.png`. */
  private matchesAccept(file: File, accept: string): boolean {
    const raw = accept.trim();
    if (!raw) return true;
    const tokens = raw
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    if (!tokens.length) return true;
    const name = file.name.toLowerCase();
    const type = file.type.toLowerCase();
    const exts = tokens.filter((t) => t.startsWith('.'));
    const mimes = tokens.filter((t) => !t.startsWith('.'));
    const extOk = !exts.length || exts.some((e) => name.endsWith(e));
    const mimeOk =
      !mimes.length ||
      (type === '' ? exts.length > 0 : mimes.some((m) => (m.endsWith('/*') ? type.startsWith(m.slice(0, -1)) : type === m)));
    return extOk && mimeOk;
  }
}
