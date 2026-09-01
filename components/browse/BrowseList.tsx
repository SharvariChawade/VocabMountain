"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { Button } from "@/components/pouf/Button";
import { Empty, ErrorNote, Skeleton } from "@/components/pouf/feedback";
import { Input } from "@/components/pouf/Input";
import { Row, Stack } from "@/components/pouf/layout";
import { Badge, Dot } from "@/components/pouf/media";
import { Segmented } from "@/components/pouf/Segmented";
import { RowCard } from "@/components/pouf/surface";
import { Heading, Text } from "@/components/pouf/text";
import { STAGE_LABEL, type Stage } from "@/lib/stage";
import type { Tone } from "@/components/pouf/tone";
import type { QueueCard, QueueWord } from "@/components/study/types";

const FILTERS = ["all", "due", "wrong", "new", "shaky", "solid", "slipping"] as const;
type Filter = (typeof FILTERS)[number];

const FILTER_LABEL: Record<Filter, string> = {
  all: "All",
  due: "Due",
  wrong: "All wrongs",
  new: "New",
  shaky: "Shaky",
  solid: "Solid",
  slipping: "Keeps slipping",
};

const STAGE_TONE: Record<Stage, Tone> = {
  new: "blue",
  shaky: "yellow",
  solid: "mint",
  slipping: "pink",
};

type BrowseWord = QueueWord & { card: QueueCard | null; stage: Stage };
type WordsResponse = { words: BrowseWord[]; nextCursor: string | null };

export function BrowseList() {
  const [{ q, filter }, setParams] = useQueryStates(
    {
      q: parseAsString.withDefault(""),
      filter: parseAsStringLiteral(FILTERS).withDefault("all"),
    },
    { throttleMs: 300 },
  );

  const [words, setWords] = useState<BrowseWord[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState(false);

  // Only the newest query may write results — a slow "a" must not overwrite "ab".
  const run = useRef(0);

  // No synchronous setState in here — it is called straight from an effect.
  // The "Load more" spinner is set by loadMore(), which runs from a click.
  const fetchPage = useCallback(
    async (after: string | null) => {
      const ticket = after ? run.current : ++run.current;
      try {
        const params = new URLSearchParams();
        if (q) params.set("q", q);
        if (filter !== "all") params.set("filter", filter);
        if (after) params.set("cursor", after);

        const res = await fetch(`/api/words?${params}`);
        if (!res.ok) throw new Error(String(res.status));
        const data: WordsResponse = await res.json();
        if (ticket !== run.current) return;

        setWords((prev) => (after ? [...prev, ...data.words] : data.words));
        setCursor(data.nextCursor);
        setError(false);
      } catch {
        if (ticket === run.current) setError(true);
      } finally {
        if (ticket === run.current) {
          setLoading(false);
          setMore(false);
        }
      }
    },
    [q, filter],
  );

  useEffect(() => {
    // Wrapped so the fetch is visibly async work rather than something the
    // effect appears to complete inline.
    void (async () => {
      await fetchPage(null);
    })();
  }, [fetchPage]);

  function loadMore() {
    if (!cursor) return;
    setMore(true);
    setError(false);
    void fetchPage(cursor);
  }

  return (
    <Stack gap={5}>
      <Heading level={1}>Browse</Heading>

      <Input
        label="Search words"
        placeholder="Search a word, meaning or root"
        value={q}
        onChange={(value) => void setParams({ q: value || null })}
        type="search"
      />

      {/* Horizontal scroll rather than wrap: seven filters wrap to three ragged
       * rows on a phone and push the list below the fold. */}
      <div className="-mx-(--s4) overflow-x-auto px-(--s4) pb-(--s1)">
        <Segmented
          label="Filter words"
          value={filter}
          onChange={(value) => void setParams({ filter: value === "all" ? null : value })}
          options={FILTERS.map((f) => ({ value: f, label: FILTER_LABEL[f] }))}
        />
      </div>

      {error && <ErrorNote>Couldn&apos;t load words.</ErrorNote>}

      {loading ? (
        <Skeleton variant="row" count={6} />
      ) : words.length === 0 ? (
        <Empty icon="search" title="Nothing here">
          {q ? `No words match "${q}".` : "No words in this filter yet."}
        </Empty>
      ) : (
        <Stack gap={3}>
          {words.map((word) => (
            <Link key={word.id} href={`/words/${word.id}`} className="no-underline">
              <RowCard>
                <Row justify="between" align="top">
                  <Stack gap={1}>
                    <Text>{word.term}</Text>
                    <Text size="sm" muted truncate>
                      {word.meaning}
                    </Text>
                  </Stack>
                  <Row gap={2}>
                    <Dot tone={STAGE_TONE[word.stage]} />
                    <Text size="sm" muted>
                      {STAGE_LABEL[word.stage]}
                    </Text>
                    {(word.card?.lapses ?? 0) > 0 && (
                      <Badge tone="pink">{word.card?.lapses}×</Badge>
                    )}
                  </Row>
                </Row>
              </RowCard>
            </Link>
          ))}

          {cursor && (
            <Button block variant="quiet" loading={more} onClick={loadMore}>
              Load more
            </Button>
          )}
        </Stack>
      )}
    </Stack>
  );
}
