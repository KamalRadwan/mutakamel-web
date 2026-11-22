import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerCheck,
  tablerCircleX,
  tablerPencil,
  tablerPlus,
  tablerStar,
  tablerTrash,
  tablerX,
} from '@ng-icons/tabler-icons';
import { tablerStarFill } from '@ng-icons/tabler-icons/fill';
import { GeoCountry } from '../../../../../core/geo/geo.model';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { normalizePhone, phoneDigits, toAsciiDigits } from '../../../../../shared/ui/phone-input/phone';
import { RECORD_PAGE_GRID, RecordLayout } from '../../../../../shared/ui/record-layout/record-layout';
import { SuggestInput } from '../../../../../shared/ui/suggest-input/suggest-input';
import {
  JOB_TITLE_SUGGESTIONS,
  TITLE_SUGGESTIONS,
  suggestionsForLanguage,
} from '../../../../../shared/ui/suggest-input/suggestions';
import { UnsavedDialog } from '../../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import { PhoneActionSource } from '../../../../../shared/widgets/phone-actions/phone-actions';
import { PhoneList } from '../../../../../shared/widgets/phone-list/phone-list';
import {
  CompanyContactOption,
  ContactChange,
  ContactDraft,
  ContactErrors,
  ContactLimits,
  newContact,
} from '../record-contact';
import { ContactRead } from './contact-read/contact-read';

interface ContactEditState {
  key: string;
  isNew: boolean;
  snapshot: ContactDraft;
  draft: ContactDraft;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_CHARS_RE = /^[+\d\s().-]+$/;

function cloneContact(contact: ContactDraft): ContactDraft {
  return { ...contact, phones: [...contact.phones] };
}

function cleanPhoneValues(phones: readonly string[]): string[] {
  return phones.map((p) => p.trim()).filter((p) => p.length > 0);
}

function contactDraftEqual(a: ContactDraft, b: ContactDraft): boolean {
  if (
    a.contactPartyId !== b.contactPartyId ||
    a.isPrimary !== b.isPrimary ||
    a.honorificTitle.trim() !== b.honorificTitle.trim() ||
    a.firstName.trim() !== b.firstName.trim() ||
    a.lastName.trim() !== b.lastName.trim() ||
    a.jobTitle.trim() !== b.jobTitle.trim() ||
    a.email.trim() !== b.email.trim()
  ) {
    return false;
  }
  const pa = cleanPhoneValues(a.phones);
  const pb = cleanPhoneValues(b.phones);
  return pa.length === pb.length && pa.every((val, i) => val === pb[i]);
}

/** Shared record contacts section supporting create form cards, view cards, and per-card inline editing. */
@Component({
  selector: 'app-record-contacts',
  imports: [
    NgIcon,
    TranslocoPipe,
    Button,
    ConfirmDialog,
    Dropdown,
    Field,
    SuggestInput,
    UnsavedDialog,
    PhoneList,
    ContactRead,
  ],
  providers: [
    provideTranslocoScope({ scope: 'record-form', alias: 'recordForm' }),
    provideIcons({
      tablerCheck,
      tablerPencil,
      tablerStar,
      tablerStarFill,
      tablerTrash,
      tablerPlus,
      tablerCircleX,
      tablerX,
    }),
  ],
  templateUrl: './record-contacts.html',
  host: { class: 'block' },
})
export class RecordContacts {
  private static nextId = 0;
  protected readonly uid = `record-contacts-${++RecordContacts.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  private readonly unsavedDialog = viewChild.required<UnsavedDialog>('unsavedDialog');
  private readonly deleteDialogWrap = viewChild<ElementRef<HTMLElement>>('deleteDialogWrap');
  private readonly deleteDialog = viewChild.required<ConfirmDialog>('deleteDialog');

  readonly contacts = model.required<ContactDraft[]>();
  readonly mode = input.required<'create' | 'edit' | 'view'>();
  readonly layout = input.required<RecordLayout>();
  readonly countries = input<GeoCountry[]>([]);
  readonly limits = input.required<ContactLimits>();
  readonly errors = input<ContactErrors>({});
  readonly readonly = input(false);
  readonly max = input(20);
  readonly saveContact = input<((change: ContactChange) => Promise<ContactErrors | null>) | null>(null);
  readonly loadCompanyContacts = input<((query: string) => Promise<CompanyContactOption[]>) | null>(null);
  readonly resetKey = input<unknown>(null);
  readonly crm = input(false);
  readonly source = input<PhoneActionSource | null>(null);

  readonly editingChange = output<boolean>();

  protected readonly pageGrid = RECORD_PAGE_GRID;
  protected readonly companyContacts = signal<CompanyContactOption[]>([]);
  private loadSeq = 0;
  private lastEmittedEditing = false;

  protected readonly editing = signal<ContactEditState | null>(null);
  protected readonly contactErrors = signal<ContactErrors>({});
  protected readonly savingContact = signal(false);
  protected readonly deletingContactName = signal('');
  readonly dialogBusy = signal(false);

  protected readonly isReadOnly = computed(() => this.readonly() || this.mode() === 'view');
  protected readonly maxContacts = computed(() => Math.min(this.max(), this.limits().contacts));

  protected readonly viewContacts = computed<ContactDraft[]>(() => {
    const saved = this.contacts();
    if (this.mode() !== 'edit') return saved;
    const edit = this.editing();
    if (!edit) return saved;
    if (edit.isNew) {
      return edit.draft.isPrimary
        ? [...saved.map((c) => ({ ...c, isPrimary: false })), edit.draft]
        : [...saved, edit.draft];
    }
    return saved.map((c) => (c.key === edit.key ? edit.draft : edit.draft.isPrimary ? { ...c, isPrimary: false } : c));
  });

  readonly isEditingContact = computed(() => this.mode() === 'edit' && this.editing() !== null);

  readonly hasUnsavedChanges = computed(() => {
    if (this.mode() !== 'edit') return false;
    const edit = this.editing();
    if (!edit) return false;
    return !contactDraftEqual(edit.draft, edit.snapshot);
  });

  protected readonly mergedErrors = computed<ContactErrors>(() => ({ ...this.errors(), ...this.contactErrors() }));

  protected readonly allTitles = computed(() => suggestionsForLanguage(TITLE_SUGGESTIONS, this.language()));
  protected readonly allJobTitles = computed(() => suggestionsForLanguage(JOB_TITLE_SUGGESTIONS, this.language()));
  protected readonly atMaxContacts = computed(() => this.viewContacts().length >= this.maxContacts());
  protected readonly hasLinkedCompany = computed(() => this.loadCompanyContacts() !== null);

  protected readonly radioIds = computed(() =>
    this.viewContacts()
      .map((_, idx) => `${this.uid}-primary-${idx}`)
      .join(' '),
  );

  protected readonly companyContactOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const list = this.companyContacts();
    if (list.length === 0) return [];
    return [
      { value: '', label: this.transloco.translate('recordForm.contacts.none') },
      ...list.map((contact) => ({
        value: contact.partyId,
        label: contact.jobTitle ? `${contact.displayName} · ${contact.jobTitle}` : contact.displayName,
      })),
    ];
  });

  protected readonly sectionError = computed(() => this.mergedErrors()['contacts'] ?? null);
  protected readonly isPrimarySectionError = computed(() => {
    if (!this.sectionError()) return false;
    const list = this.viewContacts();
    return list.length > 0 && list.filter((c) => c.isPrimary).length !== 1;
  });

  constructor() {
    effect(() => {
      this.resetKey();
      this.mode();
      untracked(() => {
        this.contactErrors.set({});
        this.editing.set(null);
      });
    });

    effect(() => {
      const nextEditing = this.isEditingContact();
      if (nextEditing !== this.lastEmittedEditing) {
        this.lastEmittedEditing = nextEditing;
        untracked(() => this.editingChange.emit(nextEditing));
      }
    });

    effect(() => {
      const loader = this.loadCompanyContacts();
      const seq = ++this.loadSeq;

      if (!loader) {
        this.companyContacts.set([]);
        return;
      }

      void loader('')
        .then((items) => {
          if (seq === this.loadSeq) {
            this.companyContacts.set(items);
          }
        })
        .catch(() => {
          if (seq === this.loadSeq) {
            this.companyContacts.set([]);
          }
        });
    });

    const onDialogKeydown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !this.dialogBusy()) return;
      this.dismissDeleteDialog(event);
    };
    const onDialogCancel = (event: Event) => {
      if (!this.dialogBusy()) return;
      this.dismissDeleteDialog(event);
    };
    document.addEventListener('keydown', onDialogKeydown, { capture: true });
    document.addEventListener('cancel', onDialogCancel, { capture: true });
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('keydown', onDialogKeydown, { capture: true });
      document.removeEventListener('cancel', onDialogCancel, { capture: true });
    });
  }

  draftContacts(): ContactDraft[] | null {
    return this.hasUnsavedChanges() ? this.viewContacts().map(cloneContact) : null;
  }

  discardEdit(): void {
    this.contactErrors.set({});
    this.editing.set(null);
  }

  async saveCurrentEdit(): Promise<boolean> {
    if (this.isReadOnly() || this.savingContact() || this.mode() !== 'edit') return false;
    const edit = this.editing();
    if (!edit) return true;

    const currentContacts = this.viewContacts();
    const editIndex = currentContacts.findIndex((c) => c.key === edit.key);
    if (editIndex < 0) return false;

    const editedContact = currentContacts[editIndex];
    const validationErrors = this.validateEditedContact(currentContacts, editIndex);
    if (Object.keys(validationErrors).length > 0) {
      this.contactErrors.set(validationErrors);
      afterNextRender(() => this.focusCardError(editIndex), { injector: this.injector });
      return false;
    }

    const saveFn = this.saveContact();
    if (!saveFn) return false;

    const change: ContactChange = edit.isNew
      ? { op: 'ADD', contact: cloneContact(editedContact) }
      : {
          op: 'UPDATE',
          contactPartyId: editedContact.contactPartyId ?? editedContact.key,
          contact: cloneContact(editedContact),
        };

    this.savingContact.set(true);
    try {
      const serverErrs = await saveFn(change);
      if (serverErrs !== null) {
        if (Object.keys(serverErrs).length > 0) {
          this.contactErrors.set(serverErrs);
          afterNextRender(() => this.focusCardError(editIndex), { injector: this.injector });
        }
        return false;
      }
      this.contactErrors.set({});
      this.editing.set(null);
      this.notify.success(this.transloco.translate('recordForm.contacts.saved'));
      afterNextRender(() => this.focusEditButton(editIndex), { injector: this.injector });
      return true;
    } finally {
      this.savingContact.set(false);
    }
  }

  protected isCardEditing(contact: ContactDraft): boolean {
    if (this.mode() === 'create') return true;
    return !this.isReadOnly() && this.editing()?.key === contact.key;
  }

  protected async startEditContact(index: number): Promise<void> {
    if (this.isReadOnly() || this.savingContact() || this.mode() !== 'edit') return;
    const target = this.contacts()[index];
    if (!target || this.editing()?.key === target.key) return;
    if (!(await this.resolveActiveEdit())) return;

    const fresh = this.contacts().find((c) => c.key === target.key) ?? target;
    const freshIndex = this.contacts().findIndex((c) => c.key === fresh.key);
    this.contactErrors.set({});
    this.editing.set({
      key: fresh.key,
      isNew: false,
      snapshot: cloneContact(fresh),
      draft: cloneContact(fresh),
    });
    if (freshIndex >= 0) {
      afterNextRender(() => this.focusCardFirstInput(freshIndex), { injector: this.injector });
    }
  }

  protected cancelEditContact(): void {
    const edit = this.editing();
    if (!edit || this.savingContact()) return;
    const savedIndex = this.contacts().findIndex((c) => c.key === edit.key);
    this.contactErrors.set({});
    this.editing.set(null);
    afterNextRender(
      () => {
        if (savedIndex >= 0) {
          this.focusEditButton(savedIndex);
        } else {
          this.host.nativeElement.querySelector<HTMLButtonElement>(`#${this.uid}-add`)?.focus();
        }
      },
      { injector: this.injector },
    );
  }

  protected onDeleteDialogEscape(event: Event): void {
    this.dismissDeleteDialog(event);
  }

  protected contactPhones(contact: ContactDraft): string[] {
    return contact.phones.length > 0 ? contact.phones : [''];
  }

  protected isLinkedContact(contact: ContactDraft): boolean {
    return this.hasLinkedCompany() && Boolean(contact.contactPartyId);
  }

  protected identityReadonly(contact: ContactDraft): boolean {
    return this.isReadOnly() || this.isLinkedContact(contact);
  }

  protected fieldError(contact: ContactDraft, field: string): string | null {
    return this.mergedErrors()[`${contact.key}.${field}`] ?? null;
  }

  protected contactPhoneErrors(contact: ContactDraft): Record<number, string> {
    const errs = this.mergedErrors();
    const out: Record<number, string> = {};
    const phones = this.contactPhones(contact);
    for (let i = 0; i < phones.length; i++) {
      const msg =
        errs[`${contact.key}.phones.${i}`] ?? (i === 0 ? errs[`${contact.key}.phones`] : undefined);
      if (msg) out[i] = msg;
    }
    return out;
  }

  protected emailError(contact: ContactDraft): string | null {
    const errs = this.mergedErrors();
    return errs[`${contact.key}.email`] ?? errs[`${contact.key}.reach`] ?? null;
  }

  protected contactDisplayName(contact: ContactDraft, index: number): string {
    this.i18n();
    const name = [contact.honorificTitle.trim(), contact.firstName.trim(), contact.lastName.trim()]
      .filter(Boolean)
      .join(' ');
    return name || this.transloco.translate('recordForm.contacts.n', { n: index + 1 });
  }

  protected async setPrimary(index: number): Promise<void> {
    if (this.isReadOnly() || this.savingContact()) return;
    if (this.mode() === 'edit') {
      const edit = this.editing();
      const viewTarget = this.viewContacts()[index];
      if (!viewTarget) return;

      if (edit && viewTarget.key === edit.key) {
        this.editing.update((state) => (state ? { ...state, draft: { ...state.draft, isPrimary: true } } : null));
        return;
      }

      if (edit && !(await this.resolveActiveEdit())) {
        return;
      }

      const target = this.contacts().find((c) => c.key === viewTarget.key);
      if (!target || target.isPrimary) return;
      const saveFn = this.saveContact();
      if (!saveFn) return;

      this.savingContact.set(true);
      try {
        const serverErrs = await saveFn({
          op: 'SET_PRIMARY',
          contactPartyId: target.contactPartyId ?? target.key,
        });
        if (serverErrs !== null) {
          if (Object.keys(serverErrs).length > 0) {
            this.contactErrors.set(serverErrs);
          }
          return;
        }
        this.contactErrors.set({});
        this.notify.success(this.transloco.translate('recordForm.contacts.saved'));
      } finally {
        this.savingContact.set(false);
      }
      return;
    }

    this.contacts.update((current) => current.map((contact, i) => ({ ...contact, isPrimary: i === index })));
  }

  protected isRadioTabStop(index: number): boolean {
    const list = this.viewContacts();
    const primaryIndex = list.findIndex((c) => c.isPrimary);
    return index === (primaryIndex >= 0 ? primaryIndex : 0);
  }

  protected onPrimaryKeydown(event: KeyboardEvent, index: number): void {
    if (this.isReadOnly() || this.savingContact()) return;
    const count = this.viewContacts().length;
    if (count <= 1) return;

    let nextIndex = -1;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      nextIndex = (index + 1) % count;
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      nextIndex = (index - 1 + count) % count;
    } else {
      return;
    }

    event.preventDefault();
    void this.setPrimary(nextIndex).then(() => {
      afterNextRender(
        () => this.host.nativeElement.querySelector<HTMLButtonElement>(`#${this.uid}-primary-${nextIndex}`)?.focus(),
        { injector: this.injector },
      );
    });
    if (!this.savingContact()) {
      this.host.nativeElement.querySelector<HTMLButtonElement>(`#${this.uid}-primary-${nextIndex}`)?.focus();
    }
  }

  protected async addContact(): Promise<void> {
    if (this.isReadOnly() || this.savingContact()) return;
    if (this.mode() === 'create') {
      if (this.atMaxContacts()) return;
      this.contacts.update((current) => [...current, newContact(current.length === 0)]);
      return;
    }

    if (!(await this.resolveActiveEdit())) return;
    if (this.atMaxContacts()) return;
    const saved = this.contacts();
    const fresh = newContact(saved.length === 0);
    const nextIndex = saved.length;
    this.contactErrors.set({});
    this.editing.set({
      key: fresh.key,
      isNew: true,
      snapshot: cloneContact(fresh),
      draft: fresh,
    });
    afterNextRender(() => this.focusCardFirstInput(nextIndex), { injector: this.injector });
  }

  protected async removeContact(index: number): Promise<void> {
    if (this.isReadOnly() || this.savingContact()) return;
    if (this.mode() === 'create') {
      this.contacts.update((current) => {
        if (current.length <= 1) return current;
        const next = current.filter((_, i) => i !== index);
        if (!next.some((contact) => contact.isPrimary) && next.length > 0) {
          next[0] = { ...next[0], isPrimary: true };
        }
        return next;
      });
      return;
    }

    const edit = this.editing();
    const saved = this.contacts();
    if (edit?.isNew && index === saved.length) {
      this.cancelEditContact();
      return;
    }
    if (saved.length <= 1) return;
    const target = saved[index];
    if (!target) return;

    const fullName = [target.honorificTitle.trim(), target.firstName.trim(), target.lastName.trim()]
      .filter(Boolean)
      .join(' ');
    this.deletingContactName.set(fullName || this.transloco.translate('recordForm.contacts.n', { n: index + 1 }));

    if (this.dialogBusy()) return;
    this.dialogBusy.set(true);
    let confirmed = false;
    try {
      confirmed = await this.deleteDialog().open();
    } finally {
      this.dialogBusy.set(false);
    }
    if (!confirmed) return;

    const saveFn = this.saveContact();
    if (!saveFn) return;

    this.savingContact.set(true);
    try {
      const err = await saveFn({
        op: 'REMOVE',
        contactPartyId: target.contactPartyId ?? target.key,
      });
      if (err === null) {
        if (this.editing()?.key === target.key) {
          this.contactErrors.set({});
          this.editing.set(null);
        }
      } else if (Object.keys(err).length > 0) {
        this.contactErrors.set(err);
      }
    } finally {
      this.savingContact.set(false);
    }
  }

  protected pickExistingContact(index: number, partyId: string): void {
    if (this.isReadOnly() || !partyId) return;
    const picked = this.companyContacts().find((item) => item.partyId === partyId);
    if (!picked) return;

    this.updateContact(index, (contact) => ({
      ...contact,
      contactPartyId: picked.partyId,
      honorificTitle: '',
      firstName: picked.displayName,
      lastName: '',
      jobTitle: picked.jobTitle ?? '',
      email: picked.email ?? '',
      phones: picked.phones.length > 0 ? [...picked.phones] : [''],
    }));
  }

  protected clearPickedContact(index: number): void {
    if (this.isReadOnly()) return;
    this.updateContact(index, (contact) => ({
      ...contact,
      contactPartyId: null,
      honorificTitle: '',
      firstName: '',
      lastName: '',
      jobTitle: '',
      phones: [''],
      email: '',
    }));
  }

  protected setTextField(
    index: number,
    field: 'firstName' | 'lastName' | 'email',
    event: Event,
  ): void {
    if (this.isReadOnly()) return;
    const value = (event.target as HTMLInputElement).value;
    this.updateContact(index, (contact) => ({ ...contact, [field]: value }));
  }

  protected setTextValue(index: number, field: 'honorificTitle' | 'jobTitle', value: string): void {
    if (this.isReadOnly()) return;
    this.updateContact(index, (contact) => ({ ...contact, [field]: value }));
  }

  protected setPhones(contactIndex: number, phones: string[]): void {
    if (this.isReadOnly()) return;
    this.updateContact(contactIndex, (contact) => ({ ...contact, phones: [...phones] }));
  }

  private async resolveActiveEdit(): Promise<boolean> {
    if (!this.editing()) return true;
    if (!this.hasUnsavedChanges()) {
      this.discardEdit();
      return true;
    }
    if (this.dialogBusy()) return false;
    this.dialogBusy.set(true);
    let choice: 'save' | 'discard' | 'cancel' = 'cancel';
    try {
      choice = await this.unsavedDialog().open();
    } finally {
      this.dialogBusy.set(false);
    }
    if (choice === 'cancel') return false;
    if (choice === 'discard') {
      this.discardEdit();
      return true;
    }
    return await this.saveCurrentEdit();
  }

  private updateContact(index: number, updater: (contact: ContactDraft) => ContactDraft): void {
    if (this.mode() === 'edit') {
      const targetKey = this.viewContacts()[index]?.key;
      this.contactErrors.set({});
      this.editing.update((state) =>
        state && state.key === targetKey ? { ...state, draft: updater(state.draft) } : state,
      );
      return;
    }
    this.contacts.update((current) => current.map((contact, i) => (i === index ? updater(contact) : contact)));
  }

  private validateEditedContact(allContacts: readonly ContactDraft[], editIndex: number): ContactErrors {
    const c = allContacts[editIndex];
    const lim = this.limits();
    const errs: ContactErrors = {};
    const maxAllowed = this.maxContacts();

    if (allContacts.length > maxAllowed) {
      errs['contacts'] = this.tError('contactsMax', maxAllowed);
    } else if (allContacts.filter((item) => item.isPrimary).length !== 1) {
      errs['contacts'] = this.tError('primaryOne');
    }

    if (
      c.contactPartyId &&
      allContacts.some((other, idx) => idx !== editIndex && other.contactPartyId === c.contactPartyId)
    ) {
      errs['contacts'] = errs['contacts'] ?? this.tError('duplicateContactMethod');
    }

    if (c.honorificTitle.trim().length > lim.honorificTitle) {
      errs[`${c.key}.honorificTitle`] = this.tError('tooLong', lim.honorificTitle);
    }
    if (c.jobTitle.trim().length > lim.jobTitle) {
      errs[`${c.key}.jobTitle`] = this.tError('tooLong', lim.jobTitle);
    }

    if (!this.isLinkedContact(c)) {
      if (!c.firstName.trim()) {
        errs[`${c.key}.firstName`] = this.tError('required');
      } else if (c.firstName.trim().length > lim.firstName) {
        errs[`${c.key}.firstName`] = this.tError('tooLong', lim.firstName);
      }
      if (c.lastName.trim().length > lim.lastName) {
        errs[`${c.key}.lastName`] = this.tError('tooLong', lim.lastName);
      }
    }

    const otherPhones = new Set<string>();
    const otherEmails = new Set<string>();
    for (let i = 0; i < allContacts.length; i++) {
      if (i === editIndex) continue;
      const other = allContacts[i];
      for (const p of other.phones) {
        const trimmed = p.trim();
        if (trimmed) otherPhones.add(normalizePhone(trimmed));
      }
      const mail = other.email.trim().toLowerCase();
      if (mail) otherEmails.add(mail);
    }

    const seenPhones = new Set<string>();
    for (let pIdx = 0; pIdx < c.phones.length; pIdx++) {
      const trimmed = c.phones[pIdx].trim();
      if (!trimmed) continue;
      if (trimmed.length > lim.phoneLength) {
        errs[`${c.key}.phones.${pIdx}`] = this.tError('tooLong', lim.phoneLength);
        continue;
      }
      const ascii = toAsciiDigits(trimmed);
      if (!PHONE_CHARS_RE.test(ascii) || phoneDigits(ascii) < 5) {
        errs[`${c.key}.phones.${pIdx}`] = this.tError('phoneInvalid');
        continue;
      }
      const normalized = normalizePhone(trimmed);
      if (seenPhones.has(normalized)) {
        errs[`${c.key}.phones.${pIdx}`] = this.tError('phoneDuplicate');
        continue;
      }
      if (otherPhones.has(normalized)) {
        errs[`${c.key}.phones.${pIdx}`] = this.tError('duplicateContactMethod');
        continue;
      }
      seenPhones.add(normalized);
    }

    const email = c.email.trim();
    if (email) {
      if (email.length > lim.email) {
        errs[`${c.key}.email`] = this.tError('tooLong', lim.email);
      } else if (!EMAIL_RE.test(email)) {
        errs[`${c.key}.email`] = this.tError('emailInvalid');
      } else if (otherEmails.has(email.toLowerCase())) {
        errs[`${c.key}.email`] = this.tError('duplicateContactMethod');
      }
    }

    return errs;
  }

  private tError(key: string, max?: number): string {
    return this.transloco.translate(`recordForm.errors.${key}`, max !== undefined ? { max } : undefined);
  }

  private dismissDeleteDialog(event: Event): void {
    const dialog = this.deleteDialogWrap()?.nativeElement.querySelector<HTMLDialogElement>('dialog');
    if (!dialog?.open) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    dialog.close();
  }

  private focusEditButton(index: number): void {
    this.host.nativeElement.querySelector<HTMLButtonElement>(`#${this.uid}-edit-${index}`)?.focus();
  }

  private focusCardFirstInput(index: number): void {
    const card = this.host.nativeElement.querySelector<HTMLElement>(`#${this.uid}-card-${index}`);
    if (!card) return;
    const firstName = card.querySelector<HTMLInputElement>(`#${this.uid}-first-${index}:not([readonly])`);
    if (firstName) {
      firstName.focus();
      return;
    }
    const fallback = card.querySelector<HTMLElement>(
      '.grid input:not([readonly]):not([disabled]), button:not([disabled]):not([tabindex="-1"])',
    );
    fallback?.focus();
  }

  private focusCardError(index: number): void {
    const card = this.host.nativeElement.querySelector<HTMLElement>(`#${this.uid}-card-${index}`);
    const target = card?.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (!target) return;
    if (target.matches('input, textarea, select, button, [tabindex]')) {
      target.scrollIntoView({ block: 'nearest' });
      target.focus();
      return;
    }
    const inner = target.querySelector<HTMLElement>('input, textarea, select, button, [tabindex]');
    if (inner) {
      inner.scrollIntoView({ block: 'nearest' });
      inner.focus();
    }
  }
}
