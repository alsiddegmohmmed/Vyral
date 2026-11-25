import { GarukaLockup } from '@/components/brand/garuka-mark';
import { AuthProgress, AuthRail } from './auth-rail';

// Two columns on wide screens: a tinted rail (setup steps or a short pitch) and
// the form in a centred column. Phones get the form alone, with a thin progress bar.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg lg:grid lg:grid-cols-[var(--tk-layout-rail)_1fr]">
      <aside aria-label="About this service" className="hidden border-r border-border bg-sidebar lg:flex lg:flex-col lg:gap-10 lg:p-6">
        <div className="px-3 pt-1 text-[28px] text-accent"><GarukaLockup word="var(--tk-color-text)" /></div>
        <AuthRail />
        <p className="mt-auto px-3 text-xs text-text-muted">Garuka means “come back”. That’s the whole job.</p>
      </aside>
      <main className="flex min-h-dvh flex-col px-4 py-8 sm:px-8 lg:justify-center lg:py-14">
        <div className="mx-auto w-full max-w-[440px]">
          <div className="mb-8 text-[26px] text-accent lg:hidden"><GarukaLockup word="var(--tk-color-text)" /></div>
          <AuthProgress />
          {children}
        </div>
      </main>
    </div>
  );
}
