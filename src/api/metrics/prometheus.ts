import promClient from 'prom-client';

const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics({ register: promClient.register });

export const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
});

export const ingestionCounter = new promClient.Counter({
  name: 'ingestion_packets_total',
  help: 'Total number of ingested telemetry packets',
  labelNames: ['device_id', 'status'],
});

export const blockchainTxCounter = new promClient.Counter({
  name: 'blockchain_transactions_total',
  help: 'Total Soroban transactions submitted',
  labelNames: ['status'],
});

export const circuitBreakerState = new promClient.Gauge({
  name: 'circuit_breaker_state',
  help: 'Current circuit breaker state (0=closed, 1=half-open, 2=open)',
  labelNames: ['client'],
});

export const noncePoolDepth = new promClient.Gauge({
  name: 'nonce_pool_active_count',
  help: 'Active nonce reservations in the pool',
});

export const ingestionQueueDepth = new promClient.Gauge({
  name: 'ingestion_queue_depth',
  help: 'Current ingestion task queue depth',
});

export const gcPauseDuration = new promClient.Histogram({
  name: 'node_gc_pause_duration_ms',
  help: 'Garbage collection pause duration in ms',
  buckets: [1, 5, 10, 25, 50, 100, 250],
});

export function getMetrics(): Promise<string> {
  return promClient.register.metrics();
}
