import React from "react";
import {
  COMPANION_MODES,
  DEFAULT_COMPANION_STATE,
  clampCompanionPosition,
  getRandomCompanionTarget,
} from "./companionState.js";
import { loadCompanionState, saveCompanionState } from "./companionStorage.js";

const HAT_ICONS = {
  santa: "🎅",
  witch: "🧙",
  heart: "💗",
};

const ACCESSORY_ICONS = {
  scarf: "🧣",
  candy: "🍬",
  envelope: "💌",
};

const REACTION_ICONS = {
  snow: "❄️",
  candy: "🍬",
  heart: "💗",
};

const DRAG_THRESHOLD = 6;
const REACTION_DURATION = 900;
const MOVE_DELAY_MIN = 2800;
const MOVE_DELAY_RANGE = 2800;

function getPointerPosition(event, overlay) {
  const bounds = overlay.getBoundingClientRect();
  return clampCompanionPosition({
    x: ((event.clientX - bounds.left) / Math.max(bounds.width, 1)) * 100,
    y: ((event.clientY - bounds.top) / Math.max(bounds.height, 1)) * 100,
  });
}

function getSeasonalReaction(seasonalEvent) {
  return REACTION_ICONS[seasonalEvent?.interaction?.target] || "✨";
}

export default function Companion({ userId, enabled = true, seasonalEvent = null, onModeChange }) {
  const initialState = React.useMemo(
    () => loadCompanionState(userId) || { ...DEFAULT_COMPANION_STATE },
    [userId],
  );
  const [position, setPosition] = React.useState({ x: initialState.x, y: initialState.y });
  const [mode, setMode] = React.useState(initialState.mode);
  const [reacting, setReacting] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const [reducedMotion, setReducedMotion] = React.useState(false);
  const overlayRef = React.useRef(null);
  const pointerStartRef = React.useRef(null);
  const dragMovedRef = React.useRef(false);
  const reactionTimerRef = React.useRef(null);

  React.useEffect(() => {
    const stored = loadCompanionState(userId);
    setPosition({ x: stored.x, y: stored.y });
    setMode(stored.mode);
  }, [userId]);

  React.useEffect(() => {
    saveCompanionState(userId, { ...position, mode });
  }, [userId, position.x, position.y, mode]);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mediaQuery.matches);
    update();
    mediaQuery.addEventListener?.("change", update);
    return () => mediaQuery.removeEventListener?.("change", update);
  }, []);

  React.useEffect(() => {
    if (!enabled || mode !== COMPANION_MODES.ACTIVE || reducedMotion || dragging) return undefined;

    const timer = window.setTimeout(() => {
      setPosition((current) => getRandomCompanionTarget(current));
    }, MOVE_DELAY_MIN + Math.random() * MOVE_DELAY_RANGE);

    return () => window.clearTimeout(timer);
  }, [enabled, mode, reducedMotion, dragging, position.x, position.y]);

  React.useEffect(() => () => {
    if (reactionTimerRef.current) window.clearTimeout(reactionTimerRef.current);
  }, []);

  const toggleMode = () => {
    const nextMode = mode === COMPANION_MODES.ACTIVE
      ? COMPANION_MODES.QUIET
      : COMPANION_MODES.ACTIVE;
    setMode(nextMode);
    onModeChange?.(nextMode);
  };

  const showReaction = () => {
    if (mode === COMPANION_MODES.QUIET) return;
    setReacting(true);
    if (reactionTimerRef.current) window.clearTimeout(reactionTimerRef.current);
    reactionTimerRef.current = window.setTimeout(() => setReacting(false), REACTION_DURATION);
  };

  const handlePointerDown = (event) => {
    if (!enabled) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    dragMovedRef.current = false;
    setDragging(true);
  };

  const handlePointerMove = (event) => {
    if (!dragging || !overlayRef.current || !pointerStartRef.current) return;
    const distance = Math.hypot(
      event.clientX - pointerStartRef.current.x,
      event.clientY - pointerStartRef.current.y,
    );
    if (distance >= DRAG_THRESHOLD) dragMovedRef.current = true;
    setPosition(getPointerPosition(event, overlayRef.current));
  };

  const handlePointerUp = (event) => {
    if (!dragging) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setDragging(false);
    pointerStartRef.current = null;
    if (!dragMovedRef.current) showReaction();
  };

  if (!enabled) return null;

  const seasonalLabel = seasonalEvent?.label ? `${seasonalEvent.label} ` : "";
  const hat = HAT_ICONS[seasonalEvent?.character?.hat] || null;
  const accessory = ACCESSORY_ICONS[seasonalEvent?.character?.accessory] || null;
  const reaction = getSeasonalReaction(seasonalEvent);
  const modeLabel = mode === COMPANION_MODES.ACTIVE ? "quiet mode" : "companion mode";

  return (
    <div className="companion-overlay" ref={overlayRef} aria-label="Companion overlay">
      <div
        className={`companion-node${dragging ? " is-dragging" : ""}${reacting ? " is-reacting" : ""}${mode === COMPANION_MODES.QUIET ? " is-quiet" : ""}`}
        style={{ left: `${position.x}%`, top: `${position.y}%` }}
      >
        <button
          type="button"
          className="companion-character"
          aria-label={`${seasonalLabel}capybara companion`}
          aria-pressed={reacting}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          title="Drag me around"
        >
          <span className="companion-hat" aria-hidden="true">{hat}</span>
          <span className="companion-scarf" aria-hidden="true">{accessory}</span>
          <span className="capybara-body" aria-hidden="true">
            <span className="capybara-ear capybara-ear-left" />
            <span className="capybara-ear capybara-ear-right" />
            <span className="capybara-eye capybara-eye-left" />
            <span className="capybara-eye capybara-eye-right" />
            <span className="capybara-snout"><span className="capybara-nose" /></span>
            <span className="capybara-foot capybara-foot-left" />
            <span className="capybara-foot capybara-foot-right" />
          </span>
        </button>
        {reacting && <span className="companion-reaction" aria-live="polite" aria-label="Companion reaction">{reaction}</span>}
        <button
          type="button"
          className="companion-mode-control"
          aria-label={`Enable ${modeLabel}`}
          aria-pressed={mode === COMPANION_MODES.QUIET}
          onClick={toggleMode}
          title={mode === COMPANION_MODES.ACTIVE ? "Quiet mode" : "Companion mode"}
        >
          {mode === COMPANION_MODES.ACTIVE ? "◌" : "☀"}
        </button>
      </div>
    </div>
  );
}
