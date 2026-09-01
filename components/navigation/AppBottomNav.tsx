"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BottomNav, type NavGroup, type NavItem } from "@/src/components/pouf/BottomNav";
import type { LinkComponent } from "@/src/components/pouf/NavLink";

const primary: NavItem[] = [
  { href: "/home", label: "Home", icon: "overview", tone: "purple" },
  { href: "/practice", label: "Practice", icon: "target", tone: "mint" },
  { href: "/add", label: "Add word", icon: "add", tone: "yellow" },
];

const groups: NavGroup[] = [
  { title: "Learn", items: primary },
  { title: "Account", items: [{ href: "/settings", label: "Settings", icon: "settings", tone: "blue" }] },
];

const AppLink: LinkComponent = ({ href, className, children, "aria-current": ariaCurrent }) => (
  <Link href={href} className={className} aria-current={ariaCurrent}>
    {children}
  </Link>
);

export function AppBottomNav() {
  const pathname = usePathname();

  return <BottomNav primary={primary} groups={groups} currentPath={pathname} link={AppLink} />;
}
