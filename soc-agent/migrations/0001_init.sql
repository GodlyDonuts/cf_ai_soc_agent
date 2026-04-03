-- Simulated edge HTTP request logs for SOC investigations
CREATE TABLE IF NOT EXISTS http_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  src_asn INTEGER NOT NULL,
  src_ip TEXT NOT NULL,
  threat_type TEXT,
  signature TEXT,
  request_path TEXT NOT NULL,
  request_body_snippet TEXT,
  is_malicious INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_http_logs_ts ON http_logs(ts);
CREATE INDEX IF NOT EXISTS idx_http_logs_asn ON http_logs(src_asn);
CREATE INDEX IF NOT EXISTS idx_http_logs_malicious ON http_logs(is_malicious);
