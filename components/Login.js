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
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-md"
      >
        <h1 className="text-center text-2xl font-bold text-gray-900">
          Inventory
        </h1>
        <p className="mt-1 text-center text-sm text-gray-500">
          Sign in to continue
        </p>

        <label className="mt-6 block">
          <span className="text-sm font-medium text-gray-700">Email</span>
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-blue-500 focus:outline-none disabled:opacity-50"
          />
        </label>

        <label className="mt-4 block">
          <span className="text-sm font-medium text-gray-700">Password</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-blue-500 focus:outline-none disabled:opacity-50"
          />
        </label>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-lg bg-blue-600 py-3 text-base font-semibold text-white shadow active:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "Signing in…" : "Sign In"}
        </button>
      </form>
    </main>
  );
}
