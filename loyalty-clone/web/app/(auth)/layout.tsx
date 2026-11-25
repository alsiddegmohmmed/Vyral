export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-surface px-4 py-10">
      <div className="w-full max-w-[420px] rounded-xl border border-border bg-surface-raised p-6 shadow-card sm:p-8">{children}</div>
    </main>
  );
}
