import React from "react";
import { supabase } from "../../lib/supabase";

export default function Auth({ onLogin }) {
  const [username, setUsername] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [mode, setMode] = React.useState("login");
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const isSignUp = mode === "signup";
  const isRecovery = mode === "recovery";

  async function handleSubmit(event) {
    event.preventDefault();
    if (loading) return;
    setError("");
    setNotice("");
    const cleanEmail = email.trim();
    const handle = username.trim();

    if (isSignUp && !/^[A-Za-z0-9._]{2,30}$/.test(handle)) {
      setError("Choose a username of 2–30 letters, numbers, periods, or underscores.");
      return;
    }

    setLoading(true);
    try {
      if (isRecovery) {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail);
        if (resetError) throw resetError;
        // Do not disclose whether a particular email address is registered.
        setNotice("If this address has an account, password reset instructions will arrive by email.");
        return;
      }
      const result = isSignUp
        ? await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { data: { username: handle } },
        })
        : await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      if (result.error) throw result.error;
      if (!result.data?.session) {
        if (isSignUp) {
          setNotice("Check your email for an account confirmation link, then log in.");
        } else {
          setError("No active session was created. Please try signing in again.");
        }
        return;
      }
      onLogin?.();
    } catch (authError) {
      setError(authError?.message || "Authentication is unavailable. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function chooseMode(nextMode) {
    setMode(nextMode);
    setError("");
    setNotice("");
    setPassword("");
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 400, display: "grid", gap: 14 }}>
        <h1>Flic'd</h1>
        <p>{isRecovery ? "Reset your password" : isSignUp ? "Create your account" : "Welcome back"}</p>
        {isSignUp && (
          <input type="text" placeholder="Username" aria-label="Username" value={username}
            onChange={(event) => setUsername(event.target.value)} required minLength={2} maxLength={30}
            pattern="[A-Za-z0-9._]{2,30}" autoComplete="username" />
        )}
        <input type="email" placeholder="Email" aria-label="Email" value={email}
          onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
        {!isRecovery && (
          <input type="password" placeholder="Password" aria-label="Password" value={password}
            onChange={(event) => setPassword(event.target.value)} required minLength={isSignUp ? 8 : undefined}
            autoComplete={isSignUp ? "new-password" : "current-password"} />
        )}
        {error && <p role="alert" style={{ color: "var(--danger, red)" }}>{error}</p>}
        {notice && <p role="status">{notice}</p>}
        <button type="submit" disabled={loading}>
          {loading ? "Please wait..." : isRecovery ? "Send reset email" : isSignUp ? "Create account" : "Log in"}
        </button>
        {!isRecovery && (
          <button type="button" onClick={() => chooseMode(isSignUp ? "login" : "signup")}>
            {isSignUp ? "Already have an account? Log in" : "Don't have an account? Sign up"}
          </button>
        )}
        {mode === "login" && <button type="button" onClick={() => chooseMode("recovery")}>Forgot password?</button>}
        {isRecovery && <button type="button" onClick={() => chooseMode("login")}>Back to log in</button>}
      </form>
    </div>
  );
}
