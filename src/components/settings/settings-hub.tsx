"use client";

import { useMemo, useState } from "react";
import { IconSettings } from "@tabler/icons-react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { SettingsCard } from "./settings-card";
import { SETTINGS_CATEGORIES } from "./settings-registry";

/**
 * The Settings hub (navigation only) — traced from `ui-reference/settings/`. A header (gear +
 * "Configure Your System", a one-line subtitle and a search box) over a responsive 3/2/1-column
 * grid of category cards. Search filters cards by title, description or any item label, client-
 * side over the static catalogue (no backend). See settings-registry.ts for the scope note.
 */
export function SettingsHub() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return SETTINGS_CATEGORIES;
    return SETTINGS_CATEGORIES.filter(
      (category) =>
        category.title.toLowerCase().includes(term) ||
        category.description.toLowerCase().includes(term) ||
        category.items.some((item) => item.label.toLowerCase().includes(term)),
    );
  }, [query]);

  return (
    <Card className="p-6 lg:p-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <IconSettings
              size={22}
              stroke={1.75}
              className="text-ink"
              aria-hidden="true"
            />
            <h2 className="text-xl font-semibold text-ink">
              Configure Your System
            </h2>
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            Manage all your application settings, preferences, and
            configurations from one central location
          </p>
        </div>

        <div className="w-full xl:w-96">
          <SearchInput
            aria-label="Search settings"
            placeholder="Search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((category) => (
            <SettingsCard key={category.key} category={category} />
          ))}
        </div>
      ) : (
        <EmptyState
          className="mt-8"
          icon={IconSettings}
          title="No settings found"
          description="No settings match your search. Try a different term."
        />
      )}
    </Card>
  );
}
