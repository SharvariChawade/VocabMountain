import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SeedWord } from "./enrich";

const SEED = path.join(process.cwd(), "prisma/seed");
const CACHE = path.join(SEED, ".cache");

async function main() {
  const files = (await readdir(CACHE)).filter((f) => f.endsWith(".json"));
  const words: SeedWord[] = [];
  for (const f of files) words.push(JSON.parse(await readFile(path.join(CACHE, f), "utf8")));

  // Re-applied here, not just in enrich, so a cache entry written before the rule
  // existed still assembles cleanly.
  const corpus = new Set(words.map((w) => w.term));
  let dropped = 0;
  for (const w of words) {
    const kept = w.confusableWith.filter((c) => corpus.has(c.toLowerCase()));
    dropped += w.confusableWith.length - kept.length;
    w.confusableWith = kept;
  }

  words.sort((a, b) => a.group - b.group || a.position - b.position);
  await writeFile(path.join(SEED, "words.json"), JSON.stringify(words, null, 2));

  const groups = new Set(words.map((w) => w.group));
  console.log(`collected ${words.length} words across ${groups.size} groups -> prisma/seed/words.json`);
  console.log(`flagged: ${words.filter((w) => w.needsReview.length).length}`);
  if (dropped) console.log(`dropped ${dropped} out-of-corpus confusable refs`);
}

main();
