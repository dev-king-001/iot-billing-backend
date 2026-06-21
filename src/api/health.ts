import { FastifyInstance } from 'fastify';
import { circuitBreakerState, circuitBreakerQueueDepth } from './metrics/prometheus.js';

export function registerCircuitHealth(app: FastifyInstance): void {
  app.get('/circuit-health', async () => {
    const stateMetric = (await circuitBreakerState.get()).values.find(
      (v: any) => v.labels.client === 'soroban',
    );
    const queueMetric = (await circuitBreakerQueueDepth.get()).values.find(
      (v: any) => v.labels.client === 'soroban',
    );
    return {
      state: stateMetric ? stateMetric.value : 0,
      queueDepth: queueMetric ? queueMetric.value : 0,
    };
  });
}
