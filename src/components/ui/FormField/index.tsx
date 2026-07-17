"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

/** Spread onto the control to wire it to this field's label, hint and error. */
export type FormFieldControlProps = {
  id: string;
  required: boolean | undefined;
  "aria-describedby": string | undefined;
  "aria-invalid": true | undefined;
};

export type FormFieldProps = Omit<React.ComponentProps<"div">, "children"> & {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  /** Supplied an id, the field wires to it; otherwise one is generated. */
  htmlFor?: string;
  children:
    React.ReactNode | ((control: FormFieldControlProps) => React.ReactNode);
};

export function FormField({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  className,
  ref,
  ...props
}: FormFieldProps) {
  const generatedId = useId();
  const id = htmlFor ?? generatedId;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  // Built by hand rather than with cn(): these are ids, and twMerge would treat them
  // as Tailwind classes.
  const describedBy =
    [hint ? hintId : undefined, error ? errorId : undefined]
      .filter((value): value is string => value !== undefined)
      .join(" ") || undefined;

  const control: FormFieldControlProps = {
    id,
    required,
    "aria-describedby": describedBy,
    "aria-invalid": error ? true : undefined,
  };

  return (
    <div
      ref={ref}
      className={cn("flex flex-col gap-1.5", className)}
      {...props}
    >
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-danger">
            *
          </span>
        )}
      </label>

      {typeof children === "function" ? children(control) : children}

      {hint && (
        <p id={hintId} className="text-sm text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
