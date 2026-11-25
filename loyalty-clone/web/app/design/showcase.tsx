'use client';
import { useState } from 'react';
import { Copy, MoreHorizontal, Pencil, Plus, QrCode, Stamp, Trash2, Users } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { Checkbox, Field, Select, TextInput, Textarea } from '@/components/ui/field';
import { SegmentedControl, Stepper, Switch } from '@/components/ui/controls';
import { Badge, Banner, EmptyState, Skeleton, StatTile } from '@/components/ui/feedback';
import { ConfirmDialog, Dialog, DialogClose, Menu, Tabs, ToastDemo, Tooltip } from '@/components/ui/overlays';
import { ColorField } from '@/components/ui/color-field';
import { QRBlock } from '@/components/ui/qr-block';
import { StampStrip, stampIcons } from '@/components/loyalty/stamp-strip';
import { PassPreview, type CardDesign } from '@/components/loyalty/pass-preview';
import { WebCard } from '@/components/loyalty/web-card';
import { ScanResult, ScannerFrame, TransactionPanel } from '@/components/loyalty/scanner';
import { AutomationCard, BudgetNote, PlanCard, Timeline, customers } from '@/components/loyalty/dashboard';

function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-5">
      <div>
        <h2 id={id} className="text-xl">{title}</h2>
        {note && <p className="mt-1 text-sm text-text-muted">{note}</p>}
      </div>
      {children}
    </section>
  );
}

const Panel = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-lg border border-border bg-surface p-5 ${className}`}>{children}</div>
);

export function DesignShowcase() {
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('Double stamps every Friday this month — see you soon!');
  const [stamps, setStamps] = useState(10);
  const [filled, setFilled] = useState(7);
  const [expiry, setExpiry] = useState<'never' | 'date' | 'days'>('never');
  const [notify, setNotify] = useState(true);
  const [icon, setIcon] = useState('cup');
  const [bg, setBg] = useState('#1F3B2C');
  const [fg, setFg] = useState('#F1EAD8');
  const [label, setLabel] = useState('#C9D6A3');
  const [stampColor, setStampColor] = useState('#F1EAD8');

  const design: CardDesign = {
    business: 'Café Neza', programName: 'Coffee card', reward: 'Free coffee', total: stamps, filled: Math.min(filled, stamps),
    icon, background: bg, foreground: fg, label, stamp: stampColor, logoText: 'café neza',
  };

  return (
    <>
      <Section id="buttons" title="Buttons" note="Primary, secondary, ghost, danger · sm / md / lg / scanner · loading keeps the label.">
        <Panel className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Activate card</Button>
            <Button variant="secondary">Preview</Button>
            <Button variant="ghost">Cancel</Button>
            <Button variant="danger">Delete card</Button>
            <Button loading>Saving</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm"><Plus aria-hidden className="size-4" /> New card</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Join</Button>
            <Tooltip content="Copy card link"><IconButton aria-label="Copy card link" icon={<Copy aria-hidden className="size-4" />} /></Tooltip>
            <IconButton aria-label="Edit" variant="secondary" icon={<Pencil aria-hidden className="size-4" />} />
          </div>
        </Panel>
      </Section>

      <Section id="forms" title="Form fields" note="Labels are real labels; errors are text + icon, linked with aria-describedby.">
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel className="flex flex-col gap-4">
            <Field label="Card name" required hint="Only you see this.">
              <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Coffee card" />
            </Field>
            <Field label="Email" required error="Enter an email like name@example.com">
              <TextInput type="email" defaultValue="aline@" />
            </Field>
            <Field label="Number of stamps" locked>
              <TextInput defaultValue="10" />
            </Field>
            <Field label="Message" hint="Under 90 characters shows in full on the lock screen.">
              <Textarea value={msg} onChange={(e) => setMsg(e.target.value)} max={90} />
            </Field>
          </Panel>
          <Panel className="flex flex-col gap-5">
            <Field label="Phone">
              <div className="flex gap-2">
                <Select aria-label="Country code" className="w-28" defaultValue="RW">
                  <option value="RW">🇷🇼 +250</option><option value="KE">🇰🇪 +254</option><option value="UG">🇺🇬 +256</option>
                </Select>
                <TextInput inputMode="tel" placeholder="788 123 456" autoComplete="tel-national" />
              </div>
            </Field>
            <Field label="Birthday" hint="Day and month only.">
              <div className="flex gap-2">
                <Select aria-label="Day" defaultValue="">{['', ...Array.from({ length: 31 }, (_, i) => String(i + 1))].map((d) => <option key={d} value={d}>{d || 'Day'}</option>)}</Select>
                <Select aria-label="Month" defaultValue="">{['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m) => <option key={m} value={m}>{m || 'Month'}</option>)}</Select>
              </div>
            </Field>
            <Checkbox label={<>Send me offers from Café Neza. You can stop anytime. <a className="underline" href="#">Privacy</a></>} />
            <Switch label="Notify when a reward is earned" checked={notify} onCheckedChange={setNotify} />
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">Cards expire</span>
              <SegmentedControl label="Cards expire" value={expiry} onChange={setExpiry} options={[{ value: 'never', label: 'Never' }, { value: 'date', label: 'On a date' }, { value: 'days', label: 'After N days' }]} />
            </div>
            <Stepper label="Stamps to add" value={filled} onChange={setFilled} min={0} max={stamps} />
          </Panel>
        </div>
      </Section>

      <Section id="designer" title="Card designer" note="ColorField checks readability live with the same WCAG maths as contrast.py. Try a light text colour on a light background.">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <Panel className="flex flex-col gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <ColorField label="Card background" value={bg} onChange={setBg} against={fg} againstLabel="text colour" />
              <ColorField label="Text" value={fg} onChange={setFg} against={bg} againstLabel="background" />
              <ColorField label="Labels" value={label} onChange={setLabel} against={bg} againstLabel="background" />
              <ColorField label="Stamps" value={stampColor} onChange={setStampColor} against={bg} againstLabel="background" />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold">Stamp icon</span>
              <div role="radiogroup" aria-label="Stamp icon" className="flex flex-wrap gap-2">
                {Object.entries(stampIcons).map(([key, Icon]) => (
                  <button key={key} type="button" role="radio" aria-checked={icon === key} aria-label={key}
                    onClick={() => setIcon(key)}
                    className={`grid size-11 place-items-center rounded-md border ${icon === key ? 'border-accent bg-bg ring-2 ring-accent' : 'border-border bg-bg'}`}>
                    <Icon aria-hidden className="size-5" />
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-6">
              <div className="flex flex-col gap-1.5"><span className="text-sm font-semibold">Stamps on the card</span><Stepper label="Stamps on the card" value={stamps} onChange={(v) => { setStamps(v); setFilled(Math.min(filled, v)); }} min={1} max={30} /></div>
              <div className="flex flex-col gap-1.5"><span className="text-sm font-semibold">Preview with</span><Stepper label="Preview stamps" value={filled} onChange={setFilled} min={0} max={stamps} /></div>
            </div>
            <div>
              <span className="text-sm font-semibold">StampStrip at 6, 14 and 30 stamps</span>
              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                {[6, 14, 30].map((n) => (
                  <div key={n} className="rounded-md p-3" style={{ background: bg }}>
                    <StampStrip total={n} filled={Math.round(n * 0.6)} icon={icon} stamp={stampColor} empty={`${fg}55`} background={bg} className="w-full" />
                  </div>
                ))}
              </div>
            </div>
          </Panel>
          <div className="flex justify-center"><PassPreview design={design} /></div>
        </div>
      </Section>

      <Section id="customer" title="Customer side" note="The web card is every customer’s baseline; wallets are an upgrade (architecture decision 1).">
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <WebCard d={design} firstName="Aline" rewards={0} manualCode="9Y77BKHV" message="Double stamps every Friday this month." />
          <WebCard d={{ ...design, filled: 0 }} firstName="Aline" rewards={1} manualCode="9Y77BKHV" />
        </div>
      </Section>

      <Section id="scanner" title="Scanner" note="Dark scanner tokens, 64px targets, outcome sentence before submit, plain-language errors.">
        <div className="flex flex-wrap items-start justify-center gap-6 lg:justify-start">
          <ScannerFrame />
          <TransactionPanel />
          <div className="flex flex-col gap-4">
            <ScanResult ok />
            <ScanResult ok={false} />
          </div>
        </div>
      </Section>

      <Section id="feedback" title="Feedback" note="Banners, badges, empty states, skeletons, stats and toasts.">
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel className="flex flex-col gap-3">
            <Banner tone="info" title="12 days left in your trial">Add a payment method to keep your cards live after the trial.</Banner>
            <Banner tone="warning" title="Payment overdue" action={<Button size="sm" variant="secondary">Pay now</Button>}>Your cards keep working until 2 December.</Banner>
            <Banner tone="success" title="Card is live">Put the QR code where customers pay.</Banner>
            <Banner tone="danger" title="Couldn’t reach Apple Wallet">We’ll retry automatically. Nothing for you to do.</Banner>
            <div className="flex flex-wrap gap-2">
              <Badge tone="success">Live</Badge><Badge>Draft</Badge><Badge tone="warning">Paused</Badge>
              <Badge tone="info">In Apple Wallet</Badge><Badge>Web card only</Badge><Badge tone="danger">Overdue</Badge>
            </div>
            <ToastDemo />
          </Panel>
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3">
              <StatTile label="New customers" value="148" delta={12} period="vs last 30 days" />
              <StatTile label="Rewards given" value="37" delta={-4} period="vs last 30 days" />
              <StatTile label="Estimated return" value="RWF 412,000" />
              <StatTile label="Loading" loading />
            </div>
            <EmptyState icon={<Users aria-hidden />} title="No one has joined yet" action={<Button size="sm"><QrCode aria-hidden className="size-4" /> Get your QR code</Button>}>
              Put your QR code where customers pay. The first ones usually join the same day.
            </EmptyState>
            <div className="flex flex-col gap-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-10 w-full" /></div>
          </div>
        </div>
      </Section>

      <Section id="overlays" title="Dialogs, menus and tabs" note="Radix primitives: focus is trapped and returned, Esc closes, destructive actions name exactly what happens.">
        <Panel className="flex flex-col gap-6">
          <div className="flex flex-wrap gap-3">
            <Dialog
              trigger={<Button variant="secondary"><Stamp aria-hidden className="size-4" /> Give stamps</Button>}
              title="Give stamps to Aline"
              description="This is logged with your name."
              footer={<><DialogClose asChild><Button variant="secondary">Cancel</Button></DialogClose><DialogClose asChild><Button>Add 2 stamps</Button></DialogClose></>}
            >
              <Stepper label="Stamps" value={2} onChange={() => {}} min={0} max={100} />
            </Dialog>
            <ConfirmDialog trigger={<Button variant="danger"><Trash2 aria-hidden className="size-4" /> Delete Aline’s card</Button>} title="Delete Aline’s card?" action="Delete card" onConfirm={() => {}}>
              Her card stops working right away and this can’t be undone. You can add a goodbye note that appears on the card.
            </ConfirmDialog>
            <ConfirmDialog trigger={<Button variant="ghost">Delete account…</Button>} title="Delete your account?" action="Delete account" typeToConfirm="Café Neza" onConfirm={() => {}}>
              All cards stop working and customer data is deleted after 7 days.
            </ConfirmDialog>
            <Menu
              trigger={<IconButton aria-label="Actions for Aline" variant="secondary" icon={<MoreHorizontal aria-hidden className="size-4" />} />}
              items={[
                { label: 'Give stamps', icon: <Stamp aria-hidden />, onSelect: () => {} },
                { label: 'Copy card link', icon: <Copy aria-hidden />, onSelect: () => {} },
                { label: 'Edit details', icon: <Pencil aria-hidden />, onSelect: () => {} },
                'separator',
                { label: 'Delete card', icon: <Trash2 aria-hidden />, danger: true, onSelect: () => {} },
              ]}
            />
          </div>
          <Tabs
            tabs={[
              { value: 'design', label: 'Design', content: <p className="text-sm text-text-muted">Colours, logo, stamps.</p> },
              { value: 'details', label: 'Details', hasError: true, content: <p className="text-sm text-text-muted">The reward needs a name.</p> },
              { value: 'locations', label: 'Locations', content: <p className="text-sm text-text-muted">Up to 10 places.</p> },
              { value: 'form', label: 'Signup form', content: <p className="text-sm text-text-muted">Email or phone is always required.</p> },
            ]}
          />
        </Panel>
      </Section>

      <Section id="data" title="Customers and history">
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <caption className="sr-only">Customers on Coffee card</caption>
              <thead className="bg-surface text-left text-text-muted">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-semibold" aria-sort="none">Name</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold" aria-sort="descending">Stamps</th>
                  <th scope="col" className="hidden px-4 py-2.5 font-semibold sm:table-cell">Card</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Last visit</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.name} className="border-t border-border hover:bg-surface">
                    <td className="px-4 py-3"><a href="#" className="font-medium hover:underline">{c.name}</a></td>
                    <td className="px-4 py-3 tabular">{c.stamps}/{c.total}</td>
                    <td className="hidden px-4 py-3 sm:table-cell"><Badge tone={c.wallet === 'Web card' ? 'neutral' : 'info'}>{c.wallet}</Badge></td>
                    <td className="px-4 py-3 text-text-muted">{c.last}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Panel><Timeline /></Panel>
        </div>
      </Section>

      <Section id="messages" title="Messages, automations and plans">
        <BudgetNote />
        <div className="grid gap-5 lg:grid-cols-2">
          <AutomationCard kind="birthday" />
          <AutomationCard kind="winback" />
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          <PlanCard name="Starter" price="RWF 15,000" limits={['1 card design', '1 location', '2 counter phones', 'Unlimited customers']} current />
          <PlanCard name="Growth" price="RWF 35,000" limits={['3 card designs', '3 locations', '5 counter phones', 'Birthday and win-back messages']} recommended />
          <PlanCard name="Pro" price="RWF 60,000" limits={['10 card designs', '10 locations', '20 counter phones', 'Priority support']} />
        </div>
        <p className="text-xs text-text-muted">Plan names, prices and limits are placeholders for /replica-launch.</p>
      </Section>

      <Section id="qr" title="QR code" note="Real QR for the join page, with the link as text and download.">
        <Panel className="flex justify-center"><QRBlock value="https://example.com/j/ah4c5pbx" label="QR code to join Coffee card" /></Panel>
      </Section>
    </>
  );
}
