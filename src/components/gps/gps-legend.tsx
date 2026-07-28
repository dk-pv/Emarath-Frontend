import React from "react";
import type { GpsPinType } from "@/services/gps-service";

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

export function GpsLegend() {
  const pinTypes: GpsPinType[] = [
    "CHECK_IN",
    "AUTOMATIC_TRACKING",
    "LOCATION_CHECK_IN",
    "FOLLOW_UP_COMPLETION",
    "CHECK_OUT",
  ];

  return (
    <div className="flex flex-wrap items-center gap-6 px-4 py-3 bg-white border-t border-slate-200 text-sm text-slate-600">
      {pinTypes.map((type) => (
        <div key={type} className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: PIN_COLORS[type] }}
          />
          <span>{PIN_LABELS[type]}</span>
        </div>
      ))}
    </div>
  );
}
