"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../lib/firebase";

// Map Firebase auth error codes to plain language for a non-technical user.
function friendlyError(code) {
  switch (code) {
    case "auth/invalid-email":
      return "That doesn't look like a valid email address.";
    case "auth/missing-password":
      return "Please enter your password.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Email or password is incorrect.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a minute and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      return "Could not sign in. Please try again.";
  }
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // On success the auth listener in page.js swaps in the dashboard.
    } catch (err) {
      console.error("Sign-in failed:", err.code);
      setError(friendlyError(err.code));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-light px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl ring-1 ring-brand-surface"
      >
        <div className="text-center">
          <span className="text-4xl">📦</span>
          <h1 className="mt-2 text-2xl font-bold text-brand-darkest">
            Inventory
          </h1>
          <p className="mt-1 text-sm text-brand-darkest/50">
            Sign in to continue
          </p>
        </div>

        <label className="mt-6 block">
          <span className="text-sm font-semibold text-brand-darkest">Email</span>
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
            className="mt-1.5 w-full rounded-xl border-2 border-brand-surface bg-brand-surface/50 px-4 py-3 text-base transition focus:border-brand-teal focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal/20 disabled:opacity-50"
          />
        </label>

        <label className="mt-4 block">
          <span className="text-sm font-semibold text-brand-darkest">Password</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            className="mt-1.5 w-full rounded-xl border-2 border-brand-surface bg-brand-surface/50 px-4 py-3 text-base transition focus:border-brand-teal focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal/20 disabled:opacity-50"
          />
        </label>

        {error && (
          <p className="mt-4 rounded-xl bg-brand-gold/10 px-4 py-2.5 text-sm font-semibold text-brand-darkest ring-1 ring-brand-gold/30">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-xl bg-brand-teal py-3.5 text-base font-bold text-white shadow-lg shadow-brand-teal/20 transition hover:bg-brand-teal2 hover:shadow-xl active:scale-[0.98] disabled:opacity-50"
        >
          {submitting ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </main>
  );
}
