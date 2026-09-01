import type { Grade } from "@/generated/prisma/client";
import type { Stage } from "@/lib/stage";

export type QueueWord = {
  id: string;
  term: string;
  pronunciation: string;
  partOfSpeech: string;
  meaning: string;
  example: string;
  blank: string;
  root: string;
  synonyms: string[];
  antonyms: string[];
};

export type QueueCard = {
  userId: string;
  wordId: string;
  reviews: number;
  lapses: number;
  ease: number;
  intervalDays: number;
  dueAt: string;
  buriedUntil: string | null;
  hook: string | null;
  lastGrade: Grade | null;
  updatedAt: string;
};

export type QueueRow = {
  word: QueueWord;
  card: QueueCard | null;
  stage: Stage;
  deckPosition: number;
  groupPosition: number;
};

export type QueueResponse = {
  order: string;
  ahead: boolean;
  queue: QueueRow[];
  remaining: number;
};

export type StudySettings = {
  studyOrder: string;
  sentenceFirst: boolean;
  showRoots: boolean;
  keyboardHints: boolean;
  sound: boolean;
};
