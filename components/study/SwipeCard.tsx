"use client";

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useRef } from "react";
import { Badge, Dot } from "@/components/pouf/media";
import { Textarea } from "@/components/pouf/Input";
import { Heading, Text } from "@/components/pouf/text";
import { Row, Stack } from "@/components/pouf/layout";
import { STAGE_LABEL, type Stage } from "@/lib/stage";
import type { Tone } from "@/components/pouf/tone";
import type { QueueRow, StudySettings } from "./types";

const COMMIT_X = 130;
const FLICK_V = 500;
const SKIP_Y = -110;
const FLY_MS = 190;

const STAGE_TONE: Record<Stage, Tone> = {
  new: "blue",
  shaky: "yellow",
  solid: "mint",
  slipping: "pink",
};

export type Commit = { kind: "grade"; knew: boolean } | { kind: "skip" };

/** Label above, chips below. Inline the label into the same wrapping Row and
 * the chips reflow around it into a ragged staircase. */
function WordChips({ label, words, tone }: { label: string; words: string[]; tone: Tone }) {
  return (
    <Stack gap={2}>
      <Text size="sm" muted>
        {label}
      </Text>
      <div className="flex min-w-0 flex-wrap gap-(--s2)">
        {words.slice(0, 4).map((w) => (
          <Badge key={w} tone={tone}>
            {w}
          </Badge>
        ))}
      </div>
    </Stack>
  );
}

type Props = {
  row: QueueRow;
  settings: StudySettings;
  revealed: boolean;
  hook: string;
  onHookChange: (value: string) => void;
  onReveal: () => void;
  onCommit: (commit: Commit) => void;
};

export function SwipeCard({
  row,
  settings,
  revealed,
  hook,
  onHookChange,
  onReveal,
  onCommit,
}: Props) {
  const reduced = useReducedMotion();
  const committed = useRef(false);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, (v) => v / 24);
  const knewOp = useTransform(x, [20, 130], [0, 1], { clamp: true });
  const againOp = useTransform(x, [-20, -130], [0, 1], { clamp: true });
  const skipOp = useTransform(y, [-20, -110], [0, 1], { clamp: true });

  const { word } = row;

  async function fly(commit: Commit, direction: -1 | 0 | 1) {
    if (committed.current) return;
    committed.current = true;

    if (!reduced) {
      const value = direction === 0 ? y : x;
      const target =
        direction === 0 ? -(window.innerHeight * 1.1) : direction * window.innerWidth * 1.1;
      await animate(value, target, { duration: FLY_MS / 1000, ease: "easeOut" }).finished;
    }
    onCommit(commit);
  }

  // Not dragSnapToOrigin: the spring-back would race the fly-out we start in
  // this same handler. Snapping back by hand keeps the two mutually exclusive.
  function settle() {
    animate(x, 0, { type: "spring", stiffness: 400, damping: 30 });
    animate(y, 0, { type: "spring", stiffness: 400, damping: 30 });
  }

  return (
    // h-full (not max-h-full) so the card's own max-h-full has a definite
    // height to resolve against; items-center keeps a short card centred.
    <div className="relative flex h-full w-full max-w-md items-center">
      <motion.div
        drag
        dragElastic={0.6}
        dragMomentum={false}
        style={{ x, y, rotate, touchAction: "none" }}
        onDragEnd={(_, info) => {
          const { offset, velocity } = info;
          if (offset.y <= SKIP_Y && Math.abs(offset.y) > Math.abs(offset.x)) {
            void fly({ kind: "skip" }, 0);
            return;
          }
          // The flick path needs a minimum travel too — a fast jitter of a few
          // pixels is not a grade, and a misgrade here is expensive.
          const far = Math.abs(offset.x) >= COMMIT_X;
          const flick = Math.abs(velocity.x) > FLICK_V && Math.abs(offset.x) > 40;
          if (far || flick) {
            void fly({ kind: "grade", knew: offset.x > 0 }, offset.x > 0 ? 1 : -1);
            return;
          }
          settle();
        }}
        onTap={() => {
          if (!revealed) onReveal();
        }}
        className="pouf-card flex w-full max-h-full flex-col bg-surface rounded-card cushion-card cursor-grab active:cursor-grabbing select-none px-(--s6) pt-[calc(var(--s6)-var(--lip)/2)] pb-[calc(var(--s6)+var(--lip)/2)]"
      >
        <div className="shrink-0">
          <Stack gap={4}>
            <Row justify="between">
              <Row gap={2}>
                <Dot tone={STAGE_TONE[row.stage]} />
                <Text size="sm" muted>
                  {STAGE_LABEL[row.stage]}
                </Text>
              </Row>
              {word.partOfSpeech && <Badge tone="purple">{word.partOfSpeech}</Badge>}
            </Row>

            <Stack gap={1}>
              <Heading level={1}>{word.term}</Heading>
              {word.pronunciation && (
                <Text size="sm" muted>
                  {word.pronunciation}
                </Text>
              )}
            </Stack>

            {!revealed && settings.sentenceFirst && word.blank && <Text>{word.blank}</Text>}

            {!revealed && (
              <Text size="sm" muted>
                Tap to reveal
              </Text>
            )}
          </Stack>
        </div>

        {revealed && (
          // touch-action pan-y, not a propagation stop: the browser takes the
          // vertical gesture for scrolling and motion still gets the horizontal
          // one, so a long back face scrolls without costing you left/right
          // grading. Up-to-skip is the casualty here; the Skip button covers it.
          <div
            className="mt-(--s5) min-h-0 flex-1 overflow-y-auto overscroll-contain"
            style={{ touchAction: "pan-y" }}
          >
            <Stack gap={4}>
              <Text>{word.meaning}</Text>

              {word.example && (
                <Text size="sm" muted>
                  {word.example}
                </Text>
              )}

              {/* Roots are a gloss ("ob- against, in the way of + via way"), not
               * a label — a Badge is whitespace-nowrap and overflows the card. */}
              {settings.showRoots && word.root && (
                <Stack gap={1}>
                  <Text size="sm" muted>
                    Root
                  </Text>
                  <Text size="sm">{word.root}</Text>
                </Stack>
              )}

              {word.synonyms.length > 0 && (
                <WordChips label="Similar" tone="mint" words={word.synonyms} />
              )}

              {word.antonyms.length > 0 && (
                <WordChips label="Opposite" tone="orange" words={word.antonyms} />
              )}

              {/* Stop propagation so typing in the hook never reads as a tap or drag. */}
              <div onPointerDownCapture={(e) => e.stopPropagation()}>
                <Textarea
                  label="Your hook"
                  placeholder="A memory hook, in your own words"
                  value={hook}
                  onChange={onHookChange}
                  rows={2}
                />
              </div>
            </Stack>
          </div>
        )}
      </motion.div>

      {/* Drag affordances. aria-hidden — the buttons below the card are the
       * accessible path, and these only mirror finger position. */}
      <motion.div
        aria-hidden
        style={{ opacity: knewOp }}
        className="pointer-events-none absolute top-6 left-6"
      >
        <Badge tone="mint">Knew it</Badge>
      </motion.div>
      <motion.div
        aria-hidden
        style={{ opacity: againOp }}
        className="pointer-events-none absolute top-6 right-6"
      >
        <Badge tone="pink">Didn&apos;t know</Badge>
      </motion.div>
      <motion.div
        aria-hidden
        style={{ opacity: skipOp }}
        className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2"
      >
        <Badge tone="yellow">Skip</Badge>
      </motion.div>
    </div>
  );
}
