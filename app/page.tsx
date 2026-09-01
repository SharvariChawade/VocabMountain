import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (session) {
    redirect("/home");
  }

  return (
    <main className="relative flex min-h-screen flex-1 items-center overflow-hidden bg-bg px-(--s5) py-(--s6)">
      <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-yellow/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-24 size-96 rounded-full bg-mint/40 blur-3xl" />
      <section className="relative mx-auto grid w-full max-w-6xl items-center gap-(--s6) lg:grid-cols-[1.1fr_0.9fr]">
        <div className="max-w-2xl">
          <div className="mb-(--s4) inline-flex items-center gap-(--s2) rounded-full bg-yellow px-(--s3) py-2 text-sm font-black text-ink cushion-control">
            <span aria-hidden="true">&#9733;</span> A kinder way to learn words
          </div>
          <h1 className="max-w-xl text-5xl font-black leading-[0.95] tracking-[-0.04em] text-ink sm:text-7xl">
            Climb higher with every word.
          </h1>
          <p className="mt-(--s4) max-w-lg text-lg font-bold leading-relaxed text-ink sm:text-xl">
            Vocab Mountain turns small, consistent practice into a daily climb you can actually enjoy.
          </p>
          <div className="mt-(--s5) flex flex-col items-start gap-(--s3)">
            <GoogleSignInButton />
            <p className="text-sm font-bold text-ink">Your progress is private and synced securely.</p>
          </div>
        </div>
        <div className="relative rounded-card bg-surface p-(--s5) cushion-card sm:p-(--s6)">
          <div className="rounded-control bg-purple p-(--s5) text-ink cushion-control">
            <div className="flex items-center justify-between text-sm font-black opacity-80">
              <span>YOUR NEXT CLIMB</span>
              <span>12 min</span>
            </div>
            <div className="mt-(--s5) text-4xl font-black">Mountain weather</div>
            <div className="mt-(--s2) text-base font-bold opacity-80">8 words waiting for you</div>
            <div className="mt-(--s5) h-3 overflow-hidden rounded-full bg-white/30">
              <div className="h-full w-2/5 rounded-full bg-yellow" />
            </div>
          </div>
          <div className="mt-(--s4) grid grid-cols-2 gap-(--s3)">
            <div className="rounded-control bg-mint p-(--s4) text-ink cushion-row">
              <div className="text-2xl font-black">7</div>
              <div className="text-sm font-bold text-[var(--on-accent-muted)]">day streak</div>
            </div>
            <div className="rounded-control bg-pink p-(--s4) text-ink cushion-row">
              <div className="text-2xl font-black">142</div>
              <div className="text-sm font-bold text-[var(--on-accent-muted)]">words learned</div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
