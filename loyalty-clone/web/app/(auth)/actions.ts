'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { DataError, signIn, signUp } from '@/lib/data/api';
import { cookieOptions, SESSION_COOKIE } from '@/lib/session';

export type AuthState = { error?: string; fields?: Record<string, string> };

export async function loginAction(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get('email') ?? ''), password = String(form.get('password') ?? '');
  if (!email || !password) return { error: 'Enter your email and password.', fields: { email } };
  try {
    const token = await signIn(email, password);
    (await cookies()).set(SESSION_COOKIE, token, cookieOptions);
  } catch (e) {
    return { error: e instanceof DataError ? e.message : 'Something went wrong. Try again.', fields: { email } };
  }
  redirect('/cards');
}

export async function signupAction(_: AuthState, form: FormData): Promise<AuthState> {
  const f = Object.fromEntries(['email', 'password', 'businessName', 'timezone', 'country'].map((k) => [k, String(form.get(k) ?? '')]));
  const fields = { email: f.email, businessName: f.businessName };
  if (!f.businessName.trim()) return { error: 'Enter your business name.', fields };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) return { error: 'Enter an email like name@example.com.', fields };
  if (f.password.length < 10) return { error: 'Use at least 10 characters for your password.', fields };
  try {
    const token = await signUp({ email: f.email, password: f.password, businessName: f.businessName, timezone: f.timezone, country: f.country || 'RW' });
    (await cookies()).set(SESSION_COOKIE, token, cookieOptions);
  } catch (e) {
    return { error: e instanceof DataError ? e.message : 'Something went wrong. Try again.', fields };
  }
  redirect('/cards');
}
