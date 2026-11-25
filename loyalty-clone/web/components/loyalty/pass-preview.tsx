'use client';
import { useState } from 'react';
import { SegmentedControl } from '@/components/ui/controls';
import { StampStrip } from './stamp-strip';

export type CardDesign = {
  business: string; programName: string; reward: string; total: number; filled: number; icon: string;
  background: string; foreground: string; label: string; stamp: string; logoText: string;
};

const QRStub = () => (
  <div aria-hidden className="relative mx-auto grid size-28 place-items-center rounded-md bg-white">
    <div className="size-24 bg-[repeating-conic-gradient(#111_0_25%,#fff_0_50%)] bg-[length:12px_12px] opacity-80 blur-[1.5px]" />
    <span className="absolute rounded-sm bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-black">Preview</span>
  </div>
);

function AppleFront({ d }: { d: CardDesign }) {
  return (
    <div className="flex aspect-[1/1.4] w-full flex-col overflow-hidden rounded-xl shadow-pass" style={{ background: d.background, color: d.foreground }}>
      <div className="flex items-center justify-between px-4 pt-4">
        <span className="font-bold">{d.logoText}</span>
        <span className="text-right">
          <span className="block text-[10px] font-semibold uppercase tracking-wide" style={{ color: d.label }}>Stamps</span>
          <span className="tabular text-lg font-semibold">{d.filled}/{d.total}</span>
        </span>
      </div>
      <div className="mt-3 px-4" style={{ background: 'rgba(0,0,0,.12)' }}>
        <StampStrip total={d.total} filled={d.filled} icon={d.icon} stamp={d.stamp} empty={`${d.foreground}55`} background={d.background} className="w-full py-3" />
      </div>
      <div className="grid grid-cols-2 gap-2 px-4 pt-3 text-sm">
        <div><p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: d.label }}>Reward</p><p className="font-medium">{d.reward}</p></div>
        <div className="text-right"><p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: d.label }}>To go</p><p className="tabular font-medium">{d.total - d.filled}</p></div>
      </div>
      <div className="mt-auto pb-5"><QRStub /></div>
    </div>
  );
}

function AppleBack({ d }: { d: CardDesign }) {
  const rows: [string, string][] = [
    ['Latest news', 'Double stamps every Friday this month.'],
    ['How to earn', 'One stamp for every drink you buy.'],
    ['Your reward', `${d.reward} after ${d.total} stamps.`],
    ['Find us', 'KG 7 Ave, Kigali'],
    ['Terms', 'One stamp per visit. Rewards can’t be exchanged for cash.'],
  ];
  return (
    <div className="aspect-[1/1.4] w-full overflow-auto rounded-xl bg-[#f2f2f7] p-4 text-[#1c1c1e] shadow-pass">
      <p className="mb-3 text-center text-sm font-semibold">{d.business}</p>
      <dl className="divide-y divide-black/10 rounded-lg bg-white">
        {rows.map(([k, v]) => (
          <div key={k} className="px-3 py-2.5">
            <dt className="text-xs text-black/60">{k}</dt>
            <dd className="text-sm">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function GoogleCard({ d }: { d: CardDesign }) {
  return (
    <div className="flex aspect-[1/1.4] w-full flex-col overflow-hidden rounded-2xl shadow-pass" style={{ background: d.background, color: d.foreground }}>
      <div className="flex items-center gap-2 px-4 pt-4">
        <span className="grid size-8 place-items-center rounded-pill bg-white/90 text-xs font-bold text-black">{d.logoText.slice(0, 1)}</span>
        <span className="text-sm font-medium">{d.business}</span>
      </div>
      <p className="px-4 pt-3 text-xl font-semibold">{d.programName}</p>
      <div className="px-4 pt-2">
        <p className="text-xs opacity-80">Stamps</p>
        <p className="tabular text-2xl font-semibold">{d.filled}/{d.total}</p>
      </div>
      <StampStrip total={d.total} filled={d.filled} icon={d.icon} stamp={d.stamp} empty={`${d.foreground}55`} background={d.background} className="mx-4 mt-3" />
      <div className="mt-auto pb-5"><QRStub /></div>
    </div>
  );
}

export function PassPreview({ design }: { design: CardDesign }) {
  const [view, setView] = useState<'front' | 'back' | 'google'>('front');
  return (
    <div className="flex w-full max-w-[300px] flex-col items-center gap-4">
      <SegmentedControl
        label="Preview"
        value={view}
        onChange={setView}
        options={[{ value: 'front', label: 'Apple' }, { value: 'back', label: 'Back' }, { value: 'google', label: 'Google' }]}
      />
      {view === 'front' && <AppleFront d={design} />}
      {view === 'back' && <AppleBack d={design} />}
      {view === 'google' && <GoogleCard d={design} />}
      <p className="text-center text-xs text-text-muted">Close to what customers see. Apple and Google draw the final card.</p>
    </div>
  );
}
