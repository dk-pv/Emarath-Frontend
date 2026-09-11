import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge only knows Tailwind's own scales, so a utility built on one of the
 * project's `@theme` tokens (`h-control-sm`, `px-field-x`, `rounded-control`,
 * `text-title`) was not recognised as a member of its class group — a caller's `h-7`
 * could never override a component's `h-control-sm`, and both were emitted with the
 * stylesheet order deciding. Naming the token keys here makes those utilities merge
 * exactly like their built-in counterparts. Keep this list in step with
 * `src/app/globals.css`.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      spacing: [
        "control-sm",
        "control-md",
        "control-lg",
        "control",
        "field-x",
        "badge-dot",
        "status-badge",
        "sidebar",
        "sidebar-collapsed",
        "navbar",
        "brand-block",
        "brand-gap",
        "brand-inset",
        "nav-item",
        "nav-inset",
        "nav-gap",
        "nav-icon",
        "toggle-w",
        "toggle-h",
        "toggle-top",
        "navbar-inset",
        "navbar-edge",
        "navbar-gap",
        "navbar-icon",
      ],
      radius: ["control", "surface", "check"],
      text: ["count", "nav", "title"],
      ease: ["shell"],
    },
  },
});

/** Merge conditional class names, letting later Tailwind utilities win. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
