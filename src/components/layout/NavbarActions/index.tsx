"use client";

import Link from "next/link";
import {
  IconBrandWhatsapp,
  IconCirclePlus,
  IconHelpCircle,
  IconSearch,
  IconSettings,
  type Icon,
} from "@tabler/icons-react";
import { NotificationMenu } from "../NotificationMenu";
import { UserMenu } from "../UserMenu";

/**
 * The seven navbar controls, at the measured 55px pitch (36px control + 19px gap)
 * ending 32px from the viewport edge.
 *
 * Only the quick-add and avatar menus are captured in ui-reference/; the search,
 * WhatsApp and help panels are not, so their triggers are inert here. Settings is the
 * one that has a real destination in this product, so it navigates rather than sitting
 * dead next to the others.
 */
const ACTIONS: { label: string; icon: Icon }[] = [
  { label: "Search", icon: IconSearch },
  { label: "WhatsApp", icon: IconBrandWhatsapp },
];

const CONTROL_CLASS =
  "flex size-control shrink-0 items-center justify-center rounded-full text-ink transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas focus-ring";

export function NavbarActions() {
  return (
    <div className="flex shrink-0 items-center gap-2 lg:gap-navbar-gap">
      {ACTIONS.map(({ label, icon: IconComponent }) => (
        <button
          key={label}
          type="button"
          aria-label={label}
          className={CONTROL_CLASS}
        >
          <IconComponent size={21} stroke={1.75} />
        </button>
      ))}

      <Link href="/settings" aria-label="Settings" className={CONTROL_CLASS}>
        <IconSettings size={21} stroke={1.75} />
      </Link>

      <button type="button" aria-label="Quick add" className={CONTROL_CLASS}>
        <IconCirclePlus size={21} stroke={1.75} />
      </button>

      <NotificationMenu />

      <button type="button" aria-label="Help" className={CONTROL_CLASS}>
        <IconHelpCircle size={21} stroke={1.75} />
      </button>

      <UserMenu />
    </div>
  );
}
