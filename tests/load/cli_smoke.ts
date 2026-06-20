/**
 * Scaled-down smoke runner used by CI (and by a developer who wants a
 * "does it still work?" yes/no answer in under 30 seconds).
 *
 * Unlike the production profiles (which target 50k devices for 5+ min),
 * this runner uses numbers chosen to fit inside a normal CI job's
 * memory + time budget while still exercising:
 *
 *   - mock server boot + readiness probe
 *   - HTTP ingestion through the validator + nonce cache
 *   - fault injection (malformed, expired, duplicate)
 *   - JSON metrics output to ./load-test-results.json
 *
 * Exit code is 0 only if the run produced accepted payloads AND the
 * configured P99 target was met. CI uses that to gate deploys.
 */

import { setTimeout as sleep } from 'node:timers/promises';
import { buildMockServer, type StartedMockServer } from './mock_server.js';
import { runLoad, profileDefaults } from './lib/run_load.js';
import type { LoadMetrics } from './lib/types.js';

const COMPACT = process.env['SMOKE_COMPACT'] === '1';

async function run(): Promise<void> {
  const port = Number.parseInt(process.env['SMOKE_PORT'] ?? '0', 10);
  const latencyMs = Number.parseFloat(process.env['SMOKE_LATENCY_MS'] ?? '2');
  const concurrentClients = Number.parseInt(
    process.env['SMOKE_CONCURRENT'] ?? (COMPACT ? '15' : '50'),
    10,
  );
  const durationSec = Number.parseInt(
    process.env['SMOKE_DURATION_SEC'] ?? (COMPACT ? '3' : '8'),
    10,
  );
  const outPath = process.env['SMOKE_OUTPUT'] ?? `${process.cwd()}/load-test-results.json`;

  const server: StartedMockServer = await buildMockServer({
    port,
    host: '127.0.0.1',
    latencyMs,
    latencyJitter: 0.2,
    nonceWindowMs: 5_000,
  });
  await server.start();
  console.log(`[cli_smoke] mock server ready on ${server.url}`);

  console.log(
    `[cli_smoke] running profile=steady_state ` +
      `clients=${String(concurrentClients)} duration=${String(durationSec)}s`,
  );

  const metrics: LoadMetrics = await runLoad({
    profile: 'steady_state',
    targetUrl: server.url,
    concurrentClients,
    durationSec,
    payloadsPerSec: profileDefaults('steady_state').payloadsPerSec,
    log: () => undefined,
    p99TargetMs: 500,
    skipHealthCheck: true,
  });

  const serverStats = server.stats();
  await sleep(100);
  await server.stop();

  const passed = metrics.accepted > 0 && metrics.targets.p99Met && metrics.totalPayloads > 0;
  const result = {
    metrics,
    serverStats,
    passed,
  };

  const fs = await import('node:fs');
  await fs.promises.writeFile(outPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`[cli_smoke] wrote report -> ${outPath}`);
  console.log(
    `[cli_smoke] accepted=${String(metrics.accepted)} rejected=${String(metrics.rejected)} ` +
      `errors=${String(metrics.errors)} p99Ms=${metrics.latency.p99Ms.toFixed(2)} ` +
      `p99Met=${String(metrics.targets.p99Met)}`,
  );

  if (!passed) {
    console.error('[cli_smoke] FAIL: P99 target not met or zero accepted payloads');
    process.exit(1);
  }
}

run().catch((err: unknown) => {
  console.error('[cli_smoke] failed:', err);
  process.exit(1);
});
