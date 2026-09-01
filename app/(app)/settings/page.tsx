import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { currentUserId, settingsFor } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings — Vocab Mountain" };

export default async function SettingsPage() {
  const userId = await currentUserId();
  if (!userId) redirect("/");

  const [s, decks] = await Promise.all([
    settingsFor(userId),
    prisma.deck.findMany({
      orderBy: [{ kind: "asc" }, { position: "asc" }],
      select: { id: true, title: true },
    }),
  ]);

  return (
    <SettingsForm
      initial={{
        dailyGoal: s.dailyGoal,
        studyOrder: s.studyOrder,
        sentenceFirst: s.sentenceFirst,
        showRoots: s.showRoots,
        keyboardHints: s.keyboardHints,
        speech: s.speech,
        sound: s.sound,
        activeDeckId: s.activeDeckId,
      }}
      decks={decks}
    />
  );
}
