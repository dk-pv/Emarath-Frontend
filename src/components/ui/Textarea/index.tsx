import { cn } from "@/lib/cn";

const BASE_CLASS =
  "w-full min-h-control-lg resize-y scrollbar-slim rounded-control border border-hairline bg-surface px-field-x py-2 text-sm text-ink placeholder:text-ink-subtle transition-colors duration-(--duration-shell) ease-shell focus-ring aria-invalid:border-danger disabled:cursor-not-allowed disabled:opacity-50";

export type TextareaProps = React.ComponentProps<"textarea">;

export function Textarea({ className, ref, ...props }: TextareaProps) {
  return (
    <textarea ref={ref} className={cn(BASE_CLASS, className)} {...props} />
  );
}
