import { cn } from "@/lib/cn";

/** Same overlay approach as Checkbox — see the note there. */
const INPUT_CLASS =
  "peer size-5 shrink-0 appearance-none rounded-full border border-hairline bg-surface transition-colors duration-(--duration-shell) ease-shell focus-ring checked:border-brand checked:bg-brand aria-invalid:border-danger disabled:cursor-not-allowed";

export type RadioProps = Omit<React.ComponentProps<"input">, "type" | "size">;

export function Radio({ className, ref, ...props }: RadioProps) {
  return (
    <span className="relative inline-flex shrink-0 has-[:disabled]:opacity-50">
      <input
        type="radio"
        ref={ref}
        className={cn(INPUT_CLASS, className)}
        {...props}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 m-auto size-2 rounded-full bg-white opacity-0 peer-checked:opacity-100"
      />
    </span>
  );
}
