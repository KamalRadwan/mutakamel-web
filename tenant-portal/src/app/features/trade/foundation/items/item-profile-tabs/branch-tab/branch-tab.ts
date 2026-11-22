import { Component, computed, inject, input, model, output } from '@angular/core';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerBuilding, tablerLock, tablerPlus } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../../core/i18n/language';
import { Button } from '../../../../../../shared/ui/button/button';
import { Dropdown, type DropdownOption } from '../../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../../shared/ui/field/field';
import { RECORD_PAGE_GRID } from '../../../../../../shared/ui/section-bar/record-layout';
import { SectionBar } from '../../../../../../shared/ui/section-bar/section-bar';
import { Switch } from '../../../../../../shared/ui/switch/switch';
import { itemName } from '../../../../shared/trade-foundation.api';
import type { ItemBranchProfile } from '../../../../shared/trade-foundation.model';
import {
  ITEM_LIMITS,
  type BranchProfileBody,
  type BranchProfilePatch,
  type FulfillmentNodeOption,
} from '../../items.model';
import type { DraftErrors } from '../../item-form/item-draft';

export interface BranchProfileDraft {
  enabled: boolean;
  isAssorted: boolean;
  defaultFulfillmentNodeId: string | null;
  replenishmentPolicyKey: string;
}

export function emptyBranchProfileDraft(): BranchProfileDraft {
  return {
    enabled: false,
    isAssorted: false,
    defaultFulfillmentNodeId: null,
    replenishmentPolicyKey: '',
  };
}

export function branchProfileDraftFromModel(profile: ItemBranchProfile | null): BranchProfileDraft {
  if (!profile) return emptyBranchProfileDraft();
  return {
    enabled: true,
    isAssorted: profile.isAssorted,
    defaultFulfillmentNodeId: profile.defaultFulfillmentNodeId,
    replenishmentPolicyKey: profile.replenishmentPolicyKey ?? '',
  };
}

export function defaultEnabledBranchProfile(): BranchProfileDraft {
  return {
    enabled: true,
    isAssorted: true,
    defaultFulfillmentNodeId: null,
    replenishmentPolicyKey: '',
  };
}

export function branchProfileDraftsEqual(a: BranchProfileDraft, b: BranchProfileDraft): boolean {
  return (
    a.enabled === b.enabled &&
    a.isAssorted === b.isAssorted &&
    a.defaultFulfillmentNodeId === b.defaultFulfillmentNodeId &&
    a.replenishmentPolicyKey === b.replenishmentPolicyKey
  );
}

export function rebaseBranchProfileDraft(
  oldBase: BranchProfileDraft,
  freshBase: BranchProfileDraft,
  currentDraft: BranchProfileDraft,
): BranchProfileDraft {
  if (!oldBase.enabled && currentDraft.enabled) {
    return freshBase.enabled ? { ...freshBase } : { ...currentDraft };
  }
  if (!freshBase.enabled) {
    return { ...currentDraft };
  }
  return {
    enabled: true,
    isAssorted: currentDraft.isAssorted !== oldBase.isAssorted ? currentDraft.isAssorted : freshBase.isAssorted,
    defaultFulfillmentNodeId:
      currentDraft.defaultFulfillmentNodeId !== oldBase.defaultFulfillmentNodeId
        ? currentDraft.defaultFulfillmentNodeId
        : freshBase.defaultFulfillmentNodeId,
    replenishmentPolicyKey:
      currentDraft.replenishmentPolicyKey !== oldBase.replenishmentPolicyKey
        ? currentDraft.replenishmentPolicyKey
        : freshBase.replenishmentPolicyKey,
  };
}

export function validateBranchProfileDraft(draft: BranchProfileDraft): DraftErrors {
  const errors: DraftErrors = {};
  if (draft.enabled && draft.replenishmentPolicyKey.trim().length > ITEM_LIMITS.key) {
    errors['replenishmentPolicyKey'] = {
      key: 'itemForm.validation.maxLength',
      params: { max: ITEM_LIMITS.key },
    };
  }
  return errors;
}

function trimOrNull(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed ? trimmed : null;
}

export function toBranchProfileCreateBody(draft: BranchProfileDraft): BranchProfileBody {
  return {
    isAssorted: draft.isAssorted,
    defaultFulfillmentNodeId: draft.defaultFulfillmentNodeId,
    replenishmentPolicyKey: trimOrNull(draft.replenishmentPolicyKey),
  };
}

export function toBranchProfilePatchBody(
  base: BranchProfileDraft,
  draft: BranchProfileDraft,
): BranchProfilePatch {
  const patch: BranchProfilePatch = {};
  if (base.isAssorted !== draft.isAssorted) patch.isAssorted = draft.isAssorted;
  if (base.defaultFulfillmentNodeId !== draft.defaultFulfillmentNodeId) {
    patch.defaultFulfillmentNodeId = draft.defaultFulfillmentNodeId;
  }
  const nextPolicy = trimOrNull(draft.replenishmentPolicyKey);
  if (trimOrNull(base.replenishmentPolicyKey) !== nextPolicy) {
    patch.replenishmentPolicyKey = nextPolicy;
  }
  return patch;
}

@Component({
  selector: 'app-item-branch-tab',
  imports: [NgIcon, TranslocoPipe, Button, Dropdown, Field, SectionBar, Switch],
  providers: [provideIcons({ tablerBuilding, tablerPlus, tablerLock })],
  templateUrl: './branch-tab.html',
  host: { class: 'block min-w-0' },
})
export class BranchTab {
  private static nextId = 0;
  protected readonly uid = `item-bp-${++BranchTab.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  readonly companyName = input('');
  readonly branchName = input('');
  readonly hasCompanyProfile = input(false);
  readonly nodes = input<readonly FulfillmentNodeOption[]>([]);
  readonly readonly = input(false);
  readonly errors = input<DraftErrors>({});

  readonly draft = model.required<BranchProfileDraft>();
  readonly enabledChange = output<void>();

  protected readonly limits = ITEM_LIMITS;
  protected readonly pageGrid = RECORD_PAGE_GRID;

  protected readonly nodeOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const lang = this.language();
    const options: DropdownOption<string>[] = [
      { value: '', label: this.transloco.translate('itemForm.states.none') },
    ];
    for (const node of this.nodes()) {
      options.push({ value: node.id, label: itemName(node, lang) || node.id });
    }
    return options;
  });

  protected errorText(path: string): string | null {
    this.i18n();
    const err = this.errors()[path];
    if (!err) return null;
    return this.transloco.translate(err.key, err.params);
  }

  protected describedBy(path: string, controlId: string): string {
    return this.errorText(path) ? `${controlId}-hint ${controlId}-error` : `${controlId}-hint`;
  }

  protected nodeLabel(nodeId: string | null): string {
    this.i18n();
    if (!nodeId) return this.transloco.translate('itemForm.states.none');
    const found = this.nodes().find((n) => n.id === nodeId);
    return found ? itemName(found, this.language()) || found.id : nodeId;
  }

  protected enableBranch(): void {
    if (this.readonly() || !this.hasCompanyProfile()) return;
    this.draft.set(defaultEnabledBranchProfile());
    this.enabledChange.emit();
  }

  protected onAssortedChange(isAssorted: boolean): void {
    if (this.readonly()) return;
    this.draft.update((d) => ({ ...d, isAssorted }));
  }

  protected onNodeChange(nodeId: string): void {
    if (this.readonly()) return;
    this.draft.update((d) => ({ ...d, defaultFulfillmentNodeId: nodeId || null }));
  }

  protected onPolicyInput(event: Event): void {
    if (this.readonly()) return;
    const replenishmentPolicyKey = (event.target as HTMLInputElement).value;
    this.draft.update((d) => ({ ...d, replenishmentPolicyKey }));
  }
}
