import { LoginForm } from './login-form';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reset?: string; deleted?: string }> }) {
  const sp = await searchParams;
  const notice = sp.reset ? 'Password changed. Sign in with your new password.'
    : sp.deleted ? 'Your account will be deleted in 7 days. Sign in before then to keep it.' : undefined;
  return <LoginForm notice={notice} />;
}
