import React from "react";
import { Check, Heart, Smile, Sparkles } from "lucide-react";

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
    name: String(value.name || DEFAULT_VALUE.name).trim().slice(0, 24) || DEFAULT_VALUE.name,
    costume: costumeValues.includes(value.costume) ? value.costume : DEFAULT_VALUE.costume,
    animation: animationValues.includes(value.animation) ? value.animation : DEFAULT_VALUE.animation,
    bubbles: value.bubbles !== false,
    reactions: value.reactions !== false,
  };
}

export default function CompanionSettings({ value, onChange }) {
  const settings = normalizeCompanionSettings(value);
  const update = (patch) => onChange?.(normalizeCompanionSettings({ ...settings, ...patch }));

  return (
    <section className="card companion-settings" aria-labelledby="companion-settings-title">
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div className="companion-settings-icon" aria-hidden="true"><Smile size={20} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="eyebrow">Coming Soon · Companion</div>
          <h2 id="companion-settings-title" style={{ marginTop: 5 }}>Your little capybara</h2>
          <p className="subtitle" style={{ marginTop: 5 }}>
            Keep him in his own little spot above the dock. Turn him off anytime or customize his look and behavior here.
          </p>
        </div>
      </div>

      <label className="setting-toggle-row">
        <span>
          <strong>Show Companion</strong>
          <span className="subtitle" style={{ display: "block", marginTop: 3 }}>
            Show the capybara on your Flic'd screens.
          </span>
        </span>
        <input
          type="checkbox"
          role="switch"
          aria-label="Show Companion"
          checked={settings.enabled}
          onChange={(event) => update({ enabled: event.target.checked })}
        />
      </label>

      <div className="companion-customizer">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="eyebrow">Customize Him</div>
            <strong>Make him yours</strong>
          </div>
          <Sparkles size={18} className="muted" aria-hidden="true" />
        </div>

        <label className="setting-field">
          <span className="eyebrow">Name</span>
          <input
            className="input"
            value={settings.name}
            onChange={(event) => update({ name: event.target.value })}
            maxLength={24}
            aria-label="Companion name"
          />
        </label>

        <label className="setting-field">
          <span className="eyebrow">Costume</span>
          <select className="input" value={settings.costume} onChange={(event) => update({ costume: event.target.value })} aria-label="Costume">
            {COMPANION_COSTUMES.map((costume) => (
              <option key={costume.value} value={costume.value}>{costume.emoji} {costume.label}</option>
            ))}
          </select>
        </label>

        <label className="setting-field">
          <span className="eyebrow">Default animation</span>
          <select className="input" value={settings.animation} onChange={(event) => update({ animation: event.target.value })} aria-label="Default animation">
            {COMPANION_ANIMATIONS.map((animation) => (
              <option key={animation.value} value={animation.value}>{animation.label}</option>
            ))}
          </select>
        </label>

        <div className="stack" style={{ gap: 8 }}>
          <label className="check-row">
            <input type="checkbox" checked={settings.bubbles} onChange={(event) => update({ bubbles: event.target.checked })} />
            <span><strong>Talk bubbles</strong><span className="subtitle">Let him use the little speech bubbles we've built.</span></span>
          </label>
          <label className="check-row">
            <input type="checkbox" checked={settings.reactions} onChange={(event) => update({ reactions: event.target.checked })} />
            <span><strong>Reactions</strong><span className="subtitle">Allow small approved reactions and seasonal animations.</span></span>
          </label>
        </div>

        <div className="companion-preview" aria-label="Companion preview">
          <div className="companion-preview-cap">{COMPANION_COSTUMES.find((item) => item.value === settings.costume)?.emoji || "🦫"}</div>
          <div>
            <strong>{settings.name}</strong>
            <p className="subtitle" style={{ marginTop: 2 }}>{settings.animation} mode · {settings.bubbles ? "bubbles on" : "bubbles off"}</p>
          </div>
          <Heart size={15} className="muted" aria-hidden="true" />
        </div>
      </div>

      {!settings.enabled && (
        <div className="subtitle" style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 12 }}>
          <Check size={15} aria-hidden="true" /> The companion is hidden. Your customization is saved.
        </div>
      )}
    </section>
  );
}
