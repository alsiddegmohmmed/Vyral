// Billing entry point for server actions. Paddle for USD, Flutterwave for RWF.
import 'server-only';
import { openInvoice } from '@/lib/data/billing';
import type { BillingProvider, CheckoutRequest, CheckoutResult } from '@/lib/integrations/contracts';
import { createPaddleCheckout } from './paddle';
import { createFlutterwavePayment } from './flutterwave';

export { cancelPaddleSubscription } from './paddle';

export function providerFor(currency: CheckoutRequest['currency']): BillingProvider {
  return currency === 'RWF' ? 'flutterwave' : 'paddle';
}

/**
 * Start a checkout. `provider` is optional; when given it must agree with the
 * currency (USD -> paddle, RWF -> flutterwave).
 * Flutterwave: opens (or reuses) the invoice for the next prepaid period first,
 * and pays that invoice (tx_ref = invoice id).
 */
export async function startCheckout(
  req: CheckoutRequest & { phone?: string },
  provider?: BillingProvider,
): Promise<CheckoutResult> {
  const expected = providerFor(req.currency);
  if (provider && provider !== expected) {
    return { error: 'provider_error', message: `${req.currency} is billed through ${expected}, not ${provider}` };
  }
  if (expected === 'paddle') return createPaddleCheckout(req);

  if (!process.env.FLW_SECRET_KEY) return { error: 'not_configured', message: 'FLW_SECRET_KEY is not set' };
  const invoiceId = req.invoiceId ?? (await openInvoice(req.orgId, req.plan, req.interval, 'RWF', req.amountMinor));
  return createFlutterwavePayment({ ...req, invoiceId });
}
