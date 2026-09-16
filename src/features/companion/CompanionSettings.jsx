import React from "react";
import { Check, Heart, Smile, Sparkles } from "lucide-react";
import { getActiveSeasonalEvent } from "../seasonal/seasonalEvents.js";
import {
  COMPANION_ANIMATIONS,
  normalizeCompanionSettings,
} from "./companionSettingsConfig.js";
import {
  COMPANION_PRESET_COSTUMES,
  getSeasonalCompanionCostumes,
} from "./companionCostumes.js";

const SPRITE_ROWS = {
  none: 0,
  santa: 1,
  ghost: 2,
  witch: 3,
  valentine: 4,
};

function CostumePreview({ costume }) {
  return (
    <span
      className={`companion-preview-sprite companion-costume-${costume}`}
      data-testid="companion-preview-sprite"
      style={{ "--sprite-row": SPRITE_ROWS[costume] ?? 0 }}
      aria-hidden="true"
    />
  );
}

export default function CompanionSettings({ value, onChange }) {
  const settings = normalizeCompanionSettings(value);
  const activeSeason = getActiveSeasonalEvent();
  const seasonalCostumes = getSeasonalCompanionCostumes(activeSeason?.id);

  const update = (patch) => {
    const next = normalizeCompanionSettings({
      ...settings,
      ...patch,
    });

    onChange?.(next);

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("flicd:companion-settings", {
          detail: next,
        }),
      );
    }
  };

  return (
    <section
      className="card companion-settings"
      aria-labelledby="companion-settings-title"
    >
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div className="companion-settings-icon" aria-hidden="true">
          <Smile size={20} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="eyebrow">Companion</div>
          <h2 id="companion-settings-title" style={{ marginTop: 5 }}>
            Your little capybara
          </h2>
          <p className="subtitle" style={{ marginTop: 5 }}>
            Keep him in his own little spot above the dock. Name him, dress
            him up, or turn him off anytime.
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
          <select
            className="input"
            value={settings.costume}
            onChange={(event) => update({ costume: event.target.value })}
            aria-label="Costume"
          >
            <optgroup label="Presets">
              {COMPANION_PRESET_COSTUMES.map((costume) => (
                <option key={costume.value} value={costume.value}>
                  {costume.label}
                </option>
              ))}
            </optgroup>
            {seasonalCostumes.length > 0 && (
              <optgroup label={`${activeSeason.label} Exclusives`}>
                {seasonalCostumes.map((costume) => (
                  <option key={costume.value} value={costume.value}>
                    {costume.label} ✦
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>

        {seasonalCostumes.length > 0 && (
          <div className="companion-exclusive-note" aria-live="polite">
            <Sparkles size={15} aria-hidden="true" />
            <span>
              <strong>{activeSeason.label} exclusives are here.</strong>
              <span className="subtitle">
                These limited costumes disappear from the picker when the
                season ends.
              </span>
            </span>
          </div>
        )}

        <label className="setting-field">
          <span className="eyebrow">Default behavior</span>
          <select
            className="input"
            value={settings.animation}
            onChange={(event) => update({ animation: event.target.value })}
            aria-label="Default animation"
          >
            {COMPANION_ANIMATIONS.map((animation) => (
              <option key={animation.value} value={animation.value}>
                {animation.label}
              </option>
            ))}
          </select>
        </label>

        <div className="check-row">
          <input
            type="checkbox"
            checked={settings.reactions}
            onChange={(event) => update({ reactions: event.target.checked })}
            aria-label="Reactions"
          />
          <span>
            <strong>Tap reactions</strong>
            <span className="subtitle">
              Let him answer with floating reactions and tiny phrases.
            </span>
          </span>
        </div>

        <div className="companion-preview" aria-label="Companion preview">
          <CostumePreview costume={settings.costume} />
          <div>
            <strong>{settings.name || "Unnamed"}</strong>
            <p className="subtitle" style={{ marginTop: 2 }}>
              {settings.animation} mode
            </p>
          </div>
          <Heart size={15} className="muted" aria-hidden="true" />
        </div>
      </div>

      {!settings.enabled && (
        <div
          className="subtitle"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            marginTop: 12,
          }}
        >
          <Check size={15} aria-hidden="true" />
          The companion is hidden. Your customization is saved.
        </div>
      )}
    </section>
  );
}
