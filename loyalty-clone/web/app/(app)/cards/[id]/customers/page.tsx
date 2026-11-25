import Link from 'next/link';
import { Search, Users } from 'lucide-react';
import { Badge, Banner, EmptyState } from '@/components/ui/feedback';
import { buttonClass } from '@/components/ui/button';
import { getCampaign, listCards, type CardSort } from '@/lib/data/api';
import { requireOwner } from '@/lib/session';
import { AddCustomer } from './add-customer';

const SORTS: { value: CardSort; label: string }[] = [
  { value: 'last_visit', label: 'Last visit' }, { value: 'stamps', label: 'Most stamps' }, { value: 'joined', label: 'Newest' }, { value: 'name', label: 'Name' },
];
const PAGE = 25;
const ago = (iso: string) => { const d = Math.floor((Date.now() - +new Date(iso)) / 86_400_000); return d <= 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d} days ago`; };

export default async function CustomersPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string; sort?: CardSort; page?: string; deleted?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const ctx = await requireOwner();
  const page = Math.max(1, Number(sp.page) || 1);
  const sort = SORTS.some((s) => s.value === sp.sort) ? sp.sort! : 'last_visit';
  const [c, { rows, total }] = await Promise.all([getCampaign(ctx, id), listCards(ctx, id, { q: sp.q, sort, limit: PAGE * page })]);
  const qs = (o: Record<string, string | undefined>) => '?' + new URLSearchParams(Object.entries({ q: sp.q, sort, ...o }).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <div className="flex flex-col gap-4">
      {sp.deleted && <Banner tone="success" title="Card deleted" />}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <form role="search" className="flex w-full max-w-md gap-2" action="">
          <label htmlFor="q" className="sr-only">Search customers</label>
          <div className="relative flex-1">
            <Search aria-hidden className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-subtle" />
            <input id="q" name="q" defaultValue={sp.q} placeholder="Name, phone or email" className="h-10 w-full rounded-md border border-border-input bg-bg pl-9 pr-3 text-base sm:text-sm" />
          </div>
          <input type="hidden" name="sort" value={sort} />
          <button className={buttonClass('secondary')}>Search</button>
        </form>
        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label="Sort" className="flex flex-wrap gap-1 text-sm">
            {SORTS.map((s) => (
              <Link key={s.value} href={qs({ sort: s.value, page: undefined })} aria-current={s.value === sort ? 'true' : undefined}
                className={`rounded-md px-2.5 py-1.5 ${s.value === sort ? 'bg-surface font-semibold' : 'text-text-muted hover:text-text'}`}>{s.label}</Link>
            ))}
          </nav>
          {c.status === 'live' && <AddCustomer campaignId={id} />}
        </div>
      </div>

      {total === 0 && !sp.q ? (
        <EmptyState icon={<Users aria-hidden />} title="No one has joined yet" action={<Link href={`/cards/${id}`} className={buttonClass('primary', 'sm')}>Get your QR code</Link>}>
          Put your QR code where customers pay. The first ones usually join the same day.
        </EmptyState>
      ) : total === 0 ? (
        <EmptyState icon={<Search aria-hidden />} title={`No customers match “${sp.q}”`} action={<Link href={`/cards/${id}/customers`} className={buttonClass('secondary', 'sm')}>Clear search</Link>}>Try part of a name or the last digits of a phone number.</EmptyState>
      ) : (
        <>
          <p className="text-sm text-text-muted" aria-live="polite">{total} {total === 1 ? 'customer' : 'customers'}{sp.q ? ` matching “${sp.q}”` : ''}</p>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <caption className="sr-only">Customers on {c.name}, sorted by {SORTS.find((s) => s.value === sort)?.label}</caption>
              <thead className="hidden bg-surface text-left text-text-muted md:table-header-group">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Name</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Stamps</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Card</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Last visit</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.cardId} className="grid grid-cols-[1fr_auto] gap-x-3 border-t border-border px-4 py-3 first:border-t-0 hover:bg-surface md:table-row md:p-0">
                    <td className="min-w-0 md:px-4 md:py-3">
                      <Link href={`/cards/${id}/customers/${r.cardId}`} className="block truncate font-medium hover:underline">{r.name || 'No name'}</Link>
                      <span className="block truncate text-xs text-text-muted">{r.phone ?? r.email}</span>
                    </td>
                    <td className="text-right tabular md:px-4 md:py-3 md:text-left">
                      {r.currentStamps}/{c.totalStamps}{r.rewardsAvailable > 0 && <span className="ml-2"><Badge tone="success">{r.rewardsAvailable} ready</Badge></span>}
                    </td>
                    <td className="md:px-4 md:py-3">{r.wallet === 'web' ? <Badge>Web card</Badge> : <Badge tone="info">{r.wallet === 'apple' ? 'Apple Wallet' : 'Google Wallet'}</Badge>}</td>
                    <td className="text-right text-text-muted md:px-4 md:py-3 md:text-left">{ago(r.lastVisitAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length < total && <Link href={qs({ page: String(page + 1) })} scroll={false} className={`${buttonClass('secondary')} self-center`}>Show more</Link>}
        </>
      )}
    </div>
  );
}
