// Who stands behind Garuka, for the privacy notice and terms.
// DRAFT: fill these in and get a legal review (Rwanda Law No. 058/2021 on the
// protection of personal data and privacy; GDPR/UK GDPR for EU and UK users),
// then set `reviewed: true` to remove the draft banner. See replica/deploy.md.
export const LEGAL = {
  reviewed: false,
  entity: '[Garuka legal entity name]',
  address: '[registered address], Kigali, Rwanda',
  email: 'privacy@[your-domain]',
  supportEmail: 'hello@[your-domain]',
  governingLaw: 'Rwanda',
  courts: 'the competent courts of Kigali',
  effective: '[date this version takes effect]',
  updated: '2026-11-25',
} as const;

/** Every service that handles personal data for Garuka, with what it does. Keep in step with replica/deploy.md. */
export const PROCESSORS = [
  { name: 'Vercel Inc.', where: 'USA and global edge', what: 'Hosts the website, dashboard and counter app, and runs the scheduled jobs.' },
  { name: 'Our managed Postgres provider (planned: Supabase)', where: '[region to confirm]', what: 'Stores all account, card and customer data, with backups.' },
  { name: 'Resend', where: 'USA', what: 'Sends account emails (confirm your email, reset password, card links, renewal reminders).' },
  { name: 'Paddle', where: 'UK', what: 'Takes card payments in US dollars as merchant of record, and handles tax.' },
  { name: 'Flutterwave', where: 'Rwanda and Nigeria', what: 'Takes payments in Rwandan francs by MTN MoMo, Airtel Money or card.' },
  { name: 'Apple', where: 'USA', what: 'Delivers Apple Wallet passes and updates to customers who add their card to Apple Wallet.' },
  { name: 'Google', where: 'USA', what: 'Delivers Google Wallet passes and updates to customers who save their card to Google Wallet.' },
  { name: 'Meta (WhatsApp)', where: 'USA and Ireland', what: 'Only when you choose to message our support number on WhatsApp.' },
] as const;
