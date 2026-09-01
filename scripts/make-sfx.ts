/* Generates the four study-loop cues into public/sfx/. Re-run with `pnpm sfx`.
 * Soft sine blips with a fast exponential decay and a one-pole lowpass — short
 * and dull enough to read as UI feedback rather than melody. */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const RATE = 44100;
const OUT = join(process.cwd(), "public", "sfx");

type Partial_ = { from: number; to: number; at: number; for: number; gain: number };

function render(durationMs: number, partials: Partial_[]): Float32Array {
  const n = Math.round((durationMs / 1000) * RATE);
  const buf = new Float32Array(n);

  for (const p of partials) {
    const start = Math.round((p.at / 1000) * RATE);
    const len = Math.round((p.for / 1000) * RATE);
    let phase = 0;
    for (let i = 0; i < len && start + i < n; i++) {
      const t = i / len;
      const freq = p.from + (p.to - p.from) * t;
      phase += (2 * Math.PI * freq) / RATE;
      // 4ms raised-cosine attack kills the click, then decay to silence.
      const attack = Math.min(1, i / (0.004 * RATE));
      const env = attack * Math.exp(-4.5 * t) * (1 - t);
      buf[start + i] += Math.sin(phase) * env * p.gain;
    }
  }

  // One-pole lowpass — takes the glassy edge off the sine tops.
  let prev = 0;
  for (let i = 0; i < n; i++) {
    prev += 0.35 * (buf[i] - prev);
    buf[i] = prev;
  }
  return buf;
}

function wav(samples: Float32Array): Buffer {
  const data = Buffer.alloc(samples.length * 2);
  let peak = 0;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  const norm = peak > 0 ? 0.55 / peak : 0; // headroom; lib/sfx.ts drops it further
  for (let i = 0; i < samples.length; i++) {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i] * norm)) * 32767), i * 2);
  }

  const head = Buffer.alloc(44);
  head.write("RIFF", 0);
  head.writeUInt32LE(36 + data.length, 4);
  head.write("WAVE", 8);
  head.write("fmt ", 12);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20); // PCM
  head.writeUInt16LE(1, 22); // mono
  head.writeUInt32LE(RATE, 24);
  head.writeUInt32LE(RATE * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write("data", 36);
  head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}

const CUES: Record<string, { ms: number; partials: Partial_[] }> = {
  // Up a small step — "yes, onward".
  knew: {
    ms: 180,
    partials: [
      { from: 620, to: 700, at: 0, for: 70, gain: 1 },
      { from: 880, to: 940, at: 55, for: 120, gain: 0.8 },
    ],
  },
  // Down and dull — a soft "not that one", never a buzzer.
  again: {
    ms: 200,
    partials: [
      { from: 300, to: 210, at: 0, for: 170, gain: 1 },
      { from: 150, to: 105, at: 0, for: 170, gain: 0.45 },
    ],
  },
  // Neutral tick, deliberately the quietest and shortest of the four.
  skip: {
    ms: 90,
    partials: [{ from: 520, to: 480, at: 0, for: 70, gain: 0.7 }],
  },
  // Three rising notes. The only cue allowed to feel like a small reward.
  "caught-up": {
    ms: 290,
    partials: [
      { from: 620, to: 620, at: 0, for: 110, gain: 0.9 },
      { from: 780, to: 780, at: 80, for: 110, gain: 0.9 },
      { from: 1040, to: 1040, at: 160, for: 130, gain: 1 },
    ],
  },
};

mkdirSync(OUT, { recursive: true });
for (const [name, cue] of Object.entries(CUES)) {
  const file = join(OUT, `${name}.wav`);
  writeFileSync(file, wav(render(cue.ms, cue.partials)));
  console.log(`wrote ${file}`);
}
