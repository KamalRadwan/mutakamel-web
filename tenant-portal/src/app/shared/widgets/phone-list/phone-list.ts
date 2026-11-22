import { Component, computed, input, model } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCircleX, tablerPlus, tablerTrash } from '@ng-icons/tabler-icons';
import { GeoCountry } from '../../../core/geo/geo.model';
import { Button } from '../../ui/button/button';
import { Field } from '../../ui/field/field';
import { normalizePhone, phoneDigits, toAsciiDigits } from '../../ui/phone-input/phone';
import { PhoneInput } from '../../ui/phone-input/phone-input';
import { PhoneActionSource, PhoneActions } from '../phone-actions/phone-actions';

/** Vertical list of phone inputs (or read-only LTR numbers) paired with call/WhatsApp/Telegram actions. */
@Component({
  selector: 'app-phone-list',
  imports: [NgIcon, Button, Field, PhoneInput, PhoneActions],
  providers: [provideIcons({ tablerTrash, tablerPlus, tablerCircleX })],
  templateUrl: './phone-list.html',
  host: { class: 'block min-w-0' },
})
export class PhoneList {
  readonly phones = model.required<string[]>();
  readonly countries = input.required<GeoCountry[]>();
  readonly max = input(10);
  readonly maxLength = input(32);
  readonly readonly = input(false);
  readonly display = input<'edit' | 'read'>('edit');
  readonly label = input.required<string>();
  readonly hint = input.required<string>();
  readonly addLabel = input.required<string>();
  readonly idPrefix = input.required<string>();
  readonly errors = input<Record<number, string>>({});
  readonly removeLabel = input.required<string>();
  readonly crm = input(false);
  readonly source = input<PhoneActionSource | null>(null);

  protected readonly rows = computed(() => {
    const list = this.phones();
    return list.length > 0 ? list : [''];
  });

  protected readonly readPhones = computed(() =>
    this.phones()
      .map((p) => p.trim())
      .filter((p) => p.length > 0),
  );

  protected readonly canAdd = computed(() => !this.readonly() && this.rows().length < this.max());

  protected rowId(index: number): string {
    return `${this.idPrefix()}-${index}`;
  }

  protected rowDescribedBy(index: number): string {
    const ids: string[] = [];
    if (this.hint().trim()) ids.push(`${this.idPrefix()}-0-hint`);
    if (this.rowError(index)) ids.push(`${this.rowId(index)}-error`);
    return ids.join(' ');
  }

  protected rowError(index: number): string | null {
    return this.errors()[index] ?? null;
  }

  protected rowLabel(index: number): string {
    return index === 0 ? this.label() : `${this.label()} ${index + 1}`;
  }

  protected removeLabelFor(index: number): string {
    const template = this.removeLabel();
    const num = String(index + 1);
    return template.includes('{{n}}') ? template.replaceAll('{{n}}', num) : `${template} ${num}`;
  }

  protected actionPhone(raw: string): string {
    return normalizePhone(raw);
  }

  protected displayPhone(raw: string): string {
    return normalizePhone(raw) || raw.trim();
  }

  protected isPhoneValid(index: number, raw: string): boolean {
    if (this.rowError(index)) return false;
    const trimmed = (raw ?? '').trim();
    if (!trimmed || trimmed.length > this.maxLength()) return false;
    if (!/^[+\d\s().-]+$/.test(toAsciiDigits(trimmed))) return false;
    return phoneDigits(trimmed) >= 5;
  }

  protected setPhone(index: number, value: string): void {
    if (this.readonly()) return;
    const next = [...this.rows()];
    next[index] = value;
    this.phones.set(next);
  }

  protected addPhone(): void {
    if (!this.canAdd()) return;
    this.phones.set([...this.rows(), '']);
  }

  protected removePhone(index: number): void {
    if (this.readonly()) return;
    const list = this.rows();
    if (list.length <= 1) return;
    this.phones.set(list.filter((_, i) => i !== index));
  }
}
