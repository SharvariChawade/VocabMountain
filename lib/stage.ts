import type { Card, Prisma } from "@/generated/prisma/client";

export const LAPSE_THRESHOLD = 6;
export const SOLID_DAYS = 21;

export type Stage = "new" | "shaky" | "solid" | "slipping";

export const STAGE_LABEL: Record<Stage, string> = {
  new: "New",
  shaky: "Shaky",
  solid: "Solid",
  slipping: "Keeps slipping",
};

export type StageInput = Pick<Card, "reviews" | "lapses" | "intervalDays">;

export function stageOf(card: StageInput | null | undefined): Stage {
  if (!card || card.reviews === 0) return "new";
  if (card.lapses >= LAPSE_THRESHOLD) return "slipping";
  if (card.intervalDays >= SOLID_DAYS) return "solid";
  return "shaky";
}

// Kept in lockstep with stageOf so Browse filters and card labels can never disagree.
export function stageWhere(stage: Stage): Prisma.CardWhereInput {
  switch (stage) {
    case "new":
      return { reviews: 0 };
    case "slipping":
      return { reviews: { gt: 0 }, lapses: { gte: LAPSE_THRESHOLD } };
    case "solid":
      return { reviews: { gt: 0 }, lapses: { lt: LAPSE_THRESHOLD }, intervalDays: { gte: SOLID_DAYS } };
    case "shaky":
      return { reviews: { gt: 0 }, lapses: { lt: LAPSE_THRESHOLD }, intervalDays: { lt: SOLID_DAYS } };
  }
}
