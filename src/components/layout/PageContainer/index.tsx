import { cn } from "@/lib/cn";

type PageContainerProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * The outermost wrapper inside Content. `min-w-0` is what stops a wide child — a table,
 * a KPI carousel — from stretching the shell and scrolling the whole page sideways.
 */
export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-4 p-4 lg:gap-6 lg:p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}
