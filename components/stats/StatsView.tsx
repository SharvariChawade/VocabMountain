"use client";

import { useEffect, useState } from "react";
import { BarChart } from "@/components/pouf/charts";
import { ErrorNote, Skeleton } from "@/components/pouf/feedback";
import { Grid, Stack } from "@/components/pouf/layout";
import { Stat } from "@/components/pouf/readout";
import { Card } from "@/components/pouf/surface";
import { Heading, Text } from "@/components/pouf/text";

type Stats = {
  wordsSeen: number;
  knewRate: number | null;
  firstTryRate: number | null;
  keepsSlipping: number;
  streak: number;
  days: { date: string; count: number }[];
};

/** null is unknown, not zero — a 0% recall rate over no reviews is a lie. */
const pct = (v: number | null) => (v === null ? "—" : `${v}%`);

export function StatsView() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const res = await fetch("/api/stats");
        if (!res.ok) throw new Error(String(res.status));
        const data: Stats = await res.json();
        if (live) setStats(data);
      } catch {
        if (live) setError(true);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  if (error) return <ErrorNote>Couldn&apos;t load your stats.</ErrorNote>;
  if (!stats) return <Skeleton variant="card" count={2} />;

  // Day-of-month only: 28 full dates are unreadable at phone width.
  const days = stats.days.map((d) => ({
    day: String(Number(d.date.slice(8, 10))),
    count: d.count,
  }));

  return (
    <Stack gap={5}>
      <Heading level={1}>Stats</Heading>

      <Grid cols={2} gap={3}>
        <Stat label="Words seen" value={String(stats.wordsSeen)} icon="database" tone="blue" />
        <Stat label="Knew it" value={pct(stats.knewRate)} icon="ok" tone="mint" />
        <Stat label="First try" value={pct(stats.firstTryRate)} icon="sparkle" tone="purple" />
        <Stat label="Keeps slipping" value={String(stats.keepsSlipping)} icon="warn" tone="pink" />
      </Grid>

      <Card variant="tight">
        <Stack gap={3}>
          <Stack gap={1}>
            <Text>Last 28 days</Text>
            <Text size="sm" muted>
              {stats.streak > 0
                ? `${stats.streak} day streak`
                : "No streak yet — study today to start one."}
            </Text>
          </Stack>
          <BarChart
            data={days}
            dataKey="day"
            series={[{ key: "count", label: "Reviews", tone: "purple" }]}
            height={200}
          />
        </Stack>
      </Card>
    </Stack>
  );
}
