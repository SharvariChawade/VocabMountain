import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentUserId, settingsFor } from "@/lib/session";
import { StudySession } from "@/components/study/StudySession";

export const dynamic = "force-dynamic";

export default async function StudyPage() {
  const userId = await currentUserId();
  if (!userId) redirect("/");

  const [s, groups] = await Promise.all([
    settingsFor(userId),
    prisma.deck.findMany({
      where: { kind: "GROUP" },
      orderBy: { position: "asc" },
      select: { id: true, title: true, _count: { select: { words: true } } },
    }),
  ]);

  return (
    <StudySession
      settings={{
        studyOrder: s.studyOrder,
        sentenceFirst: s.sentenceFirst,
        showRoots: s.showRoots,
        keyboardHints: s.keyboardHints,
        sound: s.sound,
      }}
      activeDeckId={s.activeDeckId}
      groups={groups.map((group) => ({
        id: group.id,
        title: group.title,
        wordCount: group._count.words,
      }))}
    />
  );
}
