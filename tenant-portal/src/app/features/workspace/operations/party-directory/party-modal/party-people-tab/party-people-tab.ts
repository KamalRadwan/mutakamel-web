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
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerCheck,
  tablerChevronDown,
  tablerCloudOff,
  tablerLoader2,
  tablerPlus,
  tablerSearch,
  tablerTrash,
  tablerUsers,
  tablerX,
} from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../../core/notify/notify';
import { Button } from '../../../../../../shared/ui/button/button';
import { Checkbox } from '../../../../../../shared/ui/checkbox/checkbox';
import { ConfirmDialog } from '../../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, DropdownOption } from '../../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../../shared/ui/field/field';
import { rectInPage, viewport } from '../../../../../../shared/ui/overlay/zoom';
import { PhoneActionSource, PhoneActions } from '../../../../../../shared/widgets/phone-actions/phone-actions';
import { errorCodeOf } from '../../../../staff/shared/staff.api';
import {
  addRelationship,
  deleteRelationship,
  listOrgContacts,
  listParties,
} from '../../party-directory.api';
import {
  OrgContact,
  PartyDetail,
  PartyListItem,
  RelationshipType,
} from '../../party-directory.model';
import {
  ORG_RELATIONSHIP_TYPES,
  PARTY_LIMITS,
  resolvePartyError,
} from '../party-modal.util';

interface MenuPlace {
  top: number;
  start: number;
  width: number;
  maxHeight: number | null;
}

const PAGE_LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 200;
const SKELETON_ROWS = [0, 1, 2] as const;

@Component({
  selector: 'app-party-people-tab',
  imports: [
    NgIcon,
    TranslocoPipe,
    Button,
    Checkbox,
    ConfirmDialog,
    Dropdown,
    Field,
    PhoneActions,
  ],
  providers: [
    provideIcons({
      tablerCheck,
      tablerChevronDown,
      tablerCloudOff,
      tablerLoader2,
      tablerPlus,
      tablerSearch,
      tablerTrash,
      tablerUsers,
      tablerX,
    }),
  ],
  templateUrl: './party-people-tab.html',
  host: {
    class: 'flex min-h-0 flex-1 flex-col overflow-hidden',
    '(document:click)': 'closePickerIfOutside($event)',
    '(window:resize)': 'closePicker()',
    '(keydown.escape)': 'onPickerEscape($event)',
  },
})
export class PartyPeopleTab {
  private static nextId = 0;
  protected readonly uid = `party-people-tab-${++PartyPeopleTab.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly unlinkConfirm = viewChild.required<ConfirmDialog>('unlinkConfirm');
  private readonly pickerTrigger = viewChild<ElementRef<HTMLButtonElement>>('pickerTrigger');
  private readonly pickerPanel = viewChild<ElementRef<HTMLElement>>('pickerPanel');
  private readonly pickerSearchInput = viewChild<ElementRef<HTMLInputElement>>('pickerSearchInput');

  readonly party = input.required<PartyDetail>();
  readonly readonly = input(false);

  readonly openPerson = output<string>();
  readonly changed = output<void>();

  protected readonly limits = PARTY_LIMITS;
  protected readonly skeletonRows = SKELETON_ROWS;

  protected readonly contacts = signal<OrgContact[]>([]);
  protected readonly loading = signal(false);
  protected readonly loadingMore = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly hasNext = signal(false);
  protected readonly unlinkingId = signal<string | null>(null);
  protected readonly unlinkingName = signal('');

  protected readonly linking = signal(false);
  protected readonly savingLink = signal(false);
  protected readonly selectedPerson = signal<PartyListItem | null>(null);
  protected readonly relationshipType = signal<RelationshipType>('CONTACT_PERSON');
  protected readonly relationshipLabel = signal('');
  protected readonly isPrimary = signal(false);
  protected readonly submitAttempted = signal(false);
  private readonly personServerError = signal<{ message: string; personId: string | null } | null>(null);

  protected readonly pickerOpen = signal(false);
  protected readonly pickerPlaced = signal(false);
  protected readonly pickerPlace = signal<MenuPlace>({ top: 0, start: 0, width: 0, maxHeight: null });
  protected readonly pickerSearch = signal('');
  protected readonly pickerSearching = signal(false);
  protected readonly pickerOptions = signal<PartyListItem[]>([]);

  private currentPage = 1;
  private loadSeq = 0;
  private pickerSeq = 0;
  private searchSeq = 0;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private syncedPartyId: string | null = null;

  protected readonly gridColumns = computed(() =>
    this.readonly()
      ? 'grid-cols-ops-party-person-row'
      : 'grid-cols-ops-party-person-row-actions',
  );

  protected readonly relationshipOptions = computed<DropdownOption<RelationshipType>[]>(() => {
    this.i18n();
    return ORG_RELATIONSHIP_TYPES.map((type) => ({
      value: type,
      label: this.transloco.translate(`wsParty.relationshipTypes.${type}`),
    }));
  });

  protected readonly personError = computed(() => {
    this.i18n();
    const server = this.personServerError();
    const selectedId = this.selectedPerson()?.id ?? null;
    if (server && server.personId === selectedId) {
      return server.message;
    }
    if (this.submitAttempted() && !selectedId) {
      return this.transloco.translate('wsPartyModal.validation.personRequired');
    }
    return null;
  });

  protected readonly labelError = computed(() => {
    this.i18n();
    if (Array.from(this.relationshipLabel().trim()).length > PARTY_LIMITS.relationshipLabel) {
      return this.transloco.translate('wsPartyModal.validation.maxLength', {
        max: PARTY_LIMITS.relationshipLabel,
      });
    }
    return null;
  });

  constructor() {
    effect(() => {
      const id = this.party().id;
      if (id !== this.syncedPartyId) {
        this.syncedPartyId = id;
        untracked(() => {
          this.resetLinkForm();
          void this.loadContacts(true);
        });
      }
    });

    const onScroll = (event: Event) => {
      if (!this.pickerOpen()) return;
      const target = event.target;
      if (target instanceof Node && this.pickerPanel()?.nativeElement.contains(target)) return;
      this.closePicker();
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('scroll', onScroll, { capture: true });
      if (this.searchTimer !== null) clearTimeout(this.searchTimer);
    });
  }

  protected phoneOf(row: OrgContact): string | null {
    return row.mobile || row.phone || row.phones[0]?.value || null;
  }

  protected phoneSourceOf(row: OrgContact): PhoneActionSource {
    return {
      type: 'PARTY',
      id: row.partyId,
      label: row.displayName,
    };
  }

  protected contactHintOf(person: PartyListItem): string {
    const email = person.contactMethods.find((c) => c.methodType === 'EMAIL')?.value;
    const phone =
      person.contactMethods.find((c) => c.methodType === 'MOBILE')?.value ??
      person.contactMethods.find((c) => c.methodType === 'PHONE')?.value;
    return [phone, email].filter(Boolean).join(' · ');
  }

  protected reload(): void {
    void this.loadContacts(true);
  }

  protected loadMore(): void {
    if (this.loading() || this.loadingMore() || !this.hasNext()) return;
    void this.loadContacts(false);
  }

  protected onRowKeydown(event: KeyboardEvent, personId: string): void {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.openPerson.emit(personId);
    }
  }

  protected openLinkForm(): void {
    if (this.readonly() || this.savingLink()) return;
    this.resetLinkForm();
    this.linking.set(true);
  }

  protected cancelLinkForm(): void {
    if (this.savingLink()) return;
    this.resetLinkForm();
  }

  protected onLabelInput(event: Event): void {
    this.relationshipLabel.set((event.target as HTMLInputElement).value);
  }

  protected togglePicker(): void {
    if (this.readonly() || this.savingLink()) return;
    if (this.pickerOpen()) {
      this.closePicker();
      return;
    }
    const triggerEl = this.pickerTrigger()?.nativeElement;
    if (!triggerEl) return;

    const seq = ++this.pickerSeq;
    this.pickerSearch.set('');
    this.pickerPlaced.set(false);
    this.pickerPlace.set(this.initialPlace(triggerEl));
    this.pickerOpen.set(true);
    void this.searchPeople('');
    queueMicrotask(() => this.placePicker(seq));
    afterNextRender(
      () => {
        this.placePicker(seq);
        this.pickerSearchInput()?.nativeElement.focus();
      },
      { injector: this.injector },
    );
  }

  protected closePicker(): void {
    this.pickerSeq++;
    this.pickerOpen.set(false);
    this.pickerPlaced.set(false);
  }

  protected closePickerIfOutside(event: Event): void {
    if (!this.pickerOpen()) return;
    const target = event.target;
    if (!(target instanceof Node)) {
      this.closePicker();
      return;
    }
    if (
      this.pickerTrigger()?.nativeElement.contains(target) ||
      this.pickerPanel()?.nativeElement.contains(target)
    ) {
      return;
    }
    this.closePicker();
  }

  protected onPickerEscape(event: Event): void {
    if (!this.pickerOpen()) return;
    event.preventDefault();
    event.stopPropagation();
    this.closePicker();
    this.pickerTrigger()?.nativeElement.focus();
  }

  protected onPickerSearchInput(event: Event): void {
    const term = (event.target as HTMLInputElement).value;
    this.pickerSearch.set(term);
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
    this.searchTimer = setTimeout(() => {
      void this.searchPeople(term);
    }, SEARCH_DEBOUNCE_MS);
  }

  protected selectPerson(person: PartyListItem): void {
    this.selectedPerson.set(person);
    this.personServerError.set(null);
    this.closePicker();
    this.pickerTrigger()?.nativeElement.focus();
  }

  protected async saveLink(event?: Event): Promise<void> {
    event?.preventDefault();
    if (this.readonly() || this.savingLink()) return;
    this.closePicker();
    this.submitAttempted.set(true);
    this.personServerError.set(null);

    const person = this.selectedPerson();
    const trimmedLabel = this.relationshipLabel().trim();
    if (!person || Array.from(trimmedLabel).length > PARTY_LIMITS.relationshipLabel) {
      return;
    }

    this.savingLink.set(true);
    try {
      await addRelationship({
        fromPartyId: this.party().id,
        toPartyId: person.id,
        relationshipType: this.relationshipType(),
        ...(trimmedLabel ? { label: trimmedLabel } : {}),
        ...(this.isPrimary() ? { isPrimary: true } : {}),
      });
      this.notify.success(this.transloco.translate('wsPartyModal.people.linked'));
      this.resetLinkForm();
      await this.loadContacts(true);
      this.changed.emit();
    } catch (error) {
      const code = errorCodeOf(error);
      if (
        code === 'PARTY_RELATIONSHIP_ALREADY_EXISTS' ||
        code === 'PARTY_RELATIONSHIP_INVALID'
      ) {
        this.personServerError.set({
          message: resolvePartyError(error, this.transloco),
          personId: person.id,
        });
        return;
      }
      this.notify.error(resolvePartyError(error, this.transloco));
    } finally {
      this.savingLink.set(false);
    }
  }

  protected async unlink(row: OrgContact): Promise<void> {
    if (this.readonly() || this.unlinkingId() !== null) return;
    this.unlinkingName.set(row.displayName);
    const confirmed = await this.unlinkConfirm().open();
    if (!confirmed) return;

    this.unlinkingId.set(row.relationshipId);
    try {
      await deleteRelationship(row.relationshipId);
      this.notify.success(this.transloco.translate('wsPartyModal.people.unlinked'));
      await this.loadContacts(true);
      this.changed.emit();
    } catch (error) {
      this.notify.error(resolvePartyError(error, this.transloco));
    } finally {
      this.unlinkingId.set(null);
    }
  }

  private async loadContacts(reset: boolean): Promise<void> {
    const seq = ++this.loadSeq;
    const partyId = this.party().id;
    const nextPage = reset ? 1 : this.currentPage + 1;
    if (reset) {
      this.loading.set(true);
      this.loadFailed.set(false);
    } else {
      this.loadingMore.set(true);
    }

    try {
      const res = await listOrgContacts(partyId, { page: nextPage, limit: PAGE_LIMIT });
      if (seq !== this.loadSeq || this.party().id !== partyId) return;
      this.currentPage = res.meta.page;
      this.hasNext.set(res.meta.hasNext);
      this.contacts.update((prev) => (reset ? res.data : [...prev, ...res.data]));
    } catch (error) {
      if (seq !== this.loadSeq || this.party().id !== partyId) return;
      if (reset) {
        this.loadFailed.set(true);
      } else {
        this.notify.error(resolvePartyError(error, this.transloco));
      }
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
        this.loadingMore.set(false);
      }
    }
  }

  private async searchPeople(search: string): Promise<void> {
    const seq = ++this.searchSeq;
    this.pickerSearching.set(true);
    try {
      const page = await listParties({
        page: 1,
        limit: PAGE_LIMIT,
        partyType: 'PERSON',
        ...(search.trim() ? { search: search.trim() } : {}),
      });
      if (seq !== this.searchSeq) return;
      this.pickerOptions.set(page.data);
      if (this.pickerOpen()) {
        queueMicrotask(() => this.placePicker(this.pickerSeq));
      }
    } catch {
      if (seq !== this.searchSeq) return;
      this.pickerOptions.set([]);
    } finally {
      if (seq === this.searchSeq) {
        this.pickerSearching.set(false);
      }
    }
  }

  private resetLinkForm(): void {
    this.closePicker();
    this.linking.set(false);
    this.selectedPerson.set(null);
    this.relationshipType.set('CONTACT_PERSON');
    this.relationshipLabel.set('');
    this.isPrimary.set(false);
    this.submitAttempted.set(false);
    this.personServerError.set(null);
  }

  private initialPlace(triggerEl: HTMLElement): MenuPlace {
    const rect = rectInPage(triggerEl);
    const { width } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    return {
      top: rect.bottom + 4,
      start: rtl ? width - rect.right : rect.left,
      width: rect.width,
      maxHeight: null,
    };
  }

  private placePicker(seq: number): void {
    if (seq !== this.pickerSeq || !this.pickerOpen()) return;
    const triggerEl = this.pickerTrigger()?.nativeElement;
    const panelEl = this.pickerPanel()?.nativeElement;
    if (!triggerEl || !panelEl) return;

    const rect = rectInPage(triggerEl);
    const panelRect = rectInPage(panelEl);
    const { width, height } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';

    const belowTop = rect.bottom + 4;
    const spaceBelow = Math.max(8, height - 8 - belowTop);
    const spaceAbove = Math.max(8, rect.top - 12);
    const flipUp = panelRect.height > spaceBelow && spaceAbove > spaceBelow;
    const avail = flipUp ? spaceAbove : spaceBelow;
    const maxHeight = panelRect.height > avail ? avail : null;
    const finalHeight = maxHeight ?? panelRect.height;
    const top = flipUp ? Math.max(8, rect.top - 4 - finalHeight) : belowTop;

    const triggerStart = rtl ? width - rect.right : rect.left;
    const triggerEnd = rtl ? width - rect.left : rect.right;
    const alignEnd = triggerStart + panelRect.width > width - 8;
    const rawStart = alignEnd ? triggerEnd - panelRect.width : triggerStart;
    const start = Math.min(Math.max(8, rawStart), Math.max(8, width - 8 - panelRect.width));

    this.pickerPlace.set({ top, start, width: rect.width, maxHeight });
    this.pickerPlaced.set(true);
  }
}
