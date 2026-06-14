import { describe, it, expect } from 'vitest';
import { ZkRangeProofVerifier, RangeProof } from '../../src/core/crypto/zk_verifier.js';
import { SafeMath } from '../../src/core/utils/math.js';

describe('ZkRangeProofVerifier', () => {
  const verifier = new ZkRangeProofVerifier();

  it('should reject invalid range (lower > upper)', () => {
    const proof: RangeProof = {
      commitment: 'a'.repeat(64),
      proofData: 'proof_data',
      lowerBound: 100n,
      upperBound: 50n,
      challenge: 'abc',
      response: 'def',
    };
    const result = verifier.verifyRangeProof(proof, new Uint8Array(32));
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('range');
  });

  it('should reject invalid commitment length', () => {
    const proof: RangeProof = {
      commitment: 'short',
      proofData: 'proof_data',
      lowerBound: 0n,
      upperBound: 100n,
      challenge: 'abc',
      response: 'def',
    };
    const result = verifier.verifyRangeProof(proof, new Uint8Array(32));
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('commitment');
  });
});

describe('SafeMath', () => {
  it('should convert precision correctly', () => {
    const result = SafeMath.toSorobanPrecision(123456n, 4);
    expect(result).toBe(123456000n);
  });

  it('should throw on overflow in addition', () => {
    expect(() => SafeMath.safeAdd(SafeMath.MAX_SOROBAN_VALUE, 1n)).toThrow('overflow');
  });

  it('should multiply with precision', () => {
    const result = SafeMath.multiplyWithPrecision(100n, 50n, 2);
    expect(result).toBe(50n);
  });

  it('should detect overflow', () => {
    expect(SafeMath.checkOverflow(SafeMath.MAX_SOROBAN_VALUE)).toBe(false);
    expect(SafeMath.checkOverflow(SafeMath.MAX_SOROBAN_VALUE + 1n)).toBe(true);
  });
});

describe('StreamParser', () => {
  it('should be importable', async () => {
    const mod = await import('../../src/core/ingestion/stream_parser.js');
    expect(mod.TelemetryStreamParser).toBeDefined();
  });
});
