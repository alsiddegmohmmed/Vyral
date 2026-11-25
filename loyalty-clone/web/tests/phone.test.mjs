import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toE164 } from '../lib/phone.ts';

test('B-003/B-005: every common way to type a Rwandan number gives one E.164', () => {
  for (const v of ['0788 600 222', '788600222', '+250 788 600 222', '250788600222', '00250788600222', '(0788) 600-222']) {
    assert.equal(toE164(v, 'RW'), '+250788600222', v);
  }
  assert.equal(toE164('0712 345 678', 'KE'), '+254712345678');
  assert.equal(toE164('12', 'RW'), null);
  assert.equal(toE164('', 'RW'), null);
});
