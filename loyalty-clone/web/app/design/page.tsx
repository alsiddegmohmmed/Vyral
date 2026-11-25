import type { Metadata } from 'next';
import tokens from '../../../replica/design/tokens.json';
import { DesignShowcase } from './showcase';

export const metadata: Metadata = { title: 'Design system' };

const colorEntries = Object.entries(tokens.color).filter(([k]) => !k.startsWith('_')) as [string, string][];

export default function DesignPage() {
  return (
    <main className="mx-auto flex max-w-[1200px] flex-col gap-14 px-4 py-10 sm:px-6">
      <header>
        <p className="text-sm font-semibold text-text-muted">replica-design · v1</p>
        <h1 className="mt-1 text-display">Design system</h1>
        <p className="mt-3 max-w-2xl text-text-muted">
          Every primitive from <code className="font-mono text-sm">components.md</code>, built once, in isolation, on the tokens in{' '}
          <code className="font-mono text-sm">tokens.json</code>. The accent is a neutral placeholder until /replica-brand.
        </p>
      </header>

      <section aria-labelledby="colours" className="flex flex-col gap-4">
        <h2 id="colours" className="text-xl">Colour roles</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {colorEntries.map(([name, hex]) => (
            <li key={name} className="overflow-hidden rounded-md border border-border">
              <div className="h-14" style={{ background: `var(--tk-color-${name})` }} />
              <div className="px-2.5 py-2">
                <p className="text-xs font-semibold">{name}</p>
                <p className="font-mono text-xs text-text-muted">{hex}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="type" className="flex flex-col gap-4">
        <h2 id="type" className="text-xl">Type scale</h2>
        <div className="flex flex-col gap-3">
          {Object.entries(tokens.type).map(([name, t]) => (
            <div key={name} className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-b border-border pb-3">
              <span className="w-28 font-mono text-xs text-text-muted">{name} · {t.size}/{t.line}/{t.weight}</span>
              <span style={{ fontSize: `var(--tk-text-${name})`, lineHeight: `var(--tk-text-${name}--line-height)`, fontWeight: t.weight }}>
                {name === 'scanner' ? '9 / 10' : 'Stamps that bring them back'}
              </span>
            </div>
          ))}
        </div>
      </section>

      <DesignShowcase />
    </main>
  );
}
