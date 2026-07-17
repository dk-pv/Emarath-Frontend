import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";

type LoadingProps = {
  label?: string;
} & Omit<React.ComponentPropsWithoutRef<"div">, "children">;

export function Loading({ label, className, ...props }: LoadingProps) {
  return (
    <div
      className={cn(
        "flex size-full flex-col items-center justify-center gap-3 p-6",
        className,
      )}
      {...props}
    >
      <Spinner size="lg" label={label ?? "Loading"} className="text-brand" />
      {/* The Spinner already carries this string in its live region. */}
      {label && (
        <p aria-hidden="true" className="text-sm text-ink-muted">
          {label}
        </p>
      )}
    </div>
  );
}
