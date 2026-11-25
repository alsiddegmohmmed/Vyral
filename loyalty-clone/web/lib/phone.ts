// One phone normaliser for every input (join form, dashboard). Returns E.164 or null.
// Accepts local (0788…, 788…), international (+250…, 250…, 00250…) for the given default country.
export const DIAL: Record<string, string> = { RW: '250', KE: '254', UG: '256', TZ: '255', BI: '257', CD: '243', NG: '234', ZA: '27', US: '1', GB: '44' };

export function toE164(raw: string, country = 'RW'): string | null {
  const s = raw.trim();
  if (!s) return null;
  let digits = s.replace(/\D/g, '');
  if (s.startsWith('+')) return valid(`+${digits}`);
  if (digits.startsWith('00')) return valid(`+${digits.slice(2)}`);
  const cc = DIAL[country] ?? '';
  // already includes the country code (250788…): local numbers here are 9 digits
  if (cc && digits.startsWith(cc) && digits.length - cc.length >= 8) return valid(`+${digits}`);
  digits = digits.replace(/^0+/, '');
  return valid(`+${cc}${digits}`);
}
const valid = (e: string) => (/^\+[1-9]\d{7,14}$/.test(e) ? e : null);
