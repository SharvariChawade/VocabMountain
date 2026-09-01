import { z } from "zod";

export const EnrichedWord = z.object({
  senseIndex: z
    .number()
    .int()
    .describe("Index into the provided senses array that the GRE tests. -1 if none fit."),
  senseGloss: z
    .string()
    .describe("The chosen sense restated in 3-8 words. Drives the grounding lookup, so be literal."),
  partOfSpeech: z.string().describe("Part of speech of the chosen sense, lowercase."),
  meaning: z
    .string()
    .describe("The chosen sense in plain English, under 12 words. No jargon, no restating the term."),
  pronunciation: z
    .string()
    .describe("Respelling derived from the supplied IPA, e.g. luh-KON-ik. Stressed syllable uppercase."),
  exampleMarked: z
    .string()
    .describe(
      "One natural sentence, 8-20 words, using the term in the chosen sense, with the term (in whatever inflected form appears) wrapped in {{ }}.",
    ),
  root: z
    .string()
    .describe("Terse morpheme gloss, e.g. 'ob- against + via way'. Empty string if the etymology is unclear."),
  rootConfidence: z.enum(["high", "medium", "low"]),
  synonyms: z.array(z.string()).min(2).max(4),
  antonyms: z.array(z.string()).min(1).max(3),
  confusableWith: z.array(z.string()).max(3).describe("Terms test-takers swap with this one. Usually empty."),
});

export type EnrichedWord = z.infer<typeof EnrichedWord>;

export const SYSTEM = `You produce GRE vocabulary flashcard data. Accuracy outranks everything else — a wrong synonym on a GRE card is worse than no card.

Rules:
1. Pick the sense the GRE actually tests. It is often not the common sense: "pedestrian" is tested as dull, not as a walker. Set senseIndex to that sense; every other field describes only that sense. If the senses list is empty, work from the candidate pools and set senseIndex to -1.
2. Prefer synonyms and antonyms that appear in the candidate pools, and only ones that fit the sense you chose — the pools are drawn from every sense of the term, so some will be irrelevant. Add a word outside the pools only when the pools cannot supply a correct one. Never pad to reach the minimum with a word you would not defend.
3. exampleMarked must wrap the term in {{ }} — whatever inflected form appears, so {{laconically}}, not {{laconic}}. The term must not appear anywhere else in the sentence.
4. pronunciation is a transliteration of the supplied IPA, or of the Arpabet if no IPA is given (stress digit 1 marks the syllable to uppercase). Do not guess from spelling. Return an empty string only when neither is supplied.
5. root: only claim morphemes you are confident about. Folk etymology is worse than nothing — return an empty string with rootConfidence "low" rather than a plausible invention.
6. meaning is plain English a test-taker reads once. Never reuse the term or its cognates in its own definition.
7. confusableWith is for genuine meaning traps a test-taker could pick wrongly (profligate/prolific, venal/venial), not mere spelling lookalikes. Default to an empty array.`;

export function userPrompt(g: {
  term: string;
  ipa?: string;
  arpabet?: string;
  senses: { partOfSpeech: string; definition: string; example?: string }[];
  synonymPool: string[];
  antonymPool: string[];
}) {
  return [
    `TERM: ${g.term}`,
    `IPA: ${g.ipa ?? "(none supplied)"}`,
    `ARPABET: ${g.arpabet ?? "(none supplied)"}`,
    "",
    "SENSES:",
    ...(g.senses.length
      ? g.senses.map(
          (s, i) =>
            `  [${i}] (${s.partOfSpeech}) ${s.definition}${s.example ? ` — e.g. "${s.example}"` : ""}`,
        )
      : ["  (no dictionary entry found)"]),
    "",
    `SYNONYM CANDIDATES: ${g.synonymPool.join(", ") || "(none)"}`,
    `ANTONYM CANDIDATES: ${g.antonymPool.join(", ") || "(none)"}`,
  ].join("\n");
}
