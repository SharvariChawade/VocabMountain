import { redirect } from "next/navigation";
import { currentUserId, settingsFor } from "@/lib/session";
import { StudySession } from "@/components/study/StudySession";

export const dynamic = "force-dynamic";

export default async function StudyPage() {
  const userId = await currentUserId();
  if (!userId) redirect("/");

  const s = await settingsFor(userId);

  return (
    <StudySession
      settings={{
        studyOrder: s.studyOrder,
        sentenceFirst: s.sentenceFirst,
        showRoots: s.showRoots,
        keyboardHints: s.keyboardHints,
        sound: s.sound,
      }}
    />
  );
}
