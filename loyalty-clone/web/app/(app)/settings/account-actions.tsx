'use client';
import { useState, useTransition } from 'react';
import { LogOut, MailCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Banner } from '@/components/ui/feedback';
import { ConfirmDialog } from '@/components/ui/overlays';
import { deleteAccountAction, resendVerificationAction, signOutEverywhereAction } from './actions';

export function AccountActions({ businessName, verified }: { businessName: string; verified: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <section aria-labelledby="account" className="mt-10 flex max-w-[560px] flex-col gap-4 border-t border-border pt-6">
      <h2 id="account" className="text-lg">Account</h2>
      {!verified && (
        <Banner tone="warning" title="Confirm your email" action={<Button size="sm" variant="secondary" loading={pending} onClick={() => start(async () => { const r = await resendVerificationAction(); setMsg(r.error ?? r.ok ?? null); })}><MailCheck aria-hidden className="size-4" /> Resend link</Button>}>
          We sent you a link when you signed up. It keeps your account recoverable.
        </Banner>
      )}
      {msg && <p role="status" className="text-sm text-text-muted">{msg}</p>}
      <form action={signOutEverywhereAction}><Button type="submit" variant="secondary"><LogOut aria-hidden className="size-4" /> Sign out on all devices</Button></form>
      <ConfirmDialog trigger={<Button variant="ghost" className="self-start text-danger"><Trash2 aria-hidden className="size-4" /> Delete account</Button>}
        title="Delete your account?" action="Delete account" typeToConfirm={businessName} onConfirm={() => start(() => deleteAccountAction().then(() => undefined))}>
        You’re signed out everywhere and new customers can’t join from now on. Existing cards keep working for 7 days, then everything, including customer data, is deleted for good. Changed your mind? Sign in again within those 7 days.
      </ConfirmDialog>
    </section>
  );
}
