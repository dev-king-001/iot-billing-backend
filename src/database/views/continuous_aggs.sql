-- Continuous aggregate materialized views for high-fidelity analytics
-- These auto-refresh on a schedule, eliminating raw query performance bottlenecks

-- Hourly usage aggregation per device
CREATE MATERIALIZED VIEW IF NOT EXISTS hourly_device_usage
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS bucket,
    device_id,
    COUNT(*) AS sample_count,
    SUM(metric_value) AS total_value,
    AVG(metric_value) AS avg_value,
    MIN(metric_value) AS min_value,
    MAX(metric_value) AS max_value
FROM telemetry
GROUP BY bucket, device_id
WITH NO DATA;

SELECT add_continuous_aggregate_policy('hourly_device_usage',
    start_offset => INTERVAL '3 days',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE
);

-- Daily billing summary per account
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_billing_summary
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', time) AS bucket,
    account_id,
    device_id,
    SUM(usage_amount) AS total_usage,
    COUNT(*) AS transaction_count,
    COUNT(*) FILTER (WHERE status = 'settled') AS settled_count,
    COUNT(*) FILTER (WHERE status = 'failed') AS failed_count
FROM billing_records
GROUP BY bucket, account_id, device_id
WITH NO DATA;

SELECT add_continuous_aggregate_policy('daily_billing_summary',
    start_offset => INTERVAL '7 days',
    end_offset => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Refresh historical data manually if needed
-- CALL refresh_continuous_aggregate('hourly_device_usage', '2024-01-01', '2026-12-31');
