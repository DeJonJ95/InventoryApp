"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    } catch (err) {
      console.error("Sign-in failed:", err.code);
      setError(friendlyError(err.code));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm">
        <Card className="shadow-xl">
          <CardContent className="p-8">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-foreground">
                Inventory
              </h1>
              <div className="mx-auto mt-2 h-1 w-12 rounded-full bg-primary" aria-hidden="true" />
              <p className="mt-3 text-sm text-muted-foreground">
                Sign in to continue
              </p>
            </div>

            <div className="mt-6 grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-lg bg-accent/10 px-4 py-2.5 text-sm font-semibold text-foreground ring-1 ring-accent/30">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={submitting}
              className="mt-6 w-full"
              size="lg"
            >
              {submitting ? "Signing in…" : "Sign In"}
            </Button>
          </CardContent>
        </Card>
      </form>
    </main>
  );
}