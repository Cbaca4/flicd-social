import React from "react";
import { getActiveSeasonalEvent, SEASONAL_EVENTS } from "../seasonal/seasonalEvents.js";

// Use the existing seasonal calendar, and refresh stationary/hidden companions
// across local midnight or a suspended tab. No duplicate holiday date rules.
export function useCompanionSeason(override = null) {
  const [, refresh] = React.useReducer((version) => version + 1, 0);
  React.useEffect(() => {
    let timer;
    const update = () => {
      window.clearTimeout(timer);
      refresh();
      schedule();
    };
    const schedule = () => {
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = window.setTimeout(update, midnight.getTime() - now.getTime());
    };
    schedule();
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  // getActiveSeasonalEvent returns the shared calendar objects. A parent may
  // retain one of those snapshots while only this child refreshes. Re-resolve
  // calendar-owned snapshots; deliberately supplied custom events keep priority.
  return override && override !== SEASONAL_EVENTS[override.id]
    ? override
    : getActiveSeasonalEvent();
}
