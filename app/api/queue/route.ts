import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserId, settingsFor, unauthorized } from "@/lib/session";
import { LAPSE_THRESHOLD, stageOf } from "@/lib/stage";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const WORD_FIELDS = {
  id: true,
  term: true,
  pronunciation: true,
  partOfSpeech: true,
  meaning: true,
  example: true,
  blank: true,
  root: true,
  synonyms: true,
  antonyms: true,
} satisfies Prisma.WordSelect;

export async function GET(request: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const settings = await settingsFor(userId);
  const url = request.nextUrl.searchParams;
  const order = url.get("order") ?? settings.studyOrder;
  const ahead = url.get("ahead") === "true";
  const limit = Math.min(Number(url.get("limit") ?? settings.dailyGoal), 200);
  const now = new Date();

  const deckFilter: Prisma.WordWhereInput = settings.activeDeckId
    ? { decks: { some: { deckId: settings.activeDeckId } } }
    : {};

  // A word with no Card row has never been seen, so "due" means due-or-absent.
  const notBuried: Prisma.WordWhereInput = {
    OR: [
      { cards: { none: { userId } } },
      {
        cards: {
          some: {
            userId,
            ...(ahead ? {} : { dueAt: { lte: now } }),
            OR: [{ buriedUntil: null }, { buriedUntil: { lte: now } }],
          },
        },
      },
    ],
  };

  const where: Prisma.WordWhereInput = { AND: [deckFilter, notBuried] };

  const words = await prisma.word.findMany({
    where,
    select: {
      ...WORD_FIELDS,
      cards: { where: { userId }, take: 1 },
      decks: settings.activeDeckId
        ? { where: { deckId: settings.activeDeckId }, select: { position: true }, take: 1 }
        : { select: { position: true, deck: { select: { position: true } } }, take: 1 },
    },
    take: order === "shuffle" ? 500 : limit * 3,
  });

  const rows = words.map((w) => {
    const { cards, decks, ...word } = w;
    const card = cards[0] ?? null;
    return {
      word,
      card,
      stage: stageOf(card),
      deckPosition: decks[0]?.position ?? 0,
      // deck.position only comes back on the unscoped select above.
      groupPosition:
        decks[0] && "deck" in decks[0] ? (decks[0].deck?.position ?? 0) : 0,
    };
  });

  const sorted =
    order === "inorder"
      ? rows.sort((a, b) => a.groupPosition - b.groupPosition || a.deckPosition - b.deckPosition)
      : order === "shuffle"
        ? shuffle(rows)
        : rows.sort(smartOrder);

  return Response.json({
    order,
    ahead,
    queue: sorted.slice(0, limit),
    remaining: sorted.length,
  });
}

type Orderable = { card: { lapses: number; dueAt: Date } | null };

// Smart: keeps-slipping first, then due today by how overdue, then new.
function smartOrder(a: Orderable, b: Orderable) {
  return rank(a) - rank(b) || dueTime(a) - dueTime(b);
}

function rank(r: Orderable) {
  if (!r.card) return 2;
  return r.card.lapses >= LAPSE_THRESHOLD ? 0 : 1;
}

function dueTime(r: Orderable) {
  return r.card ? new Date(r.card.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
