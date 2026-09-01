const DICT = "https://api.dictionaryapi.dev/api/v2/entries/en";
const DATAMUSE = "https://api.datamuse.com/words";
const TIMEOUT_MS = Number(process.env.GROUNDING_TIMEOUT_MS ?? 8000);

// dictionaryapi.dev is a free community service and routinely takes 20s+ or hangs.
// Every grounding call is best-effort: a timeout degrades the pool, never the run.
async function get(url: string): Promise<Response | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    return res.ok ? res : null;
  } catch {
    return null;
  }
}

export type Sense = { partOfSpeech: string; definition: string; example?: string };

export type Grounding = {
  term: string;
  found: boolean;
  ipa?: string;
  arpabet?: string;
  senses: Sense[];
  synonymPool: string[];
  antonymPool: string[];
};

type RawEntry = {
  phonetic?: string;
  phonetics?: { text?: string }[];
  meanings?: {
    partOfSpeech?: string;
    definitions?: {
      definition?: string;
      example?: string;
      synonyms?: string[];
      antonyms?: string[];
    }[];
    synonyms?: string[];
    antonyms?: string[];
  }[];
};

async function datamuse(query: string): Promise<string[]> {
  const res = await get(`${DATAMUSE}?${query}&max=25`);
  if (!res) return [];
  return ((await res.json()) as { word: string }[]).map((w) => w.word.toLowerCase());
}

// Arpabet with stress digits, e.g. "AA1 B V IY0 EY0 T". Covers words the dictionary
// API has no entry for at all — obviate returns a 404 there but resolves here.
async function arpabet(term: string): Promise<string | undefined> {
  const res = await get(`${DATAMUSE}?sp=${encodeURIComponent(term)}&md=r&max=1`);
  if (!res) return undefined;
  const rows = (await res.json()) as { word: string; tags?: string[] }[];
  const tag = rows[0]?.tags?.find((t) => t.startsWith("pron:"));
  return tag?.slice(5).trim() || undefined;
}

export async function ground(term: string): Promise<Grounding> {
  const enc = encodeURIComponent(term);
  const [dictRes, dmSyn, dmAnt, dmMeansLike, dmPron] = await Promise.all([
    get(`${DICT}/${enc}`),
    datamuse(`rel_syn=${enc}`),
    datamuse(`rel_ant=${enc}`),
    datamuse(`ml=${enc}`),
    arpabet(term),
  ]);

  const senses: Sense[] = [];
  const synonymPool = new Set<string>([...dmSyn, ...dmMeansLike]);
  const antonymPool = new Set<string>(dmAnt);
  let ipa: string | undefined;

  if (dictRes) {
    for (const entry of (await dictRes.json()) as RawEntry[]) {
      ipa ??= entry.phonetic ?? entry.phonetics?.find((p) => p.text)?.text;
      for (const meaning of entry.meanings ?? []) {
        const pos = meaning.partOfSpeech ?? "unknown";
        for (const s of [...(meaning.synonyms ?? [])]) synonymPool.add(s.toLowerCase());
        for (const a of [...(meaning.antonyms ?? [])]) antonymPool.add(a.toLowerCase());
        for (const d of meaning.definitions ?? []) {
          if (!d.definition) continue;
          for (const s of d.synonyms ?? []) synonymPool.add(s.toLowerCase());
          for (const a of d.antonyms ?? []) antonymPool.add(a.toLowerCase());
          senses.push({ partOfSpeech: pos, definition: d.definition, example: d.example });
        }
      }
    }
  }

  synonymPool.delete(term.toLowerCase());
  antonymPool.delete(term.toLowerCase());

  if (antonymPool.size < 3) {
    const hops = await Promise.all(
      [...synonymPool]
        .slice(0, 8)
        .map((s) => datamuse(`rel_ant=${encodeURIComponent(s)}`)),
    );
    for (const a of hops.flat())
      if (a !== term.toLowerCase() && !synonymPool.has(a)) antonymPool.add(a);
  }

  return {
    term,
    found: senses.length > 0 || synonymPool.size > 0,
    ipa: ipa?.replace(/^\/|\/$/g, ""),
    arpabet: dmPron,
    senses,
    synonymPool: [...synonymPool],
    antonymPool: [...antonymPool],
  };
}

// Sense-targeted pool. `ml=<keywords>&rel_syn=<term>` intersects "means like this
// definition" with "is a synonym of this term", which discriminates senses the raw
// term-level pools cannot — pedestrian returns prosaic/prosy, not walker/footer.
export async function senseTargetedPool(term: string, definition: string) {
  const keywords = definition
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 6)
    .join("+");
  if (!keywords) return { synonyms: [] as string[], antonyms: [] as string[] };

  const enc = encodeURIComponent(term);
  const [narrow, broad, directAnt] = await Promise.all([
    datamuse(`ml=${keywords}&rel_syn=${enc}`),
    datamuse(`ml=${keywords}`),
    datamuse(`ml=${keywords}&rel_ant=${enc}`),
  ]);

  const lower = term.toLowerCase();
  const synonyms = [...new Set([...narrow, ...broad])].filter((w) => w !== lower);

  // GRE words almost never have a direct antonym in Datamuse (rel_ant=laconic is
  // empty), so walk one hop: the antonyms of a word's synonyms are its antonyms.
  const hops = await Promise.all(
    synonyms.slice(0, 8).map((s) => datamuse(`rel_ant=${encodeURIComponent(s)}`)),
  );
  const antonyms = [...new Set([...directAnt, ...hops.flat()])].filter(
    (w) => w !== lower && !synonyms.includes(w),
  );

  return { synonyms, antonyms };
}
