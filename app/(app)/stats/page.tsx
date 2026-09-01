import type { Metadata } from "next";
import { StatsView } from "@/components/stats/StatsView";

export const metadata: Metadata = { title: "Stats — Vocab Mountain" };

export default function StatsPage() {
  return <StatsView />;
}
