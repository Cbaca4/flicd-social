export const SEASONAL_EVENTS = {
  christmas: {
    id: "christmas",
    label: "Christmas",
    startMonth: 11,
    startDay: 25,
    endMonth: 12,
    endDay: 26,
    intensity: "full",
    character: { hat: "santa", accessory: "scarf" },
    environment: { effect: "snow", accumulation: true },
    interaction: { target: "snow", reaction: "playful" },
    profileTheme: { accent: "#d94b5b", decoration: "evergreen" },
  },
  halloween: {
    id: "halloween",
    label: "Halloween",
    startMonth: 10,
    startDay: 15,
    endMonth: 11,
    endDay: 2,
    intensity: "full",
    character: { hat: "witch", accessory: "candy" },
    environment: { effect: "leaves", accumulation: true },
    interaction: { target: "candy", reaction: "excited" },
    profileTheme: { accent: "#ff8a3d", decoration: "moonlight" },
  },
  valentines: {
    id: "valentines",
    label: "Valentine's Day",
    startMonth: 2,
    startDay: 1,
    endMonth: 2,
    endDay: 15,
    intensity: "full",
    character: { hat: "heart", accessory: "envelope" },
    environment: { effect: "hearts", accumulation: false },
    interaction: { target: "heart", reaction: "happy" },
    profileTheme: { accent: "#f26b9b", decoration: "hearts" },
  },
};

function dateKey(date) {
  return date.getMonth() * 100 + date.getDate();
}

export function getActiveSeasonalEvent(date = new Date()) {
  const key = dateKey(date);
  return Object.values(SEASONAL_EVENTS).find((event) => {
    const start = event.startMonth * 100 + event.startDay;
    const end = event.endMonth * 100 + event.endDay;
    return start <= end ? key >= start && key <= end : key >= start || key <= end;
  }) || null;
}
