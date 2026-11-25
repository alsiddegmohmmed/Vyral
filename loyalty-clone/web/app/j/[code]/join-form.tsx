'use client';
import { useActionState } from 'react';
import { MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Select, TextInput } from '@/components/ui/field';
import { Banner } from '@/components/ui/feedback';
import type { PublicCampaign } from '@/lib/data/api';
import { joinAction, type JoinState } from '../actions';

const COUNTRIES = [['RW', '🇷🇼 +250'], ['KE', '🇰🇪 +254'], ['UG', '🇺🇬 +256'], ['TZ', '🇹🇿 +255'], ['BI', '🇧🇮 +257'], ['CD', '🇨🇩 +243'], ['NG', '🇳🇬 +234'], ['ZA', '🇿🇦 +27'], ['US', '🇺🇸 +1'], ['GB', '🇬🇧 +44']];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function JoinForm({ shortCode, campaign: c }: { shortCode: string; campaign: PublicCampaign }) {
  const [state, action, pending] = useActionState<JoinState, FormData>(joinAction.bind(null, shortCode), {});
  if (state.sent) {
    return (
      <div role="status" className="flex flex-col items-center gap-3 p-8 text-center">
        <MailCheck aria-hidden className="size-10 text-success" />
        <h2 className="text-xl">Check your messages</h2>
        <p className="text-sm text-text-muted">If you already have this card, we’ve sent the link to the phone or email you joined with.</p>
      </div>
    );
  }
  const err = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-4 p-5" noValidate>
      {state.error && <Banner tone="danger" title={state.error} />}
      {Object.keys(err).length > 0 && <Banner tone="danger" title="Please check the highlighted fields." />}
      {c.fields.map((f) => {
        const v = state.values?.[f.key];
        if (f.type === 'phone') return (
          <Field key={f.key} label={f.label} required={f.required} error={err[f.key]}>
            <div className="flex gap-2">
              <select name={`${f.key}__cc`} aria-label="Country code" defaultValue={c.defaultCountry} className="h-12 w-28 rounded-md border border-border-input bg-bg px-2 text-base">
                {COUNTRIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <TextInput name={f.key} inputSize="lg" type="tel" inputMode="tel" autoComplete="tel-national" defaultValue={v} placeholder="788 123 456" />
            </div>
          </Field>
        );
        if (f.type === 'birthday') return (
          <Field key={f.key} label={f.label} required={f.required} error={err[f.key]} hint="Day and month, for a birthday treat.">
            <div className="flex gap-2">
              <Select name={`${f.key}__d`} aria-label="Birthday day" defaultValue="" className="h-12">
                <option value="">Day</option>{Array.from({ length: 31 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
              </Select>
              <Select name={`${f.key}__m`} id={`${f.key}-month`} aria-label="Birthday month" defaultValue="" className="h-12">
                <option value="">Month</option>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </Select>
            </div>
          </Field>
        );
        return (
          <Field key={f.key} label={f.label} required={f.required} error={err[f.key]}>
            <TextInput name={f.key} inputSize="lg" defaultValue={v}
              type={f.type === 'email' ? 'email' : f.type === 'number' ? 'text' : f.type === 'date' ? 'date' : f.type === 'url' ? 'url' : 'text'}
              inputMode={f.type === 'email' ? 'email' : f.type === 'number' ? 'numeric' : undefined}
              autoComplete={f.type === 'name' ? 'name' : f.type === 'email' ? 'email' : 'off'} />
          </Field>
        );
      })}
      {c.consentEnabled && <Checkbox name="consent" label={c.consentText} />}
      <Button type="submit" size="lg" loading={pending} block>Get my card</Button>
      {!c.hideTerms && c.terms && (
        <details className="text-xs text-text-muted"><summary className="cursor-pointer font-semibold">Terms</summary><p className="mt-2 whitespace-pre-line">{c.terms}</p></details>
      )}
      <p className="text-center text-xs text-text-subtle">No app needed. Your card lives in your phone’s wallet or browser.</p>
    </form>
  );
}
