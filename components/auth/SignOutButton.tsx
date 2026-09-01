"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/pouf/Button";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function signOut() {
    setLoading(true);
    try {
      await authClient.signOut();
      router.push("/");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button size="sm" variant="quiet" loading={loading} onClick={signOut}>
      Sign out
    </Button>
  );
}
