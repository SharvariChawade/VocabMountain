"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavLink } from "@/components/pouf/NavLink";
import { AppBottomNav, AppLink, primary } from "./AppBottomNav";

/** Desktop gets a nav strip; below 900px pouf's BottomNav takes over (it hides
 * itself above that width in CSS, so the two never both show). */
export function AppNav() {
  const pathname = usePathname();

  return (
    <>
      <nav
        aria-label="Primary"
        className="mb-(--s5) hidden items-center gap-(--s2) rounded-card bg-surface px-(--s3) py-(--s2) cushion-card min-[901px]:flex"
      >
        <Link
          href="/home"
          className="mr-(--s3) flex items-center gap-(--s2) px-(--s2) text-lg font-black tracking-tight text-ink no-underline"
        >
          <span className="grid size-9 place-items-center rounded-control bg-purple text-[var(--on-accent)]">
            &#9650;
          </span>
          Vocab Mountain
        </Link>
        {primary.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            currentPath={pathname}
            icon={item.icon}
            tone={item.tone}
            link={AppLink}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <AppBottomNav />
    </>
  );
}
