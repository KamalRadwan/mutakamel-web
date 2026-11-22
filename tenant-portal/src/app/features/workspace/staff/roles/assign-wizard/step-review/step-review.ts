import { Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { PluralKeyPipe } from '../../../../../../core/i18n/plural';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerInfoCircle, tablerMapPin } from '@ng-icons/tabler-icons';
import { Button } from '../../../../../../shared/ui/button/button';

export interface BranchReviewItem {
  branchId: string;
  branchName: string;
  companyName: string;
  chip: string;
  status: 'existing' | 'new' | 'removed';
  permissionCount: number;
  added: number;
  removed: number;
  unchanged: number;
}

@Component({
  selector: 'app-assign-step-review',
  imports: [NgIcon, TranslocoPipe, PluralKeyPipe, Button],
  providers: [provideIcons({ tablerInfoCircle, tablerMapPin })],
  templateUrl: './step-review.html',
  host: { class: 'flex flex-col gap-10' },
})
export class AssignStepReview {
  readonly items = input.required<BranchReviewItem[]>();
  readonly holderCount = input(0);
  readonly readonly = input(false);

  readonly editBranch = output<string>();
}
