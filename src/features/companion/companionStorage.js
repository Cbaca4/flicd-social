import {
  COMPANION_MODES,
  DEFAULT_COMPANION_STATE,
  clampCompanionPosition,
  getCompanionStorageKey,
} from "./companionState.js";

function normalizeState(state) {
  const position = clampCompanionPosition({
    x: Number(state?.x),
    y: Number(state?.y),
  });
  const mode = state?.mode === COMPANION_MODES.QUIET
    ? COMPANION_MODES.QUIET
    : COMPANION_MODES.ACTIVE;
  return { ...position, mode };
}

export function loadCompanionState(userId) {
  if (!userId || typeof localStorage === "undefined") return { ...DEFAULT_COMPANION_STATE };
  try {
    const stored = localStorage.getItem(getCompanionStorageKey(userId));
    if (!stored) return { ...DEFAULT_COMPANION_STATE };
    return normalizeState(JSON.parse(stored));
  } catch {
    return { ...DEFAULT_COMPANION_STATE };
  }
}

export function saveCompanionState(userId, state) {
  if (!userId || typeof localStorage === "undefined") return;
  localStorage.setItem(getCompanionStorageKey(userId), JSON.stringify(normalizeState(state)));
}
