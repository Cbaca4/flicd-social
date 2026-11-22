import React from "react";
import { supabase } from "../../lib/supabase";

// Render only after Supabase emits PASSWORD_RECOVERY for a verified recovery URL.
// Never allow changing another account's credentials from a public request body.
export default function PasswordReset({ onComplete }) {
  const [password, setPassword] = React.useState("");
  const [confirmation, setConfirmation] = React.useState("");
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    setError("");
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      const result = await supabase.auth.updateUser({ password });
      if (result.error) throw result.error;
      setPassword("");
      setConfirmation("");
      onComplete?.();
    } catch (saveError) {
      setError(saveError?.message || "Your password could not be updated.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <form onSubmit={save} style={{ width: "100%", maxWidth: 400, display: "grid", gap: 14 }}>
        <h1>Set a new password</h1>
        <p>You're using a password recovery link. Choose a new password to continue.</p>
        <label htmlFor="recovery-password">New password</label>
        <input id="recovery-password" type="password" autoComplete="new-password"
          minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} />
        <label htmlFor="recovery-confirmation">Confirm new password</label>
        <input id="recovery-confirmation" type="password" autoComplete="new-password"
          minLength={8} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={saving}>{saving ? "Saving..." : "Update password"}</button>
      </form>
    </div>
  );
}
