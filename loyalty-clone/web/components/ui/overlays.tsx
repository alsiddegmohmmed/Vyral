'use client';
import * as RDialog from '@radix-ui/react-dialog';
import * as RAlert from '@radix-ui/react-alert-dialog';
import * as RMenu from '@radix-ui/react-dropdown-menu';
import * as RTabs from '@radix-ui/react-tabs';
import * as RTooltip from '@radix-ui/react-tooltip';
import * as RToast from '@radix-ui/react-toast';
import { X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { Button, IconButton, buttonClass } from './button';

const overlay = 'fixed inset-0 z-[50] bg-overlay/50 animate-[fade-in_var(--tk-motion-base)_ease-out]';
const panel =
  'fixed z-[50] bg-surface-raised shadow-pop animate-[pop-in_var(--tk-motion-base)_var(--tk-motion-ease)] ' +
  'inset-x-0 bottom-0 max-h-[92dvh] overflow-auto rounded-t-xl p-5 ' +
  'sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:p-6';

export function Dialog({ trigger, title, description, children, footer, wide }: {
  trigger: React.ReactNode; title: string; description?: string; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean;
}) {
  return (
    <RDialog.Root>
      <RDialog.Trigger asChild>{trigger}</RDialog.Trigger>
      <RDialog.Portal>
        <RDialog.Overlay className={overlay} />
        <RDialog.Content
          className={cn(panel, wide ? 'sm:w-[560px]' : 'sm:w-[480px]')}
          onOpenAutoFocus={(e) => {
            // start on the first field, not the close button
            const first = (e.currentTarget as HTMLElement).querySelector<HTMLElement>('input:not([type=hidden]),select,textarea');
            if (first) { e.preventDefault(); first.focus(); }
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <RDialog.Title className="text-xl">{title}</RDialog.Title>
              {description && <RDialog.Description className="mt-1 text-sm text-text-muted">{description}</RDialog.Description>}
            </div>
            <RDialog.Close asChild>
              <IconButton aria-label="Close" size="sm" icon={<X aria-hidden className="size-4" />} />
            </RDialog.Close>
          </div>
          <div className="mt-5">{children}</div>
          {footer && <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
export const DialogClose = RDialog.Close;

export function ConfirmDialog({ trigger, title, children, action, typeToConfirm, onConfirm, tone = 'danger' }: {
  trigger: React.ReactNode; title: string; children: React.ReactNode; action: string; typeToConfirm?: string; onConfirm: () => void; tone?: 'danger' | 'primary';
}) {
  const [typed, setTyped] = useState('');
  const blocked = !!typeToConfirm && typed.trim() !== typeToConfirm;
  return (
    <RAlert.Root onOpenChange={() => setTyped('')}>
      <RAlert.Trigger asChild>{trigger}</RAlert.Trigger>
      <RAlert.Portal>
        <RAlert.Overlay className={overlay} />
        <RAlert.Content className={cn(panel, 'sm:w-[440px]')}>
          <RAlert.Title className="text-xl">{title}</RAlert.Title>
          <RAlert.Description asChild><div className="mt-2 text-sm text-text-muted">{children}</div></RAlert.Description>
          {typeToConfirm && (
            <label className="mt-4 flex flex-col gap-1.5 text-sm font-semibold">
              Type <span className="font-mono">{typeToConfirm}</span> to confirm
              <input value={typed} onChange={(e) => setTyped(e.target.value)} className="h-10 rounded-md border border-border-input px-3 font-normal" />
            </label>
          )}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <RAlert.Cancel className={buttonClass('secondary')}>Cancel</RAlert.Cancel>
            <RAlert.Action className={buttonClass(tone)} disabled={blocked} onClick={onConfirm}>{action}</RAlert.Action>
          </div>
        </RAlert.Content>
      </RAlert.Portal>
    </RAlert.Root>
  );
}

export function Menu({ trigger, items }: {
  trigger: React.ReactNode; items: ({ label: string; icon?: React.ReactNode; danger?: boolean; onSelect: () => void } | 'separator')[];
}) {
  return (
    <RMenu.Root>
      <RMenu.Trigger asChild>{trigger}</RMenu.Trigger>
      <RMenu.Portal>
        <RMenu.Content align="end" sideOffset={6} className="z-[40] min-w-48 rounded-md border border-border bg-surface-raised p-1 shadow-pop animate-[pop-in_var(--tk-motion-fast)_ease-out]">
          {items.map((it, i) =>
            it === 'separator' ? (
              <RMenu.Separator key={i} className="my-1 h-px bg-border" />
            ) : (
              <RMenu.Item
                key={it.label}
                onSelect={it.onSelect}
                className={cn(
                  'flex h-9 cursor-pointer items-center gap-2 rounded-sm px-2.5 text-sm outline-none data-[highlighted]:bg-surface [&>svg]:size-4',
                  it.danger && 'text-danger data-[highlighted]:bg-danger-bg',
                )}
              >
                {it.icon}
                {it.label}
              </RMenu.Item>
            ),
          )}
        </RMenu.Content>
      </RMenu.Portal>
    </RMenu.Root>
  );
}

export function Tabs({ tabs, defaultValue }: {
  tabs: { value: string; label: string; icon?: React.ReactNode; hasError?: boolean; content: React.ReactNode }[]; defaultValue?: string;
}) {
  return (
    <RTabs.Root defaultValue={defaultValue ?? tabs[0]?.value}>
      <RTabs.List aria-label="Sections" className="flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((t) => (
          <RTabs.Trigger
            key={t.value}
            value={t.value}
            className="relative -mb-px flex h-10 items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-3 text-sm font-medium text-text-muted data-[state=active]:border-accent data-[state=active]:text-text [&>svg]:size-4"
          >
            {t.icon}
            {t.label}
            {t.hasError && (
              <>
                <span aria-hidden className="size-1.5 rounded-pill bg-danger" />
                <span className="sr-only">(has errors)</span>
              </>
            )}
          </RTabs.Trigger>
        ))}
      </RTabs.List>
      {tabs.map((t) => (
        <RTabs.Content key={t.value} value={t.value} className="pt-5">
          {t.content}
        </RTabs.Content>
      ))}
    </RTabs.Root>
  );
}

export function Tooltip({ content, children }: { content: string; children: React.ReactNode }) {
  return (
    <RTooltip.Provider delayDuration={300}>
      <RTooltip.Root>
        <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
        <RTooltip.Portal>
          <RTooltip.Content sideOffset={6} className="z-[60] max-w-60 rounded-sm bg-accent px-2.5 py-1.5 text-xs text-on-accent shadow-pop">
            {content}
          </RTooltip.Content>
        </RTooltip.Portal>
      </RTooltip.Root>
    </RTooltip.Provider>
  );
}

export function ToastDemo() {
  const [open, setOpen] = useState(false);
  return (
    <RToast.Provider swipeDirection="right" duration={4000}>
      <Button variant="secondary" onClick={() => { setOpen(false); requestAnimationFrame(() => setOpen(true)); }}>
        Show a toast
      </Button>
      <RToast.Root open={open} onOpenChange={setOpen} className="flex items-center gap-3 rounded-md bg-accent px-4 py-3 text-sm text-on-accent shadow-pop animate-[pop-in_var(--tk-motion-base)_ease-out]">
        <RToast.Title className="font-semibold">Card link copied</RToast.Title>
        <RToast.Close aria-label="Dismiss" className="ml-auto rounded-sm p-1 hover:bg-accent-hover"><X aria-hidden className="size-4" /></RToast.Close>
      </RToast.Root>
      <RToast.Viewport className="fixed bottom-4 left-1/2 z-[60] flex w-[min(380px,calc(100vw-32px))] -translate-x-1/2 flex-col gap-2 sm:left-auto sm:right-4 sm:translate-x-0" />
    </RToast.Provider>
  );
}
