'use client';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/field';
import { Banner } from '@/components/ui/feedback';
import { resetAction, type AuthState } from '../actions';

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(resetAction.bind(null, token), {});
  return (
    <>
      <h1 className="text-2xl">Choose a new password</h1>
      <p className="mt-1 text-sm text-text-muted">You’ll be signed out everywhere else.</p>
      <form action={action} className="mt-6 flex flex-col gap-4" noValidate>
        {!token && <Banner tone="danger" title="This link is incomplete. Ask for a new one." />}
        {state.error && <Banner tone="danger" title={state.error} />}
        <Field label="New password" hint="At least 10 characters."><TextInput name="password" type="password" autoComplete="new-password" required /></Field>
        <Field label="New password again"><TextInput name="again" type="password" autoComplete="new-password" required /></Field>
        <Button type="submit" size="lg" loading={pending} disabled={!token} block>Save password</Button>
      </form>
    </>
  );
}
