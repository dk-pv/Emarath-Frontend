import { IconMapPinFilled } from "@tabler/icons-react";
import type { GpsPinType } from "@/services/gps-service";

/**
 * The marker colours, as hex because that is what the Google Maps JS API takes for a
 * `Symbol.fillColor` — a Tailwind class cannot reach it. The legend reads the same map
 * so a swatch can never drift from the pin it explains; this is the one place in the
 * product that carries colour as data rather than as a token.
 */
export const PIN_COLORS: Record<GpsPinType, string> = {
  CHECK_IN: "#10b981", // Green (emerald-500)
  AUTOMATIC_TRACKING: "#f59e0b", // Orange (amber-500)
  LOCATION_CHECK_IN: "#3b82f6", // Blue (blue-500)
  FOLLOW_UP_COMPLETION: "#ec4899", // Pink (pink-500)
  CHECK_OUT: "#ef4444", // Red (red-500)
};

export const PIN_LABELS: Record<GpsPinType, string> = {
  CHECK_IN: "Check-in",
  AUTOMATIC_TRACKING: "Automatic Tracking",
  LOCATION_CHECK_IN: "Location Check-ins",
  FOLLOW_UP_COMPLETION: "Follow Up Completion",
  CHECK_OUT: "Check-out",
};

/**
 * The reference draws the two manual events as teardrop pins and the three passive
 * ones as dots — so the legend does too, rather than flattening all five to circles.
 */
const PIN_SHAPE: Record<GpsPinType, "pin" | "dot"> = {
  CHECK_IN: "pin",
  AUTOMATIC_TRACKING: "dot",
  LOCATION_CHECK_IN: "dot",
  FOLLOW_UP_COMPLETION: "dot",
  CHECK_OUT: "pin",
};

/** Legend order is the reference's, which is not the pin-type declaration order. */
const ORDER: GpsPinType[] = [
  "CHECK_IN",
  "AUTOMATIC_TRACKING",
  "LOCATION_CHECK_IN",
  "FOLLOW_UP_COMPLETION",
  "CHECK_OUT",
];

/**
 * The map legend (GPS-05.1), from GPS-MAP-overview.mp4: a plain row of marker/label
 * pairs sitting under the map, aligned to its right edge — no bar, no divider and no
 * fill behind it. It wraps rather than scrolls, so a narrow viewport stacks the pairs
 * instead of hiding any.
 */
export function GpsLegend() {
  return (
    <ul className="flex flex-wrap items-center justify-end gap-x-10 gap-y-2 px-1 pt-2 text-sm text-ink">
      {ORDER.map((type) => (
        <li key={type} className="flex items-center gap-2">
          {PIN_SHAPE[type] === "pin" ? (
            <IconMapPinFilled
              size={16}
              aria-hidden="true"
              style={{ color: PIN_COLORS[type] }}
            />
          ) : (
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: PIN_COLORS[type] }}
            />
          )}
          {PIN_LABELS[type]}
        </li>
      ))}
    </ul>
  );
}
