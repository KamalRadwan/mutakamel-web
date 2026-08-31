"use client";

import { useRef, useState } from "react";
import {
  Bold,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  RemoveFormatting,
  Underline,
} from "lucide-react";
import { useDirection } from "@/i18n/useLanguage";
import { cn } from "../lib/cn";
import { iconSize } from "../lib/icons";
import { focusRing } from "../lib/variants";
import { Button } from "./Button";
import { Input } from "./Input";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover";
import { Separator } from "./Separator";
import { sanitizeRichText } from "./rich-text-sanitize";

export interface RichTextEditorLabels {
  bold: string;
  italic: string;
  underline: string;
  bulletList: string;
  orderedList: string;
  link: string;
  unlink: string;
  clearFormatting: string;
  /** Accessible name for the editable region. */
  editor: string;
  linkUrl: string;
  linkApply: string;
}

/**
 * A real component, not a render-time helper that returns JSX.
 *
 * The helper version put the ref-reading command closure in an ordinary
 * function call during render, which the React Compiler correctly refuses —
 * it cannot prove the callback is deferred. As a component, `onClick` is a JSX
 * prop and the deferral is structural.
 */
function ToolbarButton({
  label,
  icon: Icon,
  disabled,
  onRun,
}: {
  label: string;
  icon: typeof Bold;
  disabled?: boolean;
  onRun: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      // The pointer-down default is what moves focus out of the editable
      // region and collapses the selection before the command can act on it.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onRun}
      className="cursor-pointer"
    >
      <Icon className={iconSize({ size: "md" })} aria-hidden="true" />
    </Button>
  );
}

export interface RichTextEditorProps {
  /** Sanitized HTML. The caller stores exactly what `onChange` gave it. */
  value: string;
  onChange: (html: string) => void;
  labels: RichTextEditorLabels;
  placeholder?: string;
  disabled?: boolean;
  onBlur?: () => void;
  id?: string;
  invalid?: boolean;
  className?: string;
}

/**
 * The editor for `loginHtml` and email templates.
 *
 * Built on `contenteditable` plus `document.execCommand`. That API is formally
 * deprecated and there is **no replacement** — every browser still implements
 * it, and the alternative is a 200KB editor framework (ProseMirror, Lexical)
 * for two fields. The commands used are the six that are universally
 * implemented and stable; nothing here depends on a browser-specific one.
 *
 * **Everything that leaves this component is sanitized** by an allowlist, on
 * every change and on every paste. `loginHtml` renders on the login page before
 * a session exists, so the output is treated as hostile by construction rather
 * than by trust in whoever typed it.
 */
export function RichTextEditor({
  value,
  onChange,
  labels,
  placeholder,
  disabled,
  onBlur,
  id,
  invalid,
  className,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const dir = useDirection();

  function emit() {
    if (!editorRef.current) return;
    onChange(sanitizeRichText(editorRef.current.innerHTML));
  }

  function run(command: string, argument?: string) {
    if (disabled) return;
    editorRef.current?.focus();
    // Formally deprecated, universally implemented, and without a replacement
    // — see the component note above.
    document.execCommand(command, false, argument);
    emit();
  }

  function applyLink() {
    const trimmed = linkUrl.trim();
    if (trimmed) run("createLink", trimmed);
    setLinkUrl("");
    setLinkOpen(false);
  }

  return (
    <div
      className={cn(
        "flex flex-col rounded-sm border border-input bg-card",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background",
        invalid && "border-destructive",
        disabled && "opacity-50",
        className,
      )}
    >
      <div
        role="toolbar"
        aria-label={labels.editor}
        aria-orientation="horizontal"
        className="flex flex-wrap items-center gap-0.5 border-b border-border p-1"
      >
        <ToolbarButton label={labels.bold} icon={Bold} disabled={disabled} onRun={() => run("bold")} />
        <ToolbarButton label={labels.italic} icon={Italic} disabled={disabled} onRun={() => run("italic")} />
        <ToolbarButton
          label={labels.underline}
          icon={Underline}
          disabled={disabled}
          onRun={() => run("underline")}
        />
        <Separator orientation="vertical" className="mx-1 h-5" />
        <ToolbarButton
          label={labels.bulletList}
          icon={List}
          disabled={disabled}
          onRun={() => run("insertUnorderedList")}
        />
        <ToolbarButton
          label={labels.orderedList}
          icon={ListOrdered}
          disabled={disabled}
          onRun={() => run("insertOrderedList")}
        />
        <Separator orientation="vertical" className="mx-1 h-5" />

        <Popover open={linkOpen} onOpenChange={(next) => setLinkOpen(!disabled && next)}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              aria-label={labels.link}
              title={labels.link}
              disabled={disabled}
              onMouseDown={(event) => event.preventDefault()}
              className="cursor-pointer"
            >
              <Link2 className={iconSize({ size: "md" })} aria-hidden="true" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="flex w-72 items-center gap-1.5 p-2">
            <Input
              size="sm"
              value={linkUrl}
              autoFocus
              inputMode="url"
              aria-label={labels.linkUrl}
              placeholder={labels.linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applyLink();
                }
              }}
            />
            <Button size="sm" onClick={applyLink} className="shrink-0 cursor-pointer">
              {labels.linkApply}
            </Button>
          </PopoverContent>
        </Popover>

        <ToolbarButton
          label={labels.unlink}
          icon={Link2Off}
          disabled={disabled}
          onRun={() => run("unlink")}
        />
        <ToolbarButton
          label={labels.clearFormatting}
          icon={RemoveFormatting}
          disabled={disabled}
          onRun={() => run("removeFormat")}
        />
      </div>

      <div
        ref={editorRef}
        id={id}
        role="textbox"
        aria-multiline="true"
        aria-label={labels.editor}
        aria-invalid={invalid || undefined}
        contentEditable={!disabled}
        suppressContentEditableWarning
        dir={dir}
        data-placeholder={placeholder}
        onInput={emit}
        onBlur={onBlur}
        onPaste={(event) => {
          // The default paste inserts the clipboard's own markup — styles,
          // classes, and whatever the source page carried. Sanitizing after the
          // fact would still have run it through the DOM once.
          event.preventDefault();
          const html = event.clipboardData.getData("text/html");
          const text = event.clipboardData.getData("text/plain");
          run("insertHTML", html ? sanitizeRichText(html) : text);
        }}
        // dangerouslySetInnerHTML is React's only way to seed a contenteditable
        // region, and it is applied to sanitizeRichText's output. It is set
        // once from the initial value: re-setting it on every keystroke would
        // reset the caret to the start of the field on every character.
        dangerouslySetInnerHTML={{ __html: sanitizeRichText(value) }}
        className={cn(
          "min-h-32 overflow-y-auto p-2 text-sm text-foreground outline-none",
          "[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:ps-5 [&_ol]:ps-5",
          "[&_a]:text-brand-700 [&_a]:underline dark:[&_a]:text-brand-300",
          "empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]",
          focusRing,
        )}
      />
    </div>
  );
}
