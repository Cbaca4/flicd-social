export const COMPANION_PRESET_COSTUMES = Object.freeze([
  { value: "none", label: "Everyday" },
  { value: "santa", label: "Santa" },
  { value: "ghost", label: "Ghost" },
  { value: "witch", label: "Witch" },
  { value: "valentine", label: "Valentine" },
  { value: "hero", label: "Superhero" },
  { value: "speedster", label: "Speedster" },
  { value: "cosmic", label: "Cosmic Hero" },
]);

export const COMPANION_SEASONAL_COSTUMES = Object.freeze({
  halloween: Object.freeze([
    { value: "pumpkin-king", label: "Pumpkin King", exclusive: true },
    { value: "vampire", label: "Vampire", exclusive: true },
    { value: "reaper", label: "Little Reaper", exclusive: true },
  ]),
  christmas: Object.freeze([
    { value: "elf", label: "North Pole Elf", exclusive: true },
    { value: "gingerbread", label: "Gingerbread", exclusive: true },
    { value: "reindeer", label: "Rudolph", exclusive: true },
  ]),
  valentines: Object.freeze([
    { value: "cupid", label: "Cupid", exclusive: true },
    { value: "love-letter", label: "Love Letter", exclusive: true },
  ]),
});

export const COMPANION_REACTIONS = Object.freeze({
  default: Object.freeze([
    "✨",
    "💗",
    "❤️",
    "😂",
    "😭",
    "🥹",
    "🔥",
    "⭐",
    "👀",
    "😎",
    "you got this!",
    "let's go!",
    "hehe",
    "bestie 💗",
    "I'm vibin'",
  ]),
  halloween: Object.freeze([
    "🎃",
    "👻",
    "🦇",
    "🍬",
    "spooky!",
    "trick or treat!",
    "boo!",
  ]),
  christmas: Object.freeze([
    "🎄",
    "❄️",
    "🎁",
    "⛄",
    "ho ho ho!",
    "snow day!",
    "merry vibes ✨",
  ]),
  valentines: Object.freeze([
    "💗",
    "💖",
    "💘",
    "💕",
    "you're sweet",
    "xoxo",
    "love you!",
  ]),
});

export function getSeasonalCompanionCostumes(seasonalEventId) {
  return COMPANION_SEASONAL_COSTUMES[seasonalEventId] || [];
}

export function getAvailableCompanionCostumes(seasonalEventId) {
  return [
    ...COMPANION_PRESET_COSTUMES,
    ...getSeasonalCompanionCostumes(seasonalEventId),
  ];
}

export function getCompanionReactions(seasonalEventId) {
  return COMPANION_REACTIONS[seasonalEventId] || COMPANION_REACTIONS.default;
}
