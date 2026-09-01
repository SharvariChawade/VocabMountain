import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { AppBottomNav } from "@/components/navigation/AppBottomNav";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/");
  }

  return (
    <main className="min-h-screen bg-bg px-(--s3) py-(--s3) text-ink sm:px-(--s5) sm:py-(--s5)">
      <div className="mx-auto max-w-7xl">
        <header className="flex items-center justify-between rounded-card bg-surface px-(--s4) py-(--s3) cushion-card sm:px-(--s5)">
          <a href="/home" className="flex items-center gap-(--s2) text-lg font-black tracking-tight">
            <span className="grid size-9 place-items-center rounded-control bg-purple text-ink">&#9650;</span>
            Vocab Mountain
          </a>
          <div className="flex items-center gap-(--s3)">
            <span className="hidden text-sm font-bold text-ink sm:inline">{session.user.email}</span>
            <SignOutButton />
          </div>
        </header>

        <a
          href="/study"
          className="mt-(--s5) block rounded-card bg-purple px-(--s6) pt-[calc(var(--s6)-var(--lip)/2)] pb-[calc(var(--s6)+var(--lip)/2)] text-center text-lg font-black text-[var(--on-accent)] cushion-card"
        >
          Start studying
        </a>
      </div>
      <div className="sm:hidden">
        <AppBottomNav />
      </div>
    </main>
  );
}
