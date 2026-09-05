"use client";

import { useRef, useState } from "react";
import {
  IconCloudUpload,
  IconColorPicker,
  IconEye,
  IconEyeOff,
  IconInfoCircle,
  IconX,
} from "@tabler/icons-react";
import { Input, type InputProps } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/cn";

/** The reference's profile-picture rule. */
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const AVATAR_TYPES = new Set(["image/png", "image/jpeg"]);

/** A password field with the reference's reveal eye. */
export function PasswordInput({
  className,
  ...props
}: Omit<InputProps, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative block w-full">
      <Input
        type={visible ? "text" : "password"}
        className={cn("pr-10", className)}
        {...props}
      />
      <button
        type="button"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
        className="focus-ring absolute top-1/2 right-2 -translate-y-1/2 rounded-control p-1 text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:text-ink"
      >
        {visible ? (
          <IconEyeOff size={18} stroke={1.75} aria-hidden="true" />
        ) : (
          <IconEye size={18} stroke={1.75} aria-hidden="true" />
        )}
      </button>
    </span>
  );
}

/** A field label's ⓘ — content is Emarath's factual behaviour, never invented Workpex copy. */
export function InfoHint({ label }: { label: string }) {
  return (
    <Tooltip content={label} portal>
      <span
        tabIndex={0}
        aria-label={label}
        className="focus-ring inline-flex rounded-full text-ink-subtle"
      >
        <IconInfoCircle size={15} stroke={1.75} aria-hidden="true" />
      </span>
    </Tooltip>
  );
}

/**
 * One Permissions & Tracking row (and step 2's Status row): a light rounded bar with
 * the label, an optional ⓘ, and the switch on the right — the reference's row shape.
 */
export function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  id,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  id: string;
}) {
  return (
    <div className="flex h-12 items-center justify-between gap-3 rounded-control bg-canvas px-4">
      <span className="flex min-w-0 items-center gap-2 text-sm text-ink">
        <label htmlFor={id} className="truncate">
          {label}
        </label>
        {hint && <InfoHint label={hint} />}
      </span>
      <Switch
        id={id}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </div>
  );
}

/**
 * The Color Code field: a coloured swatch button opening the platform colour picker,
 * with the picked hex shown beside it. The reference's popover picker is the browser's
 * own here — native over a hand-rolled picker; the stored value is the same #RRGGBB.
 */
export function ColorCodeField({
  value,
  onChange,
  id,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  id: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="relative flex h-control-md items-center overflow-hidden rounded-control border border-hairline bg-surface">
      <button
        type="button"
        aria-label="Pick button color"
        onClick={() => inputRef.current?.click()}
        className="focus-ring flex h-full w-12 shrink-0 items-center justify-center text-white"
        style={{ backgroundColor: value ?? "var(--color-brand)" }}
      >
        <IconColorPicker size={16} stroke={1.75} aria-hidden="true" />
      </button>
      {/* Overlays the swatch rather than being sr-only. sr-only is `position:absolute`,
          which drops the input at a fixed document position (measured y=931 in every
          viewport) so the browser anchored its colour popup hundreds of pixels from the
          field — fully off-screen below 1440px. Anchoring it to the swatch keeps the
          popup attached and lets the browser flip it near the viewport edge. */}
      <input
        ref={inputRef}
        id={id}
        type="color"
        value={value ?? "#65ca7b"}
        onChange={(event) => onChange(event.target.value)}
        className="pointer-events-none absolute left-0 top-0 h-full w-12 opacity-0"
        tabIndex={-1}
      />
      <span
        className={cn(
          "min-w-0 flex-1 truncate px-3 text-sm",
          value ? "text-ink" : "text-ink-subtle",
        )}
      >
        {value ?? "Pick Button Color"}
      </span>
      {value && (
        <button
          type="button"
          aria-label="Clear color"
          onClick={() => onChange(null)}
          className="focus-ring mr-2 rounded-control p-1 text-ink-muted hover:text-ink"
        >
          <IconX size={14} stroke={2} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/**
 * The Profile Picture dropzone: dashed border, cloud glyph, "Drop your image here or
 * click to browse", PNG/JPG up to 5MB — validated here so a bad file never reaches the
 * submit. Selecting shows a preview; the file itself uploads after the account exists.
 */
export function AvatarDropzone({
  file,
  existingUrl,
  onChange,
  onError,
}: {
  file: File | null;
  /** A previously stored picture, shown until a new file replaces it. */
  existingUrl: string | null;
  onChange: (file: File | null) => void;
  onError: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const accept = (candidate: File | undefined) => {
    if (!candidate) return;
    if (!AVATAR_TYPES.has(candidate.type)) {
      onError("Profile pictures must be PNG or JPG images.");
      return;
    }
    if (candidate.size > AVATAR_MAX_BYTES) {
      onError("Profile pictures must be 5MB or smaller.");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(candidate));
    onChange(candidate);
  };

  const shown = file ? preview : existingUrl;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload profile picture"
      onClick={() => inputRef.current?.click()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        accept(event.dataTransfer.files?.[0]);
      }}
      className={cn(
        "focus-ring flex cursor-pointer flex-col items-center justify-center gap-2 rounded-surface border-2 border-dashed px-6 py-8 text-center transition-colors duration-(--duration-shell) ease-shell",
        dragging
          ? "border-brand bg-brand-subtle"
          : "border-brand/40 hover:border-brand",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={(event) => {
          accept(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {shown ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- blob/signed URLs
              are outside next/image's loader; this is a small local preview. */}
          <img
            src={shown}
            alt="Profile picture preview"
            className="size-16 rounded-full object-cover"
          />
          <p className="text-sm text-ink-muted">
            {file ? file.name : "Current picture"} — click to replace
          </p>
        </>
      ) : (
        <>
          <IconCloudUpload
            size={28}
            stroke={1.5}
            className="text-ink-muted"
            aria-hidden="true"
          />
          <p className="text-sm text-ink">
            Drop your image here or click to{" "}
            <span className="font-medium text-info">browse</span>.
          </p>
          <p className="text-xs text-ink-muted">PNG, JPG up to 5MB</p>
        </>
      )}
    </div>
  );
}
