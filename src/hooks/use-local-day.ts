"use client";

import { useEffect, useState } from "react";

/** The local calendar day, "YYYY-MM-DD". */
function localDay(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Today's local date, updated at local midnight and whenever the tab becomes visible
 * again (a sleeping laptop can miss the timer). Day-relative views — the "Today" and
 * "Overdue" presets, the Activities tabs — key their date windows on it, so a page left
 * open overnight moves to the new day instead of keeping yesterday's boundaries.
 */
export function useLocalDay(): string {
  const [day, setDay] = useState(localDay);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const sync = () => setDay(localDay());
    const armForMidnight = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      timer = setTimeout(
        () => {
          sync();
          armForMidnight();
        },
        midnight.getTime() - now.getTime() + 1000,
      );
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };

    armForMidnight();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return day;
}
