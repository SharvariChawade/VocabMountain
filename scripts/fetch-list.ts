import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const PRIMARY_REPO = "div652/gre-vocab";
const CROSSCHECK_URL =
  "https://raw.githubusercontent.com/AyushBalyan/vocab_mountain/HEAD/gregMat_vocab.json";
const OUT = path.join(process.cwd(), "prisma/seed/list.json");

export type ListEntry = { term: string; group: number; position: number };

async function fetchPrimary(): Promise<Map<string, number>> {
  const tree = await fetch(
    `https://api.github.com/repos/${PRIMARY_REPO}/git/trees/HEAD?recursive=1`,
  ).then((r) => r.json() as Promise<{ tree: { path: string; type: string }[] }>);

  const files = tree.tree
    .filter((n) => n.type === "blob" && /^bank\/gregmat\d+__b\d+\.json$/.test(n.path))
    .map((n) => n.path)
    .sort();

  const out = new Map<string, number>();
  for (const file of files) {
    const unit = (await fetch(
      `https://raw.githubusercontent.com/${PRIMARY_REPO}/HEAD/${file}`,
    ).then((r) => r.json())) as { gregmat_group: number; words: string[] };
    for (const w of unit.words) {
      const term = w.trim().toLowerCase();
      if (!out.has(term)) out.set(term, unit.gregmat_group);
    }
  }
  return out;
}

async function fetchCrosscheck(): Promise<Map<string, number>> {
  const rows = (await fetch(CROSSCHECK_URL).then((r) => r.json())) as {
    word: string;
    group: number;
  }[];
  const out = new Map<string, number>();
  for (const r of rows) {
    const term = r.word.trim().toLowerCase();
    if (!out.has(term)) out.set(term, r.group);
  }
  return out;
}

async function main() {
  const [primary, crosscheck] = await Promise.all([fetchPrimary(), fetchCrosscheck()]);

  const conflicts: string[] = [];
  const onlyInCrosscheck: string[] = [];
  for (const [term, group] of crosscheck) {
    const mine = primary.get(term);
    if (mine === undefined) onlyInCrosscheck.push(term);
    else if (mine !== group) conflicts.push(`${term}: primary=${mine} crosscheck=${group}`);
  }

  const byGroup = new Map<number, string[]>();
  for (const [term, group] of primary) {
    if (!byGroup.has(group)) byGroup.set(group, []);
    byGroup.get(group)!.push(term);
  }

  const list: ListEntry[] = [];
  for (const group of [...byGroup.keys()].sort((a, b) => a - b)) {
    byGroup.get(group)!.forEach((term, i) => list.push({ term, group, position: i }));
  }

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(list, null, 2));

  console.log(`${list.length} words across ${byGroup.size} groups -> ${OUT}`);
  console.log(
    `cross-check agreement: ${crosscheck.size - conflicts.length - onlyInCrosscheck.length}/${crosscheck.size}`,
  );
  if (conflicts.length) console.warn(`group conflicts (review):\n  ${conflicts.join("\n  ")}`);
  if (onlyInCrosscheck.length)
    console.warn(`in cross-check only (likely retired by GregMat): ${onlyInCrosscheck.join(", ")}`);
}

main();
