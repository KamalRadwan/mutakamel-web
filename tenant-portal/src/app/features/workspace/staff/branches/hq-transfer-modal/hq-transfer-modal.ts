import { Component, computed, inject, output, signal, viewChild } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerAlertTriangle } from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { StaffSession } from '../../shared/staff-session';
import { ApiError, errorCodeOf } from '../../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { staffErrorMessage } from '../../shared/staff.api';
import { OrganizationWriteApi } from '../../shared/organization-write.api';
import { seatErrorMessage } from '../../../seats/seat-errors';
import { Branch } from '../../shared/staff.model';

export interface HqTransferRequest {
  branch: Branch;
  companyName: string;
  candidateBranches: Branch[];
  retryAction: () => Promise<void>;
}

@Component({
  selector: 'app-hq-transfer-modal',
  imports: [TranslocoPipe, Button, Dropdown, Field, Modal],
  providers: [provideIcons({ tablerAlertTriangle })],
  templateUrl: './hq-transfer-modal.html',
})
export class HqTransferModal {
  private static nextId = 0;
  protected readonly uid = `hq-transfer-modal-${++HqTransferModal.nextId}`;

  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly session = inject(StaffSession);
  private readonly organizationWrite = inject(OrganizationWriteApi);
  private readonly modal = viewChild.required(Modal);

  readonly transferred = output<Branch>();
  readonly unavailable = output<void>();
  readonly addBranchRequested = output<string>();

  protected readonly sourceBranch = signal<Branch | null>(null);
  protected readonly companyName = signal('');
  protected readonly candidates = signal<Branch[]>([]);
  protected readonly selectedBranchId = signal('');
  protected readonly submitting = signal(false);

  protected readonly canAddBranch = computed(() => {
    const branch = this.sourceBranch();
    return branch ? this.session.canCreateBranch(branch.companyId) : false;
  });

  protected readonly canTransfer = computed(() => {
    const source = this.sourceBranch();
    const target = this.candidates().find(({ id }) => id === this.selectedBranchId());
    return Boolean(source && target && target.companyId === source.companyId &&
      target.status === 'ACTIVE' &&
      this.session.can('org.branch.manage', { companyId: source.companyId }) &&
      this.session.can('org.branch.manage', { companyId: source.companyId, branchId: source.id }) &&
      this.session.can('org.branch.manage', { companyId: target.companyId, branchId: target.id }));
  });

  private pendingRetry: (() => Promise<void>) | null = null;
  private lastKeyPayload = '';
  private lastKey = '';

  protected readonly branchOptions = computed<DropdownOption<string>[]>(() =>
    this.candidates().map((branch) => ({
      value: branch.id,
      label: `${branch.name} (${branch.code})`,
    })),
  );

  open(request: HqTransferRequest): void {
    if (!this.session.can('org.branch.manage', { companyId: request.branch.companyId }) ||
        !this.session.can('org.branch.manage', { companyId: request.branch.companyId, branchId: request.branch.id })) return;
    this.sourceBranch.set(request.branch);
    this.companyName.set(request.companyName);
    this.candidates.set(request.candidateBranches);
    this.selectedBranchId.set(request.candidateBranches[0]?.id ?? '');
    this.pendingRetry = request.retryAction;
    this.submitting.set(false);
    this.lastKeyPayload = '';
    this.lastKey = '';
    this.modal().open();
  }

  protected async confirmTransfer(): Promise<void> {
    const targetId = this.selectedBranchId();
    if (!this.canTransfer() || this.submitting()) return;

    const retry = this.pendingRetry;
    this.submitting.set(true);
    try {
      const updated = await this.organizationWrite.updateBranch(targetId, { isHeadquarters: true }, this.idempotencyKeyFor(targetId));
      this.lastKeyPayload = '';
      this.lastKey = '';
      this.notify.success(this.transloco.translate('branches.toast.saved'));
      this.transferred.emit(updated);
      this.modal().close();
      if (retry) {
        await retry();
      }
    } catch (error) {
      const message = this.resolveError(error);
      const code = errorCodeOf(error);
      if (code === 'GW.IDEM.IN_FLIGHT') this.notify.info(message);
      else if (code === 'GW.IDEM.MISMATCH') this.notify.warning(message);
      else this.notify.error(message);
      if (error instanceof ApiError && error.status === 404) {
        this.modal().close();
        this.unavailable.emit();
      }
    } finally {
      this.submitting.set(false);
    }
  }

  protected requestAddBranch(): void {
    const branch = this.sourceBranch();
    if (!branch || !this.canAddBranch() || this.submitting()) return;
    this.modal().close();
    this.addBranchRequested.emit(branch.companyId);
  }

  protected close(): void {
    if (this.submitting()) return;
    this.modal().close();
  }

  private idempotencyKeyFor(branchId: string): string {
    const signature = `${branchId}:isHeadquarters`;
    if (signature !== this.lastKeyPayload) {
      this.lastKeyPayload = signature;
      this.lastKey = newIdempotencyKey();
    }
    return this.lastKey;
  }

  private resolveError(error: unknown): string {
    return seatErrorMessage(this.transloco, error) || staffErrorMessage(error, 'staff', this.transloco, 'write');
  }
}
