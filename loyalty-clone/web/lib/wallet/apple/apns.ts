// APNs pushes that tell a device "one of your passes changed".
//
// What Apple's pass docs say (https://developer.apple.com/documentation/walletpasses/adding-a-web-service-to-update-passes,
// "Send a Push Notification"): the notification "uses the same certificate and private key that the
// creator of the pass used to sign the original, the push token registered by the device, and an empty
// JSON dictionary for the payload"; delete a device when APNs says the token is invalid; and pass
// update pushes work "only in the production environment".
//
// Request format (https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns):
// HTTP/2 POST to api.push.apple.com:443, path /3/device/<token>, header apns-topic required.
// The pass docs do not name an apns-push-type or apns-priority for passes, so neither is sent:
// APNs then uses priority 10, and the 'background' type would require priority 5 and a bundle-ID
// topic, which a pass type id is not. apns-topic = the Pass Type ID (the certificate's topic).
//
// Error handling (https://developer.apple.com/documentation/usernotifications/handling-notification-responses-from-apns):
// 410 (Unregistered / ExpiredToken) and 400 BadDeviceToken mean the token is dead.
import http2 from 'node:http2';
import { appleConfig, type AppleConfig } from '../config';

export const APNS_ORIGIN = 'https://api.push.apple.com:443';

export type PushResult = { sent: number; invalid: string[]; failed: number };

const TOKEN = /^[0-9a-f]{32,200}$/i;
// DeviceTokenNotForTopic is left out on purpose: a wrong APPLE_PASS_TYPE_ID would return it for
// every token, and treating that as "dead" would wipe all registrations.
const DEAD_REASONS = new Set(['BadDeviceToken', 'Unregistered', 'ExpiredToken']);
const MAX_IN_FLIGHT = 50;
const TIMEOUT_MS = 10_000;

type Outcome = 'sent' | 'invalid' | 'failed';

function pushOne(session: http2.ClientHttp2Session, token: string, topic: string): Promise<Outcome> {
  return new Promise((resolve) => {
    let req: http2.ClientHttp2Stream;
    try {
      req = session.request({
        ':method': 'POST',
        ':path': `/3/device/${token}`,
        'apns-topic': topic,
        'content-type': 'application/json',
      });
    } catch {
      return resolve('failed');
    }
    let status = 0;
    let body = '';
    req.setTimeout(TIMEOUT_MS, () => req.close(http2.constants.NGHTTP2_CANCEL));
    req.on('response', (h) => { status = Number(h[':status']) || 0; });
    req.setEncoding('utf8');
    req.on('data', (c: string) => { body += c; });
    req.on('error', () => resolve('failed'));
    req.on('close', () => {
      if (status === 200) return resolve('sent');
      let reason = '';
      try { reason = (JSON.parse(body) as { reason?: string }).reason ?? ''; } catch { /* empty body */ }
      resolve(status === 410 || DEAD_REASONS.has(reason) ? 'invalid' : 'failed');
    });
    req.end('{}');
  });
}

/**
 * Pushes `{}` to every token over one HTTP/2 session (client-certificate auth with the
 * pass certificate). Malformed tokens are reported as invalid without being sent.
 */
export async function pushPassUpdates(tokens: string[], opts: { config?: AppleConfig; origin?: string } = {}): Promise<PushResult> {
  const unique = [...new Set(tokens)];
  const result: PushResult = { sent: 0, invalid: unique.filter((t) => !TOKEN.test(t)), failed: 0 };
  const good = unique.filter((t) => TOKEN.test(t));
  if (!good.length) return result;

  const cfg = opts.config ?? appleConfig(); // throws NotConfiguredError
  const session = http2.connect(opts.origin ?? APNS_ORIGIN, {
    cert: cfg.certPem,
    key: cfg.keyPem,
    ...(cfg.keyPassphrase ? { passphrase: cfg.keyPassphrase } : {}),
  });
  session.on('error', () => { /* each stream reports its own failure */ });

  try {
    let next = 0;
    const worker = async () => {
      while (next < good.length) {
        const token = good[next++];
        const o = await pushOne(session, token, cfg.passTypeIdentifier);
        if (o === 'sent') result.sent++;
        else if (o === 'invalid') result.invalid.push(token);
        else result.failed++;
      }
    };
    await Promise.all(Array.from({ length: Math.min(MAX_IN_FLIGHT, good.length) }, worker));
  } finally {
    session.close();
  }
  return result;
}
