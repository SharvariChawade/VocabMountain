import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserId, unauthorized } from "@/lib/session";
import { stageOf, stageWhere, type Stage } from "@/lib/stage";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const STAGES: Stage[] = ["new", "shaky", "solid", "slipping"];

export async function GET(request: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const p = request.nextUrl.searchParams;
  const q = p.get("q")?.trim();
  const filter = p.get("filter") ?? "all";
  const take = Math.min(Number(p.get("limit") ?? 50), 200);
  const cursor = p.get("cursor");
  const now = new Date();

  const search: Prisma.WordWhereInput = q
    ? {
        OR: [
          { term: { contains: q, mode: "insensitive" } },
          { meaning: { contains: q, mode: "insensitive" } },
          { pronunciation: { contains: q, mode: "insensitive" } },
          { root: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  let cardFilter: Prisma.WordWhereInput = {};
  if (filter === "due") {
    cardFilter = { cards: { some: { userId, dueAt: { lte: now } } } };
  } else if (filter === "wrong") {
    // Sharvarii's "filter all wrongs" — every word ever missed, not just the
    // chronic ones that reach the keeps-slipping threshold.
    cardFilter = { cards: { some: { userId, lapses: { gt: 0 } } } };
  } else if (STAGES.includes(filter as Stage)) {
    cardFilter =
      filter === "new"
        ? { OR: [{ cards: { none: { userId } } }, { cards: { some: { userId, reviews: 0 } } }] }
        : { cards: { some: { userId, ...stageWhere(filter as Stage) } } };
  }

  const rows = await prisma.word.findMany({
    where: { AND: [search, cardFilter] },
    include: { cards: { where: { userId }, take: 1 } },
    orderBy: { term: "asc" },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const page = rows.slice(0, take);
  return Response.json({
    words: page.map(({ cards, ...word }) => ({
      ...word,
      card: cards[0] ?? null,
      stage: stageOf(cards[0]),
    })),
    nextCursor: rows.length > take ? page[page.length - 1]?.id : null,
  });
}
