// node --test tests/*.test.mjs   (Node 23.6+ runs the .ts module directly)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyTransaction, isBirthdayToday } from '../lib/data/rules.ts';

const now = new Date('2026-11-25T10:00:00Z');
const card = (o = {}) => ({ status: 'active', currentStamps: 0, rewardsAvailable: 0, totalStampsEarned: 0, totalRewardsEarned: 0, totalRewardsRedeemed: 0, lastStampAt: null, expiresAt: null, ...o });
const camp = (o = {}) => ({ status: 'live', totalStamps: 10, maxStampsPerTransaction: 5, stampCooldownMinutes: 0, maxStampsPerDay: 0, ...o });
const tx = (stamps, redeem = 0, source = 'scanner') => ({ stamps, redeem, source });

test('overflow: 9 + 3 on a 10-card = 1 reward, 2 stamps', () => {
  const r = applyTransaction(card({ currentStamps: 9 }), camp(), tx(3), now, 0);
  assert.equal(r.ok, true); assert.equal(r.earned, 1); assert.equal(r.card.currentStamps, 2); assert.equal(r.card.rewardsAvailable, 1);
});
test('earn and redeem in one transaction; redeem rotates barcode', () => {
  const r = applyTransaction(card({ currentStamps: 8 }), camp(), tx(2, 1), now, 0);
  assert.equal(r.ok, true); assert.equal(r.card.rewardsAvailable, 0); assert.equal(r.rotateBarcode, true);
});
test('errors mirror the SQL keys', () => {
  assert.equal(applyTransaction(card(), camp(), tx(0), now, 0).error, 'empty_transaction');
  assert.equal(applyTransaction(card({ status: 'deleted' }), camp(), tx(1, 0, 'dashboard'), now, 0).error, 'card_deleted');
  assert.equal(applyTransaction(card({ expiresAt: '2026-01-01T00:00:00Z' }), camp(), tx(1), now, 0).error, 'card_expired');
  assert.equal(applyTransaction(card(), camp({ status: 'paused' }), tx(1), now, 0).error, 'campaign_not_live');
  assert.equal(applyTransaction(card(), camp(), tx(6), now, 0).error, 'too_many_stamps');
  assert.equal(applyTransaction(card(), camp(), tx(1000, 0, 'dashboard'), now, 0).error, 'too_many_stamps');
  assert.equal(applyTransaction(card({ lastStampAt: '2026-11-25T09:58:00Z' }), camp({ stampCooldownMinutes: 5 }), tx(1), now, 0).error, 'cooldown_active');
  assert.equal(applyTransaction(card(), camp({ maxStampsPerDay: 3 }), tx(2), now, 2).error, 'daily_limit_reached');
  assert.equal(applyTransaction(card({ currentStamps: 1 }), camp(), tx(-2), now, 0).error, 'not_enough_stamps');
  assert.equal(applyTransaction(card(), camp(), tx(0, 1), now, 0).error, 'no_reward_available');
});
test('owner can correct paused campaigns and expired cards; caps skipped', () => {
  const r = applyTransaction(card({ currentStamps: 3, expiresAt: '2026-01-01T00:00:00Z', lastStampAt: now.toISOString() }), camp({ status: 'paused', stampCooldownMinutes: 60 }), tx(-1, 0, 'dashboard'), now, 0);
  assert.equal(r.ok, true); assert.equal(r.card.currentStamps, 2);
});
test('unstamp lowers lifetime total, never below 0', () => {
  const r = applyTransaction(card({ currentStamps: 2, totalStampsEarned: 2 }), camp(), tx(-2, 0, 'dashboard'), now, 0);
  assert.equal(r.card.totalStampsEarned, 0);
});
test('birthdays: Feb 29 sends Feb 28 in non-leap years only', () => {
  assert.equal(isBirthdayToday(2, 29, 2027, 2, 28), true);
  assert.equal(isBirthdayToday(2, 29, 2028, 2, 28), false);
  assert.equal(isBirthdayToday(2, 29, 2028, 2, 29), true);
  assert.equal(isBirthdayToday(11, 25, 2026, 11, 25), true);
});
