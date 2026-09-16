export const COMPANION_MODES = Object.freeze({
  ACTIVE: "active",
  QUIET: "quiet",
});

export const COMPANION_BOUNDS = Object.freeze({
  minX: 8,
  maxX: 92,
  minY: 18,
  maxY: 82,
});

export const DEFAULT_COMPANION_STATE = Object.freeze({
  x: 82,
  y: 76,
  mode: COMPANION_MODES.ACTIVE,
});

export function clampCompanionPosition({ x, y }) {
  const safeX = Number.isFinite(x) ? x : DEFAULT_COMPANION_STATE.x;
  const safeY = Number.isFinite(y) ? y : DEFAULT_COMPANION_STATE.y;
  return {
    x: Math.min(COMPANION_BOUNDS.maxX, Math.max(COMPANION_BOUNDS.minX, safeX)),
    y: Math.min(COMPANION_BOUNDS.maxY, Math.max(COMPANION_BOUNDS.minY, safeY)),
  };
}

export function getRandomCompanionTarget(current, random = Math.random) {
  const target = clampCompanionPosition({
    x: random() * 100,
    y: random() * 100,
  });
  const movedEnough = Math.abs(target.x - current.x) + Math.abs(target.y - current.y) >= 12;
  if (movedEnough) return target;

  return clampCompanionPosition({
    x: current.x + (current.x > 50 ? -16 : 16),
    y: current.y + (current.y > 50 ? -10 : 10),
  });
}

export function moveCompanionToward(current, target, step) {
  const currentPosition = clampCompanionPosition(current);
  const nextTarget = clampCompanionPosition(target);
  const distanceStep = Math.max(0, Number(step) || 0);
  const dx = nextTarget.x - currentPosition.x;
  const dy = nextTarget.y - currentPosition.y;
  const distance = Math.hypot(dx, dy);

  if (!distance || distance <= distanceStep) return nextTarget;

  return clampCompanionPosition({
    x: currentPosition.x + (dx / distance) * distanceStep,
    y: currentPosition.y + (dy / distance) * distanceStep,
  });
}

export function getCompanionStorageKey(userId) {
  return `flicd:companion:${userId}`;
}
