import { describe, it, expect } from 'vitest';
import { validateSignature, SignedPayload } from '../../src/core/ingestion/validator.js';
import nacl from 'tweetnacl';
import { Buffer } from 'node:buffer';

function createSignedPayload(
  overrides: Partial<SignedPayload> = {},
): { payload: SignedPayload; publicKey: Uint8Array } {
  const keyPair = nacl.sign.keyPair();
  const base: Omit<SignedPayload, 'signature'> = {
    deviceId: 'dev-001',
    timestamp: Date.now(),
    nonce: crypto.randomUUID(),
    metrics: { energy_kwh: 1.5, water_l: 3.2 },
    ...overrides,
  };
  const message = Buffer.from(JSON.stringify(base), 'utf-8');
  const signature = Buffer.from(nacl.sign.detached(message, keyPair.secretKey)).toString('hex');
  return { payload: { ...base, signature }, publicKey: keyPair.publicKey };
}

describe('validateSignature', () => {
  it('should accept a valid signed payload', () => {
    const { payload, publicKey } = createSignedPayload();
    const result = validateSignature(publicKey, payload);
    expect(result.valid).toBe(true);
  });

  it('should reject payload with invalid signature', () => {
    const { payload, publicKey } = createSignedPayload();
    payload.signature = 'a'.repeat(128);
    const result = validateSignature(publicKey, payload);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('signature');
  });

  it('should reject stale timestamp outside sliding window', () => {
    const { payload, publicKey } = createSignedPayload({ timestamp: Date.now() - 10000 });
    const result = validateSignature(publicKey, payload);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('sliding window');
  });

  it('should reject replayed nonce', () => {
    const { payload, publicKey } = createSignedPayload();
    const first = validateSignature(publicKey, payload);
    expect(first.valid).toBe(true);
    const replay = validateSignature(publicKey, payload);
    expect(replay.valid).toBe(false);
    expect(replay.reason).toContain('replay');
  });

  it('should reject invalid signature length', () => {
    const { payload, publicKey } = createSignedPayload();
    payload.signature = 'too-short';
    const result = validateSignature(publicKey, payload);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('signature length');
  });
});
