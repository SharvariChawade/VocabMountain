import { prisma } from "@/lib/prisma";
import { currentUserId, unauthorized } from "@/lib/session";
import { stageOf } from "@/lib/stage";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: RouteContext<"/api/words/[id]">) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const { id } = await ctx.params;
  const word = await prisma.word.findUnique({
    where: { id },
    include: {
      cards: { where: { userId }, take: 1 },
      confusable: { include: { to: { select: { id: true, term: true } } } },
      decks: { include: { deck: { select: { slug: true, title: true, kind: true } } } },
    },
  });
  if (!word) return Response.json({ error: "not found" }, { status: 404 });

  const [seen, knew] = await Promise.all([
    prisma.review.count({ where: { userId, wordId: id } }),
    prisma.review.count({ where: { userId, wordId: id, grade: "KNEW" } }),
  ]);

  const { cards, confusable, decks, ...rest } = word;
  return Response.json({
    ...rest,
    card: cards[0] ?? null,
    stage: stageOf(cards[0]),
    confusableWith: confusable.map((c) => c.to),
    decks: decks.map((d) => d.deck),
    stats: { seen, knewRate: seen ? Math.round((knew / seen) * 100) : null },
  });
}
