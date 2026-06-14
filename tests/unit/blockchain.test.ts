import { describe, it, expect, beforeEach } from 'vitest';
import { NoncePool } from '../../src/core/blockchain/nonce_pool.js';
import { SorobanRpcClient, CircuitState } from '../../src/core/blockchain/rpc_client.js';
import { IngestionStateMachine, IngestionState } from '../../src/core/ingestion/state_machine.js';

describe('NoncePool', () => {
  let pool: NoncePool;

  beforeEach(() => {
    pool = new NoncePool();
  });

  it('should acquire sequential nonces', async () => {
    const a = await pool.acquire('worker-a');
    const b = await pool.acquire('worker-b');
    expect(b).toBe(a + 1);
  });

  it('should release nonce', async () => {
    await pool.acquire('worker-a');
    await pool.release('worker-a');
    expect(pool.getActiveCount()).toBe(0);
  });
});

describe('SorobanRpcClient', () => {
  it('should initialize with CLOSED circuit', () => {
    const client = new SorobanRpcClient('https://rpc.example.com');
    expect(client.getState()).toBe(CircuitState.CLOSED);
  });
});

describe('IngestionStateMachine', () => {
  it('should transition PENDING -> TENTATIVE -> SETTLED', () => {
    const sm = new IngestionStateMachine(IngestionState.PENDING);
    expect(sm.transition(IngestionState.TENTATIVE, 'starting processing')).toBe(true);
    expect(sm.getState()).toBe(IngestionState.TENTATIVE);
    expect(sm.transition(IngestionState.SETTLED, 'on-chain confirmed')).toBe(true);
    expect(sm.getState()).toBe(IngestionState.SETTLED);
  });

  it('should reject invalid transition', () => {
    const sm = new IngestionStateMachine(IngestionState.PENDING);
    expect(sm.transition(IngestionState.SETTLED, 'skip tentative')).toBe(false);
  });

  it('should allow rollback from tentative', () => {
    const sm = new IngestionStateMachine(IngestionState.TENTATIVE);
    expect(sm.transition(IngestionState.ROLLED_BACK, 'tx rejected')).toBe(true);
  });
});
