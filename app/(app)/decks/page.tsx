import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DeckPicker } from "@/components/decks/DeckPicker";
import { prisma } from "@/lib/prisma";
import { currentUserId, settingsFor } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Decks — Vocab Mountain" };

export default async function DecksPage() {
  const userId = await currentUserId();
  if (!userId) redirect("/");

  const [settings, decks] = await Promise.all([
    settingsFor(userId),
    prisma.deck.findMany({
      orderBy: [{ kind: "asc" }, { position: "asc" }],
      select: { id: true, title: true, kind: true, _count: { select: { words: true } } },
    }),
  ]);

  return (
    <DeckPicker
      activeDeckId={settings.activeDeckId}
      decks={decks.map((d) => ({
        id: d.id,
        title: d.title,
        kind: d.kind,
        wordCount: d._count.words,
      }))}
    />
  );
}
