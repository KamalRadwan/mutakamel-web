import { Component, computed, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerPencil, tablerStar, tablerTrash } from '@ng-icons/tabler-icons';
import { tablerStarFill } from '@ng-icons/tabler-icons/fill';
import { normalizePhone } from '../../../../../../shared/ui/phone-input/phone';
import { PhoneActionSource, PhoneActions } from '../../../../../../shared/widgets/phone-actions/phone-actions';
import { ContactDraft } from '../../record-contact';

/** Compact read-only card for one contact person inside a record form. */
@Component({
  selector: 'app-record-contact-read',
  imports: [NgIcon, TranslocoPipe, PhoneActions],
  providers: [provideIcons({ tablerPencil, tablerStar, tablerStarFill, tablerTrash })],
  templateUrl: './contact-read.html',
  host: { class: 'block' },
})
export class ContactRead {
  readonly contact = input.required<ContactDraft>();
  readonly index = input.required<number>();
  readonly uid = input.required<string>();
  readonly readonly = input(false);
  readonly disabled = input(false);
  readonly canDelete = input(false);
  readonly radioTabStop = input(false);
  readonly crm = input(false);
  readonly source = input<PhoneActionSource | null>(null);

  readonly makePrimary = output<void>();
  readonly primaryKeydown = output<KeyboardEvent>();
  readonly edit = output<void>();
  readonly remove = output<void>();

  protected readonly fullName = computed(() => {
    const c = this.contact();
    return [c.honorificTitle.trim(), c.firstName.trim(), c.lastName.trim()].filter(Boolean).join(' ');
  });

  protected readonly jobTitle = computed(() => this.contact().jobTitle.trim());

  protected readonly validPhones = computed(() =>
    this.contact()
      .phones.map((p) => p.trim())
      .filter((p) => p.length > 0),
  );

  protected readonly primaryPhone = computed(() => {
    const first = this.validPhones()[0];
    return first ? normalizePhone(first) || first : '';
  });

  protected readonly extraPhoneCount = computed(() => Math.max(0, this.validPhones().length - 1));

  protected readonly allPhonesTitle = computed(() =>
    this.validPhones()
      .map((p) => normalizePhone(p) || p)
      .join(', '),
  );

  protected readonly email = computed(() => this.contact().email.trim());
}
