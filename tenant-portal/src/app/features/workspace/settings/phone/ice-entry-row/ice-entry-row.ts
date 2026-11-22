import { Component, computed, inject, input, output, signal } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCircleX, tablerEye, tablerEyeOff, tablerLock, tablerTrash } from '@ng-icons/tabler-icons';
import { Button } from '../../../../../shared/ui/button/button';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { IceEntryDraft, IceEntryValidationErrors, IceKind } from '../phone-servers.model';

@Component({
  selector: 'app-ice-entry-row',
  imports: [NgIcon, TranslocoPipe, Button, Dropdown, Field, Switch],
  providers: [provideIcons({ tablerTrash, tablerLock, tablerEye, tablerEyeOff, tablerCircleX })],
  templateUrl: './ice-entry-row.html',
  host: { class: 'block' },
})
export class IceEntryRow {
  private static nextId = 0;
  protected readonly uid = `ice-entry-${++IceEntryRow.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  readonly entry = input.required<IceEntryDraft>();
  readonly index = input.required<number>();
  readonly readonly = input(false);
  readonly disabled = input(false);
  readonly errors = input<IceEntryValidationErrors | null>(null);

  readonly entryChange = output<IceEntryDraft>();
  readonly removed = output<void>();
  readonly fieldTouched = output<void>();

  protected readonly revealed = signal(false);

  protected readonly kindOptions = computed<DropdownOption<IceKind>[]>(() => {
    this.i18n();
    return [
      { value: 'STUN', label: this.transloco.translate('wsPhone.modal.ice.stun') },
      { value: 'TURN', label: this.transloco.translate('wsPhone.modal.ice.turn') },
    ];
  });

  protected readonly selectedKindLabel = computed(() => {
    this.i18n();
    const key = this.entry().kind === 'TURN' ? 'wsPhone.modal.ice.turn' : 'wsPhone.modal.ice.stun';
    return this.transloco.translate(key);
  });

  protected readonly credentialDescribedBy = computed(() => {
    const parts = [`${this.uid}-credential-hint`];
    if (this.errors()?.credential) {
      parts.push(`${this.uid}-credential-error`);
    }
    return parts.join(' ');
  });

  protected readonly hiddenFieldLineError = computed(() => {
    const err = this.errors();
    if (!err) return null;
    if (err.entry) return err.entry;
    if (this.entry().kind === 'STUN') {
      return err.username || err.credential || null;
    }
    return null;
  });

  protected onKindChange(kind: IceKind): void {
    if (this.readonly() || this.disabled()) return;
    const current = this.entry();
    if (current.kind === kind) return;
    if (kind === 'STUN') {
      this.revealed.set(false);
      this.entryChange.emit({
        ...current,
        kind: 'STUN',
        username: '',
        credentialConfigured: false,
        credentialAction: 'keep',
        credentialValue: '',
      });
    } else {
      this.entryChange.emit({
        ...current,
        kind: 'TURN',
      });
    }
    this.fieldTouched.emit();
  }

  protected onEnabledChange(enabled: boolean): void {
    if (this.readonly() || this.disabled()) return;
    this.entryChange.emit({ ...this.entry(), enabled });
    this.fieldTouched.emit();
  }

  protected onUrlsInput(event: Event): void {
    const urlsText = (event.target as HTMLTextAreaElement).value;
    this.entryChange.emit({ ...this.entry(), urlsText });
  }

  protected onUsernameInput(event: Event): void {
    const username = (event.target as HTMLInputElement).value;
    this.entryChange.emit({ ...this.entry(), username });
  }

  protected startChangeCredential(): void {
    if (this.readonly() || this.disabled()) return;
    this.revealed.set(false);
    this.entryChange.emit({
      ...this.entry(),
      credentialAction: 'set',
      credentialValue: '',
    });
  }

  protected clearCredential(): void {
    if (this.readonly() || this.disabled()) return;
    this.revealed.set(false);
    this.entryChange.emit({
      ...this.entry(),
      credentialAction: 'clear',
      credentialValue: '',
    });
    this.fieldTouched.emit();
  }

  protected keepCurrentCredential(): void {
    if (this.readonly() || this.disabled()) return;
    this.revealed.set(false);
    this.entryChange.emit({
      ...this.entry(),
      credentialAction: 'keep',
      credentialValue: '',
    });
  }

  protected onCredentialInput(event: Event): void {
    const credentialValue = (event.target as HTMLInputElement).value;
    const current = this.entry();
    this.entryChange.emit({
      ...current,
      credentialAction: current.credentialConfigured
        ? credentialValue.trim() ? 'set' : 'keep'
        : 'set',
      credentialValue,
    });
  }

  protected toggleReveal(): void {
    this.revealed.update((v) => !v);
  }

  protected markTouched(): void {
    this.fieldTouched.emit();
  }
}
