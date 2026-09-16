import { getActiveSeasonalEvent } from "./seasonalEvents.js";

export function getSeasonalProfileTheme(theme, date = new Date()) {
  const event = getActiveSeasonalEvent(date);
  if (!event?.profileTheme) return theme;

  return {
    ...theme,
    accent: event.profileTheme.accent || theme.accent,
    seasonalEvent: event.id,
    seasonalDecoration: event.profileTheme.decoration,
  };
}
