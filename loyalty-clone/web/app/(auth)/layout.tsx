import { Stamp } from 'lucide-react';
import { AuthProgress, AuthRail } from './auth-rail';

// Two columns on wide screens: a tinted rail (setup steps or a short pitch) and
// the form in a centred column. Phones get the form alone, with a thin progress bar.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg lg:grid lg:grid-cols-[var(--tk-layout-rail)_1fr]">
      <aside aria-label="About this service" className="hidden border-r border-border bg-sidebar lg:flex lg:flex-col lg:gap-10 lg:p-6">
        <div className="flex items-center gap-2.5 px-3 pt-1">
          <span aria-hidden className="grid size-8 place-items-center rounded-sm bg-accent text-on-accent"><Stamp className="size-[18px]" /></span>
          <span className="text-sm font-semibold">Loyalty cards</span>
        </div>
        <AuthRail />
        <p className="mt-auto px-3 text-xs text-text-muted">Digital stamp cards for small businesses.</p>
      </aside>
      <main className="flex min-h-dvh flex-col px-4 py-8 sm:px-8 lg:justify-center lg:py-14">
        <div className="mx-auto w-full max-w-[440px]">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span aria-hidden className="grid size-8 place-items-center rounded-sm bg-accent text-on-accent"><Stamp className="size-[18px]" /></span>
            <span className="text-sm font-semibold">Loyalty cards</span>
          </div>
          <AuthProgress />
          {children}
        </div>
      </main>
    </div>
  );
}
