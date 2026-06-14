import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(() => {
  process.env['DATABASE_URL'] = 'postgresql://localhost:5432/test';
  process.env['TIMESCALEDB_URL'] = 'postgresql://localhost:5432/test';
  process.env['SOROBAN_RPC_URL'] = 'https://rpc.test';
  process.env['SOROBAN_NETWORK_PASSPHRASE'] = 'Test Network';
  process.env['JWT_SECRET'] = 'a'.repeat(32);
  process.env['REDIS_URL'] = 'redis://localhost:6379';
});

describe('Config', () => {
  it('should export loadEnv and getEnv functions', async () => {
    const mod = await import('../../src/config/env.js');
    expect(typeof mod.loadEnv).toBe('function');
    expect(typeof mod.getEnv).toBe('function');
  });

  it('should export Env type', async () => {
    const mod = await import('../../src/config/env.js');
    const env = mod.getEnv();
    expect(env).toBeDefined();
    expect(typeof env.PORT).toBe('number');
    expect(typeof env.NODE_ENV).toBe('string');
  });
});
