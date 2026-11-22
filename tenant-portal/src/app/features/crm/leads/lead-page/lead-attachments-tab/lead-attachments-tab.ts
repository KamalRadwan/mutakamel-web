import { Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { RecordAttachments } from '../../../../../shared/widgets/record-attachments/record-attachments';
import { listBranchOwners } from '../../leads.api';

@Component({
  selector: 'app-lead-attachments-tab',
  imports: [RecordAttachments],
  templateUrl: './lead-attachments-tab.html',
  host: { class: 'block' },
})
export class LeadAttachmentsTab {
  readonly leadId = input.required<string>();
  readonly branchId = input<string | null>(null);
  readonly canEdit = input<boolean | undefined>(undefined);
  readonly canUpload = input<boolean | undefined>(undefined);
  readonly canDelete = input<boolean | undefined>(undefined);
  readonly countChange = output<number>();

  private readonly ownersById = signal<Record<string, string>>({});
  private ownersSeq = 0;
  private loadedOwnersBranchId: string | null = null;

  protected readonly uploaderNameFn = computed(() => {
    const map = this.ownersById();
    return (userId: string) => map[userId] ?? null;
  });

  constructor() {
    effect(() => {
      const branchId = this.branchId();
      if (!branchId || branchId === this.loadedOwnersBranchId) return;
      untracked(() => void this.loadOwners(branchId));
    });
  }

  private async loadOwners(branchId: string): Promise<void> {
    const seq = ++this.ownersSeq;
    try {
      const owners = await listBranchOwners(branchId);
      if (seq !== this.ownersSeq || this.branchId() !== branchId) return;
      const map: Record<string, string> = {};
      for (const owner of owners) {
        map[owner.id] = owner.displayName;
      }
      this.ownersById.set(map);
      this.loadedOwnersBranchId = branchId;
    } catch {
      // Unknown uploader names fall back to "—"
    }
  }
}
