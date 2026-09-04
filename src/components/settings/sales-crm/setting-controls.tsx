"use client";

import { IconInfoCircle } from "@tabler/icons-react";
import { Switch } from "@/components/ui/Switch";
import { cn } from "@/lib/cn";

/**
 * The three repeating shapes of the Workpex settings forms: a muted field label with its
 * information icon, a bordered radio card, and a filled toggle row.
 *
 * Local to Sales & CRM until a second settings area needs them (CLAUDE.md §7.3) — the
 * remaining five screens in this category are the likely second caller, at which point
 * these move up to the shared library rather than being copied.
 */

/**
 * A field label carrying the reference's ⓘ glyph.
 *
 * The screenshots show the icon but no open tooltip, so no copy is invented for it
 * (CLAUDE.md §16.4): it is presentational until the tooltip states are captured, and the
 * label itself is the accessible name. `hint` is the seam that turns it into a real
 * tooltip trigger the moment that copy exists.
 */
export function SettingLabel({
  children,
  htmlFor,
  className,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "flex items-center gap-1.5 text-sm text-ink-muted",
        className,
      )}
    >
      {children}
      <IconInfoCircle
        size={15}
        stroke={1.75}
        aria-hidden="true"
        className="shrink-0 text-ink-subtle"
      />
    </label>
  );
}

export interface RadioCardProps {
  name: string;
  value: string;
  checked: boolean;
  onSelect: (value: string) => void;
  children: React.ReactNode;
}

/**
 * One bordered option box. The whole card is the control — the reference makes the
 * entire box clickable, and the native radio inside keeps arrow-key groups, focus and
 * screen-reader semantics that a styled `div` would throw away.
 */
export function RadioCard({
  name,
  value,
  checked,
  onSelect,
  children,
}: RadioCardProps) {
  return (
    <label
      className={cn(
        "flex min-h-control-lg cursor-pointer items-center gap-3 rounded-control border px-4 py-2.5 transition-colors duration-(--duration-shell) ease-shell has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand has-[:focus-visible]:ring-offset-2",
        checked
          ? "border-brand bg-brand-subtle"
          : "border-hairline bg-surface hover:border-brand/40",
      )}
    >
      <span className="relative inline-flex shrink-0">
        <input
          type="radio"
          name={name}
          value={value}
          checked={checked}
          onChange={() => onSelect(value)}
          className="peer size-5 shrink-0 appearance-none rounded-full border-2 border-hairline bg-surface outline-none transition-colors duration-(--duration-shell) ease-shell checked:border-brand"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 m-auto size-2.5 rounded-full bg-brand opacity-0 peer-checked:opacity-100"
        />
      </span>
      <span
        className={cn(
          "text-sm",
          checked ? "font-medium text-ink" : "text-ink",
        )}
      >
        {children}
      </span>
    </label>
  );
}

export interface ToggleFieldProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** The Category drawer's status row carries no ⓘ; the General Settings rows do. */
  showInfo?: boolean;
}

/**
 * The reference's filled toggle row: label and ⓘ on the left, switch on the right, inside
 * a tinted box the same height as the fields beside it.
 */
export function ToggleField({
  id,
  label,
  checked,
  onChange,
  showInfo = true,
}: ToggleFieldProps) {
  return (
    <div className="flex min-h-control-lg items-center justify-between gap-3 rounded-control border border-hairline bg-canvas px-4 py-2">
      {showInfo ? (
        <SettingLabel htmlFor={id} className="cursor-pointer">
          {label}
        </SettingLabel>
      ) : (
        <label
          htmlFor={id}
          className="cursor-pointer text-sm text-ink-muted"
        >
          {label}
        </label>
      )}
      <Switch
        id={id}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </div>
  );
}
