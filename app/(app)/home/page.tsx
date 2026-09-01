import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { Row, Stack } from "@/components/pouf/layout";
import { Stat } from "@/components/pouf/readout";
import { Card } from "@/components/pouf/surface";
import { Heading, Text } from "@/components/pouf/text";
import { prisma } from "@/lib/prisma";
import { LAPSE_THRESHOLD } from "@/lib/stage";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");

  const userId = session.user.id;
  const [due, slipping, seen] = await Promise.all([
    prisma.card.count({
      where: {
        userId,
        dueAt: { lte: new Date() },
        OR: [{ buriedUntil: null }, { buriedUntil: { lte: new Date() } }],
      },
    }),
    prisma.card.count({ where: { userId, lapses: { gte: LAPSE_THRESHOLD } } }),
    prisma.card.count({ where: { userId, reviews: { gt: 0 } } }),
  ]);

  return (
    <Stack gap={5}>
      <Stack gap={1}>
        <Heading level={1}>Vocab Mountain</Heading>
        <Text size="sm" muted>
          {session.user.email}
        </Text>
      </Stack>

      <Link href="/study" className="no-underline">
        <Card>
          <Stack gap={2}>
            <Text size="sm" muted>
              {due > 0 ? "Ready when you are" : "Nothing due — study ahead?"}
            </Text>
            <Heading level={2}>
              {due > 0 ? `${due} ${due === 1 ? "word" : "words"} waiting` : "You're caught up"}
            </Heading>
            <Text>Start studying →</Text>
          </Stack>
        </Card>
      </Link>

      <Row gap={3}>
        <Stat label="Words seen" value={String(seen)} icon="database" tone="blue" />
        <Stat label="Keeps slipping" value={String(slipping)} icon="warn" tone="pink" />
      </Row>

      <Row justify="end">
        <SignOutButton />
      </Row>
    </Stack>
  );
}
