// node --test tests/wallet.test.mjs   (Node 23.6+ runs the .ts modules directly)
// The wallet modules use extensionless relative imports (like the rest of the app), so a tiny
// resolve hook adds ".ts" for relative specifiers that don't resolve as written.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context);
    } catch (e) {
      if (/^\.\.?\//.test(specifier) && !/\.[cm]?[jt]s$/.test(specifier)) return next(`${specifier}.ts`, context);
      throw e;
    }
  },
});

const { buildPassJson, hexToRgb, asChangeMessage } = await import('../lib/wallet/apple/pass-json.ts');
const { buildLoyaltyClass, buildLoyaltyObject, classIdFor, objectIdFor, pointsPatch } = await import('../lib/wallet/google/objects.ts');
const { signServiceAccountJwt, buildSaveUrl, SAVE_URL_PREFIX } = await import('../lib/wallet/google/jwt.ts');
const { verifyGoogleCallback, CallbackVerificationError } = await import('../lib/wallet/google/callback.ts');
const { renderStripSvg, renderStripPng, solidPng, stampColumns } = await import('../lib/wallet/images.ts');
const { buildPkpass } = await import('../lib/wallet/apple/pkpass.ts');
const { NotConfiguredError, isNotConfigured } = await import('../lib/wallet/config.ts');
const { pushPassUpdates } = await import('../lib/wallet/apple/apns.ts');

// ------------------------------------------------------------------ fixture

const loc = (i) => ({ name: `Shop ${i}`, lat: -1.95 + i / 100, lon: 30.06 + i / 100, addressOnCard: `KN ${i} St`, relevantText: `Shop ${i} is nearby` });
const passData = (o = {}) => ({
  cardId: '7c1e2d34-0000-4000-8000-000000000001',
  serial: 'S3RIALABCDEF0123456789XYZ',
  appleAuthToken: 'a'.repeat(32),
  qrPayload: 'v1.01HZZZZZZZZZZZZZZZZZZZZZZZ.AbCdEfGhIj',
  manualCode: 'K7Q2M9XP',
  firstName: 'Aline',
  status: 'active',
  expired: false,
  currentStamps: 7,
  rewardsAvailable: 0,
  totalStamps: 10,
  passModifiedAt: '2026-11-25T10:00:00.000Z',
  ...o,
  campaign: {
    id: '0b6f5a8e-1c2d-4e3f-9a0b-123456789abc',
    name: 'Coffee card', programName: 'Kawa Rewards', business: 'Kawa Café',
    description: 'Kawa Café loyalty card', howToEarn: 'One stamp per coffee.', terms: 'One reward per visit.',
    stampMessage: 'You have {n} stamps', rewardMessage: 'Your free coffee is waiting!',
    reward: { name: 'Free coffee', details: 'Any size' },
    design: { background: '#1A2B3C', foreground: '#fff', label: '#ffcc00', stamp: '#ffffff', icon: 'cup', logoText: 'Kawa' },
    links: [{ kind: 'website', label: 'Website', value: 'https://kawa.example' }, { kind: 'phone', label: 'Call us', value: '+250 788 000 000' }],
    locations: Array.from({ length: 12 }, (_, i) => loc(i)),
    ...(o.campaign ?? {}),
  },
});
const cfg = { passTypeIdentifier: 'pass.com.example.loyalty', teamIdentifier: 'ABCDE12345', webServiceURL: 'https://api.example.com/api/apple' };

// ------------------------------------------------------------------ Apple pass.json

test('pass.json: storeCard, QR, auth, colours, locations, no changeMessage on stamps', () => {
  const p = buildPassJson(passData(), cfg);
  assert.equal(p.formatVersion, 1);
  assert.equal(p.serialNumber, 'S3RIALABCDEF0123456789XYZ');
  assert.equal(p.authenticationToken, 'a'.repeat(32));
  assert.equal(p.webServiceURL, cfg.webServiceURL);
  assert.deepEqual(p.barcodes, [{ format: 'PKBarcodeFormatQR', message: passData().qrPayload, messageEncoding: 'iso-8859-1', altText: 'K7Q2M9XP' }]);
  assert.equal(p.backgroundColor, 'rgb(26, 43, 60)');
  assert.equal(p.foregroundColor, 'rgb(255, 255, 255)');
  assert.equal(p.labelColor, 'rgb(255, 204, 0)');
  assert.equal(p.logoText, 'Kawa');
  assert.equal(p.organizationName, 'Kawa Café');
  assert.equal(p.voided, undefined);
  const primary = p.storeCard.primaryFields[0];
  assert.equal(primary.value, '7/10');
  assert.equal('changeMessage' in primary, false);
  assert.equal(p.locations.length, 10);
  assert.deepEqual(p.locations[0], { latitude: -1.95, longitude: 30.06, relevantText: 'Shop 0 is nearby' });
  const back = Object.fromEntries(p.storeCard.backFields.map((f) => [f.key, f]));
  assert.equal(back.stamp_status.value, 'You have 7 stamps');
  assert.equal('changeMessage' in back.stamp_status, false);
  assert.equal(back.news, undefined);
  assert.match(back.link_0.attributedValue, /^<a href='https:\/\/kawa\.example'>Website<\/a>$/);
  assert.match(back.link_1.attributedValue, /tel:\+250788000000/);
});

test('pass.json: reward field changes value and carries rewardMessage only when a reward is available', () => {
  const none = buildPassJson(passData(), cfg).storeCard.secondaryFields[0];
  const one = buildPassJson(passData({ rewardsAvailable: 1, currentStamps: 0 }), cfg).storeCard.secondaryFields[0];
  const two = buildPassJson(passData({ rewardsAvailable: 2 }), cfg).storeCard.secondaryFields[0];
  assert.equal(none.changeMessage, undefined);
  assert.notEqual(none.value, one.value);
  assert.notEqual(one.value, two.value);
  assert.equal(one.changeMessage, 'Your free coffee is waiting! %@');
  assert.match(one.changeMessage, /%@/);
});

test('pass.json: news and note back fields use changeMessage %@', () => {
  const p = buildPassJson(passData({ newsText: '2-for-1 on Friday', noteText: 'Happy birthday!' }), cfg);
  const back = Object.fromEntries(p.storeCard.backFields.map((f) => [f.key, f]));
  assert.equal(back.news.value, '2-for-1 on Friday');
  assert.equal(back.news.changeMessage, '%@');
  assert.equal(back.note.value, 'Happy birthday!');
  assert.equal(back.note.changeMessage, '%@');
});

test('pass.json: voided when deleted or expired', () => {
  assert.equal(buildPassJson(passData({ status: 'deleted' }), cfg).voided, true);
  assert.equal(buildPassJson(passData({ expired: true }), cfg).voided, true);
});

test('hexToRgb and asChangeMessage', () => {
  assert.equal(hexToRgb('#abc'), 'rgb(170, 187, 204)');
  assert.equal(hexToRgb('nonsense', 'rgb(1, 2, 3)'), 'rgb(1, 2, 3)');
  assert.equal(asChangeMessage('Reward: %@!'), 'Reward: %@!');
  assert.equal(asChangeMessage(''), '%@');
  assert.equal(asChangeMessage('50% off'), '50 off %@');
});

// ------------------------------------------------------------------ Google builders

test('Google class: ids, branding, locations ≤ 10, callback url', () => {
  const c = buildLoyaltyClass(passData().campaign, '3388000000012345678', { publicBaseUrl: 'https://api.example.com/' });
  assert.equal(c.id, '3388000000012345678.c_0b6f5a8e1c2d4e3f9a0b123456789abc');
  assert.equal(c.id, classIdFor('3388000000012345678', passData().campaign.id));
  assert.equal(c.issuerName, 'Kawa Café');
  assert.equal(c.programName, 'Kawa Rewards');
  assert.equal(c.hexBackgroundColor, '#1a2b3c');
  assert.equal(c.reviewStatus, 'UNDER_REVIEW');
  assert.equal(c.merchantLocations.length, 10);
  assert.deepEqual(c.merchantLocations[1], { latitude: -1.94, longitude: 30.07 });
  assert.equal(c.callbackOptions.url, 'https://api.example.com/api/webhooks/google');
  assert.match(c.programLogo.sourceUri.uri, /^https:\/\/api\.example\.com\//);
});

test('Google object: id, balance 7/10, rewards, barcode, state, text modules', () => {
  const issuer = '3388000000012345678';
  const classId = classIdFor(issuer, passData().campaign.id);
  const o = buildLoyaltyObject(passData({ rewardsAvailable: 1, newsText: 'News!' }), issuer, classId);
  assert.equal(o.id, `${issuer}.o_S3RIALABCDEF0123456789XYZ`);
  assert.equal(o.id, objectIdFor(issuer, 'S3RIALABCDEF0123456789XYZ'));
  assert.equal(o.classId, classId);
  assert.equal(o.state, 'ACTIVE');
  assert.deepEqual(o.loyaltyPoints, { label: 'Stamps', balance: { string: '7/10' } });
  assert.deepEqual(o.secondaryLoyaltyPoints, { label: 'Rewards', balance: { string: '1' } });
  assert.deepEqual(o.barcode, { type: 'QR_CODE', value: passData().qrPayload, alternateText: 'K7Q2M9XP' });
  assert.equal(o.accountName, 'Aline');
  assert.deepEqual(o.textModulesData.map((t) => t.id), ['news']);
  assert.equal(buildLoyaltyObject(passData({ expired: true }), issuer, classId).state, 'EXPIRED');
  assert.equal(buildLoyaltyObject(passData({ status: 'deleted' }), issuer, classId).state, 'INACTIVE');
  assert.throws(() => objectIdFor(issuer, 'bad serial/..'));
});

test('Google points patch: notifyPreference only when notify', () => {
  assert.deepEqual(pointsPatch('7/10', false), { loyaltyPoints: { label: 'Stamps', balance: { string: '7/10' } } });
  const n = pointsPatch('0/10', true, { secondaryLoyaltyPoints: { label: 'Rewards', balance: { string: '1' } } });
  assert.equal(n.notifyPreference, 'NOTIFY_ON_UPDATE');
  assert.equal(n.loyaltyPoints.balance.string, '0/10');
  assert.equal(n.secondaryLoyaltyPoints.balance.string, '1');
});

// ------------------------------------------------------------------ JWT

test('RS256 JWT signs and verifies; save URL is skinny and ≤ 1800 chars', () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const jwt = signServiceAccountJwt({ hello: 'world' }, pem, 'kid-1');
  const [h, p, s] = jwt.split('.');
  assert.ok(crypto.verify('RSA-SHA256', Buffer.from(`${h}.${p}`), publicKey, Buffer.from(s, 'base64url')));
  assert.deepEqual(JSON.parse(Buffer.from(h, 'base64url')), { alg: 'RS256', typ: 'JWT', kid: 'kid-1' });
  assert.deepEqual(JSON.parse(Buffer.from(p, 'base64url')), { hello: 'world' });

  const issuer = '3388000000012345678';
  const url = buildSaveUrl({
    serviceAccountEmail: 'wallet@loyalty-clone.iam.gserviceaccount.com', privateKeyPem: pem, origins: ['https://example.com'],
    objectId: objectIdFor(issuer, 'S3RIALABCDEF0123456789XYZ'), classId: classIdFor(issuer, passData().campaign.id), iat: 1764064800,
  });
  assert.ok(url.startsWith(SAVE_URL_PREFIX));
  assert.ok(url.length <= 1800, `length ${url.length}`);
  const [sh, sp, ss] = url.slice(SAVE_URL_PREFIX.length).split('.');
  assert.ok(crypto.verify('RSA-SHA256', Buffer.from(`${sh}.${sp}`), publicKey, Buffer.from(ss, 'base64url')));
  const claims = JSON.parse(Buffer.from(sp, 'base64url'));
  assert.equal(claims.aud, 'google');
  assert.equal(claims.typ, 'savetowallet');
  assert.equal(claims.iss, 'wallet@loyalty-clone.iam.gserviceaccount.com');
  assert.deepEqual(claims.origins, ['https://example.com']);
  assert.deepEqual(claims.payload, { loyaltyObjects: [{ id: `${issuer}.o_S3RIALABCDEF0123456789XYZ`, classId: `${issuer}.c_0b6f5a8e1c2d4e3f9a0b123456789abc` }] });

  assert.throws(() => buildSaveUrl({ serviceAccountEmail: 'x'.repeat(2000), privateKeyPem: pem, origins: [], objectId: 'a', classId: 'b' }), /max 1800/);
});

// ------------------------------------------------------------------ ECv2SigningOnly

// Independent implementation of the documented signed-string format (4-byte LE length + UTF-8).
const lv = (...parts) => Buffer.concat(parts.flatMap((s) => { const b = Buffer.from(s, 'utf8'); const l = Buffer.alloc(4); l.writeUInt32LE(b.length); return [l, b]; }));
const spkiB64 = (k) => k.export({ type: 'spki', format: 'der' }).toString('base64');
const ecSign = (data, key) => crypto.sign('sha256', data, { key, dsaEncoding: 'der' }).toString('base64');

function makeCallback({ issuerId = '3388000000012345678', now = Date.now(), keyExp = now + 3600_000, msgExp = now + 60_000, recipient = issuerId } = {}) {
  const root = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const inter = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const signedKey = JSON.stringify({ keyValue: spkiB64(inter.publicKey), keyExpiration: String(keyExp) });
  const signedMessage = JSON.stringify({ classId: `${issuerId}.c_x`, objectId: `${issuerId}.o_y`, expTimeMillis: msgExp, eventType: 'save', nonce: 'n-123' });
  const body = {
    signature: ecSign(lv('GooglePayPasses', recipient, 'ECv2SigningOnly', signedMessage), inter.privateKey),
    intermediateSigningKey: { signedKey, signatures: [ecSign(lv('GooglePayPasses', 'ECv2SigningOnly', signedKey), root.privateKey)] },
    protocolVersion: 'ECv2SigningOnly',
    signedMessage,
  };
  const rootKeys = [{ keyValue: spkiB64(root.publicKey), protocolVersion: 'ECv2SigningOnly', keyExpiration: String(now + 86_400_000) }];
  return { body, rootKeys, issuerId };
}

test('ECv2SigningOnly: accepts a valid callback', () => {
  const { body, rootKeys, issuerId } = makeCallback();
  const m = verifyGoogleCallback(body, { issuerId, rootKeys });
  assert.equal(m.eventType, 'save');
  assert.equal(m.nonce, 'n-123');
  assert.equal(m.objectId, `${issuerId}.o_y`);
  assert.equal(m.classId, `${issuerId}.c_x`);
  // the raw JSON string form is accepted too
  assert.equal(verifyGoogleCallback(JSON.stringify(body), { issuerId, rootKeys }).nonce, 'n-123');
});

test('ECv2SigningOnly: rejects a tampered message', () => {
  const { body, rootKeys, issuerId } = makeCallback();
  const tampered = { ...body, signedMessage: body.signedMessage.replace('"save"', '"del"') };
  assert.throws(() => verifyGoogleCallback(tampered, { issuerId, rootKeys }), CallbackVerificationError);
  const badKey = { ...body, intermediateSigningKey: { ...body.intermediateSigningKey, signedKey: body.intermediateSigningKey.signedKey.replace(/"keyExpiration":"\d+"/, '"keyExpiration":"99999999999999"') } };
  assert.throws(() => verifyGoogleCallback(badKey, { issuerId, rootKeys }), /intermediate key signature invalid/);
});

test('ECv2SigningOnly: rejects a wrong recipient', () => {
  const { body, rootKeys, issuerId } = makeCallback({ recipient: '9999999999999999999' });
  assert.throws(() => verifyGoogleCallback(body, { issuerId, rootKeys }), /message signature invalid/);
});

test('ECv2SigningOnly: rejects an expired intermediate key, an expired message, and unknown roots', () => {
  const k = makeCallback({ keyExp: Date.now() - 1000 });
  assert.throws(() => verifyGoogleCallback(k.body, { issuerId: k.issuerId, rootKeys: k.rootKeys }), /intermediate key expired/);
  const m = makeCallback({ msgExp: Date.now() - 1000 });
  assert.throws(() => verifyGoogleCallback(m.body, { issuerId: m.issuerId, rootKeys: m.rootKeys }), /message expired/);
  const other = makeCallback();
  const v = makeCallback();
  assert.throws(() => verifyGoogleCallback(v.body, { issuerId: v.issuerId, rootKeys: other.rootKeys }), /intermediate key signature invalid/);
  assert.throws(() => verifyGoogleCallback(v.body, { issuerId: v.issuerId, rootKeys: v.rootKeys.map((r) => ({ ...r, keyExpiration: '1' })) }), /no valid root keys/);
});

// ------------------------------------------------------------------ images

test('strip SVG follows the stamp-strip column rules', () => {
  assert.deepEqual([10, 11, 18, 19, 30].map(stampColumns), [5, 6, 6, 8, 8]);
  const svg = renderStripSvg({ total: 10, filled: 7, stamp: '#ff0000', background: '#000000' });
  assert.match(svg, /^<svg [^>]*width="1125" height="432"/);
  assert.equal((svg.match(/fill="#ff0000"/g) ?? []).length, 7);
  assert.equal((svg.match(/stroke-dasharray/g) ?? []).length, 3);
  assert.equal((svg.match(/r="44"/g) ?? []).length, 1); // reward ring
  assert.ok(!renderStripSvg({ total: 5, filled: 1, stamp: '"/><script>' }).includes('<script>'));
});

test('solidPng is a valid PNG; renderStripPng reports resvg missing', async () => {
  const png = solidPng(29, 29, '#1a2b3c');
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), 29);
  const idat = png.indexOf('IDAT');
  const raw = zlib.inflateSync(png.subarray(idat + 4, idat + 4 + png.readUInt32BE(idat - 4)));
  assert.equal(raw.length, 29 * (1 + 29 * 4));
  assert.deepEqual([...raw.subarray(1, 5)], [0x1a, 0x2b, 0x3c, 255]);
  let resvg = true;
  try { await import('@resvg/resvg-js'); } catch { resvg = false; }
  if (!resvg) await assert.rejects(renderStripPng({ total: 10, filled: 3 }), /not installed/);
});

// ------------------------------------------------------------------ passkit-generator

test('buildPkpass throws NotConfiguredError without env', async () => {
  for (const k of ['APPLE_PASS_TYPE_ID', 'APPLE_TEAM_ID', 'APPLE_PASS_CERT_PEM', 'APPLE_PASS_KEY_PEM', 'APPLE_WWDR_PEM', 'PUBLIC_BASE_URL']) delete process.env[k];
  await assert.rejects(buildPkpass(passData()), (e) => e instanceof NotConfiguredError && isNotConfigured(e) && e.missing.includes('APPLE_PASS_CERT_PEM'));
});

test('buildPkpass signs a zip with a self-signed test certificate (node-forge)', async () => {
  const { default: forge } = await import('node-forge');
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const keyPem = privateKey.export({ type: 'pkcs1', format: 'pem' });
  const fKey = forge.pki.privateKeyFromPem(keyPem);
  const cert = forge.pki.createCertificate();
  cert.publicKey = forge.pki.setRsaPublicKey(fKey.n, fKey.e);
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date(Date.now() - 60_000);
  cert.validity.notAfter = new Date(Date.now() + 86_400_000);
  const attrs = [{ name: 'commonName', value: 'Pass Type ID: pass.com.example.loyalty' }, { shortName: 'OU', value: 'ABCDE12345' }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(fKey, forge.md.sha256.create());
  const certPem = forge.pki.certificateToPem(cert);

  // Escaped newlines, as PEMs often sit in env vars.
  Object.assign(process.env, {
    APPLE_PASS_TYPE_ID: 'pass.com.example.loyalty', APPLE_TEAM_ID: 'ABCDE12345', PUBLIC_BASE_URL: 'https://api.example.com',
    APPLE_PASS_CERT_PEM: certPem.replace(/\n/g, '\\n'), APPLE_PASS_KEY_PEM: keyPem, APPLE_WWDR_PEM: certPem,
  });
  try {
    const buf = await buildPkpass(passData({ rewardsAvailable: 1, newsText: 'Hello' }));
    assert.ok(Buffer.isBuffer(buf));
    assert.equal(buf.subarray(0, 2).toString(), 'PK');
    for (const f of ['pass.json', 'manifest.json', 'signature', 'icon.png', 'strip@3x.png']) assert.ok(buf.includes(Buffer.from(f)), `zip contains ${f}`);
  } finally {
    for (const k of ['APPLE_PASS_TYPE_ID', 'APPLE_TEAM_ID', 'APPLE_PASS_CERT_PEM', 'APPLE_PASS_KEY_PEM', 'APPLE_WWDR_PEM', 'PUBLIC_BASE_URL']) delete process.env[k];
  }
});

// ------------------------------------------------------------------ APNs (no network)

test('pushPassUpdates reports malformed tokens as invalid without connecting', async () => {
  const r = await pushPassUpdates(['not-a-token', '../../evil'], { config: { passTypeIdentifier: 'pass.x', teamIdentifier: 'T', webServiceURL: 'https://x', certPem: '', keyPem: '', wwdrPem: '' }, origin: 'https://127.0.0.1:1' });
  assert.deepEqual(r, { sent: 0, invalid: ['not-a-token', '../../evil'], failed: 0 });
});
