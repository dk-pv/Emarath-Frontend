import type { Metadata } from "next";
import { NAV_ITEMS } from "@/constants/navigation";

const APP_NAME = "Emarath";

/**
 * Page metadata derived from the navigation config, so a route's browser title can
 * never drift from its sidebar label. Workpex titles tabs "<Page> - Workpex".
 */
export function routeMetadata(href: string): Metadata {
  const item = NAV_ITEMS.find((navItem) => navItem.href === href);
  return { title: item ? `${item.title} - ${APP_NAME}` : APP_NAME };
}
