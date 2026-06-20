import type { PrismaClient } from '@prisma/client';
import { getDiagnosticsTracer } from '../diagnostics/tracer.js';
import { DOMAIN_BLOCKCHAIN, TELEMETRY_DOMAIN_ATTR } from '../diagnostics/sampler.js';

const MAX_GAP = 172_800;
const CHECKPOINT_INTERVAL = 64;
const SYNC_ID = 'primary';
const MAX_RETRIES = 3;

interface LedgerEntry {
  sequence: number;
  hash: string;
  closedAt: string;
  transactions: string[];
}

export interface SyncState {
  lastSyncedLedger: number;
  targetLedger: number;
  inProgress: boolean;
  lastCheckpointAt: Date | null;
  errorCount: number;
}

interface SynchronizerOptions {
  startingLedger?: number;
  concurrency?: number;
  pollIntervalMs?: number;
}

export class LedgerEventSynchronizer {
  private tracer = getDiagnosticsTracer();
  private lastSyncedLedger = 0;
  private targetLedger = 0;
  private inProgress = false;
  private lastCheckpointAt: Date | null = null;
  private errorCount = 0;
  private readonly concurrency: number;
  private readonly pollIntervalMs: number;
  private readonly startingLedger: number;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  constructor(
    private prisma: PrismaClient,
    private rpcUrl: string,
    options: SynchronizerOptions = {},
  ) {
    this.startingLedger = options.startingLedger ?? 0;
    this.concurrency = options.concurrency ?? 10;
    this.pollIntervalMs = options.pollIntervalMs ?? 5000;
  }

  async start(): Promise<void> {
    const state = await this.prisma.ledgerSyncState.findUnique({
      where: { syncId: SYNC_ID },
    });
    this.lastSyncedLedger = state?.lastSyncedLedger ?? this.startingLedger;
    console.log(
      `LedgerEventSynchronizer: loaded lastSyncedLedger=${String(this.lastSyncedLedger)}`,
    );

    this.intervalHandle = setInterval(() => {
      void this.pollLatestLedger();
    }, this.pollIntervalMs);
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  async catchUp(fromLedger: number, toLedger: number): Promise<void> {
    const cappedTo = Math.min(toLedger, fromLedger + MAX_GAP);
    this.targetLedger = cappedTo;
    this.inProgress = true;

    try {
      for (
        let batchStart = fromLedger + 1;
        batchStart <= cappedTo;
        batchStart += this.concurrency
      ) {
        const batchEnd = Math.min(batchStart + this.concurrency - 1, cappedTo);
        const seqs = Array.from({ length: batchEnd - batchStart + 1 }, (_, i) => batchStart + i);

        await Promise.all(
          seqs.map(async (seq) => {
            for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
              try {
                const ledger = await this.fetchLedger(seq);
                await this.processLedger(ledger);
                return;
              } catch (err) {
                if (attempt < MAX_RETRIES - 1) {
                  await this.sleep(2 ** attempt * 200);
                } else {
                  console.error(
                    `Skipping ledger ${String(seq)} after ${String(MAX_RETRIES)} retries:`,
                    err,
                  );
                  this.errorCount++;
                }
              }
            }
          }),
        );

        this.lastSyncedLedger = batchEnd;

        const crossedBoundary =
          Math.floor(batchEnd / CHECKPOINT_INTERVAL) >
          Math.floor((batchStart - 1) / CHECKPOINT_INTERVAL);

        if (crossedBoundary || batchEnd === cappedTo) {
          await this.checkpoint();
        }
      }
    } finally {
      this.inProgress = false;
    }
  }

  private async checkpoint(): Promise<void> {
    await this.prisma.ledgerSyncState.upsert({
      where: { syncId: SYNC_ID },
      update: { lastSyncedLedger: this.lastSyncedLedger },
      create: { syncId: SYNC_ID, lastSyncedLedger: this.lastSyncedLedger },
    });
    this.lastCheckpointAt = new Date();
  }

  private async pollLatestLedger(): Promise<void> {
    if (this.inProgress) return;

    try {
      const response = await this.rpcFetch(`${this.rpcUrl}/ledgers/latest`);
      const latest = (await response.json()) as { sequence: number };
      if (latest.sequence > this.lastSyncedLedger) {
        await this.catchUp(this.lastSyncedLedger, latest.sequence);
      }
    } catch (error) {
      console.error('Polling error:', error);
    }
  }

  private async fetchLedger(sequence: number): Promise<LedgerEntry> {
    const response = await this.rpcFetch(`${this.rpcUrl}/ledgers/${String(sequence)}`);
    return response.json() as Promise<LedgerEntry>;
  }

  private async processLedger(ledger: LedgerEntry): Promise<void> {
    for (const txHash of ledger.transactions) {
      try {
        const response = await this.rpcFetch(`${this.rpcUrl}/transactions/${txHash}`);
        const txData = (await response.json()) as { operations: unknown[] };
        console.log(`Processed tx ${txHash} with ${String(txData.operations.length)} ops`);
      } catch (error) {
        console.error(`Failed processing tx ${txHash}:`, error);
      }
    }
  }

  getSyncState(): SyncState {
    return {
      lastSyncedLedger: this.lastSyncedLedger,
      targetLedger: this.targetLedger,
      inProgress: this.inProgress,
      lastCheckpointAt: this.lastCheckpointAt,
      errorCount: this.errorCount,
    };
  }

  private rpcFetch(url: string, init: RequestInit = {}): Promise<Response> {
    return this.tracer.traceAsync(
      'blockchain.rpcFetch',
      async () =>
        fetch(url, {
          ...init,
          headers: this.tracer.injectTraceContext({
            ...(init.headers as Record<string, string> | undefined),
          }),
        }),
      {
        [TELEMETRY_DOMAIN_ATTR]: DOMAIN_BLOCKCHAIN,
        'rpc.url': url,
      },
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
