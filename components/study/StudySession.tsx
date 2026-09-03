"use client";

import { AnimatePresence } from "motion/react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { parseAsBoolean, parseAsString, useQueryStates } from "nuqs";
import { Button, IconButton } from "@/components/pouf/Button";
import { Select } from "@/components/pouf/controls";
import { Empty, ErrorNote, Skeleton } from "@/components/pouf/feedback";
import { Icon } from "@/components/pouf/Icon";
import { Row, Stack } from "@/components/pouf/layout";
import { Text } from "@/components/pouf/text";
import { bury, enqueueGrade, flush, startGradeQueue } from "@/lib/grade-queue";
import { play, preloadSfx, setSoundEnabled } from "@/lib/sfx";
import { SwipeCard, type Commit } from "./SwipeCard";
import type { QueueResponse, QueueRow, StudySettings } from "./types";

const PREFETCH_AT = 5;

type StudyGroup = { id: string; title: string; wordCount: number };

export function StudySession({
  settings,
  groups,
  activeDeckId,
}: {
  settings: StudySettings;
  groups: StudyGroup[];
  activeDeckId: string | null;
}) {
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
  const [activeGroupId, setActiveGroupId] = useState(
    groups.some((group) => group.id === activeDeckId) ? activeDeckId : null,
  );
  const [switchingGroup, setSwitchingGroup] = useState(false);
  const [groupError, setGroupError] = useState(false);
  const [handledIds, setHandledIds] = useState<Set<string>>(() => new Set());

  const shownAt = useRef(0);
  const handled = useRef(new Set<string>());
  const fetching = useRef(false);
  const queueRequest = useRef<AbortController | null>(null);

  const row = queue[index];
  const exhausted = !loading && index >= queue.length;
  const alreadyHandled = !!row && handledIds.has(row.word.id);

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
      if (fetching.current && !replace) return;
      if (replace) queueRequest.current?.abort();
      fetching.current = true;
      const controller = new AbortController();
      queueRequest.current = controller;
      // No setLoading(true) here: on an order/ahead switch the current card
      // stays put until the new batch lands, which beats a skeleton flash.
      try {
        if (!replace) await flush(); // so the server stops returning what we graded
        const params = new URLSearchParams({ order, deck: activeGroupId ?? "" });
        if (ahead) params.set("ahead", "true");
        const res = await fetch(`/api/queue?${params}`, { signal: controller.signal });
        if (!res.ok) throw new Error(String(res.status));
        const data: QueueResponse = await res.json();
        if (controller.signal.aborted) return;

        const fresh = data.queue.filter((r) => !handled.current.has(r.word.id));
        if (replace) {
          setHandledIds(new Set());
          setQueue(fresh);
          setIndex(0);
        } else {
          setQueue((prev) => {
            const have = new Set(prev.map((r) => r.word.id));
            return [...prev, ...fresh.filter((r) => !have.has(r.word.id))];
          });
        }
        setError(false);
      } catch (cause) {
        if (!(cause instanceof DOMException && cause.name === "AbortError")) setError(true);
      } finally {
        if (queueRequest.current === controller) {
          fetching.current = false;
          setLoading(false);
          if (replace) setSwitchingGroup(false);
        }
      }
    },
    [order, ahead, activeGroupId],
  );

  useEffect(() => {
    handled.current = new Set();
    const timer = window.setTimeout(() => void load(true));
    return () => window.clearTimeout(timer);
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
      // Previous/next lets learners revisit a card, but a review is an event,
      // not a mutable answer: submitting it twice would distort scheduling.
      if (handled.current.has(row.word.id)) return;
      handled.current.add(row.word.id);
      setHandledIds((previous) => new Set(previous).add(row.word.id));

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

  async function changeGroup(id: string) {
    const nextGroupId = id || null;
    if (nextGroupId === activeGroupId) return;

    setSwitchingGroup(true);
    setGroupError(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ activeDeckId: nextGroupId }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setDone(0);
      setActiveGroupId(nextGroupId);
    } catch {
      setGroupError(true);
      setSwitchingGroup(false);
    }
  }

  function previousWord() {
    setIndex((current) => Math.max(0, current - 1));
  }

  function nextWord() {
    setIndex((current) => Math.min(queue.length - 1, current + 1));
  }

  const studyHeader = (
    <Stack gap={2}>
      <Select
        label="Study group"
        placeholder="All words"
        value={activeGroupId ?? ""}
        onChange={(id) => void changeGroup(id)}
        disabled={switchingGroup}
        options={[
          { value: "", label: "All words" },
          ...groups.map((group) => ({
            value: group.id,
            label: `${group.title} (${group.wordCount} words)`,
          })),
        ]}
      />
      {groupError && <ErrorNote>Couldn&apos;t switch study groups.</ErrorNote>}
      <Row justify="between">
        <Text size="sm" muted>
          {done} done
        </Text>
        <Text size="sm" muted>
          {row ? `Word ${index + 1} of ${queue.length}` : "No words left"}
        </Text>
      </Row>
    </Stack>
  );

  // Prefetch before the batch runs dry so the next card never waits.
  useEffect(() => {
    if (loading || error) return;
    if (queue.length - index <= PREFETCH_AT) {
      const timer = window.setTimeout(() => void load(false));
      return () => window.clearTimeout(timer);
    }
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
      <StudyLayout header={studyHeader}>
        <Skeleton variant="card" />
      </StudyLayout>
    );
  }

  if (error && !row) {
    return (
      <StudyLayout header={studyHeader}>
        <Stack gap={4}>
          <ErrorNote>Couldn&apos;t load your queue.</ErrorNote>
          <Button onClick={() => void load(true)}>Try again</Button>
        </Stack>
      </StudyLayout>
    );
  }

  if (!row) {
    return (
      <StudyLayout header={studyHeader}>
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
      header={studyHeader}
      footer={
        <Stack gap={3}>
          <Row justify="between" wrap={false}>
            <IconButton
              icon={<Icon name="prev" size="sm" />}
              label="Previous word"
              onClick={previousWord}
              disabled={switchingGroup || index === 0}
            />
            <Text size="sm" muted>
              Browse words in this {activeGroupId ? "group" : "session"}
            </Text>
            <IconButton
              icon={<Icon name="next" size="sm" />}
              label="Next word"
              onClick={nextWord}
              disabled={switchingGroup || index + 1 >= queue.length}
            />
          </Row>
          <Row gap={3} justify="center">
            <Button
              tone="pink"
              onClick={() => commit({ kind: "grade", knew: false })}
              disabled={alreadyHandled || switchingGroup}
            >
              Didn&apos;t know
            </Button>
            <Button
              tone="mint"
              onClick={() => commit({ kind: "grade", knew: true })}
              disabled={alreadyHandled || switchingGroup}
            >
              Knew it
            </Button>
          </Row>
          <Row justify="center">
            <Button
              variant="quiet"
              size="sm"
              onClick={() => commit({ kind: "skip" })}
              disabled={alreadyHandled || switchingGroup}
            >
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
