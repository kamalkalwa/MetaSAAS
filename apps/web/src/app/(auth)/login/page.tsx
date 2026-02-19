"use client";

/**
 * Login Page
 *
 * Email/password sign-in form.
 * If auth is not enabled (dev mode), shows a message and a link to the dashboard.
 */

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const { signIn, authEnabled } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /** If auth is not configured, show dev-mode notice */
  if (!authEnabled) {
    return (
      <div className="bg-card border border-border rounded-lg p-8 shadow-sm text-center">
        <h1 className="text-2xl font-semibold mb-2">Development Mode</h1>
        <p className="text-muted-foreground mb-6">
          Authentication is not configured. All requests use a dev admin caller.
        </p>
        <Link
          href="/dashboard"
          className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Go to Dashboard
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const result = await signIn(email, password);

    if (result.error) {
      setError(result.error);
      setSubmitting(false);
    } else {
      router.replace("/dashboard");
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-8 shadow-sm">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Enter your credentials to access your account
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email */}
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium mb-1.5"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
            placeholder="you@example.com"
          />
        </div>

        {/* Password */}
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium mb-1.5"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
            placeholder="••••••••"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="text-destructive text-sm bg-destructive/10 px-3 py-2 rounded-md">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="text-foreground font-medium hover:underline"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
