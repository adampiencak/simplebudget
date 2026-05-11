"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setBusy(false);
    } else {
      window.location.replace("/");
    }
  }

  async function signUp() {
    if (!email || !password) {
      setError("Enter an email and password first.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    if (!data.session) {
      // Email confirmation is enabled — sign in directly since we just created the account.
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr) {
        setError(
          "Account created but couldn't sign in automatically. If you have email confirmation enabled in Supabase, disable it under Authentication → Providers → Email."
        );
        setBusy(false);
        return;
      }
    }
    window.location.replace("/");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold mb-2">Budget</h1>
        <p className="text-neutral-400 mb-8 text-sm">Sign in or create an account.</p>

        <form onSubmit={signIn} className="space-y-3">
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full bg-neutral-900 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-500/40"
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full bg-neutral-900 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-500/40"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-green-500 text-black font-semibold rounded-xl py-3 disabled:opacity-60"
          >
            {busy ? "…" : "Sign in"}
          </button>
          <button
            type="button"
            onClick={signUp}
            disabled={busy}
            className="w-full bg-neutral-900 text-neutral-200 font-medium rounded-xl py-3 disabled:opacity-60"
          >
            Create account
          </button>
          {error && <div className="text-sm text-red-400">{error}</div>}
        </form>
      </div>
    </main>
  );
}
