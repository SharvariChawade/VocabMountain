"use client";

import { AnimatePresence } from "motion/react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { parseAsBoolean, parseAsString, useQueryStates } from "nuqs";
import { Button } from "@/components/pouf/Button";
import { Empty, ErrorNote, Skeleton } from "@/components/pouf/feedback";
import { Row, Stack } from "@/components/pouf/layout";
import { Text } from "@/components/pouf/text";
import { bury, enqueueGrade, flush, startGradeQueue } from "@/lib/grade-queue";
import { play, preloadSfx, setSoundEnabled } from "@/lib/sfx";
import { SwipeCard, type Commit } from "./SwipeCard";
import type { QueueResponse, QueueRow, StudySettings } from "./types";

const PREFETCH_AT = 5;

export function StudySession({ settings }: { settings: StudySettings }) {
  const [{ order, ahead }, setParams] = useQueryStates({
    order: parseAsString.withDefault(settings.studyOrder),
    ahead: parseAsBoolean.withDefault(false),
  });

  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [index, setIndex] = useState(0);
  const [cardId, setCardId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [hook, setHook] = useState("");
  const [done, setDone] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const shownAt = useRef(0);
  const handled = useRef(new Set<string>());
  const fetching = useRef(false);

  const row = queue[index];
  const exhausted = !loading && index >= queue.length;

  // Reset the per-card state machine during render rather than in an effect —
  // the card must never paint one frame showing the previous word's back.
  if (row && row.word.id !== cardId) {
    setCardId(row.word.id);
    setRevealed(false);
    setHook(row.card?.hook ?? "");
  }

  // Load a batch and append only words this session hasn't already dealt with.
  // /api/queue has no cursor, so a refetch overlaps with what we already hold.
  const load = useCallback(
    async (replace: boolean) => {
      if (fetching.current) return;
      fetching.current = true;
      // No setLoading(true) here: on an order/ahead switch the current card
      // stays put until the new batch lands, which beats a skeleton flash.
      try {
        if (!replace) await flush(); // so the server stops returning what we graded
        const params = new URLSearchParams({ order });
        if (ahead) params.set("ahead", "true");
        const res = await fetch(`/api/queue?${params}`);
        if (!res.ok) throw new Error(String(res.status));
        const data: QueueResponse = await res.json();

        const fresh = data.queue.filter((r) => !handled.current.has(r.word.id));
        if (replace) {
          setQueue(fresh);
          setIndex(0);
        } else {
          setQueue((prev) => {
            const have = new Set(prev.map((r) => r.word.id));
            return [...prev, ...fresh.filter((r) => !have.has(r.word.id))];
          });
        }
        setError(false);
      } catch {
        setError(true);
      } finally {
        fetching.current = false;
        setLoading(false);
      }
    },
    [order, ahead],
  );

  useEffect(() => {
    handled.current = new Set();
    void load(true);
  }, [load]);

  useEffect(() => startGradeQueue(), []);

  useEffect(() => {
    preloadSfx();
    setSoundEnabled(settings.sound);
  }, [settings.sound]);

  // Ref write only — the time-on-card clock starts when the new card paints.
  useEffect(() => {
    shownAt.current = Date.now();
  }, [cardId]);

  useEffect(() => {
    if (!exhausted) return;
    void flush();
    play("caught-up");
  }, [exhausted]);

  const commit = useCallback(
    (c: Commit) => {
      if (!row) return;
      handled.current.add(row.word.id);

      if (c.kind === "skip") {
        play("skip");
        void bury(row.word.id);
      } else {
        play(c.knew ? "knew" : "again");
        enqueueGrade({
          id: crypto.randomUUID(),
          wordId: row.word.id,
          grade: c.knew ? "KNEW" : "AGAIN",
          revealed,
          ms: Math.min(Date.now() - shownAt.current, 600_000),
          hook: hook.trim() || undefined,
          gradedAt: new Date().toISOString(),
        });
        setDone((n) => n + 1);
      }

      setIndex((i) => i + 1);
    },
    [row, revealed, hook],
  );

  // Prefetch before the batch runs dry so the next card never waits.
  useEffect(() => {
    if (loading || error) return;
    if (queue.length - index <= PREFETCH_AT) void load(false);
  }, [index, queue.length, loading, error, load]);

  useEffect(() => {
    if (!row) return;
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT")) return;

      if (e.key === "ArrowLeft") commit({ kind: "grade", knew: false });
      else if (e.key === "ArrowRight") commit({ kind: "grade", knew: true });
      else if (e.key === "ArrowUp" || e.key.toLowerCase() === "s") commit({ kind: "skip" });
      else if (e.key === " ") setRevealed(true);
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [row, commit]);

  if (loading) {
    return (
      <StudyLayout>
        <Skeleton variant="card" />
      </StudyLayout>
    );
  }

  if (error && !row) {
    return (
      <StudyLayout>
        <Stack gap={4}>
          <ErrorNote>Couldn&apos;t load your queue.</ErrorNote>
          <Button onClick={() => void load(true)}>Try again</Button>
        </Stack>
      </StudyLayout>
    );
  }

  if (!row) {
    return (
      <StudyLayout>
        <Stack gap={5}>
          <Empty icon="trophy" title="Caught up">
            {done > 0 ? `${done} ${done === 1 ? "word" : "words"} today.` : "Nothing due right now."}
          </Empty>
          {!ahead && (
            <Button tone="mint" block onClick={() => void setParams({ ahead: true })}>
              Study ahead
            </Button>
          )}
        </Stack>
      </StudyLayout>
    );
  }

  // Viewport-height column: the card region flexes and the actions stay pinned,
  // so grading never requires scrolling on any screen size.
  return (
    <StudyLayout
      header={
        <Row justify="between">
          <Text size="sm" muted>
            {done} done
          </Text>
          <Text size="sm" muted>
            {queue.length - index} left
          </Text>
        </Row>
      }
      footer={
        <Stack gap={3}>
          <Row gap={3} justify="center">
            <Button tone="pink" onClick={() => commit({ kind: "grade", knew: false })}>
              Didn&apos;t know
            </Button>
            <Button tone="mint" onClick={() => commit({ kind: "grade", knew: true })}>
              Knew it
            </Button>
          </Row>
          <Row justify="center">
            <Button variant="quiet" size="sm" onClick={() => commit({ kind: "skip" })}>
              Skip
            </Button>
          </Row>
          {settings.keyboardHints && (
            <Row justify="center">
              <Text size="sm" muted>
                ← didn&apos;t know · → knew it · ↑ skip · space reveal
              </Text>
            </Row>
          )}
        </Stack>
      }
    >
      <AnimatePresence mode="popLayout">
        <SwipeCard
          key={row.word.id}
          row={row}
          settings={settings}
          revealed={revealed}
          hook={hook}
          onHookChange={setHook}
          onReveal={() => setRevealed(true)}
          onCommit={commit}
        />
      </AnimatePresence>
    </StudyLayout>
  );
}

function StudyLayout({
  header,
  footer,
  children,
}: {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    // A three-row grid, not a flex column: minmax(0,1fr) gives the card row a
    // genuinely bounded height, so the header and footer rows can never be
    // pushed out of view no matter how long the word's back face is.
    // The (app) shell owns the viewport height; this just fills what's left.
    <div className="mx-auto grid h-full w-full max-w-md grid-rows-[auto_minmax(0,1fr)_auto] gap-(--s4)">
      <div>{header}</div>
      <div className="flex min-h-0 justify-center">{children}</div>
      <div>{footer}</div>
    </div>
  );
}
