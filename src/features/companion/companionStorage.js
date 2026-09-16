import {
  DEFAULT_COMPANION_STATE,
  COMPANION_MODES,
  getCompanionStorageKey,
} from "./companionState.js";
import { normalizeCompanionSettings } from "./CompanionSettings.jsx";

function getSettingsKey(userId) {
  return `${getCompanionStorageKey(userId)}:settings`;
}

export function loadCompanionState(userId) {
  if (!userId || typeof localStorage === "undefined") return { ...DEFAULT_COMPANION_STATE };
  try {
    const stored = localStorage.getItem(getCompanionStorageKey(userId));
    if (!stored) return { ...DEFAULT_COMPANION_STATE };
    const parsed = JSON.parse(stored);
    const mode = parsed?.mode === COMPANION_MODES.QUIET ? COMPANION_MODES.QUIET : COMPANION_MODES.ACTIVE;
    return { ...DEFAULT_COMPANION_STATE, ...parsed, mode };
  } catch {
    return { ...DEFAULT_COMPANION_STATE };
  }
}

export function saveCompanionState(userId, state) {
  if (!userId || typeof localStorage === "undefined") return;
  localStorage.setItem(getCompanionStorageKey(userId), JSON.stringify(state));
}

export function loadCompanionSettings(userId) {
  if (!userId || typeof localStorage === "undefined") return normalizeCompanionSettings();
  try {
    const stored = localStorage.getItem(getSettingsKey(userId));
    if (!stored) return normalizeCompanionSettings();
    return normalizeCompanionSettings(JSON.parse(stored));
  } catch {
    return normalizeCompanionSettings();
  }
}

export function saveCompanionSettings(userId, settings) {
  if (!userId || typeof localStorage === "undefined") return;
  localStorage.setItem(getSettingsKey(userId), JSON.stringify(normalizeCompanionSettings(settings)));
}
