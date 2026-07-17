import Link from "next/link";
import { IconChevronRight } from "@tabler/icons-react";
import { cn } from "@/lib/cn";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export type BreadcrumbProps = {
  items: readonly BreadcrumbItem[];
  className?: string;
};

const LINK_CLASS =
  "rounded-control text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:text-ink focus-ring";

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-1.5 text-sm">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={item.label} className="flex items-center gap-1.5">
              {index > 0 && (
                <IconChevronRight
                  aria-hidden="true"
                  stroke={1.75}
                  className="size-4 shrink-0 text-ink-subtle"
                />
              )}
              {isLast || !item.href ? (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={cn(
                    "truncate",
                    isLast ? "font-medium text-ink" : "text-ink-muted",
                  )}
                >
                  {item.label}
                </span>
              ) : (
                <Link href={item.href} className={cn(LINK_CLASS, "truncate")}>
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
