import { Component, computed, inject, input, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { FormField, form, readonly } from '@angular/forms/signals';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowDown,
  tablerArrowUp,
  tablerBold,
  tablerFileText,
  tablerItalic,
  tablerLink,
  tablerPlus,
  tablerTrash,
  tablerTypography,
  tablerUnderline,
  tablerX,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../../core/i18n/language';
import { Button } from '../../../../../../shared/ui/button/button';
import { Dropdown, DropdownOption } from '../../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../../shared/ui/field/field';
import { Modal } from '../../../../../../shared/ui/modal/modal';
import type {
  TemplateRichTextBlock,
  TemplateRichTextInline,
  TemplateRichTextListItem,
  TemplateRichTextMark,
  TemplateRichTextNode,
  TemplateSafeLink,
  TemplateTextAlign,
  TemplateTextNode,
} from '../../../templates.model';
import { DesignerState } from '../../designer-state';
import type { FieldPickOptions, FieldPickResult } from '../field-picker/field-picker';

type BlockKindOption =
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'heading4'
  | 'heading5'
  | 'heading6'
  | 'bulletList'
  | 'orderedList';

interface EditableInline {
  uid: string;
  text: string;
  inline: TemplateRichTextInline;
}

interface EditableListItem {
  uid: string;
  inlines: EditableInline[];
}

interface EditableBlock {
  uid: string;
  kind: BlockKindOption;
  textAlign?: TemplateTextAlign;
  inlines: EditableInline[];
  items: EditableListItem[];
}

const MAX_PLAIN_CHARS = 20000;
const MAX_RICH_BLOCKS = 2000;
const MAX_INLINES_PER_BLOCK = 500;
const MAX_RICH_CHARS = 100000;

let nextEditUid = 1;
function uid(): string {
  return `rt-${nextEditUid++}`;
}

function emptyEditableText(): EditableInline {
  return { uid: uid(), text: '', inline: { type: 'text', text: '' } };
}

function toEditableInlines(raw: readonly TemplateRichTextInline[] | undefined): EditableInline[] {
  if (!raw || raw.length === 0) return [emptyEditableText()];
  return raw.map((inline) => ({
    uid: uid(),
    text: inline.type === 'text' ? inline.text : '',
    inline: structuredClone(inline),
  }));
}

function toEditableBlocks(content: readonly TemplateRichTextBlock[]): EditableBlock[] {
  return content.map((block) => {
    if (block.type === 'paragraph') {
      return {
        uid: uid(),
        kind: 'paragraph',
        textAlign: block.attrs?.textAlign,
        inlines: toEditableInlines(block.content),
        items: [],
      };
    }
    if (block.type === 'heading') {
      return {
        uid: uid(),
        kind: `heading${block.attrs.level}` as BlockKindOption,
        textAlign: block.attrs.textAlign,
        inlines: toEditableInlines(block.content),
        items: [],
      };
    }
    return {
      uid: uid(),
      kind: block.type,
      inlines: [],
      items: block.content.map((li) => ({
        uid: uid(),
        inlines: toEditableInlines(li.content[0]?.content),
      })),
    };
  });
}

function countInlinesChars(inlines: readonly EditableInline[]): number {
  let total = 0;
  for (const item of inlines) {
    if (item.inline.type === 'text') total += item.text.length;
  }
  return total;
}

@Component({
  selector: 'app-tpl-text-content-modal',
  imports: [FormField, NgIcon, TranslocoPipe, Button, Dropdown, Field, Modal],
  providers: [
    provideIcons({
      tablerArrowDown,
      tablerArrowUp,
      tablerBold,
      tablerFileText,
      tablerItalic,
      tablerLink,
      tablerPlus,
      tablerTrash,
      tablerTypography,
      tablerUnderline,
      tablerX,
    }),
  ],
  templateUrl: './text-content-modal.html',
  host: { class: 'contents' },
})
export class TextContentModal {
  protected readonly state = inject(DesignerState);
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageState).current;
  private readonly i18n = translationEvents(this.transloco);

  readonly pickField = input.required<(options: FieldPickOptions) => Promise<FieldPickResult | null>>();

  private readonly modal = viewChild.required<Modal>('textModal');

  private readonly targetNodeId = signal<string | null>(null);
  protected readonly mode = signal<'plain' | 'rich'>('plain');

  protected readonly plainModel = signal({ text: '' });
  protected readonly plainForm = form(this.plainModel, (p) => {
    readonly(p.text, () => this.state.readOnly());
  });

  protected readonly richModel = signal<{ blocks: EditableBlock[] }>({ blocks: [] });
  protected readonly richForm = form(this.richModel, (p) => {
    readonly(p, () => this.state.readOnly());
  });
  protected readonly blocks = computed(() => this.richModel().blocks);

  open(nodeId: string): void {
    const node = this.state.document()?.nodes[nodeId];
    if (!node) return;
    if (node.type === 'text') {
      this.targetNodeId.set(nodeId);
      this.mode.set('plain');
      this.plainModel.set({ text: node.props.text });
      this.modal().open();
      return;
    }
    if (node.type === 'richText') {
      this.targetNodeId.set(nodeId);
      this.mode.set('rich');
      this.richModel.set({ blocks: toEditableBlocks(node.props.document.content) });
      this.modal().open();
    }
  }

  protected readonly modalSize = computed(() => (this.mode() === 'rich' ? 'wide' : 'form'));
  protected readonly modalIcon = computed(() => (this.mode() === 'rich' ? 'tablerFileText' : 'tablerTypography'));
  protected readonly modalTitle = computed(() => {
    this.language();
    this.i18n();
    return this.transloco.translate(
      this.mode() === 'rich' ? 'tplFields.textContent.richTitle' : 'tplFields.textContent.plainTitle',
    );
  });

  protected readonly blockTypeOptions = computed<DropdownOption<BlockKindOption>[]>(() => {
    this.language();
    this.i18n();
    const kinds: BlockKindOption[] = [
      'paragraph',
      'heading1',
      'heading2',
      'heading3',
      'heading4',
      'heading5',
      'heading6',
      'bulletList',
      'orderedList',
    ];
    return kinds.map((k) => ({
      value: k,
      label: this.transloco.translate(`tplFields.textContent.types.${k}`),
    }));
  });

  protected readonly plainError = computed<string | null>(() => {
    this.language();
    this.i18n();
    if (this.mode() !== 'plain') return null;
    return this.plainModel().text.length > MAX_PLAIN_CHARS
      ? this.transloco.translate('tplFields.textContent.plainTooLong')
      : null;
  });

  protected readonly totalRichChars = computed(() => {
    let sum = 0;
    for (const block of this.blocks()) {
      if (block.kind === 'bulletList' || block.kind === 'orderedList') {
        for (const li of block.items) sum += countInlinesChars(li.inlines);
      } else {
        sum += countInlinesChars(block.inlines);
      }
    }
    return sum;
  });

  protected readonly richOverLimit = computed(() => {
    const list = this.blocks();
    if (list.length > MAX_RICH_BLOCKS) return true;
    if (this.totalRichChars() > MAX_RICH_CHARS) return true;
    for (const b of list) {
      if (b.kind === 'bulletList' || b.kind === 'orderedList') {
        if (b.items.some((li) => li.inlines.length > MAX_INLINES_PER_BLOCK)) return true;
      } else if (b.inlines.length > MAX_INLINES_PER_BLOCK) {
        return true;
      }
    }
    return false;
  });

  protected readonly richCharCountNumber = computed(() => {
    return this.totalRichChars().toLocaleString(this.language() === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US');
  });

  protected readonly canApply = computed(() => {
    if (this.state.readOnly()) return false;
    if (this.mode() === 'plain') return !this.plainError();
    return !this.richOverLimit() && this.blocks().length > 0;
  });

  protected blockFieldError(blockIdx: number, block: EditableBlock): string | null {
    this.language();
    this.i18n();
    if (blockIdx === 0 && this.blocks().length > MAX_RICH_BLOCKS) {
      return this.transloco.translate('tplFields.textContent.blocksLimitError');
    }
    const overInlines = this.isListBlock(block)
      ? block.items.some((li) => li.inlines.length > MAX_INLINES_PER_BLOCK)
      : block.inlines.length > MAX_INLINES_PER_BLOCK;
    if (overInlines) {
      return this.transloco.translate('tplFields.textContent.inlinesLimitError');
    }
    if (this.totalRichChars() > MAX_RICH_CHARS && !this.blockHasTextInput(block)) {
      return this.transloco.translate('tplFields.textContent.charsLimitError');
    }
    return null;
  }

  protected inlineCharError(): string | null {
    this.language();
    this.i18n();
    return this.totalRichChars() > MAX_RICH_CHARS
      ? this.transloco.translate('tplFields.textContent.charsLimitError')
      : null;
  }

  private blockHasTextInput(block: EditableBlock): boolean {
    if (this.isListBlock(block)) {
      return block.items.some((li) => li.inlines.some((i) => i.inline.type === 'text'));
    }
    return block.inlines.some((i) => i.inline.type === 'text');
  }

  protected isListBlock(block: EditableBlock): boolean {
    return block.kind === 'bulletList' || block.kind === 'orderedList';
  }

  protected hasMark(inline: TemplateRichTextInline, markType: 'bold' | 'italic' | 'underline' | 'link'): boolean {
    if (inline.type !== 'text' || !inline.marks) return false;
    return inline.marks.some((m) => m.type === markType);
  }

  protected linkHref(inline: TemplateRichTextInline): string | null {
    if (inline.type !== 'text' || !inline.marks) return null;
    const found = inline.marks.find(
      (m): m is { type: 'link'; attrs: TemplateSafeLink } => m.type === 'link',
    );
    if (!found) return null;
    return found.attrs.source === 'LITERAL' ? found.attrs.href : found.attrs.binding.path;
  }

  protected changeBlockKind(blockIdx: number, nextKind: BlockKindOption): void {
    if (this.state.readOnly()) return;
    this.updateBlocks((list) =>
      list.map((b, idx) => {
        if (idx !== blockIdx || b.kind === nextKind) return b;
        const wasList = b.kind === 'bulletList' || b.kind === 'orderedList';
        const willBeList = nextKind === 'bulletList' || nextKind === 'orderedList';
        if (wasList && !willBeList) {
          const flattened = b.items.flatMap((li) => li.inlines);
          return {
            ...b,
            kind: nextKind,
            inlines: flattened.length > 0 ? flattened : [emptyEditableText()],
            items: [],
          };
        }
        if (!wasList && willBeList) {
          return {
            ...b,
            kind: nextKind,
            inlines: [],
            items: [{ uid: uid(), inlines: b.inlines.length > 0 ? b.inlines : [emptyEditableText()] }],
          };
        }
        return { ...b, kind: nextKind };
      }),
    );
  }

  protected moveBlock(blockIdx: number, delta: -1 | 1): void {
    if (this.state.readOnly()) return;
    this.updateBlocks((list) => {
      const target = blockIdx + delta;
      if (target < 0 || target >= list.length) return list;
      const next = [...list];
      const [item] = next.splice(blockIdx, 1);
      next.splice(target, 0, item);
      return next;
    });
  }

  protected deleteBlock(blockIdx: number): void {
    if (this.state.readOnly() || this.blocks().length <= 1) return;
    this.updateBlocks((list) => list.filter((_, i) => i !== blockIdx));
  }

  protected addBlock(kind: 'paragraph' | 'heading1' | 'bulletList'): void {
    if (this.state.readOnly() || this.blocks().length >= MAX_RICH_BLOCKS) return;
    const newBlock: EditableBlock =
      kind === 'bulletList'
        ? {
            uid: uid(),
            kind,
            inlines: [],
            items: [{ uid: uid(), inlines: [emptyEditableText()] }],
          }
        : {
            uid: uid(),
            kind,
            inlines: [emptyEditableText()],
            items: [],
          };
    this.updateBlocks((list) => [...list, newBlock]);
  }

  protected toggleMark(
    blockIdx: number,
    listItemIdx: number | null,
    inlineIdx: number,
    markType: 'bold' | 'italic' | 'underline',
  ): void {
    if (this.state.readOnly()) return;
    this.mutateInlineList(blockIdx, listItemIdx, (inlines) =>
      inlines.map((entry, idx) => {
        if (idx !== inlineIdx || entry.inline.type !== 'text') return entry;
        const current = entry.inline.marks ?? [];
        const exists = current.some((m) => m.type === markType);
        const nextMarks: TemplateRichTextMark[] = exists
          ? current.filter((m) => m.type !== markType)
          : [...current, { type: markType }].slice(0, 4);
        return {
          ...entry,
          inline: {
            ...entry.inline,
            marks: nextMarks.length > 0 ? nextMarks : undefined,
          },
        };
      }),
    );
  }

  protected addInlineText(blockIdx: number, listItemIdx: number | null): void {
    if (this.state.readOnly()) return;
    this.mutateInlineList(blockIdx, listItemIdx, (inlines) =>
      inlines.length >= MAX_INLINES_PER_BLOCK ? inlines : [...inlines, emptyEditableText()],
    );
  }

  protected addInlineBreak(blockIdx: number, listItemIdx: number | null): void {
    if (this.state.readOnly()) return;
    this.mutateInlineList(blockIdx, listItemIdx, (inlines) =>
      inlines.length >= MAX_INLINES_PER_BLOCK
        ? inlines
        : [...inlines, { uid: uid(), text: '', inline: { type: 'hardBreak' } }],
    );
  }

  protected async addInlineField(blockIdx: number, listItemIdx: number | null): Promise<void> {
    if (this.state.readOnly()) return;
    const picked = await this.pickField()({ purpose: 'BINDING', accept: 'SCALAR' });
    if (!picked?.binding) return;
    const binding = picked.binding;
    this.mutateInlineList(blockIdx, listItemIdx, (inlines) =>
      inlines.length >= MAX_INLINES_PER_BLOCK
        ? inlines
        : [...inlines, { uid: uid(), text: '', inline: { type: 'variable', attrs: { binding } } }],
    );
  }

  protected async editVariableInline(
    blockIdx: number,
    listItemIdx: number | null,
    inlineIdx: number,
  ): Promise<void> {
    if (this.state.readOnly()) return;
    const block = this.blocks()[blockIdx];
    const inlines = listItemIdx !== null ? block?.items[listItemIdx]?.inlines : block?.inlines;
    const entry = inlines?.[inlineIdx];
    if (!entry || entry.inline.type !== 'variable') return;

    const picked = await this.pickField()({
      purpose: 'BINDING',
      accept: 'SCALAR',
      initial: entry.inline.attrs.binding,
    });
    if (!picked?.binding) return;
    const nextBinding = picked.binding;
    this.mutateInlineList(blockIdx, listItemIdx, (list) =>
      list.map((item, idx) =>
        idx === inlineIdx ? { ...item, inline: { type: 'variable', attrs: { binding: nextBinding } } } : item,
      ),
    );
  }

  protected removeInline(blockIdx: number, listItemIdx: number | null, inlineIdx: number): void {
    if (this.state.readOnly()) return;
    this.mutateInlineList(blockIdx, listItemIdx, (inlines) => {
      const filtered = inlines.filter((_, i) => i !== inlineIdx);
      return filtered.length > 0 ? filtered : [emptyEditableText()];
    });
  }

  protected addListItem(blockIdx: number): void {
    if (this.state.readOnly()) return;
    this.updateBlocks((list) =>
      list.map((b, i) =>
        i === blockIdx && b.items.length < 200
          ? { ...b, items: [...b.items, { uid: uid(), inlines: [emptyEditableText()] }] }
          : b,
      ),
    );
  }

  protected removeListItem(blockIdx: number, itemIdx: number): void {
    if (this.state.readOnly()) return;
    this.updateBlocks((list) =>
      list.map((b, i) => {
        if (i !== blockIdx || b.items.length <= 1) return b;
        return { ...b, items: b.items.filter((_, idx) => idx !== itemIdx) };
      }),
    );
  }

  protected apply(): void {
    const id = this.targetNodeId();
    if (!id || !this.canApply()) return;

    if (this.mode() === 'plain') {
      const patch: Partial<TemplateTextNode> = { props: { text: this.plainModel().text } };
      this.state.updateNode(id, patch, 'editTextContent');
      this.modal().close();
      return;
    }

    const content: TemplateRichTextBlock[] = this.blocks().map((b): TemplateRichTextBlock => {
      const cleanInlines = (list: readonly EditableInline[]): TemplateRichTextInline[] =>
        list
          .map((e): TemplateRichTextInline =>
            e.inline.type === 'text' ? { ...e.inline, text: e.text } : e.inline,
          )
          .filter((inl) => inl.type !== 'text' || inl.text.length > 0 || (inl.marks && inl.marks.length > 0));

      if (b.kind === 'paragraph') {
        const c = cleanInlines(b.inlines);
        return {
          type: 'paragraph',
          ...(b.textAlign ? { attrs: { textAlign: b.textAlign } } : {}),
          ...(c.length > 0 ? { content: c } : {}),
        };
      }
      if (b.kind.startsWith('heading')) {
        const level = Number(b.kind.slice('heading'.length)) as 1 | 2 | 3 | 4 | 5 | 6;
        const c = cleanInlines(b.inlines);
        return {
          type: 'heading',
          attrs: { level, ...(b.textAlign ? { textAlign: b.textAlign } : {}) },
          ...(c.length > 0 ? { content: c } : {}),
        };
      }
      return {
        type: b.kind === 'orderedList' ? 'orderedList' : 'bulletList',
        content: b.items.map((li): TemplateRichTextListItem => {
          const c = cleanInlines(li.inlines);
          return {
            type: 'listItem',
            content: [{ type: 'paragraph', ...(c.length > 0 ? { content: c } : {}) }],
          };
        }),
      };
    });

    const patch: Partial<TemplateRichTextNode> = { props: { document: { type: 'doc', content } } };
    this.state.updateNode(id, patch, 'editTextContent');
    this.modal().close();
  }

  protected cancel(): void {
    this.modal().close();
  }

  private updateBlocks(fn: (list: EditableBlock[]) => EditableBlock[]): void {
    this.richModel.update((m) => ({ blocks: fn(m.blocks) }));
  }

  private mutateInlineList(
    blockIdx: number,
    listItemIdx: number | null,
    fn: (inlines: EditableInline[]) => EditableInline[],
  ): void {
    this.updateBlocks((list) =>
      list.map((b, bIdx) => {
        if (bIdx !== blockIdx) return b;
        if (listItemIdx !== null) {
          return {
            ...b,
            items: b.items.map((li, liIdx) => (liIdx === listItemIdx ? { ...li, inlines: fn(li.inlines) } : li)),
          };
        }
        return { ...b, inlines: fn(b.inlines) };
      }),
    );
  }
}
