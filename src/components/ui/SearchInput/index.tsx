import { IconSearch } from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { Input, type InputProps } from "@/components/ui/Input";

export type SearchInputProps = Omit<InputProps, "type">;

export function SearchInput({ className, ref, ...props }: SearchInputProps) {
  return (
    <span className="relative block w-full">
      <IconSearch
        aria-hidden="true"
        stroke={1.75}
        className="pointer-events-none absolute top-1/2 left-field-x size-4 -translate-y-1/2 text-ink-muted"
      />
      <Input
        ref={ref}
        type="search"
        className={cn("pl-9", className)}
        {...props}
      />
    </span>
  );
}
