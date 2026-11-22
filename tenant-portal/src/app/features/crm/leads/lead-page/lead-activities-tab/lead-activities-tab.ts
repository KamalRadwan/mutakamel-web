import { Component, input, output } from '@angular/core';
import { RecordActivitiesTab } from '../../../shared/record/activities-tab/record-activities-tab';

@Component({
  selector: 'app-lead-activities-tab',
  imports: [RecordActivitiesTab],
  templateUrl: './lead-activities-tab.html',
})
export class LeadActivitiesTab {
  readonly leadId = input.required<string>();
  readonly label = input.required<string>();
  readonly canEdit = input(true);
  readonly newRequest = input(0);
  readonly countChange = output<{ open: number; total: number }>();
}
