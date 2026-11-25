import { automationForecast, getAutomations, getCampaign, getOrg } from '@/lib/data/api';
import { requireOwner } from '@/lib/session';
import { BudgetNote } from '@/components/loyalty/dashboard';
import { AutomationEditor } from './editor';

export default async function AutomationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOwner();
  const [c, a, org] = await Promise.all([getCampaign(ctx, id), getAutomations(ctx, id), getOrg(ctx)]);
  const [fb, fw] = await Promise.all([automationForecast(ctx, id, 'birthday'), automationForecast(ctx, id, 'winback', a.winback.daysInactive ?? 30)]);
  const hasBirthday = c.fields.some((f) => f.type === 'birthday');
  return (
    <div className="flex flex-col gap-5">
      <p className="max-w-2xl text-sm text-text-muted">Messages that send themselves to customers with the card in their wallet. Each customer gets them at most once (birthdays once a year; “We miss you” once per absence).</p>
      <BudgetNote />
      <div className="grid gap-5 lg:grid-cols-2">
        <AutomationEditor campaignId={id} kind="birthday" initial={a.birthday} forecast={fb} timezone={org.timezone} blocked={!hasBirthday ? 'Add a Birthday field to the signup form (Design → Signup form) to use this.' : undefined} />
        <AutomationEditor campaignId={id} kind="winback" initial={a.winback} forecast={fw} timezone={org.timezone} />
      </div>
    </div>
  );
}
