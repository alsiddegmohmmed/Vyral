import 'server-only';
import { one, q } from '@/lib/db/client';

// Transactional email. Every message is written to outbox_emails first (audit +
// dev outbox). With RESEND_API_KEY set it is sent through Resend's official API
// (https://resend.com/docs/api-reference/emails/send-email) from EMAIL_FROM on
// our own domain; without it, it stays 'logged' so dev works with no account.

export type EmailKind = 'verify_email' | 'reset_password' | 'card_link' | 'trial_ending' | 'invoice' | 'account_deleted';

export async function sendEmail(input: { to: string; subject: string; text: string; kind: EmailKind; orgId?: string }) {
  const row = await one<{ id: string }>(
    `insert into outbox_emails (org_id, to_email, subject, body_text, kind) values ($1,$2,$3,$4,$5) returning id`,
    [input.orgId ?? null, input.to, input.subject, input.text, input.kind],
  );
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    await q(`update outbox_emails set status = 'logged' where id = $1`, [row!.id]);
    if (process.env.NODE_ENV !== 'production') console.info(`[email:${input.kind}] logged to outbox_emails ${row!.id}`);
    return { id: row!.id, status: 'logged' as const };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': row!.id },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [input.to], subject: input.subject, text: input.text }),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) throw new Error(body.message ?? `HTTP ${res.status}`);
    await q(`update outbox_emails set status = 'sent', provider_id = $2, sent_at = now() where id = $1`, [row!.id, body.id ?? null]);
    return { id: row!.id, status: 'sent' as const };
  } catch (e) {
    await q(`update outbox_emails set status = 'failed', error = $2 where id = $1`, [row!.id, String((e as Error).message).slice(0, 500)]);
    return { id: row!.id, status: 'failed' as const };
  }
}

const base = () => process.env.PUBLIC_BASE_URL ?? 'http://localhost:3100';

export const emails = {
  verify: (to: string, token: string) => sendEmail({
    to, kind: 'verify_email', subject: 'Confirm your email',
    text: `Welcome! Confirm your email to keep your account:\n\n${base()}/verify?token=${token}\n\nThe link works for 48 hours. If you didn’t sign up, ignore this email.`,
  }),
  reset: (to: string, token: string) => sendEmail({
    to, kind: 'reset_password', subject: 'Reset your password',
    text: `Someone asked to reset the password for this email.\n\nChoose a new password here (link works for 1 hour):\n${base()}/reset?token=${token}\n\nIf it wasn’t you, ignore this email. Your password stays the same.`,
  }),
  cardLink: (to: string, business: string, serial: string, orgId: string) => sendEmail({
    to, orgId, kind: 'card_link', subject: `Your ${business} card`,
    text: `Here’s your ${business} stamp card:\n\n${base()}/c/${serial}\n\nShow it at the counter to collect stamps.`,
  }),
};
