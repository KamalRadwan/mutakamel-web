import { Component, computed, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerLoader2 } from '@ng-icons/tabler-icons';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'default' | 'small' | 'large';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-on-brand hover:bg-brand-hover active:bg-brand-pressed',
  secondary:
    'bg-surface text-text border-border-field-hover hover:bg-surface-muted active:bg-neutral-soft',
  ghost: 'text-accent hover:bg-neutral-soft active:bg-border',
  danger: 'bg-danger text-on-danger hover:bg-danger-hover active:bg-danger-pressed',
  success: 'bg-success text-on-success hover:bg-success-hover active:bg-success-pressed',
};

const SIZES: Record<ButtonSize, string> = {
  default: 'h-btn px-12 rounded-8 text-12',
  small: 'h-btn-h-sm px-8 rounded-6 text-11',
  large: 'h-login-btn px-16 rounded-10 text-14',
};

@Component({
  selector: 'button[uiButton], a[uiButton]',
  imports: [NgIcon],
  providers: [provideIcons({ tablerLoader2 })],
  host: {
    '[class]': 'classes()',
    '[attr.disabled]': "disabled() || loading() ? '' : null",
    '[attr.aria-busy]': 'loading()',
  },
  template: `
    @if (loading()) {
      <ng-icon name="tablerLoader2" size="12" class="animate-spin" aria-hidden="true" />
    }
    <ng-content />
  `,
})
export class Button {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('default');
  readonly loading = input(false);
  readonly disabled = input(false);

  protected readonly classes = computed(() =>
    [
      'inline-flex items-center justify-center gap-4 border border-transparent font-medium whitespace-nowrap cursor-pointer',
      'transition-colors duration-fast ease-enter outline-none focus-visible:ring-3 focus-visible:ring-focus-halo-strong',
      'disabled:cursor-not-allowed disabled:bg-neutral-soft disabled:text-text-placeholder disabled:border-transparent',
      SIZES[this.size()],
      VARIANTS[this.variant()],
    ].join(' '),
  );
}
