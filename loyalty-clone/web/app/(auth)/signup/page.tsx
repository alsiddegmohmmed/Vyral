'use client';
import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Select, TextInput } from '@/components/ui/field';
import { Banner } from '@/components/ui/feedback';
import { signupAction, type AuthState } from '../actions';

export default function SignupPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(signupAction, {});
  const [tz, setTz] = useState('Africa/Kigali');
  useEffect(() => { setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Kigali'); }, []);
  return (
    <>
      <h1 className="text-2xl">Start your free trial</h1>
      <p className="mt-1 text-sm text-text-muted">15 days, no payment needed. Your first card takes about five minutes.</p>
      <form action={action} className="mt-6 flex flex-col gap-4" noValidate>
        {state.error && <Banner tone="danger" title={state.error} />}
        <Field label="Business name"><TextInput name="businessName" autoComplete="organization" defaultValue={state.fields?.businessName} required /></Field>
        <Field label="Email"><TextInput name="email" type="email" autoComplete="email" inputMode="email" defaultValue={state.fields?.email} required /></Field>
        <Field label="Password" hint="At least 10 characters."><TextInput name="password" type="password" autoComplete="new-password" required /></Field>
        <Field label="Country">
          <Select name="country" defaultValue="RW">
            <option value="RW">Rwanda</option><option value="KE">Kenya</option><option value="UG">Uganda</option>
            <option value="TZ">Tanzania</option><option value="NG">Nigeria</option><option value="ZA">South Africa</option><option value="US">Another country</option>
          </Select>
        </Field>
        <input type="hidden" name="timezone" value={tz} />
        <p className="text-xs text-text-muted">Time zone: {tz}. You can change it in Settings.</p>
        <Button type="submit" size="lg" loading={pending} block>Create account</Button>
        <p className="text-xs text-text-muted">By creating an account you agree to our terms and privacy policy.</p>
      </form>
      <p className="mt-6 text-center text-sm text-text-muted">Already have an account? <Link href="/login" className="font-semibold text-text underline">Sign in</Link></p>
    </>
  );
}
