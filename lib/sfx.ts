"use client";

export type Cue = "knew" | "again" | "skip" | "caught-up";

const CUES: Cue[] = ["knew", "again", "skip", "caught-up"];
const VOLUME = 0.3;

let clips: Record<Cue, HTMLAudioElement> | null = null;
let enabled = false;

/** Preload on mount. iOS won't let the first play() through without a user
 * gesture — the first swipe is one, so the rejection is expected and ignored. */
export function preloadSfx() {
  if (clips || typeof Audio === "undefined") return;
  clips = Object.fromEntries(
    CUES.map((name) => {
      const audio = new Audio(`/sfx/${name}.wav`);
      audio.preload = "auto";
      audio.volume = VOLUME;
      return [name, audio];
    }),
  ) as Record<Cue, HTMLAudioElement>;
}

export function setSoundEnabled(on: boolean) {
  const quiet =
    typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  enabled = on && !quiet;
}

export function play(name: Cue) {
  if (!enabled || !clips) return;
  const audio = clips[name];
  audio.currentTime = 0;
  void audio.play().catch(() => {});
}
