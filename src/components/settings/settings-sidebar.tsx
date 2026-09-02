"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconChevronDown } from "@tabler/icons-react";
import { SearchInput } from "@/components/ui/SearchInput";
import { cn } from "@/lib/cn";
import { SETTINGS_CATEGORIES } from "./settings-registry";

/**
 * The settings navigation rail, from the Workpex Settings screenshots: a search field over
 * the category list, each category a collapsible header with its items beneath, the current
 * item carrying a green tint and a left indicator bar.
 *
 * A category opens when it contains the active route, or when the search matches inside it —
 * so typing "team" reveals the match rather than leaving it hidden behind a collapsed header.
 * Items without an `href` are still listed (the hub has always shown the whole Workpex
 * information architecture) but render as plain text, because they have no screen to open.
 */
export function SettingsSidebar() {
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  const term = search.trim().toLowerCase();

  const categories = useMemo(() => {
    if (!term) return SETTINGS_CATEGORIES;
    return SETTINGS_CATEGORIES.map((category) => {
      if (category.title.toLowerCase().includes(term)) return category;
      return {
        ...category,
        items: category.items.filter((item) =>
          item.label.toLowerCase().includes(term),
        ),
      };
    }).filter(
      (category) =>
        category.title.toLowerCase().includes(term) ||
        category.items.length > 0,
    );
  }, [term]);

  return (
    <div className="flex min-h-0 flex-col">
      <div className="p-4">
        <SearchInput
          aria-label="Search settings"
          placeholder="Search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <nav
        aria-label="Settings"
        className="scrollbar-slim min-h-0 flex-1 overflow-y-auto px-4 pb-4"
      >
        {categories.map((category) => {
          const holdsActive = category.items.some(
            (item) => item.href && item.href === pathname,
          );
          // A search hit or the active route forces the section open; an explicit click
          // then wins over both, so the user can always collapse what they opened.
          const open =
            toggled[category.key] ?? (holdsActive || term.length > 0);

          return (
            <div
              key={category.key}
              className="border-b border-hairline last:border-b-0"
            >
              <button
                type="button"
                aria-expanded={open}
                onClick={() =>
                  setToggled((prev) => ({ ...prev, [category.key]: !open }))
                }
                className="focus-ring flex w-full items-center justify-between gap-3 rounded-control py-4 text-left text-[15px] font-medium text-ink transition-colors duration-(--duration-shell) ease-shell hover:text-brand-strong"
              >
                <span className="min-w-0 truncate">{category.title}</span>
                <IconChevronDown
                  size={18}
                  stroke={2}
                  aria-hidden="true"
                  className={cn(
                    "shrink-0 text-ink-muted transition-transform duration-(--duration-shell) ease-shell",
                    open && "rotate-180",
                  )}
                />
              </button>

              {open && (
                <ul className="mb-3 flex flex-col gap-1 border-l border-hairline pl-3">
                  {category.items.map((item) => {
                    const active = item.href === pathname;

                    if (!item.href) {
                      return (
                        <li
                          key={item.label}
                          className="cursor-default rounded-control px-3 py-2 text-sm text-ink-subtle"
                          title="Not available yet"
                        >
                          {item.label}
                        </li>
                      );
                    }

                    return (
                      <li key={item.label} className="relative">
                        {active && (
                          <span
                            aria-hidden="true"
                            className="absolute top-1/2 -left-3 h-7 w-0.5 -translate-y-1/2 rounded-full bg-brand"
                          />
                        )}
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "focus-ring block rounded-control px-3 py-2 text-sm transition-colors duration-(--duration-shell) ease-shell",
                            active
                              ? "bg-brand-subtle font-medium text-brand-strong"
                              : "text-ink hover:bg-canvas",
                          )}
                        >
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}

        {categories.length === 0 && (
          <p className="px-1 py-6 text-center text-sm text-ink-muted">
            No settings match “{search.trim()}”.
          </p>
        )}
      </nav>
    </div>
  );
}
