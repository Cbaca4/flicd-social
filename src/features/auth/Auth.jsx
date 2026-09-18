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

  return <div className="auth-shell"><form onSubmit={handleSubmit} className="auth-card"><h1>Flic'd</h1><p className="subtitle">{isSignUp ? "Create your account" : "Welcome back"}</p>{isSignUp && <input className="input" type="text" placeholder="Username" value={username} onChange={(event) => setUsername(event.target.value)} required minLength={2} maxLength={30} autoComplete="username" />}
    <input className="input" type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
    <input className="input" type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} autoComplete={isSignUp ? "new-password" : "current-password"} />
    {error && <p role="alert" className="auth-error">{error}</p>}
    <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? "Please wait..." : isSignUp ? "Create account" : "Log in"}</button>
    <button type="button" className="auth-switch" onClick={() => { setIsSignUp((current) => !current); setError(""); }}>{isSignUp ? "Already have an account? Log in" : "Don't have an account? Sign up"}</button>
  </form></div>;
}
