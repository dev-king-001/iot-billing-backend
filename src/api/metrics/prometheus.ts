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

export const circuitBreakerQueueDepth = new promClient.Gauge({
  name: 'circuit_breaker_queue_depth',
  help: 'Current pending request queue depth for a client',
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

export const tenantPoolActiveConnections = new promClient.Gauge({
  name: 'tenant_pool_active_connections',
  help: 'Active database connections per tenant sub-pool',
  labelNames: ['tenant_id'],
});

export const tenantPoolQueueDepth = new promClient.Gauge({
  name: 'tenant_pool_queue_depth',
  help: 'Pending fair-queue requests waiting for a tenant connection',
});

export const globalPoolUtilization = new promClient.Gauge({
  name: 'global_pool_utilization',
  help: 'Ratio of active connections to global pool maximum',
});

export const tenantPoolWaitDuration = new promClient.Histogram({
  name: 'tenant_pool_wait_duration_ms',
  help: 'Time spent waiting for a tenant-scoped connection',
  labelNames: ['tenant_id', 'result'],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500],
});

export const tenantPoolRejections = new promClient.Counter({
  name: 'tenant_pool_rejections_total',
  help: 'Connections rejected due to pool contention timeout',
  labelNames: ['tenant_id'],
});

export function setTenantPoolActiveConnections(tenantId: string, count: number): void {
  tenantPoolActiveConnections.set({ tenant_id: tenantId }, count);
}

export function setTenantPoolQueueDepth(depth: number): void {
  tenantPoolQueueDepth.set(depth);
}

export function setGlobalPoolUtilization(ratio: number): void {
  globalPoolUtilization.set(ratio);
}

export function recordTenantPoolGrant(tenantId: string, waitMs: number): void {
  tenantPoolWaitDuration.observe({ tenant_id: tenantId, result: 'granted' }, waitMs);
}

export function recordTenantPoolRejection(tenantId: string, waitMs: number): void {
  tenantPoolWaitDuration.observe({ tenant_id: tenantId, result: 'rejected' }, waitMs);
  tenantPoolRejections.inc({ tenant_id: tenantId });
}

export function getMetrics(): Promise<string> {
  return promClient.register.metrics();
}
