import type { Metadata } from "next";
import { BrowseList } from "@/components/browse/BrowseList";

export const metadata: Metadata = { title: "Browse — Vocab Mountain" };

export default function BrowsePage() {
  return <BrowseList />;
}
