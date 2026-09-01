"use client";

import { useState } from "react";
import { Button } from "@/components/pouf/Button";
import { authClient } from "@/lib/auth-client";

export function GoogleSignInButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signInWithGoogle() {
    setLoading(true);
    setError(null);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/home",
      });
    } catch {
      setError("We couldn't connect to Google. Please try again.");
      setLoading(false);
    }
  }

  return <div className="flex flex-col items-start gap-2">
    <Button size="lg" loading={loading} onClick={signInWithGoogle}>
      Continue with Google
    </Button>
    {error && <p className="text-sm font-bold text-[var(--down)]" role="alert">{error}</p>}
  </div>;
}
