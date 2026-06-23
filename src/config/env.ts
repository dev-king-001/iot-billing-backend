import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  TIMESCALEDB_URL: z.string().url(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  SOROBAN_RPC_URL: z.string().url(),
  SOROBAN_NETWORK_PASSPHRASE: z.string(),
  CONTRACT_ID: z.string().optional(),
  ADMIN_SECRET_KEY: z.string().optional(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  CHALLENGE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  OTEL_SERVICE_NAME: z.string().default('iot-billing-backend'),
  MAX_PAYLOAD_SIZE_BYTES: z.coerce.number().int().positive().default(65536),
  NONCE_WINDOW_MS: z.coerce.number().int().positive().default(5000),
  LEDGER_START: z.coerce.number().int().nonnegative().default(0),
  LEDGER_SYNC_CONCURRENCY: z.coerce.number().int().positive().default(10),
});

export type Env = z.infer<typeof envSchema>;

/** One environment-validation failure, preserving the field, code, and reason. */
export interface EnvValidationIssue {
  path: string;
  code: string;
  message: string;
}

/**
 * Join a Zod issue path into a stable, readable string, rendering numeric
 * (array index) segments in bracket notation: `["a", 2, "b"]` -> `"a[2].b"`.
 *
 * This keeps logged paths short and unambiguous without ever truncating them,
 * which is what defeated debugging in the deeply nested case described by
 * issue #69. An empty path (a root-level error) renders as `"(root)"`.
 */
export function compactPath(path: readonly (string | number)[]): string {
  let out = '';
  for (const segment of path) {
    if (typeof segment === 'number') {
      out += `[${String(segment)}]`;
    } else {
      out += out === '' ? segment : `.${segment}`;
    }
  }
  return out === '' ? '(root)' : out;
}

/**
 * Convert a {@link z.ZodError} into one structured entry per issue.
 *
 * Unlike `error.flatten()`, this preserves the issue `code` and the full,
 * compacted path for *every* failure, so no failing field is collapsed away or
 * hidden behind truncation. Callers can log each entry as its own structured
 * record.
 */
export function formatEnvIssues(error: z.ZodError): EnvValidationIssue[] {
  return error.issues.map((issue) => ({
    path: compactPath(issue.path),
    code: issue.code,
    message: issue.message,
  }));
}

let cachedEnv: Env | null = null;

export function loadEnv(): Env {
  if (cachedEnv) return cachedEnv;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = formatEnvIssues(parsed.error);
    const detail = issues.map((issue) => `  ${issue.path}: ${issue.message} (${issue.code})`);
    throw new Error(['Environment validation failed:', ...detail].join('\n'));
  }
  cachedEnv = parsed.data;
  return cachedEnv;
}

export function getEnv(): Env {
  if (!cachedEnv) return loadEnv();
  return cachedEnv;
}

export function clearEnvCache(): void {
  cachedEnv = null;
}
