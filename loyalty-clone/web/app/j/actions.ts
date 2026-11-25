'use server';
import { redirect } from 'next/navigation';
import { DataError, getPublicCampaign, joinCampaign } from '@/lib/data/api';
import { clientIp } from '@/lib/request';

export type JoinState = { error?: string; fieldErrors?: Record<string, string>; sent?: boolean; values?: Record<string, string> };

import { toE164 } from '@/lib/phone';

export async function joinAction(shortCode: string, _: JoinState, form: FormData): Promise<JoinState> {
  const c = await getPublicCampaign(shortCode);
  if (!c || c.status !== 'live') return { error: 'This card isn’t taking new members right now.' };
  const values: Record<string, string> = {};
  const errs: Record<string, string> = {};
  for (const f of c.fields) {
    let v = String(form.get(f.key) ?? '').trim();
    if (f.type === 'phone' && v) {
      const cc = String(form.get(`${f.key}__cc`) ?? c.defaultCountry);
      const e164 = toE164(v, cc);
      if (!e164) errs[f.key] = 'Enter a valid phone number.';
      v = e164 ?? v;
    }
    if (f.type === 'birthday') {
      const m = String(form.get(`${f.key}__m`) ?? ''), d = String(form.get(`${f.key}__d`) ?? '');
      v = m && d ? `${m}-${d}` : '';
      if ((m && !d) || (!m && d)) errs[f.key] = 'Choose both the day and the month.';
      else if (m && d && Number(d) > [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][Number(m) - 1]) errs[f.key] = 'That date doesn’t exist. Check the day.';
    }
    if ((f.type === 'name' || f.type === 'text') && v.length > 120) errs[f.key] = 'Keep it under 120 characters.';
    if (f.type === 'email' && v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) errs[f.key] = 'Enter an email like name@example.com.';
    if (f.required && !v && !errs[f.key]) errs[f.key] = `“${f.label}” is required.`;
    values[f.key] = v;
  }
  const echo = Object.fromEntries(c.fields.map((f) => [f.key, String(form.get(f.key) ?? '')]));
  if (Object.keys(errs).length) return { fieldErrors: errs, values: echo };
  let serial: string;
  try {
    const r = await joinCampaign(shortCode, { values, consent: form.get('consent') === 'on', ip: await clientIp() });
    if (r.status === 'sent') return { sent: true };
    serial = r.serial;
  } catch (e) {
    return { error: e instanceof DataError ? e.message : 'Something went wrong. Please try again.', values: echo };
  }
  redirect(`/c/${serial}?new=1`);
}
