import { Component, computed, inject, input, signal, viewChild } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerBraces, tablerClick, tablerLink } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../../core/i18n/language';
import { Button } from '../../../../../../shared/ui/button/button';
import { Dropdown, DropdownOption } from '../../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../../shared/ui/field/field';
import { Modal } from '../../../../../../shared/ui/modal/modal';
import { Segmented, SegmentedOption } from '../../../../../../shared/ui/segmented/segmented';
import { Switch } from '../../../../../../shared/ui/switch/switch';
import type {
  TemplateBinding,
  TemplateButtonNode,
  TemplateLinkNode,
  TemplateSafeLink,
  TemplateSafeLinkTarget,
  TemplateTextTemplate,
} from '../../../templates.model';
import { DesignerState } from '../../designer-state';
import {
  LINK_LABEL_MAX_CHARS,
  SAFE_HREF_MAX_CHARS,
  TEXT_TEMPLATE_MAX_SEGMENTS,
  countTextTemplateChars,
  countTextTemplateSegments,
  hasNonEmptyTextTemplate,
  isValidSafeHttpsUrl,
  normalizeTextTemplate,
} from '../email-validation';
import { TextTemplateInput } from '../text-template-input/text-template-input';

let nextModalId = 0;

@Component({
  selector: 'app-tpl-link-modal',
  imports: [
    NgIcon,
    TranslocoPipe,
    Button,
    Dropdown,
    Field,
    Modal,
    Segmented,
    Switch,
    TextTemplateInput,
  ],
  providers: [provideIcons({ tablerBraces, tablerClick, tablerLink })],
  templateUrl: './link-modal.html',
})
export class LinkModal {
  protected readonly uid = `tpl-link-modal-${++nextModalId}`;

  protected readonly state = inject(DesignerState);
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageState).current;

  private readonly modal = viewChild.required<Modal>('modal');

  readonly pickScalarField = input.required<(initial?: TemplateBinding) => Promise<TemplateBinding | null>>();
  readonly pickUrlField = input.required<(initial?: TemplateBinding) => Promise<TemplateBinding | null>>();
  readonly busy = input(false);

  protected readonly labelMaxChars = LINK_LABEL_MAX_CHARS;
  protected readonly hrefMaxChars = SAFE_HREF_MAX_CHARS;

  protected readonly mode = signal<'insert' | 'edit'>('insert');
  protected readonly nodeKind = signal<'link' | 'button'>('link');
  private readonly editingNodeId = signal<string | null>(null);

  protected readonly label = signal<TemplateTextTemplate | null>(null);
  protected readonly linkSource = signal<'LITERAL' | 'BINDING'>('LITERAL');
  protected readonly href = signal('');
  protected readonly urlBinding = signal<TemplateBinding | null>(null);
  protected readonly target = signal<TemplateSafeLinkTarget>('SAME_WINDOW');
  protected readonly fullWidthOnMobile = signal(false);

  private readonly attemptedSubmit = signal(false);
  private readonly hrefTouched = signal(false);
  private readonly pickingUrl = signal(false);

  protected readonly readOnly = computed(() => this.state.readOnly());
  protected readonly schemaFailed = computed(() => this.state.schemaFailed());

  protected readonly sourceOptions = computed<SegmentedOption[]>(() => {
    this.language();
    const disabled = this.readOnly();
    return [
      { value: 'LITERAL', label: this.transloco.translate('tplEmail.target.web'), disabled },
      { value: 'BINDING', label: this.transloco.translate('tplEmail.target.field'), disabled },
    ];
  });

  protected readonly targetOptions = computed<DropdownOption<TemplateSafeLinkTarget>[]>(() => {
    this.language();
    return [
      { value: 'SAME_WINDOW', label: this.transloco.translate('tplEmail.open.SAME_WINDOW') },
      { value: 'NEW_WINDOW', label: this.transloco.translate('tplEmail.open.NEW_WINDOW') },
    ];
  });

  protected readonly selectedTargetLabel = computed(
    () => this.targetOptions().find((opt) => opt.value === this.target())?.label ?? '',
  );

  protected readonly labelError = computed(() => {
    this.language();
    const val = this.label();
    if (countTextTemplateChars(val) > LINK_LABEL_MAX_CHARS) {
      return this.transloco.translate('tplEmail.charsMax', { max: LINK_LABEL_MAX_CHARS });
    }
    if (countTextTemplateSegments(val) > TEXT_TEMPLATE_MAX_SEGMENTS) {
      return this.transloco.translate('tplEmail.segmentsMax', { max: TEXT_TEMPLATE_MAX_SEGMENTS });
    }
    if (this.attemptedSubmit() && !hasNonEmptyTextTemplate(val)) {
      return this.transloco.translate('tplEmail.label.required');
    }
    return null;
  });

  protected readonly hrefError = computed(() => {
    this.language();
    if (this.linkSource() !== 'LITERAL') return null;
    if (!this.attemptedSubmit() && !this.hrefTouched()) return null;
    return isValidSafeHttpsUrl(this.href())
      ? null
      : this.transloco.translate('tplEmail.href.invalid');
  });

  protected readonly bindingError = computed(() => {
    this.language();
    if (this.linkSource() !== 'BINDING') return null;
    if (!this.attemptedSubmit()) return null;
    return this.urlBinding() ? null : this.transloco.translate('tplEmail.fieldUrl.required');
  });

  openInsert(kind: 'link' | 'button'): void {
    this.mode.set('insert');
    this.nodeKind.set(kind);
    this.editingNodeId.set(null);
    this.label.set(null);
    this.linkSource.set('LITERAL');
    this.href.set('');
    this.urlBinding.set(null);
    this.target.set('SAME_WINDOW');
    this.fullWidthOnMobile.set(false);
    this.attemptedSubmit.set(false);
    this.hrefTouched.set(false);
    this.modal().open();
  }

  openEdit(node: TemplateLinkNode | TemplateButtonNode): void {
    this.mode.set('edit');
    this.nodeKind.set(node.type);
    this.editingNodeId.set(node.id);
    this.label.set(structuredClone(node.props.label));
    this.linkSource.set(node.props.link.source);
    if (node.props.link.source === 'LITERAL') {
      this.href.set(node.props.link.href);
      this.urlBinding.set(null);
    } else {
      this.href.set('');
      this.urlBinding.set(structuredClone(node.props.link.binding));
    }
    this.target.set(node.props.link.target);
    this.fullWidthOnMobile.set(node.type === 'button' ? node.props.fullWidthOnMobile : false);
    this.attemptedSubmit.set(false);
    this.hrefTouched.set(false);
    this.modal().open();
  }

  close(): void {
    this.modal().close();
  }

  protected onSourceChange(value: string | null): void {
    if (this.readOnly()) return;
    if (value === 'LITERAL' || value === 'BINDING') {
      this.linkSource.set(value);
    }
  }

  protected onHrefInput(event: Event): void {
    if (this.readOnly()) return;
    this.href.set((event.target as HTMLInputElement).value);
  }

  protected onHrefBlur(): void {
    this.hrefTouched.set(true);
  }

  protected async onPickUrlField(): Promise<void> {
    if (this.readOnly() || this.schemaFailed() || this.pickingUrl()) return;
    this.pickingUrl.set(true);
    try {
      const picked = await this.pickUrlField()(
        this.urlBinding() ? structuredClone(this.urlBinding()!) : undefined,
      );
      if (picked) {
        this.urlBinding.set(structuredClone(picked));
      }
    } finally {
      this.pickingUrl.set(false);
    }
  }

  protected submit(event?: Event): void {
    event?.preventDefault();
    if (this.readOnly()) return;

    this.attemptedSubmit.set(true);

    if (this.labelError() || this.hrefError() || this.bindingError()) {
      return;
    }

    const normalizedLabel = normalizeTextTemplate(this.label(), true);
    if (!normalizedLabel || !hasNonEmptyTextTemplate(normalizedLabel)) {
      return;
    }

    let safeLink: TemplateSafeLink;
    if (this.linkSource() === 'LITERAL') {
      const trimmedHref = this.href().trim();
      if (!isValidSafeHttpsUrl(trimmedHref)) return;
      safeLink = { source: 'LITERAL', href: trimmedHref, target: this.target() };
    } else {
      const binding = this.urlBinding();
      if (!binding) return;
      safeLink = { source: 'BINDING', binding: structuredClone(binding), target: this.target() };
    }

    if (this.mode() === 'insert') {
      if (this.nodeKind() === 'button') {
        if (this.state.channel() !== 'EMAIL') return;
        this.state.insertNode({
          type: 'button',
          props: {
            label: normalizedLabel,
            link: safeLink,
            fullWidthOnMobile: this.fullWidthOnMobile(),
          },
        });
      } else {
        this.state.insertNode({
          type: 'link',
          props: {
            label: normalizedLabel,
            link: safeLink,
          },
        });
      }
    } else {
      const id = this.editingNodeId();
      if (!id) return;
      if (this.nodeKind() === 'button') {
        this.state.updateNode(
          id,
          {
            props: {
              label: normalizedLabel,
              link: safeLink,
              fullWidthOnMobile: this.fullWidthOnMobile(),
            },
          },
          'editLink',
        );
      } else {
        this.state.updateNode(
          id,
          {
            props: {
              label: normalizedLabel,
              link: safeLink,
            },
          },
          'editLink',
        );
      }
    }

    this.modal().close();
  }
}
