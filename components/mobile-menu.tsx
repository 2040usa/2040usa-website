"use client";

import { useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type NavItem = { label: string; href: string };

export function MobileMenu({ items }: { items: readonly NavItem[] }) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const closeMenu = () => menuRef.current?.removeAttribute("open");

  return (
    <details ref={menuRef} className="group relative lg:hidden">
      <summary className="cursor-pointer list-none rounded-control border border-border px-4 py-2.5 font-mono text-xs uppercase tracking-[0.14em] text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        Menu
      </summary>
      <nav className="absolute right-0 top-[calc(100%+0.75rem)] w-60 rounded-control border border-border bg-panel p-2 shadow-2xl" aria-label="Mobile navigation">
        {items.map((item) => (
          <Link key={item.href} href={item.href} onClick={closeMenu} className="block px-4 py-3 font-mono text-xs uppercase tracking-[0.14em] text-text-primary hover:bg-raised focus-visible:outline-2 focus-visible:outline-accent">
            {item.label}
          </Link>
        ))}
        <Button href="#start" onClick={closeMenu} className="mt-2 w-full">Start a Print</Button>
      </nav>
    </details>
  );
}
