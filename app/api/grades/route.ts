import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { currentUserId, unauthorized } from "@/lib/session";
import { addDays, schedule } from "@/lib/scheduler";

export const dynamic = "force-dynamic";

const Body = z.object({
  grades: z
    .array(
      z.object({
        id: z.string().min(1),
        wordId: z.string().min(1),
        grade: z.enum(["AGAIN", "KNEW"]),
        revealed: z.boolean(),
        ms: z.number().int().min(0).max(600_000),
        hook: z.string().max(2000).optional(),
        gradedAt: z.iso.datetime().optional(),
      }),
    )
    .min(1)
    .max(200),
});

const Bury = z.object({ wordId: z.string().min(1), bury: z.literal(true) });

export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const json = await request.json().catch(() => null);

  const bury = Bury.safeParse(json);
  if (bury.success) {
    const now = new Date();
    await prisma.card.upsert({
      where: { userId_wordId: { userId, wordId: bury.data.wordId } },
      create: { userId, wordId: bury.data.wordId, buriedUntil: addDays(now, 1), dueAt: now },
      update: { buriedUntil: addDays(now, 1) },
    });
    return Response.json({ buried: bury.data.wordId });
  }

  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "invalid body", issues: parsed.error.issues }, { status: 400 });
  }

  // Client-minted ids make the flush idempotent: a retried batch after a dropped
  // connection replays as a no-op instead of double-advancing the schedule.
  const ids = parsed.data.grades.map((g) => g.id);
  const seen = new Set(
    (
      await prisma.review.findMany({ where: { id: { in: ids } }, select: { id: true } })
    ).map((r) => r.id),
  );

  const fresh = parsed.data.grades.filter((g) => !seen.has(g.id));
  let applied = 0;

  for (const g of fresh) {
    const at = g.gradedAt ? new Date(g.gradedAt) : new Date();
    await prisma.$transaction(async (tx) => {
      const card =
        (await tx.card.findUnique({ where: { userId_wordId: { userId, wordId: g.wordId } } })) ??
        { reviews: 0, lapses: 0, ease: 2.5, intervalDays: 0 };

      const patch = schedule(card, g.grade, g.revealed, at);

      await tx.card.upsert({
        where: { userId_wordId: { userId, wordId: g.wordId } },
        create: {
          userId,
          wordId: g.wordId,
          ...patch,
          buriedUntil: null,
          ...(g.hook?.trim() ? { hook: g.hook.trim() } : {}),
        },
        update: {
          ...patch,
          buriedUntil: null,
          // An empty hook field must not wipe a hook written on an earlier pass.
          ...(g.hook?.trim() ? { hook: g.hook.trim() } : {}),
        },
      });

      await tx.review.create({
        data: {
          id: g.id,
          userId,
          wordId: g.wordId,
          grade: g.grade,
          revealed: g.revealed,
          ms: g.ms,
          createdAt: at,
        },
      });
    });
    applied++;
  }

  return Response.json({ applied, duplicates: parsed.data.grades.length - applied });
}
