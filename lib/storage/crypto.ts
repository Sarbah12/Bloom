/**
 * AES-256-GCM sealing for everything Bloom stores on the device.
 *
 * GCM is authenticated: a file that has been altered, truncated or encrypted
 * with a different key fails to open instead of decrypting to garbage.
 * The randomness source is passed in so this module stays pure and testable.
 */
import { gcm } from '@noble/ciphers/aes.js';

import { fromBase64, toBase64, utf8Decode, utf8Encode } from './encoding.ts';

export const KEY_BYTES = 32;
export const NONCE_BYTES = 12;
const FORMAT = 'bloom-vault';
const VERSION = 1;

export type RandomBytes = (length: number) => Uint8Array;

export interface SealedEnvelope {
  format: typeof FORMAT;
  v: typeof VERSION;
  nonce: string;
  data: string;
}

export function newKey(random: RandomBytes): string {
  return toBase64(random(KEY_BYTES));
}

export function seal(keyBase64: string, plaintext: string, random: RandomBytes): string {
  const key = fromBase64(keyBase64);
  if (key.length !== KEY_BYTES) throw new Error('Vault key has the wrong length');
  const nonce = random(NONCE_BYTES);
  const data = gcm(key, nonce).encrypt(utf8Encode(plaintext));
  const envelope: SealedEnvelope = { format: FORMAT, v: VERSION, nonce: toBase64(nonce), data: toBase64(data) };
  return JSON.stringify(envelope);
}

/** Throws if the envelope was tampered with or sealed with another key. */
export function open(keyBase64: string, sealed: string): string {
  const envelope = JSON.parse(sealed) as Partial<SealedEnvelope>;
  if (envelope.format !== FORMAT || envelope.v !== VERSION || !envelope.nonce || !envelope.data) {
    throw new Error('Not a Bloom vault');
  }
  const plain = gcm(fromBase64(keyBase64), fromBase64(envelope.nonce)).decrypt(fromBase64(envelope.data));
  return utf8Decode(plain);
}
