import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ground, senseTargetedPool } from "./lib/dictionary";
import { EnrichedWord, SYSTEM, userPrompt } from "./lib/schema";
import { generate } from "./lib/model";
import type { ListEntry } from "./fetch-list";

const SEED = path.join(process.cwd(), "prisma/seed");
const CACHE = path.join(SEED, ".cache");
const CONCURRENCY = Number(process.env.ENRICH_CONCURRENCY ?? 4);

export type SeedWord = ListEntry &
  Omit<EnrichedWord, "exampleMarked"> & {
    example: string;
    blank: string;
    ungroundedSynonyms: string[];
    ungroundedAntonyms: string[];
    needsReview: string[];
  };

async function cached(term: string): Promise<SeedWord | null> {
  try {
    return JSON.parse(await readFile(path.join(CACHE, `${term}.json`), "utf8"));
  } catch {
    return null;
  }
}

function splitMarked(marked: string, term: string) {
  const m = marked.match(/\{\{(.+?)\}\}/);
  if (!m) throw new Error(`${term}: exampleMarked has no {{...}} marker`);
  return {
    example: marked.replace(/\{\{(.+?)\}\}/, "$1"),
    blank: marked.replace(/\{\{.+?\}\}/, "______"),
  };
}

async function enrich(entry: ListEntry, corpus: Set<string>): Promise<SeedWord> {
  const hit = await cached(entry.term);
  if (hit) return hit;

  const g = await ground(entry.term);
  const review: string[] = [];
  if (!g.senses.length) review.push("no dictionary senses — sense choice is ungrounded");
  if (!g.ipa && !g.arpabet) review.push("no IPA or Arpabet — pronunciation unavailable");

  const w = await generate(SYSTEM, userPrompt(g));

  // Grounding is verified against a sense-targeted pool, never taken from the
  // model's own claim — a self-reported grounding flag proves nothing.
  const targeted = await senseTargetedPool(entry.term, w.senseGloss || w.meaning);
  const antOk = new Set([...g.antonymPool, ...targeted.antonyms]);
  // A "means like this definition" query returns opposites too — verbose comes back
  // for laconic. Subtracting the antonym set keeps verification from rubber-stamping
  // a synonym that is actually an antonym.
  const synOk = new Set(
    [...g.synonymPool, ...targeted.synonyms].filter((s) => !antOk.has(s)),
  );
  const ungroundedSynonyms = w.synonyms.filter((s) => !synOk.has(s.toLowerCase()));
  const ungroundedAntonyms = w.antonyms.filter((a) => !antOk.has(a.toLowerCase()));

  const { example, blank } = splitMarked(w.exampleMarked, entry.term);
  if (w.senseIndex < 0 && g.senses.length) review.push("model rejected every dictionary sense");
  if (ungroundedSynonyms.length) review.push(`unverified synonyms: ${ungroundedSynonyms.join(", ")}`);
  if (ungroundedAntonyms.length) review.push(`unverified antonyms: ${ungroundedAntonyms.join(", ")}`);
  if (w.rootConfidence !== "high") review.push(`root confidence ${w.rootConfidence}: "${w.root}"`);

  // PRD models confusableWith as word ids, so an out-of-corpus trap is not
  // representable — drop rather than fail (sanguine/sanguinary is real, but
  // sanguinary is not on GregMat's list).
  const confusableWith = w.confusableWith.filter((c) => corpus.has(c.toLowerCase()));

  const { exampleMarked: _drop, ...rest } = w;
  const out: SeedWord = {
    ...entry,
    ...rest,
    confusableWith,
    example,
    blank,
    ungroundedSynonyms,
    ungroundedAntonyms,
    needsReview: review,
  };

  await mkdir(CACHE, { recursive: true });
  await writeFile(path.join(CACHE, `${entry.term}.json`), JSON.stringify(out, null, 2));
  return out;
}

async function main() {
  const list: ListEntry[] = JSON.parse(await readFile(path.join(SEED, "list.json"), "utf8"));
  const only = process.argv.slice(2);
  const targets = only.length ? list.filter((e) => only.includes(e.term)) : list;
  const corpus = new Set(list.map((e) => e.term));

  const results: SeedWord[] = [];
  const failed: { term: string; error: string }[] = [];
  let done = 0;

  const started = Date.now();
  const log = (m: string) => console.log(`[${new Date().toISOString()}] ${m}`);
  log(`start: ${targets.length} words, concurrency ${CONCURRENCY}`);

  const queue = [...targets];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let entry = queue.shift(); entry; entry = queue.shift()) {
        try {
          const w = await enrich(entry, corpus);
          results.push(w);
          const flags = w.needsReview.length ? ` FLAG ${w.needsReview.join("; ")}` : "";
          log(`${++done}/${targets.length} g${w.group} ${w.term}${flags}`);
        } catch (e) {
          const error = e instanceof Error ? e.message : String(e);
          failed.push({ term: entry.term, error });
          log(`${++done}/${targets.length} g${entry.group} ${entry.term} ERROR ${error}`);
        }
      }
    }),
  );

  results.sort((a, b) => a.group - b.group || a.position - b.position);
  if (!only.length) await writeFile(path.join(SEED, "words.json"), JSON.stringify(results, null, 2));

  const mins = ((Date.now() - started) / 60000).toFixed(1);
  log(`done in ${mins}m — enriched ${results.length}/${targets.length}, failed ${failed.length}`);
  log(`flagged for review: ${results.filter((r) => r.needsReview.length).length}`);
  log(`  unverified synonyms: ${results.filter((r) => r.ungroundedSynonyms.length).length}`);
  log(`  unverified antonyms: ${results.filter((r) => r.ungroundedAntonyms.length).length}`);
  log(`  sense ungrounded (no dictionary entry): ${results.filter((r) => r.senseIndex < 0).length}`);
  log(`  root confidence not high: ${results.filter((r) => r.rootConfidence !== "high").length}`);
  if (only.length) console.log(JSON.stringify(results, null, 2));
  if (failed.length) {
    log(`failed (${failed.length}) — rerun to retry, cache keeps the rest:`);
    for (const f of failed) log(`  ${f.term}: ${f.error}`);
  }
}

main();
