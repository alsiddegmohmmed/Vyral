'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

export function CardTabs({ id, draft }: { id: string; draft: boolean }) {
  const path = usePathname();
  const base = `/cards/${id}`;
  const tabs = [
    { href: base, label: 'Overview', exact: true, hide: draft },
    { href: `${base}/design`, label: 'Design' },
    { href: `${base}/customers`, label: 'Customers', hide: draft },
    { href: `${base}/messages`, label: 'Messages', hide: draft },
    { href: `${base}/automations`, label: 'Automations' },
    { href: `${base}/insights`, label: 'Insights', hide: draft },
  ].filter((t) => !t.hide);
  return (
    <nav aria-label="Card sections" className="-mx-4 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
      <ul className="flex gap-1">
        {tabs.map((t) => {
          const on = t.exact ? path === t.href : path.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link href={t.href} aria-current={on ? 'page' : undefined}
                className={cn('-mb-px flex h-10 items-center whitespace-nowrap border-b-2 border-transparent px-3 text-sm font-medium text-text-muted hover:text-text', on && 'border-accent text-text')}>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
