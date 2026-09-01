"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BottomNav, type NavGroup, type NavItem } from "@/components/pouf/BottomNav";
import type { LinkComponent } from "@/components/pouf/NavLink";

export const primary: NavItem[] = [
  { href: "/study", label: "Study", icon: "target", tone: "mint" },
  { href: "/browse", label: "Browse", icon: "search", tone: "blue" },
  { href: "/stats", label: "Stats", icon: "chart", tone: "purple" },
  { href: "/settings", label: "Settings", icon: "settings", tone: "yellow" },
];

const groups: NavGroup[] = [
  { title: "Learn", items: primary.slice(0, 2) },
  {
    title: "You",
    items: [
      ...primary.slice(2),
      { href: "/decks", label: "Decks", icon: "database", tone: "orange" },
    ],
  },
];

export const AppLink: LinkComponent = ({ href, className, children, "aria-current": ariaCurrent }) => (
  <Link href={href} className={className} aria-current={ariaCurrent}>
    {children}
  </Link>
);

export function AppBottomNav() {
  const pathname = usePathname();

  return <BottomNav primary={primary} groups={groups} currentPath={pathname} link={AppLink} />;
}
