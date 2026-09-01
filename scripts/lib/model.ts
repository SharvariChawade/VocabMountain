import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { EnrichedWord } from "./schema";

const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";
const RPM = Number(process.env.GEMINI_RPM ?? 10);
const MAX_RETRIES = 6;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const responseJsonSchema = z.toJSONSchema(EnrichedWord, { io: "output" });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Global spacing gate. The free tier counts requests per minute per model, so
// throttling has to be process-wide, not per-worker.
const minGap = 60_000 / RPM;
let nextSlot = 0;
async function slot() {
  const now = Date.now();
  const at = Math.max(now, nextSlot);
  nextSlot = at + minGap;
  if (at > now) await sleep(at - now);
}

function retryDelayMs(err: unknown): number | null {
  const text = err instanceof Error ? err.message : String(err);
  if (!/429|RESOURCE_EXHAUSTED|quota/i.test(text)) return null;
  const m = text.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/) ?? text.match(/retry in (\d+(?:\.\d+)?)s/);
  return m ? Math.ceil(Number(m[1]) * 1000) + 1_000 : 30_000;
}

export async function generate(system: string, prompt: string): Promise<EnrichedWord> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    await slot();
    try {
      const res = await ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: {
          systemInstruction: system,
          responseMimeType: "application/json",
          responseJsonSchema,
          temperature: 0.2,
        },
      });
      const text = res.text;
      if (!text) throw new Error("model returned no text");
      return EnrichedWord.parse(JSON.parse(text));
    } catch (e) {
      lastError = e;
      const wait = retryDelayMs(e);
      if (wait === null || attempt === MAX_RETRIES) throw e;
      console.log(`[${new Date().toISOString()}] rate limited, waiting ${Math.round(wait / 1000)}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
      // Push every worker's next slot out, not just this one — the quota is shared.
      nextSlot = Math.max(nextSlot, Date.now() + wait);
      await sleep(wait);
    }
  }
  throw lastError;
}

export async function listModels() {
  const out: string[] = [];
  for await (const m of await ai.models.list()) if (m.name) out.push(m.name);
  return out;
}
