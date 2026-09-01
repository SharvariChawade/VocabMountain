import { prisma } from "@/lib/prisma";
import { currentUserId, unauthorized } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const decks = await prisma.deck.findMany({
    orderBy: [{ kind: "asc" }, { position: "asc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      kind: true,
      position: true,
      _count: { select: { words: true } },
    },
  });

  return Response.json({
    decks: decks.map(({ _count, ...d }) => ({ ...d, wordCount: _count.words })),
  });
}
