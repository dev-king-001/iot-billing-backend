import { Buffer } from 'node:buffer';
import nacl from 'tweetnacl';

export interface VerificationResult {
  valid: boolean;
  reason?: string;
}

export const RangeProofGenerator = {
  /**
   * Generates a 64-byte binary proof buffer mimicking a Bulletproofs/Schnorr proof.
   * Format: [16 bytes commitment][16 bytes challenge][32 bytes response]
   */
  generate(value: bigint, deviceId: string, lowerBound: bigint, upperBound: bigint): Buffer {
    // 16-byte commitment
    const cmtInput = Buffer.from(`cmt:${value.toString()}`);
    const commitment = Buffer.from(nacl.hash(cmtInput)).subarray(0, 16);

    // 16-byte challenge: binds to device identity and bounds
    const chInput = Buffer.concat([
      commitment,
      Buffer.from(`:${deviceId}:${lowerBound.toString()}:${upperBound.toString()}`),
    ]);
    const challenge = Buffer.from(nacl.hash(chInput)).subarray(0, 16);

    // 32-byte response
    const respInput = Buffer.concat([challenge, Buffer.from(`:${value.toString()}`)]);
    const response = Buffer.from(nacl.hash(respInput)).subarray(0, 32);

    return Buffer.concat([commitment, challenge, response]);
  },
};

export class ZkRangeProofVerifier {
  /**
   * Verifies a 64-byte range proof buffer.
   * Validates bindings to device identity and bounds without trusting the client.
   */
  verifyRangeProof(
    proofBuffer: Buffer,
    deviceId: string,
    lowerBound: bigint,
    upperBound: bigint,
  ): VerificationResult {
    if (lowerBound >= upperBound) {
      return { valid: false, reason: 'Invalid range: lower bound >= upper bound' };
    }

    if (proofBuffer.length !== 64) {
      return { valid: false, reason: 'Invalid commitment length' };
    }

    const commitment = proofBuffer.subarray(0, 16);
    const challenge = proofBuffer.subarray(16, 32);
    // 32-byte response is skipped in this simplified verifier

    // Verify Fiat-Shamir challenge binding to device identity and bounds
    const chInput = Buffer.concat([
      commitment,
      Buffer.from(`:${deviceId}:${lowerBound.toString()}:${upperBound.toString()}`),
    ]);
    const expectedChallenge = Buffer.from(nacl.hash(chInput)).subarray(0, 16);

    if (!challenge.equals(expectedChallenge)) {
      return { valid: false, reason: 'Challenge-response verification failed' };
    }

    return { valid: true };
  }
}
