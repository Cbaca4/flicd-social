import React from "react";
import { supabase } from "../../lib/supabase";

export default function Auth({ onLogin }) {
  const [username, setUsername] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isSignUp, setIsSignUp] = React.useState(false);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const result = isSignUp
      ? await supabase.auth.signUp({ email, password, options: { data: { username: username.trim() } } })
      : await supabase.auth.signInWithPassword({ email, password });
    if (result.error) {
      setError(result.error.message);
      setLoading(false);
      return;
    }
    setLoading(false);
    onLogin?.();
  }

  return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}><form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 400, display: "grid", gap: 14 }}><h1>Flic'd</h1><p>{isSignUp ? "Create your account" : "Welcome back"}</p>{isSignUp && <input type="text" placeholder="Username" value={username} onChange={(event) => setUsername(event.target.value)} required minLength={2} maxLength={30} autoComplete="username" />}
    <input type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
    <input type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} autoComplete={isSignUp ? "new-password" : "current-password"} />
    {error && <p role="alert" style={{ color: "red" }}>{error}</p>}
    <button type="submit" disabled={loading}>{loading ? "Please wait..." : isSignUp ? "Create account" : "Log in"}</button>
    <button type="button" onClick={() => { setIsSignUp((current) => !current); setError(""); }}>{isSignUp ? "Already have an account? Log in" : "Don't have an account? Sign up"}</button>
  </form></div>;
}
