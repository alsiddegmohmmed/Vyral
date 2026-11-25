'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { CreditCard, LayoutGrid, LogOut, MapPin, Menu, ScanLine, Settings, Smartphone, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { IconButton } from '@/components/ui/button';
import { GarukaLockup } from '@/components/brand/garuka-mark';

const nav = [
  { href: '/cards', label: 'Cards', icon: LayoutGrid },
  { href: '/locations', label: 'Locations', icon: MapPin },
  { href: '/settings/devices', label: 'Counter phones', icon: Smartphone },
  { href: '/settings/billing', label: 'Plan & billing', icon: CreditCard },
  { href: '/settings', label: 'Settings', icon: Settings, exact: true },
];

/** Square initial tile standing in for the business logo. */
function OrgTile({ name, className }: { name: string; className?: string }) {
  const initial = Array.from(name.trim())[0]?.toUpperCase() ?? '?';
  return <span aria-hidden className={cn('grid size-8 shrink-0 place-items-center rounded-sm bg-accent text-sm font-bold text-on-accent', className)}>{initial}</span>;
}

export function AppShell({ orgName, planLabel, banner, children, signOut }: {
  orgName: string; planLabel?: string; banner?: React.ReactNode; children: React.ReactNode; signOut: () => Promise<void>;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string, exact?: boolean) => (exact ? path === href : path === href || path.startsWith(`${href}/`));

  const sidebar = (
    <nav aria-label="Main" className="flex h-full flex-col p-3">
      <Link href="/cards" aria-label="Garuka, your cards" className="mb-4 ml-2 mt-1 w-fit text-[22px] text-accent"><GarukaLockup word="var(--tk-color-text)" /></Link>
      <div className="flex items-center gap-3 px-2 pb-4">
        <OrgTile name={orgName} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold" title={orgName}>{orgName}</p>
          {planLabel && <p className="truncate text-xs text-text-muted">{planLabel}</p>}
        </div>
      </div>
      <ul className="flex flex-col gap-0.5">
        {nav.map(({ href, label, icon: Icon, exact }) => {
          const on = active(href, exact);
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={() => setOpen(false)}
                aria-current={on ? 'page' : undefined}
                className={cn('flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-text-muted transition-colors duration-[var(--tk-motion-fast)] hover:bg-nav-active hover:text-text [&>svg]:size-[18px]',
                  on && 'bg-nav-active font-semibold text-text')}
              >
                <Icon aria-hidden /> {label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto flex flex-col gap-1 border-t border-border pt-3">
        <Link href="/scan" className="mb-1 flex h-10 items-center justify-center gap-2 rounded-md bg-accent px-3 text-sm font-semibold text-on-accent hover:bg-accent-hover [&>svg]:size-[18px]">
          <ScanLine aria-hidden /> Open scanner
        </Link>
        <form action={signOut}>
          <button type="submit" className="flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-text-muted hover:bg-nav-active hover:text-text [&>svg]:size-[18px]">
            <LogOut aria-hidden /> Sign out
          </button>
        </form>
      </div>
    </nav>
  );

  return (
    <div className="min-h-dvh bg-bg">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-on-accent">Skip to content</a>
      <aside className="fixed inset-y-0 left-0 z-[30] hidden w-[var(--tk-layout-sidebar)] border-r border-border bg-sidebar lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-[30] lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button aria-label="Close menu" className="absolute inset-0 bg-overlay/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[280px] bg-sidebar shadow-pop">{sidebar}</aside>
        </div>
      )}
      <div className="lg:pl-[var(--tk-layout-sidebar)]">
        <header className="sticky top-0 z-[20] flex h-14 items-center gap-3 border-b border-border bg-bg/95 px-4 backdrop-blur lg:hidden">
          <IconButton aria-label="Open menu" icon={open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />} onClick={() => setOpen(true)} />
          <OrgTile name={orgName} className="size-7" />
          <span className="truncate text-sm font-semibold">{orgName}</span>
        </header>
        <div className="mx-auto w-full max-w-[var(--tk-layout-content-max)] px-4 sm:px-6 lg:px-8">
          {banner && <div className="pt-4 lg:pt-6">{banner}</div>}
          <main id="main" className="py-6 sm:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

/** Page header: optional back link and eyebrow, H1 and one-line description on the left, the page's actions on the right. */
export function PageHeader({ title, description, actions, back, eyebrow, badge }: {
  title: string; description?: React.ReactNode; actions?: React.ReactNode; back?: { href: string; label: string }; eyebrow?: string; badge?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {back && <Link href={back.href} className="mb-2 inline-block text-sm text-text-muted hover:text-text hover:underline">← {back.label}</Link>}
        {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-muted">{eyebrow}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="min-w-0 break-words text-2xl">{title}</h1>
          {badge}
        </div>
        {description && <p className="mt-1.5 text-base text-text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
