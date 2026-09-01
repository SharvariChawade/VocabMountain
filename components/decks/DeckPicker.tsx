"use client";

import { useState } from "react";
import { ErrorNote } from "@/components/pouf/feedback";
import { Row, Stack } from "@/components/pouf/layout";
import { Badge } from "@/components/pouf/media";
import { RowCard } from "@/components/pouf/surface";
import { Heading, Text } from "@/components/pouf/text";

type Deck = { id: string; title: string; kind: "GROUP" | "CURATED"; wordCount: number };

export function DeckPicker({
  decks,
  activeDeckId,
}: {
  decks: Deck[];
  activeDeckId: string | null;
}) {
  const [active, setActive] = useState(activeDeckId);
  const [error, setError] = useState(false);

  async function pick(id: string | null) {
    const previous = active;
    setActive(id);
    setError(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ activeDeckId: id }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setActive(previous);
      setError(true);
    }
  }

  return (
    <Stack gap={5}>
      <Stack gap={1}>
        <Heading level={1}>Decks</Heading>
        <Text size="sm" muted>
          A deck filters which words come up. Your progress stays global either way.
        </Text>
      </Stack>

      {error && <ErrorNote>Couldn&apos;t switch decks.</ErrorNote>}

      <Stack gap={3}>
        <RowCard selected={active === null} onClick={() => void pick(null)}>
          <Row justify="between">
            <Text>All words</Text>
            <Text size="sm" muted>
              Everything
            </Text>
          </Row>
        </RowCard>

        {decks.map((deck) => (
          <RowCard key={deck.id} selected={active === deck.id} onClick={() => void pick(deck.id)}>
            <Row justify="between">
              <Row gap={2}>
                <Text>{deck.title}</Text>
                {deck.kind === "CURATED" && <Badge tone="yellow">Curated</Badge>}
              </Row>
              <Text size="sm" muted>
                {deck.wordCount} words
              </Text>
            </Row>
          </RowCard>
        ))}
      </Stack>
    </Stack>
  );
}
