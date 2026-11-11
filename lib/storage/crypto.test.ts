import assert from 'node:assert/strict';
import { getRandomValues } from 'node:crypto';
import { describe, it } from 'node:test';

import { newKey, open, seal } from './crypto.ts';
import { fromBase64, toBase64, utf8Decode, utf8Encode } from './encoding.ts';

const random = (n: number) => getRandomValues(new Uint8Array(n));

describe('encoding', () => {
  it('round-trips UTF-8 including emoji and accents', () => {
    const text = 'Crampes légères 🌙 — 経期 · ألم';
    assert.equal(utf8Decode(utf8Encode(text)), text);
    assert.deepEqual(utf8Encode(text), new TextEncoder().encode(text));
  });

  it('matches the platform base64', () => {
    for (const len of [0, 1, 2, 3, 4, 31, 32, 33]) {
      const bytes = random(len);
      const ours = toBase64(bytes);
      assert.equal(ours, Buffer.from(bytes).toString('base64'));
      assert.deepEqual(fromBase64(ours), bytes);
    }
  });
});

describe('vault sealing', () => {
  const key = newKey(random);
  const secret = JSON.stringify({ note: 'Heavy flow, cramps on day 1' });

  it('round-trips and never stores plaintext', () => {
    const sealed = seal(key, secret, random);
    assert.ok(!sealed.includes('cramps'));
    assert.equal(open(key, sealed), secret);
  });

  it('uses a fresh nonce each time', () => {
    assert.notEqual(seal(key, secret, random), seal(key, secret, random));
  });

  it('refuses a tampered file or the wrong key', () => {
    const sealed = JSON.parse(seal(key, secret, random));
    const bytes = fromBase64(sealed.data);
    bytes[0] ^= 1;
    assert.throws(() => open(key, JSON.stringify({ ...sealed, data: toBase64(bytes) })));
    assert.throws(() => open(newKey(random), seal(key, secret, random)));
    assert.throws(() => open(key, '{"hello":1}'));
  });
});
