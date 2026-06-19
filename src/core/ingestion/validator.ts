import nacl from 'tweetnacl';
import { Buffer } from 'node:buffer';
import { ZkRangeProofVerifier } from '../crypto/zk_verifier.js';
import { MetricRangeMap } from '../../config/metric_ranges.js';

export interface SignedPayload {
  deviceId: string;
  timestamp: number;
  nonce: string;
  metrics: Record<string, number | string>;
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

  // Validate private ingest operations
  const zkVerifier = new ZkRangeProofVerifier();
  for (const [metricKey, metricValue] of Object.entries(payload.metrics)) {
    if (typeof metricValue === 'string') {
      const range = MetricRangeMap[metricKey];
      if (!range) {
        return { valid: false, reason: 'PRIVACY_VIOLATION' };
      }

      // Try reading as base64 first, fallback to hex if it's hex format
      const isHex = /^[0-9a-fA-F]+$/.test(metricValue);
      const proofBuffer = Buffer.from(metricValue, isHex ? 'hex' : 'base64');

      const result = zkVerifier.verifyRangeProof(
        proofBuffer,
        payload.deviceId,
        range.lowerBound,
        range.upperBound,
      );

      if (!result.valid) {
        return { valid: false, reason: 'PRIVACY_VIOLATION' };
      }
    }
  }

  NONCE_CACHE.add(payload.nonce);
  return { valid: true };
}
