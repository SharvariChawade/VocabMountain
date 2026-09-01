import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { currentUserId, settingsFor, unauthorized } from "@/lib/session";

export const dynamic = "force-dynamic";

const Patch = z.object({
  dailyGoal: z.union([z.literal(20), z.literal(40), z.literal(60), z.literal(100)]).optional(),
  studyOrder: z.enum(["smart", "inorder", "shuffle"]).optional(),
  sentenceFirst: z.boolean().optional(),
  showRoots: z.boolean().optional(),
  keyboardHints: z.boolean().optional(),
  speech: z.boolean().optional(),
  activeDeckId: z.string().nullable().optional(),
});

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  return Response.json(await settingsFor(userId));
}

export async function PATCH(request: Request) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const parsed = Patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid body", issues: parsed.error.issues }, { status: 400 });
  }

  if (parsed.data.activeDeckId) {
    const deck = await prisma.deck.findUnique({ where: { id: parsed.data.activeDeckId } });
    if (!deck) return Response.json({ error: "unknown deck" }, { status: 400 });
  }

  const saved = await prisma.userSettings.upsert({
    where: { userId },
    create: { userId, ...parsed.data },
    update: parsed.data,
  });
  return Response.json(saved);
}
