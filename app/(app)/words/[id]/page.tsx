import Link from "next/link";
import { notFound } from "next/navigation";
import { Row, Stack } from "@/components/pouf/layout";
import { Badge, Dot } from "@/components/pouf/media";
import { Metric } from "@/components/pouf/readout";
import { Card } from "@/components/pouf/surface";
import { Heading, Text } from "@/components/pouf/text";
import { prisma } from "@/lib/prisma";
import { currentUserId } from "@/lib/session";
import { STAGE_LABEL, stageOf, type Stage } from "@/lib/stage";
import type { Tone } from "@/components/pouf/tone";

export const dynamic = "force-dynamic";

const STAGE_TONE: Record<Stage, Tone> = {
  new: "blue",
  shaky: "yellow",
  solid: "mint",
  slipping: "pink",
};

const dateFmt = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

export default async function WordPage({ params }: PageProps<"/words/[id]">) {
  const userId = await currentUserId();
  const { id } = await params;

  const word = await prisma.word.findUnique({
    where: { id },
    include: {
      cards: { where: { userId: userId ?? "" } },
      confusable: { include: { to: { select: { id: true, term: true } } } },
      decks: { include: { deck: { select: { slug: true, title: true } } } },
    },
  });
  if (!word) notFound();

  const card = word.cards[0] ?? null;
  const stage = stageOf(card);

  const reviews = await prisma.review.findMany({
    where: { userId: userId ?? "", wordId: id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <Stack gap={5}>
      <Link href="/browse" className="no-underline">
        <Text size="sm" muted>
          ← Browse
        </Text>
      </Link>

      <Card>
        <Stack gap={4}>
          <Row justify="between">
            <Row gap={2}>
              <Dot tone={STAGE_TONE[stage]} />
              <Text size="sm" muted>
                {STAGE_LABEL[stage]}
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

          <Text>{word.meaning}</Text>
          {word.example && (
            <Text size="sm" muted>
              {word.example}
            </Text>
          )}

          {word.root && (
            <Stack gap={1}>
              <Text size="sm" muted>
                Root
              </Text>
              <Text size="sm">{word.root}</Text>
            </Stack>
          )}

          <Chips label="Similar" tone="mint" items={word.synonyms} />
          <Chips label="Opposite" tone="orange" items={word.antonyms} />

          {word.confusable.length > 0 && (
            <Stack gap={2}>
              <Text size="sm" muted>
                Easily confused with
              </Text>
              <div className="flex flex-wrap gap-(--s2)">
                {word.confusable.map((c) => (
                  <Link key={c.to.id} href={`/words/${c.to.id}`} className="no-underline">
                    <Badge tone="blue">{c.to.term}</Badge>
                  </Link>
                ))}
              </div>
            </Stack>
          )}
        </Stack>
      </Card>

      {card?.hook && (
        <Card variant="tight">
          <Stack gap={1}>
            <Text size="sm" muted>
              Your hook
            </Text>
            <Text>{card.hook}</Text>
          </Stack>
        </Card>
      )}

      <Card variant="tight">
        <Row gap={4}>
          <Metric label="Reviews" value={card?.reviews ?? 0} />
          <Metric label="Lapses" value={card?.lapses ?? 0} />
          <Metric label="Interval" value={card ? `${card.intervalDays}d` : null} />
          <Metric label="Due" value={card ? dateFmt.format(card.dueAt) : null} num={false} />
        </Row>
      </Card>

      {reviews.length > 0 && (
        <Stack gap={2}>
          <Text size="sm" muted>
            Recent reviews
          </Text>
          <Card variant="tight">
            <Stack gap={2}>
              {reviews.map((r) => (
                <Row key={r.id} justify="between">
                  <Row gap={2}>
                    <Dot tone={r.grade === "KNEW" ? "mint" : "pink"} />
                    <Text size="sm">{r.grade === "KNEW" ? "Knew it" : "Didn't know"}</Text>
                    {!r.revealed && r.grade === "KNEW" && <Badge tone="mint">Cold</Badge>}
                  </Row>
                  <Text size="sm" muted>
                    {dateFmt.format(r.createdAt)}
                  </Text>
                </Row>
              ))}
            </Stack>
          </Card>
        </Stack>
      )}

      {word.decks.length > 0 && (
        <Stack gap={2}>
          <Text size="sm" muted>
            In decks
          </Text>
          <div className="flex flex-wrap gap-(--s2)">
            {word.decks.map((d) => (
              <Badge key={d.deck.slug} tone="purple">
                {d.deck.title}
              </Badge>
            ))}
          </div>
        </Stack>
      )}
    </Stack>
  );
}

function Chips({ label, items, tone }: { label: string; items: string[]; tone: Tone }) {
  if (items.length === 0) return null;
  return (
    <Stack gap={2}>
      <Text size="sm" muted>
        {label}
      </Text>
      <div className="flex flex-wrap gap-(--s2)">
        {items.map((i) => (
          <Badge key={i} tone={tone}>
            {i}
          </Badge>
        ))}
      </div>
    </Stack>
  );
}
