import React from "react";
import { ArrowLeft, Palette, RotateCcw, Save } from "lucide-react";
import { DEFAULT_APP_COLOR, sanitizeAppColor, appColorCssVars, accessibleAccent } from "./appColor.js";
import "./AppColorStudio.css";

export default function AppColorStudio({ initialValue, onBack, onSave }) {
  const [draft, setDraft] = React.useState(() => sanitizeAppColor(initialValue));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const preview = appColorCssVars({ ...draft, enabled: true });
  const accent = accessibleAccent(draft.hue, draft.intensity, draft.mode).css;

  const update = (key, value) => setDraft((current) => sanitizeAppColor({ ...current, [key]: value, ...(key === "enabled" ? {} : { enabled: true }) }));
  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await onSave?.(sanitizeAppColor(draft));
      onBack?.();
    } catch (cause) {
      setError(cause?.message || "Could not save your colors.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="screen app-color-studio" style={preview} data-testid="app-color-studio">
      <header className="topbar">
        <button type="button" className="btn icon-btn" onClick={onBack} aria-label="Back to Settings"><ArrowLeft size={19}/></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="eyebrow">Appearance</div>
          <h1 className="title">Color Studio</h1>
          <p className="subtitle">Your entire flic'd experience, in your colors.</p>
        </div>
        <Palette size={22} aria-hidden="true"/>
      </header>
      <div className="app-color-studio-layout">
        <div className="card stack app-color-controls">
          <label className="row app-color-toggle">
            <input type="checkbox" checked={draft.enabled} onChange={(event) => update("enabled", event.target.checked)} />
            <span><strong>Custom app colors</strong><small>Apply your colors across flic'd.</small></span>
          </label>
          <label className="app-color-field">
            <span><strong>Choose your hue</strong><output>{draft.hue}°</output></span>
            <div className="app-color-spectrum" aria-hidden="true"/>
            <input type="range" min="0" max="360" step="1" value={draft.hue}
              onChange={(event) => update("hue", Number(event.target.value))} aria-label="App hue" />
          </label>
          <label className="app-color-field">
            <span><strong>Color intensity</strong><output>{draft.intensity}%</output></span>
            <input type="range" min="20" max="100" step="1" value={draft.intensity}
              onChange={(event) => update("intensity", Number(event.target.value))} aria-label="App color intensity" />
          </label>
          <fieldset className="app-color-modes">
            <legend>Appearance</legend>
            <label><input type="radio" name="app-color-mode" checked={draft.mode === "dark"} onChange={() => update("mode", "dark")}/> Dark</label>
            <label><input type="radio" name="app-color-mode" checked={draft.mode === "light"} onChange={() => update("mode", "light")}/> Light</label>
          </fieldset>
          <div className="row app-color-actions">
            <button type="button" className="btn" onClick={() => setDraft({ ...DEFAULT_APP_COLOR })}><RotateCcw size={15}/> Reset</button>
            <button type="button" className="btn btn-primary" disabled={saving} onClick={save}><Save size={15}/>{saving ? "Saving…" : "Save colors"}</button>
          </div>
          {error && <p role="alert" className="app-color-error">{error}</p>}
          <p className="subtitle">Colors are saved privately to your account. Photos, videos, and album artwork are never recolored.</p>
        </div>
        <div className="card app-color-preview" aria-label="Live app color preview">
          <div className="eyebrow">Live preview</div>
          <div className="app-color-preview-shell" style={preview}>
            <div className="app-color-preview-heading"><strong>flic<span>’</span>d</strong><span>✦</span></div>
            <div className="app-color-preview-person"><div className="app-color-preview-avatar">f</div><div><strong>Your profile</strong><p>Your space, your aesthetic.</p></div></div>
            <div className="app-color-preview-button" style={{ background: accent, color: draft.mode === "light" ? "#fff" : "#15131b" }}>Edit Profile</div>
            <div className="app-color-preview-grid">{[1,2,3].map((i) => <div key={i} style={{ background: `linear-gradient(${125+i*30}deg,${accent},#272033)` }}/>)}</div>
            <div className="app-color-preview-nav">⌂ <span>⌕</span> <span>＋</span> <span>♡</span> <span style={{ color: accent }}>◉</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
