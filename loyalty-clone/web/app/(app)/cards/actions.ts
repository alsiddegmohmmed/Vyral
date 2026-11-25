'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import * as api from '@/lib/data/api';
import { requireOwner } from '@/lib/session';
import type { FormField } from '@/lib/data/types';

export type ActionState = { error?: string; ok?: string };
const fail = (e: unknown): ActionState => ({ error: e instanceof api.DataError ? e.message : 'Something went wrong. Try again.' });

export async function createCardAction(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireOwner();
  let id: string;
  try { id = (await api.createCampaign(ctx, String(form.get('name') ?? ''))).id; } catch (e) { return fail(e); }
  redirect(`/cards/${id}/design`);
}

export async function saveDesignAction(id: string, patch: api.CampaignPatch): Promise<ActionState> {
  const ctx = await requireOwner();
  try { await api.updateCampaign(ctx, id, patch); } catch (e) { return fail(e); }
  revalidatePath(`/cards/${id}`, 'layout');
  return { ok: 'Saved' };
}

export async function saveFieldsAction(id: string, fields: FormField[]): Promise<ActionState> {
  const ctx = await requireOwner();
  try { await api.setFormFields(ctx, id, fields); } catch (e) { return fail(e); }
  revalidatePath(`/cards/${id}`, 'layout');
  return { ok: 'Saved' };
}

export async function saveCardLocationsAction(id: string, locationIds: string[]): Promise<ActionState> {
  const ctx = await requireOwner();
  try { await api.setCampaignLocations(ctx, id, locationIds); } catch (e) { return fail(e); }
  revalidatePath(`/cards/${id}`, 'layout');
  return { ok: 'Saved' };
}

export async function activateAction(id: string): Promise<ActionState> {
  const ctx = await requireOwner();
  try { await api.activateCampaign(ctx, id); } catch (e) { return fail(e); }
  revalidatePath('/cards', 'layout');
  redirect(`/cards/${id}?live=1`);
}

export async function setStatusAction(id: string, status: 'live' | 'paused' | 'archived'): Promise<ActionState> {
  const ctx = await requireOwner();
  try { await api.setCampaignStatus(ctx, id, status); } catch (e) { return fail(e); }
  revalidatePath('/cards', 'layout');
  if (status === 'archived') redirect('/cards');
  return { ok: status === 'paused' ? 'Paused. Customers can’t join or collect stamps.' : 'Live again.' };
}

export async function pushUpdateAction(id: string): Promise<ActionState> {
  const ctx = await requireOwner();
  try { const n = await api.pushCampaignUpdate(ctx, id); return { ok: `Updating ${n} ${n === 1 ? 'card' : 'cards'}.` }; } catch (e) { return fail(e); }
}

export async function giveStampsAction(cardId: string, stamps: number, redeem: number, key: string): Promise<ActionState> {
  const ctx = await requireOwner();
  const r = await api.applyCardTransaction(ctx, { cardId, stamps, redeem, source: 'dashboard', idempotencyKey: key });
  if (!r.ok) return { error: (await import('@/lib/data/rules')).txErrorMessage[r.error as keyof typeof import('@/lib/data/rules').txErrorMessage] ?? 'That didn’t work.' };
  revalidatePath('/cards', 'layout');
  const parts = [stamps > 0 && `${stamps} ${stamps === 1 ? 'stamp' : 'stamps'} added`, stamps < 0 && `${-stamps} removed`, r.result.earned > 0 && `${r.result.earned} reward earned`, redeem > 0 && 'reward given'].filter(Boolean);
  return { ok: parts.join(' · ') };
}

export async function updateCustomerAction(cardId: string, patch: { name: string; email: string; phone: string }): Promise<ActionState> {
  const ctx = await requireOwner();
  try { await api.updateCustomer(ctx, cardId, patch); } catch (e) { return fail(e); }
  revalidatePath('/cards', 'layout');
  return { ok: 'Saved' };
}

export async function deleteCardAction(campaignId: string, cardId: string, farewell: string): Promise<ActionState> {
  const ctx = await requireOwner();
  try { await api.deleteCard(ctx, cardId, farewell); } catch (e) { return fail(e); }
  revalidatePath('/cards', 'layout');
  redirect(`/cards/${campaignId}/customers?deleted=1`);
}

export async function addCustomerAction(campaignId: string, _: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireOwner();
  const name = String(form.get('name') ?? '').trim(), phone = String(form.get('phone') ?? ''), email = String(form.get('email') ?? '');
  if (!name) return { error: 'Enter the customer’s name.' };
  if (!phone && !email) return { error: 'Enter a phone number or an email.' };
  try { const serial = await api.createCardForCustomer(ctx, campaignId, { name, phone, email }); revalidatePath('/cards', 'layout'); return { ok: serial }; } catch (e) { return fail(e); }
}

export async function sendBroadcastAction(campaignId: string, _: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireOwner();
  try {
    const m = await api.sendBroadcast(ctx, campaignId, String(form.get('body') ?? ''));
    revalidatePath(`/cards/${campaignId}/messages`);
    return { ok: `Sending to ${m.recipients} wallet ${m.recipients === 1 ? 'pass' : 'passes'} now. Also showing on ${m.webCards} web cards. Delivery numbers appear in the list below.` };
  } catch (e) { return fail(e); }
}

export async function saveAutomationAction(campaignId: string, kind: 'birthday' | 'winback', input: { enabled: boolean; body: string; daysInactive?: number; sendHour: number }): Promise<ActionState> {
  const ctx = await requireOwner();
  try { await api.saveAutomation(ctx, campaignId, kind, input); } catch (e) { return fail(e); }
  revalidatePath(`/cards/${campaignId}/automations`);
  return { ok: 'Saved' };
}
