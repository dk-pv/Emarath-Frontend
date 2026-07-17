import { cn } from "@/lib/cn";

type DivProps = React.ComponentPropsWithoutRef<"div">;

export function Card({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        "rounded-surface border border-hairline bg-surface",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: DivProps) {
  return (
    <div
      className={cn("flex items-center justify-between gap-3 p-5", className)}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"h3">) {
  return (
    <h3
      className={cn("text-lg font-semibold text-ink", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: DivProps) {
  return <div className={cn("px-5 pb-5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 border-t border-hairline p-5",
        className,
      )}
      {...props}
    />
  );
}
