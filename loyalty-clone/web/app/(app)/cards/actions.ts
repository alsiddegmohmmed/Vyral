'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import * as api from '@/lib/data/api';
import { requireOwner } from '@/lib/session';
import type { FormField } from '@/lib/data/types';

export type ActionState = { error?: string; ok?: string };
const fail = (e: unknown): ActionState => ({ error: e instanceof api.DataError ? e.message : 'Something went wrong. Try again.' });

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

export type WizardInput = {
  name: string; programName: string; icon: string; totalStamps: number; reward: string;
  theme: { background: string; foreground: string; label: string; stamp: string };
  locationIds: string[]; goLive: boolean;
};

/**
 * New-card wizard (/cards/new): validate everything first, so a taken name or a bad
 * value never leaves a half-made card behind; then create, apply the choices, and
 * either go live (overview with the QR) or open the designer.
 */
export async function createCardFromWizardAction(input: WizardInput): Promise<ActionState & { step?: number }> {
  const ctx = await requireOwner();
  const name = input.name.trim();
  if (!name) return { error: 'Give the card a name.', step: 2 };
  if (name.length > 60) return { error: 'Card name: 60 characters max.', step: 2 };
  const reward = input.reward.trim();
  if (!reward) return { error: 'Say what a full card gets.', step: 3 };
  if (reward.length > 60) return { error: 'Reward: 60 characters max.', step: 3 };
  if (!Number.isInteger(input.totalStamps) || input.totalStamps < 1 || input.totalStamps > 30) return { error: 'Choose between 1 and 30 stamps.', step: 3 };
  if (!Object.values(input.theme).every((c) => /^#[0-9A-Fa-f]{6}$/.test(c))) return { error: 'Choose one of the colour themes.', step: 2 };
  let id: string;
  try {
    const c = await api.createCampaign(ctx, name);
    id = c.id;
    const programName = input.programName.trim().slice(0, 40) || c.programName;
    await api.updateCampaign(ctx, id, {
      programName, totalStamps: input.totalStamps, reward: { ...c.reward, name: reward },
      design: { ...c.design, ...input.theme, icon: input.icon, logoText: programName.slice(0, 24) },
    });
    if (input.locationIds.length) await api.setCampaignLocations(ctx, id, input.locationIds);
    if (input.goLive) await api.activateCampaign(ctx, id);
  } catch (e) {
    const r = fail(e);
    return { ...r, step: e instanceof api.DataError && e.key === 'name_taken' ? 2 : undefined };
  }
  revalidatePath('/cards', 'layout');
  redirect(input.goLive ? `/cards/${id}?live=1` : `/cards/${id}/design`);
}
