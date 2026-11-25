'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import * as api from '@/lib/data/api';
import { requireOwner } from '@/lib/session';

export type SettingsState = { error?: string; ok?: string; code?: string; expiresAt?: string };
const fail = (e: unknown): SettingsState => ({ error: e instanceof api.DataError ? e.message : 'Something went wrong. Try again.' });

export async function pairingCodeAction(_: SettingsState, form: FormData): Promise<SettingsState> {
  const ctx = await requireOwner();
  try {
    const r = await api.createPairingCode(ctx, String(form.get('label') ?? ''), String(form.get('locationId') ?? '') || undefined);
    return { code: r.code, expiresAt: r.expiresAt };
  } catch (e) { return fail(e); }
}

export async function revokeDeviceAction(id: string) {
  const ctx = await requireOwner();
  await api.revokeDevice(ctx, id);
  revalidatePath('/settings/devices');
}

export async function updateOrgAction(_: SettingsState, form: FormData): Promise<SettingsState> {
  const ctx = await requireOwner();
  const g = (k: string) => String(form.get(k) ?? '').trim();
  if (!g('name')) return { error: 'Enter your business name.' };
  try {
    await api.updateOrg(ctx, { name: g('name'), timezone: g('timezone'), website: g('website') || undefined, email: g('email') || undefined, phone: g('phone') || undefined, addressLine1: g('addressLine1') || undefined, city: g('city') || undefined });
  } catch (e) { return fail(e); }
  revalidatePath('/', 'layout');
  return { ok: 'Saved' };
}

export async function upsertLocationAction(_: SettingsState, form: FormData): Promise<SettingsState> {
  const ctx = await requireOwner();
  const g = (k: string) => String(form.get(k) ?? '').trim();
  try {
    await api.upsertLocation(ctx, {
      id: g('id') || undefined, name: g('name'), address: g('address'), lat: Number(g('lat')), lon: Number(g('lon')),
      addressOnCard: g('addressOnCard') || g('address'), showOnCard: form.get('showOnCard') === 'on', relevantText: g('relevantText').slice(0, 120),
    });
  } catch (e) { return fail(e); }
  revalidatePath('/locations');
  return { ok: 'Saved' };
}

export async function deleteLocationAction(id: string) {
  const ctx = await requireOwner();
  await api.deleteLocation(ctx, id);
  revalidatePath('/locations');
}

/** Real checkout when a provider is configured (Paddle for USD, Flutterwave for RWF); dev-only plan switch otherwise. */
export async function checkoutAction(plan: 'starter' | 'growth' | 'pro', interval: 'month' | 'year' = 'month'): Promise<SettingsState & { url?: string }> {
  const ctx = await requireOwner();
  const [org, billing] = await Promise.all([api.getOrg(ctx), api.getBilling(ctx)]);
  const usage = await (await import('@/lib/db/client')).one<{ designs: number; locations: number; devices: number }>(
    `select (select count(*) from campaigns where org_id = $1 and status <> 'archived')::int as designs,
            (select count(*) from locations where org_id = $1)::int as locations,
            (select count(*) from scanner_devices where org_id = $1 and revoked_at is null)::int as devices`, [ctx.orgId]);
  const lim = api.PLAN_LIMITS[plan];
  const over = [
    usage!.designs > lim.designs && `${usage!.designs} card designs (${plan} allows ${lim.designs}): archive some`,
    usage!.locations > lim.locations && `${usage!.locations} locations (allows ${lim.locations}): delete some`,
    usage!.devices > lim.devices && `${usage!.devices} counter phones (allows ${lim.devices}): remove some`,
  ].filter(Boolean);
  if (over.length) return { error: `You’re using more than ${plan[0].toUpperCase() + plan.slice(1)} includes: ${over.join('; ')}. Then choose the plan again.` };
  const configured = billing.currency === 'USD' ? !!process.env.PADDLE_API_KEY : !!process.env.FLW_SECRET_KEY;
  if (!configured) {
    try { await api.fakeCheckout(ctx, plan); } catch (e) { return fail(e); }
    revalidatePath('/', 'layout');
    return { ok: 'Plan changed (development mode: no payment provider configured).' };
  }
  const { startCheckout } = await import('@/lib/billing');
  const price = api.PRICES[plan][billing.currency] * (interval === 'year' ? 10 : 1);
  const user = await (await import('@/lib/db/client')).one<{ email: string }>('select email::text from users where id = $1', [ctx.userId]);
  const r = await startCheckout({
    orgId: ctx.orgId, orgName: org.name, email: user?.email ?? '', plan, interval, currency: billing.currency,
    amountMinor: billing.currency === 'USD' ? price * 100 : price,
    returnUrl: `${process.env.PUBLIC_BASE_URL ?? 'http://localhost:3100'}/settings/billing?paid=1`,
  });
  return 'url' in r ? { url: r.url } : { error: r.message };
}

export async function signOutEverywhereAction() {
  const ctx = await requireOwner();
  await api.endAllSessions(ctx);
  redirect('/login');
}

export async function resendVerificationAction(): Promise<SettingsState> {
  const ctx = await requireOwner();
  try { await api.resendVerification(ctx); } catch (e) { return fail(e); }
  return { ok: 'Sent. Check your inbox.' };
}

export async function deleteAccountAction(): Promise<SettingsState> {
  const ctx = await requireOwner();
  await api.scheduleAccountDeletion(ctx);
  redirect('/login?deleted=1');
}
