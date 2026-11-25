import { MessageSquare } from 'lucide-react';
import { Badge, Banner, EmptyState } from '@/components/ui/feedback';
import { BudgetNote } from '@/components/loyalty/dashboard';
import { broadcastReach, getCampaign, listMessages } from '@/lib/data/api';
import { requireOwner } from '@/lib/session';
import { Composer } from './composer';

const KIND = { broadcast: 'To everyone', birthday: 'Birthday', winback: 'We miss you' } as const;

export default async function MessagesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOwner();
  const [c, reach, history] = await Promise.all([getCampaign(ctx, id), broadcastReach(ctx, id), listMessages(ctx, id)]);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section aria-labelledby="new" className="flex flex-col gap-4 rounded-lg border border-border p-5">
        <h2 id="new" className="text-lg">Message everyone</h2>
        {c.status !== 'live' ? <Banner tone="warning" title="Resume the card to send messages" /> : <Composer id={id} wallet={reach.wallet} webCards={reach.webCards} business={c.programName} />}
        <BudgetNote />
      </section>
      <section aria-labelledby="sent" className="flex flex-col gap-3">
        <h2 id="sent" className="text-lg">Sent</h2>
        {history.length === 0 ? (
          <EmptyState icon={<MessageSquare aria-hidden />} title="No messages yet">Tell customers about a new drink, a holiday opening or double-stamp days.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-3">
            {history.map((m) => (
              <li key={m.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge tone={m.kind === 'broadcast' ? 'info' : 'neutral'}>{KIND[m.kind]}</Badge>
                  <time dateTime={m.createdAt} className="text-xs text-text-muted">{new Date(m.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</time>
                </div>
                <p className="mt-2 break-words text-sm">{m.body}</p>
                <p className="mt-2 text-xs tabular text-text-muted">{m.delivered} delivered{m.skipped ? ` · ${m.skipped} skipped (daily limit)` : ''}{m.webCards ? ` · on ${m.webCards} web cards` : ''}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
