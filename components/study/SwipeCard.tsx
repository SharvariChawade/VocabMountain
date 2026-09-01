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
    <div className="relative w-full max-w-md">
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
        className="pouf-card bg-surface rounded-card cushion-card cursor-grab active:cursor-grabbing select-none px-(--s6) pt-[calc(var(--s6)-var(--lip)/2)] pb-[calc(var(--s6)+var(--lip)/2)]"
      >
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

          {revealed && (
            <Stack gap={4}>
              <Text>{word.meaning}</Text>

              {word.example && (
                <Text size="sm" muted>
                  {word.example}
                </Text>
              )}

              {settings.showRoots && word.root && (
                <Row gap={2}>
                  <Text size="sm" muted>
                    Root
                  </Text>
                  <Badge tone="blue">{word.root}</Badge>
                </Row>
              )}

              {word.synonyms.length > 0 && (
                <Row gap={2}>
                  <Text size="sm" muted>
                    Similar
                  </Text>
                  {word.synonyms.slice(0, 4).map((s) => (
                    <Badge key={s} tone="mint">
                      {s}
                    </Badge>
                  ))}
                </Row>
              )}

              {word.antonyms.length > 0 && (
                <Row gap={2}>
                  <Text size="sm" muted>
                    Opposite
                  </Text>
                  {word.antonyms.slice(0, 4).map((a) => (
                    <Badge key={a} tone="orange">
                      {a}
                    </Badge>
                  ))}
                </Row>
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
          )}
        </Stack>
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
