'use server';
import { revalidatePath } from 'next/cache';
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

export async function checkoutAction(plan: 'starter' | 'growth' | 'pro') {
  const ctx = await requireOwner();
  await api.fakeCheckout(ctx, plan);
  revalidatePath('/', 'layout');
}
