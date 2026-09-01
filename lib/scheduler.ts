import type { Card, Grade } from "@/generated/prisma/client";

export const MIN_EASE = 1.3;
const EASE_PENALTY = 0.2;
const REVEALED_DAMPENER = 0.6;

export type SchedulerInput = Pick<Card, "reviews" | "lapses" | "ease" | "intervalDays">;
export type SchedulerPatch = Pick<Card, "reviews" | "lapses" | "ease" | "intervalDays" | "dueAt" | "lastGrade">;

export function addDays(from: Date, days: number) {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

// Two-way grading. `revealed` is the second axis: a card answered correctly only
// after the meaning was shown grows more slowly than one recalled cold, which is
// what the removed "Almost" button used to express.
export function schedule(card: SchedulerInput, grade: Grade, revealed: boolean, now = new Date()): SchedulerPatch {
  if (grade === "AGAIN") {
    return {
      reviews: card.reviews + 1,
      lapses: card.lapses + 1,
      ease: Math.max(MIN_EASE, card.ease - EASE_PENALTY),
      intervalDays: 1,
      dueAt: addDays(now, 1),
      lastGrade: "AGAIN",
    };
  }

  const multiplier = card.ease * (revealed ? REVEALED_DAMPENER : 1);
  const intervalDays =
    card.intervalDays === 0
      ? revealed
        ? 1
        : 2
      : Math.max(1, Math.round(card.intervalDays * multiplier));

  return {
    reviews: card.reviews + 1,
    lapses: card.lapses,
    ease: card.ease,
    intervalDays,
    dueAt: addDays(now, intervalDays),
    lastGrade: "KNEW",
  };
}
