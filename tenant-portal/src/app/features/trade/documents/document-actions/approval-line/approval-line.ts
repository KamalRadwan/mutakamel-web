import { Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowBackUp,
  tablerCircleCheck,
  tablerCircleX,
  tablerClock,
  tablerInfoCircle,
} from '@ng-icons/tabler-icons';
import { CurrentUser } from '../../../../../core/auth/current-user';
import { LanguageState } from '../../../../../core/i18n/language';
import { formatDate } from '../../../shared/trade-format';
import type { PurchaseOrderDetail } from '../../shared/document.model';

interface ApprovalLineView {
  icon: string;
  key: string;
  params: Record<string, string>;
}

@Component({
  selector: 'app-approval-line',
  imports: [NgIcon, TranslocoPipe],
  providers: [
    provideTranslocoScope({ scope: 'trade-shared', alias: 'tradeShared' }, { scope: 'trade-documents-actions', alias: 'tda' }),
    provideIcons({
      tablerArrowBackUp,
      tablerCircleCheck,
      tablerCircleX,
      tablerClock,
      tablerInfoCircle,
    }),
  ],
  templateUrl: './approval-line.html',
  host: { class: 'block min-w-0' },
})
export class ApprovalLine {
  private readonly lang = inject(LanguageState).current;
  private readonly currentUser = inject(CurrentUser);

  readonly order = input.required<PurchaseOrderDetail>();
  readonly submitterName = input<string | null>(null);
  readonly rejectionReason = input<string | null>(null);

  protected readonly view = computed<ApprovalLineView | null>((): ApprovalLineView | null => {
    const po = this.order();
    if (po.approvalStatus === 'NOT_REQUIRED' && !po.approvalReady) {
      return null;
    }

    switch (po.approvalStatus) {
      case 'PENDING': {
        const user = this.currentUser.user();
        const resolvedName =
          this.submitterName()?.trim() ||
          (po.submittedBy && po.submittedBy === user.email ? user.displayName : po.submittedBy) ||
          '—';
        const resolvedDate = po.submittedAt ? formatDate(po.submittedAt, this.lang()) : '—';
        return {
          icon: 'tablerClock',
          key: 'tda.approval.pending',
          params: { name: resolvedName, date: resolvedDate },
        };
      }

      case 'APPROVED':
        return {
          icon: 'tablerCircleCheck',
          key: 'tda.approval.approved',
          params: {},
        };

      case 'REJECTED': {
        const overrideReason = this.rejectionReason()?.trim();
        let lastHistoryReason = '';
        if (!overrideReason && Array.isArray(po.reasonHistory)) {
          // Newest first (trade-app documentReasonHistory); a PO rejection is recorded as PO_REJECT.
          const entry = po.reasonHistory.find((item) => item.action === 'PO_REJECT');
          if (entry) {
            lastHistoryReason = entry.reasonNote?.trim() || entry.reasonCode;
          }
        }
        const reason = overrideReason || lastHistoryReason;
        return reason
          ? {
              icon: 'tablerCircleX',
              key: 'tda.approval.rejectedWithReason',
              params: { reason },
            }
          : {
              icon: 'tablerCircleX',
              key: 'tda.approval.rejected',
              params: {},
            };
      }

      case 'WITHDRAWN':
        return {
          icon: 'tablerArrowBackUp',
          key: 'tda.approval.withdrawn',
          params: {},
        };

      case 'NOT_REQUIRED':
        return {
          icon: 'tablerInfoCircle',
          key: 'tda.approval.readyNoApproval',
          params: {},
        };
    }
  });
}
