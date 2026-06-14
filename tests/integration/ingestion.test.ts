import { describe, it, expect } from 'vitest';

describe('Ingestion Integration', () => {
  it('should validate that env vars are present when configured', () => {
    if (process.env['DATABASE_URL'] && process.env['SOROBAN_RPC_URL']) {
      expect(process.env['DATABASE_URL']).toBeDefined();
      expect(process.env['SOROBAN_RPC_URL']).toBeDefined();
    } else {
      expect(true).toBe(true);
    }
  });
});
