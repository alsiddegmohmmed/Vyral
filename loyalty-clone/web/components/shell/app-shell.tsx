'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { CreditCard, LayoutGrid, LogOut, MapPin, Menu, ScanLine, Settings, Smartphone, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { IconButton } from '@/components/ui/button';

const nav = [
  { href: '/cards', label: 'Cards', icon: LayoutGrid },
  { href: '/locations', label: 'Locations', icon: MapPin },
  { href: '/settings/devices', label: 'Counter phones', icon: Smartphone },
  { href: '/settings/billing', label: 'Plan & billing', icon: CreditCard },
  { href: '/settings', label: 'Settings', icon: Settings, exact: true },
];

export function AppShell({ orgName, banner, children, signOut }: {
  orgName: string; banner?: React.ReactNode; children: React.ReactNode; signOut: () => Promise<void>;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string, exact?: boolean) => (exact ? path === href : path === href || path.startsWith(`${href}/`));

  const sidebar = (
    <nav aria-label="Main" className="flex h-full flex-col gap-1 p-3">
      <p className="truncate px-3 pb-3 pt-2 text-sm font-semibold" title={orgName}>{orgName}</p>
      {nav.map(({ href, label, icon: Icon, exact }) => (
        <Link
          key={href}
          href={href}
          onClick={() => setOpen(false)}
          aria-current={active(href, exact) ? 'page' : undefined}
          className={cn('flex h-10 items-center gap-2.5 rounded-md px-3 text-sm text-text-muted hover:bg-surface hover:text-text [&>svg]:size-4',
            active(href, exact) && 'bg-surface font-semibold text-text')}
        >
          <Icon aria-hidden /> {label}
        </Link>
      ))}
      <div className="mt-auto flex flex-col gap-1 border-t border-border pt-3">
        <Link href="/scan" className="flex h-10 items-center gap-2.5 rounded-md px-3 text-sm font-semibold hover:bg-surface [&>svg]:size-4">
          <ScanLine aria-hidden /> Open scanner
        </Link>
        <form action={signOut}>
          <button type="submit" className="flex h-10 w-full items-center gap-2.5 rounded-md px-3 text-sm text-text-muted hover:bg-surface hover:text-text [&>svg]:size-4">
            <LogOut aria-hidden /> Sign out
          </button>
        </form>
      </div>
    </nav>
  );

  return (
    <div className="min-h-dvh bg-bg">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-on-accent">Skip to content</a>
      <aside className="fixed inset-y-0 left-0 z-[30] hidden w-[248px] border-r border-border bg-bg lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-[30] lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button aria-label="Close menu" className="absolute inset-0 bg-overlay/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[280px] bg-bg shadow-pop">{sidebar}</aside>
        </div>
      )}
      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-[20] flex h-14 items-center gap-2 border-b border-border bg-bg/95 px-4 backdrop-blur lg:hidden">
          <IconButton aria-label="Open menu" icon={open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />} onClick={() => setOpen(true)} />
          <span className="truncate text-sm font-semibold">{orgName}</span>
        </header>
        {banner && <div className="px-4 pt-4 sm:px-6">{banner}</div>}
        <main id="main" className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions, back }: { title: string; description?: React.ReactNode; actions?: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && <Link href={back.href} className="text-sm text-text-muted hover:text-text hover:underline">← {back.label}</Link>}
        <h1 className="mt-1 break-words text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
