import nacl from 'tweetnacl';
import { Buffer } from 'node:buffer';

export interface SignedPayload {
  deviceId: string;
  timestamp: number;
  nonce: string;
  metrics: Record<string, number>;
  signature: string;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

const NONCE_CACHE = new Set<string>();
const NONCE_WINDOW_MS = 5000;

setInterval(() => {
  NONCE_CACHE.clear();
}, NONCE_WINDOW_MS);

export function validateSignature(publicKey: Uint8Array, payload: SignedPayload): ValidationResult {
  const { signature, ...rest } = payload;
  const message = Buffer.from(JSON.stringify(rest), 'utf-8');
  const sigBytes = Buffer.from(signature, 'hex');

  if (sigBytes.length !== 64) {
    return { valid: false, reason: 'Invalid signature length' };
  }

  const now = Date.now();
  if (Math.abs(now - payload.timestamp) > NONCE_WINDOW_MS) {
    return { valid: false, reason: 'Timestamp outside sliding window' };
  }

  if (NONCE_CACHE.has(payload.nonce)) {
    return { valid: false, reason: 'Nonce already consumed (replay detected)' };
  }

  const verified = nacl.sign.detached.verify(message, sigBytes, publicKey);
  if (!verified) {
    return { valid: false, reason: 'Ed25519 signature mismatch' };
  }

  NONCE_CACHE.add(payload.nonce);
  return { valid: true };
}
