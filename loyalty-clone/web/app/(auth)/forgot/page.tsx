'use client';
import Link from 'next/link';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/field';
import { Banner } from '@/components/ui/feedback';
import { forgotAction, type AuthState } from '../actions';

export default function ForgotPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(forgotAction, {});
  return (
    <>
      <h1 className="text-2xl">Reset your password</h1>
      {state.fields?.sent ? (
        <div className="mt-6"><Banner tone="success" title="Check your email">If an account uses that address, we’ve sent a link. It works for one hour.</Banner></div>
      ) : (
        <form action={action} className="mt-6 flex flex-col gap-4" noValidate>
          {state.error && <Banner tone="danger" title={state.error} />}
          <Field label="Email"><TextInput name="email" type="email" inputMode="email" autoComplete="email" defaultValue={state.fields?.email} required /></Field>
          <Button type="submit" size="lg" loading={pending} block>Send reset link</Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm"><Link href="/login" className="text-text-muted underline">Back to sign in</Link></p>
    </>
  );
}
