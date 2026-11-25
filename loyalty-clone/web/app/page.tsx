import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto max-w-[560px] p-8">
      <h1 className="text-2xl">Loyalty clone</h1>
      <p className="mt-2 text-text-muted">Nothing here yet. The design system lives at <Link className="underline" href="/design">/design</Link>.</p>
    </main>
  );
}
