export const COMPANION_COSTUMES = Object.freeze([
  { value: "none", label: "Everyday" },
  { value: "santa", label: "Santa" },
  { value: "ghost", label: "Ghost" },
  { value: "witch", label: "Witch" },
  { value: "valentine", label: "Valentine" },
]);

export const COMPANION_ANIMATIONS = Object.freeze([
  { value: "walk", label: "Walk" },
  { value: "sit", label: "Sit" },
]);

const DEFAULT_VALUE = Object.freeze({
  enabled: true,
  name: "Buddy",
  costume: "none",
  animation: "walk",
  reactions: true,
});

export function normalizeCompanionSettings(value = {}) {
  const animationValues = COMPANION_ANIMATIONS.map((item) => item.value);
  const costumeValues = COMPANION_COSTUMES.map((item) => item.value);
  const rawName = value.name;

  return {
    ...DEFAULT_VALUE,
    ...value,
    enabled: value.enabled !== false,
    name:
      rawName === undefined || rawName === null
        ? DEFAULT_VALUE.name
        : String(rawName).trim().slice(0, 24),
    costume: costumeValues.includes(value.costume)
      ? value.costume
      : DEFAULT_VALUE.costume,
    animation: animationValues.includes(value.animation)
      ? value.animation
      : DEFAULT_VALUE.animation,
    reactions: value.reactions !== false,
  };
}
