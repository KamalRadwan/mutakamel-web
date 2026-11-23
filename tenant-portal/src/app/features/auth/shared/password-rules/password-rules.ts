import { Component, computed, input, signal, type OnChanges, type OnInit } from '@angular/core';
import { provideTranslocoScope, TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCircle } from '@ng-icons/tabler-icons';
import { tablerCircleCheckFill } from '@ng-icons/tabler-icons/fill';
import { passwordChecks } from '../password-policy';

interface RuleRow {
  key: 'length' | 'lower' | 'upper' | 'digit' | 'symbol' | 'match';
  labelKey: string;
  met: boolean;
}

@Component({
  selector: 'app-auth-password-rules',
  imports: [NgIcon, TranslocoPipe],
  providers: [provideIcons({ tablerCircleCheckFill, tablerCircle })],
  viewProviders: [provideTranslocoScope('auth')],
  templateUrl: './password-rules.html',
  styleUrl: './password-rules.css',
})
export class PasswordRules implements OnChanges, OnInit {
  readonly password = input('');
  readonly confirm = input('');
  protected readonly animating = signal<ReadonlySet<RuleRow['key']>>(new Set());
  private previousMet: ReadonlySet<RuleRow['key']> | undefined;

  ngOnInit(): void {
    this.previousMet = new Set(this.rows().filter(row => row.met).map(row => row.key));
  }

  ngOnChanges(): void {
    const met = this.rows().filter(row => row.met).map(row => row.key);
    const previous = this.previousMet;
    this.animating.update(active => new Set(met.filter(key =>
      active.has(key) || previous?.has(key) === false,
    )));
    this.previousMet = new Set(met);
  }

  protected finishAnimation(key: RuleRow['key']): void {
    this.animating.update(active => {
      const remaining = new Set(active);
      remaining.delete(key);
      return remaining;
    });
  }

  protected readonly rows = computed<readonly RuleRow[]>(() => {
    const value = this.password();
    const confirmed = this.confirm();
    const checks = passwordChecks(value);
    const match = value.length > 0 && confirmed.length > 0 && value === confirmed;
    return [
      { key: 'length', labelKey: 'auth.shared.rules.length', met: checks.length },
      { key: 'lower', labelKey: 'auth.shared.rules.lower', met: checks.lower },
      { key: 'upper', labelKey: 'auth.shared.rules.upper', met: checks.upper },
      { key: 'digit', labelKey: 'auth.shared.rules.digit', met: checks.digit },
      { key: 'symbol', labelKey: 'auth.shared.rules.symbol', met: checks.symbol },
      { key: 'match', labelKey: 'auth.shared.rules.match', met: match },
    ];
  });
}
