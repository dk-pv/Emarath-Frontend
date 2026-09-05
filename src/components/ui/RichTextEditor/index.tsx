"use client";

import { useEffect, useRef, useState } from "react";
import {
  IconAlignCenter,
  IconAlignLeft,
  IconAlignRight,
  IconBold,
  IconCode,
  IconItalic,
  IconList,
  IconListNumbers,
  IconStrikethrough,
  IconUnderline,
  type Icon,
} from "@tabler/icons-react";
import { cn } from "@/lib/cn";

type Command = {
  /** The `document.execCommand` name this button runs. */
  command: string;
  icon: Icon;
  label: string;
};

/**
 * The toolbar the reference draws, in its order: bold, italic, underline, strikethrough,
 * three alignments, ordered and unordered lists, and the code control at the end.
 */
const COMMANDS: readonly Command[] = [
  { command: "bold", icon: IconBold, label: "Bold" },
  { command: "italic", icon: IconItalic, label: "Italic" },
  { command: "underline", icon: IconUnderline, label: "Underline" },
  { command: "strikeThrough", icon: IconStrikethrough, label: "Strikethrough" },
  { command: "justifyLeft", icon: IconAlignLeft, label: "Align left" },
  { command: "justifyCenter", icon: IconAlignCenter, label: "Align centre" },
  { command: "justifyRight", icon: IconAlignRight, label: "Align right" },
  {
    command: "insertOrderedList",
    icon: IconListNumbers,
    label: "Numbered list",
  },
  { command: "insertUnorderedList", icon: IconList, label: "Bulleted list" },
  { command: "formatBlock", icon: IconCode, label: "Code block" },
];

export type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  id?: string;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  "aria-describedby"?: string;
};

const BUTTON_CLASS =
  "focus-ring flex size-8 shrink-0 items-center justify-center rounded-control text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas hover:text-ink disabled:cursor-not-allowed disabled:opacity-50";

/**
 * The reference's template editor: a formatting toolbar over an editable body.
 *
 * Built on `contentEditable` and the browser's own editing commands rather than an editor
 * library. Every control the reference shows is one native command, so a dependency would
 * add a large runtime to re-implement what the platform already does — and the output is
 * real HTML the caller stores, not a textarea pretending to be rich text. `execCommand` is
 * deprecated but is the only cross-browser way to drive `contentEditable`, and remains
 * implemented everywhere; the replacement API has never shipped.
 *
 * The value is only written into the DOM when it differs from what the element already
 * holds, because assigning `innerHTML` while someone is typing would move their caret to
 * the start of the field on every keystroke.
 */
export function RichTextEditor({
  value,
  onChange,
  id,
  placeholder,
  invalid,
  disabled,
  "aria-describedby": describedBy,
}: RichTextEditorProps) {
  const body = useRef<HTMLDivElement>(null);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const node = body.current;
    if (!node || node.innerHTML === value) return;
    node.innerHTML = value;
    setEmpty(node.textContent?.trim() === "");
  }, [value]);

  const emit = () => {
    const node = body.current;
    if (!node) return;
    setEmpty(node.textContent?.trim() === "");
    onChange(node.innerHTML);
  };

  const run = (command: string) => {
    const node = body.current;
    if (!node || disabled) return;

    // The command applies to the current selection, which must be inside the body.
    node.focus();
    if (command === "formatBlock") {
      document.execCommand("formatBlock", false, "pre");
    } else {
      document.execCommand(command, false);
    }
    emit();
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-control border bg-surface transition-colors duration-(--duration-shell) ease-shell focus-within:border-brand",
        invalid ? "border-danger" : "border-hairline",
        disabled && "opacity-50",
      )}
    >
      <div
        role="toolbar"
        aria-label="Formatting"
        aria-controls={id}
        className="flex flex-wrap items-center gap-0.5 border-b border-hairline px-2 py-1.5"
      >
        {COMMANDS.map((entry) => (
          <button
            key={entry.command}
            type="button"
            // Keeps the selection in the body: a focused button would collapse it, and
            // the command would then apply to nothing.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => run(entry.command)}
            disabled={disabled}
            aria-label={entry.label}
            title={entry.label}
            className={BUTTON_CLASS}
          >
            <entry.icon size={16} stroke={2} aria-hidden="true" />
          </button>
        ))}
      </div>

      <div className="relative">
        {empty && placeholder && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-3 left-3 text-sm text-ink-subtle"
          >
            {placeholder}
          </span>
        )}
        <div
          ref={body}
          id={id}
          role="textbox"
          aria-multiline="true"
          aria-invalid={invalid ? true : undefined}
          aria-describedby={describedBy}
          contentEditable={!disabled}
          suppressContentEditableWarning
          onInput={emit}
          onBlur={emit}
          className="scrollbar-slim rich-text-body min-h-40 max-h-72 overflow-auto px-3 py-3 text-sm text-ink focus:outline-none"
        />
      </div>
    </div>
  );
}
