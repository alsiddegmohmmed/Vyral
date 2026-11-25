// Builds and signs a .pkpass with passkit-generator 3.7 (buffer model, pass.json from buildPassJson).
//
// Pass package and signing: https://developer.apple.com/documentation/walletpasses/building-a-pass
// Store card images (icon required, strip for storeCard): https://developer.apple.com/documentation/walletpasses/creating-the-source-for-a-pass
//
// Certificates (env): APPLE_PASS_CERT_PEM, APPLE_PASS_KEY_PEM, APPLE_PASS_KEY_PASSPHRASE (optional),
// APPLE_WWDR_PEM (Apple WWDR G4 intermediate), plus APPLE_PASS_TYPE_ID, APPLE_TEAM_ID, PUBLIC_BASE_URL.
// Kept free of `@/` imports so `node --test` can load it directly.
import { PKPass } from 'passkit-generator';
import type { WalletPassData } from '../../integrations/contracts';
import { appleConfig, type AppleConfig } from '../config';
import { renderStripPng, solidPng, STRIP } from '../images';
import { buildPassJson } from './pass-json';

export { NotConfiguredError } from '../config';

export type PkpassOptions = {
  /** Override env config (tests, preview passes). */
  config?: AppleConfig;
  /** Extra or replacement files, e.g. the merchant's real 'logo.png' / 'icon@2x.png'. */
  images?: Record<string, Buffer>;
};

function alpha(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? '');
  if (!m) return `rgba(255,255,255,${a})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/**
 * Image set for the pass. The strip is rendered from the stamp layout when
 * @resvg/resvg-js is installed. Otherwise, and always for icon and logo, it uses
 * PLACEHOLDER solid-colour PNGs made in code (see images.ts). Real merchant logos and
 * icons come from Storage later and can be passed in through opts.images.
 */
export async function passImages(d: WalletPassData): Promise<{ files: Record<string, Buffer>; placeholderStrip: boolean }> {
  const bg = d.campaign.design.background;
  const files: Record<string, Buffer> = {
    'icon.png': solidPng(29, 29, bg),
    'icon@2x.png': solidPng(58, 58, bg),
    'icon@3x.png': solidPng(87, 87, bg),
    'logo.png': solidPng(160, 50, 'transparent'),
    'logo@2x.png': solidPng(320, 100, 'transparent'),
    'logo@3x.png': solidPng(480, 150, 'transparent'),
  };
  let placeholderStrip = false;
  for (const scale of [1, 2, 3] as const) {
    const name = scale === 1 ? 'strip.png' : `strip@${scale}x.png`;
    try {
      files[name] = await renderStripPng({
        total: d.totalStamps,
        filled: d.currentStamps,
        stamp: d.campaign.design.stamp,
        empty: alpha(d.campaign.design.foreground, 0.45),
        background: bg,
        scale,
      });
    } catch {
      placeholderStrip = true;
      files[name] = solidPng(STRIP.width * scale, STRIP.height * scale, bg);
    }
  }
  return { files, placeholderStrip };
}

export async function buildPkpass(d: WalletPassData, opts: PkpassOptions = {}): Promise<Buffer> {
  const cfg = opts.config ?? appleConfig(); // throws NotConfiguredError
  const passJson = buildPassJson(d, {
    passTypeIdentifier: cfg.passTypeIdentifier,
    teamIdentifier: cfg.teamIdentifier,
    webServiceURL: cfg.webServiceURL,
  });
  const { files } = await passImages(d);
  const pass = new PKPass(
    { ...files, ...(opts.images ?? {}), 'pass.json': Buffer.from(JSON.stringify(passJson)) },
    {
      wwdr: cfg.wwdrPem,
      signerCert: cfg.certPem,
      signerKey: cfg.keyPem,
      ...(cfg.keyPassphrase ? { signerKeyPassphrase: cfg.keyPassphrase } : {}),
    },
  );
  return pass.getAsBuffer();
}
