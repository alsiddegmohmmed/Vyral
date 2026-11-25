'use client';
import Link from 'next/link';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/field';
import { Banner } from '@/components/ui/feedback';
import { loginAction, type AuthState } from '../actions';

export default function LoginPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(loginAction, {});
  return (
    <>
      <h1 className="text-2xl">Welcome back</h1>
      <p className="mt-1 text-sm text-text-muted">Sign in to manage your cards.</p>
      <form action={action} className="mt-6 flex flex-col gap-4" noValidate>
        {state.error && <Banner tone="danger" title={state.error} />}
        <Field label="Email"><TextInput name="email" type="email" autoComplete="email" inputMode="email" defaultValue={state.fields?.email} required /></Field>
        <Field label="Password"><TextInput name="password" type="password" autoComplete="current-password" required /></Field>
        <Button type="submit" size="lg" loading={pending} block>Sign in</Button>
      </form>
      <p className="mt-6 text-center text-sm text-text-muted">New here? <Link href="/signup" className="font-semibold text-text underline">Start a free trial</Link></p>
    </>
  );
}
