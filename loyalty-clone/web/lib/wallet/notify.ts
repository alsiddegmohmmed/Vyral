// Sends one card's change to both wallets. Used by the pass/changed, message/send and
// automations jobs (architecture.md "Jobs"). "Not configured" is a skip, never an error.
import 'server-only';
import * as walletData from '@/lib/data/wallet';
import { applePushTokensForCard, claimNotificationSlot, dropAppleDevice, getPassDataBySerial } from '@/lib/data/wallet';
import type { WalletPassData } from '@/lib/integrations/contracts';
import { googleConfig, isNotConfigured } from './config';
import { pushPassUpdates } from './apple/apns';
import { addObjectMessage, patchObjectPoints } from './google/api';
import { facePoints, objectIdFor, objectState } from './google/objects';

export type NotifyReason = 'reward_earned' | 'broadcast' | 'birthday' | 'winback';

export type PushCardUpdateOptions = {
  reason?: NotifyReason;
  messageId?: string;
  message?: { header: string; body: string };
  /**
   * The card's serial. Google needs the pass data (object id, balance), and the data contract has no
   * lookup by card id yet. When lib/data/wallet exports getPassDataByCardId it is used instead and
   * this becomes unnecessary. With neither, Google is skipped as 'not_saved' (and a warning logged).
   */
  serial?: string;
};

type ByCardId = (cardId: string) => Promise<WalletPassData | null>;
// Optional data-layer function, picked up automatically once the lead adds it.
const getPassDataByCardId = (walletData as unknown as { getPassDataByCardId?: ByCardId }).getPassDataByCardId;

async function passDataFor(cardId: string, serial?: string): Promise<WalletPassData | null> {
  if (serial) return getPassDataBySerial(serial);
  if (typeof getPassDataByCardId === 'function') return getPassDataByCardId(cardId);
  console.warn('[wallet] pushCardUpdate without serial and no getPassDataByCardId: Google update skipped');
  return null;
}

export type PushCardUpdateResult = {
  apple: { sent: number; invalid: string[]; failed: number; visible: boolean; skipped?: 'not_configured' | 'no_devices' };
  google: 'patched' | 'not_saved' | 'not_configured';
  /** True when at least one wallet was allowed (budget slot claimed) to show a notification. */
  notified: boolean;
};

export async function pushCardUpdate(cardId: string, opts: PushCardUpdateOptions = {}): Promise<PushCardUpdateResult> {
  const out: PushCardUpdateResult = { apple: { sent: 0, invalid: [], failed: 0, visible: false }, google: 'not_saved', notified: false };

  // ---------------------------------------------------------------- Apple
  // Every change is pushed. Whether the device shows an alert depends on the pass content
  // (changeMessage fields); the slot claim only tells the caller whether it was allowed to.
  const devices = await applePushTokensForCard(cardId);
  if (!devices.length) {
    out.apple.skipped = 'no_devices';
  } else {
    try {
      const r = await pushPassUpdates(devices.map((d) => d.pushToken));
      out.apple.sent = r.sent;
      out.apple.invalid = r.invalid;
      out.apple.failed = r.failed;
      const dead = new Set(r.invalid);
      for (const d of devices) if (dead.has(d.pushToken)) await dropAppleDevice(d.deviceLibraryId);
      if (opts.reason && r.sent > 0) out.apple.visible = await claimNotificationSlot(cardId, 'apple', opts.reason, opts.messageId);
    } catch (e) {
      if (!isNotConfigured(e)) throw e;
      out.apple.skipped = 'not_configured';
    }
  }

  // ---------------------------------------------------------------- Google
  let googleNotified = false;
  try {
    const cfg = googleConfig();
    const d = await passDataFor(cardId, opts.serial);
    if (d && d.cardId === cardId) {
      const objectId = objectIdFor(cfg.issuerId, d.serial);
      const extra = { state: objectState(d) };
      if (opts.message) {
        // Points silently; the message carries the (budgeted) notification.
        const p = await patchObjectPoints(objectId, facePoints(d), false, extra);
        if (p === 'patched') {
          const notify = opts.reason ? await claimNotificationSlot(cardId, 'google', opts.reason, opts.messageId) : false;
          await addObjectMessage(objectId, opts.message.header, opts.message.body, notify, opts.messageId);
          googleNotified = notify;
        }
        out.google = p === 'patched' ? 'patched' : 'not_saved';
      } else {
        // NOTE: the slot is claimed before we know the object exists; a 404 then wastes one slot.
        const notify = opts.reason ? await claimNotificationSlot(cardId, 'google', opts.reason, opts.messageId) : false;
        const p = await patchObjectPoints(objectId, facePoints(d), notify, extra);
        out.google = p === 'patched' ? 'patched' : 'not_saved';
        googleNotified = notify && p === 'patched';
      }
    }
  } catch (e) {
    if (!isNotConfigured(e)) throw e;
    out.google = 'not_configured';
  }

  out.notified = out.apple.visible || googleNotified;
  return out;
}
