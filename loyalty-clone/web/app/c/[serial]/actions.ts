'use server';
import { revalidatePath } from 'next/cache';
import { openPrize } from '@/lib/data/api';

/** The customer reveals a mystery box prize (it was drawn when the card filled). */
export async function openPrizeAction(serial: string, prizeId: string) {
  const ok = await openPrize(serial, prizeId);
  revalidatePath(`/c/${serial}`);
  return ok;
}
