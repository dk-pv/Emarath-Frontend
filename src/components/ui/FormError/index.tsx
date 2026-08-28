import { cn } from "@/lib/cn";

/** The compact API-error line at the top of a form — one look for every drawer and modal. */
export function FormError({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"p">) {
  return (
    <p
      role="alert"
      className={cn(
        "rounded-control border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger",
        className,
      )}
      {...props}
    />
  );
}
