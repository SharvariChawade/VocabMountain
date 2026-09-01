import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import type { SeedWord } from "../scripts/enrich";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL }),
});

async function main() {
  const words: SeedWord[] = JSON.parse(
    await readFile(path.join(process.cwd(), "prisma/seed/words.json"), "utf8"),
  );

  const idByTerm = new Map<string, string>();

  for (const w of words) {
    const row = await prisma.word.upsert({
      where: { term: w.term },
      create: {
        term: w.term,
        pronunciation: w.pronunciation,
        partOfSpeech: w.partOfSpeech,
        meaning: w.meaning,
        example: w.example,
        blank: w.blank,
        root: w.root,
        synonyms: w.synonyms,
        antonyms: w.antonyms,
      },
      update: {
        pronunciation: w.pronunciation,
        partOfSpeech: w.partOfSpeech,
        meaning: w.meaning,
        example: w.example,
        blank: w.blank,
        root: w.root,
        synonyms: w.synonyms,
        antonyms: w.antonyms,
      },
    });
    idByTerm.set(w.term, row.id);
  }

  const groups = [...new Set(words.map((w) => w.group))].sort((a, b) => a - b);

  for (const g of groups) {
    const deck = await prisma.deck.upsert({
      where: { slug: `group-${g}` },
      create: {
        slug: `group-${g}`,
        title: `Group ${g}`,
        kind: "GROUP",
        position: g,
      },
      update: { title: `Group ${g}`, position: g },
    });
    const members = words.filter((w) => w.group === g);
    await prisma.deckWord.deleteMany({ where: { deckId: deck.id } });
    await prisma.deckWord.createMany({
      data: members.map((w, i) => ({
        deckId: deck.id,
        wordId: idByTerm.get(w.term)!,
        position: i,
      })),
    });
  }

  const all = await prisma.deck.upsert({
    where: { slug: "gregmat-all" },
    create: {
      slug: "gregmat-all",
      title: "GregMat — all words",
      kind: "CURATED",
      position: 0,
    },
    update: { title: "GregMat — all words" },
  });
  await prisma.deckWord.deleteMany({ where: { deckId: all.id } });
  await prisma.deckWord.createMany({
    data: words.map((w, i) => ({
      deckId: all.id,
      wordId: idByTerm.get(w.term)!,
      position: i,
    })),
  });

  const pairs = words.flatMap((w) =>
    w.confusableWith
      .map((c) => c.toLowerCase())
      .filter((c) => idByTerm.has(c))
      .flatMap((c) => [
        { fromId: idByTerm.get(w.term)!, toId: idByTerm.get(c)! },
        { fromId: idByTerm.get(c)!, toId: idByTerm.get(w.term)! },
      ]),
  );
  await prisma.confusable.createMany({ data: pairs, skipDuplicates: true });

  console.log(
    `${words.length} words, ${groups.length} group decks, ${pairs.length} confusable edges`,
  );
  await prisma.$disconnect();
}

main();
