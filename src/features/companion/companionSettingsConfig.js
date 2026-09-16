export const COMPANION_COSTUMES = Object.freeze([
  { value: "none", label: "Everyday", emoji: "🦫" },
  { value: "santa", label: "Santa", emoji: "🎅" },
  { value: "witch", label: "Witch", emoji: "🧙" },
  { value: "heart", label: "Sweetheart", emoji: "💗" },
]);

export const COMPANION_ANIMATIONS = Object.freeze([
  { value: "walk", label: "Walk" },
  { value: "sit", label: "Sit" },
  { value: "talk", label: "Talk" },
]);

const DEFAULT_VALUE = Object.freeze({
  enabled: true,
  name: "Buddy",
  costume: "none",
  animation: "walk",
  bubbles: true,
  reactions: true,
});

export function normalizeCompanionSettings(value = {}) {
  const animationValues = COMPANION_ANIMATIONS.map((item) => item.value);
  const costumeValues = COMPANION_COSTUMES.map((item) => item.value);

  return {
    ...DEFAULT_VALUE,
    ...value,
    enabled: value.enabled !== false,
    name:
      String(value.name || DEFAULT_VALUE.name).trim().slice(0, 24) ||
      DEFAULT_VALUE.name,
    costume: costumeValues.includes(value.costume)
      ? value.costume
      : DEFAULT_VALUE.costume,
    animation: animationValues.includes(value.animation)
      ? value.animation
      : DEFAULT_VALUE.animation,
    bubbles: value.bubbles !== false,
    reactions: value.reactions !== false,
  };
}
