import { prisma } from "@/lib/prisma";
import { currentUserId, unauthorized } from "@/lib/session";
import { LAPSE_THRESHOLD } from "@/lib/stage";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const since = new Date(Date.now() - 27 * DAY);
  const [seen, knew, firstTry, slipping, reviews] = await Promise.all([
    prisma.card.count({ where: { userId, reviews: { gt: 0 } } }),
    prisma.review.count({ where: { userId, grade: "KNEW" } }),
    prisma.review.count({ where: { userId, grade: "KNEW", revealed: false } }),
    prisma.card.count({ where: { userId, lapses: { gte: LAPSE_THRESHOLD } } }),
    prisma.review.findMany({
      where: { userId, createdAt: { gte: since } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const total = await prisma.review.count({ where: { userId } });

  const perDay = new Map<string, number>();
  for (const r of reviews) perDay.set(dayKey(r.createdAt), (perDay.get(dayKey(r.createdAt)) ?? 0) + 1);

  const days = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(Date.now() - (27 - i) * DAY);
    return { date: dayKey(d), count: perDay.get(dayKey(d)) ?? 0 };
  });

  // Streak walks backwards from today; today not yet studied doesn't break it.
  let streak = 0;
  for (let i = 0; ; i++) {
    const key = dayKey(new Date(Date.now() - i * DAY));
    if (perDay.has(key)) streak++;
    else if (i > 0) break;
  }

  return Response.json({
    wordsSeen: seen,
    knewRate: total ? Math.round((knew / total) * 100) : null,
    firstTryRate: total ? Math.round((firstTry / total) * 100) : null,
    keepsSlipping: slipping,
    streak,
    days,
  });
}
