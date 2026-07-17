"use client";

import { usePathname } from "next/navigation";
import { matchNavItem } from "@/constants/navigation";
import { NavbarActions } from "../NavbarActions";

/**
 * Measured: 53px tall plus a 1px #dadee4 bottom border, white, title at 27px starting
 * 28px in from the sidebar.
 */
export function Navbar() {
  const pathname = usePathname();
  const title = matchNavItem(pathname)?.title ?? "";

  return (
    <header className="flex h-navbar shrink-0 items-center gap-nav-gap border-b border-hairline bg-surface px-4 lg:pl-navbar-inset lg:pr-navbar-edge">
      <h1 className="text-title min-w-0 flex-1 truncate font-medium text-ink">
        {title}
      </h1>
      <NavbarActions />
    </header>
  );
}
