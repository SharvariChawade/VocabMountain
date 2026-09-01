import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SeedWord } from "./enrich";

async function main() {
  const words: SeedWord[] = JSON.parse(
    await readFile(path.join(process.cwd(), "prisma/seed/words.json"), "utf8"),
  );

  const terms = new Set(words.map((w) => w.term));
  const errors: string[] = [];
  const fail = (w: SeedWord, msg: string) =>
    errors.push(`${w.term} (group ${w.group}): ${msg}`);

  // Matches the term plus common English inflections, so "laconically" is caught for "laconic".
  const inflected = (term: string) =>
    new RegExp(
      `\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(s|es|ed|d|ing|ly|ness|ion|tion)?\\b`,
      "i",
    );

  for (const w of words) {
    if (!w.blank.includes("______")) fail(w, "blank has no ______");
    if (inflected(w.term).test(w.blank.replace("______", "")))
      fail(w, "blank leaks the answer word");
    if (!inflected(w.term).test(w.example))
      fail(w, "example does not contain the term");
    if (inflected(w.term).test(w.meaning)) fail(w, "meaning restates the term");
    if (w.synonyms.length < 2) fail(w, `only ${w.synonyms.length} synonyms`);
    if (w.antonyms.length < 1) fail(w, "no antonyms");
    if (w.synonyms.some((s) => s.toLowerCase() === w.term))
      fail(w, "term listed as its own synonym");
    if (
      new Set(w.synonyms.map((s) => s.toLowerCase())).size !== w.synonyms.length
    )
      fail(w, "duplicate synonyms");
    for (const c of w.confusableWith)
      if (!terms.has(c.toLowerCase()))
        fail(w, `confusableWith "${c}" is not in the corpus`);
    if (!w.pronunciation) fail(w, "no pronunciation");
    if (!w.meaning.trim()) fail(w, "empty meaning");
  }

  const byTerm = new Map(words.map((w) => [w.term, w]));
  for (const w of words)
    for (const c of w.confusableWith)
      if (
        byTerm.get(c.toLowerCase()) &&
        !byTerm.get(c.toLowerCase())!.confusableWith.includes(w.term)
      )
        errors.push(`${w.term} -> ${c} is not symmetric`);

  const review = words.filter((w) => w.needsReview.length);
  console.log(`${words.length} words checked`);
  console.log(`hard failures: ${errors.length}`);
  console.log(`soft flags (review, non-blocking): ${review.length}`);
  console.log(
    `  unverified synonyms: ${words.filter((w) => w.ungroundedSynonyms.length).length}`,
  );
  console.log(
    `  unverified antonyms: ${words.filter((w) => w.ungroundedAntonyms.length).length}`,
  );
  console.log(
    `  low/medium root confidence: ${words.filter((w) => w.rootConfidence !== "high").length}`,
  );
  console.log(
    `  sense ungrounded: ${words.filter((w) => w.senseIndex < 0).length}`,
  );

  if (errors.length) {
    console.error(`\n${errors.join("\n")}`);
    process.exit(1);
  }
}

main();
