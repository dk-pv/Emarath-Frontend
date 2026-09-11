"use client";

import Link from "next/link";
import { IconBrandWhatsapp, IconSettings } from "@tabler/icons-react";
import { NavbarSearch } from "../NavbarSearch";
import { NotificationMenu } from "../NotificationMenu";
import { QuickAddMenu } from "../QuickAddMenu";
import { UserMenu } from "../UserMenu";

/**
 * The navbar controls, at the measured 55px pitch (36px control + 19px gap) ending
 * 32px from the viewport edge.
 *
 * Search expands in place, Settings navigates, the + and avatar open their menus.
 * WhatsApp is the one the reference never opens, so its trigger stays inert rather
 * than inventing a destination for it.
 *
 * **The help (?) control is deliberately absent, against the reference.** All three
 * dashboard captures draw a ? between the bell and the avatar; the owner removed it
 * from Emarath on 2026-09-11 after being shown that evidence. This is an intentional
 * departure from parity, not an oversight — restore the button here if it is ever
 * reinstated.
 *
 * Only one menu can be open at a time without any shared state here: each menu closes
 * on an outside pointer-down (`useDismissable`), and a click on another trigger is
 * exactly that.
 */
const CONTROL_CLASS =
  "flex size-control shrink-0 items-center justify-center rounded-full text-ink transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas focus-ring";

export function NavbarActions() {
  return (
    <div className="flex shrink-0 items-center gap-2 lg:gap-navbar-gap">
      <NavbarSearch triggerClassName={CONTROL_CLASS} />

      <button type="button" aria-label="WhatsApp" className={CONTROL_CLASS}>
        <IconBrandWhatsapp size={21} stroke={1.75} />
      </button>

      <Link href="/settings" aria-label="Settings" className={CONTROL_CLASS}>
        <IconSettings size={21} stroke={1.75} />
      </Link>

      <QuickAddMenu triggerClassName={CONTROL_CLASS} />

      <NotificationMenu />

      <UserMenu />
    </div>
  );
}
